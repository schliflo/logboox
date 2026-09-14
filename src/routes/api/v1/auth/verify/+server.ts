/**
 * Spends a sign-in link and opens a session.
 *
 * A POST, not the link itself: the link is a page, and only a deliberate click
 * on it reaches this. Mail clients that fetch every URL they are sent cannot
 * spend it by looking.
 */

import type { RequestHandler } from './$types';
import { consumeMagicLink } from '$lib/server/auth/magic';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, createSession } from '$lib/server/auth/session';
import { requireDb } from '$lib/server/context';
import { fail, json, readJson } from '$lib/server/response';

export const POST: RequestHandler = async (event) => {
	const body = await readJson<{ token?: unknown }>(event.request);
	const token = typeof body?.token === 'string' ? body.token : '';
	if (!token) return fail(400, 'That sign-in link is incomplete.');

	const db = requireDb(event);
	const result = await consumeMagicLink(db, token);
	if (!result) {
		return fail(
			400,
			'That sign-in link has expired or has already been used.',
			'Ask for a new one — they last fifteen minutes and work once.'
		);
	}

	const session = await createSession(db, result.user.id, event.request.headers.get('user-agent'));
	event.cookies.set(SESSION_COOKIE, session, SESSION_COOKIE_OPTIONS);

	return json({
		user: { email: result.user.email, createdAt: result.user.created_at },
		created: result.created
	});
};
