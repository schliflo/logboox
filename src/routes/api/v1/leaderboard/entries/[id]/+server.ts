/**
 * Taking a published place back down.
 *
 * Works whether or not the month has locked. A board freezing is no reason for
 * somebody to lose the ability to withdraw something they published about
 * themselves, and that is the one thing that must never depend on a deadline.
 */

import type { RequestHandler } from './$types';
import { removeEntry } from '$lib/server/leaderboard/repo';
import { requireDb } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

export const DELETE: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Places are removed from the app.');

	const done = await removeEntry(requireDb(event), auth.user.id, event.params.id);
	if (!done) return fail(404, 'That place is not one of yours.');
	return json({ ok: true });
};
