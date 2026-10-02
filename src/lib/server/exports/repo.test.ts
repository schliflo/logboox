/**
 * Keeping exports in an account.
 *
 * The record and the summary are written by the browser, so what matters here
 * is what the server refuses, and that overlapping exports — which is what
 * XPeng's rolling window guarantees — update the trips they share rather than
 * accumulating duplicates of them.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExportRecord } from '$lib/history/codec';
import type { ExportSummary, TripSummary } from '$lib/data/analytics/summary';
import { sessionSummary, tripSummary } from '$lib/leaderboard/testing';
import { BOARDS, boardById, valueFor, type ItemBoard } from '$lib/leaderboard/boards';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { BATCH_SIZE, all, one, run, type Db } from '../db';
import { findOrCreateUser } from '../auth/users';
import { MAX_ACCOUNT_BYTES } from './limits';
import { listBlobSizes } from './r2';
import { memoryBucket } from '../testing/memory-bucket';
import { vehicleTotals } from './vehicles';
import {
	Invalid,
	QuotaExceeded,
	beginExport,
	checkRecord,
	deleteExport,
	expectedBlobNames,
	isVin,
	listExports,
	settleExport,
	staleUploads
} from './repo';

let db: TestDb;
let userId: string;

const JULY = Math.floor(Date.UTC(2026, 6, 1) / 1000);

function record(overrides: Partial<ExportRecord> = {}): ExportRecord {
	return {
		id: 'DA0001',
		version: 1,
		exportId: 'DA0001',
		vin: 'L1NTEST00000000001',
		vmodel: 'F30b',
		keptAt: Date.now(),
		isDemo: false,
		startTime: JULY,
		endTime: JULY + 29 * 86400,
		rows: 1000,
		days: 30,
		distanceKm: 1200,
		trips: 40,
		storedBytes: 8 * 1024 * 1024,
		columns: [{ key: 'esp_vehspd', spec: { key: 'esp_vehspd' }, nonNull: 900, min: 0, max: 130 }],
		available: { status: true, operation: true, power: true },
		duplicateRows: 0,
		unsortedStreams: [],
		emptyColumns: [],
		rowsParsed: 1000,
		bytesParsed: 1_000_000,
		aligned: true,
		coverage: [],
		...overrides
	} as unknown as ExportRecord;
}

function summary(overrides: Partial<ExportSummary> = {}): ExportSummary {
	return {
		trips: [],
		charging: [],
		vehicle: {
			vin: 'L1NTEST00000000001',
			vmodel: 'F30b',
			lastSampleTime: JULY + 29 * 86400,
			odometerKm: 41207,
			soc: 62,
			rangeKm: 310
		},
		...overrides
	};
}

/** Lists an upload, as completing it does once the bucket agrees. */
async function finish(id: string, bytes = 0) {
	expect(await settleExport(db, userId, id, bytes)).toBe(true);
}

function trip(startTime: number, odoStart: number) {
	return tripSummary({ startTime, odoStart, odoEnd: odoStart + 20 });
}

beforeEach(async () => {
	db = migratedDb();
	userId = (await findOrCreateUser(db, 'reader@example.com')).user.id;
});

afterEach(() => {
	db.close();
});

describe('checking a record', () => {
	it('accepts one the app would actually write', () => {
		expect(() => checkRecord(record(), 'DA0001')).not.toThrow();
	});

	it('refuses one sent for a different export', () => {
		expect(() => checkRecord(record(), 'DA0002')).toThrow(Invalid);
	});

	it('refuses a period that is not one', () => {
		expect(() => checkRecord(record({ endTime: JULY - 10 }), 'DA0001')).toThrow(Invalid);
		expect(() => checkRecord(record({ startTime: 12 }), 'DA0001')).toThrow(Invalid);
	});

	it('refuses a column name that could not be stored as an object', () => {
		const bad = record();
		bad.columns = [{ key: '../escape', spec: {}, nonNull: 1, min: 0, max: 1 }] as never;
		expect(() => checkRecord(bad, 'DA0001')).toThrow(Invalid);
	});

	it('refuses a size no account could hold', () => {
		expect(() => checkRecord(record({ storedBytes: MAX_ACCOUNT_BYTES * 2 }), 'DA0001')).toThrow(
			Invalid
		);
	});

	it('refuses a model name that could carry markup onto a public page', () => {
		expect(() => checkRecord(record({ vmodel: 'G6 <b>Pro</b>' }), 'DA0001')).toThrow(Invalid);
		expect(() => checkRecord(record({ vmodel: 'G6 Pro_2.0-X' }), 'DA0001')).not.toThrow();
	});

	it('refuses a vehicle identifier with anything but letters and digits in it', () => {
		expect(() => checkRecord(record({ vin: 'L1N/../x' }), 'DA0001')).toThrow(Invalid);
		expect(isVin('L1NTEST00000000001')).toBe(true);
		expect(isVin('')).toBe(false);
		expect(isVin('x'.repeat(33))).toBe(false);
		expect(isVin('L1N TEST')).toBe(false);
	});

	it('names every buffer the upload has to produce', () => {
		expect(expectedBlobNames(record())).toEqual(new Set(['_time', 'esp_vehspd']));
	});
});

