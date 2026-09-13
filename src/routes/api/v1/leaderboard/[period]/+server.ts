/**
 * A month, or a year, as anyone may read it.
 *
 * Public, and therefore built by hand rather than through `json()`, which
 * marks everything private. What is returned is assembled from a whitelist:
 * a name somebody chose, a model, a number and the figures beside it. The
 * vehicle and the moment it happened stay in the database.
 */

import type { RequestHandler } from './$types';
import { BOARDS, TOP_N } from '$lib/leaderboard/boards';
import { isMonthOpen, isYearFinal, locksAt, parsePeriod } from '$lib/leaderboard/periods';
import { monthBoards, yearBoards } from '$lib/server/leaderboard/repo';
import { maybeDb } from '$lib/server/context';
import { fail } from '$lib/server/response';

/**
 * Long enough to be worth a cache and short enough that withdrawing a place
 * takes effect while the person who withdrew it is still watching.
 */
const CACHE_SECONDS = 300;

function publish(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		headers: {
			'content-type': 'application/json',
			'cache-control': `public, max-age=${CACHE_SECONDS}`
		}
	});
}

export const GET: RequestHandler = async (event) => {
	const period = parsePeriod(event.params.period);
	if (!period) return fail(404, 'That is not a month or a year.');

	const db = maybeDb(event);
	if (!db) return fail(503, 'The boards live at logboox.app.');

	// Signed in, the reader's own rows are marked so the page can point them
	// out. Signing in changes nothing else about what is returned.
	const viewer = event.locals.auth?.user.id;
	const now = Math.floor(Date.now() / 1000);

	const meta = {
		boards: BOARDS.map((board) => ({
			id: board.id,
			label: board.label,
			blurb: board.blurb,
			unit: board.unit,
			digits: board.digits,
			lowerIsBetter: board.lowerIsBetter
		})),
		places: TOP_N
	};

	if (period.kind === 'month') {
		return publish({
			kind: 'month',
			period: period.month,
			open: isMonthOpen(period.month, now),
			locksAt: locksAt(period.month),
			...meta,
			listings: await monthBoards(db, period.month, viewer)
		});
	}

	return publish({
		kind: 'year',
		period: String(period.year),
		open: !isYearFinal(period.year, now),
		locksAt: locksAt(`${period.year}-12`),
		...meta,
		year: await yearBoards(db, period.year, viewer)
	});
};
