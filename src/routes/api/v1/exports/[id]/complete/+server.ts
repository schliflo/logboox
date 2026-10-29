/**
 * Finishes an upload.
 *
 * The bucket is listed and compared with what the record said it would hold.
 * An export is only listed once that agrees, and the account is then charged
 * the bucket's exact sum. See exports/upload.ts.
 *
 * Then it is merged into the car's timeline (timeline/blocks.ts) and removed;
 * `blocks` names the weeks it went into, or is null when that is left to the
 * import Worker's next run.
 */

import type { RequestHandler } from './$types';
import { completeUpload } from '#lib/server/exports/upload.js';
import { candidatesForExport } from '#lib/server/leaderboard/repo.js';
import { requireDb, requireStorage } from '#lib/server/context.js';
import { foldUpload } from '#lib/server/timeline/blocks.js';
import { fail, json } from '#lib/server/response.js';

export const POST: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Uploads come from the app, not from a token.');

	const db = requireDb(event);
	const storage = requireStorage(event);
	const done = await completeUpload(db, storage, auth.user.id, event.params.id);
	if (!done.ok) {
		if (done.missing) {
			return json({ ok: false, missing: done.missing, error: done.error }, { status: 409 });
		}
		return fail(done.status, done.error);
	}

	// Only now, with the whole export in place: a candidate found against an
	// upload that never finished would point at trips that are about to be
	// swept away with it.
	const folded = await foldUpload(db, storage, auth.user.id, event.params.id);
	const candidates =
		folded?.candidates ?? (await candidatesForExport(db, auth.user.id, event.params.id));

	return json({ ok: true, blobs: done.blobs, candidates, blocks: folded?.blocks ?? null });
};
