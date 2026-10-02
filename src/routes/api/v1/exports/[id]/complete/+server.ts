/**
 * Finishes an upload.
 *
 * The bucket is listed and compared with what the record said it would hold.
 * An export is only listed once that agrees, and the account is then charged
 * the bucket's exact sum. See exports/upload.ts.
 */

import type { RequestHandler } from './$types';
import type { ExportSummary } from '$lib/data/analytics/summary';
import { completeUpload } from '$lib/server/exports/upload';
import { getExportRow } from '$lib/server/exports/repo';
import { detectCandidates } from '$lib/server/leaderboard/repo';
import { all, type Db } from '$lib/server/db';
import { requireDb, requireStorage } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

export const POST: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Uploads come from the app, not from a token.');

	const db = requireDb(event);
	const done = await completeUpload(db, requireStorage(event), auth.user.id, event.params.id);
	if (!done.ok) {
		if (done.missing) {
			return json({ ok: false, missing: done.missing, error: done.error }, { status: 409 });
		}
		return fail(done.status, done.error);
	}

	// Only now, with the whole export in place: a candidate found against an
	// upload that never finished would point at trips that are about to be
	// swept away with it.
	const candidates = await lookForPlaces(db, auth.user.id, event.params.id);

	return json({ ok: true, blobs: done.blobs, candidates });
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
