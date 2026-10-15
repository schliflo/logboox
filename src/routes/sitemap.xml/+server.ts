/**
 * The public pages only: the dashboard is empty until someone drops their own
 * files in. Without a configured origin there is no absolute URL to publish,
 * so the sitemap is served empty but valid.
 *
 * A page that exists in every language is listed once per language, and each
 * entry names all of them, English as the default, as the hreflang links on
 * the pages themselves do.
 */

import { en } from '#lib/i18n/en/index.js';
import { localizedPath } from '#lib/i18n/paths.js';
import { GUIDES_UPDATED, SITE_URL } from '#lib/seo.js';

export const prerender = true;

interface Entry {
	path: string;
	priority: string;
	lastmod?: string;
	/** Whether the page has a German address too. */
	translated?: boolean;
}

const PAGES: Entry[] = [
	{ path: '/', priority: '1.0', translated: true },
	{ path: '/features', priority: '0.8', translated: true },
	{ path: '/guides', priority: '0.8', lastmod: GUIDES_UPDATED, translated: true },
	...en.guides.map((guide) => ({
		path: `/guides/${guide.slug}`,
		priority: '0.8',
		lastmod: GUIDES_UPDATED,
		translated: true
	})),
	{ path: '/faq', priority: '0.8', translated: true },
	{ path: '/leaderboard', priority: '0.7' },
	{ path: '/legal/privacy', priority: '0.2' },
	{ path: '/legal/imprint', priority: '0.2' },
	{ path: '/legal/terms', priority: '0.2' }
];

function url(path: string, priority: string, lastmod?: string, alternates: string[] = []): string {
	return [
		'\t<url>',
		`\t\t<loc>${SITE_URL}${path}</loc>`,
		...alternates,
		...(lastmod ? [`\t\t<lastmod>${lastmod}</lastmod>`] : []),
		`\t\t<priority>${priority}</priority>`,
		'\t</url>'
	].join('\n');
}

function entry({ path, priority, lastmod, translated }: Entry): string[] {
	if (!translated) return [url(path, priority, lastmod)];
	const english = localizedPath(path, 'en');
	const german = localizedPath(path, 'de');
	const alternates = [
		['en', english],
		['de', german],
		['x-default', english]
	].map(
		([hreflang, href]) =>
			`\t\t<xhtml:link rel="alternate" hreflang="${hreflang}" href="${SITE_URL}${href}"/>`
	);
	return [url(english, priority, lastmod, alternates), url(german, priority, lastmod, alternates)];
}

export function GET(): Response {
	const entries = SITE_URL ? PAGES.flatMap(entry) : [];
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;
	return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
