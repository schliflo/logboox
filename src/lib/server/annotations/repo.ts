/**
 * Notes on trips, shared between a reader's devices.
 *
 * These are written in a browser that may have no account at all, so the
 * server is a place they are copied to rather than the place they live. Two
 * devices that disagree are settled by the later `updated_at`, and a deletion
 * travels as a tombstone: an absence would simply be refilled by whichever
 * device still had the note.
 */

import { all, run, type Db } from '../db';

export interface AnnotationRow {
	vin: string;
	start_time: number;
	odo_start: number | null;
	origin: string | null;
	destination: string | null;
	purpose: string | null;
	comment: string | null;
	updated_at: number;
	deleted_at: number | null;
}

export interface AnnotationInput {
	startTime: number;
	odoStart: number | null;
	origin: string;
	destination: string;
	purpose: string;
	comment: string;
	updatedAt: number;
	deletedAt: number | null;
}

/** Free text, so it is bounded before it is stored. */
const MAX_PLACE = 120;
const MAX_COMMENT = 2000;
export const MAX_BATCH = 1000;

const PURPOSES = new Set(['', 'business', 'commute', 'private']);

function clean(value: unknown, max: number): string {
	return typeof value === 'string' ? value.slice(0, max) : '';
}

export function listAnnotations(db: Db, userId: string, vin: string): Promise<AnnotationRow[]> {
	return all<AnnotationRow>(
		db,
		`SELECT vin, start_time, odo_start, origin, destination, purpose, comment, updated_at, deleted_at
		 FROM annotations WHERE user_id = ? AND vin = ? ORDER BY start_time`,
		userId,
		vin
	);
}

/**
 * Writes what is newer and leaves what is not. The comparison is in the WHERE
 * clause rather than in this code, so two devices syncing at once cannot read
 * the same row and both decide they win.
 */
export async function mergeAnnotations(
	db: Db,
	userId: string,
	vin: string,
	entries: AnnotationInput[]
): Promise<number> {
	let written = 0;

	for (const entry of entries.slice(0, MAX_BATCH)) {
		if (!Number.isInteger(entry.startTime) || entry.startTime <= 0) continue;
		const purpose = clean(entry.purpose, 20);
		if (!PURPOSES.has(purpose)) continue;

		written += await run(
			db,
			`INSERT INTO annotations (user_id, vin, start_time, odo_start, origin, destination, purpose, comment, updated_at, deleted_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (user_id, vin, start_time) DO UPDATE SET
				odo_start = excluded.odo_start,
				origin = excluded.origin,
				destination = excluded.destination,
				purpose = excluded.purpose,
				comment = excluded.comment,
				updated_at = excluded.updated_at,
				deleted_at = excluded.deleted_at
			 WHERE excluded.updated_at > annotations.updated_at`,
			userId,
			vin,
			entry.startTime,
			Number.isFinite(entry.odoStart as number) ? entry.odoStart : null,
			clean(entry.origin, MAX_PLACE),
			clean(entry.destination, MAX_PLACE),
			purpose,
			clean(entry.comment, MAX_COMMENT),
			Number.isFinite(entry.updatedAt) ? Math.floor(entry.updatedAt) : Date.now(),
			Number.isFinite(entry.deletedAt as number) ? entry.deletedAt : null
		);
	}

	return written;
}

/** Tombstones old enough that every device will have seen them. */
export function pruneTombstones(db: Db, olderThanMs: number): Promise<number> {
	return run(
		db,
		'DELETE FROM annotations WHERE deleted_at IS NOT NULL AND deleted_at < ?',
		olderThanMs
	);
}
