/**
 * Signed-in sessions.
 *
 * A session is a random secret in an HttpOnly cookie and a hashed row in the
 * database — no signed payload, so revoking one takes effect immediately
 * rather than whenever it happens to expire. Ninety days, renewed once it is
 * halfway through, which keeps a regular reader signed in without handing out
 * a cookie that never ages.
 */

import { now, one, rowId, run, type Db } from '../db';
import { hashToken, randomToken } from './tokens';
import { touchUser, type User } from './users';

export const SESSION_COOKIE = 'lbx_session';
export const SESSION_TTL_SECONDS = 90 * 24 * 3600;
/** Past the halfway mark, a session in use is given its full life back. */
const RENEW_AFTER_SECONDS = SESSION_TTL_SECONDS / 2;

/** Written with the flags a session cookie must have, in one place. */
export const SESSION_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	secure: true,
	maxAge: SESSION_TTL_SECONDS
} as const;

export async function createSession(
	db: Db,
	userId: string,
	userAgent: string | null
): Promise<string> {
	const token = randomToken();
	await run(
		db,
		`INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_used_at, user_agent)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		rowId(),
		userId,
		await hashToken(token),
		now(),
		now() + SESSION_TTL_SECONDS,
		now(),
		userAgent?.slice(0, 200) ?? null
	);
	return token;
}

/**
 * The user behind a cookie, or null. Expired rows are deleted as they are met,
 * which keeps the table tidy without a job to do it.
 */
export async function validateSession(db: Db, token: string): Promise<User | null> {
	const hash = await hashToken(token);
	const row = await one<{ id: string; user_id: string; expires_at: number; last_used_at: number }>(
		db,
		'SELECT id, user_id, expires_at, last_used_at FROM sessions WHERE token_hash = ?',
		hash
	);
	if (!row) return null;

	if (row.expires_at <= now()) {
		await run(db, 'DELETE FROM sessions WHERE id = ?', row.id);
		return null;
	}

	const user = await one<User>(db, 'SELECT * FROM users WHERE id = ?', row.user_id);
	if (!user) return null;

	// One write a day at most: `last_used_at` is for the user's own list of
	// sessions, not an audit log worth a row write per request.
	if (now() - row.last_used_at > 86400) {
		await run(db, 'UPDATE sessions SET last_used_at = ? WHERE id = ?', now(), row.id);
		await touchUser(db, user.id);
	}

	return user;
}

/** True when the cookie should be reissued with a fresh ninety days. */
export async function renewIfStale(db: Db, token: string): Promise<boolean> {
	const row = await one<{ id: string; expires_at: number }>(
		db,
		'SELECT id, expires_at FROM sessions WHERE token_hash = ?',
		await hashToken(token)
	);
	if (!row) return false;
	if (row.expires_at - now() > RENEW_AFTER_SECONDS) return false;
	await run(
		db,
		'UPDATE sessions SET expires_at = ? WHERE id = ?',
		now() + SESSION_TTL_SECONDS,
		row.id
	);
	return true;
}

export async function revokeSession(db: Db, token: string): Promise<void> {
	await run(db, 'DELETE FROM sessions WHERE token_hash = ?', await hashToken(token));
}

export async function revokeAllSessions(db: Db, userId: string): Promise<void> {
	await run(db, 'DELETE FROM sessions WHERE user_id = ?', userId);
}

export async function pruneSessions(db: Db): Promise<number> {
	return run(db, 'DELETE FROM sessions WHERE expires_at < ?', now());
}
