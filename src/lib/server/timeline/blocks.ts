/**
 * One timeline per car, stored as weekly blocks. See docs/plan-weekly-blocks.md.
 *
 * A block is an ordinary export holding one car's samples for one
 * Monday-to-Monday UTC week. New data is merged into every block it reaches
 * (newer wins, `mergeSources`), stored under a new id, and the block it
 * replaces is removed. So the account never holds two copies of a second, and
 * the codec, bucket layout, quota and browser store work as for any export.
 *
 * Every write goes through `withTimelineLock`, so the hourly run, an upload
 * and a manual update never rewrite the same week from stale copies.
 */

import { analyze } from '../../data/analytics';
import { summarize, type ExportSummary } from '../../data/analytics/summary';
import { mergeSources, type MergeSource } from '../../data/parse/merge';
import { coalesceWindows, firstAtOrAfter, type Dataset } from '../../data/store/columnar';
import { packDataset } from '../../data/worker/protocol';
import {
	BLOCK_PREFIX,
	TIME_BLOB,
	encodeExport,
	sourceFromExport,
	type ExportRecord,
	type StoredBlob
} from '../../history/codec';
import { all, now, one, rowId, run, type Db } from '../db';
import { blobKey, deletePrefix, exportPrefix } from '../exports/r2';
import { beginExport, deleteExport, getRecord, QuotaExceeded } from '../exports/repo';
import { completeUpload } from '../exports/upload';
import { candidatesForExport } from '../leaderboard/repo';
import { freezeSharesOf } from '../shares/snapshot';

const DAY = 86400;
export const WEEK = 7 * DAY;

/** Longest a holder may keep the lock: the hourly run's whole budget, and then some. */
const LOCK_SECONDS = 15 * 60;

/** Monday 00:00 UTC of the week `t` falls in. 1970-01-01 was a Thursday. */
export function weekStart(t: number): number {
	const day = Math.floor(t / DAY);
	return (day - ((day + 3) % 7)) * DAY;
}

