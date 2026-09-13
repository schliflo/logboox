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
import type { ExportSummary } from '$lib/data/analytics/summary';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { all, one } from '../db';
import { findOrCreateUser } from '../auth/users';
import { MAX_ACCOUNT_BYTES } from './limits';
import {
	Invalid,
	QuotaExceeded,
	beginExport,
	checkRecord,
	deleteExport,
	expectedBlobNames,
	listExports,
	markComplete
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

function trip(startTime: number, odoStart: number) {
	return {
		startTime,
		endTime: startTime + 1800,
		odoStart,
		odoEnd: odoStart + 20,
		distanceKm: 20,
		movingSeconds: 1500,
		avgSpeed: 48,
		maxSpeed: 110,
		socStart: 80,
		socEnd: 74,
		energyKwh: 4,
		regenKwh: 0.6,
		consumption: 17
	};
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

	it('names every buffer the upload has to produce', () => {
		expect(expectedBlobNames(record())).toEqual(new Set(['_time', 'esp_vehspd']));
	});
});

describe('keeping an export', () => {
	it('stays out of the listing until every buffer has arrived', async () => {
		await beginExport(db, userId, 'DA0001', record(), summary(), false);
		expect(await listExports(db, userId)).toHaveLength(0);

		await markComplete(db, userId, 'DA0001');
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
		await markComplete(db, userId, 'DA0001');

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

	it('lets the same export be re-uploaded without counting twice', async () => {
		const big = record({ storedBytes: MAX_ACCOUNT_BYTES - 1000 });
		await beginExport(db, userId, 'DA0001', big, summary(), false);
		await markComplete(db, userId, 'DA0001');

		await expect(beginExport(db, userId, 'DA0001', big, summary(), false)).resolves.toBeUndefined();
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
