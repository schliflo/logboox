import { afterEach, describe, expect, it } from 'vitest';
import { en } from './en/index';
import { de } from './de/index';
import { i18n, intlLocale, localHref, m, setLocale } from './index.svelte';
import { factText } from './facts';
import { num } from '../utils/format';
import { generateDemoDataset } from '../demo/generator';
import { analyze } from '../data/analytics';

/** Every leaf path with its kind, so the two catalogs can be compared shape for shape. */
function shape(value: unknown, path = ''): string[] {
	if (typeof value === 'function') return [`${path}:fn`];
	if (typeof value === 'string') return [`${path}:string`];
	if (Array.isArray(value)) {
		return [
			`${path}:array(${value.length})`,
			...value.flatMap((v, i) => shape(v, `${path}[${i}]`))
		];
	}
	if (value && typeof value === 'object') {
		return Object.entries(value).flatMap(([key, v]) => shape(v, path ? `${path}.${key}` : key));
	}
	return [`${path}:${typeof value}`];
}

describe('catalogs', () => {
	afterEach(() => setLocale('en'));

	it('German has exactly the keys English has, of the same kinds', () => {
		expect(shape(de).sort()).toEqual(shape(en).sort());
	});

	it('follows the chosen language', () => {
		expect(m.nav.home).toBe('Home');
		setLocale('de');
		expect(i18n.locale).toBe('de');
		expect(m.nav.home).toBe('Start');
		expect(intlLocale()).toBe('de-DE');
		expect(num(1234.5, 1)).toBe('1.234,5');
	});

	it('links to the page in the language being read', () => {
		expect(localHref('/guides/request-xpeng-data')).toBe('/guides/request-xpeng-data');
		setLocale('de');
		expect(localHref('/guides/request-xpeng-data')).toBe('/de/guides/request-xpeng-data');
		expect(localHref('/leaderboard')).toBe('/leaderboard');
	});

	it('words every finding in both languages', () => {
		const derived = analyze(generateDemoDataset({ seed: 7 }), 'Europe/Berlin');
		const facts = Object.values(derived.facts).flat();
		expect(facts.length).toBeGreaterThan(5);
		for (const locale of ['en', 'de'] as const) {
			setLocale(locale);
			for (const fact of facts) {
				const text = factText(fact);
				expect(text.kicker.length).toBeGreaterThan(3);
				expect(text.detail).not.toMatch(/undefined|NaN/);
			}
		}
	});
});
