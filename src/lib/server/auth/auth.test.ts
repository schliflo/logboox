/**
 * The sign-in path, end to end against a real SQLite database.
 *
 * What is worth testing here is not that a row can be written, but the rules
 * that make the mechanism safe: that a link works exactly once, that it dies
 * on time, that nothing readable is stored, and that a token can never be used
 * to mint another.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { one } from '../db';
import {
	InvalidEmail,
	MAX_PER_EMAIL_PER_HOUR,
	RateLimited,
	consumeMagicLink,
	requestMagicLink
} from './magic';
import {
	SESSION_TTL_SECONDS,
	createSession,
	renewIfStale,
	revokeSession,
	validateSession
} from './session';
import { createToken, listTokens, revokeToken, validateToken } from './apiTokens';
import {
	API_TOKEN_PREFIX,
	hashToken,
	parseApiToken,
	randomToken,
	timingSafeEqual
} from './tokens';
import { deleteUser, findUserByEmail, findOrCreateUser, updateSettings } from './users';

let db: TestDb;

beforeEach(() => {
	db = migratedDb();
});

afterEach(() => {
	db.close();
});

describe('token primitives', () => {
	it('makes URL-safe secrets that do not repeat', () => {
		const tokens = new Set(Array.from({ length: 50 }, () => randomToken()));
		expect(tokens.size).toBe(50);
		for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it('hashes to something that is not the token', async () => {
		const token = randomToken();
		const hash = await hashToken(token);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
		expect(hash).not.toContain(token);
		expect(await hashToken(token)).toBe(hash);
	});

	it('recognises only its own API tokens', () => {
		expect(parseApiToken(`${API_TOKEN_PREFIX}abc`)).toBe('abc');
		expect(parseApiToken('abc')).toBeNull();
		expect(parseApiToken(API_TOKEN_PREFIX)).toBeNull();
	});

	it('compares secrets without leaking where they differ', () => {
		expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
		expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
		expect(timingSafeEqual('abc', 'abcdef')).toBe(false);
	});
});

describe('magic links', () => {
	it('refuses something that is not an address', async () => {
		await expect(requestMagicLink(db, 'not-an-address', null)).rejects.toThrow(InvalidEmail);
	});

	it('never stores the token itself', async () => {
		const { token } = await requestMagicLink(db, 'Reader@Example.com', null);
		const row = await one<{ token_hash: string; email: string }>(
			db,
			'SELECT token_hash, email FROM magic_links'
		);
		expect(row?.token_hash).toBe(await hashToken(token));
		// The address is the key the account is found by, so it is normalised
		// before anything is written against it.
		expect(row?.email).toBe('reader@example.com');
	});

	it('creates the account only when the link is actually used', async () => {
		const { token } = await requestMagicLink(db, 'new@example.com', null);
		expect(await findUserByEmail(db, 'new@example.com')).toBeNull();

		const result = await consumeMagicLink(db, token);
		expect(result?.created).toBe(true);
		expect(result?.user.email).toBe('new@example.com');
		expect(await findUserByEmail(db, 'new@example.com')).not.toBeNull();
	});

	it('works once and then never again', async () => {
		const { token } = await requestMagicLink(db, 'reader@example.com', null);
		expect(await consumeMagicLink(db, token)).not.toBeNull();
		expect(await consumeMagicLink(db, token)).toBeNull();
	});

	it('signs an existing reader in rather than making a second account', async () => {
		const first = await requestMagicLink(db, 'reader@example.com', null);
		const created = await consumeMagicLink(db, first.token);
		const second = await requestMagicLink(db, 'reader@example.com', null);
		const returning = await consumeMagicLink(db, second.token);

		expect(returning?.created).toBe(false);
		expect(returning?.user.id).toBe(created?.user.id);
	});

	it('refuses a token it never issued', async () => {
		expect(await consumeMagicLink(db, randomToken())).toBeNull();
	});

	it('refuses one that has expired', async () => {
		const { token } = await requestMagicLink(db, 'reader@example.com', null);
		await db
			.prepare('UPDATE magic_links SET expires_at = ?')
			.bind(Math.floor(Date.now() / 1000) - 1)
			.run();
		expect(await consumeMagicLink(db, token)).toBeNull();
	});

	it('stops a flood at one address', async () => {
		for (let i = 0; i < MAX_PER_EMAIL_PER_HOUR; i++) {
			await requestMagicLink(db, 'reader@example.com', '203.0.113.1');
		}
		await expect(requestMagicLink(db, 'reader@example.com', '203.0.113.1')).rejects.toThrow(
			RateLimited
		);
	});

	it('counts the requester as well as the address', async () => {
		for (let i = 0; i < 10; i++) {
			await requestMagicLink(db, `reader${i}@example.com`, '203.0.113.9');
		}
		await expect(requestMagicLink(db, 'another@example.com', '203.0.113.9')).rejects.toThrow(
			RateLimited
		);
		// A different caller is unaffected by someone else's limit.
		await expect(
			requestMagicLink(db, 'elsewhere@example.com', '203.0.113.10')
		).resolves.toBeDefined();
	});
});

describe('sessions', () => {
	async function signedIn() {
		const { user } = await findOrCreateUser(db, 'reader@example.com');
		return { user, token: await createSession(db, user.id, 'Test/1.0') };
	}

	it('recognises its own cookie and nothing else', async () => {
		const { user, token } = await signedIn();
		expect((await validateSession(db, token))?.id).toBe(user.id);
		expect(await validateSession(db, randomToken())).toBeNull();
	});

	it('forgets a session the moment it is revoked', async () => {
		const { token } = await signedIn();
		await revokeSession(db, token);
		expect(await validateSession(db, token)).toBeNull();
	});

	it('drops an expired session rather than honouring it', async () => {
		const { token } = await signedIn();
		await db
			.prepare('UPDATE sessions SET expires_at = ?')
			.bind(Math.floor(Date.now() / 1000) - 1)
			.run();

		expect(await validateSession(db, token)).toBeNull();
		const left = await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM sessions');
		expect(left?.n).toBe(0);
	});

	it('renews one that is past halfway, and leaves a fresh one alone', async () => {
		const { token } = await signedIn();
		expect(await renewIfStale(db, token)).toBe(false);

		await db
			.prepare('UPDATE sessions SET expires_at = ?')
			.bind(Math.floor(Date.now() / 1000) + 60)
			.run();
		expect(await renewIfStale(db, token)).toBe(true);

		const row = await one<{ expires_at: number }>(db, 'SELECT expires_at FROM sessions');
		expect(row!.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS - 5);
	});
});

describe('API tokens', () => {
	async function account() {
		const { user } = await findOrCreateUser(db, 'reader@example.com');
		return user;
	}

	it('hands the secret over once and keeps only its hash', async () => {
		const user = await account();
		const { token, row } = await createToken(db, user.id, 'Home Assistant');

		expect(token.startsWith(API_TOKEN_PREFIX)).toBe(true);
		expect(row.hint).toBe(token.slice(-4));

		const stored = await one<{ token_hash: string }>(db, 'SELECT token_hash FROM api_tokens');
		expect(stored?.token_hash).not.toContain(token);
	});

	it('resolves to its owner, read-only by default', async () => {
		const user = await account();
		const { token } = await createToken(db, user.id, 'Home Assistant');
		const resolved = await validateToken(db, parseApiToken(token)!);

		expect(resolved?.user.id).toBe(user.id);
		expect(resolved?.scopes).toEqual(['read']);
	});

	it('stops working the moment it is revoked', async () => {
		const user = await account();
		const { token, row } = await createToken(db, user.id, 'Home Assistant');

		expect(await revokeToken(db, user.id, row.id)).toBe(true);
		expect(await validateToken(db, parseApiToken(token)!)).toBeNull();
		expect(await listTokens(db, user.id)).toHaveLength(0);
	});

	it('will not let one account revoke a token belonging to another', async () => {
		const mine = await account();
		const { user: theirs } = await findOrCreateUser(db, 'someone@example.com');
		const { row } = await createToken(db, mine.id, 'Mine');

		expect(await revokeToken(db, theirs.id, row.id)).toBe(false);
	});
});

describe('the account itself', () => {
	it('keeps reminder settings inside what a rolling window allows', async () => {
		const { user } = await findOrCreateUser(db, 'reader@example.com');
		await expect(updateSettings(db, user.id, { reminderAfterDays: 40 })).rejects.toThrow();
		await expect(updateSettings(db, user.id, { reminderAfterDays: 1 })).rejects.toThrow();
		await expect(updateSettings(db, user.id, { reminderAfterDays: 20 })).resolves.toBeUndefined();
	});

	it('takes everything with it when deleted', async () => {
		const { user } = await findOrCreateUser(db, 'reader@example.com');
		await createSession(db, user.id, null);
		await createToken(db, user.id, 'Home Assistant');

		await deleteUser(db, user.id);

		for (const table of ['users', 'sessions', 'api_tokens']) {
			const left = await one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table}`);
			expect(left?.n).toBe(0);
		}
	});
});
