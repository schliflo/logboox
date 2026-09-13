/**
 * What a request has to work with.
 *
 * Every binding is optional, and deliberately so: the legacy Worker has none,
 * and the app itself works without any of them. A route that needs one asks
 * for it here and gets a clean 503 rather than a stack trace when it is absent.
 */

import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Db } from './db';
import { cloudflareMailer, consoleMailer, type Mailer } from './mail/mailer';

const NO_ACCOUNTS = 'Accounts are not available on this address. Use https://logboox.app instead.';

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
	if (!db) error(503, NO_ACCOUNTS);
	return db;
}

export function maybeStorage(event: RequestEvent): R2Bucket | null {
	return binding(event, 'STORAGE');
}

export function requireStorage(event: RequestEvent): R2Bucket {
	const storage = maybeStorage(event);
	if (!storage) error(503, NO_ACCOUNTS);
	return storage;
}

/**
 * The mailer. Without a binding — `vite dev`, or a Worker that never had one —
 * messages are printed instead, which is what makes the sign-in flow usable
 * from a terminal.
 */
export function mailer(event: RequestEvent): Mailer {
	const email = binding(event, 'EMAIL');
	const from = binding(event, 'MAIL_FROM');
	if (!email || !from) return consoleMailer();
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

/** The caller's address, as Cloudflare reports it. Used only for rate limits. */
export function clientIp(event: RequestEvent): string | null {
	try {
		return event.getClientAddress();
	} catch {
		return null;
	}
}
