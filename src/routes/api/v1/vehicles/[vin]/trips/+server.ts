/**
 * Trips for one car, newest first.
 *
 * Keyed and ordered by start time, which is also how they are identified: an
 * export re-imported or merged with another produces the same trips at the
 * same times, while their position in any list does not survive either.
 */

import type { RequestHandler } from './$types';
import { getVehicle, listTrips, readWindow } from '$lib/server/exports/vehicles';
import { requireDb } from '$lib/server/context';
import { fail, json } from '$lib/server/response';

export const GET: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');

	const db = requireDb(event);
	const vin = event.params.vin;
	if (!(await getVehicle(db, auth.user.id, vin))) {
		return fail(404, 'No car with that identifier is in your account.');
	}

	const window = readWindow(event.url);
	const trips = await listTrips(db, auth.user.id, vin, window);

	return json({ vin, trips, limit: window.limit });
};
