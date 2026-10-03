/**
 * The messages this app sends.
 *
 * Plain text first, with a plain HTML twin built from the same parts in the
 * same order: no tracking pixel, no link wrapping, and no picture
 * beyond the logo. A mail that asks to be trusted with a sign-in link should not be
 * indistinguishable from a marketing one.
 *
 * The other picture is a medal's badge, in the mails about winning one.
 * It is the public badge itself, at the address a forum would load it from —
 * which names the winner, so a client that fetches it makes a request we could
 * in principle tell apart. Nothing reads that; the privacy page says so.
 */

import type { Medal } from '#lib/leaderboard/medals.js';
import type { Message } from './mailer';

const BRAND = 'LogbooX';

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Where the site lives, for the links a message is required to carry.
 *
 * Absolute and fixed rather than taken from the request, because a mail is
 * read somewhere else entirely and a relative link would be meaningless.
 */
const SITE = 'https://logboox.app';

/** The mark beside the wordmark. The site's own icon, the same file for every reader. */
const LOGO_URL = `${SITE}/favicon-96.png`;

/** What the HTML footer says, for the part of the message that has no HTML. */
const TEXT_FOOTER = `--
${BRAND} · Imprint: ${SITE}/legal/imprint · Privacy: ${SITE}/legal/privacy`;

/**
 * `List-Unsubscribe`, so a mail client can link to the way out. It names the
 * page, the same one the body links to. There is deliberately no
 * `List-Unsubscribe-Post`: that promises a one-click POST, and a provider's
 * cross-origin form POST never gets past SvelteKit's CSRF check.
 */
function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
	return { 'List-Unsubscribe': `<${unsubscribeUrl}>` };
}

const INK = '#1c1c1a';
const QUIET = '#6b6b66';
const FAINT = '#8b8a84';
const RULE = '#eceae5';

/** A paragraph of the message itself. */
function para(html: string): string {
	return `<p style="margin:0 0 20px">${html}</p>`;
}

/** The smaller print under it: what a thing means, and what it does not. */
function note(html: string): string {
	return `<p style="margin:0 0 20px;font-size:14px;color:${QUIET}">${html}</p>`;
}

/** The one thing the message asks for. Never more than one per message. */
function button(url: string, label: string): string {
	return `<p style="margin:4px 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:${INK};color:#fff;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px">${escapeHtml(label)}</a></p>`;
}

function link(url: string, label: string): string {
	return `<a href="${escapeHtml(url)}" style="color:${INK}">${escapeHtml(label)}</a>`;
}

/** The way out of a kind of message, named the same in both halves of it. */
interface Unsubscribe {
	url: string;
	/** `reminders` or `messages`: what stops. */
	what: string;
	/** Why this arrived at all, in one sentence. */
	because: string;
}

const REMINDERS = (url: string): Unsubscribe => ({
	url,
	what: 'reminders',
	because: 'You get these because export reminders are switched on in your account.'
});

const BOARD_MESSAGES = (url: string): Unsubscribe => ({
	url,
	what: 'messages',
	because: 'You get these because leaderboard messages are switched on in your account.'
});

interface Page {
	/** The line a mail client shows beside the subject. */
	preview: string;
	heading: string;
	body: string;
	unsubscribe?: Unsubscribe;
}

/**
 * One column, one typeface, a wordmark above and the small print below.
 *
 * Inline styles and nothing a mail client has to run. The logo is the one
 * thing fetched, from an address that is the same for everybody: Gmail does not
 * show a picture attached inline, which is how it travelled at first.
 */
