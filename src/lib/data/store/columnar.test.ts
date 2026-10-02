import { describe, expect, it } from 'vitest';
import { COLUMNS, type ColumnSpec } from '../schema/columns';
import { analyze } from '../analytics';
import { localDayKey, startOfLocalDay } from '../analytics/daily';
import { generateDemoDataset } from '../../demo/generator';
import {
	ColumnBuilder,
	firstAtOrAfter,
	restrictDataset,
	type Column,
	type Dataset
} from './columnar';

const TZ = 'Europe/Berlin';

function dataset(
	seconds: number[],
	columns: Record<string, (number | null)[]>,
	overrides: Partial<Dataset> = {}
): Dataset {
	const built = new Map<string, Column>();
	for (const [key, values] of Object.entries(columns)) {
		const builder = new ColumnBuilder(COLUMNS.get(key) as ColumnSpec, values.length);
		for (const value of values) builder.push(value === null ? NaN : value);
		built.set(key, builder.finish());
	}
	return {
		time: new Uint32Array(seconds),
		columns: built,
		vin: 'L1NTEST00000000001',
		vmodel: 'F30b',
		exportId: 'DA-test',
		available: { status: true, operation: true, power: true },
		duplicateRows: 3,
		undatedRows: 2,
		unsortedStreams: ['power'],
		emptyColumns: [],
		rowsParsed: seconds.length + 5,
		bytesParsed: 1234,
		aligned: true,
		...overrides
	};
}

describe('firstAtOrAfter', () => {
	const time = Uint32Array.from([10, 20, 20, 30]);

	it('finds the first sample at or after an instant', () => {
		expect(firstAtOrAfter(time, 5)).toBe(0);
		expect(firstAtOrAfter(time, 10)).toBe(0);
		expect(firstAtOrAfter(time, 11)).toBe(1);
		expect(firstAtOrAfter(time, 20)).toBe(1);
		expect(firstAtOrAfter(time, 30)).toBe(3);
		expect(firstAtOrAfter(time, 31)).toBe(4);
		expect(firstAtOrAfter(new Uint32Array(0), 5)).toBe(0);
	});

	it('rounds a fractional instant up to the next whole second', () => {
		expect(firstAtOrAfter(time, 10.5)).toBe(1);
		expect(firstAtOrAfter(time, 9.5)).toBe(0);
	});
});

describe('restrictDataset', () => {
	const full = dataset([100, 110, 120, 130, 140, 150], {
		esp_vehspd: [10, 50, null, 30, 90, 20],
		ldcu_bms_soc_disp: [80, 79, 78, null, null, null]
	});

	it('takes `from` inclusive and `to` exclusive', () => {
		const slice = restrictDataset(full, 110, 140);
		expect([...slice.time]).toEqual([110, 120, 130]);
		expect([...restrictDataset(full, 105, 141).time]).toEqual([110, 120, 130, 140]);
		expect(restrictDataset(full, 0, 100).time.length).toBe(0);
		expect(restrictDataset(full, 200, 300).time.length).toBe(0);
		expect([...restrictDataset(full, 0, 1000).time]).toEqual([...full.time]);
	});

	it('recounts each column for the samples it kept', () => {
		const slice = restrictDataset(full, 120, 160);
		const speed = slice.columns.get('esp_vehspd')!;
		expect(speed.nonNull).toBe(3);
		expect(speed.min).toBe(20);
		expect(speed.max).toBe(90);
		const soc = slice.columns.get('ldcu_bms_soc_disp')!;
		expect(soc.nonNull).toBe(1);
		expect(restrictDataset(full, 130, 160).columns.get('ldcu_bms_soc_disp')!.nonNull).toBe(0);
		expect(restrictDataset(full, 130, 160).emptyColumns).toEqual(['ldcu_bms_soc_disp']);
	});

	it('copies, so the full dataset survives the slice being transferred', () => {
		const slice = restrictDataset(full, 100, 1000);
		const buffers = [slice.time.buffer, ...[...slice.columns.values()].map((c) => c.data.buffer)];
		structuredClone(buffers, { transfer: buffers as ArrayBuffer[] });
		expect(slice.time.length).toBe(0);
		expect(full.time.length).toBe(6);
		expect(full.columns.get('esp_vehspd')!.data.length).toBe(6);
		expect(full.columns.get('esp_vehspd')!.max).toBe(90);
	});

	it('clips the coverage to the range and drops what falls outside it', () => {
		const merged = dataset(
			[100, 200, 900, 1000],
			{ esp_vehspd: [1, 2, 3, 4] },
			{
				coverage: [
					{ startTime: 100, endTime: 200, exportId: 'a' },
					{ startTime: 900, endTime: 1000, exportId: 'b' }
				]
			}
		);
		expect(restrictDataset(merged, 150, 950).coverage).toEqual([
			{ startTime: 150, endTime: 200, exportId: 'a' },
			{ startTime: 900, endTime: 950, exportId: 'b' }
		]);
		expect(restrictDataset(merged, 800, 2000).coverage).toEqual([
			{ startTime: 900, endTime: 1000, exportId: 'b' }
		]);
		expect(restrictDataset(full, 100, 1000).coverage).toBeUndefined();
	});

	it('keeps what describes the import as it was', () => {
		const slice = restrictDataset(full, 110, 140);
		expect(slice).toMatchObject({
			vin: full.vin,
			vmodel: full.vmodel,
			exportId: full.exportId,
			available: full.available,
			duplicateRows: 3,
			undatedRows: 2,
			unsortedStreams: ['power'],
			rowsParsed: 11,
			bytesParsed: 1234,
			aligned: true
		});
	});
});