describe('keeping an export', () => {
	it('stays out of the listing until every buffer has arrived', async () => {
		await beginExport(db, userId, 'DA0001', record(), summary(), false);
		expect(await listExports(db, userId)).toHaveLength(0);

		await finish('DA0001');
		expect(await listExports(db, userId)).toHaveLength(1);
	});

	it('refuses to go over the room an account has', async () => {
		await beginExport(
			db,
			userId,
			'DA0001',
			record({ storedBytes: MAX_ACCOUNT_BYTES - 1000 }),
			summary(),
			false
		);
		await finish('DA0001', MAX_ACCOUNT_BYTES - 1000);

		await expect(
			beginExport(
				db,
				userId,
				'DA0002',
				record({ id: 'DA0002', storedBytes: 2000 }),
				summary(),
				false
			)
		).rejects.toThrow(QuotaExceeded);
	});

	it('lets an interrupted upload be repeated without counting it twice', async () => {
		const big = record({ storedBytes: MAX_ACCOUNT_BYTES - 1000 });
		await beginExport(db, userId, 'DA0001', big, summary(), false);
		await run(db, 'UPDATE exports SET stored_bytes = ?', MAX_ACCOUNT_BYTES - 1000);

		await expect(beginExport(db, userId, 'DA0001', big, summary(), false)).resolves.toEqual({
			complete: false
		});
	});

	it('updates the trips two overlapping exports share rather than duplicating them', async () => {
		const shared = trip(JULY + 86400, 41000);

		await beginExport(db, userId, 'DA0001', record(), summary({ trips: [shared] }), false);
		await beginExport(
			db,
			userId,
			'DA0002',
			record({ id: 'DA0002' }),
			summary({ trips: [shared, trip(JULY + 2 * 86400, 41020)] }),
			false
		);

		const trips = await all<{ start_time: number; export_id: string }>(
			db,
			'SELECT start_time, export_id FROM trips ORDER BY start_time'
		);
		expect(trips).toHaveLength(2);
		// The newer export speaks for the trip they both saw.
		expect(trips[0].export_id).toBe('DA0002');
	});

	it('does not let an older export rewind the state of the car', async () => {
		await beginExport(db, userId, 'DA0002', record({ id: 'DA0002' }), summary(), false);

		await beginExport(
			db,
			userId,
			'DA0001',
			record({ startTime: JULY - 30 * 86400, endTime: JULY - 86400 }),
			summary({
				vehicle: {
					vin: 'L1NTEST00000000001',
					vmodel: 'F30b',
					lastSampleTime: JULY - 86400,
					odometerKm: 39000,
					soc: 20,
					rangeKm: 90
				}
			}),
			false
		);

		const vehicle = await one<{ odometer_km: number }>(db, 'SELECT odometer_km FROM vehicles');
		expect(vehicle?.odometer_km).toBe(41207);
	});

	it('takes its derived rows with it when removed', async () => {
		await beginExport(
			db,
			userId,
			'DA0001',
			record(),
			summary({ trips: [trip(JULY + 86400, 41000)] }),
			false
		);
		await deleteExport(db, userId, 'DA0001');

		expect(await all(db, 'SELECT * FROM trips')).toHaveLength(0);
		expect(await listExports(db, userId)).toHaveLength(0);
	});
});

