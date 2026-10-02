/**
 * Turning one kind of message off from a mail client.
 *
 * The link carries its own signed token, because the person clicking it is
 * very unlikely to be signed in — and asking someone to sign in before they
 * can stop being e-mailed would be a poor way to treat them. The token opens
 * this one switch and nothing else.
 *
 * The page at `/unsubscribe` posts JSON here. There is no one-click form POST
 * (RFC 8058) on purpose: a provider's cross-origin form POST is refused by
 * SvelteKit's CSRF check before any route runs, so the mails do not advertise it.
 */

import type { RequestHandler } from './$types';
import {
	findUserByUnsubscribeToken,
	updateSettings,
	type MailKind
} from '#lib/server/auth/users.js';
import { mailSecret, requireDb } from '#lib/server/context.js';
import { fail, json, readJson } from '#lib/server/response.js';

export const POST: RequestHandler = async (event) => {
	const body = await readJson<{ token?: unknown; kind?: unknown }>(event.request);
	const token = typeof body?.token === 'string' ? body.token : '';
	if (!token) return fail(400, 'That link is incomplete.');

	// Each kind of mail is signed for separately, so turning one off cannot
	// silently reach the other.
	const kind: MailKind = body?.kind === 'leaderboard' ? 'leaderboard' : 'reminders';

	const secret = mailSecret(event);
	if (!secret) return fail(503, 'Unsubscribing is not available on this address.');

	const db = requireDb(event);
	const user = await findUserByUnsubscribeToken(db, secret, token, kind);
	if (!user) {
		return fail(
			404,
			'That link is not valid.',
			'Open it again from the message, with the whole address. You can also change this from your account.'
		);
	}

	await updateSettings(
		db,
		user.id,
		kind === 'leaderboard' ? { boardNotify: false } : { reminderEnabled: false }
	);
	return json({ ok: true, email: user.email, kind });
};
