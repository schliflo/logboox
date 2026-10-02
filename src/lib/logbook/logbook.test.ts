/**
 * Notes, and finding them again.
 *
 * The cases that matter are the ones a merge produces: a trip that was clipped
 * at the end of an export window and is now longer, a pair that a logging gap
 * had split, and a start that moved by a second. In all of them the note has to
 * end up on the right trip, and in none of them may it end up on the wrong one.
 */

import { describe, expect, it } from 'vitest';
import type { Trip } from '../data/analytics/trips';
import { logbookCsv } from './csv';
import { bindAnnotations, knownPlaces } from './keys';
import { suggestDestinations, suggestOrigin, suggestPurpose } from './suggest';
import type { Annotation } from './types';

const ZONE = 'Europe/Berlin';
/** A Monday, 07:00 in Berlin. */
const MONDAY_MORNING = Math.floor(Date.UTC(2026, 6, 6, 5, 0) / 1000);
const DAY = 86400;

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

function note(
	startTime: number,
	odoStart: number | null,
	fields: Partial<Annotation> = {}
): Annotation {
	return {
		vin: 'L1NTEST00000000001',
		startTime,
		odoStart,
		origin: '',
		destination: '',
		purpose: '',
		comment: '',
		updatedAt: 1,
		deletedAt: null,
		...fields
	};
}

describe('binding a note to a trip', () => {
	it('matches on the start time when nothing has moved', () => {
		const trips = [trip(MONDAY_MORNING, 41000)];
		const bound = bindAnnotations(trips, [note(MONDAY_MORNING, 41000, { comment: 'Rain' })]);

		expect(bound.byTrip.get(MONDAY_MORNING)?.comment).toBe('Rain');
		expect(bound.rebound).toHaveLength(0);
		expect(bound.orphans).toHaveLength(0);
	});

	it('follows a trip whose start moved when exports were merged', () => {
		// The merged timeline had a second the first export lacked, so detection
		// starts the trip two seconds earlier than the note was written against.
		const trips = [trip(MONDAY_MORNING - 2, 41000)];
		const bound = bindAnnotations(trips, [note(MONDAY_MORNING, 41000, { comment: 'Rain' })]);

		expect(bound.byTrip.get(MONDAY_MORNING - 2)?.comment).toBe('Rain');
		expect(bound.rebound).toEqual([
			{ from: MONDAY_MORNING, entry: expect.objectContaining({ startTime: MONDAY_MORNING - 2 }) }
		]);
	});

	it('will not attach a note to a trip that merely starts nearby', () => {
		// Same minute, different journey: the odometer says the car had moved
		// twenty kilometres in between.
		const trips = [trip(MONDAY_MORNING + 60, 41020)];
		const bound = bindAnnotations(trips, [note(MONDAY_MORNING, 41000, { comment: 'Rain' })]);

		expect(bound.byTrip.size).toBe(0);
		expect(bound.orphans).toHaveLength(1);
	});

	it('will not guess when the note has no odometer reading to go on', () => {
		const trips = [trip(MONDAY_MORNING - 2, 41000)];
		const bound = bindAnnotations(trips, [note(MONDAY_MORNING, null, { comment: 'Rain' })]);

		expect(bound.orphans).toHaveLength(1);
	});

	it('keeps a note whose trip is not in this dataset at all', () => {
		const bound = bindAnnotations(
			[trip(MONDAY_MORNING, 41000)],
			[note(MONDAY_MORNING - 40 * DAY, 30000, { comment: 'Last month' })]
		);

		expect(bound.orphans).toHaveLength(1);
		expect(bound.byTrip.size).toBe(0);
	});

	it('never puts two notes on one trip', () => {
		const trips = [trip(MONDAY_MORNING, 41000)];
		const bound = bindAnnotations(trips, [
			note(MONDAY_MORNING, 41000, { comment: 'Exact' }),
			note(MONDAY_MORNING + 5, 41000, { comment: 'Close' })
		]);

		expect(bound.byTrip.get(MONDAY_MORNING)?.comment).toBe('Exact');
		expect(bound.orphans.map((entry) => entry.comment)).toEqual(['Close']);
	});

	it('ignores a note that was deleted', () => {
		const bound = bindAnnotations(
			[trip(MONDAY_MORNING, 41000)],
			[note(MONDAY_MORNING, 41000, { comment: 'Gone', deletedAt: 2 })]
		);
		expect(bound.byTrip.size).toBe(0);
	});
});

describe('places already written down', () => {
	it('offers the most used first', () => {
		const places = knownPlaces([
			note(1, null, { origin: 'Home', destination: 'Office' }),
			note(2, null, { origin: 'Office', destination: 'Home' }),
			note(3, null, { origin: 'Home', destination: 'Pool' })
		]);
		expect(places.slice(0, 2)).toEqual(['Home', 'Office']);
		expect(places).toContain('Pool');
	});
});

