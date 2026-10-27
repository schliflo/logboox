/**
 * The findings, worded. Each takes the numbers the analysis found and a set of
 * formatters, so a translation decides its own sentence order.
 */

import type { FactParams } from '../../data/analytics/facts';

export interface FactText {
	kicker: string;
	value: string;
	unit?: string;
	detail: string;
}

export interface FactFormat {
	num: (value: number, digits?: number) => string;
	/** Kilometres, or km/h, as a number in the reader's unit. */
	distance: (km: number, digits?: number) => string;
	speed: (kmh: number) => string;
	units: () => { distance: string; speed: string };
	duration: (seconds: number) => string;
	/** "Sunday 30 August, 18:04". */
	when: (epochSeconds: number) => string;
	hour: (hour: number) => string;
	/** A `YYYY-MM-DD` key as "Sun 30 Aug". */
	day: (key: string) => string;
	column: (key: string) => string;
	list: (items: string[]) => string;
}

export type FactCatalog = {
	[K in keyof FactParams]: (p: FactParams[K], f: FactFormat) => FactText;
};

export const facts: FactCatalog = {
	distance: (p, f) => ({
		kicker:
			p.sources > 1
				? `Across ${p.sources} exports, in ${p.recordedDays} days you drove`
				: `In ${p.recordedDays} days you drove`,
		value: f.distance(p.km),
		unit: f.units().distance,
		detail: `Across ${p.trips} trips, averaging ${f.distance(p.km / Math.max(1, p.recordedDays), 1)} ${f.units().distance} a day.`
	}),
	'time-driving': (p, f) => ({
		kicker: 'Time behind the wheel',
		value: f.duration(p.seconds),
		detail: `That is ${f.num(p.share * 100, 1)}% of the time recorded. The car spent the rest of it parked.`
	}),
	'top-speed': (p, f) => ({
		kicker: 'Your top speed',
		value: f.speed(p.speed),
		unit: f.units().speed,
		detail: `Reached on ${f.when(p.time)}.`
	}),
	'longest-trip': (p, f) => ({
		kicker: 'Longest single trip',
		value: f.distance(p.km),
		unit: f.units().distance,
		detail: `${f.duration(p.seconds)} on ${f.when(p.time)}.`
	}),
	'hardest-brake': (p, f) => ({
		kicker: 'Hardest braking moment',
		value: f.num(p.g, 2),
		unit: 'g',
		detail: Number.isFinite(p.speed)
			? `From ${f.speed(p.speed)} ${f.units().speed} on ${f.when(p.time)}. Anything past 0.6 g is an emergency stop.`
			: `On ${f.when(p.time)}.`
	}),
	'energy-charged': (p, f) => ({
		kicker: 'Energy you put in',
		value: f.num(p.kwh),
		unit: 'kWh',
		detail: `Over ${p.sessions} charging sessions.`
	}),
	'departure-rhythm': (p, f) => ({
		kicker: 'You usually set off at',
		value: f.hour(p.hour),
		detail: `${p.count} of your ${p.trips} trips started in this hour. Your earliest was ${f.hour(p.earliest)} and your latest ${f.hour(p.latest)}.`
	}),
	'commute-shape': (p) => ({
		kicker: 'Trips that look like a commute',
		value: `${p.count}`,
		unit: `of ${p.trips}`,
		detail:
			'Two clear peaks — mornings out, evenings back — with quiet hours in between. The shape of a working week is visible in the data without anyone recording where you went.'
	}),
	'scheduled-charging': (p, f) => ({
		kicker: 'Your charging starts at',
		value: f.hour(p.hour),
		detail: `${p.count} sessions began in that hour. That regularity means a charging timer, not a habit — most likely a cheap overnight tariff.`
	}),
	'plug-in-habit': (p, f) => ({
		kicker: 'You plug in most often at',
		value: f.hour(p.hour),
		detail: `${p.count} of ${p.sessions} sessions started around then. Spread across the day rather than fixed to one time, so this is a habit rather than a timer.`
	}),
	'charge-limit': (p) => ({
		kicker: 'You stop charging at',
		value: `${p.limit}`,
		unit: '%',
		detail:
			'Repeatedly stopping at the same point means a charge limit is set in the car. Keeping a lithium pack below full is the single easiest thing you can do for its lifespan.'
	}),
	'ac-only': (p, f) => ({
		kicker: 'You never fast-charged',
		value: f.num(p.maxKw, 1),
		unit: 'kW peak',
		detail:
			'Every session in this window ran through the onboard AC charger. The car is capable of far more, but it never needed it — a sign your charging fits comfortably into time spent parked.'
	}),
	'idle-days': (p, f) => ({
		kicker: 'Days the car never moved',
		value: `${p.count}`,
		detail: `${p.days.map(f.day).join(', ')}${p.count > p.days.length ? ' and more' : ''}. A parked car still writes a full second-by-second log.`
	}),
	'busiest-day': (p, f) => ({
		kicker: 'Your busiest day',
		value: f.distance(p.km),
		unit: f.units().distance,
		detail: `${f.day(p.day)}, with ${p.trips} trips and ${f.duration(p.seconds)} of driving.`
	}),
	'phantom-drain': (p, f) => ({
		kicker: 'Charge lost while parked',
		value: f.num(p.perDay, 1),
		unit: '%/day',
		detail: `Measured across ${p.periods} periods where the car sat untouched. Even asleep, it keeps its systems alive.`
	}),
	'implied-range': (p, f) => ({
		kicker: 'Your real full-charge range',
		value: f.distance(p.km),
		unit: f.units().distance,
		detail: `Extrapolated from what the car itself predicts. It ranged between ${f.distance(p.min)} and ${f.distance(p.max)} ${f.units().distance} depending on weather and how you were driving.`
	}),
	'door-rhythm': (p, f) => ({
		kicker: 'Doors opened',
		value: f.num(p.count),
		unit: 'times',
		detail: `Busiest at ${f.hour(p.busiestHour)}${
			p.quiet
				? `, and not once in the ${p.quiet.hours} hours between ${f.hour(p.quiet.from)} and ${f.hour(p.quiet.to)}`
				: ''
		}. Every entry and exit is timestamped to the second.`
	}),
	'sample-count': (p, f) => ({
		kicker: 'Moments recorded',
		value: f.num(p.samples),
		detail: `One sample per second, covering ${f.num(p.coverage * 100)}% of the time recorded. The gaps are when the car was asleep — it stops logging rather than recording zeros.`
	}),
	'empty-columns': (p, f) => ({
		kicker: 'Signals recorded as blank',
		value: `${p.count}`,
		detail: `${p.keys.map(f.column).join(', ')}${p.count > p.keys.length ? ' and others' : ''} appear in every row of the file and are empty in all of them. The export uses one schema for the whole fleet, so your car simply has nothing to say in these columns.`
	}),
	'duplicate-rows': (p, f) => ({
		kicker: 'Rows delivered twice',
		value: f.num(p.count),
		detail:
			'Identical rows repeated back to back — the fingerprint of a data pipeline that replays batches when it is unsure a delivery succeeded. Counting them as real would inflate every total.'
	}),
	'undated-rows': (p, f) => ({
		kicker: 'Rows with no usable time',
		value: f.num(p.count),
		detail:
			"Stamped before 2015, years apart from the rest, or with no date at all, usually because the car's clock had not been set. They are left out. Kept, they would stretch every chart back across the years in between."
	}),
	'beijing-time': () => ({
		kicker: 'Your day starts at',
		value: '18:00',
		detail:
			'The file carries a date column alongside each timestamp, and it rolls over at midnight in Beijing — early evening where you are. Grouped by that column, an evening drive lands on the next day. This app ignores it and works from the timestamps.'
	}),
	'pack-spread': (p, f) => ({
		kicker: 'Widest temperature spread',
		value: f.num(p.spread),
		unit: '°C',
		detail: `Between the warmest and coolest part of the battery, on ${f.when(p.time)}. The pack reports which sensor was which — but not where in the car they sit.`
	}),
	'tyre-weather': (p, f) => ({
		kicker: 'Your tyres track the weather',
		value: f.num(p.correlation, 2),
		unit: 'correlation',
		detail:
			'Daily tyre pressure moves with battery temperature, which follows the outside air. Your car has been keeping an unintentional weather diary.'
	}),
	'no-gps': () => ({
		kicker: 'Location records included',
		value: 'None',
		detail:
			'There is not one coordinate anywhere in this export. A connected car plainly knows where it has been — navigation, charging maps and roadside assistance all depend on it — but none of that is in the data you were given.'
	}),
	'vin-repetition': (p, f) => ({
		kicker: 'Times your VIN appears',
		value: f.num(p.rows),
		detail:
			'Your vehicle identification number is repeated on every single row of every file. It identifies the car, and through registration, you. This app keeps it masked and never sends it anywhere.'
	}),
	'routine-exposure': (p) => ({
		kicker: 'Your routine, reconstructed',
		value: `${p.count} events`,
		detail:
			'Door openings alone show when you leave, when you come back, whether anyone sat in the back, and which days you did not go out at all. No location data is needed to describe a life in detail.'
	}),
	'second-resolution': () => ({
		kicker: 'Recording resolution',
		value: '1 second',
		detail:
			'Speed, pedal position, steering angle and braking are all sampled every second the car is awake. That is fine enough to reconstruct individual manoeuvres, not merely journeys.'
	})
};
