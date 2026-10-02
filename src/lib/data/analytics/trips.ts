/**
 * Trip detection.
 *
 * A trip runs from the moment the car leaves Park with the odometer moving to
 * the moment it has been back in Park for a while. The odometer is the
 * authority on distance because it is monotonic and survives the stretches
 * where the ESP module stops reporting speed.
 */

import { GEAR } from '../schema/columns';
import { valueAt, type Column, type Dataset } from '../store/columnar';
import { integrateEnergy } from './energy';
import { segmentAwake, type Span } from './sessions';

/** Time in Park before a trip is considered finished. */
const PARK_SETTLE_SECONDS = 120;
/** Trips shorter than this are treated as shuffling in a parking space. */
const MIN_TRIP_SECONDS = 30;
const MIN_TRIP_KM = 0.2;

export interface Trip {
	index: number;
	start: number;
	end: number;
	startTime: number;
	endTime: number;
	/** Wall-clock seconds from first to last sample. */
	duration: number;
	/** Seconds with the car actually rolling. */
	movingSeconds: number;
	distanceKm: number;
	/**
	 * Odometer at each end, in km. Kept rather than only their difference
	 * because they are what a logbook has to show, and because they are the
	 * one thing about a trip that survives re-detection: array positions shift
	 * and boundaries move by a second or two when exports are merged, but a
	 * reading of 41 207 km is the same trip whenever it is worked out.
	 */
	odoStart: number;
	odoEnd: number;
	avgSpeed: number;
	maxSpeed: number;
	maxSpeedTime: number;
	socStart: number;
	socEnd: number;
	energyKwh: number;
	regenKwh: number;
	/** Share of gross energy that came back through regeneration, 0–1. */
	regenShare: number;
	/** kWh per 100 km, or NaN for a trip too short to be meaningful. */
	consumption: number;
	peakAccel: number;
	peakBrake: number;
	peakLateral: number;
	maxSpeedIndex: number;
}

function firstFinite(column: Column | undefined, from: number, to: number): number {
	if (!column) return NaN;
	for (let i = from; i <= to; i++) {
		const v = valueAt(column, i);
		if (!Number.isNaN(v)) return v;
	}
	return NaN;
}

function lastFinite(column: Column | undefined, from: number, to: number): number {
	if (!column) return NaN;
	for (let i = to; i >= from; i--) {
		const v = valueAt(column, i);
		if (!Number.isNaN(v)) return v;
	}
	return NaN;
}

/** Index ranges where the car was out of Park and moving. */
function candidateSpans(dataset: Dataset, awake: Span[]): Span[] {
	const gear = dataset.columns.get('ldcu_currentgearlev');
	const speed = dataset.columns.get('esp_vehspd');
	const odo = dataset.columns.get('cdcu_totalodometer');
	const { time } = dataset;
	const spans: Span[] = [];

	for (const span of awake) {
		let start = -1;
		let lastActive = -1;

		for (let i = span.start; i <= span.end; i++) {
			const g = gear ? valueAt(gear, i) : NaN;
			const v = speed ? valueAt(speed, i) : NaN;
			// "In motion" is a gear out of Park, or any reported road speed —
			// either is enough, since the two modules sleep independently.
			const driving =
				(!Number.isNaN(g) && (g === GEAR.DRIVE || g === GEAR.REVERSE || g === GEAR.NEUTRAL)) ||
				(!Number.isNaN(v) && v > 0);

			if (driving) {
				if (start === -1) start = i;
				lastActive = i;
			} else if (start !== -1 && time[i] - time[lastActive] >= PARK_SETTLE_SECONDS) {
				spans.push({
					start,
					end: lastActive,
					startTime: time[start],
					endTime: time[lastActive]
				});
				start = -1;
				lastActive = -1;
			}
		}

		if (start !== -1) {
			spans.push({ start, end: lastActive, startTime: time[start], endTime: time[lastActive] });
		}
	}

	// Keep only spans that actually covered ground.
	return spans.filter((span) => {
		if (span.endTime - span.startTime < MIN_TRIP_SECONDS) return false;
		if (!odo) return true;
		const from = firstFinite(odo, span.start, span.end);
		const to = lastFinite(odo, span.start, span.end);
		return !Number.isNaN(from) && !Number.isNaN(to) && to - from >= MIN_TRIP_KM;
	});
}

