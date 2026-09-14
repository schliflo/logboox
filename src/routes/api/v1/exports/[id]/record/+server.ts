/**
 * The stored record for one export: what it covers, and which buffers make it
 * up. Asked for on its own, because it is what tells a browser what to
 * download next — and because a library listing has no use for it.
 */

import type { RequestHandler } from './$types';
import { getExportRow, getRecord } from '$lib/server/exports/repo';
import { requireDb } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

export const GET: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');

	const db = requireDb(event);
	const row = await getExportRow(db, auth.user.id, event.params.id);
	if (!row || row.complete !== 1) return fail(404, 'That export is not in your account.');

	const record = await getRecord(db, auth.user.id, event.params.id);
	if (!record) return fail(404, 'That export is not in your account.');

	return json(record);
};
