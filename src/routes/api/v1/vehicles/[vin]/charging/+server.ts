/** Charging sessions for one car, newest first. Same window as trips. */

import type { RequestHandler } from './$types';
import { getVehicle, listCharging, readWindow } from '$lib/server/exports/vehicles';
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
	const sessions = await listCharging(db, auth.user.id, vin, window);

	return json({ vin, charging: sessions, limit: window.limit });
};