function layout({ preview, heading, body, unsubscribe }: Page): string {
	const out = unsubscribe
		? `${escapeHtml(unsubscribe.because)} <a href="${escapeHtml(unsubscribe.url)}" style="color:${FAINT}">Stop these ${unsubscribe.what}</a><br>`
		: '';

	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#f6f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${INK};line-height:1.6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preview)}</div>
<div style="max-width:560px;margin:0 auto">
<p style="margin:0 4px 14px;font-size:18px;font-weight:600;letter-spacing:-0.4px"><a href="${SITE}" style="color:${INK};text-decoration:none"><img src="${LOGO_URL}" width="28" height="28" alt="" style="vertical-align:middle;border:0;border-radius:7px;margin-right:10px">${BRAND}</a></p>
<div style="background:#fff;border:1px solid ${RULE};border-radius:14px;overflow:hidden">
<div style="height:4px;background:#3987e5;background-image:linear-gradient(90deg,#3987e5,#199e70)"></div>
<div style="padding:28px 28px 12px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;letter-spacing:-0.4px">${escapeHtml(heading)}</h1>
${body}
</div>
</div>
<p style="margin:16px 4px 0;font-size:12px;line-height:1.7;color:${FAINT}">
${out}${BRAND} · <a href="${SITE}/legal/imprint" style="color:${FAINT}">Imprint</a> · <a href="${SITE}/legal/privacy" style="color:${FAINT}">Privacy</a>
</p>
</div></body></html>`;
}

/** The plain half: the same parts in the same order, a blank line between. */
function plain(parts: string[], unsubscribe?: Unsubscribe): string {
	const out = unsubscribe ? [`To stop these ${unsubscribe.what}: ${unsubscribe.url}`] : [];
	return [...parts.filter(Boolean), ...out, TEXT_FOOTER].join('\n\n');
}

export function magicLinkMail(to: string, url: string, isNew: boolean): Message {
	const subject = isNew ? `Your ${BRAND} account` : `Sign in to ${BRAND}`;
	const heading = isNew ? `Welcome to ${BRAND}` : `Sign in to ${BRAND}`;
	const action = isNew ? 'Finish setting up' : `Sign in to ${BRAND}`;
	const opening = isNew
		? 'Open the link below to finish setting up your account.'
		: 'Open the link below to sign in.';
	const small =
		'The link works once and expires in fifteen minutes. If you did not ask for it, nothing has happened and you can ignore this message — an account is only created when the link is opened.';

	const text = plain([opening, url, small]);

	const html = layout({
		preview: 'The link works once and expires in fifteen minutes.',
		heading,
		body: `${para(escapeHtml(opening))}
${button(url, action)}
${note(`Or paste this into your browser:<br><a href="${escapeHtml(url)}" style="color:${INK};word-break:break-all">${escapeHtml(url)}</a>`)}
${note(escapeHtml(small))}`
	});

	return { to, subject, text, html };
}

export interface ReminderFacts {
	/** Days since the newest export in the account ended. */
	staleDays: number;
	vehicles: number;
	requestUrl: string;
	appUrl: string;
	unsubscribeUrl: string;
}

export function reminderMail(to: string, facts: ReminderFacts): Message {
	const subject = 'Time to request your next XPeng export';
	const unsubscribe = REMINDERS(facts.unsubscribeUrl);

	// The reason this mail exists at all: the window is rolling, so a month
	// nobody asked for is a month that cannot be recovered later.
	const opening = `Your most recent export ended ${facts.staleDays} days ago. XPeng keeps a rolling thirty days, and whatever is not requested in time is lost.`;
	const after = `When it arrives, drop it into ${BRAND} and it is joined onto what you already have.`;

	const text = plain(
		[opening, `Request your export:\n${facts.requestUrl}`, `${after}\n${facts.appUrl}`],
		unsubscribe
	);

	const html = layout({
		preview: opening,
		heading: 'Time for your next export',
		body: `${para(escapeHtml(opening))}
${button(facts.requestUrl, 'Request your export')}
${note(`${escapeHtml(after)} ${link(facts.appUrl, `Open ${BRAND}`)}`)}`,
		unsubscribe
	});

	return { to, subject, text, html, headers: unsubscribeHeaders(facts.unsubscribeUrl) };
}

export interface BoardNudgeFacts {
	places: Array<{ board: string; reading: string; rank: number; month: string }>;
	claimUrl: string;
	unsubscribeUrl: string;
}

/**
 * "Something of yours would rank."
 *
 * Careful about what it does not say: nothing has been published, nothing will
 * be, and the message exists only because the person was not looking at the
 * app when it happened. So it leads with the fact and offers a door, rather
 * than asking anyone to come back and engage with anything.
 *
 * Worded around the board rather than around a trip, because not every board is
 * won by one: a charging session or a month's mileage is a place too, and "one
 * of your trips" would be describing something the reader never did.
 */
export function boardNudgeMail(to: string, facts: BoardNudgeFacts): Message {
	const first = facts.places[0];
	const several = facts.places.length > 1;
	const unsubscribe = BOARD_MESSAGES(facts.unsubscribeUrl);

	const subject = several
		? `${facts.places.length} places are waiting for you on the ${BRAND} boards`
		: `You would be #${first.rank} for ${first.board.toLowerCase()} — ${first.month}`;

	const opening = several
		? `${facts.places.length} things in your account would stand on a board. Nothing has been published — they are waiting for you to say whether you want them there.`
		: `${first.reading} would be #${first.rank} for ${first.board.toLowerCase()} on the ${first.month} board. Nothing has been published — it is waiting for you to say whether you want it there.`;

	const small =
		"A place shows the name you choose, your car's model and the figure — never your e-mail address or your vehicle identification number. You can take it down again at any time.";

	const list = facts.places
		.map((place) => `  #${place.rank}  ${place.board} — ${place.reading} (${place.month})`)
		.join('\n');

	const text = plain([opening, list, `See your places:\n${facts.claimUrl}`, small], unsubscribe);

	const rows = facts.places
		.map(
			(place) =>
				`<tr><td style="padding:10px 12px 10px 0;border-top:1px solid ${RULE};color:${QUIET};white-space:nowrap">#${place.rank}</td><td style="padding:10px 12px 10px 0;border-top:1px solid ${RULE}">${escapeHtml(place.board)}<br><span style="font-size:13px;color:${QUIET}">${escapeHtml(place.month)}</span></td><td style="padding:10px 0;border-top:1px solid ${RULE};text-align:right;font-weight:600;white-space:nowrap">${escapeHtml(place.reading)}</td></tr>`
		)
		.join('');

	const html = layout({
		preview: opening,
		heading: several
			? `${facts.places.length} places are waiting for you`
			: 'A place is waiting for you',
		body: `${para(escapeHtml(opening))}
<table style="margin:0 0 24px;width:100%;border-collapse:collapse;border-bottom:1px solid ${RULE};font-size:15px">${rows}</table>
${button(facts.claimUrl, 'See your places')}
${note(escapeHtml(small))}`,
		unsubscribe
	});

	return { to, subject, text, html, headers: unsubscribeHeaders(facts.unsubscribeUrl) };
}

