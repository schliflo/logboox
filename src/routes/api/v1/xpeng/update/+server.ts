/**
 * "Update now": fetch today's XPeng export and merge it into the timeline,
 * instead of waiting for the hourly run. The import Worker does it, since it
 * holds our XPeng credentials; see xpeng/update.ts for the limits.
 *
 * XPeng needs minutes to build a file, so the answer is often `exporting`:
 * the app asks again until it says `imported`.
 */

import type { RequestHandler } from './$types';
import { importService, xpengImport } from '#lib/server/context.js';
import { fail, json } from '#lib/server/response.js';

export const POST: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Automatic import is managed from the app.');
	const service = importService(event);
	if (!xpengImport(event) || !service) {
		return fail(503, 'Automatic import is not set up on this server.');
	}

	// `wait` is the rate limit, answered as data: the card shows when to try again.
	return json(await service.update(auth.user.id));
};
