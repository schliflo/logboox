/**
 * Route param matchers. `locale` takes the prefix of a language that has
 * addresses of its own, so `/de/faq` is the German FAQ while `/dash` is still
 * the dashboard; see `#lib/i18n/paths.ts`.
 */

import { defineParams } from '@sveltejs/kit/params';
// Loaded by Node during the build as well as by Vite, so the import names the
// file as it is on disk.
import { matchLocale } from './lib/i18n/paths.ts';

export const params = defineParams({
	locale: matchLocale
});
