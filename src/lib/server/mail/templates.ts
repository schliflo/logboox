/**
 * The messages this app sends.
 *
 * Plain text first, with a plain HTML twin: no images, no tracking pixel, no
 * link wrapping. A mail that asks to be trusted with a sign-in link should not
 * be indistinguishable from a marketing one.
 */

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

If you did not ask to sign in, nothing has happened and you can ignore this message — an account is only created when the link is opened.`;

	const html = layout(
		`<p style="margin:0 0 20px">${escapeHtml(opening)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1c1c1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">Sign in to ${BRAND}</a></p>
<p style="margin:0 0 20px;font-size:14px;color:#6b6b66">Or paste this into your browser:<br><a href="${escapeHtml(url)}" style="color:#1c1c1a;word-break:break-all">${escapeHtml(url)}</a></p>
<p style="margin:0;font-size:13px;color:#6b6b66">The link works once and expires in fifteen minutes. If you did not ask to sign in, nothing has happened and you can ignore this message.</p>`
	);

	return { to, subject, text, html };
}

export interface ReminderFacts {
	/** Days since the newest export in the account stops speaking for the car. */
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
	const opening = `Your most recent export stops ${facts.staleDays} days ago. XPeng only keeps a rolling thirty days, so anything older than that is already gone.`;

	const text = `${opening}

Request a fresh one here:
${facts.requestUrl}

When it arrives, drop it into ${BRAND} and it will be joined onto what you already have:
${facts.appUrl}

To stop these reminders: ${facts.unsubscribeUrl}`;

	const html = layout(
		`<p style="margin:0 0 20px">${escapeHtml(opening)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(facts.requestUrl)}" style="display:inline-block;background:#1c1c1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">Request your export</a></p>
<p style="margin:0 0 20px;font-size:14px;color:#6b6b66">When it arrives, drop it into <a href="${escapeHtml(facts.appUrl)}" style="color:#1c1c1a">${BRAND}</a> and it will be joined onto what you already have.</p>
<p style="margin:0;font-size:13px;color:#6b6b66"><a href="${escapeHtml(facts.unsubscribeUrl)}" style="color:#6b6b66">Stop these reminders</a></p>`
	);

	return { to, subject, text, html };
}

export interface BoardNudgeFacts {
	places: Array<{ board: string; reading: string; rank: number; month: string }>;
	claimUrl: string;
	unsubscribeUrl: string;
}

/**
 * "One of your trips would rank."
 *
 * Careful about what it does not say: nothing has been published, nothing will
 * be, and the message exists only because the person was not looking at the
 * app when it happened. So it leads with the fact and offers a door, rather
 * than asking anyone to come back and engage with anything.
 */
export function boardNudgeMail(to: string, facts: BoardNudgeFacts): Message {
	const first = facts.places[0];
	const several = facts.places.length > 1;

	const subject = several
		? `${facts.places.length} of your trips would make a LogbooX board`
		: `Your ${first.board.toLowerCase()} would be #${first.rank} this month`;

	const opening = several
		? `${facts.places.length} things in your account would stand on a board this month. Nothing has been published — they are waiting for you to say whether you want them there.`
		: `Your ${first.board.toLowerCase()} of ${first.reading} would be #${first.rank} on the ${first.month} board. Nothing has been published — it is waiting for you to say whether you want it there.`;

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

To stop these: ${facts.unsubscribeUrl}`;

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

	return { to, subject, text, html };
}

export interface RoundupFacts {
	year: number;
	places: number;
	wins: number;
	url: string;
	unsubscribeUrl: string;
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

	const text = `${opening}

See the year:
${facts.url}

To stop these: ${facts.unsubscribeUrl}`;

	const html = layout(
		`<p style="margin:0 0 24px">${escapeHtml(opening)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(facts.url)}" style="display:inline-block;background:#1c1c1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">See the year</a></p>
<p style="margin:0;font-size:13px;color:#6b6b66"><a href="${escapeHtml(facts.unsubscribeUrl)}" style="color:#6b6b66">Stop these messages</a></p>`
	);

	return { to, subject, text, html };
}
