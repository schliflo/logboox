/**
 * Where each language lives.
 *
 * The public pages — the landing page, features, the FAQ and the guides — have
 * an address per language, so a search engine can index the German text as
 * German: English at the root, German under `/de`. They sit under the route
 * segment `[[lang=locale]]`, and on them the address alone decides the
 * language. Every other page has one address and follows the reader's stored
 * choice, as it always has.
 *
 * Links are written once, as the English path, and passed through
 * `localizedPath` on the way out; a path with no German counterpart, such as
 * the leaderboard or the legal pages, comes back unchanged.
 */

export type Locale = 'en' | 'de';

/** The languages with an address prefix of their own. English has none. */
export const PREFIXED = ['de'] as const;

export type PrefixedLocale = (typeof PREFIXED)[number];

/** The route segment the public pages sit under. */
const LOCALIZED_ROUTE = '/[[lang=locale]]';

/** The English paths that exist in every language. */
const TRANSLATED = /^\/(?:features|faq|guides(?:\/[^/]+)?)?$/;

const PREFIX = /^\/de(?=\/|$)/;

/** The `locale` param matcher: a language prefix, or nothing. */
export function matchLocale(param: string): PrefixedLocale | undefined {
	return (PREFIXED as readonly string[]).includes(param) ? (param as PrefixedLocale) : undefined;
}

/** Whether a route is one of the pages whose language comes from its address. */
export function isLocalizedRoute(routeId: string | null | undefined): boolean {
	return routeId === LOCALIZED_ROUTE || !!routeId?.startsWith(`${LOCALIZED_ROUTE}/`);
}

/** The language an address is in, going by its prefix alone. */
export function pathLocale(pathname: string): Locale {
	return PREFIX.test(pathname) ? 'de' : 'en';
}

/**
 * The address of `path` in `locale`: prefixed for German when the page exists
 * in German, unchanged otherwise. Accepts a path in either language, with a
 * query or a fragment; anything that is not a site path is returned as given.
 */
export function localizedPath(path: string, locale: Locale): string {
	if (!path.startsWith('/') || path.startsWith('//')) return path;
	const { pathname, rest } = split(path);
	const bare = pathname.replace(PREFIX, '') || '/';
	if (!TRANSLATED.test(bare)) return path;
	if (locale === 'en') return `${bare}${rest}`;
	return `/${locale}${bare === '/' ? '' : bare}${rest}`;
}

/** Route params for prerendering a page in every language. */
export function localeEntries(): Array<{ lang?: PrefixedLocale }> {
	return [{}, ...PREFIXED.map((lang) => ({ lang }))];
}

function split(path: string): { pathname: string; rest: string } {
	const index = path.search(/[?#]/);
	return index === -1
		? { pathname: path, rest: '' }
		: { pathname: path.slice(0, index), rest: path.slice(index) };
}
