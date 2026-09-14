/**
 * What a logbook says once there is enough of it.
 *
 * The export itself knows nothing about places — there is not one coordinate
 * in it — so everything here comes from what the driver wrote down, joined to
 * what the car recorded. That is the whole point of the thing: the privacy
 * page explains that a month of driving reveals a routine without any location
 * data, and this is the other side of it, where somebody has chosen to name
 * the places and gets a Fahrtenbuch out of it.
 *
 * Pure, and handed its inputs rather than reaching for stores, so the awkward
 * cases — a route driven both ways, a gap where the car moved unrecorded — can
 * be tested rather than discovered.
 */

import type { Trip } from '../data/analytics/trips';
import type { Annotation, Purpose } from './types';
import { hourOf, isWeekend, labelled } from './suggest';

/** Odometer readings further apart than this mean the car moved unrecorded. */
const GAP_KM = 1;

/** Below this a route is a one-off rather than a habit worth summarising. */
const COMMUTE_MINIMUM = 5;

export interface PurposeTotals {
	purpose: Purpose | 'unlabelled';
	trips: number;
	km: number;
	seconds: number;
	kwh: number;
	cost: number;
	/** Share of all recorded distance, 0–1. */
	share: number;
}

export interface RouteStats {
	origin: string;
	destination: string;
	trips: number;
	km: number;
	medianKm: number;
	medianSeconds: number;
	/** Minutes since local midnight: the usual departure. */
	medianDeparture: number;
	medianConsumption: number;
	fastestSeconds: number;
	fastestAt: number;
	weekdayTrips: number;
	weekendTrips: number;
	lastDriven: number;
	purpose: Purpose | '';
	/** The trips behind it, for linking back into the table. */
	tripIndices: number[];
}

export interface PlaceStats {
	place: string;
	departures: number;
	arrivals: number;
	/** Seven rows of 24, indexed by local weekday then hour. */
	arrivalGrid: number[][];
	departureGrid: number[][];
}

export interface Gap {
	/** Where the recorded trips stop, and where they start again. */
	fromOdo: number;
	toOdo: number;
	km: number;
	after: number;
}

export interface Coverage {
	trips: number;
	labelled: number;
	km: number;
	labelledKm: number;
	/** The first trip with nothing written against it, for "label the next one". */
	nextUnlabelled: number | null;
	unrecordedKm: number;
	gaps: Gap[];
}

export interface CommuteStats {
	outbound: RouteStats;
	inbound: RouteStats;
	/** Minutes between the earliest and the latest departure on the way out. */
	departureSpread: number;
}

export interface LogbookAnalysis {
	coverage: Coverage;
	purposes: PurposeTotals[];
	routes: RouteStats[];
	places: PlaceStats[];
	commute: CommuteStats | null;
}

function median(values: number[]): number {
	if (values.length === 0) return NaN;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function grid(): number[][] {
	return Array.from({ length: 7 }, () => new Array(24).fill(0));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayHour(startTime: number, timeZone: string): { day: number; hour: number } {
	const parts = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		hour: 'numeric',
		hour12: false,
		timeZone
	}).formatToParts(new Date(startTime * 1000));
	const name = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
	return {
		day: Math.max(0, WEEKDAYS.indexOf(name)),
		hour: Number(parts.find((part) => part.type === 'hour')?.value ?? '0') % 24
	};
}

/** Places differ by capitals and stray spaces far more often than by intent. */
function key(place: string): string {
	return place.trim().toLowerCase();
}

/** One key for a leg, proof against a place name containing punctuation. */
function legKey(origin: string, destination: string): string {
	return JSON.stringify([key(origin), key(destination)]);
}

