/**
 * Narrowing the dashboard to a range, and where an export opens.
 *
 * The worker, the library, the account and the router are replaced: what is
 * under test is the store deciding what to analyse, what to keep on screen
 * while it waits, and which answer wins.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dataset } from '../data/store/columnar';
import type { DerivedData } from '../data/analytics';
import { startOfLocalDay } from '../data/analytics/daily';
import type { TimeRange } from '../data/range';

const TZ = 'Europe/Berlin';

const mocks = vi.hoisted(() => ({
	analyzeView: vi.fn(),
	openKept: vi.fn(),
	goto: vi.fn(),
	toast: vi.fn()
}));

vi.mock('$app/env', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('svelte-sonner', () => ({ toast: mocks.toast }));
vi.mock('../data/client', () => ({
	analyzeView: mocks.analyzeView,
	openKept: mocks.openKept,
	loadDemo: vi.fn(),
	loadFiles: vi.fn(),
	openShared: vi.fn()
}));
vi.mock('./account.svelte', () => ({ account: { signedIn: false, user: null } }));
vi.mock('./history.svelte', () => ({
	history: { entries: [], refresh: vi.fn(), requestPersistence: vi.fn(), sync: vi.fn() }
}));
vi.mock('./settings.svelte', () => ({ settings: { timeZone: 'Europe/Berlin' } }));

const { data } = await import('./dataset.svelte');

const STEP = 600;

/** A sample every ten minutes, from the first local midnight of `firstDay`. */
function dataset(firstDay: string, days: number): Dataset {
	const start = startOfLocalDay(firstDay, TZ);
	const time = new Uint32Array(days * 144);
	for (let i = 0; i < time.length; i++) time[i] = start + i * STEP;
	return {
		time,
		columns: new Map(),
		vin: 'L1NTEST00000000001',
		vmodel: 'F30b',
		exportId: 'x',
		available: {},
		duplicateRows: 0,
		undatedRows: 0,
		unsortedStreams: [],
		emptyColumns: [],
		rowsParsed: time.length,
		bytesParsed: 0,
		aligned: true
	} as unknown as Dataset;
}

/** Just what the store reads: the extent, and the trips and charges a range must not cut. */
function derivedFor(
	set: Dataset,
	trips: Array<{ startTime: number; endTime: number }> = []
): DerivedData {
	return {
		startTime: set.time[0],
		endTime: set.time[set.time.length - 1],
		days: [],
		trips,
		charging: { sessions: [] }
	} as unknown as DerivedData;
}

async function open(set: Dataset, trips: Array<{ startTime: number; endTime: number }> = []) {
	const derived = derivedFor(set, trips);
	mocks.openKept.mockResolvedValue({ dataset: set, derived });
	await data.open(['kept']);
	return derived;
}

const day = (date: string) => startOfLocalDay(date, TZ);
const range = (from: string, to: string, preset = 'custom'): TimeRange => ({
	from: day(from),
	to: day(to),
	label: `${from} – ${to}`,
	preset
});

beforeEach(() => {
	data.reset();
	mocks.analyzeView.mockReset();
	mocks.analyzeView.mockImplementation(async (slice: Dataset) => ({
		dataset: slice,
		derived: derivedFor(slice)
	}));
	mocks.openKept.mockReset();
	mocks.goto.mockReset();
	mocks.toast.mockReset();
});

