/**
 * The card a leaderboard link previews as.
 *
 * Unlike a share, a month is not finished: places are claimed all through it,
 * and a card pasted into a chat on the 3rd should not still be showing the 1st.
 * So nothing is stored — the card is drawn from one query and handed out with
 * ten minutes of cache, which the platform's edge cache honours because the
 * response is `public` and the URL carries no query string. Ten minutes is
 * short enough that the board is recognisably current and long enough that a
 * popular link costs one render rather than thousands.
 *
 * `json()` from `$lib/server/response` is deliberately not used here: it forces
 * `private, no-store`, which is right for everything else on this server and
 * exactly wrong for a picture meant to be cached by strangers.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BOARDS, boardById, formatValue } from '$lib/leaderboard/boards';
import { isMonthOpen, locksAt, monthLabel, parsePeriod } from '$lib/leaderboard/periods';
import { monthBoards, yearBoards } from '$lib/server/leaderboard/repo';
import { maybeDb } from '$lib/server/context';
import { boardCard, type Tile } from '$lib/server/og/card';
import { renderPng } from '$lib/server/og/rasterize';

export const prerender = false;

/** Long enough to absorb a link being passed around, short enough to be true. */
const MAX_AGE = 600;

function settled(date: number): string {
	return new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		timeZone: 'UTC'
	}).format(new Date(date * 1000));
}

export const GET: RequestHandler = async (event) => {
	const period = parsePeriod(event.params.period);
	if (!period) error(404, 'That is not a month or a year.');

	const db = maybeDb(event);
	if (!db) error(503, 'The boards live at logboox.app.');

	const now = Math.floor(Date.now() / 1000);
	let title: string;
	let badge: string;
	const tiles: Tile[] = [];

	if (period.kind === 'month') {
		title = monthLabel(period.month);
		badge = isMonthOpen(period.month, now)
			? `Open · settles ${settled(locksAt(period.month))}`
			: 'Settled';

		const listings = new Map(
			(await monthBoards(db, period.month)).map((listing) => [listing.board, listing.entries])
		);
		// In the order the page shows them, so the card is a crop of the page
		// rather than a different arrangement of the same six facts.
		for (const board of BOARDS) {
			const first = listings.get(board.id)?.[0];
			if (!first) continue;
			tiles.push({
				board: board.label,
				name: first.username,
				value: `${formatValue(board, first.value)} ${board.unit}`.trim()
			});
		}
	} else {
		title = `${period.year} in review`;
		badge = `${period.year} roundup`;

		const summary = await yearBoards(db, period.year);
		for (const year of summary.boards) {
			const first = year.entries[0];
			const board = boardById(year.board);
			if (!first || !board) continue;
			tiles.push({
				board: board.label,
				name: first.username,
				value: `${formatValue(board, first.value)} ${board.unit}`.trim()
			});
		}
	}

	const png = await renderPng(boardCard({ title, badge, tiles }));

	return new Response(png, {
		headers: {
			'content-type': 'image/png',
			'cache-control': `public, max-age=${MAX_AGE}`,
			'content-length': String(png.byteLength)
		}
	});
};