/** A medal as a mail shows it, every string ready to print. */
export interface BadgeFacts {
	medal: Medal;
	/** The board's label. */
	board: string;
	/** The value with its unit. */
	reading: string;
	/** `September 2026` or `2026`. */
	period: string;
	/** Absolute, the `@2x` file. */
	imageUrl: string;
	alt: string;
}

function medalName(medal: Medal): string {
	return medal[0].toUpperCase() + medal.slice(1);
}

function badgeLine(badge: BadgeFacts): string {
	return `${medalName(badge.medal)} · ${badge.board} · ${badge.reading} · ${badge.period}`;
}

function badgesText(badges: BadgeFacts[]): string {
	return badges.map((badge) => `  ${badgeLine(badge)}\n  ${badge.imageUrl}`).join('\n\n');
}

/** Drawn at the width of the column from the sharp file, so it stays crisp. */
function badgesHtml(badges: BadgeFacts[]): string {
	return badges
		.map(
			(badge) =>
				`<p style="margin:0 0 16px"><img src="${escapeHtml(badge.imageUrl)}" width="504" height="144" alt="${escapeHtml(badge.alt)}" style="display:block;width:100%;max-width:504px;height:auto;border:0"><span style="font-size:13px;color:${QUIET}">${escapeHtml(badgeLine(badge))}</span></p>`
		)
		.join('\n');
}

/** "you took gold for longest drive", or a count when there are several. */
function took(badges: BadgeFacts[]): string {
	return badges.length === 1
		? `you took ${badges[0].medal} for ${badges[0].board.toLowerCase()}`
		: `you took ${badges.length} medals`;
}

const EMBED_ACTION = 'Get your embed code';
const BADGE_SMALL =
	'A badge is public and follows the board: take the place down and the badge goes with it.';

export interface AwardFacts {
	/** `September 2026`. */
	month: string;
	badges: BadgeFacts[];
	boardUrl: string;
	/** Where the embed codes are. */
	embedUrl: string;
	unsubscribeUrl: string;
}

