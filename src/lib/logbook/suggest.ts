/**
 * Guessing where a trip went.
 *
 * There is no location data in an XPeng export — not a single coordinate — so
 * nothing here knows where anywhere is. What it has instead is the shape of a
 * life: the same drive at the same hour on the same weekdays, the same
 * distance, and an odometer that says one journey started where the last one
 * finished.
 *
 * That last rule is the strong one, and it needs no history at all: if the
 * previous trip ended at 41 207 km and this one starts at 41 207 km, the car
 * did not move in between, so wherever that trip ended is where this one
 * begins. Everything else is a ranking over trips already written down.
 */

import type { Trip } from '../data/analytics/trips';
import type { Annotation } from './types';

export interface Suggestion {
	value: string;
	/** Why it is being offered, shown next to it. */
	reason: string;
	score: number;
}

/** Two readings this close describe a car that has not moved. */
const SAME_PLACE_KM = 1;
/** Distances within this of each other count as the same journey. */
const NEAR_DISTANCE = 0.1;
const LOOSE_DISTANCE = 0.25;
/** Departures within this many minutes of each other count as the same habit. */
const SAME_HOUR_MINUTES = 90;

function labelled(entry: Annotation | undefined): boolean {
	return Boolean(entry && entry.deletedAt === null && (entry.origin || entry.destination));
}

function hourOf(startTime: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-GB', {
		hour: 'numeric',
		minute: 'numeric',
		hour12: false,
		timeZone
	}).formatToParts(new Date(startTime * 1000));
	const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
	const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
	return hour * 60 + minute;
}

function isWeekend(startTime: number, timeZone: string): boolean {
	const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone }).format(
		new Date(startTime * 1000)
	);
	return day === 'Sat' || day === 'Sun';
}

/** Minutes apart on the clock, wrapping midnight. */
function clockDistance(a: number, b: number): number {
	const raw = Math.abs(a - b);
	return Math.min(raw, 1440 - raw);
}

function rank(suggestions: Map<string, Suggestion>): Suggestion[] {
	return [...suggestions.values()].sort((a, b) => b.score - a.score).slice(0, 4);
}

function add(into: Map<string, Suggestion>, value: string, reason: string, score: number): void {
	const name = value.trim();
	if (!name) return;
	const existing = into.get(name);
	if (!existing) {
		into.set(name, { value: name, reason, score });
		return;
	}
	// One good reason and several weak ones should not outrank one very good
	// reason, so the best claim wins rather than the sum of them.
	if (score > existing.score) into.set(name, { value: name, reason, score });
}

/**
 * Where this trip started.
 *
 * The odometer settles it whenever the previous trip is known: a car that has
 * not moved is still where it was left. Otherwise it falls back to where trips
 * at this hour usually begin.
 */
export function suggestOrigin(
	trip: Trip,
	trips: Trip[],
	notes: Map<number, Annotation>,
	timeZone: string
): Suggestion[] {
	const out = new Map<string, Suggestion>();

	const previous = [...trips]
		.filter((other) => other.endTime <= trip.startTime && other.startTime !== trip.startTime)
		.sort((a, b) => b.endTime - a.endTime)[0];

	if (previous) {
		const note = notes.get(previous.startTime);
		const moved =
			Number.isFinite(previous.odoEnd) && Number.isFinite(trip.odoStart)
				? Math.abs(trip.odoStart - previous.odoEnd)
				: Infinity;
		if (labelled(note) && note!.destination && moved <= SAME_PLACE_KM) {
			add(out, note!.destination, 'where the last trip ended', 100);
		}
	}

	const minute = hourOf(trip.startTime, timeZone);
	for (const other of trips) {
		if (other.startTime === trip.startTime) continue;
		const note = notes.get(other.startTime);
		if (!labelled(note) || !note!.origin) continue;
		if (clockDistance(hourOf(other.startTime, timeZone), minute) <= SAME_HOUR_MINUTES) {
			add(out, note!.origin, 'where you usually set off at this hour', 40);
		} else {
			add(out, note!.origin, 'somewhere you have set off from', 10);
		}
	}

	return rank(out);
}

/**
 * Where this trip went.
 *
 * Ranked by how much a trip already written down looks like this one: same
 * starting point, a distance within a tenth, the same sort of day, the same
 * hour. A trip that is the exact reverse of a labelled one is its own rule —
 * the way home is the most repeated journey anyone makes.
 */
export function suggestDestinations(
	trip: Trip,
	trips: Trip[],
	notes: Map<number, Annotation>,
	timeZone: string,
	origin = ''
): Suggestion[] {
	const out = new Map<string, Suggestion>();
	const minute = hourOf(trip.startTime, timeZone);
	const weekend = isWeekend(trip.startTime, timeZone);
	const here = origin.trim().toLowerCase();

	for (const other of trips) {
		if (other.startTime === trip.startTime) continue;
		const note = notes.get(other.startTime);
		if (!labelled(note)) continue;

		const sameDistance =
			Number.isFinite(trip.distanceKm) &&
			Number.isFinite(other.distanceKm) &&
			other.distanceKm > 0 &&
			Math.abs(trip.distanceKm - other.distanceKm) / other.distanceKm;

		const near = sameDistance !== false && sameDistance <= NEAR_DISTANCE;
		const loose = sameDistance !== false && sameDistance <= LOOSE_DISTANCE;

		// The return leg: setting off from where a known trip arrived, having
		// covered about the same ground, means going back where it came from.
		if (here && note!.destination.trim().toLowerCase() === here && note!.origin && loose) {
			add(out, note!.origin, 'the way back', 90);
		}

		if (!note!.destination) continue;

		const sameOrigin = here && note!.origin.trim().toLowerCase() === here;
		const sameHour = clockDistance(hourOf(other.startTime, timeZone), minute) <= SAME_HOUR_MINUTES;
		const sameKind = isWeekend(other.startTime, timeZone) === weekend;

		if (sameOrigin && near) {
			add(out, note!.destination, 'same start, same distance', 80);
		} else if (near && sameHour && sameKind) {
			add(out, note!.destination, 'a trip you make at this hour', 60);
		} else if (near) {
			add(out, note!.destination, 'about the same distance', 45);
		} else if (sameHour && sameKind) {
			add(out, note!.destination, 'where you usually go at this hour', 30);
		} else if (loose) {
			add(out, note!.destination, 'a similar trip', 15);
		}
	}

	return rank(out);
}

/** The purpose most often given to trips that look like this one. */
export function suggestPurpose(
	trip: Trip,
	trips: Trip[],
	notes: Map<number, Annotation>,
	timeZone: string
): Annotation['purpose'] {
	const counts = new Map<string, number>();
	const minute = hourOf(trip.startTime, timeZone);
	const weekend = isWeekend(trip.startTime, timeZone);

	for (const other of trips) {
		if (other.startTime === trip.startTime) continue;
		const note = notes.get(other.startTime);
		if (!note || note.deletedAt !== null || !note.purpose) continue;
		if (isWeekend(other.startTime, timeZone) !== weekend) continue;
		if (clockDistance(hourOf(other.startTime, timeZone), minute) > SAME_HOUR_MINUTES) continue;
		counts.set(note.purpose, (counts.get(note.purpose) ?? 0) + 1);
	}

	const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
	return (best?.[0] ?? '') as Annotation['purpose'];
}
