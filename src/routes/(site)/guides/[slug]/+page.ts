import { error } from '@sveltejs/kit';
import { en } from '#lib/i18n/en/index.js';
import type { EntryGenerator, PageLoad } from './$types';

/** Every guide is prerendered; its slug is the same in every language. */
export const entries: EntryGenerator = () => en.guides.map((guide) => ({ slug: guide.slug }));

export const load: PageLoad = ({ params }) => {
	if (!en.guides.some((guide) => guide.slug === params.slug)) error(404, 'No such guide');
	return { slug: params.slug };
};
