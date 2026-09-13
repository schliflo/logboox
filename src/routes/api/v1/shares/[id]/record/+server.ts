/**
 * The record behind a shared export, with the owner taken out of it.
 *
 * A kept export's record carries the vehicle identification number on it —
 * that is what the app masks everywhere it is shown. A link that travels is
 * the last place it belongs, so the public copy carries a masked stand-in and
 * the reader's browser never sees the real one. Everything else in the record
 * describes bytes, not people.
 */

import type { RequestHandler } from './$types';
import type { ExportRecord } from '$lib/history/codec';
import { getShare } from '$lib/server/shares/repo';
import { getRecord } from '$lib/server/exports/repo';
import { requireDb } from '$lib/server/context';
import { fail } from '$lib/server/response';

/** Same shape as a VIN, so nothing downstream has to special-case it. */
const REDACTED_VIN = 'SHARED00000000000';

export const GET: RequestHandler = async (event) => {
	const db = requireDb(event);
	const share = await getShare(db, event.params.id);
	if (!share || share.kind !== 'export' || !share.export_id || !share.owner_user_id) {
		return fail(404, 'That link is no longer available.');
	}

	const record = await getRecord(db, share.owner_user_id, share.export_id);
	if (!record) return fail(404, 'That link is no longer available.');

	const published: ExportRecord = { ...record, vin: REDACTED_VIN, isDemo: false };

	return new Response(JSON.stringify(published), {
		headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' }
	});
};
