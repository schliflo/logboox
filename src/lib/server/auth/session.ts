/**
 * Signed-in sessions.
 *
 * A session is a random secret in an HttpOnly cookie and a hashed row in the
 * database — no signed payload, so revoking one takes effect immediately
 * rather than whenever it happens to expire. Ninety days, renewed once it is
 * halfway through, which keeps a regular reader signed in without handing out
 * a cookie that never ages.
 */

import { now, one, rowId, run, type Db, type Statement } from '../db';
import { hashToken, randomToken } from './tokens';
import type { User } from './users';

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

/** Every `User` column, spelled out; the type makes forgetting one a compile error. */
const USER_COLUMNS = {
	id: 1,
	email: 1,
	created_at: 1,
	last_seen_at: 1,
	reminder_enabled: 1,
	reminder_after_days: 1,
	reminded_at: 1,
	auto_sync: 1,
	username: 1,
	username_changed_at: 1,
	board_notify: 1,
	board_mailed_at: 1,
	roundup_mailed_year: 1,
	award_mailed_month: 1
} satisfies Record<keyof User, 1>;

const USER_SELECT = Object.keys(USER_COLUMNS)
	.map((column) => `u.${column}`)
	.join(', ');

/**
 * What every cookie request does, in one read: the user behind the cookie, and
 * whether the cookie should be reissued with a fresh ninety days. Expired rows
 * are deleted as they are met, which keeps the table tidy without a job to do
 * it, and whatever else needs writing goes out as one batch.
 */
export async function authenticateSession(
	db: Db,
	token: string
): Promise<{ user: User; reissue: boolean } | null> {
	const row = await one<User & { session_id: string; expires_at: number; last_used_at: number }>(
		db,
		`SELECT s.id AS session_id, s.expires_at, s.last_used_at, ${USER_SELECT}
		 FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.token_hash = ?`,
		await hashToken(token)
	);
	if (!row) return null;

	const { session_id, expires_at, last_used_at, ...user } = row;
	const at = now();

	if (expires_at <= at) {
		await run(db, 'DELETE FROM sessions WHERE id = ?', session_id);
		return null;
	}

	const reissue = expires_at - at <= RENEW_AFTER_SECONDS;
	const touch = at - last_used_at > 86400;
	const writes: Statement[] = [];

	if (touch || reissue) {
		// One write a day at most for `last_used_at`: it is for the user's own
		// list of sessions, not an audit log worth a row write per request.
		writes.push(
			db
				.prepare('UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE id = ?')
				.bind(
					touch ? at : last_used_at,
					reissue ? at + SESSION_TTL_SECONDS : expires_at,
					session_id
				)
		);
	}
	if (touch) {
		writes.push(db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(at, user.id));
	}
	if (writes.length > 0) await db.batch(writes);

	return { user, reissue };
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
