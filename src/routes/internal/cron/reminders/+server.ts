/**
 * The daily run.
 *
 * Reminders to request the next export, messages about places waiting on a
 * board, and the tidying up that has to happen somewhere.
 *
 * Triggered by a second, tiny Worker that has a cron schedule and nothing
 * else: the Worker SvelteKit generates exports only a fetch handler, and the
 * ways around that involve the adapter overwriting a hand-written entry on
 * every build. A shared secret and one request is a smaller price.
 */

import type { RequestHandler } from './$types';
import { everySendFailed, sendReminders } from '$lib/server/reminders/run';
import { mailSecret, mailer, maybeStorage, requireDb, siteUrl } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.cron) return fail(401, 'Not the daily run.');

	// Before anything is sent: a message without a working way out is worse
	// than no message, and the run would mark everyone as mailed regardless.
	const secret = mailSecret(event);
	if (!secret) {
		console.error('MAIL_SECRET is not set, so no mail was sent.');
		return fail(500, 'MAIL_SECRET is not set.', 'Set it on the app before the next run.');
	}

	const report = await sendReminders(
		requireDb(event),
		mailer(event),
		siteUrl(event),
		secret,
		maybeStorage(event) ?? undefined
	);

	// Something was tried and nothing got through: answer so that the cron
	// Worker, which only logs a non-2xx, logs it.
	return json(report, { status: everySendFailed(report) ? 502 : 200 });
};
