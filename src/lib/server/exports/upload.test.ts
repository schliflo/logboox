/**
 * The quota while an upload is under way: every buffer charged before it is
 * stored, a finished export closed to further writes, and completing settled
 * to exactly what the bucket holds.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExportRecord } from '#lib/history/codec.js';
import type { ExportSummary } from '#lib/data/analytics/summary.js';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { memoryBucket, type MemoryBucket } from '../testing/memory-bucket';
import { one, run } from '../db';
import { findOrCreateUser } from '../auth/users';
import { MAX_ACCOUNT_BYTES } from './limits';
import { blobKey } from './r2';
import { QuotaExceeded, beginExport, listExports, staleUploads } from './repo';
import { completeUpload, storeBlob } from './upload';

let db: TestDb;
let bucket: MemoryBucket;
let userId: string;

const JULY = Math.floor(Date.UTC(2026, 6, 1) / 1000);

/** Declares nothing, so what is tested is the charge rather than the first gate. */
function record(id = 'DA0001', storedBytes = 0): ExportRecord {
	return {
		id,
		version: 1,
		exportId: id,
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
		storedBytes,
		columns: [{ key: 'esp_vehspd', spec: { key: 'esp_vehspd' }, nonNull: 900, min: 0, max: 130 }]
	} as unknown as ExportRecord;
}

const SUMMARY: ExportSummary = {
	trips: [],
	charging: [],
	vehicle: {
		vin: 'L1NTEST00000000001',
		vmodel: 'F30b',
		lastSampleTime: JULY + 29 * 86400,
		odometerKm: 41207,
		soc: 62,
		rangeKm: 310
	}
};

/** A gzip member of the given size, as far as anything here looks. */
function gz(size: number): ArrayBuffer {
	const bytes = new Uint8Array(size);
	bytes[0] = 0x1f;
	bytes[1] = 0x8b;
	return bytes.buffer;
}

async function charged(id = 'DA0001'): Promise<number> {
	const row = await one<{ stored_bytes: number }>(
		db,
		'SELECT stored_bytes FROM exports WHERE user_id = ? AND id = ?',
		userId,
		id
	);
	return row!.stored_bytes;
}

async function open(id = 'DA0001') {
	return beginExport(db, userId, id, record(id), SUMMARY, false);
}

/** Leaves the account this many bytes short of full, held by another export. */
async function fill(room: number) {
	await open('DA0009');
	await run(
		db,
		"UPDATE exports SET stored_bytes = ?, complete = 1 WHERE id = 'DA0009'",
		MAX_ACCOUNT_BYTES - room
	);
}

beforeEach(async () => {
	db = migratedDb();
	bucket = memoryBucket();
	userId = (await findOrCreateUser(db, 'reader@example.com')).user.id;
});

afterEach(() => {
	db.close();
});

