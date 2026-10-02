/**
 * An R2-shaped bucket in memory, for the tests.
 *
 * Only what the app calls: head, get, put, list and delete, with sizes and
 * prefixes behaving as R2's do. Listing returns one object per page, so code
 * that pages is exercised too.
 */

export interface MemoryBucket extends R2Bucket {
	/** Every key and its size, for asserting on. */
	readonly sizes: Map<string, number>;
}

function bytesOf(value: unknown): Uint8Array {
	if (value instanceof Uint8Array) return value;
	if (value instanceof ArrayBuffer) return new Uint8Array(value);
	if (typeof value === 'string') return new TextEncoder().encode(value);
	throw new TypeError('The memory bucket takes bytes or text.');
}

export function memoryBucket(): MemoryBucket {
	const objects = new Map<string, Uint8Array>();
	const sizes = new Map<string, number>();

	const meta = (key: string) => ({ key, size: objects.get(key)!.byteLength });

	return {
		sizes,
		async head(key: string) {
			return objects.has(key) ? meta(key) : null;
		},
		async get(key: string) {
			const bytes = objects.get(key);
			if (!bytes) return null;
			return {
				...meta(key),
				text: async () => new TextDecoder().decode(bytes),
				arrayBuffer: async () => bytes.slice().buffer
			};
		},
		async put(key: string, value: unknown) {
			const bytes = bytesOf(value).slice();
			objects.set(key, bytes);
			sizes.set(key, bytes.byteLength);
			return meta(key);
		},
		async list(options?: R2ListOptions) {
			const keys = [...objects.keys()]
				.filter((key) => key.startsWith(options?.prefix ?? ''))
				.sort();
			const at = options?.cursor ? Number(options.cursor) : 0;
			const key = keys[at];
			const truncated = at + 1 < keys.length;
			return {
				objects: key ? [meta(key)] : [],
				truncated,
				cursor: truncated ? String(at + 1) : undefined,
				delimitedPrefixes: []
			};
		},
		async delete(keys: string | string[]) {
			for (const key of Array.isArray(keys) ? keys : [keys]) {
				objects.delete(key);
				sizes.delete(key);
			}
		}
	} as unknown as MemoryBucket;
}
