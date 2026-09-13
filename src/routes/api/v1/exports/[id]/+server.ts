/**
 * One export in the account.
 *
 * PUT opens an upload — the record and the derived summary — and the buffers
 * follow one at a time. Nothing is listed until it is marked complete, so an
 * upload that stops halfway is invisible rather than broken, and repeating it
 * replaces what was there.
 */

import type { RequestHandler } from './$types';
import type { ExportRecord } from '$lib/history/codec';
import type { ExportSummary } from '$lib/data/analytics/summary';
import {
	Invalid,
	QuotaExceeded,
	beginExport,
	checkRecord,
	deleteExport,
	getExportRow
} from '$lib/server/exports/repo';
import { deletePrefix, exportPrefix, isSafeBlobName } from '$lib/server/exports/r2';
import { maybeStorage, requireDb } from '$lib/server/context';
import { isValidTimeZone } from '$lib/leaderboard/periods';
import { fail, json, readJson } from '$lib/server/response';

export const PUT: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Uploads come from the app, not from a token.');

	const id = event.params.id;
	if (!isSafeBlobName(id)) return fail(400, 'That is not a usable export identifier.');

	const body = await readJson<{
		record?: unknown;
		summary?: ExportSummary;
		isDemo?: boolean;
		timeZone?: unknown;
	}>(event.request);
	if (!body?.record || !body.summary) return fail(400, 'Expected a record and a summary.');

	// Which month a drive belongs to depends on where it was driven, and only
	// the browser knows that. Anything unrecognised is simply not stored.
	const timeZone = isValidTimeZone(body.timeZone) ? body.timeZone : null;

	try {
		checkRecord(body.record, id);
		await beginExport(
			requireDb(event),
			auth.user.id,
			id,
			body.record as ExportRecord,
			body.summary,
			body.isDemo === true,
			timeZone
		);
	} catch (error) {
		if (error instanceof Invalid) return fail(400, error.message);
		if (error instanceof QuotaExceeded) return fail(413, error.message);
		throw error;
	}

	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Exports can only be removed from the app.');

	const db = requireDb(event);
	const row = await getExportRow(db, auth.user.id, event.params.id);
	if (!row) return fail(404, 'That export is not in your account.');

	// Rows first: an object with nothing pointing at it is unreachable and gets
	// swept up, whereas a row pointing at bytes that are gone would break the
	// library for a reader who is looking at it right now.
	await deleteExport(db, auth.user.id, row.id);
	const storage = maybeStorage(event);
	if (storage) await deletePrefix(storage, exportPrefix(auth.user.id, row.id));

	return json({ ok: true });
};
