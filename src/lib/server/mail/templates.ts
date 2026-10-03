/**
 * The messages this app sends.
 *
 * Plain text first, with a plain HTML twin: no images, no tracking pixel, no
 * link wrapping. A mail that asks to be trusted with a sign-in link should not
 * be indistinguishable from a marketing one.
 *
 * The one picture is a medal's badge, in the mails about winning one. It is the
 * public badge itself, at the address a forum would load it from — which names
 * the winner, so a client that fetches it makes a request we could in principle
 * tell apart. Nothing reads that; the privacy page says so rather than "none".
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

/** One typeface, one column, and a link that looks like a link. */
function layout(body: string): string {
	return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1c1a;line-height:1.6">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
${body}
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eceae5;font-size:12px;color:#8b8a84">
${BRAND} · <a href="${SITE}/legal/imprint" style="color:#8b8a84">Imprint</a> · <a href="${SITE}/legal/privacy" style="color:#8b8a84">Privacy</a>
</p>
</div></body></html>`;
}

export function magicLinkMail(to: string, url: string, isNew: boolean): Message {
	const subject = isNew ? `Your ${BRAND} account` : `Sign in to ${BRAND}`;
	const opening = isNew
		? `Welcome to ${BRAND}. Open the link below to finish setting up your account.`
		: `Open the link below to sign in to ${BRAND}.`;

	const text = `${opening}

${url}

The link works once and expires in fifteen minutes.

If you did not ask to sign in, nothing has happened and you can ignore this message — an account is only created when the link is opened.

${TEXT_FOOTER}`;

	const html = layout(
		`<p style="margin:0 0 20px">${escapeHtml(opening)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1c1c1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">Sign in to ${BRAND}</a></p>
<p style="margin:0 0 20px;font-size:14px;color:#6b6b66">Or paste this into your browser:<br><a href="${escapeHtml(url)}" style="color:#1c1c1a;word-break:break-all">${escapeHtml(url)}</a></p>
<p style="margin:0;font-size:13px;color:#6b6b66">The link works once and expires in fifteen minutes. If you did not ask to sign in, nothing has happened and you can ignore this message.</p>`
	);

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

	// The reason this mail exists at all: the window is rolling, so a month
	// nobody asked for is a month that cannot be recovered later.
	const opening = `Your most recent export ended ${facts.staleDays} days ago. XPeng keeps a rolling thirty days, and whatever is not requested in time is lost.`;

	const text = `${opening}

Request a fresh one here:
${facts.requestUrl}

When it arrives, drop it into ${BRAND} and it will be joined onto what you already have:
${facts.appUrl}

To stop these reminders: ${facts.unsubscribeUrl}

${TEXT_FOOTER}`;

	const html = layout(
		`<p style="margin:0 0 20px">${escapeHtml(opening)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(facts.requestUrl)}" style="display:inline-block;background:#1c1c1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">Request your export</a></p>
<p style="margin:0 0 20px;font-size:14px;color:#6b6b66">When it arrives, drop it into <a href="${escapeHtml(facts.appUrl)}" style="color:#1c1c1a">${BRAND}</a> and it will be joined onto what you already have.</p>
<p style="margin:0;font-size:13px;color:#6b6b66"><a href="${escapeHtml(facts.unsubscribeUrl)}" style="color:#6b6b66">Stop these reminders</a></p>`
	);

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

	const subject = several
		? `${facts.places.length} places are waiting for you on the LogbooX boards`
		: `You would be #${first.rank} for ${first.board.toLowerCase()} — ${first.month}`;

	const opening = several
		? `${facts.places.length} things in your account would stand on a board. Nothing has been published — they are waiting for you to say whether you want them there.`
		: `${first.reading} would be #${first.rank} for ${first.board.toLowerCase()} on the ${first.month} board. Nothing has been published — it is waiting for you to say whether you want it there.`;

	const list = facts.places
		.map((place) => `  #${place.rank}  ${place.board} — ${place.reading} (${place.month})`)
		.join('\n');

	const text = `${opening}

${list}

Have a look and decide:
${facts.claimUrl}

A place shows the name you choose, your car's model and the number. It never
shows your e-mail address or your vehicle identification number, and you can
take it down again at any time.

To stop these: ${facts.unsubscribeUrl}

${TEXT_FOOTER}`;

	const rows = facts.places
		.map(
			(place) =>
				`<tr><td style="padding:6px 12px 6px 0;color:#6b6b66">#${place.rank}</td><td style="padding:6px 12px 6px 0">${escapeHtml(place.board)}</td><td style="padding:6px 0;text-align:right;white-space:nowrap">${escapeHtml(place.reading)}</td></tr>`
		)
		.join('');

	const html = layout(
		`<p style="margin:0 0 20px">${escapeHtml(opening)}</p>
<table style="margin:0 0 24px;width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
<p style="margin:0 0 24px"><a href="${escapeHtml(facts.claimUrl)}" style="display:inline-block;background:#1c1c1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">Have a look</a></p>
<p style="margin:0 0 20px;font-size:14px;color:#6b6b66">A place shows the name you choose, your car's model and the number — never your e-mail address or your vehicle identification number. You can take it down again at any time.</p>
<p style="margin:0;font-size:13px;color:#6b6b66"><a href="${escapeHtml(facts.unsubscribeUrl)}" style="color:#6b6b66">Stop these messages</a></p>`
	);

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

/** Drawn at 560×160 from the sharp file, so it stays crisp on any screen. */
function badgesHtml(badges: BadgeFacts[]): string {
	return badges
		.map(
			(badge) =>
				`<p style="margin:0 0 16px"><img src="${escapeHtml(badge.imageUrl)}" width="560" height="160" alt="${escapeHtml(badge.alt)}" style="display:block;width:100%;max-width:560px;height:auto;border:0"><span style="font-size:13px;color:#6b6b66">${escapeHtml(badgeLine(badge))}</span></p>`
		)
		.join('\n');
}

const EMBED_LABEL = 'Copy the embed code for a forum signature';

export interface AwardFacts {
	/** `September 2026`. */
	month: string;
	badges: BadgeFacts[];
	boardUrl: string;
	/** Where the embed codes are. */
	embedUrl: string;
	unsubscribeUrl: string;
}

/** "You finished on the podium", once a month has locked and stopped moving. */
export function awardMail(to: string, facts: AwardFacts): Message {
	const first = facts.badges[0];
	const several = facts.badges.length > 1;

	const subject = several
		? `${facts.badges.length} medals on the ${facts.month} boards`
		: `${medalName(first.medal)} for ${first.board.toLowerCase()} — ${facts.month}`;

	const opening = several
		? `${facts.month} has closed, and you finished in the top three on ${facts.badges.length} boards.`
		: `${facts.month} has closed, and ${first.reading} took ${first.medal} for ${first.board.toLowerCase()}.`;

	const text = `${opening}

${badgesText(facts.badges)}

${EMBED_LABEL}:
${facts.embedUrl}

See the board:
${facts.boardUrl}

The badge follows the board: take the place down and the badge goes with it.

To stop these: ${facts.unsubscribeUrl}

${TEXT_FOOTER}`;

	const html = layout(
		`<p style="margin:0 0 20px">${escapeHtml(opening)}</p>
${badgesHtml(facts.badges)}
<p style="margin:8px 0 24px"><a href="${escapeHtml(facts.embedUrl)}" style="display:inline-block;background:#1c1c1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">${EMBED_LABEL}</a></p>
<p style="margin:0 0 20px;font-size:14px;color:#6b6b66"><a href="${escapeHtml(facts.boardUrl)}" style="color:#1c1c1a">See the board</a>. The badge follows the board: take the place down and the badge goes with it.</p>
<p style="margin:0;font-size:13px;color:#6b6b66"><a href="${escapeHtml(facts.unsubscribeUrl)}" style="color:#6b6b66">Stop these messages</a></p>`
	);

	return { to, subject, text, html, headers: unsubscribeHeaders(facts.unsubscribeUrl) };
}

export interface RoundupFacts {
	year: number;
	places: number;
	wins: number;
	url: string;
	unsubscribeUrl: string;
	/** The year's own medals, if any. */
	badges?: BadgeFacts[];
	/** Where the embed codes are; needed with `badges`. */
	embedUrl?: string;
}

/** The year, once its last month has closed and the numbers stopped moving. */
export function yearRoundupMail(to: string, facts: RoundupFacts): Message {
	const subject = `Your ${facts.year} on the LogbooX boards`;

	const held = facts.places === 1 ? 'one place' : `${facts.places} places`;
	const won =
		facts.wins === 0
			? ''
			: facts.wins === 1
				? ' You topped a board once.'
				: ` You topped a board ${facts.wins} times.`;

	const opening = `${facts.year} is closed and the boards are final. You held ${held} across the year.${won}`;

	const badges = facts.badges ?? [];
	const medals =
		badges.length === 0
			? ''
			: badges.length === 1
				? `On the year's own table you took ${badges[0].medal} for ${badges[0].board.toLowerCase()}.`
				: `On the year's own table you took ${badges.length} medals.`;
	const embed = badges.length > 0 && facts.embedUrl ? facts.embedUrl : null;

	const badgeText = medals
		? `${medals}

${badgesText(badges)}
${embed ? `\n${EMBED_LABEL}:\n${embed}\n` : ''}
`
		: '';
	const badgeHtml = medals
		? `<p style="margin:0 0 20px">${escapeHtml(medals)}</p>
${badgesHtml(badges)}
${embed ? `<p style="margin:0 0 24px;font-size:14px"><a href="${escapeHtml(embed)}" style="color:#1c1c1a">${EMBED_LABEL}</a></p>\n` : ''}`
		: '';

	const text = `${opening}

${badgeText}See the year:
${facts.url}

To stop these: ${facts.unsubscribeUrl}

${TEXT_FOOTER}`;

	const html = layout(
		`<p style="margin:0 0 24px">${escapeHtml(opening)}</p>
${badgeHtml}<p style="margin:0 0 24px"><a href="${escapeHtml(facts.url)}" style="display:inline-block;background:#1c1c1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">See the year</a></p>
<p style="margin:0;font-size:13px;color:#6b6b66"><a href="${escapeHtml(facts.unsubscribeUrl)}" style="color:#6b6b66">Stop these messages</a></p>`
	);

	return { to, subject, text, html, headers: unsubscribeHeaders(facts.unsubscribeUrl) };
}
