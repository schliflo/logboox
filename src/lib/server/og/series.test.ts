import { describe, expect, it } from 'vitest';
import { decimate, toPath } from './series';

/** A ramp with an optional stretch of nothing in the middle. */
function ramp(length: number, gap?: [number, number]): { x: number[]; y: number[] } {
	const x = Array.from({ length }, (_, i) => i);
	const y = x.map((i) => (gap && i >= gap[0] && i < gap[1] ? Number.NaN : i));
	return { x, y };
}

describe('decimate', () => {
	it('leaves a short column alone', () => {
		const { x, y } = ramp(8);
		expect(decimate(x, y, 600)).toEqual({ x, y });
	});

	it('keeps the extremes rather than every nth sample', () => {
		// A spike one sample wide, in a column far longer than the budget.
		const y = new Array(4000).fill(10);
		y[1234] = 99;
		y[2345] = -7;
		const x = y.map((_, i) => i);

		const out = decimate(x, y, 200);
		expect(out.y.length).toBeLessThanOrEqual(200);
		expect(Math.max(...out.y)).toBe(99);
		expect(Math.min(...out.y)).toBe(-7);
	});

	it('emits each bucket low point then high point in the order they happened', () => {
		const y = [5, 1, 9, 4];
		const out = decimate([0, 1, 2, 3], y, 2);
		expect(out).toEqual({ x: [1, 2], y: [1, 9] });
	});

	it('turns a stretch of nothing into a single break', () => {
		const { x, y } = ramp(400, [100, 300]);
		const out = decimate(x, y, 40);
		const breaks = out.y.filter(Number.isNaN);
		expect(breaks).toHaveLength(1);
		expect(out.y.filter((v) => !Number.isNaN(v))).not.toHaveLength(0);
	});

	it('keeps the readings in a bucket that also holds a dropout', () => {
		const out = decimate([0, 1, 2, 3], [1, Number.NaN, 3, 4], 2);
		expect(out.y.some(Number.isNaN)).toBe(false);
		expect(out.y).toContain(4);
	});

	it('drops a break that would trail the line', () => {
		const out = decimate([0, 1, 2, 3], [1, 2, Number.NaN, Number.NaN], 4);
		expect(out.y.at(-1)).toBe(2);
	});

	it('returns nothing for an empty column', () => {
		expect(decimate([], [], 600)).toEqual({ x: [], y: [] });
	});
});

describe('toPath', () => {
	it('spans the strip and inverts the vertical axis', () => {
		const { line } = toPath({ x: [0, 10], y: [0, 100] }, { width: 1200, height: 150 });
		// Lowest value at the floor, highest at the top inset, left edge to right.
		expect(line).toBe('M0,132L1200,22');
	});

	it('closes the area to the foot of the strip', () => {
		const { area } = toPath({ x: [0, 10], y: [0, 100] });
		expect(area).toBe('M0,132L0,132L1200,22L1200,132Z');
	});

	it('starts a new subpath after a break', () => {
		const { line, area } = toPath({
			x: [0, 1, 2, 3, 4],
			y: [0, 100, Number.NaN, 50, 0]
		});
		expect(line.match(/M/g)).toHaveLength(2);
		expect(area.match(/Z/g)).toHaveLength(2);
	});

	it('draws a flat column down the middle instead of dividing by nothing', () => {
		const { line } = toPath({ x: [0, 1], y: [7, 7] }, { height: 150 });
		expect(line).toBe('M0,77L1200,77');
	});

	it('draws nothing from a single reading', () => {
		expect(toPath({ x: [0, 1], y: [Number.NaN, 5] })).toEqual({ line: '', area: '' });
	});

	it('draws nothing at all from an empty column', () => {
		expect(toPath({ x: [], y: [] })).toEqual({ line: '', area: '' });
	});
});
