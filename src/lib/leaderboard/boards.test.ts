/**
 * What the boards will and will not rank.
 *
 * Mostly about refusal. A public table is the one place where a broken export,
 * a sleeping car or an outright lie costs somebody else their place, so the
 * interesting cases here are the ones that produce no value at all.
 */

import { describe, expect, it } from 'vitest';
import {
	BOARDS,
	TOP_N,
	boardById,
	formatValue,
	meetsFloor,
	scoreOf,
	totalFor,
	valueFor,
	type ItemBoard,
	type MonthBoard
} from './boards';
import { sessionSummary, tripSummary } from './testing';

/** A board scored on one trip or session, which is all but one of them. */
function board(id: string): ItemBoard {
	const found = boardById(id);
	if (!found) throw new Error(`no board ${id}`);
	if (found.scope !== 'item') throw new Error(`${id} is scored over a month`);
	return found;
}

function monthBoard(id: string): MonthBoard {
	const found = boardById(id);
	if (!found) throw new Error(`no board ${id}`);
	if (found.scope !== 'month') throw new Error(`${id} is scored on one trip`);
	return found;
}

describe('the set of boards', () => {
	it('ranks neither top speed nor braking', () => {
		const ids = BOARDS.map((b) => b.id).join(' ');
		expect(ids).not.toMatch(/speed|brake|stop/);
	});

	it('gives every board a unique id, a unit and a floor', () => {
		const ids = new Set(BOARDS.map((b) => b.id));
		expect(ids.size).toBe(BOARDS.length);
		for (const b of BOARDS) {
			expect(b.unit.length).toBeGreaterThan(0);
			expect(Number.isFinite(b.floor)).toBe(true);
		}
	});

	it('shows a round number of places', () => {
		expect(TOP_N).toBe(25);
	});
});

describe('scoring in one direction', () => {
	it('turns a lower-is-better board over so larger always wins', () => {
		const efficient = board('efficient-drive');
		expect(efficient.lowerIsBetter).toBe(true);
		expect(scoreOf(efficient, 14)).toBeGreaterThan(scoreOf(efficient, 19));
	});

	it('leaves the others alone', () => {
		const longest = board('longest-drive');
		expect(scoreOf(longest, 400)).toBeGreaterThan(scoreOf(longest, 200));
	});

	it('reads the floor in the same direction', () => {
		expect(meetsFloor(board('efficient-drive'), 14)).toBe(true);
		expect(meetsFloor(board('efficient-drive'), 22)).toBe(false);
		expect(meetsFloor(board('longest-drive'), 400)).toBe(true);
		expect(meetsFloor(board('longest-drive'), 40)).toBe(false);
	});
});

describe('a charge on the board', () => {
	const peak = board('peak-charge');

	it('takes a rapid charge at its highest power', () => {
		expect(valueFor(peak, sessionSummary({ maxKw: 150 }))).toBe(150);
	});

	it('leaves out a charge at home, however long it went on for', () => {
		expect(valueFor(peak, sessionSummary({ maxKw: 10.6, isDc: false }))).toBeNull();
	});

	it('leaves out a rapid charge too slow to be worth a place', () => {
		expect(valueFor(peak, sessionSummary({ maxKw: 35 }))).toBeNull();
	});

	it('refuses a figure no charger delivers', () => {
		expect(valueFor(peak, sessionSummary({ maxKw: 900 }))).toBeNull();
	});

	it('ranks energy separately, and refuses more than a pack holds', () => {
		const biggest = board('biggest-charge');
		expect(valueFor(biggest, sessionSummary({ kwhDelivered: 64 }))).toBe(64);
		expect(valueFor(biggest, sessionSummary({ kwhDelivered: 300 }))).toBeNull();
		expect(valueFor(biggest, sessionSummary({ kwhDelivered: 4 }))).toBeNull();
	});

	it('does not ask a charging session to be well covered, since cars nap mid-charge', () => {
		expect(valueFor(peak, sessionSummary({ maxKw: 150, coverage: 0.3 }))).toBe(150);
	});
});

describe('a drive on the board', () => {
	const longest = board('longest-drive');

	it('takes a long one', () => {
		const trip = tripSummary({ distanceKm: 340, endTime: undefined, odoEnd: 41340 });
		expect(valueFor(longest, { ...trip, endTime: trip.startTime + 4 * 3600 })).toBe(340);
	});

	it('leaves out the commute it was built from', () => {
		expect(valueFor(longest, tripSummary())).toBeNull();
	});

	it('leaves out a trip the car slept through', () => {
		const napped = tripSummary({
			distanceKm: 300,
			endTime: tripSummary().startTime + 4 * 3600,
			coverage: 0.4
		});
		expect(valueFor(longest, napped)).toBeNull();
	});

	it('leaves out an export from before coverage was recorded', () => {
		const old = tripSummary({ distanceKm: 300, endTime: tripSummary().startTime + 4 * 3600 });
		delete (old as Partial<typeof old>).coverage;
		expect(valueFor(longest, old)).toBeNull();
	});

	it('refuses a distance no car covered in the time', () => {
		// 300 km in half an hour is 600 km/h.
		expect(valueFor(longest, tripSummary({ distanceKm: 300 }))).toBeNull();
	});
});