describe('storing a buffer', () => {
	it('charges it before storing it, starting from nothing', async () => {
		await open();
		expect(await charged()).toBe(0);

		const stored = await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(300));
		expect(stored).toEqual({ ok: true, bytes: 300 });
		expect(await charged()).toBe(300);
		expect(bucket.sizes.get(blobKey(userId, 'DA0001', '_time'))).toBe(300);
	});

	it('refuses one the account has no room for, and stores nothing', async () => {
		await fill(500);
		await open();

		expect(await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(400))).toMatchObject({
			ok: true
		});
		const refused = await storeBlob(db, bucket, userId, 'DA0001', 'esp_vehspd', gz(200));
		expect(refused).toMatchObject({ ok: false, status: 413 });
		expect(bucket.sizes.has(blobKey(userId, 'DA0001', 'esp_vehspd'))).toBe(false);
		expect(await charged()).toBe(400);
	});

	it('charges a replacement only for what it adds', async () => {
		await open();
		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(300));
		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(300));
		expect(await charged()).toBe(300);

		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(500));
		expect(await charged()).toBe(500);

		// Not credited back: completing settles the exact figure.
		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(100));
		expect(await charged()).toBe(500);
	});

	it('refuses a replacement that grows past the quota', async () => {
		await fill(500);
		await open();
		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(300));

		const refused = await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(900));
		expect(refused).toMatchObject({ ok: false, status: 413 });
		expect(bucket.sizes.get(blobKey(userId, 'DA0001', '_time'))).toBe(300);
	});

	it('takes nothing for a finished export', async () => {
		await open();
		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(300));
		await storeBlob(db, bucket, userId, 'DA0001', 'esp_vehspd', gz(200));
		expect(await completeUpload(db, bucket, userId, 'DA0001')).toMatchObject({ ok: true });

		const refused = await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(64 * 1024));
		expect(refused).toMatchObject({ ok: false, status: 409 });
		expect(bucket.sizes.get(blobKey(userId, 'DA0001', '_time'))).toBe(300);
		expect(await charged()).toBe(500);
	});

	it('takes nothing before the record, nothing it does not name, and only gzip', async () => {
		expect(await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(10))).toMatchObject({
			status: 409
		});
		await open();
		expect(await storeBlob(db, bucket, userId, 'DA0001', 'payload', gz(10))).toMatchObject({
			status: 400
		});
		const html = new TextEncoder().encode('<html>').buffer as ArrayBuffer;
		expect(await storeBlob(db, bucket, userId, 'DA0001', '_time', html)).toMatchObject({
			status: 400
		});
		expect(bucket.sizes.size).toBe(0);
	});

	it('keeps the charge when the record is sent again, since the buffers are still there', async () => {
		await open();
		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(300));

		expect(await open()).toEqual({ complete: false });
		expect(await charged()).toBe(300);
	});
});

describe('an upload that is never finished', () => {
	it('counts against the quota until it is swept', async () => {
		await fill(1000);
		await open('DA0001');
		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(800));

		// A second upload finds the room already taken.
		await open('DA0002');
		const refused = await storeBlob(db, bucket, userId, 'DA0002', '_time', gz(800));
		expect(refused).toMatchObject({ ok: false, status: 413 });
		expect(await listExports(db, userId)).toHaveLength(1);
		expect((await staleUploads(db, -10)).map((row) => row.id).sort()).toEqual(['DA0001', 'DA0002']);
		// And so does the gate on what a new upload declares.
		await expect(
			beginExport(db, userId, 'DA0003', record('DA0003', 500), SUMMARY, false)
		).rejects.toThrow(QuotaExceeded);
	});
});

describe('completing an upload', () => {
	it('names what is missing and lists nothing', async () => {
		await open();
		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(300));

		const done = await completeUpload(db, bucket, userId, 'DA0001');
		expect(done).toMatchObject({ ok: false, status: 409, missing: ['esp_vehspd'] });
		expect(await listExports(db, userId)).toHaveLength(0);
	});

	it('settles the charge to exactly what the bucket holds', async () => {
		await open();
		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(500));
		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(100));
		await storeBlob(db, bucket, userId, 'DA0001', 'esp_vehspd', gz(200));
		expect(await charged()).toBe(700);

		expect(await completeUpload(db, bucket, userId, 'DA0001')).toEqual({ ok: true, blobs: 2 });
		expect(await charged()).toBe(300);
		expect(await listExports(db, userId)).toHaveLength(1);
	});

	it('is harmless to repeat', async () => {
		await open();
		await storeBlob(db, bucket, userId, 'DA0001', '_time', gz(300));
		await storeBlob(db, bucket, userId, 'DA0001', 'esp_vehspd', gz(200));
		await completeUpload(db, bucket, userId, 'DA0001');

		expect(await completeUpload(db, bucket, userId, 'DA0001')).toEqual({ ok: true, blobs: 2 });
		expect(await charged()).toBe(500);
	});

	it('knows no upload it was never told about', async () => {
		expect(await completeUpload(db, bucket, userId, 'DA0001')).toMatchObject({
			ok: false,
			status: 404
		});
	});
});
