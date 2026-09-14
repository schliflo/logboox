/** Turning down a place, which is the end of the matter for that board. */

import type { RequestHandler } from './$types';
import { dismiss } from '$lib/server/leaderboard/repo';
import { requireDb } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

export const POST: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'That is done from the app.');

	const done = await dismiss(requireDb(event), auth.user.id, event.params.id);
	if (!done) return fail(404, 'That place is no longer on offer.');
	return json({ ok: true });
};
