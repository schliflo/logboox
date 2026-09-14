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
import { sendReminders } from '$lib/server/reminders/run';
import { mailer, maybeStorage, requireDb, siteUrl } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.cron) return fail(401, 'Not the daily run.');

	const report = await sendReminders(
		requireDb(event),
		mailer(event),
		siteUrl(event),
		maybeStorage(event) ?? undefined
	);

	return json(report);
};
