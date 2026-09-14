/**
 * The logbook for one car.
 *
 * GET returns everything, tombstones included: a device that has been away
 * needs to learn about deletions as well as additions. PUT sends whatever
 * changed and gets the merged truth back, so one round trip settles both
 * directions.
 */

import type { RequestHandler } from './$types';
import {
	listAnnotations,
	mergeAnnotations,
	type AnnotationInput
} from '$lib/server/annotations/repo';
import { requireDb } from '$lib/server/context';
import { fail, json, readJson } from '$lib/server/response';

function present(row: {
	start_time: number;
	odo_start: number | null;
	origin: string | null;
	destination: string | null;
	purpose: string | null;
	comment: string | null;
	updated_at: number;
	deleted_at: number | null;
}) {
	return {
		startTime: row.start_time,
		odoStart: row.odo_start,
		origin: row.origin ?? '',
		destination: row.destination ?? '',
		purpose: row.purpose ?? '',
		comment: row.comment ?? '',
		updatedAt: row.updated_at,
		deletedAt: row.deleted_at
	};
}

export const GET: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');

	const rows = await listAnnotations(requireDb(event), auth.user.id, event.params.vin);
	return json({ vin: event.params.vin, entries: rows.map(present) });
};

export const PUT: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session' && !auth.scopes.includes('write')) {
		return fail(403, 'This token may only read.');
	}

	const body = await readJson<{ entries?: AnnotationInput[] }>(event.request);
	if (!Array.isArray(body?.entries)) return fail(400, 'Expected a list of entries.');

	const db = requireDb(event);
	const written = await mergeAnnotations(db, auth.user.id, event.params.vin, body.entries);
	const rows = await listAnnotations(db, auth.user.id, event.params.vin);

	return json({ vin: event.params.vin, written, entries: rows.map(present) });
};
