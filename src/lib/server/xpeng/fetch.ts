/**
 * Automatic import, step one: fetching.
 *
 * Once an owner has given the account their Open Platform credentials, the
 * hourly run of the import Worker asks XPeng for a fresh export every day and
 * parks the ZIP in the bucket; `./import.ts` then merges the new rows into the
 * timeline. An owner can also ask for one now (`./update.ts`).
 *
 * Each run takes one step per due owner and never waits on XPeng: a task that
 * is still generating is asked after again an hour later. Asking about an
 * existing task is free; only a new submission counts against XPeng's five a
 * day, and at most one is made per owner per run.
 */

import { all, now, one, rowId, run, type Db } from '../db';
import {
	queryData,
	type AppCredentials,
	type OpenEnv,
	type QueryDataResult
} from '../../xpeng-open/queryData';

/** Each fetch holds thirty days but only the new rows are kept, so daily costs nothing extra. */
export const FETCH_EVERY_DAYS = 1;

/** Fetched and not yet parsed. More means imports are failing, and fetching more is waste. */
export const MAX_WAITING = 3;

/** A month comes to tens of megabytes zipped; anything near this is not an export. */
export const MAX_ZIP_BYTES = 512 * 1024 * 1024;

/** Owners per run. Each costs a request to XPeng, maybe a download and a few queries. */
export const BATCH = 20;

const HOUR = 3600;
const DAY = 86400;

/** Between new submissions from "Update now". With the daily one this stays under XPeng's five a day. */
export const MANUAL_EVERY = 6 * HOUR;

/** Between questions about a task already running. Asking is free, but not for us to hammer. */
export const POLL_EVERY = 10;

export interface XpengApp {
	env: OpenEnv;
	app: AppCredentials;
}

export interface XpengLink {
	user_id: string;
	open_id: string;
	access_token: string;
	scope_code: string;
	enterprise_name: string;
	created_at: number;
	state: 'waiting' | 'exporting' | 'reauth';
	next_at: number | null;
	fetched_at: number | null;
	/** What went wrong last, for the account page to explain; null when nothing did. */
	message: XpengMessage | null;
	time_zone: string | null;
	/** Everything before this is in the account; null until the first import. */
	imported_to: number | null;
	/** When a new XPeng export was last asked for. */
	submitted_at: number | null;
	/** When XPeng was last asked anything. */
	checked_at: number | null;
}

export type XpengMessage =
	| 'downloadFailed'
	| 'notImported'
	| 'exportFailed'
	| 'limit'
	| 'unauthorized'
	| 'tokenExpired'
	| 'appError'
	| 'error'
	| 'importFailed'
	| 'quota';

export interface XpengDownload {
	id: string;
	user_id: string;
	r2_key: string;
	bytes: number;
	created_at: number;
	attempts: number;
}

export interface OwnerInput {
	openId: string;
	accessToken: string;
	scopeCode: string;
	enterpriseName: string;
	timeZone: string | null;
}

export function findLink(db: Db, userId: string): Promise<XpengLink | null> {
	return one<XpengLink>(db, 'SELECT * FROM xpeng_links WHERE user_id = ?', userId);
}

/** Saving credentials, new or replaced, starts over: the next run fetches. */
export async function saveLink(db: Db, userId: string, owner: OwnerInput): Promise<void> {
	await run(
		db,
		`INSERT INTO xpeng_links (user_id, open_id, access_token, scope_code, enterprise_name,
			created_at, state, next_at, message, time_zone)
		 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'waiting', ?6, NULL, ?7)
		 ON CONFLICT (user_id) DO UPDATE SET open_id = ?2, access_token = ?3, scope_code = ?4,
			enterprise_name = ?5, state = 'waiting', next_at = ?6, message = NULL,
			time_zone = COALESCE(?7, time_zone)`,
		userId,
		owner.openId,
		owner.accessToken,
		owner.scopeCode,
		owner.enterpriseName,
		now(),
		owner.timeZone
	);
}

/** Stops it all, including a ZIP fetched but not imported yet. */
export async function deleteLink(db: Db, storage: R2Bucket, userId: string): Promise<void> {
	const downloads = await all<XpengDownload>(
		db,
		'SELECT * FROM xpeng_downloads WHERE user_id = ?',
		userId
	);
	for (const download of downloads) await deleteDownload(db, storage, download);
	await run(db, 'DELETE FROM xpeng_links WHERE user_id = ?', userId);
}

export async function deleteDownload(
	db: Db,
	storage: R2Bucket,
	download: XpengDownload
): Promise<void> {
	await storage.delete(download.r2_key);
	await run(db, 'DELETE FROM xpeng_downloads WHERE id = ?', download.id);
}

export interface FetchReport {
	considered: number;
	fetched: number;
	exporting: number;
	reauth: number;
	failed: number;
}

/** One step for every owner who is due. */
export async function runFetches(
	db: Db,
	storage: R2Bucket,
	xpeng: XpengApp,
	fetchImpl: typeof fetch = globalThis.fetch
): Promise<FetchReport> {
	const due = await all<XpengLink>(
		db,
		`SELECT * FROM xpeng_links WHERE state != 'reauth' AND next_at <= ? ORDER BY next_at LIMIT ?`,
		now(),
		BATCH
	);
	const report: FetchReport = {
		considered: due.length,
		fetched: 0,
		exporting: 0,
		reauth: 0,
		failed: 0
	};

	for (const link of due) {
		try {
			const outcome = await fetchStep(db, storage, xpeng, link, fetchImpl);
			if (outcome === 'fetched') report.fetched++;
			else if (outcome === 'exporting') report.exporting++;
			else if (outcome === 'reauth') report.reauth++;
			else if (outcome === 'failed') report.failed++;
		} catch (error) {
			// One owner's failure is not the next one's; tried again in an hour.
			console.error(`xpeng fetch for ${link.user_id} failed:`, error);
			await update(db, link.user_id, { next_at: now() + HOUR, message: 'downloadFailed' });
			report.failed++;
		}
	}
	return report;
}

