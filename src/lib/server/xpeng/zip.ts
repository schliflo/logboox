/**
 * The CSVs inside a ZIP kept in the bucket, without unpacking it.
 *
 * A month inflates to ~270 MB, twice what a Worker has. So the central
 * directory is read with a range request, and each member is streamed on
 * demand through the platform's own inflate, as many times as asked. The
 * parser cannot tell these from dropped files.
 */

import type { FileLike } from '../../data/schema/streams';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
/** End record plus the longest comment a ZIP may carry. */
const TAIL = 22 + 0xffff;

async function range(storage: R2Bucket, key: string, offset: number, length: number) {
	const object = await storage.get(key, { range: { offset, length } });
	if (!object) throw new Error(`${key} is gone`);
	return new DataView(await object.arrayBuffer());
}

export async function zipMembers(storage: R2Bucket, key: string): Promise<FileLike[]> {
	const head = await storage.head(key);
	if (!head) throw new Error(`${key} is gone`);
	const tailStart = Math.max(0, head.size - TAIL);
	const tail = await range(storage, key, tailStart, head.size - tailStart);

	let end = -1;
	for (let i = tail.byteLength - 22; i >= 0; i--) {
		if (tail.getUint32(i, true) === EOCD) {
			end = i;
			break;
		}
	}
	if (end === -1) throw new Error('Not a ZIP: no end of central directory.');

	const count = tail.getUint16(end + 10, true);
	const size = tail.getUint32(end + 12, true);
	const offset = tail.getUint32(end + 16, true);
	// shortcut: no ZIP64; a month's export is far below 4 GB. Upgrade if XPeng ever sends one.
	if (offset === 0xffffffff || count === 0xffff)
		throw new Error('ZIP64 archives are not supported.');

	const directory = await range(storage, key, offset, size);
	const members: FileLike[] = [];
	for (let at = 0, i = 0; i < count; i++) {
		if (directory.getUint32(at, true) !== CENTRAL) throw new Error('Corrupt ZIP directory.');
		const method = directory.getUint16(at + 10, true);
		const compressed = directory.getUint32(at + 20, true);
		const inflated = directory.getUint32(at + 24, true);
		const nameLength = directory.getUint16(at + 28, true);
		const extra = directory.getUint16(at + 30, true);
		const comment = directory.getUint16(at + 32, true);
		const local = directory.getUint32(at + 42, true);
		const name = new TextDecoder().decode(
			new Uint8Array(directory.buffer, directory.byteOffset + at + 46, nameLength)
		);
		at += 46 + nameLength + extra + comment;

		if (!/\.csv$/i.test(name) || name.includes('__MACOSX')) continue;
		if (method !== 0 && method !== 8) throw new Error(`${name} uses ZIP method ${method}.`);
		if (compressed === 0xffffffff || inflated === 0xffffffff) {
			throw new Error('ZIP64 archives are not supported.');
		}

		members.push({
			name,
			size: inflated,
			stream: () => memberStream(storage, key, local, compressed, method)
		});
	}
	return members;
}

function memberStream(
	storage: R2Bucket,
	key: string,
	local: number,
	compressed: number,
	method: number
): ReadableStream<Uint8Array> {
	// Opened lazily: the parser asks for a stream and reads it at its own pace.
	const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
	void (async () => {
		try {
			const header = await range(storage, key, local, 30);
			if (header.getUint32(0, true) !== LOCAL) throw new Error('Corrupt ZIP member.');
			const start = local + 30 + header.getUint16(26, true) + header.getUint16(28, true);
			const object = await storage.get(key, { range: { offset: start, length: compressed } });
			if (!object) throw new Error(`${key} is gone`);
			const body = object.body as ReadableStream<Uint8Array>;
			const data =
				method === 8
					? body.pipeThrough(
							new DecompressionStream('deflate-raw') as ReadableWritablePair<Uint8Array, Uint8Array>
						)
					: body;
			await data.pipeTo(writable);
		} catch (error) {
			await writable.abort(error).catch(() => {});
		}
	})();
	return readable;
}
