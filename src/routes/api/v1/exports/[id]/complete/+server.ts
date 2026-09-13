/**
 * Finishes an upload.
 *
 * The bucket is listed and compared with what the record said it would hold.
 * An export is only listed once that agrees, so a browser that lost its
 * connection partway through leaves something invisible and replaceable rather
 * than a library entry that cannot be opened.
 */

import type { RequestHandler } from './$types';
import { exportPrefix, listBlobNames } from '$lib/server/exports/r2';
import { expectedBlobNames, getRecord, markComplete } from '$lib/server/exports/repo';
import { requireDb, requireStorage } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

export const POST: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Uploads come from the app, not from a token.');

	const id = event.params.id;
	const record = await getRecord(requireDb(event), auth.user.id, id);
	if (!record) return fail(404, 'There is no upload in progress for that export.');

	const expected = expectedBlobNames(record);
	const present = await listBlobNames(requireStorage(event), exportPrefix(auth.user.id, id));
	const missing = [...expected].filter((name) => !present.has(name));

	if (missing.length > 0) {
		return json(
			{
				ok: false,
				missing,
				error: `${missing.length} of ${expected.size} buffers did not arrive.`
			},
			{ status: 409 }
		);
	}

	await markComplete(requireDb(event), auth.user.id, id);
	return json({ ok: true, blobs: expected.size });
};
