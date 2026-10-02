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
import {
	MAX_SLICE_ROWS,
	SHARED_COLUMNS,
	decodeSlice,
	encodeSlice,
	manifestOf,
	sliceDataset
} from './slice';

const START = Math.floor(Date.UTC(2026, 6, 6, 5, 0) / 1000);

function column(key: string, seconds: number, valueAt: (i: number) => number | null) {
	const builder = new ColumnBuilder(COLUMNS.get(key)!, seconds);
	// The builder takes a physical value and reads NaN as "no reading".
	for (let i = 0; i < seconds; i++) builder.push(valueAt(i) ?? NaN);
	return builder.finish();
}

function dataset(
	seconds: number,
	speedAt: (i: number) => number | null,
	times: (i: number) => number = (i) => START + i
): Dataset {
	const time = new Uint32Array(seconds);
	for (let i = 0; i < seconds; i++) time[i] = times(i);

	return {
		time,
		columns: new Map([['esp_vehspd', column('esp_vehspd', seconds, speedAt)]]),
		vin: 'L1NTEST00000000001',
		vmodel: 'F30b',
		exportId: 'DA-test',
		available: { status: true, operation: true, power: true },
		duplicateRows: 0,
		undatedRows: 0,
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
		const slice = sliceDataset(month, 'trip', START + 600, START + 900, 30);

		expect(slice.time[0]).toBe(START + 570);
		expect(slice.time[slice.time.length - 1]).toBe(START + 930);
	});

	it('does not run off either end of the month', () => {
		const month = dataset(100, () => 50);
		const slice = sliceDataset(month, 'trip', START, START + 99, 30);

		expect(slice.time.length).toBe(100);
	});

	it('reports the range of the slice, not of the month it came from', () => {
		// Fast for the first half hour, slow afterwards; a slice of the slow part
		// must not inherit the month's 200 km/h maximum.
		const month = dataset(3600, (i) => (i < 1800 ? 200 : 30));
		const slice = sliceDataset(month, 'trip', START + 2000, START + 2500, 0);

		expect(slice.columns.get('esp_vehspd')!.max).toBe(30);
		expect(month.columns.get('esp_vehspd')!.max).toBe(200);
	});

	it('leaves out a signal the car never reported', () => {
		const month = dataset(600, () => null);
		expect(sliceDataset(month, 'trip', START, START + 300).columns.size).toBe(0);
	});

	it('carries the model and nothing that identifies the car', () => {
		const slice = sliceDataset(
			dataset(600, () => 50),
			'trip',
			START,
			START + 300
		);
		expect(slice.vmodel).toBe('F30b');
		expect(JSON.stringify(manifestOf(slice))).not.toContain('L1NTEST');
	});
});

describe('what a share carries', () => {
	function crowded(): Dataset {
		const month = dataset(600, () => 50);
		month.columns.set(
			'cdcu_totalodometer',
			column('cdcu_totalodometer', 600, () => 48213)
		);
		month.columns.set(
			'ldcu_driverdoorajarst',
			column('ldcu_driverdoorajarst', 600, () => 0)
		);
		month.columns.set(
			'ldcu_chrgpwr',
			column('ldcu_chrgpwr', 600, (i) => i % 50)
		);
		return month;
	}

	it('leaves out the odometer and the doors, whatever the dataset holds', () => {
		for (const kind of ['trip', 'charging'] as const) {
			const slice = sliceDataset(crowded(), kind, START, START + 300);
			expect(slice.columns.has('cdcu_totalodometer')).toBe(false);
			expect(slice.columns.has('ldcu_driverdoorajarst')).toBe(false);
			expect(JSON.stringify(manifestOf(slice))).not.toContain('odometer');
		}
	});

	it('does not publish them in the buffers either', async () => {
		const blobs = await encodeSlice(sliceDataset(crowded(), 'trip', START, START + 300));
		expect(blobs.map((blob) => blob.name).sort()).toEqual(['_time', 'esp_vehspd']);
	});

	it('carries each kind its own signals only', () => {
		expect([...sliceDataset(crowded(), 'trip', START, START + 300).columns.keys()]).toEqual([
			'esp_vehspd'
		]);
		expect([...sliceDataset(crowded(), 'charging', START, START + 300).columns.keys()]).toEqual([
			'ldcu_chrgpwr'
		]);
	});

	it('only names columns the registry knows', () => {
		for (const keys of Object.values(SHARED_COLUMNS)) {
			for (const key of keys) expect(COLUMNS.has(key)).toBe(true);
		}
	});
});

describe('the start of a slice', () => {
	it('begins at the first sample inside the padding, not the last one before it', () => {
		// Asleep for six hours, then a trip: the only older sample is hours stale.
		const wake = START + 6 * 3600;
		const month = dataset(
			200,
			() => 30,
			(i) => (i === 0 ? START : wake + i)
		);

		const slice = sliceDataset(month, 'trip', wake + 100, wake + 150, 30);

		expect(slice.time[0]).toBe(wake + 70);
	});

	it('does not reach back to a sample from before the padding', () => {
		const wake = START + 6 * 3600;
		const month = dataset(
			10,
			() => 30,
			(i) => (i === 0 ? START : wake + i)
		);

		// Nothing recorded in the 30 s before the trip but the sleeping sample.
		const slice = sliceDataset(month, 'trip', wake + 1, wake + 5, 30);

		expect(slice.time[0]).toBe(wake + 1);
		expect(Array.from(slice.time)).not.toContain(START);
	});

	it('keeps a sample that lands exactly on the lower bound', () => {
		const month = dataset(100, () => 30);
		expect(sliceDataset(month, 'trip', START + 50, START + 60, 30).time[0]).toBe(START + 20);
	});

	it('is empty, not inverted, when nothing falls inside', () => {
		const month = dataset(10, () => 30);
		const slice = sliceDataset(month, 'trip', START + 5000, START + 5100, 0);
		expect(slice.time.length).toBe(0);
	});
});