describe('suggesting where a trip started', () => {
	it('uses the odometer: a car that has not moved is where it was left', () => {
		const morning = trip(MONDAY_MORNING, 41000);
		const evening = trip(MONDAY_MORNING + 9 * 3600, 41020);
		const notes = new Map([
			[
				morning.startTime,
				note(morning.startTime, 41000, {
					origin: 'Home',
					destination: 'Office'
				})
			]
		]);

		const suggestions = suggestOrigin(evening, [morning, evening], notes, ZONE);
		expect(suggestions[0]).toMatchObject({ value: 'Office', reason: 'where the last trip ended' });
	});

	it('does not claim that when the car moved in between', () => {
		const morning = trip(MONDAY_MORNING, 41000);
		// Starts 30 km further on than the morning trip finished.
		const evening = trip(MONDAY_MORNING + 9 * 3600, 41050);
		const notes = new Map([
			[
				morning.startTime,
				note(morning.startTime, 41000, {
					origin: 'Home',
					destination: 'Office'
				})
			]
		]);

		const suggestions = suggestOrigin(evening, [morning, evening], notes, ZONE);
		expect(suggestions[0]?.reason).not.toBe('where the last trip ended');
	});
});

describe('suggesting where a trip went', () => {
	/** A week of the same commute, labelled. */
	function commuteWeek() {
		const trips: Trip[] = [];
		const notes = new Map<number, Annotation>();
		for (let day = 0; day < 4; day++) {
			const out = trip(MONDAY_MORNING + day * DAY, 41000 + day * 40, 22);
			trips.push(out);
			notes.set(
				out.startTime,
				note(out.startTime, out.odoStart, {
					origin: 'Home',
					destination: 'Office',
					purpose: 'commute'
				})
			);
		}
		return { trips, notes };
	}

	it('offers the usual destination for the usual trip', () => {
		const { trips, notes } = commuteWeek();
		const friday = trip(MONDAY_MORNING + 4 * DAY, 41160, 22);

		const suggestions = suggestDestinations(friday, [...trips, friday], notes, ZONE, 'Home');
		expect(suggestions[0].value).toBe('Office');
	});

	it('offers the way back when setting off from where a known trip arrived', () => {
		const { trips, notes } = commuteWeek();
		const homeward = trip(MONDAY_MORNING + 9 * 3600, 41022, 22);

		const suggestions = suggestDestinations(homeward, [...trips, homeward], notes, ZONE, 'Office');
		expect(suggestions[0]).toMatchObject({ value: 'Home', reason: 'the way back' });
	});

	it('has nothing to say about a trip unlike any other', () => {
		const { trips, notes } = commuteWeek();
		const roadtrip = trip(MONDAY_MORNING + 5 * DAY + 4 * 3600, 41200, 280);

		expect(suggestDestinations(roadtrip, [...trips, roadtrip], notes, ZONE, '')).toHaveLength(0);
	});

	it('says nothing at all until something has been written down', () => {
		const lonely = trip(MONDAY_MORNING, 41000);
		expect(suggestDestinations(lonely, [lonely], new Map(), ZONE, 'Home')).toHaveLength(0);
		expect(suggestOrigin(lonely, [lonely], new Map(), ZONE)).toHaveLength(0);
	});
});

describe('suggesting why', () => {
	it('reads the habit from trips at the same hour on the same sort of day', () => {
		const trips: Trip[] = [];
		const notes = new Map<number, Annotation>();
		for (let day = 0; day < 3; day++) {
			const out = trip(MONDAY_MORNING + day * DAY, 41000 + day * 40, 22);
			trips.push(out);
			notes.set(out.startTime, note(out.startTime, out.odoStart, { purpose: 'commute' }));
		}

		const next = trip(MONDAY_MORNING + 3 * DAY, 41120, 22);
		expect(suggestPurpose(next, [...trips, next], notes, ZONE)).toBe('commute');
	});

	it('offers nothing for a trip at an hour with no habit', () => {
		const trips = [trip(MONDAY_MORNING, 41000)];
		const notes = new Map([[MONDAY_MORNING, note(MONDAY_MORNING, 41000, { purpose: 'commute' })]]);
		const midnight = trip(MONDAY_MORNING + 16 * 3600, 41100);

		expect(suggestPurpose(midnight, [...trips, midnight], notes, ZONE)).toBe('');
	});
});

describe('the logbook as a file', () => {
	it('writes a header and one row per trip', () => {
		const out = logbookCsv(
			[
				{
					trip: trip(MONDAY_MORNING, 41000, 22.4),
					note: note(MONDAY_MORNING, 41000, {
						origin: 'Home',
						destination: 'Office',
						purpose: 'commute',
						comment: 'Rain'
					})
				}
			],
			ZONE
		);

		const lines = out.replace('﻿', '').trim().split('\r\n');
		expect(lines[0].startsWith('Date;Start;End')).toBe(true);
		// The odometer signal is whole kilometres, so it is written as read; the
		// distance is the one that keeps a decimal.
		expect(lines[1]).toContain('41000;41022;22,4');
		expect(lines[1]).toContain('Home;Office;commute;Rain');
	});

	it('quotes a field that would otherwise break the row apart', () => {
		const out = logbookCsv(
			[
				{
					trip: trip(MONDAY_MORNING, 41000),
					note: note(MONDAY_MORNING, 41000, { comment: 'Stopped; waited 10"' })
				}
			],
			ZONE
		);
		expect(out).toContain('"Stopped; waited 10"""');
	});

	it('leaves the columns of an unlabelled trip empty rather than absent', () => {
		const out = logbookCsv([{ trip: trip(MONDAY_MORNING, 41000), note: undefined }], ZONE);
		const row = out.replace('﻿', '').trim().split('\r\n')[1];
		expect(row.split(';')).toHaveLength(11);
	});

	it('starts with a byte-order mark, so Excel reads it as UTF-8', () => {
		expect(logbookCsv([], ZONE).startsWith('﻿')).toBe(true);
	});
});
