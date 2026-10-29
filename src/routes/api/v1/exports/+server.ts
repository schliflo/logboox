/** What this account is keeping. Summaries only; the buffers are asked for by name. */

import type { RequestHandler } from './$types';
import { listExports } from '#lib/server/exports/repo.js';
import { requireDb } from '#lib/server/context.js';
import { foldedIds } from '#lib/server/timeline/blocks.js';
import { fail, json } from '#lib/server/response.js';

export const GET: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');

	const db = requireDb(event);
	const rows = await listExports(db, auth.user.id);

	return json({
		exports: rows.map((row) => ({
			id: row.id,
			vin: row.vin,
			vmodel: row.vmodel,
			version: row.version,
			startTime: row.start_time,
			endTime: row.end_time,
			rows: row.rows,
			days: row.days,
			distanceKm: row.distance_km,
			trips: row.trips,
			storedBytes: row.stored_bytes,
			isDemo: row.is_demo === 1,
			uploadedAt: row.uploaded_at
		})),
		// Uploads merged into the timeline and removed: a browser holding one can let it go.
		folded: await foldedIds(db, auth.user.id)
	});
};