describe('what a summary may claim', () => {
	it('keeps the trips a car could actually have made', async () => {
		await beginExport(
			db,
			userId,
			'DA0001',
			record(),
			summary({ trips: [trip(JULY + 86400, 41000)] }),
			false
		);
		expect(await all(db, 'SELECT * FROM trips')).toHaveLength(1);
	});

	it('drops a trip that claims a place it was never in', async () => {
		await beginExport(
			db,
			userId,
			'DA0001',
			record(),
			summary({
				trips: [
					trip(JULY + 86400, 41000),
					// A year before the export covers.
					tripSummary({ startTime: JULY - 400 * 86400, odoStart: 1, odoEnd: 2 })
				]
			}),
			false
		);
		expect(await all(db, 'SELECT * FROM trips')).toHaveLength(1);
	});

	it('keeps a drive whose odometer jumped, without the distance no car could do', async () => {
		const jumped = tripSummary({
			startTime: JULY + 2 * 86400,
			endTime: JULY + 2 * 86400 + 1800,
			distanceKm: 900,
			odoStart: 41000,
			odoEnd: 41900
		});
		await beginExport(
			db,
			userId,
			'DA0001',
			record(),
			summary({ trips: [trip(JULY + 86400, 41000), jumped] }),
			false
		);

		const rows = await all<{ distance_km: number | null }>(
			db,
			'SELECT distance_km FROM trips ORDER BY start_time'
		);
		expect(rows.map((row) => row.distance_km)).toEqual([20, null]);
	});

	/** The trips as the account keeps them, and what each trip board makes of them. */
	async function kept() {
		const rows = await all<{ summary_json: string }>(
			db,
			'SELECT summary_json FROM trips ORDER BY start_time'
		);
		return rows.map((row) => JSON.parse(row.summary_json) as TripSummary);
	}

	const tripBoards = BOARDS.filter(
		(board): board is ItemBoard => board.scope === 'item' && board.kind === 'trip'
	);

	it('keeps a long drive the logger slept through, without its average speed', async () => {
		// 100 km in an hour and a half, awake for a quarter of an hour of it.
		const slept = tripSummary({
			startTime: JULY + 86400,
			endTime: JULY + 86400 + 5400,
			distanceKm: 100,
			odoStart: 41000,
			odoEnd: 41100,
			movingSeconds: 900,
			avgSpeed: 400,
			coverage: 0.17
		});
		await beginExport(db, userId, 'DA0001', record(), summary({ trips: [slept] }), false);

		const [stored] = await kept();
		expect(stored).toMatchObject({ distanceKm: 100, movingSeconds: 900, avgSpeed: null });
		for (const board of tripBoards) expect(valueFor(board, stored)).toBeNull();
	});

	it('keeps a cold start, without its consumption, and off the efficiency board', async () => {
		const cold = tripSummary({
			startTime: JULY + 86400,
			endTime: JULY + 86400 + 300,
			distanceKm: 1.2,
			odoStart: 41000,
			odoEnd: 41001,
			energyKwh: 3,
			consumption: 250
		});
		await beginExport(db, userId, 'DA0001', record(), summary({ trips: [cold] }), false);

		const [stored] = await kept();
		expect(stored).toMatchObject({ distanceKm: 1.2, energyKwh: 3, consumption: null });
		expect(valueFor(boardById('efficient-drive') as ItemBoard, stored)).toBeNull();
		// And a null consumption keeps even a long, well-covered drive off it.
		const long = { ...stored, distanceKm: 200, endTime: stored.startTime + 7200 };
		expect(valueFor(boardById('efficient-drive') as ItemBoard, long)).toBeNull();
	});

	it('drops an odometer that ran backwards', async () => {
		await beginExport(
			db,
			userId,
			'DA0001',
			record(),
			summary({
				trips: [tripSummary({ startTime: JULY + 86400, odoStart: 41000, odoEnd: 40000 })]
			}),
			false
		);
		expect(await all(db, 'SELECT * FROM trips')).toHaveLength(0);
	});

	it('keeps a charge larger than any battery, without the energy', async () => {
		await beginExport(
			db,
			userId,
			'DA0001',
			record(),
			summary({
				charging: [
					sessionSummary({ startTime: JULY + 86400, kwhDelivered: 9000 }),
					sessionSummary({ startTime: JULY + 2 * 86400, kwhDelivered: 45 })
				]
			}),
			false
		);
		const rows = await all<{ summary_json: string }>(
			db,
			'SELECT summary_json FROM charging_sessions ORDER BY start_time'
		);
		const energy = rows.map((row) => JSON.parse(row.summary_json).kwhDelivered);
		expect(energy).toEqual([null, 45]);
		const biggest = boardById('biggest-charge') as ItemBoard;
		expect(valueFor(biggest, JSON.parse(rows[0].summary_json))).toBeNull();
	});
});

const B_START = JULY + 15 * 86400;

