/**
 * Every car the account knows about, and the last thing it knew.
 *
 * This is the endpoint a home automation system polls: one request, one object
 * per car, no pagination and nothing to walk. It answers from what the browser
 * uploaded, so it is as fresh as the newest export — which for an XPeng is a
 * matter of weeks, not seconds. Said plainly here so nobody builds a live
 * dashboard on it by mistake.
 */

import type { RequestHandler } from './$types';
import { listVehicles, vehicleTotals } from '#lib/server/exports/vehicles.js';
import { requireDb } from '#lib/server/context.js';
import { fail, json } from '#lib/server/response.js';

export const GET: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');

	const db = requireDb(event);
	const [rows, totals] = await Promise.all([
		listVehicles(db, auth.user.id),
		vehicleTotals(db, auth.user.id)
	]);

	const vehicles = rows.map((row) => {
		const counts = totals.get(row.vin) ?? { exports: 0, trips: 0, charging: 0, from: 0, to: 0 };
		return {
			vin: row.vin,
			model: row.vmodel,
			state: {
				asOf: row.last_sample_time,
				odometerKm: row.odometer_km,
				soc: row.soc,
				rangeKm: row.range_km
			},
			coverage: { from: counts.from, to: counts.to, exports: counts.exports },
			counts: { trips: counts.trips, chargingSessions: counts.charging }
		};
	});

	return json({ vehicles });
};
