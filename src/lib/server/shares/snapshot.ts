/**
 * A shared range, frozen at the moment it was shared.
 *
 * The timeline's weekly blocks are rewritten whenever new data arrives, so a
 * link cannot point at them. Instead the range is cut out of the owner's
 * exports here, on the server, and stored under the share's own prefix: a
 * record and its buffers, served by the share's record and blob routes. Later
 * rewrites, merges and removals leave it as it was.
 */

import { analyze } from '../../data/analytics';
import { mergeSources } from '../../data/parse/merge';
import { packDataset } from '../../data/worker/protocol';
import { blockSlot, encodeExport, sourceFromExport, type ExportRecord } from '../../history/codec';
import { run, type Db } from '../db';
import { shareBlobKey } from '../exports/r2';
import { getRecord } from '../exports/repo';
import { readBlobs, versionsOf, windowSource } from '../timeline/blocks';

/** Where a frozen share keeps its record, beside its buffers. */
export const SHARE_RECORD = '_record';

/** Before any epoch-second timestamp and after every one. */
const ALL = { from: 0, to: 2 ** 32 };

/**
 * Cuts `[from, to)` out of the owner's exports `ids` and stores it as the
 * share's own copy. Throws if one of them is not the owner's.
 */
export async function freezeShare(
	db: Db,
	storage: R2Bucket,
	ownerId: string,
	shareId: string,
	ids: string[],
	timeZone: string,
	{ from, to } = ALL
): Promise<ExportRecord> {
	const sources = [];
	for (const id of ids) {
		const record = await getRecord(db, ownerId, await current(db, ownerId, id));
		if (!record) throw new Error('Part of that range is not in your account.');
		const source = sourceFromExport(record, await readBlobs(storage, ownerId, record));
		sources.push(windowSource(source, from, to));
	}
	const merged = mergeSources(sources);
	if (merged.time.length === 0) throw new Error('There is nothing recorded in that range.');
	// Nothing that leads back to the owner: no VIN, no ids of their exports.
	const dataset = {
		...merged,
		exportId: shareId,
		vin: '',
		coverage: merged.coverage?.map((window) => ({ ...window, exportId: shareId }))
	};

	const { record, blobs } = await encodeExport(
		packDataset(dataset).packed,
		analyze(dataset, timeZone),
		false
	);
	for (const blob of blobs) await storage.put(shareBlobKey(shareId, blob.name), blob.bytes);
	await storage.put(shareBlobKey(shareId, SHARE_RECORD), JSON.stringify(record));
	return record;
}

/** A block the timeline has since rewritten stands for its newest version. */
async function current(db: Db, ownerId: string, id: string): Promise<string> {
	const slot = blockSlot(id);
	if (!slot) return id;
	return (await versionsOf(db, ownerId, slot)).at(-1) ?? id;
}

/**
 * Freezes every live link that still reads this export's own objects, so
 * removing the export leaves them working. Links from before frozen shares.
 */
export async function freezeSharesOf(
	db: Db,
	storage: R2Bucket,
	ownerId: string,
	exportId: string,
	shares: Array<{ id: string; time_zone: string }>
): Promise<void> {
	for (const share of shares) {
		await freezeShare(db, storage, ownerId, share.id, [exportId], share.time_zone);
		await run(db, 'UPDATE shares SET export_id = NULL WHERE id = ?', share.id);
	}
}