/** Paths into an analysis that hold NaN or ±Infinity, with array positions folded. */
function nonFinitePaths(value: unknown, path = '', out = new Set<string>()): Set<string> {
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) out.add(path);
	} else if (Array.isArray(value) || ArrayBuffer.isView(value)) {
		for (const item of value as Iterable<unknown>) nonFinitePaths(item, `${path}[]`, out);
	} else if (value && typeof value === 'object') {
		for (const [key, item] of Object.entries(value)) nonFinitePaths(item, `${path}.${key}`, out);
	}
	return out;
}

describe('analysing a slice of the demonstration month', () => {
	const demo = generateDemoDataset({ timeZone: TZ });
	const baseline = nonFinitePaths(analyze(demo, TZ));
	const speed = demo.columns.get('esp_vehspd')!;

	/** An instant some way into a drive, so the slice begins with the car moving. */
	function whileDriving(after: number): number {
		for (let i = 0; i < demo.time.length; i++) {
			if (demo.time[i] > after && speed.data[i] * speed.spec.scale + speed.spec.offset > 40) {
				return demo.time[i] + 60;
			}
		}
		throw new Error('no drive found');
	}

	// A correlation across one day's readings is undefined, and both places
	// that print it check for that.
	const expected = new Set(['.tyres.temperatureCorrelation']);

	/** Every non-finite value the slice's analysis holds that the month's does not. */
	function newlyNonFinite(slice: Dataset): string[] {
		const derived = analyze(slice, TZ);
		return [...nonFinitePaths(derived)].filter(
			(path) => !baseline.has(path) && !expected.has(path)
		);
	}

	it('handles a single day', () => {
		const from = startOfLocalDay('2026-08-12', TZ);
		const slice = restrictDataset(demo, from, startOfLocalDay('2026-08-13', TZ));
		expect(slice.time.length).toBeGreaterThan(1);
		const derived = analyze(slice, TZ);
		expect(derived.days.filter((day) => day.covered).map((day) => day.date)).toEqual([
			'2026-08-12'
		]);
		expect(derived.recordedDays).toBe(1);
		expect(newlyNonFinite(slice)).toEqual([]);
	});

	it('handles a week', () => {
		const slice = restrictDataset(
			demo,
			startOfLocalDay('2026-08-10', TZ),
			startOfLocalDay('2026-08-17', TZ)
		);
		// From the first sample's day to the last sample's, and no day after it.
		const dates = analyze(slice, TZ).days.map((day) => day.date);
		expect(dates[0] >= '2026-08-10').toBe(true);
		expect(dates[dates.length - 1]).toBe(localDayKey(slice.time[slice.time.length - 1], TZ));
		expect(dates.length).toBeLessThanOrEqual(7);
		expect(newlyNonFinite(slice)).toEqual([]);
	});

	// The app never cuts like this: `snapToSpans` moves the edges off any drive
	// first, so a trip is shown whole or not at all. This pins what the raw cut
	// does when something calls it without snapping.
	it('clips the trips when called with edges in the middle of a drive (the app snaps first)', () => {
		const from = whileDriving(startOfLocalDay('2026-08-05', TZ));
		const to = whileDriving(startOfLocalDay('2026-08-09', TZ));
		const slice = restrictDataset(demo, from, to);
		const derived = analyze(slice, TZ);
		expect(derived.trips.length).toBeGreaterThan(0);
		for (const trip of derived.trips) {
			expect(trip.startTime).toBeGreaterThanOrEqual(from);
			expect(trip.endTime).toBeLessThan(to);
		}
		expect(newlyNonFinite(slice)).toEqual([]);
	});

	it('handles a range with a hole between two exports', () => {
		// Two stretches of the month joined as a merge would, nine days apart.
		const a = restrictDataset(demo, demo.time[0], startOfLocalDay('2026-08-10', TZ));
		const b = restrictDataset(demo, startOfLocalDay('2026-08-19', TZ), demo.time.at(-1)! + 1);
		const time = new Uint32Array(a.time.length + b.time.length);
		time.set(a.time);
		time.set(b.time, a.time.length);
		const columns = new Map<string, Column>();
		for (const [key, column] of a.columns) {
			const data = new (column.data.constructor as new (n: number) => Column['data'])(time.length);
			data.set(column.data as never);
			data.set(b.columns.get(key)!.data as never, a.time.length);
			columns.set(key, { ...column, data });
		}
		const merged: Dataset = {
			...demo,
			time,
			columns,
			coverage: [
				{ startTime: a.time[0], endTime: a.time.at(-1)!, exportId: 'a' },
				{ startTime: b.time[0], endTime: b.time.at(-1)!, exportId: 'b' }
			]
		};

		const slice = restrictDataset(
			merged,
			startOfLocalDay('2026-08-07', TZ),
			startOfLocalDay('2026-08-23', TZ)
		);
		expect(slice.coverage).toHaveLength(2);
		const derived = analyze(slice, TZ);
		expect(derived.days.filter((day) => !day.covered).map((day) => day.date)).toContain(
			'2026-08-15'
		);
		expect(derived.sources).toBe(2);
		expect(newlyNonFinite(slice)).toEqual([]);
	});
});