describe('efficiency', () => {
	const efficient = board('efficient-drive');

	it('takes a frugal run of a decent length', () => {
		const trip = tripSummary({
			distanceKm: 60,
			odoEnd: 41060,
			consumption: 13.5,
			endTime: tripSummary().startTime + 3600
		});
		expect(valueFor(efficient, trip)).toBe(13.5);
	});

	it('leaves out a trip too short to mean anything', () => {
		expect(valueFor(efficient, tripSummary({ consumption: 12 }))).toBeNull();
	});

	it('refuses a figure below what the car can physically do', () => {
		const trip = tripSummary({
			distanceKm: 60,
			odoEnd: 41060,
			consumption: 0.5,
			endTime: tripSummary().startTime + 3600
		});
		expect(valueFor(efficient, trip)).toBeNull();
	});

	it('refuses a downhill run that put back more than it took', () => {
		const trip = tripSummary({
			distanceKm: 60,
			odoEnd: 41060,
			consumption: -4,
			endTime: tripSummary().startTime + 3600
		});
		expect(valueFor(efficient, trip)).toBeNull();
	});
});

describe('regeneration', () => {
	const regen = board('best-regen');

	it('takes the share that came back', () => {
		const trip = tripSummary({
			distanceKm: 40,
			odoEnd: 41040,
			energyKwh: 8,
			regenKwh: 2,
			endTime: tripSummary().startTime + 3600
		});
		expect(valueFor(regen, trip)).toBeCloseTo(0.2, 5);
	});

	it('refuses a share that means the road went downhill all day', () => {
		const trip = tripSummary({
			distanceKm: 40,
			odoEnd: 41040,
			energyKwh: 2,
			regenKwh: 8,
			endTime: tripSummary().startTime + 3600
		});
		expect(valueFor(regen, trip)).toBeNull();
	});

	it('leaves out a trip that recovered almost nothing', () => {
		const trip = tripSummary({
			distanceKm: 40,
			odoEnd: 41040,
			energyKwh: 10,
			regenKwh: 0.2,
			endTime: tripSummary().startTime + 3600
		});
		expect(valueFor(regen, trip)).toBeNull();
	});
});

describe('the force boards', () => {
	const launch = board('hardest-launch');
	const grip = board('most-grip');

	it('take a firm launch and a committed corner', () => {
		expect(valueFor(launch, tripSummary({ peakAccel: 0.55 }))).toBe(0.55);
		expect(valueFor(grip, tripSummary({ peakLateral: 0.62 }))).toBe(0.62);
	});

	it('leave out ordinary driving', () => {
		expect(valueFor(launch, tripSummary({ peakAccel: 0.28 }))).toBeNull();
		expect(valueFor(grip, tripSummary({ peakLateral: 0.22 }))).toBeNull();
	});

	it('treat a car that reported no forces as having none, not as gentle', () => {
		expect(valueFor(launch, tripSummary({ peakAccel: 0 }))).toBeNull();
		expect(valueFor(grip, tripSummary({ peakLateral: 0 }))).toBeNull();
	});

	it('refuse a reading no road car produces', () => {
		expect(valueFor(launch, tripSummary({ peakAccel: 2.4 }))).toBeNull();
		expect(valueFor(grip, tripSummary({ peakLateral: 1.9 }))).toBeNull();
	});

	it('refuse a trip the car mostly slept through', () => {
		expect(valueFor(launch, tripSummary({ peakAccel: 0.55, coverage: 0.5 }))).toBeNull();
	});
});

describe('printing a value', () => {
	it('gives a share as a whole percentage', () => {
		expect(formatValue(board('best-regen'), 0.234)).toBe('23');
	});

	it('gives forces to two places and kilowatts to none', () => {
		expect(formatValue(board('hardest-launch'), 0.5)).toBe('0.50');
		expect(formatValue(board('peak-charge'), 149.6)).toBe('150');
	});
});

describe('what a board tells the public', () => {
	it('never carries the car, the odometer, or the moment it happened', () => {
		// A state of charge is fine to publish; a vehicle identification number,
		// an odometer reading and an exact timestamp are not — between them they
		// name a car and put it somewhere.
		for (const b of BOARDS) {
			const detail =
				b.scope === 'month'
					? b.detail([tripSummary(), tripSummary()])
					: b.detail(b.kind === 'trip' ? tripSummary() : sessionSummary());
			for (const key of Object.keys(detail)) {
				expect(key).not.toMatch(/vin|odo|user|email|startTime|endTime/i);
			}
		}
	});
});
