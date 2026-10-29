import { beforeEach, describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { memoryBucket, type MemoryBucket } from '../testing/memory-bucket';
import { all, one, run } from '../db';
import { findOrCreateUser } from '../auth/users';
import { saveLink, type XpengDownload } from './fetch';
import { BLOCK_PREFIX, blockSlot } from '../../history/codec';
import { weekStart } from '../timeline/blocks';
import { MAX_ATTEMPTS, importDownload, runImports } from './import';

const DAY = 86400;
const VIN = 'L1NTEST00000000001';
/** A Monday, 00:00 UTC. */
const BASE = weekStart(1792000000);

let db: TestDb;
let bucket: MemoryBucket;
let userId: string;

/** Two one-hour drives a day, 08:00 and 17:00, asleep in between. */
function awake(days: number): number[] {
	const times: number[] = [];
	for (let d = 0; d < days; d++) {
		for (const hour of [8, 17]) {
			const start = BASE + d * DAY + hour * 3600;
			for (let s = 0; s < 3600; s++) times.push(start + s);
		}
	}
	return times;
}

function zip(times: number[]): Uint8Array {
	const prefix = 'DA0001_dwd_opp_gdpr_veh_driving_';
	const csv = (header: string, row: (t: number, i: number) => string) =>
		strToU8(
			`vin,vmodel,timer,ds,${header}\n` +
				times.map((t, i) => `${VIN},F30b,${t},20261012,${row(t, i)}`).join('\n')
		);
	return zipSync({
		[`${prefix}operation_di.csv`]: csv(
			'esp_vehspd,cdcu_totalodometer,ldcu_currentgearlev',
			(_, i) => `50.0,${1000 + Math.floor(i / 72)},4.0`
		),
		[`${prefix}status_di.csv`]: csv('ldcu_driverdoorajarst', () => '0.0'),
		[`${prefix}power_energy_di.csv`]: csv(
			'bms_battvolt,bms_battcurr,ldcu_bms_soc_disp',
			() => '600.0,50.0,80.0'
		)
	});
}

async function download(times: number[], id: string): Promise<XpengDownload> {
	const key = `users/${userId}/xpeng/${id}.zip`;
	await bucket.put(key, zip(times));
	const row: XpengDownload = {
		id,
		user_id: userId,
		r2_key: key,
		bytes: 0,
		created_at: times[times.length - 1] + 7200,
		attempts: 0
	};
	await run(
		db,
		'INSERT INTO xpeng_downloads (id, user_id, r2_key, bytes, created_at) VALUES (?, ?, ?, 0, ?)',
		id,
		userId,
		key,
		row.created_at
	);
	return row;
}

function exports() {
	return all<{ id: string; start_time: number; end_time: number; rows: number }>(
		db,
		'SELECT id, start_time, end_time, rows FROM exports WHERE user_id = ? AND complete = 1 ORDER BY start_time',
		userId
	);
}

beforeEach(async () => {
	db = migratedDb();
	bucket = memoryBucket();
	userId = (await findOrCreateUser(db, 'owner@example.com')).user.id;
	await saveLink(db, userId, {
		openId: 'o',
		accessToken: 't',
		scopeCode: 's',
		enterpriseName: 'LogbooX',
		timeZone: 'Europe/Berlin'
	});
});

describe('runImports', () => {
	it('retries a ZIP that fails, then deletes it so fetching carries on', async () => {
		const key = `users/${userId}/xpeng/bad.zip`;
		await bucket.put(key, strToU8('not a zip'));
		await run(
			db,
			'INSERT INTO xpeng_downloads (id, user_id, r2_key, bytes, created_at) VALUES (?, ?, ?, 0, 0)',
			'bad',
			userId,
			key
		);
		for (let i = 1; i < MAX_ATTEMPTS; i++) {
			expect((await runImports(db, bucket)).failed).toBe(1);
			expect(await one(db, 'SELECT attempts FROM xpeng_downloads')).toEqual({ attempts: i });
		}
		expect(await one(db, 'SELECT message FROM xpeng_links')).toEqual({ message: 'importFailed' });

		expect((await runImports(db, bucket)).failed).toBe(1);
		expect(await all(db, 'SELECT id FROM xpeng_downloads')).toEqual([]);
		expect(bucket.sizes.has(key)).toBe(false);
	});
});

describe('importDownload', () => {
	it('merges the new rows into weekly blocks, once, and picks up where it left off', async () => {
		const first = awake(10);
		await importDownload(db, bucket, await download(first, 'd1'), 'Europe/Berlin');

		let stored = await exports();
		expect(stored.every((e) => e.id.startsWith(BLOCK_PREFIX))).toBe(true);
		expect(new Set(stored.map((e) => blockSlot(e.id))).size).toBe(2);
		expect(stored.reduce((sum, e) => sum + e.rows, 0)).toBe(first.length);
		expect(stored.every((e) => weekStart(e.start_time) === weekStart(e.end_time))).toBe(true);
		const trips = () =>
			one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM trips WHERE user_id = ?', userId);
		expect((await trips())?.n).toBe(20);

		// A day later XPeng sends the same thirty days plus one.
		const second = awake(11);
		await importDownload(db, bucket, await download(second, 'd2'), 'Europe/Berlin');
		stored = await exports();
		expect(stored).toHaveLength(2);
		expect(stored.reduce((sum, e) => sum + e.rows, 0)).toBe(second.length);
		expect((await trips())?.n).toBe(22);
		const link = await one<{ imported_to: number }>(db, 'SELECT imported_to FROM xpeng_links');
		expect(link?.imported_to).toBe(second[second.length - 1] + 1);
	});
});
