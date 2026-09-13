/**
 * What the community boards rank, defined once for both sides.
 *
 * The browser works these numbers out, the server stores them and ranks them,
 * and the public page prints them — so the rules live here rather than in any
 * of the three. A board that means one thing when a candidate is spotted and
 * another when it is claimed would be worse than no board.
 *
 * Two things are deliberately not ranked. Top speed is a public record of
 * breaking the law, and hardest braking rewards arriving in a situation that
 * needs an emergency stop. Neither belongs on a scoreboard. What is left is
 * either about the car (how fast it charged, how far it went on a charge) or
 * about smoothness rather than aggression.
 *
 * Every board is honour-system in the end: the numbers are computed on the
 * owner's own machine from a file they could edit. The bounds below throw out
 * the physically impossible and the obviously broken, the entry floors keep a
 * quiet month from being topped by a trip to the shops, and the rest is a
 * matter of people not wanting to cheat at a game about their own car.
 */

import type { SessionSummary, TripSummary } from '../data/analytics/summary';

export type BoardKind = 'trip' | 'charging';

export type BoardId =
	| 'peak-charge'
	| 'biggest-charge'
	| 'longest-drive'
	| 'efficient-drive'
	| 'best-regen'
	| 'hardest-launch'
	| 'most-grip';

/** How many places a board shows, and how far down still counts as ranking. */
export const TOP_N = 25;

/**
 * How much of a span has to carry samples before its numbers are trusted.
 *
 * A trip the car slept through reports the distance the odometer moved but
 * only the energy and the forces it stayed awake for, which flatters every
 * ratio computed from them. Nothing under nine tenths covered is ranked.
 */
const MIN_COVERAGE = 0.9;

/** Nothing about a road car gets past this, and past it means a bad frame. */
const MAX_G = 1.3;

export interface BoardEntryDetail {
	[key: string]: number | boolean | null;
}

export interface Board {
	id: BoardId;
	kind: BoardKind;
	/** What the board is called, in the app's own voice. */
	label: string;
	/** One line under the heading, saying what is being measured. */
	blurb: string;
	unit: string;
	digits: number;
	/** True when a smaller number is the better one, as for consumption. */
	lowerIsBetter: boolean;
	/** The worst value still worth listing. */
	floor: number;
	/** The number, or null when this item cannot stand on this board at all. */
	value(item: TripSummary | SessionSummary): number | null;
	/** The numbers printed beside the value. Never anything identifying. */
	detail(item: TripSummary | SessionSummary): BoardEntryDetail;
}

