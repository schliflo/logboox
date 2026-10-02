/**
 * The samples behind a public link.
 *
 * PUT is the owner uploading a slice right after making the link; GET is
 * anyone at all reading it. A whole-export share stores nothing of its own and
 * reads the owner's objects instead, which is why the key depends on the kind.
 *
 * Whatever is stored here is served from this domain to anyone, so a share
 * takes a slice and nothing else: the manifest first, then only the buffers it
 * names, each one gzip, all of it small, and only in the minutes after the link
 * was made.
 */

import type { RequestHandler } from './$types';
import {
	MAX_SHARE_BLOB_BYTES,
	MAX_SHARE_MANIFEST_BYTES,
	getShare
} from '#lib/server/shares/repo.js';
import { storeShareBlob } from '#lib/server/shares/blobs.js';
import { MANIFEST_BLOB, declaredLength, readAtMost } from '#lib/server/shares/validate.js';
import { blobKey, isSafeBlobName, shareBlobKey } from '#lib/server/exports/r2.js';
import { now } from '#lib/server/db.js';
import { requireDb, requireStorage } from '#lib/server/context.js';
import { fail, json } from '#lib/server/response.js';

export const PUT: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Links are made from the app.');

	const { id, name } = event.params;
	if (!isSafeBlobName(name)) return fail(400, 'Not a usable name.');

	const db = requireDb(event);
	const share = await getShare(db, id);
	if (!share || share.user_id !== auth.user.id) return fail(404, 'That link is not one of yours.');
	if (share.kind === 'export') return fail(400, 'A shared export reads its own buffers.');

	const limit = name === MANIFEST_BLOB ? MAX_SHARE_MANIFEST_BYTES : MAX_SHARE_BLOB_BYTES;
	const declared = declaredLength(event.request.headers.get('content-length'));
	if (declared === null) return fail(411, 'Say how large the buffer is.');
	if (declared > limit) return fail(413, 'That buffer is larger than a slice should be.');

	const bytes = await readAtMost(event.request, declared);
	if (!bytes || bytes.byteLength !== declared)
		return fail(400, 'That buffer is not the size it said.');

	const stored = await storeShareBlob(db, requireStorage(event), share, name, bytes, now());
	if (!stored.ok) return fail(stored.status, stored.error);
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
