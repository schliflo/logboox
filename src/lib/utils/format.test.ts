import { afterEach, describe, expect, it } from 'vitest';
import { settings } from '../state/settings.svelte';
import { toConsumption, toDistance, units } from './format';

describe('miles', () => {
	afterEach(() => {
		settings.distanceUnit = 'km';
	});

	it('converts distance, speed and consumption', () => {
		settings.distanceUnit = 'mi';
		expect(toDistance(160.9344)).toBeCloseTo(100);
		expect(toConsumption(16)).toBeCloseTo(3.88, 2);
		expect(units()).toEqual({ distance: 'mi', speed: 'mph', consumption: 'mi/kWh' });
	});

	it('leaves kilometres alone', () => {
		settings.distanceUnit = 'km';
		expect(toDistance(42)).toBe(42);
		expect(toConsumption(16)).toBe(16);
	});
});
