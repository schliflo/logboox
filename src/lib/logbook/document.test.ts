import { describe, expect, it } from 'vitest';
import type { Trip } from '../data/analytics/trips';
import type { Annotation } from './types';
import { logbookDocument } from './document';

const ZONE = 'Europe/Berlin';
const START = Math.floor(Date.UTC(2026, 8, 14, 6, 35) / 1000);

function trip(index: number, odoStart: number, km: number): Trip {
	return {
		index,
		start: 0,
		end: 0,
		startTime: START + index * 86400,
		endTime: START + index * 86400 + 3600,
		duration: 3600,
		movingSeconds: 3400,
		distanceKm: km,
		odoStart,
		odoEnd: odoStart + km,
		avgSpeed: km,
		maxSpeed: km + 20,
		maxSpeedTime: 0,
		socStart: 80,
		socEnd: 60,
		energyKwh: km * 0.18,
		regenKwh: 1,
		regenShare: 0.1,
		consumption: 18,
		peakAccel: 0.3,
		peakBrake: 0.3
	} as unknown as Trip;
}

function note(startTime: number, overrides: Partial<Annotation> = {}): Annotation {
	return {
		vin: 'VIN',
		startTime,
		odoStart: null,
		origin: 'Home',
		destination: 'Office',
		purpose: 'commute',
		comment: '',
		updatedAt: 0,
		deletedAt: null,
		...overrides
	};
}

describe('logbookDocument', () => {
	const trips = [trip(0, 41000, 40), trip(1, 41040, 60), trip(2, 41150, 30)];
	const notes = new Map<number, Annotation>([
		[trips[0].startTime, note(trips[0].startTime)],
		[trips[1].startTime, note(trips[1].startTime, { purpose: 'business', destination: 'Kraków' })]
	]);

	const book = logbookDocument(trips, notes, ZONE, 'F30b · L1N…001', 0.32);

	it('takes every trip, oldest first, whatever order it was handed them in', () => {
		const shuffled = logbookDocument([trips[2], trips[0], trips[1]], notes, ZONE, 'F30b');
		expect(shuffled.rows.map((row) => row.trip.index)).toEqual([0, 1, 2]);
		expect(shuffled.rows).toHaveLength(3);
	});

	it('joins each trip to whatever was written against it', () => {
		expect(book.rows[1].note?.destination).toBe('Kraków');
		expect(book.rows[2].note).toBeUndefined();
	});

	it('covers the span from the first departure to the last arrival', () => {
		expect(book.from).toBe(trips[0].startTime);
		expect(book.to).toBe(trips[2].endTime);
		expect(book.subtitle).toContain('F30b');
		expect(book.subtitle).toContain('14 September 2026');
		expect(book.subtitle).toContain('16 September 2026');
	});

	it('totals the distance overall and by purpose', () => {
		const labels = book.totals.map((total) => total.label);
		expect(labels).toContain('Trips');
		expect(labels).toContain('Commute');
		expect(labels).toContain('Business');
		expect(book.totals.find((total) => total.label === 'Distance')?.value).toBe('130.0 km');
		expect(book.totals.find((total) => total.label === 'Business')?.value).toBe(
			'60.0 km over 1 trip'
		);
	});

	it('says how many trips have nothing written against them', () => {
		expect(book.notes.join(' ')).toContain('1 of 3 trips have no origin or destination');
	});

	it('says how many kilometres the book cannot account for', () => {
		// Trip 1 ends at 41 100 and trip 2 starts at 41 150: fifty kilometres the
		// car moved without a recorded trip, which is exactly what a tax logbook
		// has to explain.
		expect(book.notes.join(' ')).toContain('50.0 km are unaccounted for');
		expect(book.notes.join(' ')).toContain('1 gap');
	});

	it('stays quiet when every kilometre is accounted for', () => {
		const tidy = [trip(0, 41000, 40), trip(1, 41040, 60)];
		const all = new Map(tidy.map((t) => [t.startTime, note(t.startTime)]));
		const complete = logbookDocument(tidy, all, ZONE, 'F30b');
		expect(complete.notes).toEqual([]);
	});

	it('writes a book for a month with nothing in it', () => {
		const empty = logbookDocument([], new Map(), ZONE, 'F30b');
		expect(empty.rows).toEqual([]);
		expect(empty.from).toBe(0);
		expect(empty.subtitle).toBe('F30b');
	});

	it('is called a Fahrtenbuch, which is what it is for', () => {
		expect(book.title).toBe('Fahrtenbuch');
	});
});
