/**
 * Reading a logbook back.
 *
 * The cases worth having are the ones a month of real driving produces and a
 * neat fixture does not: a route driven both ways, a place that is an origin
 * on some days and a destination on others, and the kilometres between one
 * trip's end and the next one's start that a tax logbook may not leave out.
 */

import { describe, expect, it } from 'vitest';
import type { Trip } from '../data/analytics/trips';
import type { Annotation, Purpose } from './types';
import { analyseLogbook } from './analytics';

const ZONE = 'Europe/Berlin';
/** A Monday, 07:00 in Berlin. */
const MONDAY = Math.floor(Date.UTC(2026, 6, 6, 5, 0) / 1000);
const DAY = 86400;

function trip(
	index: number,
	startTime: number,
	odoStart: number,
	options: { km?: number; seconds?: number; consumption?: number } = {}
): Trip {
	const km = options.km ?? 20;
	const seconds = options.seconds ?? 1800;
	return {
		index,
		start: 0,
		end: seconds,
		startTime,
		endTime: startTime + seconds,
		duration: seconds,
		movingSeconds: Math.round(seconds * 0.85),
		distanceKm: km,
		odoStart,
		odoEnd: odoStart + km,
		avgSpeed: (km / seconds) * 3600,
		maxSpeed: 110,
		maxSpeedTime: startTime + 600,
		socStart: 80,
		socEnd: 74,
		energyKwh: 4,
		regenKwh: 0.6,
		regenShare: 0.13,
		consumption: options.consumption ?? 17,
		peakAccel: 0.2,
		peakBrake: 0.3,
		peakLateral: 0.2,
		maxSpeedIndex: 0
	};
}

function note(
	startTime: number,
	origin: string,
	destination: string,
	purpose: Purpose | '' = ''
): Annotation {
	return {
		vin: 'L1NTEST00000000001',
		startTime,
		odoStart: null,
		origin,
		destination,
		purpose,
		comment: '',
		updatedAt: Date.now(),
		deletedAt: null
	};
}

function noteMap(entries: Annotation[]): Map<number, Annotation> {
	return new Map(entries.map((entry) => [entry.startTime, entry]));
}

/** Four working days out and back, the way the demo month drives. */
function commuteWeek(): { trips: Trip[]; notes: Annotation[] } {
	const trips: Trip[] = [];
	const notes: Annotation[] = [];
	let odo = 41000;

	for (let day = 0; day < 4; day++) {
		const out = MONDAY + day * DAY;
		const back = out + 9 * 3600;
		trips.push(trip(day * 2, out, odo, { km: 22, seconds: 1800 }));
		notes.push(note(out, 'Home', 'Office', 'commute'));
		odo += 22;
		trips.push(trip(day * 2 + 1, back, odo, { km: 22, seconds: 2100 }));
		notes.push(note(back, 'Office', 'Home', 'commute'));
		odo += 22;
	}

	return { trips, notes };
}

describe('what is written down and what is missing', () => {
	it('counts the labelled trips and the kilometres behind them', () => {
		const { trips, notes } = commuteWeek();
		const analysis = analyseLogbook(trips, noteMap(notes), ZONE);

		expect(analysis.coverage.trips).toBe(8);
		expect(analysis.coverage.labelled).toBe(8);
		expect(analysis.coverage.km).toBeCloseTo(176, 5);
		expect(analysis.coverage.labelledKm).toBeCloseTo(176, 5);
		expect(analysis.coverage.nextUnlabelled).toBeNull();
	});

	it('points at the first trip nobody has written down', () => {
		const { trips, notes } = commuteWeek();
		const analysis = analyseLogbook(trips, noteMap(notes.slice(0, 3)), ZONE);
		expect(analysis.coverage.nextUnlabelled).toBe(3);
	});

	it('finds the kilometres between one trip and the next', () => {
		// The car moved 15 km that no trip accounts for — the case a logbook
		// kept for tax is not allowed to have.
		const trips = [trip(0, MONDAY, 41000, { km: 20 }), trip(1, MONDAY + 3600, 41035, { km: 20 })];
		const analysis = analyseLogbook(trips, new Map(), ZONE);

		expect(analysis.coverage.gaps).toHaveLength(1);
		expect(analysis.coverage.gaps[0]).toMatchObject({ fromOdo: 41020, toOdo: 41035, km: 15 });
		expect(analysis.coverage.unrecordedKm).toBe(15);
	});

	it('does not call a rounded kilometre a gap', () => {
		const trips = [trip(0, MONDAY, 41000, { km: 20 }), trip(1, MONDAY + 3600, 41020.6, { km: 20 })];
		expect(analyseLogbook(trips, new Map(), ZONE).coverage.gaps).toEqual([]);
	});
});