export function analyseLogbook(
	trips: Trip[],
	notes: Map<number, Annotation>,
	timeZone: string,
	pricePerKwh = 0
): LogbookAnalysis {
	const ordered = [...trips].sort((a, b) => a.startTime - b.startTime);

	// --- what is written down, and what is missing -------------------------
	let labelledCount = 0;
	let labelledKm = 0;
	let totalKm = 0;
	let nextUnlabelled: number | null = null;
	const gaps: Gap[] = [];

	for (let i = 0; i < ordered.length; i++) {
		const trip = ordered[i];
		const note = notes.get(trip.startTime);
		if (Number.isFinite(trip.distanceKm)) totalKm += trip.distanceKm;

		if (labelled(note)) {
			labelledCount++;
			if (Number.isFinite(trip.distanceKm)) labelledKm += trip.distanceKm;
		} else if (nextUnlabelled === null) {
			nextUnlabelled = trip.index;
		}

		// A logbook kept for tax has to account for every kilometre, so a jump
		// between one trip's end and the next one's start is worth naming.
		if (i > 0) {
			const previous = ordered[i - 1];
			if (Number.isFinite(previous.odoEnd) && Number.isFinite(trip.odoStart)) {
				const jump = trip.odoStart - previous.odoEnd;
				if (jump > GAP_KM) {
					gaps.push({
						fromOdo: previous.odoEnd,
						toOdo: trip.odoStart,
						km: jump,
						after: previous.endTime
					});
				}
			}
		}
	}

	const coverage: Coverage = {
		trips: ordered.length,
		labelled: labelledCount,
		km: totalKm,
		labelledKm,
		nextUnlabelled,
		unrecordedKm: gaps.reduce((sum, gap) => sum + gap.km, 0),
		gaps
	};

	// --- by purpose --------------------------------------------------------
	const buckets = new Map<Purpose | 'unlabelled', PurposeTotals>();
	for (const purpose of ['business', 'commute', 'private', 'unlabelled'] as const) {
		buckets.set(purpose, { purpose, trips: 0, km: 0, seconds: 0, kwh: 0, cost: 0, share: 0 });
	}

	for (const trip of ordered) {
		const note = notes.get(trip.startTime);
		const purpose: Purpose | 'unlabelled' =
			note && note.deletedAt === null && note.purpose ? note.purpose : 'unlabelled';
		const bucket = buckets.get(purpose)!;
		bucket.trips++;
		if (Number.isFinite(trip.distanceKm)) bucket.km += trip.distanceKm;
		bucket.seconds += trip.duration;
		const used = trip.energyKwh - trip.regenKwh;
		if (Number.isFinite(used)) bucket.kwh += used;
	}

	for (const bucket of buckets.values()) {
		bucket.cost = bucket.kwh * pricePerKwh;
		bucket.share = totalKm > 0 ? bucket.km / totalKm : 0;
	}

	const purposes = [...buckets.values()].filter((bucket) => bucket.trips > 0);

	// --- routes ------------------------------------------------------------
	interface Leg {
		origin: string;
		destination: string;
		trips: Trip[];
		purposes: Array<Purpose | ''>;
	}

	const legs = new Map<string, Leg>();
	for (const trip of ordered) {
		const note = notes.get(trip.startTime);
		if (!labelled(note) || !note) continue;
		if (!note.origin || !note.destination) continue;

		const id = legKey(note.origin, note.destination);
		const leg = legs.get(id) ?? {
			origin: note.origin.trim(),
			destination: note.destination.trim(),
			trips: [],
			purposes: []
		};
		leg.trips.push(trip);
		leg.purposes.push(note.purpose);
		legs.set(id, leg);
	}

	const routes: RouteStats[] = [...legs.values()]
		.map((leg) => {
			const fastest = leg.trips.reduce((best, trip) =>
				trip.duration < best.duration ? trip : best
			);
			const counts = new Map<Purpose | '', number>();
			for (const purpose of leg.purposes) counts.set(purpose, (counts.get(purpose) ?? 0) + 1);
			const commonest = [...counts.entries()]
				.filter(([purpose]) => purpose !== '')
				.sort((a, b) => b[1] - a[1])[0];

			return {
				origin: leg.origin,
				destination: leg.destination,
				trips: leg.trips.length,
				km: leg.trips.reduce((sum, trip) => sum + (trip.distanceKm || 0), 0),
				medianKm: median(leg.trips.map((trip) => trip.distanceKm).filter(Number.isFinite)),
				medianSeconds: median(leg.trips.map((trip) => trip.duration)),
				medianDeparture: median(leg.trips.map((trip) => hourOf(trip.startTime, timeZone))),
				medianConsumption: median(
					leg.trips.map((trip) => trip.consumption).filter(Number.isFinite)
				),
				fastestSeconds: fastest.duration,
				fastestAt: fastest.startTime,
				weekdayTrips: leg.trips.filter((trip) => !isWeekend(trip.startTime, timeZone)).length,
				weekendTrips: leg.trips.filter((trip) => isWeekend(trip.startTime, timeZone)).length,
				lastDriven: Math.max(...leg.trips.map((trip) => trip.startTime)),
				purpose: commonest ? commonest[0] : '',
				tripIndices: leg.trips.map((trip) => trip.index)
			};
		})
		.sort((a, b) => b.trips - a.trips || b.km - a.km);

	// --- places ------------------------------------------------------------
	const placeMap = new Map<string, PlaceStats>();
	function place(name: string): PlaceStats {
		const id = key(name);
		let found = placeMap.get(id);
		if (!found) {
			found = {
				place: name.trim(),
				departures: 0,
				arrivals: 0,
				arrivalGrid: grid(),
				departureGrid: grid()
			};
			placeMap.set(id, found);
		}
		return found;
	}

	for (const trip of ordered) {
		const note = notes.get(trip.startTime);
		if (!labelled(note) || !note) continue;

		if (note.origin) {
			const from = place(note.origin);
			from.departures++;
			const at = weekdayHour(trip.startTime, timeZone);
			from.departureGrid[at.day][at.hour]++;
		}
		if (note.destination) {
			const to = place(note.destination);
			to.arrivals++;
			// Arrivals are placed by when the trip ended, which is the whole
			// point of asking when somebody gets home.
			const at = weekdayHour(trip.endTime, timeZone);
			to.arrivalGrid[at.day][at.hour]++;
		}
	}

	const places = [...placeMap.values()].sort(
		(a, b) => b.arrivals + b.departures - (a.arrivals + a.departures)
	);

	// --- the commute -------------------------------------------------------
	let commute: CommuteStats | null = null;
	for (const route of routes) {
		if (route.trips < COMMUTE_MINIMUM) continue;
		const back = routes.find(
			(other) =>
				key(other.origin) === key(route.destination) &&
				key(other.destination) === key(route.origin) &&
				other.trips >= COMMUTE_MINIMUM
		);
		if (!back) continue;

		// Whichever leaves earlier in the day is the way out.
		const [outbound, inbound] =
			route.medianDeparture <= back.medianDeparture ? [route, back] : [back, route];
		const out = legs.get(legKey(outbound.origin, outbound.destination));
		const minutes = (out?.trips ?? []).map((trip) => hourOf(trip.startTime, timeZone));

		commute = {
			outbound,
			inbound,
			departureSpread: minutes.length > 1 ? Math.max(...minutes) - Math.min(...minutes) : 0
		};
		break;
	}

	return { coverage, purposes, routes, places, commute };
}
