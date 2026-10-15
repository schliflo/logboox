import { localeEntries } from '#lib/i18n/paths.js';
import type { EntryGenerator } from './$types';

/** The landing page, prerendered once per language. */
export const entries: EntryGenerator = localeEntries;