describe('by purpose', () => {
	it('adds up distance, time and what the electricity cost', () => {
		const { trips, notes } = commuteWeek();
		const analysis = analyseLogbook(trips, noteMap(notes), ZONE, 0.32);

		const commute = analysis.purposes.find((p) => p.purpose === 'commute');
		expect(commute?.trips).toBe(8);
		expect(commute?.km).toBeCloseTo(176, 5);
		// Eight trips using 3.4 kWh each, at 32 cents.
		expect(commute?.kwh).toBeCloseTo(27.2, 5);
		expect(commute?.cost).toBeCloseTo(8.704, 3);
		expect(commute?.share).toBeCloseTo(1, 5);
	});

	it('keeps trips with no purpose apart from the rest', () => {
		const { trips, notes } = commuteWeek();
		const mixed = [...notes];
		mixed[0] = note(mixed[0].startTime, 'Home', 'Office');
		const analysis = analyseLogbook(trips, noteMap(mixed), ZONE);

		expect(analysis.purposes.find((p) => p.purpose === 'unlabelled')?.trips).toBe(1);
		expect(analysis.purposes.find((p) => p.purpose === 'commute')?.trips).toBe(7);
	});

	it('leaves out a purpose nobody used', () => {
		const { trips, notes } = commuteWeek();
		const analysis = analyseLogbook(trips, noteMap(notes), ZONE);
		expect(analysis.purposes.map((p) => p.purpose)).not.toContain('business');
	});
});

describe('routes', () => {
	it('gathers a route and reports the usual drive rather than the average one', () => {
		const trips = [
			trip(0, MONDAY, 41000, { seconds: 1800 }),
			trip(1, MONDAY + DAY, 41100, { seconds: 1500 }),
			// One crawl through roadworks, which an average would let dominate.
			trip(2, MONDAY + 2 * DAY, 41200, { seconds: 9000 })
		];
		const notes = trips.map((t) => note(t.startTime, 'Home', 'Office', 'commute'));
		const [route] = analyseLogbook(trips, noteMap(notes), ZONE).routes;

		expect(route.trips).toBe(3);
		expect(route.medianSeconds).toBe(1800);
		expect(route.fastestSeconds).toBe(1500);
		expect(route.fastestAt).toBe(MONDAY + DAY);
		expect(route.purpose).toBe('commute');
	});

	it('treats the way back as its own route', () => {
		const { trips, notes } = commuteWeek();
		const analysis = analyseLogbook(trips, noteMap(notes), ZONE);

		expect(analysis.routes).toHaveLength(2);
		expect(analysis.routes.map((r) => `${r.origin}-${r.destination}`).sort()).toEqual([
			'Home-Office',
			'Office-Home'
		]);
	});

	it('reads Home and home as the same place, and shows it as first written', () => {
		const trips = [trip(0, MONDAY, 41000), trip(1, MONDAY + DAY, 41100)];
		const notes = [note(MONDAY, 'Home', 'Office'), note(MONDAY + DAY, 'home ', ' office')];
		const analysis = analyseLogbook(trips, noteMap(notes), ZONE);

		expect(analysis.routes).toHaveLength(1);
		expect(analysis.routes[0].origin).toBe('Home');
		expect(analysis.routes[0].trips).toBe(2);
	});

	it('ignores a trip labelled at only one end', () => {
		const trips = [trip(0, MONDAY, 41000)];
		const analysis = analyseLogbook(trips, noteMap([note(MONDAY, 'Home', '')]), ZONE);
		expect(analysis.routes).toEqual([]);
		// It still counts as labelled, since something was written about it.
		expect(analysis.coverage.labelled).toBe(1);
	});

	it('counts weekdays and weekends separately', () => {
		const saturday = MONDAY + 5 * DAY;
		const trips = [trip(0, MONDAY, 41000), trip(1, saturday, 41100)];
		const notes = [note(MONDAY, 'Home', 'Shops'), note(saturday, 'Home', 'Shops')];
		const [route] = analyseLogbook(trips, noteMap(notes), ZONE).routes;

		expect(route.weekdayTrips).toBe(1);
		expect(route.weekendTrips).toBe(1);
	});
});