/**
 * The largest median of three consecutive readings.
 *
 * A peak is the one number a single wrong sample can win outright, and the
 * force signals are the ones to worry about: signed 16-bit CAN values with no
 * "not available" code, so a corrupt frame is indistinguishable from a real
 * reading and lands at some absurd fraction of a g. Taking the middle of every
 * three consecutive readings costs nothing at 1 Hz — a real launch lasts
 * seconds — and a lone bad frame can no longer be the answer.
 */
class MedianPeak {
	private first = NaN;
	private second = NaN;
	private seen = 0;
	max = 0;

	push(value: number): void {
		if (this.seen >= 2) {
			const low = Math.min(this.first, this.second);
			const high = Math.max(this.first, this.second);
			const median = Math.max(low, Math.min(high, value));
			if (median > this.max) this.max = median;
		}
		this.first = this.second;
		this.second = value;
		this.seen++;
	}
}

export function detectTrips(dataset: Dataset): Trip[] {
	const awake = segmentAwake(dataset.time);
	const spans = candidateSpans(dataset, awake);

	const speed = dataset.columns.get('esp_vehspd');
	const odo = dataset.columns.get('cdcu_totalodometer');
	const soc = dataset.columns.get('ldcu_bms_soc_disp');
	const volt = dataset.columns.get('bms_battvolt');
	const current = dataset.columns.get('bms_battcurr');
	const longAccel = dataset.columns.get('esp_vehlongaccel');
	const latAccel = dataset.columns.get('esp_vehlateralaccel');
	const { time } = dataset;

	return spans.map((span, index) => {
		let maxSpeed = 0;
		let maxSpeedIndex = span.start;
		let movingSeconds = 0;
		const accel = new MedianPeak();
		const brake = new MedianPeak();
		const lateral = new MedianPeak();

		for (let i = span.start; i <= span.end; i++) {
			if (speed) {
				const v = valueAt(speed, i);
				if (!Number.isNaN(v)) {
					if (v > maxSpeed) {
						maxSpeed = v;
						maxSpeedIndex = i;
					}
					if (v > 0 && i > span.start) {
						const dt = time[i] - time[i - 1];
						if (dt > 0 && dt <= 10) movingSeconds += dt;
					}
				}
			}
			if (longAccel) {
				const a = valueAt(longAccel, i);
				if (!Number.isNaN(a)) {
					// Braking is the same signal the other way up, and the median of
					// the negated readings is the negated median, so this stays exact.
					accel.push(a);
					brake.push(-a);
				}
			}
			if (latAccel) {
				const a = valueAt(latAccel, i);
				if (!Number.isNaN(a)) lateral.push(Math.abs(a));
			}
		}

		const odoStart = firstFinite(odo, span.start, span.end);
		const odoEnd = lastFinite(odo, span.start, span.end);
		const distanceKm =
			Number.isNaN(odoStart) || Number.isNaN(odoEnd) ? NaN : Math.max(0, odoEnd - odoStart);

		const energy =
			volt && current
				? integrateEnergy(time, volt, current, span.start, span.end)
				: { discharged: NaN, charged: NaN, peakPowerKw: NaN, peakRegenKw: NaN };

		const gross = energy.discharged + energy.charged;
		const duration = span.endTime - span.startTime;

		return {
			index,
			start: span.start,
			end: span.end,
			startTime: span.startTime,
			endTime: span.endTime,
			duration,
			movingSeconds,
			distanceKm,
			odoStart,
			odoEnd,
			avgSpeed: movingSeconds > 0 ? (distanceKm / movingSeconds) * 3600 : NaN,
			maxSpeed,
			maxSpeedTime: time[maxSpeedIndex],
			maxSpeedIndex,
			socStart: firstFinite(soc, span.start, span.end),
			socEnd: lastFinite(soc, span.start, span.end),
			energyKwh: energy.discharged,
			regenKwh: energy.charged,
			regenShare: gross > 0 ? energy.charged / gross : NaN,
			consumption:
				distanceKm >= 1 && Number.isFinite(energy.discharged)
					? ((energy.discharged - energy.charged) / distanceKm) * 100
					: NaN,
			peakAccel: accel.max,
			peakBrake: brake.max,
			peakLateral: lateral.max
		};
	});
}
