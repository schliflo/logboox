/** Revokes one token. It stops working at once, everywhere. */

import type { RequestHandler } from './$types';
import { revokeToken } from '#lib/server/auth/apiTokens.js';
import { requireDb } from '#lib/server/context.js';
import { fail, json } from '#lib/server/response.js';

export const DELETE: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Tokens are managed from the app.');

	const revoked = await revokeToken(requireDb(event), auth.user.id, event.params.id);
	if (!revoked) return fail(404, 'That token is not one of yours, or is already revoked.');

	return json({ ok: true });
};
