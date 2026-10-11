/**
 * The translation layer.
 *
 * English is the source catalog and the default; every other language must
 * carry the same keys, which the type of `Messages` enforces. Components read
 * text through `m`, which looks the key up in the current language — reading
 * it inside markup or a `$derived` makes the text follow a language change.
 *
 * Pages are prerendered in English, so the stored choice is applied after
 * hydration (`restoreLocale`) rather than during it.
 */

import { en, type Messages } from './en/index';
import { de } from './de/index';

export type { Messages };

export type Locale = 'en' | 'de';

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

export function setLocale(next: Locale): void {
	i18n.locale = next;
	if (typeof document !== 'undefined') document.documentElement.lang = next;
	try {
		localStorage.setItem(STORAGE_KEY, next);
	} catch {
		// Storage refused: the choice lasts for this tab.
	}
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
