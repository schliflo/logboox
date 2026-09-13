/**
 * Finishes an upload.
 *
 * The bucket is listed and compared with what the record said it would hold.
 * An export is only listed once that agrees, so a browser that lost its
 * connection partway through leaves something invisible and replaceable rather
 * than a library entry that cannot be opened.
 */

import type { RequestHandler } from './$types';
import type { ExportSummary } from '$lib/data/analytics/summary';
import { exportPrefix, listBlobNames } from '$lib/server/exports/r2';
import { expectedBlobNames, getExportRow, getRecord, markComplete } from '$lib/server/exports/repo';
import { detectCandidates } from '$lib/server/leaderboard/repo';
import { all, type Db } from '$lib/server/db';
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

	const db = requireDb(event);
	await markComplete(db, auth.user.id, id);

	// Only now, with the whole export in place: a candidate found against an
	// upload that never finished would point at trips that are about to be
	// swept away with it.
	const candidates = await lookForPlaces(db, auth.user.id, id);

	return json({ ok: true, blobs: expected.size, candidates });
};

/**
 * What this export would put on a board, if anything.
 *
 * Rebuilt from the rows just written rather than from the request, so it
 * describes what the account actually holds. A failure here is swallowed: the
 * upload succeeded, and a missed offer is not worth telling anyone about.
 */
async function lookForPlaces(db: Db, userId: string, exportId: string) {
	try {
		const row = await getExportRow(db, userId, exportId);
		if (!row?.time_zone || row.is_demo === 1) return [];

		const trips = await all<{ summary_json: string }>(
			db,
			'SELECT summary_json FROM trips WHERE user_id = ? AND export_id = ?',
			userId,
			exportId
		);
		const charging = await all<{ summary_json: string }>(
			db,
			'SELECT summary_json FROM charging_sessions WHERE user_id = ? AND export_id = ?',
			userId,
			exportId
		);

		const summary: ExportSummary = {
			trips: trips.map((t) => JSON.parse(t.summary_json)),
			charging: charging.map((c) => JSON.parse(c.summary_json)),
			vehicle: {
				vin: row.vin,
				vmodel: row.vmodel,
				lastSampleTime: row.end_time,
				odometerKm: null,
				soc: null,
				rangeKm: null
			}
		};

		return await detectCandidates(db, userId, summary, row.time_zone);
	} catch {
		return [];
	}
}