describe('a slice through compression and back', () => {
	it('arrives with the same readings it left with', async () => {
		const month = dataset(1200, (i) => (i % 7 === 0 ? null : i % 130));
		const slice = sliceDataset(month, 'trip', START + 100, START + 400, 0);

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
			'trip',
			START,
			START + 300
		);
		expect(() => decodeSlice(manifestOf(slice), 'F30b', new Map())).toThrow(/timeline/);
	});
});

describe('reading a blob someone else wrote', () => {
	function manifestFor(rows: number) {
		const slice = sliceDataset(
			dataset(rows, () => 50),
			'trip',
			START,
			START + rows
		);
		return { slice, manifest: manifestOf(slice) };
	}

	function forged(bytes: ArrayBuffer, claim: number): ArrayBuffer {
		const copy = bytes.slice(0);
		new DataView(copy).setUint32(copy.byteLength - 4, claim, true);
		return copy;
	}

	it('refuses a column whose trailer claims four gigabytes, before inflating', async () => {
		const { slice, manifest } = manifestFor(300);
		const blobs = new Map((await encodeSlice(slice)).map((blob) => [blob.name, blob.bytes]));
		blobs.set('esp_vehspd', forged(blobs.get('esp_vehspd')!, 0xffffffff));

		expect(() => decodeSlice(manifest, 'F30b', blobs)).toThrow(/size/);
	});

	it('refuses a timeline that claims more than the manifest has rows for', async () => {
		const { slice, manifest } = manifestFor(300);
		const blobs = new Map((await encodeSlice(slice)).map((blob) => [blob.name, blob.bytes]));
		blobs.set('_time', forged(blobs.get('_time')!, 300 * 4 + 1));

		expect(() => decodeSlice(manifest, 'F30b', blobs)).toThrow(/size/);
	});

	it('refuses one that claims less, which would leave a column shorter than the timeline', async () => {
		const { slice, manifest } = manifestFor(300);
		const blobs = new Map((await encodeSlice(slice)).map((blob) => [blob.name, blob.bytes]));
		blobs.set('esp_vehspd', forged(blobs.get('esp_vehspd')!, 10));

		expect(() => decodeSlice(manifest, 'F30b', blobs)).toThrow(/size/);
	});

	it('refuses a manifest claiming more rows than a trip could have', async () => {
		const { slice, manifest } = manifestFor(300);
		const blobs = new Map((await encodeSlice(slice)).map((blob) => [blob.name, blob.bytes]));

		expect(() => decodeSlice({ ...manifest, rows: MAX_SLICE_ROWS + 1 }, 'F30b', blobs)).toThrow(
			/larger/
		);
	});

	it('refuses a short payload whose trailer claims exactly the size it should have', async () => {
		// Ten rows inflate to ten rows; the trailer says three hundred, as the manifest does.
		const small = manifestFor(10);
		const real = new Map((await encodeSlice(small.slice)).map((blob) => [blob.name, blob.bytes]));
		const { manifest } = manifestFor(300);
		const blobs = new Map<string, ArrayBuffer>();
		for (const [name, bytes] of real) {
			const copy = bytes.slice(0);
			const view = new DataView(copy);
			view.setUint32(copy.byteLength - 4, view.getUint32(copy.byteLength - 4, true) * 30, true);
			blobs.set(name, copy);
		}

		expect(() => decodeSlice(manifest, 'F30b', blobs)).toThrow(/size/);
	});

	it('refuses bytes that are not gzip at all', async () => {
		const { slice, manifest } = manifestFor(300);
		const blobs = new Map((await encodeSlice(slice)).map((blob) => [blob.name, blob.bytes]));
		blobs.set('esp_vehspd', new Uint8Array(64).buffer);

		expect(() => decodeSlice(manifest, 'F30b', blobs)).toThrow(/not readable/);
	});

	it('refuses a dtype it has no view for', async () => {
		const { slice, manifest } = manifestFor(300);
		const blobs = new Map((await encodeSlice(slice)).map((blob) => [blob.name, blob.bytes]));
		const bent = structuredClone(manifest);
		(bent.columns[0].spec as { dtype: string }).dtype = 'f64';

		expect(() => decodeSlice(bent, 'F30b', blobs)).toThrow(/not readable/);
	});

	it('still reads an honest blob whose output is highly compressible', async () => {
		// Constant readings gzip to a few dozen bytes: the ratio is no reason to refuse.
		const { slice, manifest } = manifestFor(1200);
		const blobs = await encodeSlice(slice);
		const back = decodeSlice(
			manifest,
			'F30b',
			new Map(blobs.map((blob) => [blob.name, blob.bytes]))
		);
		expect(back.time.length).toBe(1200);
		expect(back.columns.get('esp_vehspd')!.data.length).toBe(1200);
	});
});
