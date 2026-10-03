/**
 * The card a leaderboard link previews as.
 *
 * Unlike a share, a month is not finished: places are claimed all through it,
 * and a card pasted into a chat on the 3rd should not still be showing the 1st.
 * So nothing is stored in the database — the card is drawn from one query and
 * kept in the colo's Cache API for five minutes. A Worker's own responses are
 * not edge-cached unless it asks, so `public` alone would still render on
 * every request. Five minutes is long enough that a popular link costs one
 * render rather than thousands, and the same for a settled month: a withdrawn
 * place or a deleted account's name has to leave the card as quickly as the
 * app promises it leaves the board.
 *
 * `json()` from `#lib/server/response.js` is deliberately not used here: it forces
 * `private, no-store`, which is right for everything else on this server and
 * exactly wrong for a picture meant to be cached by strangers.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BOARDS, boardById, formatValue } from '#lib/leaderboard/boards.js';
import { isMonthOpen, locksAt, monthLabel, parsePeriod } from '#lib/leaderboard/periods.js';
import { monthBoards, yearBoards } from '#lib/server/leaderboard/repo.js';
import { afterResponse, edgeCache, maybeDb } from '#lib/server/context.js';
import { now as currentTime } from '#lib/server/db.js';
import { boardCard, type Tile } from '#lib/server/og/card.js';
import { renderPng } from '#lib/server/og/rasterize.js';

export const prerender = false;

/** Long enough to absorb a link being passed around, short enough for a take-down. */
const MAX_AGE = 300;

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

	// Keyed on the path alone, so a query string cannot mint a render per guess.
	const cache = edgeCache();
	const key = `${event.url.origin}${event.url.pathname}`;
	// The cache speaks the Workers types, the handler the DOM ones; the casts
	// below bridge the two and nothing else.
	const cached = (await cache?.match(key)) as unknown as Response | undefined;
	// A copy, because the hook sets headers on whatever it gets back.
	if (cached) return new Response(cached.body, cached);

	const db = maybeDb(event);
	if (!db) error(503, 'The boards live at logboox.app.');

	const now = currentTime();
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

	const response = new Response(png, {
		headers: {
			'content-type': 'image/png',
			'cache-control': `public, max-age=${MAX_AGE}`,
			'content-length': String(png.byteLength)
		}
	});

	if (cache) afterResponse(cache.put(key, response.clone() as never));
	return response;
};
