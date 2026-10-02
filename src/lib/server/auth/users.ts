/**
 * Accounts. An account is an e-mail address and a few preferences; there is no
 * password to lose and no profile to fill in.
 */

import { now, one, rowId, run, type Db } from '../db';
import { verifyUnsubscribe } from '../mail/unsubscribe';

export interface User {
	id: string;
	email: string;
	created_at: number;
	last_seen_at: number;
	reminder_enabled: number;
	reminder_after_days: number;
	reminded_at: number | null;
	auto_sync: number;
	username: string | null;
	username_changed_at: number | null;
	board_notify: number;
	board_mailed_at: number | null;
	roundup_mailed_year: number | null;
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
): Promise<{ user: User; created: boolean }> {
	const normalized = normalizeEmail(email);
	const existing = await findUserByEmail(db, normalized);
	if (existing) return { user: existing, created: false };

	const user: User = {
		id: rowId(),
		email: normalized,
		created_at: now(),
		last_seen_at: now(),
		reminder_enabled: 1,
		reminder_after_days: 25,
		reminded_at: null,
		// Nothing is copied to the account until the reader says so.
		auto_sync: 0,
		username: null,
		username_changed_at: null,
		board_notify: 1,
		board_mailed_at: null,
		roundup_mailed_year: null
	};

	await run(
		db,
		`INSERT INTO users (id, email, created_at, last_seen_at, reminder_enabled,
			reminder_after_days, reminded_at, auto_sync)
		 VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
		user.id,
		user.email,
		user.created_at,
		user.last_seen_at,
		user.reminder_enabled,
		user.reminder_after_days,
		user.auto_sync
	);

	return { user, created: true };
}

export interface UserSettings {
	reminderEnabled?: boolean;
	reminderAfterDays?: number;
	autoSync?: boolean;
	/** Being told when a trip would rank. Separate from the export reminder. */
	boardNotify?: boolean;
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
	if (patch.boardNotify !== undefined) {
		sets.push('board_notify = ?');
		values.push(patch.boardNotify ? 1 : 0);
	}

	if (sets.length === 0) return;
	values.push(id);
	await run(db, `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...values);
}

/**
 * The kinds of mail this app sends, each with its own way out. The kind is
 * part of what an unsubscribe token signs, so turning one off cannot touch the
 * other.
 */
export type MailKind = 'reminders' | 'leaderboard';

/**
 * The user behind an unsubscribe link, or null when the token is not one this
 * deployment signed for that kind. See mail/unsubscribe.ts.
 */
export async function findUserByUnsubscribeToken(
	db: Db,
	secret: string,
	token: string,
	kind: MailKind = 'reminders'
): Promise<User | null> {
	const id = await verifyUnsubscribe(secret, token, kind);
	return id ? findUser(db, id) : null;
}

/**
 * Removes the account and everything hanging off it. The bucket objects are
 * deleted separately — a foreign key cannot reach into R2.
 */
export async function deleteUser(db: Db, id: string): Promise<void> {
	const user = await findUser(db, id);

	// One batch, so a failure halfway cannot leave half an account. Every child
	// table cascades from `users` as well; the explicit deletes are for a
	// database that was opened without foreign keys enforced.
	const statements = [
		'sessions',
		'api_tokens',
		'exports',
		'trips',
		'charging_sessions',
		'vehicles',
		'annotations',
		'shares',
		'board_candidates',
		'board_entries'
	].map((table) => db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(id));

	// Not linked by id: a sign-in link only knows the address it was sent to.
	if (user) statements.push(db.prepare('DELETE FROM magic_links WHERE email = ?').bind(user.email));
	statements.push(db.prepare('DELETE FROM users WHERE id = ?').bind(id));

	await db.batch(statements);
}
