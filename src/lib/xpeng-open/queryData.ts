/**
 * The XPeng Open Platform `/oauth2/queryData` call.
 *
 * This is not a live-data API. One call submits a Data Act export task for
 * the authorising owner; the same call repeated returns the task's status and,
 * once the file exists, a download link. The file is the ZIP of CSVs the owner
 * could also fetch from the Data Center: a rolling thirty days, one row per
 * second while the car is awake, which `recognizeFiles` in
 * `../data/schema/streams.ts` already understands.
 *
 * Budget, per the guide: at most five submissions per owner and enterprise in
 * 24 hours, the task record is remembered for 24 hours, and a download link
 * lives about thirty seconds. Asking after an existing task does not count as
 * a submission; an expired task is resubmitted, which does.
 */

import { signedUrl } from './sign.ts';

export type OpenEnv = 'uat' | 'prod';

export const QUERY_DATA_ENDPOINT: Record<OpenEnv, string> = {
	uat: 'https://open-eu.uat.xpeng.com/open/oauth2/queryData',
	prod: 'https://open.xpeng.com/open/oauth2/queryData'
};

export const LIMITS = {
	submissionsPer24h: 5,
	recordCacheHours: 24,
	downloadLinkSeconds: 30
} as const;

/** Issued to the enterprise by e-mail once XPeng approves the application. */
export interface AppCredentials {
	appId: string;
	appSecret: string;
}

/** E-mailed to the vehicle owner after authorising the enterprise in the Data Center. */
export interface OwnerCredentials {
	openId: string;
	accessToken: string;
	/** Must equal the name the owner typed, byte for byte; XPeng compares MD5 hashes. */
	enterpriseName: string;
	scopeCode: string;
}

/** The envelope every Open Platform response uses. */
export interface OpenResponse {
	code: number;
	data: string | null;
	/** Localised; wording not stable. */
	msg?: string | null;
	/** Fixed wording; the field to branch on. */
	desc?: string | null;
}

/** §11 of the guide. */
export const CODES = {
	ok: 0,
	/** What production actually answers with on success (seen 2026-10-27); the guide says 0. */
	okProd: 200,
	operationFailed: 12060000,
	parameterError: 12060001,
	invalidAppId: 12061001,
	nonceError: 12061002,
	signError: 12061004,
	invalidAppIdOrSignature: 12061005,
	accessTokenExpired: 4004001,
	accessTokenInvalid: 12061014,
	invalidOpenId: 12064018,
	noAuthorizationRecord: 12064019,
	submissionFailed: 12064023,
	downloadLimit: 12064024
} as const;

export type QueryDataResult =
	/** Task submitted or still generating; ask again in a few seconds. */
	| { kind: 'exporting' }
	/** File ready; the link expires in about thirty seconds. */
	| { kind: 'ready'; url: string }
	/** XPeng could not generate the file. Resubmitting counts against the budget. */
	| { kind: 'failed' }
	/** Five submissions in 24 hours already; wait a day. */
	| { kind: 'limit' }
	/** No authorisation for this owner and app; the owner must authorise again. */
	| { kind: 'unauthorized'; code: number; desc: string }
	/** The owner's accessToken is expired or rejected; the owner must authorise again. */
	| { kind: 'tokenExpired'; code: number; desc: string }
	/** Our appId, nonce or signature is wrong: a configuration bug on our side. */
	| { kind: 'appError'; code: number; desc: string }
	| { kind: 'error'; code: number; desc: string; msg: string | null; status: number };

