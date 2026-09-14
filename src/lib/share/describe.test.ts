import { describe, expect, it } from 'vitest';
import { shareFigures, shareHeading, shareImageAlt, shareSummary } from './describe';

const trip = {
	kind: 'trip' as const,
	model: 'F30b',
	title: null,
	meta: {
		distanceKm: 101.42,
		duration: 4520,
		movingSeconds: 4200,
		maxSpeed: 131,
		avgSpeed: 87,
		energyKwh: 17.83,
		regenShare: 0.19,
		socStart: 82,
		socEnd: 41
	}
};

const charge = {
	kind: 'charging' as const,
	model: 'F30b',
	title: null,
	meta: {
		duration: 2100,
		kwhDelivered: 43.42,
		maxKw: 181.3,
		isDc: true,
		socStart: 18,
		socEnd: 82
	}
};

describe('shareHeading', () => {
	it('names a drive by its distance and a charge by its energy', () => {
		expect(shareHeading(trip)).toBe('A 101.4 km drive');
		expect(shareHeading(charge)).toBe('A 43.4 kWh charge');
	});

	it('prefers what the person called it', () => {
		expect(shareHeading({ ...trip, title: 'Down to the coast' })).toBe('Down to the coast');
	});

	it('has something to say about a whole month', () => {
		expect(shareHeading({ ...trip, kind: 'export' })).toBe('A month of driving');
	});
});

describe('shareSummary', () => {
	it('describes a drive', () => {
		expect(shareSummary(trip)).toBe(
			'101.4 km in 1 h 15 min, second by second, from an XPeng F30b.'
		);
	});

	it('describes a charge', () => {
		expect(shareSummary(charge)).toBe('43.4 kWh at up to 181.3 kW, from an XPeng F30b.');
	});

	it('names the model and nothing else about the car', () => {
		const sentence = shareSummary({ ...trip, meta: { ...trip.meta, vin: 'LVVDB21B8MD123456' } });
		expect(sentence).not.toContain('LVVDB');
		expect(sentence).toContain('F30b');
	});
});

describe('shareFigures', () => {
	it('gives four figures for a drive', () => {
		expect(shareFigures(trip)).toEqual([
			{ label: 'Distance', value: '101.4 km' },
			{ label: 'Duration', value: '1h 15m' },
			{ label: 'Top speed', value: '131 km/h' },
			{ label: 'Energy used', value: '17.8 kWh' }
		]);
	});

	it('gives four for a charge, including where the battery started and ended', () => {
		expect(shareFigures(charge)).toEqual([
			{ label: 'Delivered', value: '43.4 kWh' },
			{ label: 'Peak power', value: '181.3 kW' },
			{ label: 'State of charge', value: '18 → 82%' },
			{ label: 'Duration', value: '35m' }
		]);
	});

	it('leaves out a figure the share never carried, rather than printing a dash', () => {
		const figures = shareFigures({ ...trip, meta: { distanceKm: 101.42, duration: 4520 } });
		expect(figures.map((figure) => figure.label)).toEqual(['Distance', 'Duration']);
	});

	it('has nothing to show for a whole month', () => {
		expect(shareFigures({ ...trip, kind: 'export' })).toEqual([]);
	});
});

describe('shareImageAlt', () => {
	it('says which signal the card draws', () => {
		expect(shareImageAlt(trip)).toContain('Speed');
		expect(shareImageAlt(charge)).toContain('Charging power');
	});

	it('says which car, by model', () => {
		expect(shareImageAlt(trip)).toContain('from an XPeng F30b');
	});
});
