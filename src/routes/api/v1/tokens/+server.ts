/**
 * Tokens the user makes for themselves.
 *
 * Session only, both ways. A token that could mint another would make revoking
 * one meaningless, and there is no case for it: these are created by a person
 * on the account page and then pasted into something that polls.
 */

import type { RequestHandler } from './$types';
import { TooManyTokens, createToken, listTokens } from '$lib/server/auth/apiTokens';
import { requireDb } from '$lib/server/context';
import { fail, json, readJson } from '$lib/server/response';

export const GET: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Tokens are managed from the app.');

	const rows = await listTokens(requireDb(event), auth.user.id);

	return json({
		tokens: rows.map((row) => ({
			id: row.id,
			name: row.name,
			hint: row.hint,
			scopes: row.scopes.split(' '),
			createdAt: row.created_at,
			lastUsedAt: row.last_used_at
		}))
	});
};

export const POST: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Tokens are managed from the app.');

	const body = await readJson<{ name?: unknown }>(event.request);
	const name = typeof body?.name === 'string' ? body.name : '';
	if (!name.trim()) return fail(400, 'Give the token a name so you can tell them apart.');

	try {
		const created = await createToken(requireDb(event), auth.user.id, name);
		// The only time the secret exists in readable form. The caller shows it
		// once; there is no way to ask for it again.
		return json({
			token: created.token,
			id: created.row.id,
			name: created.row.name,
			hint: created.row.hint,
			scopes: created.row.scopes.split(' '),
			createdAt: created.row.created_at
		});
	} catch (error) {
		if (error instanceof TooManyTokens) return fail(409, error.message);
		throw error;
	}
};
