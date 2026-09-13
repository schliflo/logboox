/**
 * Reading an account's own data back out.
 *
 * This is what an API token is for: a car's latest state, and the trips and
 * charging sessions derived from the exports the account holds. All of it was
 * computed in a browser and uploaded; none of it is recomputed here.
 */

import { all, one, type Db } from '../db';

export interface VehicleRow {
	vin: string;
	vmodel: string;
	last_sample_time: number | null;
	odometer_km: number | null;
	soc: number | null;
	range_km: number | null;
	updated_at: number;
}

export interface SummaryRow {
	start_time: number;
	end_time: number;
	export_id: string;
	summary_json: string;
}

/** Exports are capped so one request cannot ask for a year of seconds. */
export const MAX_PAGE = 500;
export const DEFAULT_PAGE = 100;

export function clampLimit(raw: string | null): number {
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) return DEFAULT_PAGE;
	return Math.min(Math.floor(value), MAX_PAGE);
}

export function listVehicles(db: Db, userId: string): Promise<VehicleRow[]> {
	return all<VehicleRow>(
		db,
		`SELECT vin, vmodel, last_sample_time, odometer_km, soc, range_km, updated_at
		 FROM vehicles WHERE user_id = ? ORDER BY last_sample_time DESC`,
		userId
	);
}

export function getVehicle(db: Db, userId: string, vin: string): Promise<VehicleRow | null> {
	return one<VehicleRow>(
		db,
		`SELECT vin, vmodel, last_sample_time, odometer_km, soc, range_km, updated_at
		 FROM vehicles WHERE user_id = ? AND vin = ?`,
		userId,
		vin
	);
}

/** What the account knows about one car, in numbers rather than rows. */
export async function vehicleTotals(
	db: Db,
	userId: string,
	vin: string
): Promise<{ exports: number; trips: number; charging: number; from: number; to: number }> {
	const exports = await one<{ n: number; from: number | null; to: number | null }>(
		db,
		'SELECT COUNT(*) AS n, MIN(start_time) AS "from", MAX(end_time) AS "to" FROM exports WHERE user_id = ? AND vin = ? AND complete = 1',
		userId,
		vin
	);
	const trips = await one<{ n: number }>(
		db,
		'SELECT COUNT(*) AS n FROM trips WHERE user_id = ? AND vin = ?',
		userId,
		vin
	);
	const charging = await one<{ n: number }>(
		db,
		'SELECT COUNT(*) AS n FROM charging_sessions WHERE user_id = ? AND vin = ?',
		userId,
		vin
	);

	return {
		exports: exports?.n ?? 0,
		trips: trips?.n ?? 0,
		charging: charging?.n ?? 0,
		from: exports?.from ?? 0,
		to: exports?.to ?? 0
	};
}

interface Window {
	from?: number;
	to?: number;
	limit: number;
}

function windowed(table: string): string {
	return `SELECT start_time, end_time, export_id, summary_json FROM ${table}
	 WHERE user_id = ? AND vin = ? AND start_time >= ? AND start_time <= ?
	 ORDER BY start_time DESC LIMIT ?`;
}

async function listWindow(
	db: Db,
	table: 'trips' | 'charging_sessions',
	userId: string,
	vin: string,
	window: Window
): Promise<unknown[]> {
	const rows = await all<SummaryRow>(
		db,
		windowed(table),
		userId,
		vin,
		window.from ?? 0,
		window.to ?? 4_102_444_800,
		window.limit
	);
	return rows.map((row) => ({ ...JSON.parse(row.summary_json), exportId: row.export_id }));
}

export function listTrips(db: Db, userId: string, vin: string, window: Window) {
	return listWindow(db, 'trips', userId, vin, window);
}

export function listCharging(db: Db, userId: string, vin: string, window: Window) {
	return listWindow(db, 'charging_sessions', userId, vin, window);
}

/** A window from the usual query parameters, with sane bounds. */
export function readWindow(url: URL): Window {
	const from = Number(url.searchParams.get('from'));
	const to = Number(url.searchParams.get('to'));
	return {
		from: Number.isFinite(from) && from > 0 ? Math.floor(from) : undefined,
		to: Number.isFinite(to) && to > 0 ? Math.floor(to) : undefined,
		limit: clampLimit(url.searchParams.get('limit'))
	};
}
