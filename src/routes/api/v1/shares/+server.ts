/**
 * Making a link, and listing the ones already made.
 *
 * A trip or a charging session carries its own samples, uploaded straight
 * after this call returns an id. A whole export carries nothing: it points at
 * the objects the owner already has, so sharing a month costs no storage at
 * all.
 */

import type { RequestHandler } from './$types';
import {
	MAX_SHARES_PER_USER,
	countShares,
	createShare,
	listShares,
	type ShareKind
} from '$lib/server/shares/repo';
import { getExportRow } from '$lib/server/exports/repo';
import { requireDb, siteUrl } from '$lib/server/context';
import { fail, json, readJson } from '$lib/server/response';

const KINDS: ShareKind[] = ['trip', 'charging', 'export'];

export const GET: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');

	const rows = await listShares(requireDb(event), auth.user.id);

	return json({
		shares: rows.map((row) => ({
			id: row.id,
			url: `${siteUrl(event)}/s/${row.id}`,
			kind: row.kind,
			title: row.title,
			startTime: row.start_time,
			endTime: row.end_time,
			createdAt: row.created_at,
			views: row.views
		}))
	});
};

export const POST: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Links are made from the app.');

	const body = await readJson<{
		kind?: unknown;
		vmodel?: unknown;
		title?: unknown;
		description?: unknown;
		startTime?: unknown;
		endTime?: unknown;
		timeZone?: unknown;
		exportId?: unknown;
		meta?: unknown;
	}>(event.request);

	if (!body || !KINDS.includes(body.kind as ShareKind)) return fail(400, 'Not a kind of share.');
	if (typeof body.startTime !== 'number' || typeof body.endTime !== 'number') {
		return fail(400, 'A share has to say what period it covers.');
	}

	const db = requireDb(event);
	if ((await countShares(db, auth.user.id)) >= MAX_SHARES_PER_USER) {
		return fail(409, 'That is as many links as one account can have. Revoke one first.');
	}

	// A whole-export share reads the owner's own objects, so it only works for
	// an export that is actually there and finished uploading.
	if (body.kind === 'export') {
		const row = await getExportRow(db, auth.user.id, String(body.exportId ?? ''));
		if (!row || row.complete !== 1) return fail(404, 'That export is not in your account.');
	}

	const share = await createShare(db, auth.user.id, {
		kind: body.kind as ShareKind,
		vmodel: typeof body.vmodel === 'string' ? body.vmodel : '',
		title: typeof body.title === 'string' ? body.title : undefined,
		description: typeof body.description === 'string' ? body.description : undefined,
		startTime: Math.floor(body.startTime),
		endTime: Math.floor(body.endTime),
		timeZone: typeof body.timeZone === 'string' ? body.timeZone : 'UTC',
		exportId: body.kind === 'export' ? String(body.exportId) : undefined,
		meta: body.meta ?? {}
	});

	return json({ id: share.id, url: `${siteUrl(event)}/s/${share.id}` });
};
