/**
 * The name an account appears under.
 *
 * Its own endpoint rather than a field on the settings patch, because it is
 * the only setting that can be refused for a reason the person needs to read —
 * taken, reserved, or changed too recently.
 */

import type { RequestHandler } from './$types';
import {
	UsernameInvalid,
	UsernameTaken,
	UsernameTooSoon,
	setUsername
} from '$lib/server/leaderboard/username';
import { requireDb } from '$lib/server/context';
import { fail, json, readJson } from '$lib/server/response';

export const PUT: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'A name is chosen from the app.');

	const body = await readJson<{ username?: unknown }>(event.request);

	try {
		const username = await setUsername(
			requireDb(event),
			auth.user.id,
			typeof body?.username === 'string' ? body.username : ''
		);
		return json({ username });
	} catch (error) {
		if (error instanceof UsernameTaken) return fail(409, error.message);
		if (error instanceof UsernameTooSoon) {
			return fail(429, error.message, 'Names can be changed once a day.');
		}
		if (error instanceof UsernameInvalid) return fail(400, error.message);
		throw error;
	}
};
