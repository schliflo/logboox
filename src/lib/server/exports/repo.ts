/**
 * Exports kept in an account.
 *
 * The record and the summary arrive from the browser, which is where they were
 * worked out — so they are checked before they are stored. Not because the
 * owner is an adversary to themselves, but because a share page publishes this
 * and because nothing should be able to claim a terabyte of quota or a column
 * name with a slash in it by asking.
 */

import type { ExportRecord } from '$lib/history/codec';
import type { ExportSummary } from '$lib/data/analytics/summary';
import { all, now, one, run, type Db } from '../db';
import { MAX_ACCOUNT_BYTES, MAX_COLUMNS } from './limits';
import { isSafeBlobName } from './r2';

/** One row of the account's library, as the app lists it. */
export interface ExportRow {
	id: string;
	vin: string;
	vmodel: string;
	version: number;
	start_time: number;
	end_time: number;
	rows: number;
	days: number;
	distance_km: number;
	trips: number;
	stored_bytes: number;
	is_demo: number;
	uploaded_at: number;
	complete: number;
	time_zone: string | null;
}

export class Invalid extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'Invalid';
	}
}

export class QuotaExceeded extends Error {
	constructor(
		readonly used: number,
		readonly quota: number
	) {
		super('There is no room left in your account for another export.');
		this.name = 'QuotaExceeded';
	}
}

/** Nothing before the car existed, and nothing beyond a plausible clock skew. */
const EARLIEST = Date.UTC(2015, 0, 1) / 1000;

function plausibleTime(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value > EARLIEST &&
		value < now() + 86400
	);
}

