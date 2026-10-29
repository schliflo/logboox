/**
 * Automatic import, step two: merging a fetched ZIP into the car's timeline.
 *
 * The same parser the browser uses, run in the import Worker. Only rows after
 * `imported_to` (less a day of overlap) are read, in slices of `PASS_SECONDS`
 * so memory stays far below a Worker's 128 MB: each slice re-reads the CSVs
 * straight out of the bucket (see `./zip.ts`) and keeps only its own rows.
 * Each slice is merged into the weekly blocks it reaches
 * (`../timeline/blocks.ts`). A drive still under way at the end of one ZIP is
 * completed when the next one is merged over it.
 */

import { combineStreams } from '../../data/parse/align';
import { parseStream } from '../../data/parse/ingest';
import { sourceFromDataset } from '../../data/parse/merge';
import { recognizeFiles, type StreamId } from '../../data/schema/streams';
import { all, one, run, type Db } from '../db';
import { QuotaExceeded } from '../exports/repo';
import { foldExport, mergeIntoBlocks, pendingFolds, withTimelineLock } from '../timeline/blocks';
import { deleteDownload, findLink, type XpengDownload } from './fetch';
import { zipMembers } from './zip';

/** Measured on a real month: ~40 MB at peak, a third of a Worker's memory. Longer is faster but tighter. */
export const PASS_SECONDS = 4 * 86400;

const DAY = 86400;

/** XPeng's window, with a day's slack. Nothing older can be in an export. */
const WINDOW_SECONDS = 31 * DAY;

/** Read again from the last import on, for rows XPeng delivered late. Merging them twice is harmless. */
const OVERLAP_SECONDS = DAY;

/** Failed imports of one ZIP before it is deleted; the next day's holds the same days. */
export const MAX_ATTEMPTS = 3;

export interface ImportReport {
	imported: number;
	folded: number;
	failed: number;
	/** Skipped because an upload or manual update held the timeline; next run. */
	busy: number;
}

/**
 * Every fetched ZIP and pending upload, oldest first, until `deadline` (epoch
 * ms). Sequential on purpose: one slice in memory at a time.
 */
export async function runImports(
	db: Db,
	storage: R2Bucket,
	deadline = Date.now() + 10 * 60_000
): Promise<ImportReport> {
	const report: ImportReport = { imported: 0, folded: 0, failed: 0, busy: 0 };

	for (const upload of await pendingFolds(db)) {
		if (Date.now() > deadline) return report;
		try {
			const done = await withTimelineLock(db, upload.user_id, () =>
				foldExport(db, storage, upload.user_id, upload.id)
			);
			if (done) report.folded++;
			else report.busy++;
		} catch (error) {
			// Left as a whole export, as before the timeline, rather than retried every hour.
			console.error(`folding ${upload.id} into the timeline failed:`, error);
			await run(
				db,
				'UPDATE exports SET fold = 0 WHERE user_id = ? AND id = ?',
				upload.user_id,
				upload.id
			);
			report.failed++;
		}
	}

	const waiting = await all<XpengDownload>(
		db,
		'SELECT * FROM xpeng_downloads WHERE attempts < ? ORDER BY created_at',
		MAX_ATTEMPTS
	);
	for (const download of waiting) {
		if (Date.now() > deadline) break;
		const outcome = await importOne(db, storage, download);
		report[outcome]++;
	}
	return report;
}

/** Imports one ZIP under the timeline lock, and deals with the ZIP either way. */
export async function importOne(
	db: Db,
	storage: R2Bucket,
	download: XpengDownload
): Promise<'imported' | 'failed' | 'busy'> {
	try {
		const done = await withTimelineLock(db, download.user_id, async () => {
			const timeZone = (await findLink(db, download.user_id))?.time_zone ?? 'UTC';
			await importDownload(db, storage, download, timeZone);
			await deleteDownload(db, storage, download);
			return true;
		});
		return done ? 'imported' : 'busy';
	} catch (error) {
		console.error(`xpeng import of ${download.id} failed:`, error);
		if (download.attempts + 1 >= MAX_ATTEMPTS) await deleteDownload(db, storage, download);
		else
			await run(db, 'UPDATE xpeng_downloads SET attempts = attempts + 1 WHERE id = ?', download.id);
		await run(
			db,
			'UPDATE xpeng_links SET message = ? WHERE user_id = ?',
			error instanceof QuotaExceeded ? 'quota' : 'importFailed',
			download.user_id
		);
		return 'failed';
	}
}

/** Merges what the ZIP adds into the timeline, slice by slice. Caller holds the lock. */
export async function importDownload(
	db: Db,
	storage: R2Bucket,
	download: XpengDownload,
	timeZone: string
): Promise<void> {
	const plan = recognizeFiles(await zipMembers(storage, download.r2_key));
	const streams = Object.keys(plan.streams) as StreamId[];
	if (streams.length === 0) throw new Error('The ZIP holds no export files.');

	const end = download.created_at;
	let from = Math.max((await cursor(db, download.user_id)) - OVERLAP_SECONDS, end - WINDOW_SECONDS);

	while (from < end) {
		const to = Math.min(from + PASS_SECONDS, end);
		const results = [];
		for (const stream of streams) {
			results.push(await parseStream(plan.streams[stream]!, stream, undefined, { from, to }));
		}
		const dataset = combineStreams(results, plan.exportIds[0] ?? 'export');
		await mergeIntoBlocks(db, storage, download.user_id, sourceFromDataset(dataset), timeZone);

		// Up to the last row seen, not the fetch: XPeng may still deliver what lies between.
		const reached = dataset.time.length ? dataset.time[dataset.time.length - 1] + 1 : null;
		if (reached) {
			await run(
				db,
				`UPDATE xpeng_links SET imported_to = MAX(COALESCE(imported_to, 0), ?), message = NULL
				 WHERE user_id = ?`,
				reached,
				download.user_id
			);
		}
		from = to;
	}
}

/** Where to start: what the last import reached, else after the newest data the account has. */
async function cursor(db: Db, userId: string): Promise<number> {
	const link = await findLink(db, userId);
	if (link?.imported_to) return link.imported_to;
	// shortcut: one car per account, as one XPeng authorisation is. Per-VIN cursors if that changes.
	const newest = await one<{ end: number | null }>(
		db,
		'SELECT MAX(end_time) AS end FROM exports WHERE user_id = ? AND complete = 1 AND is_demo = 0',
		userId
	);
	return newest?.end ? newest.end + 1 + OVERLAP_SECONDS : 0;
}
