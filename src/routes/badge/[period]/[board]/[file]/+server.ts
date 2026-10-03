/**
 * The badge a winner embeds: `/badge/2026-09/peak-charge/flo.png`, or `flo@2x.png`.
 *
 * Drawn on request from the same rows as the board and kept in the colo's Cache
 * API, as the leaderboard card is. Five minutes and no longer, on purpose: a
 * withdrawn place or a deleted account has to leave a badge as fast as it
 * leaves the board. Anything that is not a settled top-three place is a 404,
 * cached the same way so a hot-linked dead badge costs little.
 *
 * Whatever case the address came in, the picture draws the stored name, and the
 * cache is keyed on the folded one — otherwise every spelling of a name would
 * be a render of its own. Cross-origin by design: forums embed it.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { boardById } from '#lib/leaderboard/boards.js';
import { badgePath } from '#lib/leaderboard/medals.js';
import { parsePeriod } from '#lib/leaderboard/periods.js';
import { monthMedal, yearMedal } from '#lib/server/leaderboard/repo.js';
import { afterResponse, edgeCache, maybeDb } from '#lib/server/context.js';
import { now as currentTime } from '#lib/server/db.js';
import { badgeSvg } from '#lib/server/og/badge.js';
import { renderPng } from '#lib/server/og/rasterize.js';

export const prerender = false;

const MAX_AGE = 300;

const FILE = /^([a-z0-9][a-z0-9_-]{2,23})(@2x)?\.png$/i;

const EMBEDDABLE = {
	'cross-origin-resource-policy': 'cross-origin',
	'access-control-allow-origin': '*'
};

function missing(): Response {
	return new Response('No such badge.', {
		status: 404,
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': `public, max-age=${MAX_AGE}`,
			...EMBEDDABLE
		}
	});
}

export const GET: RequestHandler = async (event) => {
	const period = parsePeriod(event.params.period);
	const board = boardById(event.params.board);
	const file = FILE.exec(event.params.file);
	if (!period || !board || !file) error(404, 'No such badge.');

	// Keyed on the badge rather than the request, so neither a query string nor
	// another spelling of the name can mint a render per guess.
	const cache = edgeCache();
	const scale = file[2] ? 2 : 1;
	const key = `${event.url.origin}${badgePath(event.params.period, board.id, file[1].toLowerCase(), scale)}`;
	// The cache speaks the Workers types, the handler the DOM ones; the casts
	// below bridge the two and nothing else.
	const cached = (await cache?.match(key)) as unknown as Response | undefined;
	// A copy, because the hook sets headers on whatever it gets back.
	if (cached) return new Response(cached.body, cached);

	const db = maybeDb(event);
	if (!db) error(503, 'The boards live at logboox.app.');

	const now = currentTime();
	const medal =
		period.kind === 'month'
			? await monthMedal(db, period.month, board.id, file[1], now)
			: await yearMedal(db, period.year, board.id, file[1], now);
	if (!medal) {
		const response = missing();
		if (cache) afterResponse(cache.put(key, response.clone() as never));
		return response;
	}

	const png = await renderPng(
		badgeSvg({
			username: medal.username,
			medal: medal.medal,
			board,
			value: medal.value,
			period: event.params.period
		}),
		scale
	);

	const response = new Response(png, {
		headers: {
			'content-type': 'image/png',
			'cache-control': `public, max-age=${MAX_AGE}`,
			'content-length': String(png.byteLength),
			...EMBEDDABLE
		}
	});

	if (cache) afterResponse(cache.put(key, response.clone() as never));
	return response;
};
