/**
 * Making a link, and listing the ones already made.
 *
 * A trip or a charging session carries its own samples, uploaded straight
 * after this call returns an id. A range of the timeline (kind `export`) is
 * cut out of the owner's exports here and frozen under the link, so later
 * rewrites of the timeline leave it as it was (shares/snapshot.ts).
 */

import type { RequestHandler } from './$types';
import {
	MAX_SHARES_PER_USER,
	countShares,
	createShare,
	listShares
} from '#lib/server/shares/repo.js';
import { checkNewShare } from '#lib/server/shares/validate.js';
import { freezeShare } from '#lib/server/shares/snapshot.js';
import { withTimelineLock } from '#lib/server/timeline/blocks.js';
import { deletePrefix, sharePrefix } from '#lib/server/exports/r2.js';
import { run, type Db } from '#lib/server/db.js';
import { requireDb, requireStorage, siteUrl } from '#lib/server/context.js';
import { fail, json, readJson } from '#lib/server/response.js';

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

	const checked = checkNewShare(await readJson<Record<string, unknown>>(event.request));
	if (!checked.ok) return fail(checked.status, checked.error);
	const input = checked.value;

	const db = requireDb(event);
	if ((await countShares(db, auth.user.id)) >= MAX_SHARES_PER_USER) {
		return fail(409, 'That is as many links as one account can have. Revoke one first.');
	}

	const share = await createShare(db, auth.user.id, input);

	if (input.kind === 'export') {
		const storage = requireStorage(event);
		let frozen: boolean | null;
		try {
			frozen = await withTimelineLock(db, auth.user.id, async () => {
				await freezeShare(db, storage, auth.user.id, share.id, input.sources!, input.timeZone, {
					from: input.startTime,
					to: input.endTime
				});
				return true;
			});
		} catch (error) {
			await dropShare(db, storage, share.id);
			return fail(404, error instanceof Error ? error.message : 'That range could not be shared.');
		}
		if (!frozen) {
			await dropShare(db, storage, share.id);
			return fail(409, 'Your timeline is being updated right now. Try again in a minute.');
		}
	}

	return json({ id: share.id, url: `${siteUrl(event)}/s/${share.id}` });
};

async function dropShare(db: Db, storage: R2Bucket, id: string) {
	await deletePrefix(storage, sharePrefix(id));
	await run(db, 'DELETE FROM shares WHERE id = ?', id);
}
