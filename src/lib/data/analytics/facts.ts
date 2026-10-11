/**
 * The narrative layer.
 *
 * Everything else in `analytics/` measures the car. This module decides what is
 * worth saying about it: the headline numbers for the opening sequence, and the
 * observations a reader would not have gone looking for — what the data reveals
 * about the household's routine, and what the export quietly leaves out.
 *
 * Each fact carries the numbers behind it and a route, so a card can double as
 * a way into the section that explains it. The wording is the UI's business
 * (`#lib/i18n/facts`): this runs in the worker, which has no language.
 */

import type { Dataset } from '../store/columnar';
import type { Trip } from './trips';
import type { ChargingHabits } from './charging';
import type { DayBucket } from './daily';
import type { PhantomDrain, RangeEstimate, PackThermal } from './battery';
import type { DoorActivity, TyreTrend } from './doorsTyres';
import type { SpeedProfile, ExtremeEvent } from './drivingStyle';
import { localParts } from './daily';
import { tripLink } from '../range';

export type FactTone = 'headline' | 'habit' | 'quirk' | 'privacy';

/** The numbers each kind of fact is worded from. Times are epoch seconds. */
export interface FactParams {
	distance: { km: number; trips: number; recordedDays: number; sources: number };
	'time-driving': { seconds: number; share: number };
	'top-speed': { speed: number; time: number };
	'longest-trip': { km: number; seconds: number; time: number };
	'hardest-brake': { g: number; speed: number; time: number };
	'energy-charged': { kwh: number; sessions: number };
	'departure-rhythm': {
		hour: number;
		count: number;
		trips: number;
		earliest: number;
		latest: number;
	};
	'commute-shape': { count: number; trips: number };
	'scheduled-charging': { hour: number; count: number };
	'plug-in-habit': { hour: number; count: number; sessions: number };
	'charge-limit': { limit: number };
	'ac-only': { maxKw: number };
	/** `days` holds the first few `YYYY-MM-DD` keys. */
	'idle-days': { count: number; days: string[] };
	'busiest-day': { km: number; day: string; trips: number; seconds: number };
	'phantom-drain': { perDay: number; periods: number };
	'implied-range': { km: number; min: number; max: number };
	'door-rhythm': {
		count: number;
		busiestHour: number;
		quiet: { hours: number; from: number; to: number } | null;
	};
	'sample-count': { samples: number; coverage: number };
	/** `keys` holds the first few column keys. */
	'empty-columns': { count: number; keys: string[] };
	'duplicate-rows': { count: number };
	'undated-rows': { count: number };
	'beijing-time': Record<string, never>;
	'pack-spread': { spread: number; time: number };
	'tyre-weather': { correlation: number };
	'no-gps': Record<string, never>;
	'vin-repetition': { rows: number };
	'routine-exposure': { count: number };
	'second-resolution': Record<string, never>;
}

export type FactId = keyof FactParams;

export type Fact = {
	[K in FactId]: {
		id: K;
		tone: FactTone;
		params: FactParams[K];
		/** Where to go to see the underlying data. */
		href?: string;
		timestamp?: number;
	};
}[FactId];

export interface FactInputs {
	dataset: Dataset;
	trips: Trip[];
	charging: ChargingHabits;
	days: DayBucket[];
	drain: PhantomDrain;
	range: RangeEstimate;
	thermal: PackThermal;
	doors: DoorActivity;
	tyres: TyreTrend;
	speed: SpeedProfile;
	hardestBrakes: ExtremeEvent[];
	timeZone: string;
	/** Seconds the exports account for — never the calendar span. */
	recordedSeconds: number;
	/** Calendar days the exports account for. */
	recordedDays: number;
	/** Exports behind these numbers; more than one means a merged record. */
	sources: number;
}

const nf = (value: number, digits = 0) =>
	Number.isFinite(value)
		? value.toLocaleString('en-GB', {
				minimumFractionDigits: digits,
				maximumFractionDigits: digits
			})
		: '—';

function duration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return '—';
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.round((seconds % 3600) / 60);
	if (hours === 0) return `${minutes} min`;
	return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

function dayName(index: number): string {
	return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index];
}

function formatTime(epochSeconds: number, timeZone: string): string {
	return new Intl.DateTimeFormat('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone
	}).format(new Date(epochSeconds * 1000));
}

function hourLabel(hour: number): string {
	return `${hour.toString().padStart(2, '0')}:00`;
}

