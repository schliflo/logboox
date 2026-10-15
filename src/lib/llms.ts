/**
 * The site described for language models, after the llms.txt proposal
 * (https://llmstxt.org): a short Markdown index at `/llms.txt`, and the full
 * text of the guides and the FAQ at `/llms-full.txt`, so an assistant asked
 * about the XPeng export can read the answer rather than guess it.
 *
 * Written from the English catalog, so it never says something the pages
 * do not; the German pages are only listed, by their own titles.
 */

import { en } from '#lib/i18n/en/index.js';
import { de } from '#lib/i18n/de/index.js';
import type { Guide } from '#lib/i18n/en/guides.js';
import { markdownText } from '#lib/utils/rich-text.js';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '#lib/seo.js';

function link(path: string): string {
	return `${SITE_URL}${path}`;
}

function intro(): string[] {
	return [
		`# ${SITE_NAME}`,
		'',
		`> ${SITE_DESCRIPTION}`,
		'',
		`${SITE_NAME} is a free, open-source web app (MIT licence) that reads the vehicle data export XPeng provides under the EU Data Act. The export is up to three CSV streams of raw signals, sampled once a second while the car is awake, covering the last thirty days — about 340 MB and 3.6 million rows a month, with no locations, trips or charging sessions in it. ${SITE_NAME} parses it in the browser, without uploading it, and derives trips, charging sessions, battery behaviour, driving style, a draft driving logbook and an account of what the data reveals about its owner. An account is optional. It is not affiliated with XPeng. Source: https://github.com/schliflo/logboox`,
		''
	];
}

/** The index: what the site is, and where each answer lives. */
export function llmsIndex(): string {
	return [
		...intro(),
		'## Guides',
		'',
		...en.guides.map(
			(guide) => `- [${guide.headline}](${link(`/guides/${guide.slug}`)}): ${guide.description}`
		),
		'',
		'## Pages',
		'',
		`- [${SITE_NAME}](${link('/')}): the app — drop an export in, or open a generated demo month.`,
		`- [Features](${link('/features')}): ${en.featuresPage.description}`,
		`- [FAQ](${link('/faq')}): ${en.faqPage.description}`,
		`- [Leaderboard](${link('/leaderboard')}): monthly boards for the fastest charge, the longest drive and more.`,
		'',
		'## Deutsch',
		'',
		'The same pages in German:',
		'',
		`- [${SITE_NAME}](${link('/de')})`,
		`- [${de.site.features}](${link('/de/features')})`,
		`- [${de.faqPage.title}](${link('/de/faq')})`,
		`- [${de.guidesPage.title}](${link('/de/guides')})`,
		...de.guides.map((guide) => `- [${guide.headline}](${link(`/de/guides/${guide.slug}`)})`),
		'',
		'## Optional',
		'',
		`- [Full text of the guides and FAQ](${link('/llms-full.txt')})`,
		`- [Privacy policy](${link('/legal/privacy')})`,
		''
	].join('\n');
}

function guideText(guide: Guide): string[] {
	const md = (text: string) => markdownText(text, SITE_URL);
	return [
		`## ${guide.headline}`,
		'',
		`Source: ${link(`/guides/${guide.slug}`)}`,
		'',
		...guide.summary.map(md).flatMap((p) => [p, '']),
		...guide.sections.flatMap((section) => [
			`### ${section.heading}`,
			'',
			...section.body.map(md).flatMap((p) => [p, '']),
			...(section.list
				? [
						...section.list.map((item, i) => `${section.ordered ? `${i + 1}.` : '-'} ${md(item)}`),
						''
					]
				: [])
		]),
		'### Questions',
		'',
		...guide.faq.flatMap((item) => [`**${item.q}**`, '', md(item.a), ''])
	];
}

/** Everything a reader could learn from the guides and the FAQ, in one file. */
export function llmsFull(): string {
	const md = (text: string) => markdownText(text, SITE_URL);
	return [
		...intro(),
		...en.guides.flatMap(guideText),
		'## Frequently asked questions',
		'',
		`Source: ${link('/faq')}`,
		'',
		...en.faqPage.groups.flatMap((group) => [
			`### ${group.title}`,
			'',
			...group.items.flatMap((item) => [
				`**${item.q}**`,
				'',
				...item.a.map(md).flatMap((p) => [p, ''])
			])
		]),
		'## Features',
		'',
		`Source: ${link('/features')}`,
		'',
		...en.featuresPage.groups.flatMap((group) => [
			`### ${group.title}`,
			'',
			...group.items.map((item) => `- **${item.title}**: ${item.body}`),
			''
		])
	].join('\n');
}
