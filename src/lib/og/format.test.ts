import { describe, expect, it } from 'vitest';
import { duration, measure, num, shortDuration } from './format';

describe('num', () => {
	it('keeps the binary noise off the card', () => {
		expect(num(10.100000000000001, 1)).toBe('10.1');
	});

	it('groups thousands and pads to the asked precision', () => {
		expect(num(12345, 0)).toBe('12,345');
		expect(num(7, 2)).toBe('7.00');
	});

	it('says nothing rather than NaN', () => {
		expect(num(Number.NaN)).toBe('—');
		expect(num(Infinity)).toBe('—');
	});
});

describe('measure', () => {
	it('sets the unit off from the number', () => {
		expect(measure(43.42, 'kWh', 1)).toBe('43.4 kWh');
	});

	it('leaves out the space when there is no unit', () => {
		expect(measure(5, '')).toBe('5');
	});
});

describe('duration', () => {
	it('counts in seconds, minutes, then hours and minutes', () => {
		expect(duration(42)).toBe('42 s');
		expect(duration(35 * 60)).toBe('35 min');
		expect(duration(2 * 3600 + 5 * 60)).toBe('2 h 05 min');
	});

	it('refuses a negative or unknown span', () => {
		expect(duration(-1)).toBe('—');
		expect(duration(Number.NaN)).toBe('—');
	});
});

describe('shortDuration', () => {
	it('squeezes an overnight charge into a column', () => {
		expect(shortDuration(10 * 3600 + 55 * 60)).toBe('10h 55m');
		expect(shortDuration(35 * 60)).toBe('35m');
		expect(shortDuration(42)).toBe('42s');
	});

	it('refuses a negative or unknown span', () => {
		expect(shortDuration(Number.NaN)).toBe('—');
	});
});