/** The opening sequence: the numbers that describe the record at a glance. */
export function headlineFacts(input: FactInputs): Fact[] {
	const { trips, days, charging, speed, recordedSeconds, recordedDays, sources } = input;
	const facts: Fact[] = [];

	const totalKm = days.reduce((sum, day) => sum + day.distanceKm, 0);
	const drivingSeconds = trips.reduce((sum, trip) => sum + trip.movingSeconds, 0);

	if (totalKm > 0) {
		facts.push({
			id: 'distance',
			tone: 'headline',
			params: { km: totalKm, trips: trips.length, recordedDays, sources },
			href: '/dash/overview'
		});
	}

	if (drivingSeconds > 0) {
		facts.push({
			id: 'time-driving',
			tone: 'headline',
			params: { seconds: drivingSeconds, share: drivingSeconds / recordedSeconds },
			href: '/dash/trips'
		});
	}

	if (speed.maxSpeed > 0) {
		facts.push({
			id: 'top-speed',
			tone: 'headline',
			params: { speed: speed.maxSpeed, time: speed.maxSpeedTime },
			href: '/dash/driving',
			timestamp: speed.maxSpeedTime
		});
	}

	const longest = trips.reduce<Trip | null>(
		(best, trip) => (!best || trip.distanceKm > best.distanceKm ? trip : best),
		null
	);
	if (longest && Number.isFinite(longest.distanceKm)) {
		facts.push({
			id: 'longest-trip',
			tone: 'headline',
			params: { km: longest.distanceKm, seconds: longest.duration, time: longest.startTime },
			href: tripLink(longest.startTime),
			timestamp: longest.startTime
		});
	}

	const brake = input.hardestBrakes[0];
	if (brake) {
		facts.push({
			id: 'hardest-brake',
			tone: 'headline',
			params: { g: Math.abs(brake.value), speed: brake.speed, time: brake.time },
			href: '/dash/driving',
			timestamp: brake.time
		});
	}

	if (charging.totalKwh > 0) {
		facts.push({
			id: 'energy-charged',
			tone: 'headline',
			params: { kwh: charging.totalKwh, sessions: charging.sessions.length },
			href: '/dash/charging'
		});
	}

	return facts;
}

/** Patterns in how the car is used — the "you didn't know you did this" layer. */
export function habitFacts(input: FactInputs): Fact[] {
	const { trips, charging, days, doors, drain, range, timeZone } = input;
	const facts: Fact[] = [];

	if (trips.length >= 4) {
		const hours = new Array(24).fill(0);
		for (const trip of trips) hours[localParts(trip.startTime, timeZone).hour]++;
		let peak = 0;
		for (let h = 1; h < 24; h++) if (hours[h] > hours[peak]) peak = h;

		const departures = trips
			.map((trip) => localParts(trip.startTime, timeZone).hour)
			.sort((a, b) => a - b);

		facts.push({
			id: 'departure-rhythm',
			tone: 'habit',
			params: {
				hour: peak,
				count: hours[peak],
				trips: trips.length,
				earliest: departures[0],
				latest: departures[departures.length - 1]
			},
			href: '/dash/overview'
		});

		// A commuter shows two peaks a working day apart; anything else is not.
		const morning = hours.slice(5, 10).reduce((a, b) => a + b, 0);
		const evening = hours.slice(15, 20).reduce((a, b) => a + b, 0);
		if (morning >= 5 && evening >= 5 && morning + evening > trips.length * 0.5) {
			facts.push({
				id: 'commute-shape',
				tone: 'habit',
				params: { count: morning + evening, trips: trips.length },
				href: '/dash/overview'
			});
		}
	}

	if (charging.scheduledHour !== null) {
		facts.push({
			id: 'scheduled-charging',
			tone: 'habit',
			params: { hour: charging.scheduledHour, count: charging.scheduledCount },
			href: '/dash/charging'
		});
	} else if (charging.sessions.length >= 5 && charging.plugInHour !== null) {
		facts.push({
			id: 'plug-in-habit',
			tone: 'habit',
			params: {
				hour: charging.plugInHour,
				count: charging.plugInCount,
				sessions: charging.sessions.length
			},
			href: '/dash/charging'
		});
	}

	if (charging.chargeLimit !== null) {
		facts.push({
			id: 'charge-limit',
			tone: 'habit',
			params: { limit: charging.chargeLimit },
			href: '/dash/charging'
		});
	}

	if (charging.sessions.length > 0 && charging.dcSessions === 0) {
		facts.push({
			id: 'ac-only',
			tone: 'habit',
			params: { maxKw: Math.max(...charging.sessions.map((s) => s.maxKw)) },
			href: '/dash/charging'
		});
	}

	const idleDays = days.filter((day) => day.covered && day.distanceKm === 0);
	if (idleDays.length > 0) {
		facts.push({
			id: 'idle-days',
			tone: 'habit',
			params: { count: idleDays.length, days: idleDays.slice(0, 5).map((d) => d.date) },
			href: '/dash/overview'
		});
	}

	const busiest = days.reduce<DayBucket | null>(
		(best, day) => (!best || day.distanceKm > best.distanceKm ? day : best),
		null
	);
	if (busiest && busiest.distanceKm > 0) {
		facts.push({
			id: 'busiest-day',
			tone: 'habit',
			params: {
				km: busiest.distanceKm,
				day: busiest.date,
				trips: busiest.trips,
				seconds: busiest.drivingSeconds
			},
			href: '/dash/overview'
		});
	}

	if (Number.isFinite(drain.medianPercentPerDay) && drain.events.length > 2) {
		facts.push({
			id: 'phantom-drain',
			tone: 'habit',
			params: { perDay: drain.medianPercentPerDay, periods: drain.events.length },
			href: '/dash/battery'
		});
	}

	if (Number.isFinite(range.medianFullRange)) {
		facts.push({
			id: 'implied-range',
			tone: 'habit',
			params: {
				km: range.medianFullRange,
				min: range.minFullRange,
				max: range.maxFullRange
			},
			href: '/dash/battery'
		});
	}

	if (doors.events.length > 0) {
		const quiet = doors.quietStretch;
		facts.push({
			id: 'door-rhythm',
			tone: 'habit',
			params: {
				count: doors.events.length,
				busiestHour: doors.busiestHour,
				quiet: quiet && quiet.hours >= 3 ? quiet : null
			},
			href: '/dash/doors-tyres'
		});
	}

	return facts;
}

