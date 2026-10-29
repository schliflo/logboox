import { describe, expect, it, vi } from 'vitest';
import { sign } from './sign.ts';
import {
	QUERY_DATA_ENDPOINT,
	downloadExport,
	interpret,
	ownerBody,
	pollUntilReady,
	queryData,
	type OpenResponse,
	type QueryDataResult
} from './queryData.ts';

const app = { appId: 'APPID', appSecret: 'APPSECRET' };
const owner = {
	openId: 'xxx',
	accessToken: 'yyy',
	enterpriseName: 'XXXX Enterprise Name',
	scopeCode: 'abc'
};

const LINK = 'https://example.com/download?token=xxx';
const EXPORTING: OpenResponse = { code: 0, data: 'DataFileExporting', msg: null };
const READY: OpenResponse = { code: 0, data: LINK, msg: null };
const LIMIT: OpenResponse = {
	code: 12064024,
	data: null,
	msg: 'Server unavailable. Please try again later',
	desc: 'Download count exceeded the limit'
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json;charset=UTF-8' }
	});
}

/** A fetch that answers from a queue and records what it was asked. */
function fakeFetch(replies: Response[]) {
	const calls: Array<{ url: URL; init: RequestInit }> = [];
	const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: new URL(String(input)), init: init ?? {} });
		const next = replies.shift();
		if (!next) throw new Error('no reply queued');
		return next;
	});
	return { calls, fetch: impl as unknown as typeof fetch };
}

describe('ownerBody', () => {
	it("serialises the four owner credentials in the guide's order", () => {
		expect(ownerBody(owner)).toBe(
			'{"openId":"xxx","accessToken":"yyy","enterpriseName":"XXXX Enterprise Name","scopeCode":"abc"}'
		);
	});
});

describe('queryData', () => {
	it('posts the signed body to the chosen environment', async () => {
		const { calls, fetch } = fakeFetch([json(EXPORTING)]);
		const result = await queryData({ env: 'uat', app, owner, fetch, now: () => 1787020880806 });

		expect(result).toEqual({ kind: 'exporting' });
		const [{ url, init }] = calls;
		expect(url.origin + url.pathname).toBe(QUERY_DATA_ENDPOINT.uat);
		expect(url.searchParams.get('appId')).toBe('APPID');
		expect(url.searchParams.get('nonce')).toBe('1787020880806');
		// The guide's example 2, so the signature is known independently.
		expect(url.searchParams.get('sign')).toBe('95417ce451fa50bd627f58feae3864469f127c28');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
		expect(init.body).toBe(ownerBody(owner));
	});

	it('signs exactly the bytes it sends, for any owner', async () => {
		const other = {
			...owner,
			enterpriseName: 'logboox',
			scopeCode: 'd580644744cd40ddbdf88ad5a5125613'
		};
		const { calls, fetch } = fakeFetch([json(READY)]);
		await queryData({ env: 'prod', app, owner: other, fetch, now: () => 42 });

		const [{ url, init }] = calls;
		expect(url.origin + url.pathname).toBe(QUERY_DATA_ENDPOINT.prod);
		const expected = await sign({ ...app, query: { nonce: '42' }, body: String(init.body) });
		expect(url.searchParams.get('sign')).toBe(expected);
	});

	it('reports a reply that is not an Open Platform envelope, with the HTTP status', async () => {
		const { fetch } = fakeFetch([new Response('<html>', { status: 502 })]);
		const result = await queryData({ env: 'prod', app, owner, fetch });
		expect(result).toMatchObject({ kind: 'error', code: -1, status: 502 });
	});
});

