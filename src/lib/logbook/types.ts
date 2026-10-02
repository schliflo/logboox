/**
 * A note against one trip.
 *
 * Works without an account, which is why it lives in this browser first and
 * travels second. Two devices resolve a disagreement by the later `updatedAt`,
 * and a deletion is a tombstone rather than an absence — otherwise deleting a
 * note on a phone would simply be undone by the laptop that still has it.
 */

/** The categories a German Fahrtenbuch is kept in for tax purposes. */
export type Purpose = 'business' | 'commute' | 'private';

export const PURPOSES: Array<{ value: Purpose; label: string }> = [
	{ value: 'business', label: 'Business' },
	{ value: 'commute', label: 'Commute' },
	{ value: 'private', label: 'Private' }
];

export interface Annotation {
	vin: string;
	/** The trip's start, in epoch seconds. Half of its durable identity. */
	startTime: number;
	/** Odometer at the start, in km. The other half, and the tolerant one. */
	odoStart: number | null;
	origin: string;
	destination: string;
	purpose: Purpose | '';
	comment: string;
	/** Epoch milliseconds, so two edits in the same second still order. */
	updatedAt: number;
	deletedAt: number | null;
}

export function emptyAnnotation(
	vin: string,
	startTime: number,
	odoStart: number | null
): Annotation {
	return {
		vin,
		startTime,
		odoStart,
		origin: '',
		destination: '',
		purpose: '',
		comment: '',
		updatedAt: Date.now(),
		deletedAt: null
	};
}

/** True when nothing has been written, so an empty note is not worth keeping. */
export function isBlank(entry: Annotation): boolean {
	return !entry.origin && !entry.destination && !entry.purpose && !entry.comment;
}
