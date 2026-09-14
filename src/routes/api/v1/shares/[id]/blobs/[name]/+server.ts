/**
 * The samples behind a public link.
 *
 * PUT is the owner uploading a slice right after making the link; GET is
 * anyone at all reading it. A whole-export share stores nothing of its own and
 * reads the owner's objects instead, which is why the key depends on the kind.
 */

import type { RequestHandler } from './$types';
import { getShare } from '$lib/server/shares/repo';
import { blobKey, isSafeBlobName, shareBlobKey } from '$lib/server/exports/r2';
import { MAX_BLOB_BYTES } from '$lib/server/exports/limits';
import { requireDb, requireStorage } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

export const PUT: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Links are made from the app.');

	const { id, name } = event.params;
	if (!isSafeBlobName(name)) return fail(400, 'Not a usable name.');

	const share = await getShare(requireDb(event), id);
	if (!share || share.user_id !== auth.user.id) return fail(404, 'That link is not one of yours.');
	if (share.kind === 'export') return fail(400, 'A shared export reads its own buffers.');

	const body = await event.request.arrayBuffer();
	if (body.byteLength === 0 || body.byteLength > MAX_BLOB_BYTES) {
		return fail(400, 'That buffer is not a plausible size.');
	}

	await requireStorage(event).put(shareBlobKey(id, name), body);
	return json({ ok: true });
};

export const GET: RequestHandler = async (event) => {
	const { id, name } = event.params;
	if (!isSafeBlobName(name)) return fail(400, 'Not a usable name.');

	const share = await getShare(requireDb(event), id);
	if (!share) return fail(404, 'That link is no longer available.');

	const key =
		share.kind === 'export' && share.export_id && share.owner_user_id
			? blobKey(share.owner_user_id, share.export_id, name)
			: shareBlobKey(id, name);

	const object = await requireStorage(event).get(key);
	if (!object) return fail(404, 'That part of the share is missing.');

	return new Response(object.body, {
		headers: {
			'content-type': 'application/octet-stream',
			'content-length': String(object.size),
			etag: object.httpEtag,
			'cache-control': 'public, max-age=300'
		}
	});
};
