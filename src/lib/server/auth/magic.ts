/**
 * Signing in by e-mail.
 *
 * A link is a 256-bit secret with a fifteen-minute life that works exactly
 * once. The database holds its hash, so the table is not a set of working
 * links, and redemption is a single conditional UPDATE: two clicks on the same
 * link race against each other in the database rather than in this code, and
 * only one of them can win.
 *
 * The link lands on a page with a button rather than signing the reader in on
 * sight. Mail clients and security scanners follow links in mail before a
 * person ever sees them, and a link that signs in when fetched would be spent
 * before it arrived.
 */

import { all, now, one, rowId, run, type Db } from '../db';
import { hashToken, randomToken } from './tokens';
import { findOrCreateUser, looksLikeEmail, normalizeEmail, type User } from './users';

export const LINK_TTL_SECONDS = 15 * 60;

/** Enough for a mistyped address and a retry, not enough to mail-bomb anyone. */
export const MAX_PER_EMAIL_PER_HOUR = 3;
export const MAX_PER_IP_PER_HOUR = 10;

export class RateLimited extends Error {
	constructor() {
		super('Too many sign-in links have been requested. Try again in an hour.');
		this.name = 'RateLimited';
	}
}

export class InvalidEmail extends Error {
	constructor() {
		super('That does not look like an e-mail address.');
		this.name = 'InvalidEmail';
	}
}

async function countSince(db: Db, column: 'email' | 'ip', value: string): Promise<number> {
	const row = await one<{ n: number }>(
		db,
		`SELECT COUNT(*) AS n FROM magic_links WHERE ${column} = ? AND created_at > ?`,
		value,
		now() - 3600
	);
	return row?.n ?? 0;
}

/**
 * Issues a link. The caller mails the token; it is never returned to the
 * browser that asked, which is the whole point of the mechanism.
 */
export async function requestMagicLink(
	db: Db,
	email: string,
	ip: string | null
): Promise<{ token: string; email: string }> {
	const normalized = normalizeEmail(email);
	if (!looksLikeEmail(normalized)) throw new InvalidEmail();

	if ((await countSince(db, 'email', normalized)) >= MAX_PER_EMAIL_PER_HOUR)
		throw new RateLimited();
	if (ip && (await countSince(db, 'ip', ip)) >= MAX_PER_IP_PER_HOUR) throw new RateLimited();

	const token = randomToken();
	await run(
		db,
		`INSERT INTO magic_links (id, email, token_hash, created_at, expires_at, consumed_at, ip)
		 VALUES (?, ?, ?, ?, ?, NULL, ?)`,
		rowId(),
		normalized,
		await hashToken(token),
		now(),
		now() + LINK_TTL_SECONDS,
		ip
	);

	return { token, email: normalized };
}

/**
 * Spends a link and returns whose it was, or null when it was never valid,
 * has expired, or has already been used.
 *
 * The UPDATE is the lock: it matches only an unspent, unexpired row, so a
 * second attempt changes nothing and gets null.
 */
export async function consumeMagicLink(
	db: Db,
	token: string
): Promise<{ user: User; created: boolean; unsubscribeToken: string | null } | null> {
	const hash = await hashToken(token);
	const claimed = await run(
		db,
		'UPDATE magic_links SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?',
		now(),
		hash,
		now()
	);
	if (claimed === 0) return null;

	const row = await one<{ email: string }>(
		db,
		'SELECT email FROM magic_links WHERE token_hash = ?',
		hash
	);
	if (!row) return null;

	return findOrCreateUser(db, row.email);
}

/** Clears spent and expired links. Called from the daily sweep. */
export async function pruneMagicLinks(db: Db): Promise<number> {
	return run(db, 'DELETE FROM magic_links WHERE expires_at < ?', now() - 86400);
}

/** Only used by the tests, to assert what was issued without reading the token. */
export async function linksFor(db: Db, email: string): Promise<Array<{ token_hash: string }>> {
	return all<{ token_hash: string }>(
		db,
		'SELECT token_hash FROM magic_links WHERE email = ? ORDER BY created_at',
		normalizeEmail(email)
	);
}
