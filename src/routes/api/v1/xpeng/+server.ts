/**
 * Automatic import: the owner's Open Platform credentials and where fetching
 * and importing stand. The import Worker (import/) does the work; see
 * docs/auto-import.md.
 *
 * Session only. The access token is never sent back: once saved it can be
 * replaced or removed, not read.
 */

import type { RequestHandler } from './$types';
import { MANUAL_EVERY, deleteLink, findLink, saveLink } from '#lib/server/xpeng/fetch.js';
import { isValidTimeZone } from '#lib/leaderboard/periods.js';
import { importService, requireDb, requireStorage, xpengImport } from '#lib/server/context.js';
import { fail, json, readJson } from '#lib/server/response.js';

/** What the owner is told to type in the Data Center, and what the form starts with. */
const ENTERPRISE_NAME = 'LogbooX';

export const GET: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Automatic import is managed from the app.');

	const db = requireDb(event);
	const link = await findLink(db, auth.user.id);

	return json({
		available: xpengImport(event),
		updatable: importService(event) !== null,
		enterpriseName: ENTERPRISE_NAME,
		link: link && {
			state: link.state,
			enterpriseName: link.enterprise_name,
			createdAt: link.created_at,
			nextAt: link.next_at,
			fetchedAt: link.fetched_at,
			importedTo: link.imported_to,
			message: link.message,
			// When "Update now" may next ask XPeng for a new export.
			updateAfter: link.state === 'exporting' ? null : (link.submitted_at ?? 0) + MANUAL_EVERY
		}
	});
};

export const PUT: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Automatic import is managed from the app.');
	if (!xpengImport(event)) return fail(503, 'Automatic import is not set up on this server.');

	const body = await readJson<Record<string, unknown>>(event.request);
	const field = (key: string) =>
		typeof body?.[key] === 'string' ? (body[key] as string).trim() : '';
	const fields = {
		openId: field('openId'),
		accessToken: field('accessToken'),
		scopeCode: field('scopeCode'),
		// Not trimmed: XPeng compares it byte for byte with what the owner typed.
		enterpriseName: typeof body?.enterpriseName === 'string' ? body.enterpriseName : ENTERPRISE_NAME
	};
	if (Object.values(fields).some((value) => !value)) {
		return fail(400, 'openId, accessToken, scopeCode and the enterprise name are all needed.');
	}
	if (Object.values(fields).some((value) => value.length > 2048)) {
		return fail(400, 'One of those values is far longer than XPeng issues.');
	}
	// Which day a drive belongs to; only the browser knows the owner's zone.
	const owner = { ...fields, timeZone: isValidTimeZone(body?.timeZone) ? body.timeZone : null };

	await saveLink(requireDb(event), auth.user.id, owner);
	return json({ ok: true });
};

/** Stops fetching and drops a ZIP not imported yet. What was imported stays, as any other export does. */
export const DELETE: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Automatic import is managed from the app.');

	await deleteLink(requireDb(event), requireStorage(event), auth.user.id);
	return json({ ok: true });
};
