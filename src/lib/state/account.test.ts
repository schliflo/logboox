/**
 * What the account store believes when the server cannot be asked, and what
 * the rest of the app is told when it stops being signed in.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ browser: true }));
vi.mock('../features', () => ({ ACCOUNTS_ENABLED: true }));

const { account } = await import('./account.svelte');

const ME = {
	user: {
		email: 'driver@example.test',
		createdAt: 0,
		autoSync: false,
		reminderEnabled: false,
		reminderAfterDays: 7,
		username: null,
		boardNotify: false
	},
	via: 'session',
	storage: { exports: 1, usedBytes: 10, quotaBytes: 100 }
};

function answer(status: number, body: unknown = {}) {
	return vi.fn(async () => new Response(status === 204 ? null : JSON.stringify(body), { status }));
}

function offline() {
	return vi.fn(async () => {
		throw new TypeError('Failed to fetch');
	});
}

beforeEach(() => {
	account.status = 'unknown';
	account.user = null;
	account.error = null;
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('asking who is signed in', () => {
	it('clears an earlier error once the server answers', async () => {
		account.error = 'LogbooX could not be reached.';
		vi.stubGlobal('fetch', answer(200, ME));

		await account.refresh();

		expect(account.signedIn).toBe(true);
		expect(account.error).toBeNull();
	});

	it('stays signed in when the network is gone', async () => {
		vi.stubGlobal('fetch', answer(200, ME));
		await account.refresh();

		vi.stubGlobal('fetch', offline());
		await account.refresh();

		expect(account.signedIn).toBe(true);
		expect(account.error).toBeNull();
	});

	it('starts anonymous, without an error, when offline with nothing known', async () => {
		vi.stubGlobal('fetch', offline());

		await account.refresh();

		expect(account.status).toBe('anonymous');
		expect(account.error).toBeNull();
	});

	it('is signed out on a 401, and says nothing about it', async () => {
		vi.stubGlobal('fetch', answer(200, ME));
		await account.refresh();

		vi.stubGlobal('fetch', answer(401, { error: 'Sign in.' }));
		await account.refresh();

		expect(account.signedIn).toBe(false);
		expect(account.error).toBeNull();
	});

	it('is signed out, with the reason kept, on any other failure', async () => {
		vi.stubGlobal('fetch', answer(500, { error: 'Broken.' }));

		await account.refresh();

		expect(account.signedIn).toBe(false);
		expect(account.error).toBe('Broken.');
	});
});

describe('when the account goes', () => {
	it('tells whoever holds a copy of it on sign-out and on deletion', async () => {
		const gone = vi.fn();
		const stop = account.onSignedOut(gone);

		vi.stubGlobal('fetch', answer(204));
		await account.signOut();
		expect(gone).toHaveBeenCalledTimes(1);

		await account.deleteAccount();
		expect(gone).toHaveBeenCalledTimes(2);

		stop();
		await account.signOut();
		expect(gone).toHaveBeenCalledTimes(2);
	});
});
