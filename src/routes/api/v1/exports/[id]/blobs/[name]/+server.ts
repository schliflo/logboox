/**
 * One compressed signal.
 *
 * These are the bytes the browser already keeps: a gzip member per column plus
 * one for the timeline. They pass through untouched in both directions — the
 * server never inflates a buffer, and would not have the memory to if it tried.
 *
 * `Content-Encoding` is deliberately not set on the way out. These are gzip
 * *data*, not a gzip-encoded response: letting the browser transparently
 * inflate them would hand the page something it then could not store.
 */

import type { RequestHandler } from './$types';
import { blobKey, isSafeBlobName } from '$lib/server/exports/r2';
import { MAX_BLOB_BYTES } from '$lib/server/exports/limits';
import { storeBlob } from '$lib/server/exports/upload';
import { requireDb, requireStorage } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

/**
 * Stores one buffer of an upload in progress, charged to the account before
 * it is written. A finished export takes none: remove it to replace it.
 */
export const PUT: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Uploads come from the app, not from a token.');

	const { id, name } = event.params;
	if (!isSafeBlobName(id) || !isSafeBlobName(name)) return fail(400, 'Not a usable name.');

	// Refused before the body is read, so a size has to be declared up front.
	const length = event.request.headers.get('content-length');
	if (length === null) return fail(411, 'Say how large the buffer is before sending it.');
	const declared = Number(length);
	if (length.trim() === '' || !Number.isInteger(declared) || declared < 0) {
		return fail(400, 'That buffer size is not a number.');
	}
	if (declared > MAX_BLOB_BYTES) {
		return fail(413, 'That buffer is larger than any signal should be.');
	}

	const stored = await storeBlob(
		requireDb(event),
		requireStorage(event),
		auth.user.id,
		id,
		name,
		await event.request.arrayBuffer()
	);
	if (!stored.ok) return fail(stored.status, stored.error);
	return json({ ok: true, bytes: stored.bytes });
};

export const GET: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');

	const { id, name } = event.params;
	if (!isSafeBlobName(id) || !isSafeBlobName(name)) return fail(400, 'Not a usable name.');

	const object = await requireStorage(event).get(blobKey(auth.user.id, id, name));
	if (!object) return fail(404, 'That buffer is not in your account.');

	return new Response(object.body, {
		headers: {
			'content-type': 'application/octet-stream',
			'content-length': String(object.size),
			'cache-control': 'private, no-store',
			etag: object.httpEtag
		}
	});
};
