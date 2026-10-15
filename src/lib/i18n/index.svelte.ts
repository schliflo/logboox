/**
 * The translation layer.
 *
 * English is the source catalog and the default; every other language must
 * carry the same keys, which the type of `Messages` enforces. Components read
 * text through `m`, which looks the key up in the current language — reading
 * it inside markup or a `$derived` makes the text follow a language change.
 *
 * The public pages take their language from their address (`paths.ts`),
 * set before they render so the prerendered text and the first client render
 * agree. Every other page is prerendered in English, so the stored choice is
 * applied after hydration (`restoreLocale`) rather than during it.
 */

import { en, type Messages } from './en/index';
import { de } from './de/index';
import { localizedPath, type Locale } from './paths';

export type { Messages, Locale };

export const LOCALES: Array<{ code: Locale; label: string }> = [
	{ code: 'en', label: 'English' },
	{ code: 'de', label: 'Deutsch' }
];

const CATALOGS: Record<Locale, Messages> = { en, de };

/** What `Intl` is given for each language. */
const INTL: Record<Locale, string> = { en: 'en-GB', de: 'de-DE' };

const STORAGE_KEY = 'logboox:locale';

class I18n {
	locale = $state<Locale>('en');
}

export const i18n = new I18n();

/** The current language's messages. */
export const m: Messages = new Proxy({} as Messages, {
	get: (_, key) => CATALOGS[i18n.locale][key as keyof Messages]
});

/** The locale tag for `Intl` formatters. */
export function intlLocale(): string {
	return INTL[i18n.locale];
}

export function isLocale(value: unknown): value is Locale {
	return value === 'en' || value === 'de';
}

/** Shows the page in `next` without remembering it, as an address does. */
export function applyLocale(next: Locale): void {
	i18n.locale = next;
	if (typeof document !== 'undefined') document.documentElement.lang = next;
}

/** Remembers `next` for the pages that follow the stored choice. */
export function storeLocale(next: Locale): void {
	try {
		localStorage.setItem(STORAGE_KEY, next);
	} catch {
		// Storage refused: the choice lasts for this tab.
	}
}

export function setLocale(next: Locale): void {
	applyLocale(next);
	storeLocale(next);
}

/** A site path as it is addressed in the current language. */
export function localHref(path: string): string {
	return localizedPath(path, i18n.locale);
}

/** Applies the language chosen on an earlier visit. */
export function restoreLocale(): void {
	let stored: string | null = null;
	try {
		stored = localStorage.getItem(STORAGE_KEY);
	} catch {
		return;
	}
	if (isLocale(stored) && stored !== i18n.locale) setLocale(stored);
}
