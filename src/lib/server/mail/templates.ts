/**
 * The two messages this app sends.
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

/** One typeface, one column, and a link that looks like a link. */
function layout(body: string): string {
	return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1c1a;line-height:1.6">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
${body}
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
