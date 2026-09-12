/**
 * Everything the pages need to describe themselves to crawlers and to the
 * cards that link previews build.
 *
 * The public origin cannot be known at build time — the same bundle deploys to
 * a workers.dev subdomain or a custom domain — so it comes from
 * `PUBLIC_SITE_URL` when the build sets it. Without it the tags that require an
 * absolute URL are simply left out, and the social image is referenced by path,
 * which every major scraper resolves against the page it found it on.
 *
 * Both public variables are read twice: once by the prerender, which bakes
 * them into the HTML, and once by the client on start, which fetches them from
 * the Worker's `vars`. The two must agree, or hydration quietly undoes what the
 * prerender wrote — so `.env.production` and `wrangler.jsonc` carry the same
 * values.
 */

import { env } from '$env/dynamic/public';

export const SITE_NAME = 'LogbooX';

export const SITE_DESCRIPTION =
	'LogbooX turns your XPeng EU Data Act export into trips, charging sessions, battery health and driving style. Read in your browser — nothing is uploaded.';

export const OG_IMAGE = '/og.png';

export const OG_IMAGE_ALT =
	'LogbooX: read the month your car quietly recorded, with a speed trace across the foot of the card.';

export const AUTHOR = 'schliflo';
export const AUTHOR_URL = 'https://github.com/schliflo';

/** Configured public origin, without a trailing slash, or an empty string. */
export const SITE_URL = (env.PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');

/**
 * Where the app now lives, when this deployment is a superseded one. Set only
 * on the legacy Worker, where it turns on the notice that points readers — and
 * the exports they keep here — at the new address. Empty everywhere else.
 */
export const MOVED_TO = (env.PUBLIC_MOVED_TO ?? '').replace(/\/+$/, '');

/** Absolute URL for a path, or null when the origin was never configured. */
export function absolute(path: string): string | null {
	if (!SITE_URL) return null;
	return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Page title, suffixed with the site name unless it already is the name. */
export function pageTitle(title?: string): string {
	if (!title || title === SITE_NAME)
		return `${SITE_NAME} — read the month your XPeng quietly recorded`;
	return `${title} · ${SITE_NAME}`;
}
