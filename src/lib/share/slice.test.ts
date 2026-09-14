/**
 * Cutting a trip out of a month.
 *
 * The share page reads these bytes with no dataset, no registry lookup and no
 * export behind it, so what matters is that a slice round-trips: the same
 * samples, the same physical values, and a range that describes the slice
 * rather than the month it came from.
 */

import { describe, expect, it } from 'vitest';
import { COLUMNS } from '../data/schema/columns';
import { ColumnBuilder, valueAt, type Dataset } from '../data/store/columnar';
import { decodeSlice, encodeSlice, manifestOf, sliceDataset } from './slice';

const START = Math.floor(Date.UTC(2026, 6, 6, 5, 0) / 1000);

function dataset(seconds: number, speedAt: (i: number) => number | null): Dataset {
	const spec = COLUMNS.get('esp_vehspd')!;
	const builder = new ColumnBuilder(spec, seconds);
	const time = new Uint32Array(seconds);

	for (let i = 0; i < seconds; i++) {
		time[i] = START + i;
		// The builder takes a physical value and reads NaN as "no reading".
		const value = speedAt(i);
		builder.push(value === null ? NaN : value);
	}

	return {
		time,
		columns: new Map([['esp_vehspd', builder.finish()]]),
		vin: 'L1NTEST00000000001',
		vmodel: 'F30b',
		exportId: 'DA-test',
		available: { status: true, operation: true, power: true },
		duplicateRows: 0,
		unsortedStreams: [],
		emptyColumns: [],
		rowsParsed: seconds,
		bytesParsed: seconds * 10,
		aligned: true
	};
}

describe('slicing', () => {
	it('takes the window asked for, with padding on both sides', () => {
		const month = dataset(3600, (i) => i % 120);
		const slice = sliceDataset(month, START + 600, START + 900, 30);

		expect(slice.time[0]).toBe(START + 570);
		expect(slice.time[slice.time.length - 1]).toBe(START + 930);
	});

	it('does not run off either end of the month', () => {
		const month = dataset(100, () => 50);
		const slice = sliceDataset(month, START, START + 99, 30);

		expect(slice.time.length).toBe(100);
	});

	it('reports the range of the slice, not of the month it came from', () => {
		// Fast for the first half hour, slow afterwards; a slice of the slow part
		// must not inherit the month's 200 km/h maximum.
		const month = dataset(3600, (i) => (i < 1800 ? 200 : 30));
		const slice = sliceDataset(month, START + 2000, START + 2500, 0);

		expect(slice.columns.get('esp_vehspd')!.max).toBe(30);
		expect(month.columns.get('esp_vehspd')!.max).toBe(200);
	});

	it('leaves out a signal the car never reported', () => {
		const month = dataset(600, () => null);
		expect(sliceDataset(month, START, START + 300).columns.size).toBe(0);
	});

	it('carries the model and nothing that identifies the car', () => {
		const slice = sliceDataset(
			dataset(600, () => 50),
			START,
			START + 300
		);
		expect(slice.vmodel).toBe('F30b');
		expect(JSON.stringify(manifestOf(slice))).not.toContain('L1NTEST');
	});
});

describe('a slice through compression and back', () => {
	it('arrives with the same readings it left with', async () => {
		const month = dataset(1200, (i) => (i % 7 === 0 ? null : i % 130));
		const slice = sliceDataset(month, START + 100, START + 400, 0);

		const blobs = await encodeSlice(slice);
		const back = decodeSlice(
			manifestOf(slice),
			slice.vmodel,
			new Map(blobs.map((blob) => [blob.name, blob.bytes]))
		);

		expect(back.time).toEqual(slice.time);

		const before = slice.columns.get('esp_vehspd')!;
		const after = back.columns.get('esp_vehspd')!;
		expect(after.nonNull).toBe(before.nonNull);
		expect(after.min).toBe(before.min);
		expect(after.max).toBe(before.max);

		for (let i = 0; i < before.data.length; i++) {
			const left = valueAt(before, i);
			const right = valueAt(after, i);
			if (Number.isNaN(left)) expect(Number.isNaN(right)).toBe(true);
			else expect(right).toBe(left);
		}
	});

	it('refuses to rebuild one whose timeline is missing', () => {
		const slice = sliceDataset(
			dataset(600, () => 50),
			START,
			START + 300
		);
		expect(() => decodeSlice(manifestOf(slice), 'F30b', new Map())).toThrow(/timeline/);
	});
});
