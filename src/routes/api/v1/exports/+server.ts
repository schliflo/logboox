/**
 * What this account is keeping. Summaries only; the buffers are asked for by
 * name. `?vin=&from=&to=` (epoch seconds) narrows it to the exports of one car
 * that overlap a stretch of time, e.g. the weekly blocks behind a range.
 */

import type { RequestHandler } from './$types';
import { listExports } from '#lib/server/exports/repo.js';
import { requireDb } from '#lib/server/context.js';
import { foldedIds } from '#lib/server/timeline/blocks.js';
import { fail, json } from '#lib/server/response.js';

export const GET: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');

	const db = requireDb(event);
	const params = event.url.searchParams;
	const vin = params.get('vin');
	const from = Number(params.get('from') ?? -Infinity);
	const to = Number(params.get('to') ?? Infinity);
	if (Number.isNaN(from) || Number.isNaN(to)) return fail(400, 'from and to are epoch seconds.');
	const rows = (await listExports(db, auth.user.id)).filter(
		(row) => (!vin || row.vin === vin) && row.end_time >= from && row.start_time < to
	);

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