export type Outcome = 'fetched' | 'exporting' | 'reauth' | 'failed' | 'deferred';

/** One request to XPeng for this owner, and whatever its answer calls for. */
export async function fetchStep(
	db: Db,
	storage: R2Bucket,
	xpeng: XpengApp,
	link: XpengLink,
	fetchImpl: typeof fetch
): Promise<Outcome> {
	const t = now();

	// A new submission only when the last ones have been taken in. Asking about
	// a task already running is fine either way.
	if (link.state === 'waiting') {
		const waiting = await one<{ n: number }>(
			db,
			'SELECT COUNT(*) AS n FROM xpeng_downloads WHERE user_id = ?',
			link.user_id
		);
		if ((waiting?.n ?? 0) >= MAX_WAITING) {
			await update(db, link.user_id, {
				next_at: t + DAY,
				message: 'notImported'
			});
			return 'deferred';
		}
	}

	// Asked from 'waiting', the call submits a new task: that is what XPeng counts.
	await update(db, link.user_id, {
		checked_at: t,
		...(link.state === 'waiting' ? { submitted_at: t } : {})
	});
	const result = await queryData({
		env: xpeng.env,
		app: xpeng.app,
		owner: {
			openId: link.open_id,
			accessToken: link.access_token,
			enterpriseName: link.enterprise_name,
			scopeCode: link.scope_code
		},
		fetch: fetchImpl
	});

	return react(db, storage, link, result, fetchImpl);
}

async function react(
	db: Db,
	storage: R2Bucket,
	link: XpengLink,
	result: QueryDataResult,
	fetchImpl: typeof fetch
): Promise<Outcome> {
	const t = now();
	switch (result.kind) {
		case 'ready': {
			// The link lives about thirty seconds: straight to the bucket.
			const download = await store(storage, link.user_id, result.url, fetchImpl);
			await run(
				db,
				'INSERT INTO xpeng_downloads (id, user_id, r2_key, bytes, created_at) VALUES (?, ?, ?, ?, ?)',
				download.id,
				link.user_id,
				download.key,
				download.bytes,
				t
			);
			await update(db, link.user_id, {
				state: 'waiting',
				// An hour early, so the hourly run at the same minute is never just short.
				next_at: t + FETCH_EVERY_DAYS * DAY - HOUR,
				fetched_at: t,
				message: null
			});
			return 'fetched';
		}
		case 'exporting':
			await update(db, link.user_id, { state: 'exporting', next_at: t, message: null });
			return 'exporting';
		case 'failed':
			await update(db, link.user_id, {
				state: 'waiting',
				next_at: t + DAY,
				message: 'exportFailed'
			});
			return 'failed';
		case 'limit':
			await update(db, link.user_id, {
				state: 'waiting',
				next_at: t + DAY,
				message: 'limit'
			});
			return 'failed';
		case 'unauthorized':
		case 'tokenExpired':
			await update(db, link.user_id, {
				state: 'reauth',
				next_at: null,
				message: result.kind
			});
			return 'reauth';
		case 'appError':
			// Ours to fix, not the owner's: loud in the log, quiet in the schedule.
			console.error(`xpeng refused LogbooX's own credentials: ${result.code} ${result.desc}`);
			await update(db, link.user_id, {
				next_at: t + 6 * HOUR,
				message: 'appError'
			});
			return 'failed';
		case 'error':
			console.error(`xpeng answered ${result.code} ${result.desc} (HTTP ${result.status})`);
			await update(db, link.user_id, {
				next_at: t + HOUR,
				message: 'error'
			});
			return 'failed';
	}
}

async function store(
	storage: R2Bucket,
	userId: string,
	url: string,
	fetchImpl: typeof fetch
): Promise<{ id: string; key: string; bytes: number }> {
	const response = await fetchImpl(url);
	if (!response.ok || !response.body) throw new Error(`download failed: HTTP ${response.status}`);

	const length = Number(response.headers.get('content-length') ?? NaN);
	if (length > MAX_ZIP_BYTES) throw new Error(`download is ${length} bytes, more than an export`);

	// Streamed when the size is known, so a large month never sits in memory.
	const body =
		length > 0 && typeof FixedLengthStream === 'function'
			? response.body.pipeThrough(new FixedLengthStream(length))
			: await response.arrayBuffer();
	if (body instanceof ArrayBuffer && body.byteLength > MAX_ZIP_BYTES) {
		throw new Error(`download is ${body.byteLength} bytes, more than an export`);
	}

	const id = rowId();
	const key = `users/${userId}/xpeng/${id}.zip`;
	const object = await storage.put(key, body, { httpMetadata: { contentType: 'application/zip' } });
	return { id, key, bytes: object?.size ?? 0 };
}

async function update(
	db: Db,
	userId: string,
	patch: Partial<
		Pick<XpengLink, 'state' | 'next_at' | 'fetched_at' | 'message' | 'submitted_at' | 'checked_at'>
	>
): Promise<void> {
	const keys = Object.keys(patch) as Array<keyof typeof patch>;
	await run(
		db,
		`UPDATE xpeng_links SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE user_id = ?`,
		...keys.map((key) => patch[key]),
		userId
	);
}
