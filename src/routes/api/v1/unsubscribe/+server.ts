/**
 * Turning reminders off from a mail client.
 *
 * The link carries its own secret, because the person clicking it is very
 * unlikely to be signed in — and asking someone to sign in before they can
 * stop being e-mailed would be a poor way to treat them. That secret opens
 * this one switch and nothing else.
 */

import type { RequestHandler } from './$types';
import { findUserByUnsubscribeToken, updateSettings, type MailKind } from '$lib/server/auth/users';
import { requireDb } from '$lib/server/context';
import { fail, json, readJson } from '$lib/server/response';

export const POST: RequestHandler = async (event) => {
	const body = await readJson<{ token?: unknown; kind?: unknown }>(event.request);
	const token = typeof body?.token === 'string' ? body.token : '';
	if (!token) return fail(400, 'That link is incomplete.');

	// Each kind of mail carries its own token, so turning one off cannot
	// silently break the way out of the other.
	const kind: MailKind = body?.kind === 'leaderboard' ? 'leaderboard' : 'reminders';

	const db = requireDb(event);
	const user = await findUserByUnsubscribeToken(db, token, kind);
	if (!user) {
		return fail(
			404,
			'That link is no longer valid.',
			'A newer message replaces the link in an older one. Use the most recent message, or change this from your account.'
		);
	}

	await updateSettings(
		db,
		user.id,
		kind === 'leaderboard' ? { boardNotify: false } : { reminderEnabled: false }
	);
	return json({ ok: true, email: user.email, kind });
};
