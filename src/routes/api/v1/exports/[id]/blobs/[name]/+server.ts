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
import { expectedBlobNames, getRecord } from '$lib/server/exports/repo';
import { requireDb, requireStorage } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

/** Every one of these is a gzip member, and nothing else is accepted. */
const GZIP_MAGIC = [0x1f, 0x8b];

export const PUT: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Uploads come from the app, not from a token.');

	const { id, name } = event.params;
	if (!isSafeBlobName(id) || !isSafeBlobName(name)) return fail(400, 'Not a usable name.');

	const db = requireDb(event);
	const record = await getRecord(db, auth.user.id, id);
	if (!record) return fail(409, 'Send the export record before its buffers.');
	if (!expectedBlobNames(record).has(name)) {
		return fail(400, 'That buffer is not one the record accounts for.');
	}

	const declared = Number(event.request.headers.get('content-length') ?? '0');
	if (declared > MAX_BLOB_BYTES)
		return fail(413, 'That buffer is larger than any signal should be.');

	const body = await event.request.arrayBuffer();
	if (body.byteLength === 0) return fail(400, 'That buffer is empty.');
	if (body.byteLength > MAX_BLOB_BYTES) return fail(413, 'That buffer is too large.');

	const head = new Uint8Array(body.slice(0, 2));
	if (head[0] !== GZIP_MAGIC[0] || head[1] !== GZIP_MAGIC[1]) {
		return fail(400, 'That buffer is not compressed the way this format requires.');
	}

	const storage = requireStorage(event);
	await storage.put(blobKey(auth.user.id, id, name), body);

	return json({ ok: true, bytes: body.byteLength });
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
