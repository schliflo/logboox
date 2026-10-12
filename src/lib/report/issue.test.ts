import { describe, expect, it } from 'vitest';
import {
	describeError,
	isBug,
	isNoise,
	isOurs,
	issueUrl,
	signature,
	type ErrorDetail
} from './issue';

const ORIGIN = 'https://logboox.app';

function fields(url: string) {
	return Object.fromEntries(new URL(url).searchParams);
}

const v8: ErrorDetail = {
	name: 'TypeError',
	message: "Cannot read properties of undefined (reading 'time')",
	stack: [
		"TypeError: Cannot read properties of undefined (reading 'time')",
		'    at show (https://logboox.app/_app/immutable/chunks/abc.js?v=3:12:34)',
		'    at blob:https://logboox.app/5f1c-uuid:1:200'
	].join('\n')
};

describe('isBug', () => {
	it('tells programming errors from messages written for the reader', () => {
		expect(isBug(new TypeError('x is undefined'))).toBe(true);
		expect(isBug(new RangeError('Invalid array length'))).toBe(true);
		expect(isBug('a string')).toBe(true);
		expect(isBug(new Error('This ZIP is not a backup made by this app.'))).toBe(false);
		expect(isBug(new DOMException('quota', 'QuotaExceededError'))).toBe(false);
		expect(isBug(new DOMException('proxy', 'DataCloneError'))).toBe(true);
	});

	it('is not a bug to be offline', () => {
		expect(isBug(new TypeError('Failed to fetch'))).toBe(false);
		expect(isBug(new TypeError('Load failed'))).toBe(false);
	});
});

describe('isNoise / isOurs', () => {
	it('ignores what a report would not help with', () => {
		expect(isNoise(describeError(new DOMException('x', 'AbortError')))).toBe(true);
		expect(isNoise({ name: 'Error', message: 'Script error.' })).toBe(true);
		expect(isNoise({ name: 'Error', message: 'ResizeObserver loop limit exceeded' })).toBe(true);
		expect(
			isNoise({ name: 'TypeError', message: 'Failed to fetch dynamically imported module: /x.js' })
		).toBe(true);
		expect(isNoise(v8)).toBe(false);
	});

	it('keeps errors from this origin and its inline worker only', () => {
		expect(isOurs(v8, ORIGIN)).toBe(true);
		expect(isOurs(v8, ORIGIN, `${ORIGIN}/_app/x.js`)).toBe(true);
		expect(isOurs(v8, ORIGIN, `blob:${ORIGIN}/uuid`)).toBe(true);
		expect(isOurs(v8, ORIGIN, 'chrome-extension://abc/content.js')).toBe(false);
		expect(
			isOurs({ name: 'Error', message: 'x', stack: 'at chrome-extension://abc' }, ORIGIN)
		).toBe(false);
		expect(isOurs({ name: 'Thrown value', message: 'x' }, ORIGIN)).toBe(false);
	});
});

describe('issueUrl', () => {
	const report = { error: v8, page: '/dash/[section]', version: 'abc123', browser: 'Firefox' };

	it('fills the template by field id', () => {
		const url = issueUrl(report);
		expect(url.startsWith('https://github.com/schliflo/logboox/issues/new?')).toBe(true);
		const f = fields(url);
		expect(f.template).toBe('bug_report.yml');
		expect(f.title).toBe("[Bug] TypeError: Cannot read properties of undefined (reading 'time')");
		expect(f.page).toBe('/dash/[section]');
		expect(f.version).toBe('abc123');
		expect(f.browser).toBe('Firefox');
	});

	it('drops hosts and query strings from the stack, and the repeated header', () => {
		expect(fields(issueUrl(report)).error).toBe(
			[
				"TypeError: Cannot read properties of undefined (reading 'time')",
				'    at show (/_app/immutable/chunks/abc.js:12:34)',
				'    at /5f1c-uuid:1:200'
			].join('\n')
		);
	});

	it('keeps the first frame of a stack that has no header', () => {
		const firefox = {
			name: 'TypeError',
			message: 'x is undefined',
			stack: 'show@https://a.b/c.js:1:2'
		};
		expect(fields(issueUrl({ ...report, error: firefox })).error).toBe(
			'TypeError: x is undefined\nshow@/c.js:1:2'
		);
	});

	it('leaves out the input a JSON error quotes', () => {
		const json = {
			name: 'SyntaxError',
			message: `Unexpected token 'x', "{"vin":"LXX123"}x" is not valid JSON`
		};
		const f = fields(issueUrl({ ...report, error: json }));
		expect(f.error).toBe(`SyntaxError: Unexpected token 'x', "…" is not valid JSON`);
		expect(f.title).not.toContain('LXX123');
	});

	it('stays short enough for GitHub to accept', () => {
		const huge = {
			name: 'RangeError',
			message: 'too deep',
			stack: Array.from({ length: 15 }, (_, i) => `    at f${i} (${'ü'.repeat(500)}.js:1:1)`).join(
				'\n'
			)
		};
		const url = issueUrl({ ...report, error: huge });
		expect(url.length).toBeLessThanOrEqual(6000);
		expect(fields(url).error.startsWith('RangeError: too deep')).toBe(true);
		expect(fields(url).error.endsWith('…')).toBe(true);
	});
});

describe('describeError / signature', () => {
	it('reads anything that can be thrown', () => {
		expect(describeError('nope')).toEqual({ name: 'Thrown value', message: 'nope' });
		expect(describeError(new TypeError('t')).stack).toContain('TypeError');
	});

	it('is the same wherever the app is served from', () => {
		const at = (host: string) => ({ name: 'Error', message: `Failed to fetch ${host}/api/v1/me` });
		expect(signature(at(ORIGIN))).toBe(signature(at('http://localhost:5173')));
	});
});