function text(value: unknown, max: number): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function count(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Checks a record enough to store it and to trust the numbers it will be
 * listed by. The column specs themselves are not second-guessed: they describe
 * bytes this server never reads, and the browser that wrote them is the only
 * thing that can interpret them.
 */
export function checkRecord(record: unknown, id: string): asserts record is ExportRecord {
	if (!record || typeof record !== 'object') throw new Invalid('The export record is missing.');
	const value = record as Record<string, unknown>;

	if (value.id !== id) throw new Invalid('The record does not match the export it was sent for.');
	if (typeof value.version !== 'number') throw new Invalid('The record has no format version.');
	if (!text(value.vin, 32)) throw new Invalid('The record has no vehicle identifier.');
	if (!text(value.vmodel, 64)) throw new Invalid('The record has no model.');

	if (!plausibleTime(value.startTime) || !plausibleTime(value.endTime)) {
		throw new Invalid('The record does not cover a plausible period.');
	}
	if ((value.endTime as number) < (value.startTime as number)) {
		throw new Invalid('The record ends before it starts.');
	}

	for (const key of ['rows', 'days', 'distanceKm', 'trips', 'storedBytes']) {
		if (!count(value[key])) throw new Invalid(`The record's ${key} is not a number.`);
	}
	if ((value.storedBytes as number) > MAX_ACCOUNT_BYTES) {
		throw new Invalid('That export is larger than an entire account may hold.');
	}

	if (!Array.isArray(value.columns)) throw new Invalid('The record lists no columns.');
	if (value.columns.length > MAX_COLUMNS) throw new Invalid('The record lists too many columns.');
	for (const column of value.columns as Array<Record<string, unknown>>) {
		if (!text(column?.key, 120) || !isSafeBlobName(column.key as string)) {
			throw new Invalid('The record names a column that cannot be stored.');
		}
	}
}

/** The names the bucket should end up holding: every column, plus the timeline. */
export function expectedBlobNames(record: ExportRecord): Set<string> {
	return new Set(['_time', ...record.columns.map((column) => column.key)]);
}

export function listExports(db: Db, userId: string): Promise<ExportRow[]> {
	return all<ExportRow>(
		db,
		`SELECT id, vin, vmodel, version, start_time, end_time, rows, days, distance_km, trips,
			stored_bytes, is_demo, uploaded_at, complete, time_zone
		 FROM exports WHERE user_id = ? AND complete = 1 ORDER BY start_time DESC`,
		userId
	);
}

export function getExportRow(db: Db, userId: string, id: string): Promise<ExportRow | null> {
	return one<ExportRow>(db, 'SELECT * FROM exports WHERE user_id = ? AND id = ?', userId, id);
}

export async function getRecord(db: Db, userId: string, id: string): Promise<ExportRecord | null> {
	const row = await one<{ record_json: string }>(
		db,
		'SELECT record_json FROM exports WHERE user_id = ? AND id = ?',
		userId,
		id
	);
	return row ? (JSON.parse(row.record_json) as ExportRecord) : null;
}

/** Bytes already committed, not counting the export being replaced. */
export async function accountBytes(db: Db, userId: string, excluding?: string): Promise<number> {
	const row = await one<{ bytes: number | null }>(
		db,
		'SELECT SUM(stored_bytes) AS bytes FROM exports WHERE user_id = ? AND id != ?',
		userId,
		excluding ?? ''
	);
	return row?.bytes ?? 0;
}

/** As many trips or sessions as a month could plausibly hold. */
const MAX_SUMMARY_ITEMS = 5000;

/**
 * Throws out summary rows that cannot describe a real car.
 *
 * The browser works these out and the browser can be made to say anything, so
 * until now the only thing standing behind them was that they described the
 * sender's own car to the sender. A public board changes that: a row here can
 * cost somebody else their place. The checks are deliberately loose — they
 * reject the impossible rather than the unusual — and a row that fails is
 * dropped on its own rather than failing the upload, because one odd trip
 * should not cost someone the month it came in.
 */
function plausibleSpan(
	item: { startTime: unknown; endTime: unknown },
	record: ExportRecord
): boolean {
	if (typeof item.startTime !== 'number' || typeof item.endTime !== 'number') return false;
	if (!Number.isFinite(item.startTime) || !Number.isFinite(item.endTime)) return false;
	if (item.endTime < item.startTime) return false;
	// A day either side of the export's own window, since a span may legitimately
	// straddle its edge.
	return item.startTime >= record.startTime - 86400 && item.endTime <= record.endTime + 86400;
}

function withinOrNull(value: unknown, max: number): boolean {
	return (
		value === null || value === undefined || (typeof value === 'number' && Math.abs(value) <= max)
	);
}

export function sanitizeSummary(summary: ExportSummary, record: ExportRecord): ExportSummary {
	const trips = summary.trips.slice(0, MAX_SUMMARY_ITEMS).filter((trip) => {
		if (!plausibleSpan(trip, record)) return false;
		if (trip.movingSeconds > trip.endTime - trip.startTime + 60) return false;
		if (!withinOrNull(trip.distanceKm, 2000)) return false;
		if (!withinOrNull(trip.maxSpeed, 300)) return false;
		if (!withinOrNull(trip.peakAccel, 3) || !withinOrNull(trip.peakBrake, 3)) return false;
		if (!withinOrNull(trip.peakLateral, 3)) return false;
		if (typeof trip.odoStart === 'number' && typeof trip.odoEnd === 'number') {
			if (trip.odoEnd < trip.odoStart) return false;
		}
		// Distance and time have to agree with each other: a car that covered
		// the ground faster than this did not cover it.
		const hours = (trip.endTime - trip.startTime) / 3600;
		if (typeof trip.distanceKm === 'number' && hours > 0 && trip.distanceKm / hours > 400) {
			return false;
		}
		return true;
	});

	const charging = summary.charging.slice(0, MAX_SUMMARY_ITEMS).filter((session) => {
		if (!plausibleSpan(session, record)) return false;
		if (!withinOrNull(session.kwhDelivered, 500)) return false;
		if (!withinOrNull(session.maxKw, 1000)) return false;
		return true;
	});

	return { ...summary, trips, charging };
}

/**
 * Starts an upload: the record and its summary land, the buffers follow, and
 * only then is it marked complete. Re-uploading the same export replaces it,
 * which is what makes an interrupted attempt recoverable by repeating it.
 */
export async function beginExport(
	db: Db,
	userId: string,
	id: string,
	record: ExportRecord,
	summary: ExportSummary,
	isDemo: boolean,
	timeZone: string | null = null
): Promise<void> {
	const used = await accountBytes(db, userId, id);
	if (used + record.storedBytes > MAX_ACCOUNT_BYTES) {
		throw new QuotaExceeded(used, MAX_ACCOUNT_BYTES);
	}

	await run(
		db,
		`INSERT INTO exports (user_id, id, vin, vmodel, version, start_time, end_time, rows, days,
			distance_km, trips, stored_bytes, is_demo, record_json, uploaded_at, complete, time_zone)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
		 ON CONFLICT (user_id, id) DO UPDATE SET
			vin = excluded.vin, vmodel = excluded.vmodel, version = excluded.version,
			start_time = excluded.start_time, end_time = excluded.end_time, rows = excluded.rows,
			days = excluded.days, distance_km = excluded.distance_km, trips = excluded.trips,
			stored_bytes = excluded.stored_bytes, is_demo = excluded.is_demo,
			record_json = excluded.record_json, uploaded_at = excluded.uploaded_at, complete = 0,
			time_zone = excluded.time_zone`,
		userId,
		id,
		record.vin,
		record.vmodel,
		record.version,
		record.startTime,
		record.endTime,
		record.rows,
		record.days,
		record.distanceKm,
		record.trips,
		record.storedBytes,
		isDemo ? 1 : 0,
		JSON.stringify(record),
		now(),
		timeZone
	);

	await writeSummary(db, userId, id, record.vin, record.vmodel, sanitizeSummary(summary, record));
}

/**
 * Replaces the derived rows this export speaks for.
 *
 * Keyed by start time, so an export that overlaps an earlier one — they always
 * do, XPeng's window rolls — updates the trips they share rather than
 * duplicating them.
 */
async function writeSummary(
	db: Db,
	userId: string,
	exportId: string,
	vin: string,
	vmodel: string,
	summary: ExportSummary
): Promise<void> {
	await run(db, 'DELETE FROM trips WHERE user_id = ? AND export_id = ?', userId, exportId);
	await run(
		db,
		'DELETE FROM charging_sessions WHERE user_id = ? AND export_id = ?',
		userId,
		exportId
	);

	for (const trip of summary.trips) {
		await run(
			db,
			`INSERT INTO trips (user_id, vin, start_time, end_time, export_id, odo_start, odo_end, distance_km, summary_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (user_id, vin, start_time) DO UPDATE SET
				end_time = excluded.end_time, export_id = excluded.export_id,
				odo_start = excluded.odo_start, odo_end = excluded.odo_end,
				distance_km = excluded.distance_km, summary_json = excluded.summary_json`,
			userId,
			vin,
			trip.startTime,
			trip.endTime,
			exportId,
			trip.odoStart,
			trip.odoEnd,
			trip.distanceKm,
			JSON.stringify(trip)
		);
	}

	for (const session of summary.charging) {
		await run(
			db,
			`INSERT INTO charging_sessions (user_id, vin, start_time, end_time, export_id, odometer, summary_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (user_id, vin, start_time) DO UPDATE SET
				end_time = excluded.end_time, export_id = excluded.export_id,
				odometer = excluded.odometer, summary_json = excluded.summary_json`,
			userId,
			vin,
			session.startTime,
			session.endTime,
			exportId,
			session.odometer,
			JSON.stringify(session)
		);
	}

	// Only a newer reading may move the car's state on: exports are often
	// uploaded out of order, and an older one must not rewind the odometer.
	await run(
		db,
		`INSERT INTO vehicles (user_id, vin, vmodel, last_sample_time, odometer_km, soc, range_km, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (user_id, vin) DO UPDATE SET
			vmodel = excluded.vmodel,
			last_sample_time = excluded.last_sample_time,
			odometer_km = excluded.odometer_km,
			soc = excluded.soc,
			range_km = excluded.range_km,
			updated_at = excluded.updated_at
		 WHERE excluded.last_sample_time >= vehicles.last_sample_time`,
		userId,
		vin,
		vmodel,
		summary.vehicle.lastSampleTime,
		summary.vehicle.odometerKm,
		summary.vehicle.soc,
		summary.vehicle.rangeKm,
		now()
	);
}

export async function markComplete(db: Db, userId: string, id: string): Promise<void> {
	await run(db, 'UPDATE exports SET complete = 1 WHERE user_id = ? AND id = ?', userId, id);
}

export async function deleteExport(db: Db, userId: string, id: string): Promise<void> {
	await run(db, 'DELETE FROM trips WHERE user_id = ? AND export_id = ?', userId, id);
	await run(db, 'DELETE FROM charging_sessions WHERE user_id = ? AND export_id = ?', userId, id);
	await run(db, 'DELETE FROM exports WHERE user_id = ? AND id = ?', userId, id);
}

/** Uploads that were started and never finished, old enough to be abandoned. */
export function staleUploads(db: Db, olderThanSeconds = 86400): Promise<ExportRow[]> {
	return all<ExportRow>(
		db,
		'SELECT * FROM exports WHERE complete = 0 AND uploaded_at < ?',
		now() - olderThanSeconds
	);
}