describe('interpret', () => {
	it("takes production's code 200 as success, as the guide's 0", () => {
		expect(interpret({ code: 200, data: 'DataFileExporting', msg: 'success', desc: null })).toEqual(
			{
				kind: 'exporting'
			}
		);
		expect(interpret({ code: 200, data: 'https://x.example/f.zip' })).toEqual({
			kind: 'ready',
			url: 'https://x.example/f.zip'
		});
	});

	const cases: Array<[string, OpenResponse, QueryDataResult]> = [
		['a fresh submission', EXPORTING, { kind: 'exporting' }],
		['a finished file', READY, { kind: 'ready', url: LINK }],
		['a failed export', { code: 0, data: 'DataFileExportFailed', msg: null }, { kind: 'failed' }],
		['the 24-hour budget', LIMIT, { kind: 'limit' }],
		[
			'a missing authorisation',
			{
				code: 12064019,
				data: null,
				msg: 'Server unavailable. Please try again later',
				desc: 'No authorization record for this user and application'
			},
			{
				kind: 'unauthorized',
				code: 12064019,
				desc: 'No authorization record for this user and application'
			}
		],
		[
			'an expired token',
			{
				code: 4004001,
				data: null,
				msg: 'Server unavailable. Please try again later',
				desc: 'accesstoken已过期'
			},
			{ kind: 'tokenExpired', code: 4004001, desc: 'accesstoken已过期' }
		],
		[
			'a bad appId, as the UAT host really answers it',
			{ code: 12061001, data: null, msg: 'Invalid appId', desc: '无效的appId' },
			{ kind: 'appError', code: 12061001, desc: '无效的appId' }
		]
	];

	it.each(cases)('classifies %s', (_name, response, expected) => {
		expect(interpret(response)).toEqual(expected);
	});

	it('keeps unknown codes with their fixed description and the HTTP status', () => {
		const reply = {
			code: 12060000,
			data: null,
			msg: 'Server unavailable. Please try again later',
			desc: '操作失败'
		};
		expect(interpret(reply, 500)).toEqual({
			kind: 'error',
			code: 12060000,
			desc: '操作失败',
			msg: 'Server unavailable. Please try again later',
			status: 500
		});
	});

	it('does not mistake other success payloads for a link', () => {
		expect(interpret({ code: 0, data: 'something else' }).kind).toBe('error');
		expect(interpret({ code: 0, data: null }).kind).toBe('error');
	});
});

describe('pollUntilReady', () => {
	function clockAndSleep(start = 1_000_000) {
		let clock = start;
		const sleeps: number[] = [];
		return {
			now: () => clock,
			sleeps,
			sleep: async (ms: number) => {
				sleeps.push(ms);
				clock += ms;
			}
		};
	}

	it('keeps asking while exporting and returns the link when it appears', async () => {
		const { calls, fetch } = fakeFetch([json(EXPORTING), json(EXPORTING), json(READY)]);
		const { now, sleep, sleeps } = clockAndSleep();
		const seen: string[] = [];

		const result = await pollUntilReady({
			env: 'uat',
			app,
			owner,
			fetch,
			now,
			sleep,
			intervalMs: 5,
			onStatus: (status, attempt) => seen.push(`${attempt}:${status.kind}`)
		});

		expect(result).toEqual({ kind: 'ready', url: LINK });
		expect(calls).toHaveLength(3);
		expect(sleeps).toEqual([5, 5]);
		expect(seen).toEqual(['1:exporting', '2:exporting', '3:ready']);
	});

	it('stops at once on anything that is not exporting', async () => {
		const { calls, fetch } = fakeFetch([json(LIMIT), json(READY)]);
		const { now, sleep, sleeps } = clockAndSleep();
		const result = await pollUntilReady({
			env: 'uat',
			app,
			owner,
			fetch,
			now,
			sleep,
			intervalMs: 5
		});

		expect(result).toEqual({ kind: 'limit' });
		expect(calls).toHaveLength(1);
		expect(sleeps).toEqual([]);
	});

	it('gives up after maxWaitMs and reports that the export is still running', async () => {
		const { calls, fetch } = fakeFetch(Array.from({ length: 6 }, () => json(EXPORTING)));
		const { now, sleep } = clockAndSleep();
		const result = await pollUntilReady({
			env: 'uat',
			app,
			owner,
			fetch,
			now,
			sleep,
			intervalMs: 5,
			maxWaitMs: 10
		});

		expect(result).toEqual({ kind: 'exporting' });
		expect(calls).toHaveLength(3);
	});
});

describe('downloadExport', () => {
	it('returns the bytes and the content type', async () => {
		const { calls, fetch } = fakeFetch([
			new Response(new Uint8Array([0x50, 0x4b, 3, 4]), {
				headers: { 'content-type': 'application/zip' }
			})
		]);
		const { bytes, contentType } = await downloadExport(LINK, fetch);

		expect(calls[0].url.toString()).toBe(LINK);
		expect([...bytes]).toEqual([0x50, 0x4b, 3, 4]);
		expect(contentType).toBe('application/zip');
	});

	it('throws when the link has expired', async () => {
		const { fetch } = fakeFetch([new Response('expired', { status: 403 })]);
		await expect(downloadExport(LINK, fetch)).rejects.toThrow('HTTP 403');
	});
});
