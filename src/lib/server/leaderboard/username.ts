/**
 * The name someone appears under.
 *
 * Asked for only when it is first needed — at the moment of claiming a place —
 * rather than at sign-up, because an account that never touches a board never
 * needs one. It is the single piece of this product that is deliberately
 * public, so it is also the only field with rules about taste attached.
 */

import { now as currentTime, one, run, type Db } from '../db';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

/**
 * Letters, digits, underscore and hyphen, starting with a letter or a digit.
 *
 * Narrow on purpose. A name that can hold spaces, dots or right-to-left marks
 * is a name that can be made to look like somebody else's.
 */
const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,23}$/i;

/** How long before a name may be changed again. */
export const CHANGE_AFTER_SECONDS = 86400;

/**
 * Names nobody may take: the ones that would look like the app speaking, and
 * the handful that would read as a system message on a board.
 */
const RESERVED = new Set([
	'admin',
	'administrator',
	'anonymous',
	'api',
	'deleted',
	'help',
	'logboox',
	'mod',
	'moderator',
	'null',
	'official',
	'owner',
	'removed',
	'root',
	'staff',
	'support',
	'system',
	'undefined',
	'unknown',
	'www',
	'xpeng'
]);

export class UsernameInvalid extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UsernameInvalid';
	}
}

export class UsernameTaken extends Error {
	constructor() {
		super('Someone is already using that name.');
		this.name = 'UsernameTaken';
	}
}

export class UsernameTooSoon extends Error {
	constructor(readonly retryAfter: number) {
		super('A name can only be changed once a day.');
		this.name = 'UsernameTooSoon';
	}
}

/** What is wrong with a name, or nothing. */
export function checkUsername(name: unknown): asserts name is string {
	if (typeof name !== 'string') throw new UsernameInvalid('A name is missing.');
	const trimmed = name.trim();
	if (trimmed.length < USERNAME_MIN) {
		throw new UsernameInvalid(`A name needs at least ${USERNAME_MIN} characters.`);
	}
	if (trimmed.length > USERNAME_MAX) {
		throw new UsernameInvalid(`A name can be at most ${USERNAME_MAX} characters.`);
	}
	if (!USERNAME_RE.test(trimmed)) {
		throw new UsernameInvalid('Letters, digits, hyphens and underscores only.');
	}
	if (RESERVED.has(trimmed.toLowerCase())) {
		throw new UsernameInvalid('That name is reserved.');
	}
}

/** Whether the name is free, ignoring case and ignoring its current owner. */
export async function isAvailable(db: Db, name: string, userId?: string): Promise<boolean> {
	const row = await one<{ id: string }>(
		db,
		'SELECT id FROM users WHERE username IS NOT NULL AND username = ? COLLATE NOCASE',
		name.trim()
	);
	return !row || row.id === userId;
}

/**
 * Sets the name, or says why it cannot.
 *
 * The unique index is the authority rather than the check above it: two people
 * claiming the same name in the same second is exactly the case a check would
 * miss, and the index would not.
 */
export async function setUsername(
	db: Db,
	userId: string,
	name: string,
	now = currentTime()
): Promise<string> {
	checkUsername(name);
	const value = name.trim();

	const current = await one<{ username: string | null; username_changed_at: number | null }>(
		db,
		'SELECT username, username_changed_at FROM users WHERE id = ?',
		userId
	);
	if (!current) throw new UsernameInvalid('That account no longer exists.');

	// Setting the same name again is not a change and should not cost a day.
	if (current.username !== null && current.username.toLowerCase() === value.toLowerCase()) {
		if (current.username !== value) {
			await run(db, 'UPDATE users SET username = ? WHERE id = ?', value, userId);
		}
		return value;
	}

	if (current.username_changed_at !== null) {
		const next = current.username_changed_at + CHANGE_AFTER_SECONDS;
		if (now < next) throw new UsernameTooSoon(next);
	}

	if (!(await isAvailable(db, value, userId))) throw new UsernameTaken();

	try {
		await run(
			db,
			'UPDATE users SET username = ?, username_changed_at = ? WHERE id = ?',
			value,
			now,
			userId
		);
	} catch (error) {
		if (error instanceof Error && /unique/i.test(error.message)) throw new UsernameTaken();
		throw error;
	}

	return value;
}
