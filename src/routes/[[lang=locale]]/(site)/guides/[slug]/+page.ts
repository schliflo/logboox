import { error } from '@sveltejs/kit';
import { en } from '#lib/i18n/en/index.js';
import { localeEntries } from '#lib/i18n/paths.js';
import type { EntryGenerator, PageLoad } from './$types';

/** Every guide is prerendered in every language; its slug is the same in each. */
export const entries: EntryGenerator = () =>
	localeEntries().flatMap((lang) => en.guides.map((guide) => ({ ...lang, slug: guide.slug })));

export const load: PageLoad = ({ params }) => {
	if (!en.guides.some((guide) => guide.slug === params.slug)) error(404, 'No such guide');
	return { slug: params.slug };
};
