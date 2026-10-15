/**
 * Prerendered pages never reach the hook: Cloudflare serves them with the
 * headers in `_headers` instead. The two lists have to say the same thing.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ dev: false }));
vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: () => {} }));

const { handle } = await import('./hooks.server');

/** The headers `_headers` gives every path. */
function staticHeaders(): Map<string, string> {
	const lines = readFileSync('_headers', 'utf8').split('\n');
	const start = lines.indexOf('/*');
	const headers = new Map<string, string>();
	for (const line of lines.slice(start + 1)) {
		if (!line.startsWith('  ')) break;
		const at = line.indexOf(':');
		headers.set(line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim());
	}
	return headers;
}

async function hookHeaders(): Promise<Map<string, string>> {
	const url = new URL('https://logboox.app/s/abc');
	const event = {
		url,
		request: new Request(url),
		cookies: { get: () => undefined },
		locals: {}
	};
	const response = await handle({
		event: event as never,
		resolve: async () => new Response('ok')
	});
	return new Map(response.headers);
}

describe('security headers', () => {
	it('are the same for prerendered pages and server responses', async () => {
		const fromFile = staticHeaders();
		const fromHook = await hookHeaders();

		expect(fromFile.size).toBeGreaterThan(0);
		for (const [name, value] of fromFile) expect(fromHook.get(name), name).toBe(value);
		for (const name of fromHook.keys()) {
			if (name !== 'content-type') expect(fromFile.has(name), name).toBe(true);
		}
	});
});
