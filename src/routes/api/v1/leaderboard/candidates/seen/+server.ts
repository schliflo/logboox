/**
 * Marking offers as read.
 *
 * Sent when the account page shows them, so the nudge mail knows not to say
 * the same thing again two days later.
 */

import type { RequestHandler } from './$types';
import { markSeen } from '$lib/server/leaderboard/repo';
import { requireDb } from '$lib/server/context';
import { fail, json, readJson } from '$lib/server/response';

/** More than anyone could have pending; a cap, not a page size. */
const MAX_IDS = 100;

export const POST: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'That is done from the app.');

	const body = await readJson<{ ids?: unknown }>(event.request);
	const ids = Array.isArray(body?.ids)
		? body.ids.filter((id): id is string => typeof id === 'string').slice(0, MAX_IDS)
		: [];

	await markSeen(requireDb(event), auth.user.id, ids);
	return json({ ok: true });
};