/**
 * What the export itself reveals — about its own construction, and about how
 * much of the car's life it records.
 */
export function quirkFacts(input: FactInputs): Fact[] {
	const { dataset, tyres, thermal, recordedSeconds } = input;
	const facts: Fact[] = [];

	facts.push({
		id: 'sample-count',
		tone: 'quirk',
		params: { samples: dataset.time.length, coverage: dataset.time.length / recordedSeconds },
		href: '/dash/explorer'
	});

	if (dataset.emptyColumns.length > 0) {
		facts.push({
			id: 'empty-columns',
			tone: 'quirk',
			params: { count: dataset.emptyColumns.length, keys: dataset.emptyColumns.slice(0, 4) },
			href: '/dash/explorer'
		});
	}

	if (dataset.duplicateRows > 0) {
		facts.push({
			id: 'duplicate-rows',
			tone: 'quirk',
			params: { count: dataset.duplicateRows },
			href: '/dash/privacy'
		});
	}

	if (dataset.undatedRows > 0) {
		facts.push({
			id: 'undated-rows',
			tone: 'quirk',
			params: { count: dataset.undatedRows },
			href: '/dash/privacy'
		});
	}

	facts.push({ id: 'beijing-time', tone: 'quirk', params: {}, href: '/dash/privacy' });

	if (Number.isFinite(thermal.maxSpread) && thermal.maxSpread > 0) {
		facts.push({
			id: 'pack-spread',
			tone: 'quirk',
			params: { spread: thermal.maxSpread, time: thermal.maxSpreadTime },
			href: '/dash/battery'
		});
	}

	if (Number.isFinite(tyres.temperatureCorrelation)) {
		if (Math.abs(tyres.temperatureCorrelation) > 0.3) {
			facts.push({
				id: 'tyre-weather',
				tone: 'quirk',
				params: { correlation: tyres.temperatureCorrelation },
				href: '/dash/doors-tyres'
			});
		}
	}

	return facts;
}

/** What the export says about you, and what it conspicuously omits. */
export function privacyFacts(input: FactInputs): Fact[] {
	const { dataset, doors } = input;
	const facts: Fact[] = [];

	facts.push({ id: 'no-gps', tone: 'privacy', params: {}, href: '/dash/privacy' });

	if (dataset.vin) {
		facts.push({
			id: 'vin-repetition',
			tone: 'privacy',
			params: { rows: dataset.rowsParsed },
			href: '/dash/privacy'
		});
	}

	if (doors.events.length > 0) {
		facts.push({
			id: 'routine-exposure',
			tone: 'privacy',
			params: { count: doors.events.length },
			href: '/dash/doors-tyres'
		});
	}

	facts.push({ id: 'second-resolution', tone: 'privacy', params: {}, href: '/dash/driving' });

	return facts;
}

export function buildFacts(input: FactInputs): {
	headline: Fact[];
	habit: Fact[];
	quirk: Fact[];
	privacy: Fact[];
} {
	return {
		headline: headlineFacts(input),
		habit: habitFacts(input),
		quirk: quirkFacts(input),
		privacy: privacyFacts(input)
	};
}
