/**
 * Ends this session. The row goes with it, so the cookie is dead everywhere
 * rather than merely forgotten here.
 */

import type { RequestHandler } from './$types';
import { SESSION_COOKIE, revokeSession } from '$lib/server/auth/session';
import { maybeDb } from '$lib/server/context';
import { json } from '$lib/server/response';

export const POST: RequestHandler = async (event) => {
	const cookie = event.cookies.get(SESSION_COOKIE);
	const db = maybeDb(event);
	if (cookie && db) await revokeSession(db, cookie);
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
	return json({ ok: true });
};
