/**
 * Tokens the user makes for themselves.
 *
 * The point of these is Home Assistant and anything else that reads the data
 * on a schedule: a long-lived credential that is not a session, cannot be
 * ridden by a web page, and can be revoked on its own. They are created and
 * revoked from a signed-in session only — a token can never mint another.
 */

import { all, now, one, rowId, run, type Db } from '../db';
import { formatApiToken, hashToken, randomToken, tokenHint } from './tokens';
import type { User } from './users';

export interface ApiTokenRow {
	id: string;
	user_id: string;
	name: string;
	hint: string;
	scopes: string;
	created_at: number;
	last_used_at: number | null;
	revoked_at: number | null;
}

/** Read is all the UI offers for now; write exists so the check is not a lie. */
export type Scope = 'read' | 'write';

export const MAX_TOKENS_PER_USER = 20;

export class TooManyTokens extends Error {
	constructor() {
		super('That is as many tokens as one account can have. Revoke one first.');
		this.name = 'TooManyTokens';
	}
}

export async function listTokens(db: Db, userId: string): Promise<ApiTokenRow[]> {
	return all<ApiTokenRow>(
		db,
		'SELECT id, user_id, name, hint, scopes, created_at, last_used_at, revoked_at FROM api_tokens WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC',
		userId
	);
}

/**
 * Creates one and returns the secret. This is the only moment it exists in
 * readable form anywhere; the caller shows it once and then it is gone.
 */
export async function createToken(
	db: Db,
	userId: string,
	name: string,
	scopes: Scope[] = ['read']
): Promise<{ row: ApiTokenRow; token: string }> {
	const live = await listTokens(db, userId);
	if (live.length >= MAX_TOKENS_PER_USER) throw new TooManyTokens();

	const secret = randomToken();
	const row: ApiTokenRow = {
		id: rowId(),
		user_id: userId,
		name: name.trim().slice(0, 60) || 'Untitled token',
		hint: tokenHint(secret),
		scopes: scopes.join(' '),
		created_at: now(),
		last_used_at: null,
		revoked_at: null
	};

	await run(
		db,
		`INSERT INTO api_tokens (id, user_id, name, token_hash, hint, scopes, created_at, last_used_at, revoked_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
		row.id,
		row.user_id,
		row.name,
		await hashToken(secret),
		row.hint,
		row.scopes,
		row.created_at
	);

	return { row, token: formatApiToken(secret) };
}

export async function revokeToken(db: Db, userId: string, id: string): Promise<boolean> {
	const changed = await run(
		db,
		'UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL',
		now(),
		id,
		userId
	);
	return changed > 0;
}

/**
 * Whose token this is, and what it may do. `last_used_at` is written at most
 * once an hour: a polling integration would otherwise turn every read into a
 * write.
 */
export async function validateToken(
	db: Db,
	secret: string
): Promise<{ user: User; scopes: Scope[] } | null> {
	const row = await one<{
		id: string;
		user_id: string;
		scopes: string;
		last_used_at: number | null;
	}>(
		db,
		'SELECT id, user_id, scopes, last_used_at FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL',
		await hashToken(secret)
	);
	if (!row) return null;

	const user = await one<User>(db, 'SELECT * FROM users WHERE id = ?', row.user_id);
	if (!user) return null;

	if (!row.last_used_at || now() - row.last_used_at > 3600) {
		await run(db, 'UPDATE api_tokens SET last_used_at = ? WHERE id = ?', now(), row.id);
	}

	return { user, scopes: row.scopes.split(' ').filter(Boolean) as Scope[] };
}
