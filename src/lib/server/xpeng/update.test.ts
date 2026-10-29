import { beforeEach, describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { memoryBucket, type MemoryBucket } from '../testing/memory-bucket';
import { all, now, run } from '../db';
import { findOrCreateUser } from '../auth/users';
import { MANUAL_EVERY, POLL_EVERY, findLink, saveLink, type XpengApp } from './fetch';
import { updateNow } from './update';

const XPENG: XpengApp = { env: 'uat', app: { appId: 'app', appSecret: 'secret' } };

let db: TestDb;
let bucket: MemoryBucket;
let userId: string;

/** An hour of driving that ended two hours ago. */
function zip(): Uint8Array {
	const end = now() - 7200;
	const rows = Array.from(
		{ length: 3600 },
		(_, i) => `L1NTEST00000000001,F30b,${end - 3600 + i},1,50.0`
	);
	return zipSync({
		'DA0001_dwd_opp_gdpr_veh_driving_operation_di.csv': strToU8(
			`vin,vmodel,timer,ds,esp_vehspd\n${rows.join('\n')}`
		)
	});
}

/** XPeng answering with each reply in turn; any other URL is the file. */
function xpeng(...replies: object[]) {
	const calls: string[] = [];
	const impl = (async (input: RequestInfo | URL) => {
		const url = String(input);
		calls.push(url);
		if (url.startsWith('https://files.example/'))
			return new Response(zip() as Uint8Array<ArrayBuffer>);
		return Response.json(replies.shift());
	}) as typeof fetch;
	return { impl, calls };
}

const READY = { code: 0, data: 'https://files.example/export.zip' };

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

describe('updateNow', () => {
	it('submits, polls no faster than allowed, then imports into the timeline', async () => {
		const first = xpeng({ code: 0, data: 'DataFileExporting' });
		expect(await updateNow(db, bucket, XPENG, userId, first.impl)).toEqual({ kind: 'exporting' });

		// Asked again at once: not yet, and XPeng is not bothered.
		const early = xpeng();
		const waiting = await updateNow(db, bucket, XPENG, userId, early.impl);
		expect(waiting).toMatchObject({ kind: 'wait' });
		expect(early.calls).toEqual([]);

		await run(db, 'UPDATE xpeng_links SET checked_at = checked_at - ?', POLL_EVERY);
		expect(await updateNow(db, bucket, XPENG, userId, xpeng(READY).impl)).toEqual({
			kind: 'imported'
		});
		const blocks = await all(db, 'SELECT id FROM exports WHERE user_id = ?', userId);
		expect(blocks).toHaveLength(1);
		expect(await all(db, 'SELECT id FROM xpeng_downloads')).toEqual([]);
	});

	it('asks for a new export at most every MANUAL_EVERY', async () => {
		await updateNow(db, bucket, XPENG, userId, xpeng(READY).impl);
		const link = await findLink(db, userId);

		const again = xpeng(READY);
		expect(await updateNow(db, bucket, XPENG, userId, again.impl)).toEqual({
			kind: 'wait',
			until: link!.submitted_at! + MANUAL_EVERY
		});
		expect(again.calls).toEqual([]);

		await run(db, 'UPDATE xpeng_links SET submitted_at = submitted_at - ?', MANUAL_EVERY);
		expect(await updateNow(db, bucket, XPENG, userId, xpeng(READY).impl)).toEqual({
			kind: 'imported'
		});
	});

	it('says so when the owner has to authorise again', async () => {
		const reply = xpeng({ code: 4004001, data: null, desc: 'accessToken expired' });
		expect(await updateNow(db, bucket, XPENG, userId, reply.impl)).toEqual({ kind: 'reauth' });
	});
});
