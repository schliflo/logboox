/**
 * A shared trip, charging session or export.
 *
 * Rendered on the server, which is the whole reason this route is not
 * prerendered like the rest of the app: a link pasted into a chat is read by a
 * scraper that runs no JavaScript, and a card saying "LogbooX" tells nobody
 * what they are being sent. The samples themselves are fetched by the browser
 * afterwards — they are hundreds of kilobytes and no crawler wants them.
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getShare } from '$lib/server/shares/repo';
import { maybeDb } from '$lib/server/context';

export const prerender = false;
export const ssr = true;

export const load: PageServerLoad = async (event) => {
	const db = maybeDb(event);
	if (!db) error(503, 'Shared links live at logboox.app.');

	const share = await getShare(db, event.params.id);
	if (!share) error(404, 'That link is no longer available.');

	return {
		share: {
			id: share.id,
			kind: share.kind,
			model: share.vmodel,
			title: share.title,
			description: share.description,
			startTime: share.start_time,
			endTime: share.end_time,
			timeZone: share.time_zone,
			meta: JSON.parse(share.meta_json) as Record<string, unknown>,
			createdAt: share.created_at
		},
		canonical: `${event.url.origin}/s/${share.id}`
	};
};
