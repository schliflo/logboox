/**
 * Asks for a sign-in link.
 *
 * Always answers the same way. Whether the address has an account, was rate
 * limited, or the mail failed to leave, the reply is an identical 202: this
 * endpoint is unauthenticated, and a difference in its answers would turn it
 * into a way to ask which addresses are registered.
 */

import type { RequestHandler } from './$types';
import { InvalidEmail, RateLimited, requestMagicLink } from '$lib/server/auth/magic';
import { findUserByEmail } from '$lib/server/auth/users';
import { clientIp, mailer, maybeDb, siteUrl } from '$lib/server/context';
import { magicLinkMail } from '$lib/server/mail/templates';
import { fail, json, readJson } from '$lib/server/response';

export const POST: RequestHandler = async (event) => {
	const body = await readJson<{ email?: unknown }>(event.request);
	const email = typeof body?.email === 'string' ? body.email : '';

	const db = maybeDb(event);
	if (!db) {
		return fail(503, 'Accounts are not available on this address.', 'Use https://logboox.app.');
	}

	try {
		const existing = await findUserByEmail(db, email);
		const link = await requestMagicLink(db, email, clientIp(event));
		const url = `${siteUrl(event)}/auth/verify?token=${encodeURIComponent(link.token)}`;
		await mailer(event).send(magicLinkMail(link.email, url, existing === null));
	} catch (error) {
		// A malformed address is worth saying out loud: nothing was sent, and
		// the person is looking at the field they mistyped.
		if (error instanceof InvalidEmail) return fail(400, error.message);
		// Everything else — rate limits, a refused send — is swallowed on
		// purpose. See the note above.
		if (!(error instanceof RateLimited)) {
			console.error('sign-in link failed', error);
		}
	}

	return json({ ok: true }, { status: 202 });
};
