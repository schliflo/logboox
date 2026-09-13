/**
 * Taking a place on a board.
 *
 * The one call in this feature that publishes anything. Everything before it —
 * noticing, listing, mailing — is private to the account it belongs to.
 */

import type { RequestHandler } from './$types';
import { ClaimRefused, claim } from '$lib/server/leaderboard/repo';
import { requireDb } from '$lib/server/context';
import { fail, json, readJson } from '$lib/server/response';

const STATUS: Record<string, number> = {
	gone: 404,
	closed: 409,
	'username-required': 409,
	share: 400,
	outranked: 409
};

export const POST: RequestHandler = async (event) => {
	const auth = event.locals.auth;
	if (!auth) return fail(401, 'Not signed in.');
	if (auth.via !== 'session') return fail(403, 'Places are claimed from the app.');

	const body = await readJson<{ candidateId?: unknown; shareId?: unknown }>(event.request);
	const candidateId = typeof body?.candidateId === 'string' ? body.candidateId : '';
	if (!candidateId) return fail(400, 'Expected the place being claimed.');
	const shareId = typeof body?.shareId === 'string' && body.shareId ? body.shareId : null;

	try {
		const { entry, rank } = await claim(requireDb(event), auth.user.id, candidateId, shareId);
		return json({
			entry: {
				id: entry.id,
				board: entry.board,
				month: entry.month,
				value: entry.value,
				shareId: entry.share_id,
				claimedAt: entry.claimed_at
			},
			rank
		});
	} catch (error) {
		if (error instanceof ClaimRefused) {
			return json(
				{ error: error.message, reason: error.reason },
				{ status: STATUS[error.reason] ?? 409 }
			);
		}
		throw error;
	}
};
