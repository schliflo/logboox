import { describe, expect, it } from 'vitest';
import { withGaps } from './gaps';

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
