/**
 * One link: what it shows, or the end of it.
 *
 * GET is public and unauthenticated — that is the entire point — and says
 * nothing about who made it. DELETE revokes it, and from that moment the page
 * and its buffers are gone for everyone.
 */

import type { RequestHandler } from './$types';
import { countView, getShare, revokeShare } from '$lib/server/shares/repo';
import { deletePrefix, sharePrefix } from '$lib/server/exports/r2';
import { maybeStorage, requireDb } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

export const GET: RequestHandler = async (event) => {
	const share = await getShare(requireDb(event), event.params.id);
	if (!share) return fail(404, 'That link is no longer available.');

	event.platform?.ctx?.waitUntil?.(countView(requireDb(event), share.id));

	return new Response(
		JSON.stringify({
			id: share.id,
			kind: share.kind,
			model: share.vmodel,
			title: share.title,
			description: share.description,
			startTime: share.start_time,
			endTime: share.end_time,
			timeZone: share.time_zone,
			meta: JSON.parse(share.meta_json),
			createdAt: share.created_at
		}),
		{
			headers: {
				'content-type': 'application/json',
				// Short, because revoking has to take effect in minutes rather
				// than whenever a shared cache feels like asking again.
				'cache-control': 'public, max-age=300'
			}
		}
	);
};

export const DELETE: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Links are managed from the app.');

	const db = requireDb(event);
	const revoked = await revokeShare(db, auth.user.id, event.params.id);
	if (!revoked) return fail(404, 'That link is not one of yours.');

	// A trip share owns its copy of the samples; an export share only points at
	// objects that belong to the export and must not take them with it.
	const storage = maybeStorage(event);
	if (storage) await deletePrefix(storage, sharePrefix(event.params.id));

	return json({ ok: true });
};