/** A second export, overlapping the first by half: what XPeng's rolling window produces. */
function later(overrides: Partial<ExportRecord> = {}): ExportRecord {
	return record({ id: 'DA0002', startTime: B_START, endTime: B_START + 29 * 86400, ...overrides });
}

async function owners(table = 'trips') {
	return all<{ start_time: number; export_id: string }>(
		db,
		`SELECT start_time, export_id FROM ${table} ORDER BY start_time`
	);
}

describe('removing one of two overlapping exports', () => {
	const early = trip(JULY + 2 * 86400, 41000);
	const shared = trip(JULY + 20 * 86400, 41500);
	const late = trip(JULY + 40 * 86400, 42000);
	const sharedCharge = sessionSummary({ startTime: JULY + 20 * 86400 + 7200 });

	async function keepA() {
		await beginExport(
			db,
			userId,
			'DA0001',
			record(),
			summary({ trips: [early, shared], charging: [sharedCharge] }),
			false
		);
		await finish('DA0001');
	}

	async function keepB() {
		await beginExport(
			db,
			userId,
			'DA0002',
			later(),
			summary({ trips: [shared, late], charging: [sharedCharge] }),
			false
		);
		await finish('DA0002');
	}

	it("hands the newer one's share of the trips back to the older one", async () => {
		await keepA();
		await keepB();
		expect((await owners()).map((t) => t.export_id)).toEqual(['DA0001', 'DA0002', 'DA0002']);

		await deleteExport(db, userId, 'DA0002');

		expect(await owners()).toEqual([
			{ start_time: early.startTime, export_id: 'DA0001' },
			{ start_time: shared.startTime, export_id: 'DA0001' }
		]);
		expect(await owners('charging_sessions')).toEqual([
			{ start_time: sharedCharge.startTime, export_id: 'DA0001' }
		]);
	});

	it("hands the older one's share to the newer one when that is the one removed", async () => {
		await keepB();
		await keepA();
		expect((await owners()).map((t) => t.export_id)).toEqual(['DA0001', 'DA0001', 'DA0002']);

		await deleteExport(db, userId, 'DA0001');

		expect(await owners()).toEqual([
			{ start_time: shared.startTime, export_id: 'DA0002' },
			{ start_time: late.startTime, export_id: 'DA0002' }
		]);
	});

	it('does not hand anything to an upload that never finished', async () => {
		await beginExport(db, userId, 'DA0001', record(), summary({ trips: [early, shared] }), false);
		await keepB();
		await deleteExport(db, userId, 'DA0002');

		expect(await owners()).toEqual([{ start_time: early.startTime, export_id: 'DA0001' }]);
	});

	it('keeps the car while any export of it is left, and forgets it after the last', async () => {
		await keepA();
		await keepB();

		await deleteExport(db, userId, 'DA0002');
		expect(await all(db, 'SELECT * FROM vehicles')).toHaveLength(1);

		await deleteExport(db, userId, 'DA0001');
		expect(await all(db, 'SELECT * FROM vehicles')).toHaveLength(0);
	});

	it('drops the unclaimed candidates whose trip went with it, and nothing else', async () => {
		await keepA();
		await keepB();

		const candidate = (id: string, kind: string, startTime: number, entryId: string | null) =>
			run(
				db,
				`INSERT INTO board_candidates (id, user_id, board, month, locks_at, kind, vin, start_time,
					value, score, detail_json, vmodel, rank_at_detection, created_at, entry_id)
				 VALUES (?, ?, ?, '2026-08', 0, ?, 'L1NTEST00000000001', ?, 1, 1, '{}', 'F30b', 1, 0, ?)`,
				id,
				userId,
				id,
				kind,
				startTime,
				entryId
			);
		await candidate('gone', 'trip', late.startTime, null);
		await candidate('claimed', 'trip', late.startTime, 'entry-1');
		await candidate('handed-over', 'trip', shared.startTime, null);
		await candidate('charge', 'charging', sharedCharge.startTime, null);

		await deleteExport(db, userId, 'DA0002');

		const left = await all<{ id: string }>(db, 'SELECT id FROM board_candidates ORDER BY id');
		expect(left.map((row) => row.id)).toEqual(['charge', 'claimed', 'handed-over']);
	});

	it('revokes a public link to the removed export, and only that one', async () => {
		await keepA();
		await keepB();
		for (const [id, exportId] of [
			['share-b', 'DA0002'],
			['share-a', 'DA0001']
		]) {
			await run(
				db,
				`INSERT INTO shares (id, user_id, kind, vmodel, start_time, end_time, time_zone, export_id,
					owner_user_id, meta_json, created_at)
				 VALUES (?, ?, 'export', 'F30b', 0, 0, 'Europe/Berlin', ?, ?, '{}', 0)`,
				id,
				userId,
				exportId,
				userId
			);
		}

		await deleteExport(db, userId, 'DA0002');

		const shares = await all<{ id: string; revoked_at: number | null }>(
			db,
			'SELECT id, revoked_at FROM shares ORDER BY id'
		);
		expect(shares[0]).toMatchObject({ id: 'share-a', revoked_at: null });
		expect(shares[1].id).toBe('share-b');
		expect(shares[1].revoked_at).not.toBeNull();
	});
});

