/**
 * Filling in many trips at once, from the habits the logbook already shows.
 *
 * Only confident guesses are made, and only from what the driver wrote
 * themselves. A start follows from the trip before when the odometer says the
 * car had not moved since, so trips are worked through in order; failing that,
 * from the one place the driver's own trips at this hour set off from. A
 * destination needs a trip the driver labelled that is the same journey: same
 * start, distance within a tenth, the same kind of day, leaving within an hour
 * and a half; or that journey's exact way back. Guesses never vouch for other
 * guesses, so two labelled trips cannot fill a month by chain reaction.
 * Anything less certain is left for the driver.
 *
 * One sort and one pass over the labelled trips per unlabelled one, because
 * this runs again after every note saved.
 */

import type { Trip } from '../data/analytics/trips';
import { hourOf, isWeekend, labelled } from './suggest';
import { emptyAnnotation, type Annotation } from './types';

/** Two readings this close describe a car that has not moved. */
const SAME_PLACE_KM = 1;
/** Distances within this share of each other are the same journey. */
const SAME_DISTANCE = 0.1;
/** Departures within this many minutes of each other are the same habit. */
const SAME_HOUR_MINUTES = 90;

export interface Fill {
	trip: Trip;
	/** The note as it is now, so a fill can be undone. */
	before: Annotation;
	after: Annotation;
}

interface Known {
	trip: Trip;
	note: Annotation;
	minute: number;
	weekend: boolean;
}

function clockDistance(a: number, b: number): number {
	const raw = Math.abs(a - b);
	return Math.min(raw, 1440 - raw);
}

function sameDistance(a: Trip, b: Trip): boolean {
	return (
		Number.isFinite(a.distanceKm) &&
		Number.isFinite(b.distanceKm) &&
		b.distanceKm > 0 &&
		Math.abs(a.distanceKm - b.distanceKm) / b.distanceKm <= SAME_DISTANCE
	);
}

const key = (place: string) => place.trim().toLowerCase();

/** The single value a set of candidates agrees on, or null. */
function agreed(found: Map<string, string>): string | null {
	return found.size === 1 ? [...found.values()][0] : null;
}

export function confidentFills(
	trips: Trip[],
	notes: Map<number, Annotation>,
	vin: string,
	timeZone: string
): Fill[] {
	const ordered = [...trips].sort((a, b) => a.startTime - b.startTime);
	const known: Known[] = ordered
		.filter((trip) => labelled(notes.get(trip.startTime)))
		.map((trip) => ({
			trip,
			note: notes.get(trip.startTime)!,
			minute: hourOf(trip.startTime, timeZone),
			weekend: isWeekend(trip.startTime, timeZone)
		}));

	// Starts chain through the fills; everything else only leans on `notes`.
	const placed = new Map<number, Annotation>();
	const fills: Fill[] = [];

	ordered.forEach((trip, at) => {
		const current = notes.get(trip.startTime);
		if (labelled(current)) return;

		const minute = hourOf(trip.startTime, timeZone);
		const weekend = isWeekend(trip.startTime, timeZone);

		// Where the car was left, if the odometer says it has not moved since.
		let origin: string | null = null;
		const previous = ordered[at - 1];
		if (previous) {
			const left = placed.get(previous.startTime) ?? notes.get(previous.startTime);
			const moved =
				Number.isFinite(previous.odoEnd) && Number.isFinite(trip.odoStart)
					? Math.abs(trip.odoStart - previous.odoEnd)
					: Infinity;
			if (labelled(left) && left!.destination && moved <= SAME_PLACE_KM) origin = left!.destination;
		}
		// Otherwise the one place trips at this hour set off from.
		if (!origin) {
			const usual = new Map<string, string>();
			for (const other of known) {
				if (other.note.origin && clockDistance(other.minute, minute) <= SAME_HOUR_MINUTES) {
					usual.set(key(other.note.origin), other.note.origin.trim());
				}
			}
			origin = agreed(usual);
		}
		if (!origin) return;

		// The same journey written down before, or its way back.
		const where = new Map<string, string>();
		const purposes = new Map<string, string>();
		for (const other of known) {
			const { note } = other;
			if (!note.origin || !note.destination || !sameDistance(trip, other.trip)) continue;
			if (
				key(note.origin) === key(origin) &&
				other.weekend === weekend &&
				clockDistance(other.minute, minute) <= SAME_HOUR_MINUTES
			) {
				where.set(key(note.destination), note.destination.trim());
				if (note.purpose) purposes.set(note.purpose, note.purpose);
			} else if (key(note.destination) === key(origin)) {
				where.set(key(note.origin), note.origin.trim());
				if (note.purpose) purposes.set(note.purpose, note.purpose);
			}
		}
		const destination = agreed(where);
		if (!destination || key(destination) === key(origin)) return;

		const before =
			current ??
			emptyAnnotation(vin, trip.startTime, Number.isFinite(trip.odoStart) ? trip.odoStart : null);
		const after: Annotation = {
			...before,
			origin,
			destination,
			// The purpose the matching journeys were given, when they agree on one.
			purpose: before.purpose || ((agreed(purposes) ?? '') as Annotation['purpose']),
			deletedAt: null,
			updatedAt: Date.now()
		};
		placed.set(trip.startTime, after);
		fills.push({ trip, before, after });
	});

	return fills;
}
