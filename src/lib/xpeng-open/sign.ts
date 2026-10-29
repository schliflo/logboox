/**
 * Request signing for the XPeng Open Platform (overseas), after §9 of the
 * `/oauth2/queryData` integration guide, v1.0 of 2026-08-19.
 *
 * Every call carries three query parameters: `appId`, `nonce` (milliseconds
 * since the epoch) and `sign`. The signature covers every other query
 * parameter plus the request body, filed under the key `body`:
 *
 *   stringA = key1 + value1 + key2 + value2 …   keys in ascending order
 *   stringB = appId + stringA + appSecret
 *   sign    = sha1(stringB) as lowercase hex
 *
 * The body is signed as the exact string that goes on the wire, so callers
 * serialise it once and hand the same string to the signer and to fetch.
 *
 * Imports in this folder carry `.ts` extensions so Node can run the modules
 * directly for the CLI in `scripts/`; Vite and svelte-check accept them too.
 */

export interface SignInput {
	appId: string;
	appSecret: string;
	/** Query parameters other than `appId` and `sign`; at least `nonce`. */
	query: Record<string, string>;
	/** The request body exactly as sent. Omit for calls without one. */
	body?: string;
}

/** `stringB` from the guide: the text that gets hashed. Exposed for tests. */
export function signatureBase({ appId, appSecret, query, body = '' }: SignInput): string {
	const fields: Record<string, string> = { ...query, body };
	delete fields.appId;
	delete fields.sign;
	const stringA = Object.keys(fields)
		.sort(byCodeUnit)
		.map((key) => key + fields[key])
		.join('');
	return appId + stringA + appSecret;
}

export async function sign(input: SignInput): Promise<string> {
	return sha1Hex(signatureBase(input));
}

/** The endpoint with `appId`, the query parameters and `sign` attached. */
export async function signedUrl(endpoint: string, input: SignInput): Promise<string> {
	const url = new URL(endpoint);
	url.searchParams.set('appId', input.appId);
	for (const [key, value] of Object.entries(input.query)) {
		if (key === 'appId' || key === 'sign') continue;
		url.searchParams.set(key, value);
	}
	url.searchParams.set('sign', await sign(input));
	return url.toString();
}

export async function sha1Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** "Natural ascending order" in the guide: plain code-unit order, as Java's compareTo. */
function byCodeUnit(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}
