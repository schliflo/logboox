/**
 * Storing the slice behind a trip or session share.
 *
 * What may be stored is decided by the share row, not by listing the bucket:
 * a listing taken by a hundred parallel uploads shows each of them the same
 * empty share. The manifest is claimed and every buffer reserved with one
 * conditional update each, before anything is written.
 */

import { run, type Db } from '../db';
import { shareBlobKey } from '../exports/r2';
import { MAX_SHARE_BLOBS, MAX_SHARE_BYTES, type ShareRow } from './repo';
import { MANIFEST_BLOB, checkBlobUpload, parseManifest, type Checked } from './validate';

export async function storeShareBlob(
	db: Db,
	storage: R2Bucket,
	share: Pick<ShareRow, 'id' | 'created_at'>,
	name: string,
	bytes: Uint8Array,
	now: number
): Promise<Checked<'manifest' | 'buffer'>> {
	let manifest = null;
	if (name !== MANIFEST_BLOB) {
		const object = await storage.get(shareBlobKey(share.id, MANIFEST_BLOB));
		if (object) manifest = parseManifest(await object.text());
	}

	const checked = checkBlobUpload({ name, bytes, createdAt: share.created_at, now, manifest });
	if (!checked.ok) return checked;

	if (checked.value === 'manifest') {
		// Claimed and counted as the share's first object in one statement, so
		// two manifests sent at once cannot both be the first.
		const claimed = await run(
			db,
			`UPDATE shares SET manifest_at = ?2, blob_bytes = blob_bytes + ?3, blob_count = blob_count + 1
			 WHERE id = ?1 AND manifest_at IS NULL`,
			share.id,
			now,
			bytes.byteLength
		);
		if (claimed === 0) {
			return { ok: false, status: 409, error: 'That link already has its manifest.' };
		}
	} else {
		// Reserved before the write. A retried buffer is reserved again: it
		// replaces its own object but is counted twice, which can only stop a
		// share early, never let it past the caps.
		const reserved = await run(
			db,
			`UPDATE shares SET blob_bytes = blob_bytes + ?2, blob_count = blob_count + 1
			 WHERE id = ?1 AND blob_bytes + ?2 <= ?3 AND blob_count < ?4`,
			share.id,
			bytes.byteLength,
			MAX_SHARE_BYTES,
			MAX_SHARE_BLOBS
		);
		if (reserved === 0) {
			return { ok: false, status: 413, error: 'That is more than one trip could ever need.' };
		}
	}

	await storage.put(shareBlobKey(share.id, name), bytes);
	return checked;
}
