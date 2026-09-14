/**
 * The signed-in account: who it is, what it is keeping, and what it has asked
 * for. Also where it is deleted, which takes the bucket objects with it.
 */

import type { RequestHandler } from './$types';
import { one } from '$lib/server/db';
import { deletePrefix } from '$lib/server/exports/r2';
import { deleteUser, updateSettings } from '$lib/server/auth/users';
import { listOwn, listPending } from '$lib/server/leaderboard/repo';
import { maybeStorage, requireDb } from '$lib/server/context';
import { fail, json, readJson } from '$lib/server/response';
import { MAX_ACCOUNT_BYTES } from '$lib/server/exports/limits';

export const GET: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');

	const db = requireDb(event);
	const totals = await one<{ n: number; bytes: number | null }>(
		db,
		'SELECT COUNT(*) AS n, SUM(stored_bytes) AS bytes FROM exports WHERE user_id = ? AND complete = 1',
		auth.user.id
	);

	return json({
		user: {
			email: auth.user.email,
			createdAt: auth.user.created_at,
			autoSync: auth.user.auto_sync === 1,
			reminderEnabled: auth.user.reminder_enabled === 1,
			reminderAfterDays: auth.user.reminder_after_days,
			username: auth.user.username,
			boardNotify: auth.user.board_notify === 1
		},
		via: auth.via,
		storage: {
			exports: totals?.n ?? 0,
			usedBytes: totals?.bytes ?? 0,
			quotaBytes: MAX_ACCOUNT_BYTES
		},
		leaderboard: {
			pending: await listPending(db, auth.user.id),
			entries: await listOwn(db, auth.user.id)
		}
	});
};

export const PATCH: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Settings can only be changed from the app.');

	const body = await readJson<{
		autoSync?: unknown;
		reminderEnabled?: unknown;
		reminderAfterDays?: unknown;
		boardNotify?: unknown;
	}>(event.request);
	if (!body) return fail(400, 'Expected a JSON body.');

	try {
		await updateSettings(requireDb(event), auth.user.id, {
			autoSync: typeof body.autoSync === 'boolean' ? body.autoSync : undefined,
			reminderEnabled: typeof body.reminderEnabled === 'boolean' ? body.reminderEnabled : undefined,
			reminderAfterDays:
				typeof body.reminderAfterDays === 'number' ? body.reminderAfterDays : undefined,
			boardNotify: typeof body.boardNotify === 'boolean' ? body.boardNotify : undefined
		});
	} catch (error) {
		return fail(400, error instanceof Error ? error.message : 'That setting was not understood.');
	}

	return json({ ok: true });
};

/**
 * Deletes the account. The rows go first and the objects after: an object with
 * no row is unreachable and swept up later, whereas a row pointing at bytes
 * that are already gone would break the library for anyone still looking at it.
 */
export const DELETE: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'An account can only be deleted from the app.');

	const db = requireDb(event);
	await deleteUser(db, auth.user.id);

	const storage = maybeStorage(event);
	if (storage) await deletePrefix(storage, `users/${auth.user.id}/`);

	event.cookies.delete('lbx_session', { path: '/' });
	return json({ ok: true });
};
