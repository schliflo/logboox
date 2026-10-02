/**
 * Public links.
 *
 * A share is deliberately thin: a random unguessable id, what is needed to
 * draw the thing, and no way back to the person who made it. The VIN is never
 * stored — the model is, because "F30b" identifies a car the way "a hatchback"
 * identifies a hatchback, and the vehicle identification number identifies an
 * owner through a registration record.
 *
 * Revoking is immediate and the page 404s from that moment.
 */

import { all, now, one, run, type Db } from '../db';
import { randomToken } from '../auth/tokens';

export type ShareKind = 'trip' | 'charging' | 'export';

export interface ShareRow {
	id: string;
	user_id: string;
	kind: ShareKind;
	vmodel: string;
	title: string | null;
	description: string | null;
	start_time: number;
	end_time: number;
	time_zone: string;
	export_id: string | null;
	owner_user_id: string | null;
	meta_json: string;
	created_at: number;
	revoked_at: number | null;
	views: number;
	/** What a trip or session share has stored, counted before each write. */
	blob_bytes: number;
	blob_count: number;
	manifest_at: number | null;
}

export interface NewShare {
	kind: ShareKind;
	vmodel: string;
	title?: string;
	description?: string;
	startTime: number;
	endTime: number;
	timeZone: string;
	/** Set for a whole-export share, which reads the owner's own objects. */
	exportId?: string;
	meta: unknown;
}

export const MAX_SHARES_PER_USER = 200;

// A slice is one trip or session, at most ~40 columns of a few hundred kB each; these sit well above that.
export const MAX_SHARE_BLOB_BYTES = 2 * 1024 * 1024;
export const MAX_SHARE_BLOBS = 128;
export const MAX_SHARE_BYTES = 32 * 1024 * 1024;
export const MAX_SHARE_MANIFEST_BYTES = 64 * 1024;
export const MAX_SHARE_META_BYTES = 2 * 1024;

/** A share is written once, straight after it is made, and never again. */
export const SHARE_UPLOAD_WINDOW_SECONDS = 15 * 60;

/**
 * Short enough to paste, long enough that nobody finds one by trying. 128 bits
 * of the same random source every other secret here comes from.
 */
export function shareId(): string {
	return randomToken().slice(0, 22);
}

export function getShare(db: Db, id: string): Promise<ShareRow | null> {
	return one<ShareRow>(db, 'SELECT * FROM shares WHERE id = ? AND revoked_at IS NULL', id);
}

export function listShares(db: Db, userId: string): Promise<ShareRow[]> {
	return all<ShareRow>(
		db,
		'SELECT * FROM shares WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC',
		userId
	);
}

/**
 * Every share of the user's that may hold objects of its own, revoked ones
 * included. A whole-export share never does: it reads the export's objects.
 */
export async function listShareIds(db: Db, userId: string): Promise<string[]> {
	const rows = await all<{ id: string }>(
		db,
		"SELECT id FROM shares WHERE user_id = ? AND kind != 'export'",
		userId
	);
	return rows.map((row) => row.id);
}

export async function countShares(db: Db, userId: string): Promise<number> {
	const row = await one<{ n: number }>(
		db,
		'SELECT COUNT(*) AS n FROM shares WHERE user_id = ? AND revoked_at IS NULL',
		userId
	);
	return row?.n ?? 0;
}

export async function createShare(db: Db, userId: string, share: NewShare): Promise<ShareRow> {
	const row: ShareRow = {
		id: shareId(),
		user_id: userId,
		kind: share.kind,
		vmodel: share.vmodel.slice(0, 64),
		title: share.title?.slice(0, 120) || null,
		description: share.description?.slice(0, 400) || null,
		start_time: share.startTime,
		end_time: share.endTime,
		time_zone: share.timeZone.slice(0, 64),
		export_id: share.exportId ?? null,
		// Kept beside the export id so a whole-export share can find the owner's
		// objects without the reader being the owner.
		owner_user_id: share.exportId ? userId : null,
		meta_json: JSON.stringify(share.meta),
		created_at: now(),
		revoked_at: null,
		views: 0,
		blob_bytes: 0,
		blob_count: 0,
		manifest_at: null
	};

	await run(
		db,
		`INSERT INTO shares (id, user_id, kind, vmodel, title, description, start_time, end_time,
			time_zone, export_id, owner_user_id, meta_json, created_at, revoked_at, views)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)`,
		row.id,
		row.user_id,
		row.kind,
		row.vmodel,
		row.title,
		row.description,
		row.start_time,
		row.end_time,
		row.time_zone,
		row.export_id,
		row.owner_user_id,
		row.meta_json,
		row.created_at
	);

	return row;
}

export async function revokeShare(db: Db, userId: string, id: string): Promise<boolean> {
	const changed = await run(
		db,
		'UPDATE shares SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL',
		now(),
		id,
		userId
	);
	if (changed === 0) return false;

	// A leaderboard row may link here, and a public link to a 404 helps nobody.
	await run(db, 'UPDATE board_entries SET share_id = NULL WHERE share_id = ?', id);
	return true;
}

/** Counted for the owner's benefit, and never per visitor. */
export async function countView(db: Db, id: string): Promise<void> {
	await run(db, 'UPDATE shares SET views = views + 1 WHERE id = ?', id);
}