describe('setRange', () => {
	it('shows everything, without a copy, for a range around every sample', async () => {
		const set = dataset('2026-08-10', 5);
		await open(set);

		await data.setRange(range('2026-08-01', '2026-09-01'));

		expect(mocks.analyzeView).not.toHaveBeenCalled();
		expect(data.range).toBeNull();
		expect(data.dataset).toBe(data.full!.dataset);
		expect(data.derived).toBe(data.full!.derived);
	});

	it('clears a range already set when asked for one around everything', async () => {
		await open(dataset('2026-08-10', 5));
		await data.setRange(range('2026-08-11', '2026-08-12'));
		expect(data.range).not.toBeNull();

		await data.setRange(range('2026-08-01', '2026-09-01'));

		expect(data.range).toBeNull();
		expect(data.dataset).toBe(data.full!.dataset);
		expect(data.refining).toBe(false);
	});

	it('keeps a drive that crosses the edge whole, with the day it began', async () => {
		const set = dataset('2026-08-10', 5);
		const edge = day('2026-08-12');
		// Starts before midnight, ends an hour after it.
		const drive = { startTime: edge - 1800, endTime: edge + 3600 };
		await open(set, [drive]);

		await data.setRange(range('2026-08-11', '2026-08-12'));

		const slice = mocks.analyzeView.mock.calls[0][0] as Dataset;
		expect(slice.time[slice.time.length - 1]).toBeGreaterThanOrEqual(drive.endTime);
		expect(slice.time[0]).toBeGreaterThanOrEqual(day('2026-08-11'));
		expect(data.range?.label).toBe('2026-08-11 – 2026-08-12');
	});

	it('shows the range as asked, cutting the drive, when one drive covers all of it', async () => {
		const set = dataset('2026-08-10', 5);
		const drive = { startTime: day('2026-08-11') - 3600, endTime: day('2026-08-13') };
		await open(set, [drive]);

		await data.setRange(range('2026-08-11', '2026-08-12'));

		// Snapped, the range would be empty and the reader told nothing was recorded.
		expect(mocks.toast).not.toHaveBeenCalled();
		const slice = mocks.analyzeView.mock.calls[0][0] as Dataset;
		expect(slice.time.length).toBeGreaterThan(100);
		expect(data.range).not.toBeNull();
	});

	it('lets a slower earlier request be overtaken by a newer one', async () => {
		await open(dataset('2026-08-10', 5));
		const pending: Array<(value: unknown) => void> = [];
		mocks.analyzeView.mockImplementation(
			(slice: Dataset) =>
				new Promise((resolve) => {
					pending.push(() => resolve({ dataset: slice, derived: derivedFor(slice) }));
				})
		);

		const first = data.setRange(range('2026-08-10', '2026-08-11', 'first'));
		await vi.waitFor(() => expect(pending).toHaveLength(1));
		const second = data.setRange(range('2026-08-12', '2026-08-13', 'second'));
		await vi.waitFor(() => expect(pending).toHaveLength(2));

		pending[1](null);
		await second;
		expect(data.range?.preset).toBe('second');
		expect(data.refining).toBe(false);

		pending[0](null);
		await first;
		expect(data.range?.preset).toBe('second');
		expect(data.dataset!.time[0]).toBeGreaterThanOrEqual(day('2026-08-12'));
	});

	it('says so, and keeps the view, when fewer than two samples fall in the range', async () => {
		await open(dataset('2026-08-10', 5));
		await data.setRange(range('2026-08-11', '2026-08-12', 'before'));
		const shown = data.dataset;

		await data.setRange(range('2026-09-01', '2026-09-02'));

		expect(mocks.toast).toHaveBeenCalledTimes(1);
		expect(mocks.analyzeView).toHaveBeenCalledTimes(1);
		expect(data.dataset).toBe(shown);
		expect(data.range?.preset).toBe('before');
		expect(data.refining).toBe(false);
	});

	it('leaves view and range as they were when the worker fails', async () => {
		await open(dataset('2026-08-10', 5));
		await data.setRange(range('2026-08-11', '2026-08-12', 'before'));
		const shown = data.dataset;
		mocks.analyzeView.mockRejectedValue(new Error('worker died'));

		await data.setRange(range('2026-08-13', '2026-08-14'));

		expect(mocks.toast).toHaveBeenCalledWith('That range could not be shown', expect.anything());
		expect(data.dataset).toBe(shown);
		expect(data.range?.preset).toBe('before');
		expect(data.refining).toBe(false);
	});

	it('is marked as refining before any slice is made', async () => {
		await open(dataset('2026-08-10', 5));
		let during: boolean | null = null;
		mocks.analyzeView.mockImplementation(async (slice: Dataset) => {
			during = data.refining;
			return { dataset: slice, derived: derivedFor(slice) };
		});

		const pending = data.setRange(range('2026-08-11', '2026-08-12'));
		expect(data.refining).toBe(true);
		await pending;

		expect(during).toBe(true);
		expect(data.refining).toBe(false);
	});
});

describe('reveal', () => {
	it('widens the view to reach a trip the range left out', async () => {
		const trip = { startTime: day('2026-08-10') + 3600, endTime: day('2026-08-10') + 7200 };
		await open(dataset('2026-08-10', 5), [trip]);
		await data.setRange(range('2026-08-12', '2026-08-13'));
		expect(data.range).not.toBeNull();

		expect(data.reveal('trip', trip.startTime)).toBe(true);

		await vi.waitFor(() => expect(data.range).toBeNull());
		expect(data.dataset).toBe(data.full!.dataset);
	});

	it('does nothing for a trip that is in no range, or for one already in view', async () => {
		const trip = { startTime: day('2026-08-12') + 3600, endTime: day('2026-08-12') + 7200 };
		await open(dataset('2026-08-10', 5), [trip]);
		await data.setRange(range('2026-08-12', '2026-08-13'));
		const shown = data.dataset;

		expect(data.reveal('trip', 123)).toBe(false);
		expect(data.reveal('charging', trip.startTime)).toBe(false);
		expect(data.dataset).toBe(shown);
	});
});

describe('where an export opens', () => {
	it('lands on the last thirty days of two months', async () => {
		await open(dataset('2026-07-01', 60));

		expect(data.range?.preset).toBe('last-30');
		expect(data.dataset!.time.length).toBeLessThan(data.full!.dataset.time.length);
		expect(data.dataset!.time[0]).toBeGreaterThanOrEqual(day('2026-07-31'));
	});

	it('shows everything for an export of twenty-nine days, which the last thirty cover', async () => {
		await open(dataset('2026-08-01', 29));

		expect(data.range).toBeNull();
		expect(mocks.analyzeView).not.toHaveBeenCalled();
		expect(data.dataset).toBe(data.full!.dataset);
	});

	it('lands on the last seven days of twenty', async () => {
		await open(dataset('2026-08-01', 20));

		expect(data.range?.preset).toBe('last-7');
		expect(data.dataset!.time[0]).toBeGreaterThanOrEqual(day('2026-08-14'));
	});

	it('shows everything for five days', async () => {
		await open(dataset('2026-08-01', 5));

		expect(data.range).toBeNull();
		expect(mocks.analyzeView).not.toHaveBeenCalled();
	});

	it('is in place before the first page is shown', async () => {
		let atNavigation: string | undefined = 'unset';
		mocks.goto.mockImplementation(async () => {
			atNavigation = data.range?.preset;
		});

		await open(dataset('2026-07-01', 60));

		expect(mocks.goto).toHaveBeenCalledWith('/dash/overview');
		expect(atNavigation).toBe('last-30');
	});

	it('keeps the whole export, without a word, when the default cannot be applied', async () => {
		mocks.analyzeView.mockRejectedValue(new Error('worker died'));

		await open(dataset('2026-07-01', 60));

		expect(data.status).toBe('ready');
		expect(data.range).toBeNull();
		expect(data.dataset).toBe(data.full!.dataset);
		expect(mocks.toast).not.toHaveBeenCalled();
		expect(mocks.goto).toHaveBeenCalledWith('/dash/overview');
	});
});
