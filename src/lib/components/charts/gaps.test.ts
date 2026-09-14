import { describe, expect, it } from 'vitest';
import { isolatedPoints, withGaps } from './gaps';

describe('withGaps', () => {
	it('turns a missing reading into the null uPlot draws a gap for', () => {
		expect(withGaps(new Float64Array([1, NaN, 3]))).toEqual([1, null, 3]);
	});

	it('leaves a series without gaps alone, zeroes included', () => {
		expect(withGaps(new Float64Array([0, -2.5, 4]))).toEqual([0, -2.5, 4]);
	});

	it('keeps the length, so it stays aligned with the timestamps', () => {
		const values = new Float64Array(1000).fill(NaN);
		values[500] = 7;
		const out = withGaps(values);
		expect(out).toHaveLength(1000);
		expect(out[500]).toBe(7);
		expect(out.filter((v) => v !== null)).toEqual([7]);
	});

	it('handles an empty series', () => {
		expect(withGaps(new Float64Array(0))).toEqual([]);
	});
});

describe('isolatedPoints', () => {
	it('finds a reading with a gap on either side', () => {
		expect(isolatedPoints([null, 5, null])).toEqual([1]);
	});

	it('leaves alone anything with a neighbour to be joined to', () => {
		expect(isolatedPoints([1, 2, 3])).toEqual([]);
		expect(isolatedPoints([1, 2, null, 3, 4])).toEqual([]);
	});

	it('counts past the ends as a gap', () => {
		// A single reading at the very start has no neighbour either.
		expect(isolatedPoints([5, null, 1, 2])).toEqual([0]);
		expect(isolatedPoints([1, 2, null, 9])).toEqual([3]);
	});

	it('finds every one of them, and only them', () => {
		// Index 4 has index 5 beside it, so it is drawn as part of a line.
		expect(isolatedPoints([1, null, 2, null, 3, 4, null, 5])).toEqual([0, 2, 7]);
	});

	it('treats a lone reading as isolated', () => {
		expect(isolatedPoints([7])).toEqual([0]);
	});

	it('has nothing to report for an empty or entirely absent series', () => {
		expect(isolatedPoints([])).toEqual([]);
		expect(isolatedPoints([null, null])).toEqual([]);
	});
});
