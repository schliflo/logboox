/**
 * Accounts. An account is an e-mail address and a few preferences; there is no
 * password to lose and no profile to fill in.
 */

import { now, one, rowId, run, type Db } from '../db';
import { hashToken, randomToken } from './tokens';

export interface User {
	id: string;
	email: string;
	created_at: number;
	last_seen_at: number;
	reminder_enabled: number;
	reminder_after_days: number;
	reminded_at: number | null;
	auto_sync: number;
	unsubscribe_token_hash: string;
}

/** Addresses differ only by case and stray spaces far more often than by intent. */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/** Deliberately permissive: the confirmation mail is the real check. */
export function looksLikeEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function findUserByEmail(db: Db, email: string): Promise<User | null> {
	return one<User>(db, 'SELECT * FROM users WHERE email = ?', normalizeEmail(email));
}

export function findUser(db: Db, id: string): Promise<User | null> {
	return one<User>(db, 'SELECT * FROM users WHERE id = ?', id);
}

/**
 * The account for an address, created on first sign-in. There is no separate
 * registration: proving you can read the inbox is the whole of it.
 */
export async function findOrCreateUser(
	db: Db,
	email: string
): Promise<{ user: User; created: boolean; unsubscribeToken: string | null }> {
	const normalized = normalizeEmail(email);
	const existing = await findUserByEmail(db, normalized);
	if (existing) return { user: existing, created: false, unsubscribeToken: null };

	// One-click unsubscribe has to work from a mail client with no session, so
	// the link carries its own secret — stored the same way as every other.
	const unsubscribeToken = randomToken();
	const user: User = {
		id: rowId(),
		email: normalized,
		created_at: now(),
		last_seen_at: now(),
		reminder_enabled: 1,
		reminder_after_days: 25,
		reminded_at: null,
		auto_sync: 1,
		unsubscribe_token_hash: await hashToken(unsubscribeToken)
	};

	await run(
		db,
		`INSERT INTO users (id, email, created_at, last_seen_at, reminder_enabled,
			reminder_after_days, reminded_at, auto_sync, unsubscribe_token_hash)
		 VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
		user.id,
		user.email,
		user.created_at,
		user.last_seen_at,
		user.reminder_enabled,
		user.reminder_after_days,
		user.auto_sync,
		user.unsubscribe_token_hash
	);

	return { user, created: true, unsubscribeToken };
}

export async function touchUser(db: Db, id: string): Promise<void> {
	await run(db, 'UPDATE users SET last_seen_at = ? WHERE id = ?', now(), id);
}

export interface UserSettings {
	reminderEnabled?: boolean;
	reminderAfterDays?: number;
	autoSync?: boolean;
}

/** Bounds are the product's, not the database's: a reminder is useless outside them. */
export const REMINDER_DAYS_MIN = 7;
export const REMINDER_DAYS_MAX = 29;

export async function updateSettings(db: Db, id: string, patch: UserSettings): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];

	if (patch.reminderEnabled !== undefined) {
		sets.push('reminder_enabled = ?');
		values.push(patch.reminderEnabled ? 1 : 0);
	}
	if (patch.reminderAfterDays !== undefined) {
		const days = Math.round(patch.reminderAfterDays);
		if (!Number.isFinite(days) || days < REMINDER_DAYS_MIN || days > REMINDER_DAYS_MAX) {
			throw new Error(
				`A reminder has to be between ${REMINDER_DAYS_MIN} and ${REMINDER_DAYS_MAX} days.`
			);
		}
		sets.push('reminder_after_days = ?');
		values.push(days);
	}
	if (patch.autoSync !== undefined) {
		sets.push('auto_sync = ?');
		values.push(patch.autoSync ? 1 : 0);
	}

	if (sets.length === 0) return;
	values.push(id);
	await run(db, `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...values);
}

/**
 * A fresh unsubscribe token for the next message, and the hash that will
 * recognise it.
 *
 * Rotated per message rather than stored in readable form. Only the hash is
 * ever written down, which means the link in an old mail stops working once a
 * newer one has been sent — no loss, since every reminder carries a current
 * one, and it keeps the table free of anything that opens a door.
 */
export async function rotateUnsubscribeToken(db: Db, userId: string): Promise<string> {
	const token = randomToken();
	await run(
		db,
		'UPDATE users SET unsubscribe_token_hash = ? WHERE id = ?',
		await hashToken(token),
		userId
	);
	return token;
}

/**
 * The user behind an unsubscribe link. Hashed lookup, so the link in a mail
 * client's history is not a key to anything but this one switch.
 */
export async function findUserByUnsubscribeToken(db: Db, token: string): Promise<User | null> {
	return one<User>(
		db,
		'SELECT * FROM users WHERE unsubscribe_token_hash = ?',
		await hashToken(token)
	);
}

/**
 * Removes the account and everything hanging off it. The bucket objects are
 * deleted separately — a foreign key cannot reach into R2.
 */
export async function deleteUser(db: Db, id: string): Promise<void> {
	for (const table of [
		'sessions',
		'api_tokens',
		'exports',
		'trips',
		'charging_sessions',
		'vehicles',
		'annotations',
		'shares'
	]) {
		await run(db, `DELETE FROM ${table} WHERE user_id = ?`, id);
	}
	await run(db, 'DELETE FROM users WHERE id = ?', id);
}