describe('places', () => {
	it('counts arrivals and departures, and places arrivals by when the trip ended', () => {
		const { trips, notes } = commuteWeek();
		const analysis = analyseLogbook(trips, noteMap(notes), ZONE);

		const home = analysis.places.find((p) => p.place === 'Home');
		expect(home?.departures).toBe(4);
		expect(home?.arrivals).toBe(4);

		// Home is arrived at in the evening: the return leaves at 16:00 Berlin
		// and takes 35 minutes, so it lands in Monday's 16:00 hour.
		const arrivals = home?.arrivalGrid.flat().reduce((sum, n) => sum + n, 0);
		expect(arrivals).toBe(4);
		expect(home?.arrivalGrid[1][16]).toBe(1);
	});

	it('ranks the busiest place first', () => {
		const trips = [trip(0, MONDAY, 41000), trip(1, MONDAY + DAY, 41100)];
		const notes = [note(MONDAY, 'Home', 'Office'), note(MONDAY + DAY, 'Home', 'Shops')];
		expect(analyseLogbook(trips, noteMap(notes), ZONE).places[0].place).toBe('Home');
	});
});

describe('the commute', () => {
	it('finds it once there are enough days both ways', () => {
		const { trips, notes } = commuteWeek();
		// Four days is under the threshold; a fifth makes it a habit.
		const fifth = MONDAY + 4 * DAY;
		trips.push(trip(8, fifth, 41200, { km: 22 }));
		notes.push(note(fifth, 'Home', 'Office', 'commute'));
		trips.push(trip(9, fifth + 9 * 3600, 41222, { km: 22 }));
		notes.push(note(fifth + 9 * 3600, 'Office', 'Home', 'commute'));

		const { commute } = analyseLogbook(trips, noteMap(notes), ZONE);
		expect(commute).not.toBeNull();
		expect(commute?.outbound.origin).toBe('Home');
		expect(commute?.inbound.origin).toBe('Office');
	});

	it('says nothing about a route driven a handful of times', () => {
		const { trips, notes } = commuteWeek();
		expect(analyseLogbook(trips, noteMap(notes), ZONE).commute).toBeNull();
	});

	it('measures how much the departure wanders', () => {
		const trips: Trip[] = [];
		const notes: Annotation[] = [];
		for (let day = 0; day < 5; day++) {
			// Out between 07:00 and 07:40, back at a fixed hour.
			const out = MONDAY + day * DAY + day * 600;
			trips.push(trip(day * 2, out, 41000 + day * 50));
			notes.push(note(out, 'Home', 'Office', 'commute'));
			const back = out + 9 * 3600;
			trips.push(trip(day * 2 + 1, back, 41020 + day * 50));
			notes.push(note(back, 'Office', 'Home', 'commute'));
		}

		const { commute } = analyseLogbook(trips, noteMap(notes), ZONE);
		expect(commute?.departureSpread).toBe(40);
	});
});

describe('an empty logbook', () => {
	it('says so without falling over', () => {
		const analysis = analyseLogbook([], new Map(), ZONE);
		expect(analysis.coverage).toMatchObject({ trips: 0, labelled: 0, nextUnlabelled: null });
		expect(analysis.routes).toEqual([]);
		expect(analysis.places).toEqual([]);
		expect(analysis.commute).toBeNull();
		expect(analysis.purposes).toEqual([]);
	});

	it('handles trips with nothing written against any of them', () => {
		const { trips } = commuteWeek();
		const analysis = analyseLogbook(trips, new Map(), ZONE);
		expect(analysis.coverage.labelled).toBe(0);
		expect(analysis.coverage.nextUnlabelled).toBe(0);
		expect(analysis.purposes).toHaveLength(1);
		expect(analysis.purposes[0].purpose).toBe('unlabelled');
	});
});
