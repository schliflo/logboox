/**
 * One month, or one year, rendered on the server.
 *
 * Server-rendered rather than fetched, because this is the one page in the app
 * meant to be linked to: a scoreboard that arrives empty and fills in later is
 * no use to a link preview, a search engine, or somebody on a slow connection.
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { BOARDS, TOP_N } from '$lib/leaderboard/boards';
import {
	isMonthOpen,
	isYearFinal,
	locksAt,
	monthLabel,
	nextMonth,
	parsePeriod,
	previousMonth,
	yearOf
} from '$lib/leaderboard/periods';
import { monthBoards, yearBoards } from '$lib/server/leaderboard/repo';
import { maybeDb } from '$lib/server/context';

export const prerender = false;
export const ssr = true;

export const load: PageServerLoad = async (event) => {
	const period = parsePeriod(event.params.period);
	if (!period) error(404, 'That is not a month or a year.');

	const db = maybeDb(event);
	if (!db) error(503, 'The boards live at logboox.app.');

	const viewer = event.locals.auth?.user.id;
	const now = Math.floor(Date.now() / 1000);

	const boards = BOARDS.map((board) => ({
		id: board.id,
		label: board.label,
		blurb: board.blurb,
		unit: board.unit,
		digits: board.digits,
		lowerIsBetter: board.lowerIsBetter
	}));

	if (period.kind === 'month') {
		return {
			kind: 'month' as const,
			period: period.month,
			title: monthLabel(period.month),
			open: isMonthOpen(period.month, now),
			locksAt: locksAt(period.month),
			places: TOP_N,
			boards,
			listings: await monthBoards(db, period.month, viewer),
			previous: previousMonth(period.month),
			next: nextMonth(period.month),
			year: yearOf(period.month)
		};
	}

	return {
		kind: 'year' as const,
		period: String(period.year),
		title: String(period.year),
		open: !isYearFinal(period.year, now),
		locksAt: locksAt(`${period.year}-12`),
		places: TOP_N,
		boards,
		summary: await yearBoards(db, period.year, viewer),
		previous: String(period.year - 1),
		next: String(period.year + 1)
	};
};