describe('charging an upload for what it stores', () => {
	it('counts the bucket, not the size the record declared', async () => {
		await beginExport(db, userId, 'DA0001', record({ storedBytes: 0 }), summary(), false);

		expect(await settleExport(db, userId, 'DA0001', 9_000_000)).toBe(true);
		const row = await one<{ stored_bytes: number; complete: number }>(
			db,
			'SELECT stored_bytes, complete FROM exports'
		);
		expect(row).toEqual({ stored_bytes: 9_000_000, complete: 1 });
	});

	it('leaves an upload that does not fit unfinished, for the sweep', async () => {
		await beginExport(
			db,
			userId,
			'DA0001',
			record({ storedBytes: MAX_ACCOUNT_BYTES - 1000 }),
			summary(),
			false
		);
		await settleExport(db, userId, 'DA0001', MAX_ACCOUNT_BYTES - 1000);

		// Declares nothing, then sends far more than is left.
		await beginExport(db, userId, 'DA0002', later({ storedBytes: 0 }), summary(), false);
		expect(await settleExport(db, userId, 'DA0002', 64 * 1024 * 1024)).toBe(false);

		expect((await listExports(db, userId)).map((row) => row.id)).toEqual(['DA0001']);
		expect((await staleUploads(db, -10)).map((row) => row.id)).toEqual(['DA0002']);
		// And what it holds counts until then, so nothing else gets in meanwhile.
		await expect(
			beginExport(db, userId, 'DA0003', record({ id: 'DA0003', storedBytes: 0 }), summary(), false)
		).rejects.toThrow(QuotaExceeded);
	});

	it("reads every object's size from the bucket, across pages", async () => {
		const prefix = 'users/u/exports/DA0001/';
		const bucket = memoryBucket();
		await bucket.put(`${prefix}_time.gz`, new Uint8Array(100));
		await bucket.put(`${prefix}esp_vehspd.gz`, new Uint8Array(250));
		await bucket.put(`${prefix}stray`, new Uint8Array(5));
		await bucket.put('users/u/exports/DA0002/_time.gz', new Uint8Array(999));

		const sizes = await listBlobSizes(bucket, prefix);
		expect(sizes).toEqual(
			new Map([
				['_time', 100],
				['esp_vehspd', 250]
			])
		);
	});
});

describe('uploading a finished export again', () => {
	it('changes nothing, and says it is already there', async () => {
		await beginExport(db, userId, 'DA0001', record(), summary(), false);
		await finish('DA0001', 9_000_000);
		const before = await one(db, 'SELECT * FROM exports');

		const again = await beginExport(
			db,
			userId,
			'DA0001',
			record({
				storedBytes: 0,
				columns: [{ key: 'new_signal', spec: {}, nonNull: 1, min: 0, max: 1 }] as never
			}),
			summary({ trips: [trip(JULY + 86400, 41000)] }),
			false
		);

		expect(again).toEqual({ complete: true });
		expect(await one(db, 'SELECT * FROM exports')).toEqual(before);
		expect(await all(db, 'SELECT * FROM trips')).toHaveLength(0);
	});

	it('is never settled again, so nothing can unlist it', async () => {
		await beginExport(db, userId, 'DA0001', record(), summary(), false);
		await finish('DA0001', 9_000_000);

		expect(await settleExport(db, userId, 'DA0001', MAX_ACCOUNT_BYTES * 2)).toBe(false);
		expect(await listExports(db, userId)).toHaveLength(1);
		const row = await one<{ stored_bytes: number }>(db, 'SELECT stored_bytes FROM exports');
		expect(row?.stored_bytes).toBe(9_000_000);
	});
});