/** Eight hex digits standing for the car, so no id carries a VIN. FNV-1a. */
export function vinTag(vin: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < vin.length; i++) {
		hash ^= vin.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

/** What every version of one car's week starts with; see `blockSlot` in the codec. */
export function slotOf(week: number, vin: string): string {
	return `${BLOCK_PREFIX}${week}-${vinTag(vin)}-`;
}

/** The rows of `source` in `[from, to)`, still read one column at a time. */
export function windowSource(source: MergeSource, from: number, to: number): MergeSource {
	const start = firstAtOrAfter(source.time, from);
	const end = Math.max(start, firstAtOrAfter(source.time, to));
	return {
		...source,
		time: source.time.subarray(start, end),
		column(key) {
			const column = source.column(key);
			return column && { ...column, data: column.data.subarray(start, end) };
		},
		coverage: source.coverage
			?.filter((window) => window.endTime > from && window.startTime < to)
			.map((window) => ({
				...window,
				startTime: Math.max(window.startTime, from),
				endTime: Math.min(window.endTime, to - 1)
			}))
	};
}

export interface MergeOutcome {
	/** The blocks written, newest version of each week touched. */
	blocks: string[];
	/** What the new blocks would put on a board; see `candidatesForExport`. */
	candidates: Awaited<ReturnType<typeof candidatesForExport>>;
}

/** Merges `source` into the car's weekly blocks. Caller holds the timeline lock. */
export async function mergeIntoBlocks(
	db: Db,
	storage: R2Bucket,
	userId: string,
	source: MergeSource,
	timeZone: string
): Promise<MergeOutcome> {
	const outcome: MergeOutcome = { blocks: [], candidates: [] };
	if (source.time.length === 0) return outcome;
	if (!source.vin) throw new Error('The data names no vehicle, so it has no timeline to join.');

	const first = weekStart(source.time[0]);
	const last = weekStart(source.time[source.time.length - 1]);
	for (let week = first; week <= last; week += WEEK) {
		const part = windowSource(source, week, week + WEEK);
		if (part.time.length === 0) continue;

		const slot = slotOf(week, source.vin);
		// Normally one; more only if a writer died between storing a version and removing the last.
		const versions = await versionsOf(db, userId, slot);
		const sources: MergeSource[] = [];
		for (const version of versions) {
			const record = await getRecord(db, userId, version);
			if (record) sources.push(sourceFromExport(record, await readBlobs(storage, userId, record)));
		}
		sources.push(part);
		// In the order given: the new data wins wherever it differs, even a backfill.
		const merged = mergeSources(sources, { inOrder: true });
		// A new id per version, even when the week's end did not move: blocks are immutable.
		const id = `${slot}${rowId().slice(0, 8)}`;
		const candidates = await uncharged(db, userId, versions, () =>
			storeDataset(db, storage, userId, id, merged, timeZone)
		);
		for (const version of versions) await removeExport(db, storage, userId, version);
		outcome.blocks.push(id);
		outcome.candidates.push(...candidates);
	}
	return outcome;
}

/** Analyses, encodes and stores a dataset as a finished export, as an upload from the app would. */
export async function storeDataset(
	db: Db,
	storage: R2Bucket,
	userId: string,
	id: string,
	merged: Dataset,
	timeZone: string
): Promise<MergeOutcome['candidates']> {
	// A block is many imports deep; what one import said about its files means nothing here.
	const dataset: Dataset = {
		...merged,
		exportId: id,
		duplicateRows: 0,
		undatedRows: 0,
		rowsParsed: merged.time.length,
		bytesParsed: 0,
		coverage: merged.coverage && coalesceWindows(merged.coverage)
	};
	const derived = analyze(dataset, timeZone);
	const summary: ExportSummary = summarize(dataset, derived);
	const { record, blobs } = await encodeExport(packDataset(dataset).packed, derived, false);

	const { complete } = await beginExport(db, userId, id, record, summary, false, timeZone);
	if (complete) return [];
	for (const blob of blobs) await storage.put(blobKey(userId, id, blob.name), blob.bytes);
	const done = await completeUpload(db, storage, userId, id);
	if (!done.ok) {
		if (done.status === 413) throw new QuotaExceeded(0, 0);
		throw new Error(done.error);
	}
	return candidatesForExport(db, userId, id);
}

/** Every stored version of one car's week, oldest first. */
export async function versionsOf(db: Db, userId: string, slot: string): Promise<string[]> {
	const rows = await all<{ id: string }>(
		db,
		`SELECT id FROM exports WHERE user_id = ? AND complete = 1 AND id LIKE ? || '%'
		 ORDER BY uploaded_at, rowid`,
		userId,
		slot
	);
	return rows.map((row) => row.id);
}

/**
 * Runs `work` with `ids` not counted against the quota: data about to be
 * replaced by what `work` stores, so an account near its limit can still be
 * rewritten. Their charge comes back if `work` fails; on success they are removed.
 */
async function uncharged<T>(db: Db, userId: string, ids: string[], work: () => Promise<T>) {
	const charged: Array<{ id: string; stored_bytes: number }> = [];
	for (const id of ids) {
		const row = await one<{ stored_bytes: number }>(
			db,
			'SELECT stored_bytes FROM exports WHERE user_id = ? AND id = ?',
			userId,
			id
		);
		if (!row) continue;
		charged.push({ id, stored_bytes: row.stored_bytes });
		await run(db, 'UPDATE exports SET stored_bytes = 0 WHERE user_id = ? AND id = ?', userId, id);
	}
	try {
		return await work();
	} catch (error) {
		for (const { id, stored_bytes } of charged) {
			await run(
				db,
				'UPDATE exports SET stored_bytes = ? WHERE user_id = ? AND id = ?',
				stored_bytes,
				userId,
				id
			);
		}
		throw error;
	}
}

export async function readBlobs(
	storage: R2Bucket,
	userId: string,
	record: ExportRecord
): Promise<StoredBlob[]> {
	const blobs: StoredBlob[] = [];
	for (const name of [TIME_BLOB, ...record.columns.map((column) => column.key)]) {
		const object = await storage.get(blobKey(userId, record.id, name));
		if (!object) throw new Error(`${record.id} is missing ${name}.`);
		blobs.push({ id: record.id, name, bytes: await object.arrayBuffer() });
	}
	return blobs;
}

async function removeExport(db: Db, storage: R2Bucket, userId: string, id: string) {
	await deleteExport(db, userId, id);
	await deletePrefix(storage, exportPrefix(userId, id));
}

/**
 * Merges an uploaded export into the timeline and removes it, leaving a note
 * so the browser that sent it knows where it went. Caller holds the lock.
 */
export async function foldExport(
	db: Db,
	storage: R2Bucket,
	userId: string,
	id: string
): Promise<MergeOutcome> {
	const row = await one<{ time_zone: string | null }>(
		db,
		'SELECT time_zone FROM exports WHERE user_id = ? AND id = ? AND complete = 1 AND fold = 1',
		userId,
		id
	);
	const record = row && (await getRecord(db, userId, id));
	if (!record) return { blocks: [], candidates: [] };

	const source = sourceFromExport(record, await readBlobs(storage, userId, record));
	// Its weeks are written before it is removed; it must not count twice meanwhile.
	const outcome = await uncharged(db, userId, [id], () =>
		mergeIntoBlocks(db, storage, userId, source, row.time_zone ?? 'UTC')
	);
	// Links that read this export's own objects get copies of their own first.
	const shares = await all<{ id: string; time_zone: string }>(
		db,
		'SELECT id, time_zone FROM shares WHERE user_id = ? AND export_id = ? AND revoked_at IS NULL',
		userId,
		id
	);
	await freezeSharesOf(db, storage, userId, id, shares);
	await run(
		db,
		'INSERT OR REPLACE INTO folded_exports (user_id, id, folded_at) VALUES (?, ?, ?)',
		userId,
		id,
		now()
	);
	await removeExport(db, storage, userId, id);
	return outcome;
}

/** Uploads still waiting to be merged, oldest first. */
export function pendingFolds(db: Db): Promise<Array<{ user_id: string; id: string }>> {
	return all(
		db,
		'SELECT user_id, id FROM exports WHERE fold = 1 AND complete = 1 ORDER BY uploaded_at'
	);
}

export async function foldedIds(db: Db, userId: string): Promise<string[]> {
	const rows = await all<{ id: string }>(
		db,
		'SELECT id FROM folded_exports WHERE user_id = ?',
		userId
	);
	return rows.map((row) => row.id);
}

export async function isFolded(db: Db, userId: string, id: string): Promise<boolean> {
	return (
		(await one(db, 'SELECT 1 FROM folded_exports WHERE user_id = ? AND id = ?', userId, id)) !==
		null
	);
}

/**
 * Marks a finished upload for the timeline and merges it at once if nobody
 * else is writing. Otherwise, or if merging fails, the import Worker's next
 * run does it; the upload is a whole export in the account until then.
 */
export async function foldUpload(
	db: Db,
	storage: R2Bucket,
	userId: string,
	id: string
): Promise<MergeOutcome | null> {
	const changed = await run(
		db,
		`UPDATE exports SET fold = 1
		 WHERE user_id = ? AND id = ? AND complete = 1 AND is_demo = 0 AND id NOT LIKE ?`,
		userId,
		id,
		`${BLOCK_PREFIX}%`
	);
	if (changed === 0) return null;
	try {
		return await withTimelineLock(db, userId, () => foldExport(db, storage, userId, id));
	} catch (error) {
		console.error(`folding ${id} into the timeline failed; the next run retries:`, error);
		return null;
	}
}

/**
 * Runs `work` as the only writer of this account's timeline, or returns null
 * at once if someone else is writing. A holder that died frees it after
 * `LOCK_SECONDS`.
 */
export async function withTimelineLock<T>(
	db: Db,
	userId: string,
	work: () => Promise<T>
): Promise<T | null> {
	const holder = rowId();
	const t = now();
	await run(
		db,
		`INSERT INTO timeline_locks (user_id, holder, until) VALUES (?1, ?2, ?3)
		 ON CONFLICT (user_id) DO UPDATE SET holder = ?2, until = ?3 WHERE timeline_locks.until < ?4`,
		userId,
		holder,
		t + LOCK_SECONDS,
		t
	);
	const lock = await one<{ holder: string }>(
		db,
		'SELECT holder FROM timeline_locks WHERE user_id = ?',
		userId
	);
	if (lock?.holder !== holder) return null;
	try {
		return await work();
	} finally {
		await run(db, 'DELETE FROM timeline_locks WHERE user_id = ? AND holder = ?', userId, holder);
	}
}
