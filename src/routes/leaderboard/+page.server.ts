/**
 * The boards, meaning this month's.
 *
 * A redirect rather than a copy of the page, so there is one address per
 * period and the one people share carries the month they were looking at.
 */

import { redirect } from '@sveltejs/kit';
import { currentMonth } from '$lib/leaderboard/periods';

export const prerender = false;
export const ssr = true;

export function load() {
	// The Worker's own zone is UTC, which is as good a choice as any for
	// deciding whose month "now" is when nobody has said.
	redirect(307, `/leaderboard/${currentMonth(Math.floor(Date.now() / 1000), 'UTC')}`);
}
