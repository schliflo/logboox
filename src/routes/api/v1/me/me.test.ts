/** Asking who is signed in when nobody is. */

import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ dev: false }));
vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: () => {} }));

const { GET } = await import('./+server');

function get(path: string) {
	return GET({ url: new URL(path, 'https://logboox.app'), locals: { auth: null } } as never);
}

describe('GET /api/v1/me', () => {
	it('refuses without a credential', async () => {
		const response = await get('/api/v1/me');
		expect(response.status).toBe(401);
	});

	it('answers with nobody when asked optionally', async () => {
		const response = await get('/api/v1/me?optional');
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ user: null });
	});
});
