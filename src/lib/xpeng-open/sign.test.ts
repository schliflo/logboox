import { describe, expect, it } from 'vitest';
import { sha1Hex, sign, signatureBase, signedUrl } from './sign.ts';

// Example 2 of the guide (§9.4), verbatim.
const BODY =
	'{"openId":"xxx","accessToken":"yyy","enterpriseName":"XXXX Enterprise Name","scopeCode":"abc"}';
const QUERY_DATA = {
	appId: 'APPID',
	appSecret: 'APPSECRET',
	query: { nonce: '1787020880806' },
	body: BODY
};
// Example 1 of the guide: the authorize call, which has no body.
const AUTHORIZE = {
	appId: 'APPID',
	appSecret: 'APPSECRET',
	query: { nonce: 'NONCE', state: 'STATE' }
};

describe('signatureBase', () => {
	it('reproduces example 2 of the guide for queryData', () => {
		expect(signatureBase(QUERY_DATA)).toBe(`APPIDbody${BODY}nonce1787020880806APPSECRET`);
	});

	it('reproduces example 1 of the guide for authorize, with an empty body', () => {
		expect(signatureBase(AUTHORIZE)).toBe('APPIDbodynonceNONCEstateSTATEAPPSECRET');
	});

	it('never signs appId or sign themselves, whatever the caller passes', () => {
		expect(
			signatureBase({ appId: 'A', appSecret: 'S', query: { sign: 'x', appId: 'y', nonce: '1' } })
		).toBe('Abodynonce1S');
	});

	it('orders keys by code unit, not by insertion', () => {
		expect(
			signatureBase({ appId: 'A', appSecret: 'S', query: { state: 'st', nonce: 'n' }, body: 'b' })
		).toBe('AbodybnoncenstatestS');
	});
});

describe('sign', () => {
	it('is the lowercase SHA-1 of the base string', async () => {
		await expect(sign(QUERY_DATA)).resolves.toBe('95417ce451fa50bd627f58feae3864469f127c28');
		await expect(sign(AUTHORIZE)).resolves.toBe('6bfab815735204dbb8d9b278aee461df091d04ab');
	});
});

describe('sha1Hex', () => {
	it('matches the well-known digest of the empty string', async () => {
		await expect(sha1Hex('')).resolves.toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
	});
});

describe('signedUrl', () => {
	it('attaches appId, the query parameters and sign, and nothing secret', async () => {
		const url = new URL(await signedUrl('https://example.test/open/oauth2/queryData', QUERY_DATA));
		expect(url.pathname).toBe('/open/oauth2/queryData');
		expect(url.searchParams.get('appId')).toBe('APPID');
		expect(url.searchParams.get('nonce')).toBe('1787020880806');
		expect(url.searchParams.get('sign')).toBe('95417ce451fa50bd627f58feae3864469f127c28');
		expect(url.searchParams.has('appSecret')).toBe(false);
		expect(url.searchParams.has('body')).toBe(false);
	});
});
