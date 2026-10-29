import { beforeEach, describe, expect, it } from 'vitest';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { memoryBucket, type MemoryBucket } from '../testing/memory-bucket';
import { all, one, run } from '../db';
import { findOrCreateUser } from '../auth/users';
import { combineStreams } from '../../data/parse/align';
import { parseStream } from '../../data/parse/ingest';
import { sourceFromDataset } from '../../data/parse/merge';
import { recognizeFiles, type FileLike, type StreamId } from '../../data/schema/streams';
import { getRecord } from '../exports/repo';
import { MAX_ACCOUNT_BYTES } from '../exports/limits';
import { BLOCK_PREFIX, blockSlot, sourceFromExport } from '../../history/codec';
import { freezeShare, SHARE_RECORD } from '../shares/snapshot';
import { shareBlobKey } from '../exports/r2';
import {
	WEEK,
	foldUpload,
	isFolded,
	mergeIntoBlocks,
	readBlobs,
	slotOf,
	storeDataset,
	weekStart,
	withTimelineLock
} from './blocks';

const DAY = 86400;
const VIN = 'L1NTEST00000000001';
/** A Monday, 00:00 UTC. */
const BASE = weekStart(1792000000);

let db: TestDb;
let bucket: MemoryBucket;
let userId: string;

/** One-hour drives at 08:00 on each of `days` days from `first`, at `speed`. */
function drives(first: number, days: number): number[] {
	const times: number[] = [];
	for (let d = 0; d < days; d++) {
		const start = BASE + (first + d) * DAY + 8 * 3600;
		for (let s = 0; s < 3600; s++) times.push(start + s);
	}
	return times;
}

function file(name: string, text: string): FileLike {
	const bytes = new TextEncoder().encode(text);
	return { name, size: bytes.length, stream: () => new Response(bytes).body! };
}

async function dataset(times: number[], speed: number) {
	const prefix = 'DA0001_dwd_opp_gdpr_veh_driving_';
	const csv = (header: string, row: (i: number) => string) =>
		`vin,vmodel,timer,ds,${header}\n` +
		times.map((t, i) => `${VIN},F30b,${t},20261012,${row(i)}`).join('\n');
	const plan = recognizeFiles([
		file(
			`${prefix}operation_di.csv`,
			csv('esp_vehspd,cdcu_totalodometer', (i) => `${speed}.0,${1000 + Math.floor(i / 72)}`)
		),
		file(
			`${prefix}power_energy_di.csv`,
			csv('ldcu_bms_soc_disp', () => '80.0')
		)
	]);
	const results = [];
	for (const stream of Object.keys(plan.streams) as StreamId[]) {
		results.push(await parseStream(plan.streams[stream]!, stream));
	}
	return combineStreams(results, 'test');
}

async function merge(times: number[], speed: number) {
	const data = await dataset(times, speed);
	return mergeIntoBlocks(db, bucket, userId, sourceFromDataset(data), 'Europe/Berlin');
}

function blocks() {
	return all<{ id: string; start_time: number; end_time: number; rows: number }>(
		db,
		`SELECT id, start_time, end_time, rows FROM exports WHERE user_id = ? AND complete = 1
		 ORDER BY start_time`,
		userId
	);
}

/** The stored speed at second `t`. */
async function speedAt(id: string, t: number): Promise<number> {
	const record = (await getRecord(db, userId, id))!;
	const source = sourceFromExport(record, await readBlobs(bucket, userId, record));
	const i = source.time.indexOf(t);
	const column = source.column('esp_vehspd')!;
	return column.data[i] * column.spec.scale + column.spec.offset;
}

beforeEach(async () => {
	db = migratedDb();
	bucket = memoryBucket();
	userId = (await findOrCreateUser(db, 'owner@example.com')).user.id;
});

describe('weekStart', () => {
	it('is Monday 00:00 UTC', () => {
		expect(new Date(BASE * 1000).toISOString()).toMatch(/T00:00:00.000Z$/);
		expect(new Date(BASE * 1000).getUTCDay()).toBe(1);
		expect(weekStart(BASE + WEEK - 1)).toBe(BASE);
		expect(weekStart(BASE + WEEK)).toBe(BASE + WEEK);
	});
});

