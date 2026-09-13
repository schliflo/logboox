/**
 * Summaries to test against.
 *
 * Every field filled with something a real car would report, so a test can say
 * what it is actually about by overriding one of them. Shared by the tests for
 * the boards, the account repository and the leaderboard itself, which would
 * otherwise each keep their own drifting copy of the same forty numbers.
 */

import type { SessionSummary, TripSummary } from '../data/analytics/summary';

/** A Monday, 07:00 in Berlin. */
export const MONDAY_MORNING = Math.floor(Date.UTC(2026, 8, 7, 5, 0) / 1000);

/** An unremarkable half-hour commute: 20 km, gently driven, fully recorded. */
export function tripSummary(overrides: Partial<TripSummary> = {}): TripSummary {
	const startTime = overrides.startTime ?? MONDAY_MORNING;
	const endTime = overrides.endTime ?? startTime + 1800;
	return {
		startTime,
		endTime,
		odoStart: 41000,
		odoEnd: 41020,
		distanceKm: 20,
		movingSeconds: 1500,
		avgSpeed: 48,
		maxSpeed: 110,
		socStart: 80,
		socEnd: 74,
		energyKwh: 4,
		regenKwh: 0.6,
		consumption: 17,
		peakAccel: 0.28,
		peakBrake: 0.31,
		peakLateral: 0.22,
		coverage: 1,
		...overrides
	};
}

/** A rapid charge: half an hour, 45 kWh, peaking at 150 kW. */
export function sessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
	const startTime = overrides.startTime ?? MONDAY_MORNING + 4 * 3600;
	const endTime = overrides.endTime ?? startTime + 1800;
	return {
		startTime,
		endTime,
		odometer: 41020,
		socStart: 18,
		socEnd: 72,
		kwhDelivered: 45,
		maxKw: 150,
		isDc: true,
		coverage: 1,
		...overrides
	};
}
