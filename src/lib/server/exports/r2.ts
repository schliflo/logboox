/**
 * Where the compressed columns live.
 *
 * One object per signal, exactly the bytes the browser keeps in IndexedDB: a
 * gzip member per column plus one for the timeline. Storing them separately
 * rather than as one archive is what lets a merge pull one signal at a time,
 * and what lets a share copy a slice without touching the rest.
 *
 * The key carries the owner, so nothing can be read across accounts by
 * guessing an export id — XPeng's request ids are not ours to make unique.
 */

/** Object names are export-controlled, so they are checked before they are used. */
const SAFE_NAME = /^[A-Za-z0-9._-]{1,120}$/;

export function isSafeBlobName(name: string): boolean {
	return SAFE_NAME.test(name);
}

function segment(value: string): string {
	return value.replace(/[^A-Za-z0-9._-]/g, '_') || 'export';
}

export function exportPrefix(userId: string, exportId: string): string {
	return `users/${segment(userId)}/exports/${segment(exportId)}/`;
}

export function blobKey(userId: string, exportId: string, name: string): string {
	return `${exportPrefix(userId, exportId)}${name}.gz`;
}

export function sharePrefix(shareId: string): string {
	return `shares/${segment(shareId)}/`;
}

export function shareBlobKey(shareId: string, name: string): string {
	return `${sharePrefix(shareId)}${name}.gz`;
}

/** The blob names actually present under a prefix, without their suffix. */
export async function listBlobNames(storage: R2Bucket, prefix: string): Promise<Set<string>> {
	const names = new Set<string>();
	let cursor: string | undefined;
	do {
		const page = await storage.list({ prefix, cursor, limit: 1000 });
		for (const object of page.objects) {
			const name = object.key.slice(prefix.length);
			if (name.endsWith('.gz')) names.add(name.slice(0, -3));
		}
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);
	return names;
}

/**
 * Removes everything under a prefix. R2 deletes up to a thousand keys at a
 * time, and a listing is only consistent enough to trust one page at a time,
 * so this loops until a listing comes back empty.
 */
export async function deletePrefix(storage: R2Bucket, prefix: string): Promise<number> {
	let removed = 0;
	for (;;) {
		const page = await storage.list({ prefix, limit: 1000 });
		if (page.objects.length === 0) return removed;
		await storage.delete(page.objects.map((object) => object.key));
		removed += page.objects.length;
		if (!page.truncated) return removed;
	}
}