describe('mergeIntoBlocks', () => {
	it('keeps one block per week, every row once, and lets new data win', async () => {
		// Ten days: two weeks.
		const first = await merge(drives(0, 10), 50);
		expect(first.blocks).toHaveLength(2);
		let stored = await blocks();
		expect(stored.map((b) => blockSlot(b.id))).toEqual([
			slotOf(BASE, VIN),
			slotOf(BASE + WEEK, VIN)
		]);
		expect(stored.reduce((sum, b) => sum + b.rows, 0)).toBe(10 * 3600);
		expect(stored.every((b) => !b.id.includes(VIN))).toBe(true);

		// The next day's file: the last three days again, faster, and one more.
		await merge(drives(8, 3), 60);
		stored = await blocks();
		expect(stored).toHaveLength(2);
		expect(stored.reduce((sum, b) => sum + b.rows, 0)).toBe(11 * 3600);
		expect(await speedAt(stored[1].id, BASE + 9 * DAY + 8 * 3600)).toBe(60);
		expect(await speedAt(stored[1].id, BASE + 7 * DAY + 8 * 3600)).toBe(50);

		// The replaced block is gone, bytes and all.
		const ids = new Set([...bucket.sizes.keys()].map((key) => key.split('/')[3]));
		expect([...ids].filter((id) => id?.startsWith(BLOCK_PREFIX)).sort()).toEqual(
			stored.map((b) => b.id).sort()
		);
		const trips = await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM trips');
		expect(trips?.n).toBe(11);
	});

	it('lets a backfill win over the block even though the block reaches further', async () => {
		await merge(drives(0, 5), 50);
		await merge(drives(1, 1), 70);
		const [block] = await blocks();
		expect(await speedAt(block.id, BASE + DAY + 8 * 3600)).toBe(70);
		expect(await speedAt(block.id, BASE + 4 * DAY + 8 * 3600)).toBe(50);
	});

	it('merges and removes every version of a week a dead writer left behind', async () => {
		await merge(drives(0, 1), 50);
		await storeDataset(
			db,
			bucket,
			userId,
			`${slotOf(BASE, VIN)}deadbeef`,
			await dataset(drives(1, 1), 60),
			'UTC'
		);
		await merge(drives(2, 1), 70);

		const stored = await blocks();
		expect(stored).toHaveLength(1);
		expect(stored[0].rows).toBe(3 * 3600);
		expect(await speedAt(stored[0].id, BASE + DAY + 8 * 3600)).toBe(60);
	});
});

describe('foldUpload', () => {
	it('merges a finished upload into the timeline and leaves a note of it', async () => {
		const upload = 'upload-1';
		await storeDataset(db, bucket, userId, upload, await dataset(drives(0, 3), 50), 'UTC');

		const outcome = await foldUpload(db, bucket, userId, upload);
		expect(outcome?.blocks).toHaveLength(1);
		const stored = await blocks();
		expect(stored.map((b) => blockSlot(b.id))).toEqual([slotOf(BASE, VIN)]);
		expect(stored[0].rows).toBe(3 * 3600);
		expect(await one(db, 'SELECT id FROM folded_exports')).toEqual({ id: upload });
		expect([...bucket.sizes.keys()].some((key) => key.includes(upload))).toBe(false);
		const trips = await all<{ export_id: string }>(db, 'SELECT export_id FROM trips');
		expect(trips.every((trip) => trip.export_id === stored[0].id)).toBe(true);

		// Asking again does nothing.
		expect(await foldUpload(db, bucket, userId, upload)).toBeNull();
	});

	it('fits an account whose upload fills its quota: the upload is not charged twice', async () => {
		const upload = 'upload-1';
		await storeDataset(db, bucket, userId, upload, await dataset(drives(0, 3), 50), 'UTC');
		await run(
			db,
			'UPDATE exports SET stored_bytes = ? WHERE id = ?',
			MAX_ACCOUNT_BYTES - 1000,
			upload
		);

		expect((await foldUpload(db, bucket, userId, upload))?.blocks).toHaveLength(1);
		expect(await isFolded(db, userId, upload)).toBe(true);
	});
});

describe('freezeShare', () => {
	it('cuts the range out of the newest blocks and keeps nothing of the owner', async () => {
		const { blocks: old } = await merge(drives(0, 10), 50);
		// The timeline moves on after the browser listed its blocks.
		await merge(drives(9, 1), 60);

		const record = await freezeShare(db, bucket, userId, 'share1', old, 'UTC', {
			from: BASE + 2 * DAY,
			to: BASE + 9 * DAY + 9 * 3600
		});
		expect(record.rows).toBe(7 * 3600 + 3600);
		const stored = JSON.parse(
			await (await bucket.get(shareBlobKey('share1', SHARE_RECORD)))!.text()
		);
		expect(stored.vin).toBe('');
		expect(JSON.stringify(stored)).not.toContain(VIN);
		expect(stored.coverage.every((w: { exportId: string }) => w.exportId === 'share1')).toBe(true);
	});

	it('is made for a link to an upload before the upload joins the timeline', async () => {
		await storeDataset(db, bucket, userId, 'upload-1', await dataset(drives(0, 3), 50), 'UTC');
		await run(
			db,
			`INSERT INTO shares (id, user_id, kind, vmodel, start_time, end_time, time_zone, export_id,
				owner_user_id, meta_json, created_at)
			 VALUES ('old', ?, 'export', 'F30b', 0, 0, 'UTC', 'upload-1', ?, '{}', 0)`,
			userId,
			userId
		);
		await foldUpload(db, bucket, userId, 'upload-1');
		expect(await one(db, "SELECT export_id FROM shares WHERE id = 'old'")).toEqual({
			export_id: null
		});
		expect(bucket.sizes.has(shareBlobKey('old', SHARE_RECORD))).toBe(true);
	});
});

describe('withTimelineLock', () => {
	it('lets one writer in at a time and frees the lock after', async () => {
		const inner = await withTimelineLock(db, userId, () =>
			withTimelineLock(db, userId, async () => 'second')
		);
		expect(inner).toBeNull();
		expect(await withTimelineLock(db, userId, async () => 'again')).toBe('again');
	});

	it('takes over a lock whose holder died', async () => {
		await run(
			db,
			'INSERT INTO timeline_locks (user_id, holder, until) VALUES (?, ?, 0)',
			userId,
			'gone'
		);
		expect(await withTimelineLock(db, userId, async () => 'mine')).toBe('mine');
	});
});
