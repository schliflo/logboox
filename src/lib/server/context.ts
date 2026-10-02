/**
 * What a request has to work with.
 *
 * Every binding is optional, and deliberately so: the legacy Worker has none,
 * and the app itself works without any of them. A route that needs one asks
 * for it here and gets a clean 503 rather than a stack trace when it is absent.
 */

import { dev } from '$app/env';
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Db } from './db';
import { cloudflareMailer, consoleMailer, type Mailer } from './mail/mailer';

const NO_ACCOUNTS = 'Accounts are not available on this address. Use https://logboox.app instead.';

/**
 * A 503 in the shape every API route answers with, `{ error, hint }`, next to
 * the `message` SvelteKit puts in its own error bodies. A variable rather than
 * a literal: `App.Error` knows only `message`, and excess keys are rejected on
 * a fresh object but not on one that was named first.
 */
function unavailable(): never {
	const body = {
		message: NO_ACCOUNTS,
		error: NO_ACCOUNTS,
		hint: 'Accounts live at https://logboox.app.'
	};
	error(503, body);
}

/**
 * One binding, or null.
 *
 * Reading a binding has to be guarded rather than optional-chained. The
 * Cloudflare adapter hands prerenderable routes an environment whose every
 * property getter throws — deliberately, so that a page baked at build time
 * cannot quietly depend on a database. Both the prerender and the dev server
 * take that path for ordinary pages, and the hook that resolves a session runs
 * on all of them, so asking for a binding that is not there must be an answer
 * rather than an exception.
 */
function binding<K extends keyof Env>(event: RequestEvent, key: K): NonNullable<Env[K]> | null {
	try {
		return event.platform?.env?.[key] ?? null;
	} catch {
		return null;
	}
}

export function maybeDb(event: RequestEvent): Db | null {
	return (binding(event, 'DB') as Db | null) ?? null;
}

/** The database, or a 503 that says why there isn't one. */
export function requireDb(event: RequestEvent): Db {
	const db = maybeDb(event);
	if (!db) unavailable();
	return db;
}

export function maybeStorage(event: RequestEvent): R2Bucket | null {
	return binding(event, 'STORAGE');
}

export function requireStorage(event: RequestEvent): R2Bucket {
	const storage = maybeStorage(event);
	if (!storage) unavailable();
	return storage;
}

/**
 * The mailer. Printed rather than sent in development only.
 *
 * The development case has to be asked for explicitly. Wrangler's proxy does
 * supply a working `send_email` binding to `vite dev`, and it delivers into a
 * store inside a temporary directory: nothing is sent, and the sign-in link is
 * unreachable without going and reading that store. Printing it is the whole
 * point of having a console mailer.
 *
 * Anywhere else a missing binding is a misconfiguration, and falling back to
 * printing would put working sign-in links in the logs while reporting them as
 * sent. It throws instead.
 */
export function mailer(event: RequestEvent): Mailer {
	if (dev) return consoleMailer();
	const email = binding(event, 'EMAIL');
	const from = binding(event, 'MAIL_FROM');
	if (!email || !from) {
		throw new Error('Mail is not configured: the EMAIL binding or MAIL_FROM is missing.');
	}
	return cloudflareMailer(email, from);
}

/** Where this deployment answers, for links that travel in mail. */
export function siteUrl(event: RequestEvent): string {
	return event.url.origin;
}

/** The shared secret the reminder Worker presents, when this deployment has one. */
export function cronSecret(event: RequestEvent): string | null {
	return binding(event, 'CRON_SECRET');
}

/** What development signs unsubscribe links with. Not a secret; it opens one switch. */
const DEV_MAIL_SECRET = 'development-mail-secret';

/**
 * What unsubscribe links are signed with, or null when this deployment has
 * none. Development always has one, so local runs work without setup.
 */
export function mailSecret(event: RequestEvent): string | null {
	return binding(event, 'MAIL_SECRET') ?? (dev ? DEV_MAIL_SECRET : null);
}

/** The caller's address, as Cloudflare reports it. Used only for rate limits. */
export function clientIp(event: RequestEvent): string | null {
	try {
		return event.getClientAddress();
	} catch {
		return null;
	}
}
