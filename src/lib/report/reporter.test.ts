import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock('$app/env', () => ({ dev: false }));
vi.mock('$app/state', () => ({ page: { route: { id: '/dash/overview' } } }));
vi.mock('svelte-sonner', () => ({ toast }));
vi.stubGlobal('__COMMIT__', 'abc123');
vi.stubGlobal('navigator', { userAgent: 'Test' });

const { DataLoadError } = await import('../data/client');
const { bugDetail, reportUnexpected } = await import('./reporter');

describe('reportUnexpected', () => {
	beforeEach(() => toast.error.mockClear());

	it('asks once per kind of error, under one toast id', () => {
		const detail = { name: 'TypeError', message: 'x is undefined' };
		reportUnexpected(detail);
		reportUnexpected(detail);
		reportUnexpected({ name: 'TypeError', message: 'y is undefined' });
		expect(toast.error).toHaveBeenCalledTimes(2);
		expect(toast.error.mock.calls.every(([, options]) => options.id === 'error-report')).toBe(true);
	});

	it('links to an issue for the route it happened on', () => {
		reportUnexpected({ name: 'RangeError', message: 'z' }, '/s/[id]');
		const open = vi.fn();
		vi.stubGlobal('window', { open });
		toast.error.mock.calls[0][1].action.onClick();
		const url = new URL(open.mock.calls[0][0]);
		expect(url.searchParams.get('page')).toBe('/s/[id]');
		expect(url.searchParams.get('version')).toBe('abc123');
	});
});

describe('bugDetail', () => {
	it('trusts the worker on its own errors, and judges the rest', () => {
		const report = { name: 'TypeError', message: 'in the worker' };
		expect(bugDetail(new DataLoadError('No XPeng export files found.', 'hint'))).toBeUndefined();
		expect(bugDetail(new DataLoadError('in the worker', undefined, report))).toBe(report);
		expect(bugDetail(new TypeError('here'))?.message).toBe('here');
		expect(bugDetail(new Error('This ZIP is not a backup made by this app.'))).toBeUndefined();
	});
});
