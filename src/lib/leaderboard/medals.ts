/**
 * Medals, and the badges that show them.
 *
 * A medal is the top three of a board once it has stopped moving: a month after
 * it locks, a year after its last month has. Nothing is stored for one — it is
 * read off the same rows the board is, so a place taken down takes its badge
 * with it and a changed name changes the badge.
 *
 * A badge is the picture of a medal, public at an address anyone can embed.
 * The address carries the name rather than an id, so it says what it is when
 * pasted into a forum; the price is that renaming moves it.
 */

import { boardById, type BoardId } from './boards';
import { monthLabel, parsePeriod } from './periods';

export type Medal = 'gold' | 'silver' | 'bronze';

export const MEDALS: Medal[] = ['gold', 'silver', 'bronze'];

/** The medal a rank earns, or none. Tied ranks share one, as on the board. */
export function medalFor(rank: number): Medal | null {
	return Number.isInteger(rank) ? (MEDALS[rank - 1] ?? null) : null;
}

/** How each metal is drawn, on the page and on the badge alike. */
export interface Metal {
	name: string;
	light: string;
	dark: string;
	/** The ring, a shade past `dark`. */
	rim: string;
	/** The icon, dark enough to read on this metal. */
	ink: string;
}

export const METALS: Record<Medal, Metal> = {
	gold: { name: 'Gold', light: '#f5c84c', dark: '#b8860b', rim: '#fbe38e', ink: '#4a3200' },
	silver: { name: 'Silver', light: '#e8e8ea', dark: '#8d9096', rim: '#f6f6f7', ink: '#2c2e33' },
	bronze: { name: 'Bronze', light: '#e0a070', dark: '#8c5a2b', rim: '#f0c4a0', ink: '#3d2210' }
};

/** The boards in the order the page offers them, in groups a reader would look for. */
export const BOARD_GROUPS: Array<{ label: string; boards: BoardId[] }> = [
	{ label: 'Driving', boards: ['longest-drive', 'monthly-distance'] },
	{ label: 'Efficiency', boards: ['efficient-drive', 'best-regen'] },
	{ label: 'Charging', boards: ['peak-charge', 'biggest-charge'] },
	{ label: 'Handling', boards: ['hardest-launch', 'most-grip'] }
];

/** The size a badge is drawn for. The `@2x` file is twice this in pixels. */
export const BADGE_WIDTH = 560;
export const BADGE_HEIGHT = 160;

/** A medal the signed-in account holds, as `/api/v1/me` lists it. */
export interface OwnBadge {
	/** `YYYY-MM` or `YYYY`. */
	period: string;
	board: BoardId;
	medal: Medal;
	rank: number;
	value: number;
}

/** Where a badge is served. Relative, so the caller decides the origin. */
export function badgePath(period: string, board: string, username: string, scale: 1 | 2 = 1) {
	return `/badge/${period}/${board}/${encodeURIComponent(username)}${scale === 2 ? '@2x' : ''}.png`;
}

/** `September 2026` for a month, `2026` for a year. */
export function periodLabel(period: string): string {
	const parsed = parsePeriod(period);
	if (!parsed) return period;
	return parsed.kind === 'month' ? monthLabel(parsed.month) : String(parsed.year);
}

/** What a badge says, for readers who never see the picture. */
export function badgeAlt(badge: Pick<OwnBadge, 'period' | 'board' | 'medal'>, username: string) {
	const board = boardById(badge.board)?.label ?? badge.board;
	const medal = badge.medal[0].toUpperCase() + badge.medal.slice(1);
	return `${username} — ${medal}, ${board}, ${periodLabel(badge.period)} · LogbooX`;
}

export interface BadgeEmbeds {
	/** The picture itself, at its drawn size. */
	url: string;
	/** Discourse's own Markdown, which takes a display size after a bar. */
	discourse: string;
	markdown: string;
	html: string;
	bbcode: string;
}

/**
 * The snippets somebody pastes into a forum, each linking back to the board.
 *
 * Where the format can state a display size the sharp file is used; where it
 * cannot, the plain one, because a badge twice its size is worse than a soft one.
 */
export function badgeEmbeds(
	origin: string,
	badge: Pick<OwnBadge, 'period' | 'board' | 'medal'>,
	username: string
): BadgeEmbeds {
	const url = `${origin}${badgePath(badge.period, badge.board, username)}`;
	const sharp = `${origin}${badgePath(badge.period, badge.board, username, 2)}`;
	const link = `${origin}/leaderboard/${badge.period}`;
	const alt = badgeAlt(badge, username);
	const size = `${BADGE_WIDTH}x${BADGE_HEIGHT}`;

	return {
		url,
		discourse: `[![${alt}|${size}](${sharp})](${link})`,
		markdown: `[![${alt}](${url})](${link})`,
		// A name is letters, digits, hyphens and underscores; a board label is ours
		// and may one day hold an ampersand.
		html: `<a href="${link}"><img src="${sharp}" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" alt="${alt.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></a>`,
		bbcode: `[url=${link}][img]${url}[/img][/url]`
	};
}
