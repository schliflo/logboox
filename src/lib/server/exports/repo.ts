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
import type { ExportSummary, SessionSummary, TripSummary } from '$lib/data/analytics/summary';
import { EARLIEST_PLAUSIBLE } from '$lib/data/parse/order';
import { all, now, one, run, runBatched, type Db, type Statement } from '../db';
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

function plausibleTime(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value > EARLIEST_PLAUSIBLE &&
		value < now() + 86400
	);
}

function text(value: unknown, max: number): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function count(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** VINs are 17 letters and digits; the slack is for whatever else a car reports. */
const VIN = /^[A-Za-z0-9_-]{1,32}$/;

export function isVin(value: unknown): value is string {
	return typeof value === 'string' && VIN.test(value);
}

/** Printed on public boards and share pages, so nothing a page could mistake for markup. */
const VMODEL = /^[A-Za-z0-9 ._-]{1,64}$/;

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
	if (!isVin(value.vin)) throw new Invalid('The record has no usable vehicle identifier.');
	if (typeof value.vmodel !== 'string' || !VMODEL.test(value.vmodel)) {
		throw new Invalid('The record has no usable model.');
	}

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

/** Bytes charged to the account, not counting the export being uploaded. */
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

/** A day either side of the export's own window, since a span may straddle its edge. */
const EDGE = 86400;

function finiteOrNull(value: unknown): boolean {
	return (
		value === null || value === undefined || (typeof value === 'number' && Number.isFinite(value))
	);
}

/**
 * Checks the summary has the shape the rest of this file reads. Individual
 * rows are judged later, one at a time; this is only what would otherwise
 * throw halfway through writing them.
 */
export function checkSummary(
	summary: unknown,
	record: ExportRecord
): asserts summary is ExportSummary {
	if (!summary || typeof summary !== 'object') throw new Invalid('The summary is missing.');
	const value = summary as Record<string, unknown>;
	if (!Array.isArray(value.trips) || !Array.isArray(value.charging)) {
		throw new Invalid('The summary does not list trips and charging sessions.');
	}

	const vehicle = value.vehicle as Record<string, unknown> | null | undefined;
	if (!vehicle || typeof vehicle !== 'object') {
		throw new Invalid('The summary says nothing about the car.');
	}
	for (const key of ['odometerKm', 'soc', 'rangeKm']) {
		if (!finiteOrNull(vehicle[key])) throw new Invalid(`The car's ${key} is not a number.`);
	}
	const last = vehicle.lastSampleTime;
	if (
		typeof last !== 'number' ||
		!Number.isFinite(last) ||
		last < record.startTime - EDGE ||
		last > record.endTime + EDGE
	) {
		throw new Invalid("The car's last reading is not from this export.");
	}
}

/**
 * Judges summary rows before they are kept.
 *
 * The browser works these out and the browser can be made to say anything, so
 * until now the only thing standing behind them was that they described the
 * sender's own car to the sender. A public board changes that: a row here can
 * cost somebody else their place.
 *
 * A row is dropped only when it cannot be a row at all: not an object, a
 * figure that is not a number, a span outside the export or running
 * backwards, a negative distance, an odometer that went backwards. A figure
 * that is merely implausible is set to null and the row kept: the ratios are
 * computed over the seconds the car was awake, so a real drive the logger
 * slept through can come out at 400 km/h, and it is still the reader's drive.
 * The boards rank nothing on a null.
 */
function plausibleSpan(item: Record<string, unknown>, record: ExportRecord): boolean {
	if (typeof item.startTime !== 'number' || typeof item.endTime !== 'number') return false;
	if (!Number.isFinite(item.startTime) || !Number.isFinite(item.endTime)) return false;
	if (item.endTime < item.startTime) return false;
	return item.startTime >= record.startTime - EDGE && item.endTime <= record.endTime + EDGE;
}

function isObject(item: unknown): item is Record<string, unknown> {
	return !!item && typeof item === 'object';
}

/** Not a number at all: the row is not one the app wrote. */
const MALFORMED = Symbol('malformed');

/** The figure when it lies within bounds, null when it does not. */
function figure(value: unknown, min: number, max: number): number | null | typeof MALFORMED {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'number') return MALFORMED;
	return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

/** Each field's bounds; the figures are judged one by one and kept or nulled. */
function figures(
	item: Record<string, unknown>,
	bounds: Record<string, [number, number]>
): Record<string, number | null> | null {
	const out: Record<string, number | null> = {};
	for (const [key, [min, max]] of Object.entries(bounds)) {
		const value = figure(item[key], min, max);
		if (value === MALFORMED) return null;
		out[key] = value;
	}
	return out;
}

const ODOMETER: [number, number] = [0, 2_000_000];
const G: [number, number] = [-3, 3];

function sanitizeTrip(trip: unknown, record: ExportRecord): TripSummary | null {
	if (!isObject(trip) || !plausibleSpan(trip, record)) return null;
	const span = (trip.endTime as number) - (trip.startTime as number);
	if (typeof trip.distanceKm === 'number' && trip.distanceKm < 0) return null;
	if (
		typeof trip.odoStart === 'number' &&
		typeof trip.odoEnd === 'number' &&
		trip.odoEnd < trip.odoStart
	) {
		return null;
	}

	const clean = figures(trip, {
		movingSeconds: [0, span + 60],
		distanceKm: [0, 2000],
		odoStart: ODOMETER,
		odoEnd: ODOMETER,
		socStart: [0, 100],
		socEnd: [0, 100],
		maxSpeed: [-300, 300],
		peakAccel: G,
		peakBrake: G,
		peakLateral: G,
		// A board copies these into its public detail as they are, so they have
		// to be numbers. Consumption goes negative on a long enough descent.
		avgSpeed: [0, 300],
		consumption: [-100, 200],
		energyKwh: [-500, 500],
		regenKwh: [-500, 500],
		coverage: [0, 1]
	});
	if (!clean) return null;

	// Distance and time have to agree with each other: a car that covered the
	// ground faster than this did not, so the odometer said something wrong.
	if (clean.distanceKm !== null && span > 0 && clean.distanceKm / (span / 3600) > 400) {
		clean.distanceKm = null;
	}

	// `movingSeconds` and `coverage` are not nullable in the type; the boards
	// read a null coverage as uncovered, and nothing ranks on moving time.
	return { ...trip, ...clean } as unknown as TripSummary;
}

function sanitizeSession(session: unknown, record: ExportRecord): SessionSummary | null {
	if (!isObject(session) || !plausibleSpan(session, record)) return null;
	if (typeof session.isDc !== 'boolean') return null;

	const clean = figures(session, {
		kwhDelivered: [0, 500],
		maxKw: [0, 1000],
		odometer: ODOMETER,
		socStart: [0, 100],
		socEnd: [0, 100],
		coverage: [0, 1]
	});
	if (!clean) return null;

	// `coverage` is not nullable in the type; as for a trip.
	return { ...session, ...clean } as unknown as SessionSummary;
}

export function sanitizeSummary(summary: ExportSummary, record: ExportRecord): ExportSummary {
	const keep = <T>(items: unknown[], clean: (item: unknown, record: ExportRecord) => T | null) =>
		items
			.slice(0, MAX_SUMMARY_ITEMS)
			.map((item) => clean(item, record))
			.filter((item): item is T => item !== null);

	return {
		...summary,
		trips: keep(summary.trips, sanitizeTrip),
		charging: keep(summary.charging, sanitizeSession)
	};
}

/**
 * Starts an upload: the record and its summary land, the buffers follow, and
 * only then is it marked complete. Repeating it while it is incomplete updates
 * the record and keeps what is already stored and charged, which is what makes
 * an interrupted attempt recoverable by repeating it.
 *
 * A finished export is never written again: `complete` comes back true and
 * nothing changes. Replacing one means removing it first.
 */
export async function beginExport(
	db: Db,
	userId: string,
	id: string,
	record: ExportRecord,
	summary: ExportSummary,
	isDemo: boolean,
	timeZone: string | null = null
): Promise<{ complete: boolean }> {
	checkSummary(summary, record);

	const existing = await getExportRow(db, userId, id);
	if (existing?.complete === 1) return { complete: true };

	// A first gate only, on the client's own word: every buffer is charged as
	// it arrives, and the bucket's sum is settled when the upload completes.
	const used = await accountBytes(db, userId, id);
	if (used + record.storedBytes > MAX_ACCOUNT_BYTES) {
		throw new QuotaExceeded(used, MAX_ACCOUNT_BYTES);
	}

	// Starts at nothing charged, and a retry leaves `stored_bytes` alone: the
	// buffers it already sent are still in the bucket. The WHERE is the
	// immutability, against a completion that lands between the read and here.
	const changed = await run(
		db,
		`INSERT INTO exports (user_id, id, vin, vmodel, version, start_time, end_time, rows, days,
			distance_km, trips, stored_bytes, is_demo, record_json, uploaded_at, complete, time_zone)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?)
		 ON CONFLICT (user_id, id) DO UPDATE SET
			vin = excluded.vin, vmodel = excluded.vmodel, version = excluded.version,
			start_time = excluded.start_time, end_time = excluded.end_time, rows = excluded.rows,
			days = excluded.days, distance_km = excluded.distance_km, trips = excluded.trips,
			is_demo = excluded.is_demo, record_json = excluded.record_json,
			uploaded_at = excluded.uploaded_at, time_zone = excluded.time_zone
		 WHERE exports.complete = 0`,
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
		isDemo ? 1 : 0,
		JSON.stringify(record),
		now(),
		timeZone
	);
	if (changed === 0) return { complete: true };

	await writeSummary(db, userId, id, record.vin, record.vmodel, sanitizeSummary(summary, record));
	return { complete: false };
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
	const statements: Statement[] = [
		db.prepare('DELETE FROM trips WHERE user_id = ? AND export_id = ?').bind(userId, exportId),
		db
			.prepare('DELETE FROM charging_sessions WHERE user_id = ? AND export_id = ?')
			.bind(userId, exportId)
	];

	const insertTrip = db.prepare(
		`INSERT INTO trips (user_id, vin, start_time, end_time, export_id, odo_start, odo_end, distance_km, summary_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (user_id, vin, start_time) DO UPDATE SET
			end_time = excluded.end_time, export_id = excluded.export_id,
			odo_start = excluded.odo_start, odo_end = excluded.odo_end,
			distance_km = excluded.distance_km, summary_json = excluded.summary_json`
	);
	for (const trip of summary.trips) {
		statements.push(
			insertTrip.bind(
				userId,
				vin,
				trip.startTime,
				trip.endTime,
				exportId,
				trip.odoStart ?? null,
				trip.odoEnd ?? null,
				trip.distanceKm ?? null,
				JSON.stringify(trip)
			)
		);
	}

	const insertSession = db.prepare(
		`INSERT INTO charging_sessions (user_id, vin, start_time, end_time, export_id, odometer, summary_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (user_id, vin, start_time) DO UPDATE SET
			end_time = excluded.end_time, export_id = excluded.export_id,
			odometer = excluded.odometer, summary_json = excluded.summary_json`
	);
	for (const session of summary.charging) {
		statements.push(
			insertSession.bind(
				userId,
				vin,
				session.startTime,
				session.endTime,
				exportId,
				session.odometer ?? null,
				JSON.stringify(session)
			)
		);
	}

	// Only a newer reading may move the car's state on: exports are often
	// uploaded out of order, and an older one must not rewind the odometer.
	// A car with no reading yet takes any.
	statements.push(
		db
			.prepare(
				`INSERT INTO vehicles (user_id, vin, vmodel, last_sample_time, odometer_km, soc, range_km, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT (user_id, vin) DO UPDATE SET
					vmodel = excluded.vmodel,
					last_sample_time = excluded.last_sample_time,
					odometer_km = excluded.odometer_km,
					soc = excluded.soc,
					range_km = excluded.range_km,
					updated_at = excluded.updated_at
				 WHERE vehicles.last_sample_time IS NULL
					OR excluded.last_sample_time >= vehicles.last_sample_time`
			)
			.bind(
				userId,
				vin,
				vmodel,
				summary.vehicle.lastSampleTime,
				summary.vehicle.odometerKm ?? null,
				summary.vehicle.soc ?? null,
				summary.vehicle.rangeKm ?? null,
				now()
			)
	);

	await runBatched(db, statements);
}

/**
 * Charges an upload for the bytes the bucket actually holds, and completes it
 * only if the account still has room for them. One statement, so two uploads
 * finishing at once cannot both fit into the same space. False when it did
 * not fit, or was already complete: a finished export is never settled again.
 * One that did not fit stays incomplete and charged until the sweep removes it.
 */
export async function settleExport(
	db: Db,
	userId: string,
	id: string,
	bytes: number
): Promise<boolean> {
	const row = await one<{ complete: number }>(
		db,
		`UPDATE exports SET stored_bytes = ?3,
			complete = CASE WHEN ?3 + (SELECT COALESCE(SUM(other.stored_bytes), 0) FROM exports other
				WHERE other.user_id = ?1 AND other.id != ?2) <= ?4 THEN 1 ELSE 0 END
		 WHERE user_id = ?1 AND id = ?2 AND complete = 0
		 RETURNING complete`,
		userId,
		id,
		bytes,
		MAX_ACCOUNT_BYTES
	);
	return row?.complete === 1;
}

/**
 * Removes an export and what only it speaks for, in one transaction.
 *
 * A trip carries the id of whichever export wrote it last, and exports overlap
 * by design. So a trip or session that another finished export of the same car
 * covers is handed to that one rather than deleted with this. Whatever then
 * points at nothing goes too: the car once no export of it is left, unclaimed
 * board candidates for trips that are gone, and public links to this export.
 */
export async function deleteExport(db: Db, userId: string, id: string): Promise<void> {
	const handOver = (table: 'trips' | 'charging_sessions') =>
		db
			.prepare(
				`UPDATE ${table} SET export_id = COALESCE((
					SELECT e.id FROM exports e
					WHERE e.user_id = ${table}.user_id AND e.vin = ${table}.vin AND e.id != ?2
						AND e.complete = 1
						AND ${table}.start_time BETWEEN e.start_time AND e.end_time
					ORDER BY e.end_time DESC LIMIT 1
				), export_id)
				 WHERE user_id = ?1 AND export_id = ?2`
			)
			.bind(userId, id);

	await db.batch([
		handOver('trips'),
		handOver('charging_sessions'),
		db.prepare('DELETE FROM trips WHERE user_id = ? AND export_id = ?').bind(userId, id),
		db
			.prepare('DELETE FROM charging_sessions WHERE user_id = ? AND export_id = ?')
			.bind(userId, id),
		db.prepare('DELETE FROM exports WHERE user_id = ? AND id = ?').bind(userId, id),
		db
			.prepare(
				`DELETE FROM vehicles WHERE user_id = ?1
				 AND vin NOT IN (SELECT vin FROM exports WHERE user_id = ?1)`
			)
			.bind(userId),
		db
			.prepare(
				`DELETE FROM board_candidates WHERE user_id = ?1 AND entry_id IS NULL
				 AND NOT EXISTS (
					SELECT 1 FROM trips t WHERE board_candidates.kind = 'trip'
						AND t.user_id = ?1 AND t.vin = board_candidates.vin
						AND t.start_time = board_candidates.start_time)
				 AND NOT EXISTS (
					SELECT 1 FROM charging_sessions c WHERE board_candidates.kind = 'charging'
						AND c.user_id = ?1 AND c.vin = board_candidates.vin
						AND c.start_time = board_candidates.start_time)`
			)
			.bind(userId),
		db
			.prepare(
				`UPDATE shares SET revoked_at = ?3
				 WHERE user_id = ?1 AND kind = 'export' AND export_id = ?2 AND revoked_at IS NULL`
			)
			.bind(userId, id, now())
	]);
}

/** Uploads that were started and never finished, old enough to be abandoned. */
export function staleUploads(db: Db, olderThanSeconds = 86400): Promise<ExportRow[]> {
	return all<ExportRow>(
		db,
		'SELECT * FROM exports WHERE complete = 0 AND uploaded_at < ?',
		now() - olderThanSeconds
	);
}
