/**
 * The landing page's previews of the demo month.
 *
 * The landing page cannot afford to generate the demo just to decorate itself,
 * so the few numbers its previews draw are cut from the demo once and kept in
 * `teasers.json`. The test beside this file regenerates them and fails when the
 * demo has moved on; `vitest -u` writes the new snapshot.
 */

import type { Dataset } from '../data/store/columnar';
import { decodeRange } from '../data/store/columnar';
import type { DerivedData } from '../data/analytics';
import type { Fact } from '../data/analytics/facts';
import { instantPowerKw } from '../data/analytics/energy';

export interface Teasers {
	/** The opening sequence's card for the longest trip. */
	longestTrip: Fact;
	/** The g-g histogram, halved in resolution: plenty for a preview. */
	gg: { size: number; extent: number; max: number; total: number; cells: number[] };
	/** Door openings, [weekday, Sunday first][hour]. */
	doors: number[][];
	/** The trip with the most stops, squeezed; `peak` is where its top speed falls. */
	trip: {
		startTime: number;
		step: number;
		peak: number;
		speed: number[];
		power: number[];
		soc: number[];
	};
	/** The most powerful charge. */
	charge: {
		duration: number;
		kwh: number;
		maxKw: number;
		socStart: number;
		socEnd: number;
		power: number[];
		soc: number[];
	};
	/** Recent trips worth a logbook line. */
	logbook: Array<{ startTime: number; distanceKm: number; duration: number }>;
}

/** The zone the snapshot was cut in; its times read as wall clock there. */
export const DEMO_ZONE = 'Europe/Berlin';

const POINTS = 160;

/** Bucket averages, NaNs skipped, to one decimal. */
function squeeze(values: ArrayLike<number>, points = POINTS): number[] {
	const out: number[] = [];
	const width = values.length / points;
	for (let p = 0; p < points; p++) {
		let sum = 0;
		let count = 0;
		for (let i = Math.floor(p * width); i < Math.floor((p + 1) * width); i++) {
			if (Number.isFinite(values[i])) {
				sum += values[i];
				count++;
			}
		}
		out.push(count ? Math.round((sum / count) * 10) / 10 : 0);
	}
	return out;
}

function powerKw(dataset: Dataset, from: number, to: number): number[] {
	const volt = dataset.columns.get('bms_battvolt');
	const current = dataset.columns.get('bms_battcurr');
	if (!volt || !current) return [];
	const out = new Float64Array(to - from + 1);
	for (let i = 0; i < out.length; i++) out[i] = instantPowerKw(volt, current, from + i);
	return squeeze(out);
}

/** Times the car came to a halt mid-trip: what makes a trace read as a drive. */
function stops(dataset: Dataset, from: number, to: number): number {
	const column = dataset.columns.get('esp_vehspd');
	if (!column) return 0;
	let count = 0;
	let moving = false;
	for (const speed of decodeRange(column, from, to + 1)) {
		if (speed > 3) moving = true;
		else if (moving) {
			count++;
			moving = false;
		}
	}
	return count;
}

function series(dataset: Dataset, key: string, from: number, to: number): number[] {
	const column = dataset.columns.get(key);
	return column ? squeeze(decodeRange(column, from, to + 1)) : [];
}

export function buildTeasers(dataset: Dataset, derived: DerivedData): Teasers {
	const longestTrip = derived.facts.headline.find((fact) => fact.id === 'longest-trip');
	if (!longestTrip || longestTrip.id !== 'longest-trip')
		throw new Error('The demo has no longest trip.');

	const { gg } = derived;
	const size = gg.size / 2;
	const cells = new Array<number>(size * size).fill(0);
	for (let row = 0; row < gg.size; row++) {
		for (let col = 0; col < gg.size; col++) {
			cells[(row >> 1) * size + (col >> 1)] += gg.grid[row * gg.size + col];
		}
	}

	const halts = derived.trips.map((t) => stops(dataset, t.start, t.end));
	const trip = derived.trips[halts.indexOf(Math.max(...halts))];
	const span = trip.end - trip.start + 1;

	const charge = derived.charging.sessions.reduce((a, b) => (b.maxKw > a.maxKw ? b : a));

	const logbook = derived.trips
		.filter((t) => t.distanceKm >= 5)
		.slice(-3)
		.reverse()
		.map((t) => ({
			startTime: t.startTime,
			distanceKm: Math.round(t.distanceKm * 10) / 10,
			duration: t.duration
		}));

	return {
		longestTrip,
		gg: { size, extent: gg.extent, max: Math.max(...cells), total: gg.total, cells },
		doors: derived.doors.grid.map((row) => [...row]),
		trip: {
			startTime: trip.startTime,
			step: span / POINTS,
			peak: Math.min(POINTS - 1, Math.floor(((trip.maxSpeedIndex - trip.start) / span) * POINTS)),
			speed: series(dataset, 'esp_vehspd', trip.start, trip.end),
			power: powerKw(dataset, trip.start, trip.end),
			soc: series(dataset, 'ldcu_bms_soc_disp', trip.start, trip.end)
		},
		charge: {
			duration: charge.duration,
			kwh: Math.round(charge.kwhDelivered * 10) / 10,
			maxKw: Math.round(charge.maxKw),
			socStart: Math.round(charge.socStart),
			socEnd: Math.round(charge.socEnd),
			power: series(dataset, 'ldcu_chrgpwr', charge.start, charge.end),
			soc: series(dataset, 'ldcu_bms_soc_disp', charge.start, charge.end)
		},
		logbook
	};
}
