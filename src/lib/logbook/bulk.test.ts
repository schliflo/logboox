import { describe, expect, it } from 'vitest';
import type { Trip } from '../data/analytics/trips';
import { confidentFills } from './bulk';
import type { Annotation } from './types';

const ZONE = 'Europe/Berlin';
const VIN = 'L1NTEST00000000001';
/** A Monday, 07:00 in Berlin. */
const MONDAY_MORNING = Math.floor(Date.UTC(2026, 6, 6, 5, 0) / 1000);
const DAY = 86400;
const EVENING = 10 * 3600;

function trip(startTime: number, odoStart: number, distanceKm = 20): Trip {
	return {
		index: 0,
		start: 0,
		end: 100,
		startTime,
		endTime: startTime + 1800,
		duration: 1800,
		movingSeconds: 1500,
		distanceKm,
		odoStart,
		odoEnd: odoStart + distanceKm,
		avgSpeed: 48,
		maxSpeed: 110,
		maxSpeedTime: startTime + 900,
		socStart: 80,
		socEnd: 74,
		energyKwh: 4,
		regenKwh: 0.5,
		regenShare: 0.11,
		consumption: 17,
		peakAccel: 0.2,
		peakBrake: 0.3,
		peakLateral: 0.2,
		maxSpeedIndex: 50
	};
}

function note(startTime: number, fields: Partial<Annotation>): Annotation {
	return {
		vin: VIN,
		startTime,
		odoStart: null,
		origin: '',
		destination: '',
		purpose: '',
		comment: '',
		updatedAt: 1,
		deletedAt: null,
		...fields
	};
}

/** A week of commuting: out at 07:00 and back at 17:00, 20 km each way. */
function commute(days: number): Trip[] {
	const trips: Trip[] = [];
	let odo = 1000;
	for (let day = 0; day < days; day++) {
		trips.push(trip(MONDAY_MORNING + day * DAY, odo));
		odo += 20;
		trips.push(trip(MONDAY_MORNING + day * DAY + EVENING, odo));
		odo += 20;
	}
	return trips;
}

describe('confidentFills', () => {
	it('fills a commuting week from one labelled day, in order', () => {
		const trips = commute(3);
		const notes = new Map<number, Annotation>([
			[
				trips[0].startTime,
				note(trips[0].startTime, { origin: 'Home', destination: 'Office', purpose: 'commute' })
			],
			[
				trips[1].startTime,
				note(trips[1].startTime, { origin: 'Office', destination: 'Home', purpose: 'commute' })
			]
		]);

		const fills = confidentFills(trips, notes, VIN, ZONE);

		expect(fills.map((fill) => [fill.after.origin, fill.after.destination])).toEqual([
			['Home', 'Office'],
			['Office', 'Home'],
			['Home', 'Office'],
			['Office', 'Home']
		]);
		expect(fills.every((fill) => fill.after.purpose === 'commute')).toBe(true);
	});

	it('leaves alone what it cannot be sure of', () => {
		const trips = [...commute(1), trip(MONDAY_MORNING + 2 * DAY + 3 * 3600, 2000, 140)];
		const notes = new Map<number, Annotation>([
			[trips[0].startTime, note(trips[0].startTime, { origin: 'Home', destination: 'Office' })]
		]);

		const fills = confidentFills(trips, notes, VIN, ZONE);

		expect(fills.map((fill) => fill.trip.startTime)).not.toContain(trips[2].startTime);
	});

	it('keeps what was there for undoing, and never touches a labelled trip', () => {
		const trips = commute(2);
		const notes = new Map<number, Annotation>([
			[trips[0].startTime, note(trips[0].startTime, { origin: 'Home', destination: 'Office' })],
			[trips[1].startTime, note(trips[1].startTime, { origin: 'Office', destination: 'Home' })],
			[trips[3].startTime, note(trips[3].startTime, { comment: 'via the bakery' })]
		]);

		const fills = confidentFills(trips, notes, VIN, ZONE);
		const evening = fills.find((fill) => fill.trip.startTime === trips[3].startTime);

		expect(fills.some((fill) => fill.trip.startTime === trips[0].startTime)).toBe(false);
		expect(evening?.before.comment).toBe('via the bakery');
		expect(evening?.after.comment).toBe('via the bakery');
	});
	it('does not let one guess vouch for the next', () => {
		// Two labelled trips, then a run of drives that only loosely resemble them.
		const distances = [64, 66, 49, 52, 46, 58, 47, 55];
		let odo = 1000;
		const trips = distances.map((km, i) => {
			const t = trip(MONDAY_MORNING + Math.floor(i / 2) * DAY + (i % 2) * EVENING, odo, km);
			odo += km;
			return t;
		});
		const notes = new Map<number, Annotation>([
			[trips[0].startTime, note(trips[0].startTime, { origin: 'Home', destination: 'Office' })],
			[trips[1].startTime, note(trips[1].startTime, { origin: 'Office', destination: 'Home' })]
		]);

		const fills = confidentFills(trips, notes, VIN, ZONE);

		// 58 km is within a tenth of 64 and 66; nothing else is.
		expect(fills.every((fill) => fill.trip.distanceKm >= 57)).toBe(true);
		expect(fills.length).toBeLessThanOrEqual(2);
	});
});