describe('what a summary has to look like', () => {
	it('refuses one that is not shaped like a summary at all', async () => {
		for (const bad of [
			{ trips: 'none', charging: [], vehicle: summary().vehicle },
			{ trips: [], charging: [] },
			{ ...summary(), vehicle: { ...summary().vehicle, soc: '62' } },
			{ ...summary(), vehicle: { ...summary().vehicle, lastSampleTime: JULY + 400 * 86400 } }
		]) {
			await expect(
				beginExport(db, userId, 'DA0001', record(), bad as unknown as ExportSummary, false)
			).rejects.toThrow(Invalid);
		}
		expect(await all(db, 'SELECT * FROM exports')).toHaveLength(0);
	});

	it('skips a row that is not an object rather than failing on it', async () => {
		await beginExport(
			db,
			userId,
			'DA0001',
			record(),
			summary({ trips: [null, trip(JULY + 86400, 41000)] as never, charging: [7] as never }),
			false
		);
		expect(await all(db, 'SELECT * FROM trips')).toHaveLength(1);
	});

	it('drops a row whose numbers are not numbers, and nulls one out of bounds', async () => {
		const day = (n: number) => JULY + n * 86400;
		await beginExport(
			db,
			userId,
			'DA0001',
			record(),
			summary({
				trips: [
					trip(day(1), 41000),
					tripSummary({ startTime: day(2), consumption: '<img>' as never }),
					tripSummary({ startTime: day(3), avgSpeed: { x: 1 } as never }),
					tripSummary({ startTime: day(4), coverage: 7 }),
					tripSummary({ startTime: day(5), distanceKm: -400 })
				],
				charging: [
					sessionSummary({ startTime: day(1) }),
					sessionSummary({ startTime: day(2), socEnd: 'full' as never }),
					sessionSummary({ startTime: day(3), socStart: 140 }),
					sessionSummary({ startTime: day(4), isDc: 'yes' as never })
				]
			}),
			false
		);

		expect((await owners()).map((t) => t.start_time)).toEqual([day(1), day(4)]);
		expect((await owners('charging_sessions')).map((t) => t.start_time)).toEqual([day(1), day(3)]);
		const kept = await all<{ summary_json: string }>(
			db,
			'SELECT summary_json FROM trips WHERE start_time = ?',
			day(4)
		);
		expect(JSON.parse(kept[0].summary_json).coverage).toBeNull();
	});

	it('lets a car with no reading yet take one', async () => {
		await beginExport(db, userId, 'DA0001', record(), summary(), false);
		await run(db, 'UPDATE vehicles SET last_sample_time = NULL, odometer_km = NULL');

		await beginExport(db, userId, 'DA0001', record(), summary(), false);
		const vehicle = await one<{ odometer_km: number | null }>(
			db,
			'SELECT odometer_km FROM vehicles'
		);
		expect(vehicle?.odometer_km).toBe(41207);
	});
});

describe('writing a month in batches', () => {
	it('writes every row, a batch at a time rather than a query each', async () => {
		const trips = Array.from({ length: 600 }, (_, i) => trip(JULY + i * 3600, 41000 + i * 20));
		const batches: number[] = [];
		const counting: Db = {
			prepare: (sql) => db.prepare(sql),
			batch: (statements) => {
				batches.push(statements.length);
				return db.batch(statements);
			}
		};

		await beginExport(counting, userId, 'DA0001', record(), summary({ trips }), false);

		expect(await all(db, 'SELECT * FROM trips')).toHaveLength(600);
		// Two deletes, six hundred trips and the car.
		expect(batches.reduce((sum, n) => sum + n, 0)).toBe(603);
		expect(batches.every((n) => n <= BATCH_SIZE)).toBe(true);
	});
});

describe('the totals every car is listed with', () => {
	it('counts each car on its own, from one query per table', async () => {
		await beginExport(
			db,
			userId,
			'DA0001',
			record(),
			summary({ trips: [trip(JULY + 86400, 41000)] }),
			false
		);
		await finish('DA0001');
		await beginExport(
			db,
			userId,
			'DA0002',
			record({ id: 'DA0002', vin: 'L1NOTHER0000000002' }),
			summary({ charging: [sessionSummary({ startTime: JULY + 86400 })] }),
			false
		);
		await finish('DA0002');

		const totals = await vehicleTotals(db, userId);
		expect(totals.get('L1NTEST00000000001')).toEqual({
			exports: 1,
			trips: 1,
			charging: 0,
			from: JULY,
			to: JULY + 29 * 86400
		});
		expect(totals.get('L1NOTHER0000000002')).toMatchObject({ exports: 1, trips: 0, charging: 1 });
	});
});
