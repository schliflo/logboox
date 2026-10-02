/**
 * Putting an export's buffers into the bucket, and finishing the upload.
 *
 * Every byte is charged to the account before it is stored, so the quota
 * holds while an upload is still in progress — and for one that is abandoned,
 * until the sweep takes it. Completing replaces the running charge with the
 * bucket's exact sum. After that the export is immutable: nothing more is
 * stored under it until it is removed.
 */

import { one, type Db } from '../db';
import { MAX_ACCOUNT_BYTES, MAX_BLOB_BYTES } from './limits';
import { blobKey, exportPrefix, listBlobSizes } from './r2';
import { expectedBlobNames, settleExport } from './repo';
import type { ExportRecord } from '$lib/history/codec';

/** Refused with the status the route answers; `missing` names absent buffers. */
export interface Refused {
	ok: false;
	status: number;
	error: string;
	missing?: string[];
}

export type UploadResult<T> = ({ ok: true } & T) | Refused;

function refuse(status: number, error: string): Refused {
	return { ok: false, status, error };
}

/** What deciding about an upload needs: whether it is finished, and its record. */
async function upload(
	db: Db,
	userId: string,
	id: string
): Promise<{ complete: boolean; record: ExportRecord } | null> {
	const row = await one<{ complete: number; record_json: string }>(
		db,
		'SELECT complete, record_json FROM exports WHERE user_id = ? AND id = ?',
		userId,
		id
	);
	return row
		? { complete: row.complete === 1, record: JSON.parse(row.record_json) as ExportRecord }
		: null;
}

/** Every one of these is a gzip member, and nothing else is accepted. */
function isGzip(bytes: Uint8Array): boolean {
	return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * Adds `delta` to an incomplete upload's charge if the account has room for
 * it. One statement, so parallel buffers cannot all fit into the same space.
 */
async function charge(db: Db, userId: string, id: string, delta: number): Promise<boolean> {
	const row = await one<{ stored_bytes: number }>(
		db,
		`UPDATE exports SET stored_bytes = stored_bytes + ?3
		 WHERE user_id = ?1 AND id = ?2 AND complete = 0
			AND (SELECT COALESCE(SUM(stored_bytes), 0) FROM exports WHERE user_id = ?1) + ?3 <= ?4
		 RETURNING stored_bytes`,
		userId,
		id,
		delta,
		MAX_ACCOUNT_BYTES
	);
	return row !== null;
}

/**
 * Stores one buffer of an incomplete upload.
 *
 * Charged by how much it grows the object under its name, so a retried buffer
 * costs nothing more. A smaller replacement is not credited back: two
 * replacements racing for one name could otherwise each subtract what the
 * other added. Racing the same name can therefore only overcharge, and
 * completing settles the exact sum. A charge whose write then fails does the
 * same, in the same safe direction.
 */
export async function storeBlob(
	db: Db,
	storage: R2Bucket,
	userId: string,
	id: string,
	name: string,
	body: ArrayBuffer
): Promise<UploadResult<{ bytes: number }>> {
	const current = await upload(db, userId, id);
	if (!current) return refuse(409, 'Send the export record before its buffers.');
	if (current.complete) {
		return refuse(409, 'That export is already in your account. Remove it to replace it.');
	}
	if (!expectedBlobNames(current.record).has(name)) {
		return refuse(400, 'That buffer is not one the record accounts for.');
	}

	const bytes = new Uint8Array(body);
	if (bytes.byteLength === 0) return refuse(400, 'That buffer is empty.');
	if (bytes.byteLength > MAX_BLOB_BYTES) return refuse(413, 'That buffer is too large.');
	if (!isGzip(bytes)) {
		return refuse(400, 'That buffer is not compressed the way this format requires.');
	}

	const key = blobKey(userId, id, name);
	const previous = (await storage.head(key))?.size ?? 0;
	const delta = Math.max(0, bytes.byteLength - previous);

	if (!(await charge(db, userId, id, delta))) {
		// Completed or removed since the read above, or out of room.
		const after = await upload(db, userId, id);
		if (!after || after.complete) {
			return refuse(409, 'That export is no longer taking buffers.');
		}
		return refuse(413, 'There is no room left in your account for this export.');
	}

	await storage.put(key, body);
	return { ok: true, bytes: bytes.byteLength };
}

/**
 * Finishes an upload once the bucket holds every buffer the record names.
 *
 * Only then is the export listed, so a browser that lost its connection
 * partway through leaves something invisible and replaceable rather than a
 * library entry that cannot be opened. Finishing twice is harmless.
 */
export async function completeUpload(
	db: Db,
	storage: R2Bucket,
	userId: string,
	id: string
): Promise<UploadResult<{ blobs: number }>> {
	const current = await upload(db, userId, id);
	if (!current) return refuse(404, 'There is no upload in progress for that export.');

	const expected = expectedBlobNames(current.record);
	if (current.complete) return { ok: true, blobs: expected.size };

	const present = await listBlobSizes(storage, exportPrefix(userId, id));
	const missing = [...expected].filter((name) => !present.has(name));
	if (missing.length > 0) {
		return {
			ok: false,
			status: 409,
			missing,
			error: `${missing.length} of ${expected.size} buffers did not arrive.`
		};
	}

	// Charged for what the bucket holds, strays included, not for what the
	// record claimed or what the buffers were charged on the way in.
	let bytes = 0;
	for (const size of present.values()) bytes += size;

	if (!(await settleExport(db, userId, id, bytes))) {
		// A second completion that lost the race to the first is still a success.
		if ((await upload(db, userId, id))?.complete) {
			return { ok: true, blobs: expected.size };
		}
		return refuse(413, 'There is no room left in your account for this export.');
	}
	return { ok: true, blobs: expected.size };
}
