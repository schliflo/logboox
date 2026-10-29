import { beforeEach, describe, expect, it } from 'vitest';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { memoryBucket, type MemoryBucket } from '../testing/memory-bucket';
import { all, now, run } from '../db';
import { deleteUser, findOrCreateUser } from '../auth/users';
import {
	FETCH_EVERY_DAYS,
	MAX_WAITING,
	deleteLink,
	findLink,
	runFetches,
	saveLink,
	type XpengApp,
	type XpengDownload
} from './fetch';

const XPENG: XpengApp = { env: 'uat', app: { appId: 'app', appSecret: 'secret' } };
const OWNER = {
	openId: 'o',
	accessToken: 't',
	scopeCode: 's',
	enterpriseName: 'LogbooX',
	timeZone: 'Europe/Berlin'
};
const ZIP = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]);

const listDownloads = (db: TestDb, userId: string) =>
	all<XpengDownload>(db, 'SELECT * FROM xpeng_downloads WHERE user_id = ?', userId);

let db: TestDb;
let bucket: MemoryBucket;
let userId: string;

/** XPeng answering with each reply in turn; any other URL is the file. */
function xpeng(...replies: object[]) {
	const calls: string[] = [];
	const impl = (async (input: RequestInfo | URL) => {
		const url = String(input);
		calls.push(url);
		if (url.startsWith('https://files.example/')) return new Response(ZIP);
		return Response.json(replies.shift());
	}) as typeof fetch;
	return { impl, calls };
}

beforeEach(async () => {
	db = migratedDb();
	bucket = memoryBucket();
	userId = (await findOrCreateUser(db, 'owner@example.com')).user.id;
	await saveLink(db, userId, OWNER);
});

describe('runFetches', () => {
	it('waits out the export, then parks the ZIP and schedules the next one', async () => {
		const first = xpeng({ code: 0, data: 'DataFileExporting' });
		expect((await runFetches(db, bucket, XPENG, first.impl)).exporting).toBe(1);
		expect((await findLink(db, userId))?.state).toBe('exporting');

		const second = xpeng({ code: 0, data: 'https://files.example/export.zip' });
		expect((await runFetches(db, bucket, XPENG, second.impl)).fetched).toBe(1);

		const link = await findLink(db, userId);
		expect(link?.state).toBe('waiting');
		expect(link!.next_at! - now()).toBeGreaterThanOrEqual(FETCH_EVERY_DAYS * 86400 - 3600 - 5);
		const [download] = await listDownloads(db, userId);
		expect(download.bytes).toBe(ZIP.byteLength);
		expect(bucket.sizes.get(download.r2_key)).toBe(ZIP.byteLength);
		expect(download.r2_key.startsWith(`users/${userId}/`)).toBe(true);

		// Not due again until tomorrow.
		const third = xpeng();
		expect((await runFetches(db, bucket, XPENG, third.impl)).considered).toBe(0);
	});

	it('stops asking once XPeng rejects the owner token', async () => {
		const reply = xpeng({ code: 4004001, data: null, desc: 'accessToken expired' });
		expect((await runFetches(db, bucket, XPENG, reply.impl)).reauth).toBe(1);
		expect(await findLink(db, userId)).toMatchObject({ state: 'reauth', message: 'tokenExpired' });

		await run(db, 'UPDATE xpeng_links SET next_at = 0 WHERE user_id = ?', userId);
		expect((await runFetches(db, bucket, XPENG, xpeng().impl)).considered).toBe(0);

		// New credentials start over.
		await saveLink(db, userId, OWNER);
		expect(await findLink(db, userId)).toMatchObject({ state: 'waiting', message: null });
	});

	it('submits nothing while fetched exports wait to be imported', async () => {
		for (let i = 0; i < MAX_WAITING; i++) {
			await run(
				db,
				'INSERT INTO xpeng_downloads (id, user_id, r2_key, bytes, created_at) VALUES (?, ?, ?, 1, 0)',
				`d${i}`,
				userId,
				`k${i}`
			);
		}
		const reply = xpeng();
		await runFetches(db, bucket, XPENG, reply.impl);
		expect(reply.calls).toEqual([]);
		expect((await findLink(db, userId))?.message).toBe('notImported');
	});

	it('drops a fetched ZIP on disconnect', async () => {
		await runFetches(
			db,
			bucket,
			XPENG,
			xpeng({ code: 0, data: 'https://files.example/x.zip' }).impl
		);
		const [download] = await listDownloads(db, userId);
		await deleteLink(db, bucket, userId);
		expect(await findLink(db, userId)).toBeNull();
		expect(await listDownloads(db, userId)).toEqual([]);
		expect(bucket.sizes.has(download.r2_key)).toBe(false);
	});

	it('goes with the account', async () => {
		await deleteUser(db, userId);
		expect(await findLink(db, userId)).toBeNull();
	});
});