/** Classifies a response by `code` and `data`, following §6, §7 and §11 of the guide. */
export function interpret(response: OpenResponse, status = 200): QueryDataResult {
	const desc = response.desc ?? '';
	const msg = response.msg ?? null;
	const { code } = response;

	if (code === CODES.ok || code === CODES.okProd) {
		const data = response.data ?? '';
		if (data === 'DataFileExporting') return { kind: 'exporting' };
		if (data === 'DataFileExportFailed') return { kind: 'failed' };
		if (/^https?:\/\//i.test(data)) return { kind: 'ready', url: data };
		return { kind: 'error', code, desc: `unexpected data: ${data}`, msg, status };
	}

	switch (code) {
		case CODES.downloadLimit:
			return { kind: 'limit' };
		case CODES.noAuthorizationRecord:
		case CODES.invalidOpenId:
			return { kind: 'unauthorized', code, desc };
		case CODES.accessTokenExpired:
		case CODES.accessTokenInvalid:
			return { kind: 'tokenExpired', code, desc };
		case CODES.parameterError:
		case CODES.invalidAppId:
		case CODES.nonceError:
		case CODES.signError:
		case CODES.invalidAppIdOrSignature:
			return { kind: 'appError', code, desc };
		default:
			return { kind: 'error', code, desc, msg, status };
	}
}

/** The body in the guide's key order, serialised once so the signature covers the bytes sent. */
export function ownerBody(owner: OwnerCredentials): string {
	const { openId, accessToken, enterpriseName, scopeCode } = owner;
	return JSON.stringify({ openId, accessToken, enterpriseName, scopeCode });
}

export interface QueryDataOptions {
	env: OpenEnv;
	app: AppCredentials;
	owner: OwnerCredentials;
	/** Injectable for tests and for Workers. */
	fetch?: typeof fetch;
	/** Milliseconds since the epoch; also the nonce. */
	now?: () => number;
}

export async function queryData(options: QueryDataOptions): Promise<QueryDataResult> {
	const { env, app, owner, fetch: fetchImpl = globalThis.fetch, now = Date.now } = options;
	const body = ownerBody(owner);
	const url = await signedUrl(QUERY_DATA_ENDPOINT[env], {
		appId: app.appId,
		appSecret: app.appSecret,
		query: { nonce: String(now()) },
		body
	});

	const response = await fetchImpl(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body
	});

	let parsed: unknown;
	try {
		parsed = await response.json();
	} catch {
		parsed = null;
	}
	if (!isOpenResponse(parsed)) {
		return {
			kind: 'error',
			code: -1,
			desc: `not an Open Platform reply (HTTP ${response.status})`,
			msg: null,
			status: response.status
		};
	}
	return interpret(parsed, response.status);
}

function isOpenResponse(value: unknown): value is OpenResponse {
	return (
		typeof value === 'object' && value !== null && typeof (value as OpenResponse).code === 'number'
	);
}

export interface PollOptions extends QueryDataOptions {
	/** The guide suggests 5–10 s between status checks. */
	intervalMs?: number;
	maxWaitMs?: number;
	sleep?: (ms: number) => Promise<void>;
	onStatus?: (result: QueryDataResult, attempt: number) => void;
}

/**
 * Submits (or resumes) the export and keeps asking until it is no longer
 * `exporting`. Returns `exporting` only when `maxWaitMs` runs out.
 */
export async function pollUntilReady(options: PollOptions): Promise<QueryDataResult> {
	const {
		intervalMs = 8_000,
		maxWaitMs = 15 * 60_000,
		sleep = wait,
		onStatus,
		now = Date.now
	} = options;
	const started = now();
	for (let attempt = 1; ; attempt++) {
		const result = await queryData(options);
		onStatus?.(result, attempt);
		if (result.kind !== 'exporting') return result;
		if (now() - started + intervalMs > maxWaitMs) return result;
		await sleep(intervalMs);
	}
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface Downloaded {
	bytes: Uint8Array;
	contentType: string | null;
}

/** Fetches the export behind a `ready` link. Call it straight away; the link is short-lived. */
export async function downloadExport(
	url: string,
	fetchImpl: typeof fetch = globalThis.fetch
): Promise<Downloaded> {
	const response = await fetchImpl(url);
	if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);
	return {
		bytes: new Uint8Array(await response.arrayBuffer()),
		contentType: response.headers.get('content-type')
	};
}
