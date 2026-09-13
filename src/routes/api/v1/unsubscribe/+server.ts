/**
 * Turning reminders off from a mail client.
 *
 * The link carries its own secret, because the person clicking it is very
 * unlikely to be signed in — and asking someone to sign in before they can
 * stop being e-mailed would be a poor way to treat them. That secret opens
 * this one switch and nothing else.
 */

import type { RequestHandler } from './$types';
import { findUserByUnsubscribeToken, updateSettings } from '$lib/server/auth/users';
import { requireDb } from '$lib/server/context';
import { fail, json, readJson } from '$lib/server/response';

export const POST: RequestHandler = async (event) => {
	const body = await readJson<{ token?: unknown }>(event.request);
	const token = typeof body?.token === 'string' ? body.token : '';
	if (!token) return fail(400, 'That link is incomplete.');

	const db = requireDb(event);
	const user = await findUserByUnsubscribeToken(db, token);
	if (!user) {
		return fail(
			404,
			'That link is no longer valid.',
			'A newer reminder replaces the link in an older one. Use the most recent message, or turn reminders off from your account.'
		);
	}

	await updateSettings(db, user.id, { reminderEnabled: false });
	return json({ ok: true, email: user.email });
};
