/**
 * The library lists what the account holds only while there is an account.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('../features', () => ({ ACCOUNTS_ENABLED: true }));

const { account } = await import('./account.svelte');
const { history } = await import('./history.svelte');

const REMOTE = {
	id: 'DA-1',
	vin: 'L1NTEST00000000001',
	vmodel: 'F30b',
	startTime: 1,
	endTime: 2,
	rows: 10,
	days: 1,
	distanceKm: 5,
	trips: 1,
	storedBytes: 100,
	isDemo: false,
	uploadedAt: 3
};

describe('the account half of the library', () => {
	it('is dropped on sign-out', async () => {
		history.remote = [REMOTE];
		expect(history.groups).toHaveLength(1);

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 204 }))
		);
		await account.signOut();

		expect(history.remote).toEqual([]);
		expect(history.groups).toHaveLength(0);
		vi.unstubAllGlobals();
	});

	it('is dropped when the account is deleted', async () => {
		history.remote = [REMOTE];

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 204 }))
		);
		await account.deleteAccount();

		expect(history.remote).toEqual([]);
		vi.unstubAllGlobals();
	});
});
