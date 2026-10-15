import { describe, expect, it } from 'vitest';
import { isLocalizedRoute, localeEntries, localizedPath, matchLocale, pathLocale } from './paths';
import { params } from '../../params';

describe('localizedPath', () => {
	it('prefixes the public pages for German', () => {
		expect(localizedPath('/', 'de')).toBe('/de');
		expect(localizedPath('/features', 'de')).toBe('/de/features');
		expect(localizedPath('/faq', 'de')).toBe('/de/faq');
		expect(localizedPath('/guides', 'de')).toBe('/de/guides');
		expect(localizedPath('/guides/request-xpeng-data', 'de')).toBe('/de/guides/request-xpeng-data');
	});

	it('leaves English paths as they are', () => {
		expect(localizedPath('/', 'en')).toBe('/');
		expect(localizedPath('/guides/request-xpeng-data', 'en')).toBe('/guides/request-xpeng-data');
	});

	it('turns a German path back into English, and is idempotent', () => {
		expect(localizedPath('/de', 'en')).toBe('/');
		expect(localizedPath('/de/faq', 'en')).toBe('/faq');
		expect(localizedPath('/de/faq', 'de')).toBe('/de/faq');
		expect(localizedPath('/de', 'de')).toBe('/de');
	});

	it('keeps a query and a fragment', () => {
		expect(localizedPath('/faq#faq-2', 'de')).toBe('/de/faq#faq-2');
		expect(localizedPath('/?demo=1', 'de')).toBe('/de?demo=1');
		expect(localizedPath('/de/guides?x=1#questions', 'en')).toBe('/guides?x=1#questions');
		expect(localizedPath('/de#top', 'en')).toBe('/#top');
	});

	it('leaves pages without a German version alone', () => {
		for (const path of ['/leaderboard', '/legal/privacy', '/dash/overview', '/s/abc', '/account']) {
			expect(localizedPath(path, 'de')).toBe(path);
		}
		expect(localizedPath('/guides/a/b', 'de')).toBe('/guides/a/b');
		expect(localizedPath('/features-old', 'de')).toBe('/features-old');
		expect(localizedPath('/dex', 'en')).toBe('/dex');
	});

	it('leaves anything that is not a site path alone', () => {
		expect(localizedPath('https://www.xpeng.com/data-act', 'de')).toBe(
			'https://www.xpeng.com/data-act'
		);
		expect(localizedPath('//example.com/faq', 'de')).toBe('//example.com/faq');
		expect(localizedPath('#questions', 'de')).toBe('#questions');
		expect(localizedPath('mailto:info@logboox.app', 'de')).toBe('mailto:info@logboox.app');
	});
});

describe('pathLocale', () => {
	it('reads the language from the prefix', () => {
		expect(pathLocale('/de')).toBe('de');
		expect(pathLocale('/de/guides/request-xpeng-data')).toBe('de');
		expect(pathLocale('/')).toBe('en');
		expect(pathLocale('/dash/overview')).toBe('en');
		expect(pathLocale('/dex')).toBe('en');
	});
});

describe('isLocalizedRoute', () => {
	it('knows the public pages by their route', () => {
		expect(isLocalizedRoute('/[[lang=locale]]')).toBe(true);
		expect(isLocalizedRoute('/[[lang=locale]]/(site)/guides/[slug]')).toBe(true);
		expect(isLocalizedRoute('/leaderboard/[period]')).toBe(false);
		expect(isLocalizedRoute(null)).toBe(false);
		expect(isLocalizedRoute(undefined)).toBe(false);
	});
});

describe('locale param', () => {
	it('matches only a language with addresses of its own', () => {
		expect(matchLocale('de')).toBe('de');
		expect(matchLocale('en')).toBeUndefined();
		expect(matchLocale('dash')).toBeUndefined();
		expect(matchLocale('DE')).toBeUndefined();
		expect(matchLocale('')).toBeUndefined();
	});

	it('is the matcher the routes use', () => {
		const validate = (value: string) => params.locale['~standard'].validate(value);
		expect(validate('de')).toEqual({ value: 'de' });
		expect(validate('features')).toHaveProperty('issues');
	});

	it('prerenders every language', () => {
		expect(localeEntries()).toEqual([{}, { lang: 'de' }]);
	});
});
