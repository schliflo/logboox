/**
 * Who is asking, and whether they are allowed to ask this way.
 *
 * Two credentials reach the server. A cookie is a browser someone signed in
 * on; a bearer token is something that person pointed at their own data, most
 * likely a home automation poller. They are deliberately not interchangeable:
 * a token can read, but can never manage sessions or mint another token, and a
 * cookie is refused on any cross-site request that changes something.
 *
 * That last check is here rather than left to SvelteKit's own, which only
 * covers form submissions — a JSON request from another origin would sail
 * straight past it.
 */

import type { Handle } from '@sveltejs/kit/hooks';
import { validateToken } from '#lib/server/auth/apiTokens.js';
import {
	SESSION_COOKIE,
	SESSION_COOKIE_OPTIONS,
	authenticateSession
} from '#lib/server/auth/session.js';
import { bearer, parseApiToken, timingSafeEqual } from '#lib/server/auth/tokens.js';
import { cronSecret, maybeDb } from '#lib/server/context.js';

/** Requests that carry a credential and may therefore not be forged. */
const GUARDED = /^\/(api|internal)\//;

function isLocalHost(hostname: string): boolean {
	return (
		hostname === 'localhost' ||
		hostname.endsWith('.localhost') ||
		hostname === '127.0.0.1' ||
		hostname === '[::1]'
	);
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.auth = null;
	event.locals.cron = false;

	const db = maybeDb(event);
	const presented = bearer(event.request.headers.get('authorization'));

	// The reminder run arrives as an ordinary request with the shared secret,
	// so the job can live in a route with the rest of the server code.
	const secret = cronSecret(event);
	if (presented && secret && timingSafeEqual(presented, secret)) {
		event.locals.cron = true;
	}

	if (db && !event.locals.cron) {
		const apiSecret = presented ? parseApiToken(presented) : null;
		if (apiSecret) {
			const resolved = await validateToken(db, apiSecret);
			if (resolved) {
				event.locals.auth = { user: resolved.user, via: 'token', scopes: resolved.scopes };
			}
		} else {
			const cookie = event.cookies.get(SESSION_COOKIE);
			if (cookie) {
				const session = await authenticateSession(db, cookie);
				if (session) {
					event.locals.auth = { user: session.user, via: 'session', scopes: ['read', 'write'] };
					// Kept alive by being used, so a regular reader is not signed
					// out on a schedule.
					if (session.reissue) {
						event.cookies.set(SESSION_COOKIE, cookie, SESSION_COOKIE_OPTIONS);
					}
				} else {
					event.cookies.delete(SESSION_COOKIE, { path: '/' });
				}
			}
		}
	}

	// A cookie rides along on any request the browser makes to this origin, so
	// anything that changes state has to prove the request came from our own
	// pages. A bearer token carries no such risk: nothing attaches it for you.
	if (
		GUARDED.test(event.url.pathname) &&
		!SAFE_METHODS.has(event.request.method) &&
		event.locals.auth?.via === 'session'
	) {
		const origin = event.request.headers.get('origin');
		if (origin !== event.url.origin) {
			return new Response(
				JSON.stringify({ error: 'This request did not come from the LogbooX app.' }),
				{ status: 403, headers: { 'content-type': 'application/json' } }
			);
		}
	}

	const response = await resolve(event);

	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'geolocation=(), camera=(), microphone=()');

	// Only framing is ruled out. A fuller policy would have to account for the
	// inline script and style SvelteKit emits and the wasm renderer.
	if (!response.headers.has('content-security-policy')) {
		response.headers.set('content-security-policy', "frame-ancestors 'none'");
	}

	// Plain http is how `wrangler dev` and the tests reach this, and a pinned
	// header on localhost would follow the browser to every other local project.
	if (event.url.protocol === 'https:' && !isLocalHost(event.url.hostname)) {
		response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};