function number(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/** Seconds from end to end, which is what coverage is measured against. */
function duration(item: TripSummary | SessionSummary): number {
	return item.endTime - item.startTime;
}

/**
 * Whether a span is well enough covered to be ranked.
 *
 * Absent on anything uploaded before boards existed, and those are left off
 * rather than guessed at.
 */
function covered(item: TripSummary | SessionSummary): boolean {
	return number(item.coverage) && item.coverage >= MIN_COVERAGE;
}

/** A trip long enough, complete enough, and not moving impossibly fast. */
function drivable(trip: TripSummary, minKm: number): boolean {
	if (!covered(trip)) return false;
	if (!number(trip.distanceKm) || trip.distanceKm < minKm || trip.distanceKm > 2000) return false;
	const hours = duration(trip) / 3600;
	if (hours <= 0) return false;
	// A car that covered the distance faster than this did not: either the
	// odometer jumped or the timeline has a hole the coverage check missed.
	return trip.distanceKm / hours <= 160;
}

function gForce(value: number | null | undefined): number | null {
	if (!number(value)) return null;
	return value > 0 && value <= MAX_G ? value : null;
}

const tripDetail = (trip: TripSummary): BoardEntryDetail => ({
	distanceKm: trip.distanceKm,
	durationSeconds: duration(trip),
	consumption: trip.consumption
});

export const BOARDS: Board[] = [
	{
		id: 'peak-charge',
		kind: 'charging',
		label: 'Fastest charge',
		blurb: 'The highest power a car actually took, at the plug.',
		unit: 'kW',
		digits: 0,
		lowerIsBetter: false,
		floor: 50,
		value: (item) => {
			const session = item as SessionSummary;
			if (!session.isDc || !number(session.maxKw)) return null;
			// Below the DC threshold it is an onboard charger; above 400 kW no
			// charger in Europe delivers it and no car here accepts it.
			return session.maxKw > 22 && session.maxKw <= 400 ? session.maxKw : null;
		},
		detail: (item) => {
			const session = item as SessionSummary;
			return {
				kwhDelivered: session.kwhDelivered,
				socStart: session.socStart,
				socEnd: session.socEnd,
				durationSeconds: duration(session)
			};
		}
	},
	{
		id: 'biggest-charge',
		kind: 'charging',
		label: 'Biggest charge',
		blurb: 'The most energy taken in one session, however long it took.',
		unit: 'kWh',
		digits: 1,
		lowerIsBetter: false,
		floor: 30,
		value: (item) => {
			const session = item as SessionSummary;
			if (!number(session.kwhDelivered)) return null;
			// Larger than any pack these cars have, plus room for a session that
			// legitimately spans a top-up either side of a drive.
			return session.kwhDelivered > 0 && session.kwhDelivered <= 120 ? session.kwhDelivered : null;
		},
		detail: (item) => {
			const session = item as SessionSummary;
			return {
				maxKw: session.maxKw,
				isDc: session.isDc,
				socStart: session.socStart,
				socEnd: session.socEnd,
				durationSeconds: duration(session)
			};
		}
	},
	{
		id: 'longest-drive',
		kind: 'trip',
		label: 'Longest drive',
		blurb: 'The furthest anyone went in a single trip, without stopping long enough to end it.',
		unit: 'km',
		digits: 0,
		lowerIsBetter: false,
		floor: 100,
		value: (trip) => (drivable(trip as TripSummary, 0) ? (trip as TripSummary).distanceKm : null),
		detail: (item) => {
			const trip = item as TripSummary;
			return {
				durationSeconds: duration(trip),
				avgSpeed: trip.avgSpeed,
				consumption: trip.consumption
			};
		}
	},
	{
		id: 'efficient-drive',
		kind: 'trip',
		label: 'Most efficient drive',
		blurb: 'The least energy used per hundred kilometres, over a trip long enough to mean it.',
		unit: 'kWh/100 km',
		digits: 1,
		lowerIsBetter: true,
		floor: 20,
		value: (item) => {
			const trip = item as TripSummary;
			if (!drivable(trip, 25) || !number(trip.consumption)) return null;
			// Under 5 is beyond what these cars do and usually means a trip that
			// coasted downhill on regeneration; over 60 is not a record anyway.
			return trip.consumption >= 5 && trip.consumption <= 60 ? trip.consumption : null;
		},
		detail: tripDetail
	},
	{
		id: 'best-regen',
		kind: 'trip',
		label: 'Best regeneration',
		blurb: 'The largest share of energy put back into the battery on the way.',
		unit: '%',
		digits: 0,
		lowerIsBetter: false,
		floor: 0.15,
		value: (item) => {
			const trip = item as TripSummary;
			if (!drivable(trip, 10)) return null;
			if (!number(trip.energyKwh) || !number(trip.regenKwh)) return null;
			const gross = trip.energyKwh + trip.regenKwh;
			if (gross <= 0) return null;
			const share = trip.regenKwh / gross;
			// Past this the trip was mostly downhill, which is geography rather
			// than driving.
			return share > 0 && share <= 0.6 ? share : null;
		},
		detail: (item) => {
			const trip = item as TripSummary;
			return {
				distanceKm: trip.distanceKm,
				regenKwh: trip.regenKwh,
				energyKwh: trip.energyKwh
			};
		}
	},
	{
		id: 'hardest-launch',
		kind: 'trip',
		label: 'Hardest launch',
		blurb: 'The strongest pull away from a standstill, measured by the car itself.',
		unit: 'g',
		digits: 2,
		lowerIsBetter: false,
		floor: 0.4,
		value: (item) => {
			const trip = item as TripSummary;
			return covered(trip) ? gForce(trip.peakAccel) : null;
		},
		detail: tripDetail
	},
	{
		id: 'most-grip',
		kind: 'trip',
		label: 'Most grip used',
		blurb: 'The hardest cornering of the trip, sideways force through the tyres.',
		unit: 'g',
		digits: 2,
		lowerIsBetter: false,
		floor: 0.4,
		value: (item) => {
			const trip = item as TripSummary;
			return covered(trip) ? gForce(trip.peakLateral) : null;
		},
		detail: tripDetail
	}
];

export const BOARD_IDS: BoardId[] = BOARDS.map((board) => board.id);

const BY_ID = new Map<string, Board>(BOARDS.map((board) => [board.id, board]));

export function boardById(id: string): Board | null {
	return BY_ID.get(id) ?? null;
}

/**
 * The value turned so that larger always wins.
 *
 * One direction means one index, one comparison and one conditional upsert for
 * seven boards, instead of a special case wherever consumption is involved.
 */
export function scoreOf(board: Board, value: number): number {
	return board.lowerIsBetter ? -value : value;
}

/** Whether a value is good enough to be worth a place at all. */
export function meetsFloor(board: Board, value: number): boolean {
	return scoreOf(board, value) >= scoreOf(board, board.floor);
}

/** The item's value for this board, or null when it cannot stand on it. */
export function valueFor(board: Board, item: TripSummary | SessionSummary): number | null {
	const value = board.value(item);
	if (value === null || !Number.isFinite(value)) return null;
	return meetsFloor(board, value) ? value : null;
}

/** How a value reads on the board, without its unit. */
export function formatValue(board: Board, value: number): string {
	if (board.unit === '%') return `${Math.round(value * 100)}`;
	return value.toFixed(board.digits);
}
