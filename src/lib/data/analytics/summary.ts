/**
 * What travels to an account alongside an export.
 *
 * The compressed columns are the export; this is the small part an API can
 * answer from. It is worked out here, in the browser, because the server could
 * not do it: a month inflates to hundreds of megabytes and a Worker has 128,
 * and the analysis has already run by the time anything is uploaded.
 *
 * Deliberately free of anything positional. `index`, `start` and `end` are
 * offsets into one particular parse and mean nothing once exports are merged
 * or re-detected, so a summary carries times and odometer readings only.
 */

import type { Dataset } from '../store/columnar';
import { valueAt } from '../store/columnar';
import type { DerivedData } from './index';

export interface TripSummary {
	startTime: number;
	endTime: number;
	odoStart: number | null;
	odoEnd: number | null;
	distanceKm: number | null;
	movingSeconds: number;
	avgSpeed: number | null;
	maxSpeed: number | null;
	socStart: number | null;
	socEnd: number | null;
	energyKwh: number | null;
	regenKwh: number | null;
	consumption: number | null;
}

export interface SessionSummary {
	startTime: number;
	endTime: number;
	odometer: number | null;
	socStart: number | null;
	socEnd: number | null;
	kwhDelivered: number | null;
	maxKw: number | null;
	isDc: boolean;
}

export interface VehicleState {
	vin: string;
	vmodel: string;
	lastSampleTime: number;
	odometerKm: number | null;
	soc: number | null;
	rangeKm: number | null;
}

export interface ExportSummary {
	trips: TripSummary[];
	charging: SessionSummary[];
	vehicle: VehicleState;
}

/** JSON has no NaN, and a null reading must not arrive as a zero. */
function finite(value: number): number | null {
	return Number.isFinite(value) ? value : null;
}

/** The last real reading of a signal, which is the car's state as of the export. */
function lastReading(dataset: Dataset, key: string): number | null {
	const column = dataset.columns.get(key);
	if (!column || column.nonNull === 0) return null;
	for (let i = column.data.length - 1; i >= 0; i--) {
		const value = valueAt(column, i);
		if (!Number.isNaN(value)) return value;
	}
	return null;
}

export function summarize(dataset: Dataset, derived: DerivedData): ExportSummary {
	return {
		trips: derived.trips.map((trip) => ({
			startTime: trip.startTime,
			endTime: trip.endTime,
			odoStart: finite(trip.odoStart),
			odoEnd: finite(trip.odoEnd),
			distanceKm: finite(trip.distanceKm),
			movingSeconds: trip.movingSeconds,
			avgSpeed: finite(trip.avgSpeed),
			maxSpeed: finite(trip.maxSpeed),
			socStart: finite(trip.socStart),
			socEnd: finite(trip.socEnd),
			energyKwh: finite(trip.energyKwh),
			regenKwh: finite(trip.regenKwh),
			consumption: finite(trip.consumption)
		})),
		charging: derived.charging.sessions.map((session) => ({
			startTime: session.startTime,
			endTime: session.endTime,
			odometer: finite(session.odometer),
			socStart: finite(session.socStart),
			socEnd: finite(session.socEnd),
			kwhDelivered: finite(session.kwhDelivered),
			maxKw: finite(session.maxKw),
			isDc: session.isDc
		})),
		vehicle: {
			vin: dataset.vin,
			vmodel: dataset.vmodel,
			lastSampleTime: derived.endTime,
			odometerKm: lastReading(dataset, 'cdcu_totalodometer'),
			soc: lastReading(dataset, 'ldcu_bms_soc_disp'),
			rangeKm: lastReading(dataset, 'ldcu_dstbatdisp_dynamic')
		}
	};
}
