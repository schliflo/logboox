/**
 * Tying a note to a trip, and keeping it tied.
 *
 * Nothing in the export identifies a trip. Trips are worked out here, from
 * gear and odometer movement, so their identity is whatever this app decides
 * it is — and a note written against one has to survive that decision being
 * made again. Which it will be: every reopen re-derives them, and merging two
 * exports can move a trip's edges by a second, extend one that was clipped at
 * the end of a thirty-day window, or join two that a logging gap had split.
 *
 * So a note is keyed by start time but *found* by odometer. The reading at the
 * start of a trip is a number the car itself produced, it does not move when
 * the boundaries do, and no two trips in a day share one. When a note is found
 * that way rather than exactly, it is rewritten against the new start time, so
 * the drift is corrected once rather than re-tolerated forever.
 */

import type { Trip } from '../data/analytics/trips';
import type { Annotation } from './types';

/** How far a trip's start may have moved and still be the same trip. */
export const DRIFT_SECONDS = 15 * 60;

export interface Bound {
	/** Notes by the start time of the trip they belong to. */
	byTrip: Map<number, Annotation>;
	/**
	 * Notes that were found by odometer at a start time that has since moved,
	 * rewritten against the trip as it is now. The caller stores these and
	 * tombstones where they used to be.
	 */
	rebound: Array<{ from: number; entry: Annotation }>;
	/** Notes whose trip is not in this dataset, left untouched. */
	orphans: Annotation[];
}

function live(entries: Annotation[]): Annotation[] {
	return entries.filter((entry) => entry.deletedAt === null);
}

export function bindAnnotations(trips: Trip[], entries: Annotation[]): Bound {
	const byTrip = new Map<number, Annotation>();
	const rebound: Bound['rebound'] = [];
	const orphans: Annotation[] = [];

	const tripsByStart = new Map(trips.map((trip) => [trip.startTime, trip]));
	const taken = new Set<number>();

	const remaining: Annotation[] = [];
	for (const entry of live(entries)) {
		if (tripsByStart.has(entry.startTime)) {
			byTrip.set(entry.startTime, entry);
			taken.add(entry.startTime);
		} else {
			remaining.push(entry);
		}
	}

	// Only trips nothing has claimed are candidates, so two notes can never end
	// up on one trip and a note can never be stolen from an exact match.
	const free = trips.filter((trip) => !taken.has(trip.startTime));

	for (const entry of remaining) {
		const match = nearest(entry, free);
		if (!match) {
			orphans.push(entry);
			continue;
		}
		taken.add(match.startTime);
		const moved: Annotation = {
			...entry,
			startTime: match.startTime,
			odoStart: Number.isFinite(match.odoStart) ? match.odoStart : entry.odoStart
		};
		byTrip.set(match.startTime, moved);
		rebound.push({ from: entry.startTime, entry: moved });
	}

	return { byTrip, rebound, orphans };
}

/**
 * The trip a note most likely belongs to: same odometer reading, and a start
 * close enough that it is the same journey rather than the next one. Without a
 * reading on either side there is nothing to be confident about, so nothing is
 * matched — a note on the wrong trip is worse than a note waiting to be found.
 */
function nearest(entry: Annotation, trips: Trip[]): Trip | null {
	if (entry.odoStart === null) return null;

	let best: Trip | null = null;
	let bestDrift = Infinity;

	for (const trip of trips) {
		if (!Number.isFinite(trip.odoStart) || Math.round(trip.odoStart) !== Math.round(entry.odoStart))
			continue;
		const drift = Math.abs(trip.startTime - entry.startTime);
		if (drift > DRIFT_SECONDS || drift >= bestDrift) continue;
		best = trip;
		bestDrift = drift;
	}

	return best;
}

/** The places already written down, most used first, for the suggestions list. */
export function knownPlaces(entries: Annotation[]): string[] {
	const counts = new Map<string, number>();
	for (const entry of live(entries)) {
		for (const place of [entry.origin, entry.destination]) {
			const name = place.trim();
			if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([name]) => name);
}
