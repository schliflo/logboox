/**
 * What the hook asks of a session cookie on every request: who it is, whether
 * it has expired, and whether it is due a fresh ninety days.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { now, one, run } from '../db';
import { SESSION_TTL_SECONDS, authenticateSession, createSession } from './session';
import { hashToken } from './tokens';
import { findOrCreateUser } from './users';

let db: TestDb;
let userId: string;
let token: string;

/** Sets the session's clock directly, as if it had been made in the past. */
async function age(fields: { expires_at?: number; last_used_at?: number }) {
	const hash = await hashToken(token);
	if (fields.expires_at !== undefined) {
		await run(
			db,
			'UPDATE sessions SET expires_at = ? WHERE token_hash = ?',
			fields.expires_at,
			hash
		);
	}
	if (fields.last_used_at !== undefined) {
		await run(
			db,
			'UPDATE sessions SET last_used_at = ? WHERE token_hash = ?',
			fields.last_used_at,
			hash
		);
	}
}

async function stored() {
	return one<{ expires_at: number; last_used_at: number }>(
		db,
		'SELECT expires_at, last_used_at FROM sessions WHERE token_hash = ?',
		await hashToken(token)
	);
}

beforeEach(async () => {
	db = migratedDb();
	userId = (await findOrCreateUser(db, 'reader@example.com')).user.id;
	token = await createSession(db, userId, 'test');
});

afterEach(() => {
	db.close();
});

describe('authenticating a session cookie', () => {
	it('returns the user and leaves a fresh session alone', async () => {
		const before = await stored();
		const result = await authenticateSession(db, token);

		expect(result?.user.id).toBe(userId);
		expect(result?.user.email).toBe('reader@example.com');
		expect(result?.reissue).toBe(false);
		expect(await stored()).toEqual(before);
	});

	it('knows no one it has not seen', async () => {
		expect(await authenticateSession(db, 'not-a-session')).toBeNull();
	});

	it('deletes an expired session as it meets it', async () => {
		await age({ expires_at: now() - 1 });

		expect(await authenticateSession(db, token)).toBeNull();
		expect(await stored()).toBeNull();
	});

	it('renews a session past its halfway mark, and says to reissue the cookie', async () => {
		await age({ expires_at: now() + SESSION_TTL_SECONDS / 2 - 60 });

		const result = await authenticateSession(db, token);
		expect(result?.reissue).toBe(true);
		expect((await stored())!.expires_at).toBeGreaterThanOrEqual(now() + SESSION_TTL_SECONDS - 5);
	});

	it('records use once a day, on the session and on the user', async () => {
		const old = now() - 2 * 86400;
		await age({ last_used_at: old });
		await run(db, 'UPDATE users SET last_seen_at = ? WHERE id = ?', old, userId);

		await authenticateSession(db, token);
		expect((await stored())!.last_used_at).toBeGreaterThan(old);
		const user = await one<{ last_seen_at: number }>(
			db,
			'SELECT last_seen_at FROM users WHERE id = ?',
			userId
		);
		expect(user!.last_seen_at).toBeGreaterThan(old);

		// Used again straight away, nothing more is written.
		const after = await stored();
		await authenticateSession(db, token);
		expect(await stored()).toEqual(after);
	});

	it('hands back the user as the table has it, and nothing from the session', async () => {
		const result = await authenticateSession(db, token);
		const row = await one(db, 'SELECT * FROM users WHERE id = ?', userId);

		expect(row).toMatchObject(result!.user);
		expect(Object.keys(result!.user)).not.toContain('session_id');
		expect(Object.keys(result!.user)).not.toContain('expires_at');
	});
});