/** "You finished in the top three", once a month has closed and stopped moving. */
export function awardMail(to: string, facts: AwardFacts): Message {
	const first = facts.badges[0];
	const several = facts.badges.length > 1;
	const unsubscribe = BOARD_MESSAGES(facts.unsubscribeUrl);

	const subject = several
		? `${facts.badges.length} medals on the ${facts.month} boards`
		: `${medalName(first.medal)} for ${first.board.toLowerCase()} — ${facts.month}`;

	const opening = `${facts.month} has closed and the boards are final: ${took(facts.badges)}.`;
	const offer =
		'Each medal comes with a badge you can put in a forum signature or anywhere else that shows a picture.';

	const text = plain(
		[
			opening,
			badgesText(facts.badges),
			offer,
			`${EMBED_ACTION}:\n${facts.embedUrl}`,
			`See the board:\n${facts.boardUrl}`,
			BADGE_SMALL
		],
		unsubscribe
	);

	const html = layout({
		preview: opening,
		heading: several
			? `${facts.badges.length} medals in ${facts.month}`
			: `${medalName(first.medal)} for ${first.board.toLowerCase()}`,
		body: `${para(escapeHtml(opening))}
${badgesHtml(facts.badges)}
${para(escapeHtml(offer))}
${button(facts.embedUrl, EMBED_ACTION)}
${note(`${link(facts.boardUrl, 'See the board')} · ${escapeHtml(BADGE_SMALL)}`)}`,
		unsubscribe
	});

	return { to, subject, text, html, headers: unsubscribeHeaders(facts.unsubscribeUrl) };
}

export interface RoundupFacts {
	year: number;
	places: number;
	wins: number;
	url: string;
	unsubscribeUrl: string;
	/** Medals on the year's own boards, if any. */
	badges?: BadgeFacts[];
	/**
	 * December's medals. They travel here rather than in a message of their
	 * own, because December closes at the same instant the year does.
	 */
	monthBadges?: BadgeFacts[];
	/** Where the embed codes are; needed with either list of badges. */
	embedUrl?: string;
}

/** The year, once its last month has closed and the numbers stopped moving. */
export function yearRoundupMail(to: string, facts: RoundupFacts): Message {
	const subject = `Your ${facts.year} on the ${BRAND} boards`;
	const unsubscribe = BOARD_MESSAGES(facts.unsubscribeUrl);

	const held = facts.places === 1 ? 'one place' : `${facts.places} places`;
	const won =
		facts.wins === 0
			? ''
			: facts.wins === 1
				? ' You topped a board once.'
				: ` You topped a board ${facts.wins} times.`;

	const opening = `${facts.year} has closed and the boards are final. You held ${held} across the year.${won}`;

	const year = facts.badges ?? [];
	const month = facts.monthBadges ?? [];
	const yearLine = year.length ? `On the year's boards ${took(year)}.` : '';
	const monthLine = month.length ? `${month[0].period} closed with it: ${took(month)}.` : '';
	const embed = (year.length > 0 || month.length > 0) && facts.embedUrl ? facts.embedUrl : null;

	const text = plain(
		[
			opening,
			yearLine,
			year.length ? badgesText(year) : '',
			monthLine,
			month.length ? badgesText(month) : '',
			embed ? `${EMBED_ACTION}:\n${embed}` : '',
			`See the year:\n${facts.url}`,
			embed ? BADGE_SMALL : ''
		],
		unsubscribe
	);

	const html = layout({
		preview: opening,
		heading: `Your ${facts.year} on the boards`,
		body: [
			para(escapeHtml(opening)),
			yearLine ? para(escapeHtml(yearLine)) + '\n' + badgesHtml(year) : '',
			monthLine ? para(escapeHtml(monthLine)) + '\n' + badgesHtml(month) : '',
			button(facts.url, 'See the year'),
			embed ? note(`${link(embed, EMBED_ACTION)} · ${escapeHtml(BADGE_SMALL)}`) : ''
		]
			.filter(Boolean)
			.join('\n'),
		unsubscribe
	});

	return { to, subject, text, html, headers: unsubscribeHeaders(facts.unsubscribeUrl) };
}
