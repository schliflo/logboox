/**
 * What a downloaded list contains, said once.
 *
 * Three formats write the same two tables — a Fahrtenbuch and a list of
 * charging sessions — and there is no version of this where they are allowed to
 * disagree about which columns exist or what they are called. So each list is
 * described once here, and every writer reads the description.
 *
 * A column yields a raw value: a number, an epoch, a string, or null where the
 * car reported nothing. Rounding, decimal commas, date serials and text
 * alignment are the writer's business, because each format has different ideas
 * about all four — a CSV wants `101,4`, a spreadsheet wants the number 101.42
 * and a format to show it with, and a PDF wants it right-aligned in a box.
 */

import type { Trip } from '../data/analytics/trips';
import type { ChargeSession } from '../data/analytics/charging';
import type { Annotation } from '../logbook/types';

export type ColumnKind = 'text' | 'number' | 'date' | 'time';

export interface Column<T> {
	header: string;
	kind: ColumnKind;
	/** Decimal places, for a number. */
	digits?: number;
	/** Rough width in characters, for the formats that need one. */
	width: number;
	/** The raw value, or null where there is nothing to say. */
	value: (row: T) => string | number | null;
}

/** Numbers arrive as NaN where a signal was never reported. */
function finite(value: number): number | null {
	return Number.isFinite(value) ? value : null;
}

export interface LogbookRow {
	trip: Trip;
	note: Annotation | undefined;
}

/**
 * The Fahrtenbuch.
 *
 * These eleven, in this order, are what an accountant or a tax office expects,
 * and they are what the CSV has always written. Changing the order changes
 * every file anyone has already downloaded, so it does not change.
 */
export const LOGBOOK_COLUMNS: Array<Column<LogbookRow>> = [
	{ header: 'Date', kind: 'date', width: 13, value: ({ trip }) => trip.startTime },
	{ header: 'Start', kind: 'time', width: 7, value: ({ trip }) => trip.startTime },
	{ header: 'End', kind: 'time', width: 7, value: ({ trip }) => trip.endTime },
	{
		header: 'Odometer start (km)',
		kind: 'number',
		digits: 0,
		width: 12,
		value: ({ trip }) => finite(trip.odoStart)
	},
	{
		header: 'Odometer end (km)',
		kind: 'number',
		digits: 0,
		width: 12,
		value: ({ trip }) => finite(trip.odoEnd)
	},
	{
		header: 'Distance (km)',
		kind: 'number',
		digits: 1,
		width: 11,
		value: ({ trip }) => finite(trip.distanceKm)
	},
	{
		header: 'Duration (min)',
		kind: 'number',
		digits: 0,
		width: 10,
		value: ({ trip }) => finite(trip.duration / 60)
	},
	{ header: 'Origin', kind: 'text', width: 22, value: ({ note }) => note?.origin ?? '' },
	{ header: 'Destination', kind: 'text', width: 22, value: ({ note }) => note?.destination ?? '' },
	{ header: 'Purpose', kind: 'text', width: 11, value: ({ note }) => note?.purpose ?? '' },
	{ header: 'Comment', kind: 'text', width: 30, value: ({ note }) => note?.comment ?? '' }
];

export interface ChargingRow {
	session: ChargeSession;
	/** What a kilowatt-hour costs, for the estimate at the end of the row. */
	pricePerKwh: number;
}

/**
 * The charging sessions.
 *
 * Energy is what came out of the plug, not what reached the pack: it is the
 * number on the invoice, and the one worth carrying into a spreadsheet. The
 * cost beside it is an estimate at a single price, which is what the app has to
 * work with — nothing in the export says what anything cost.
 */
export const CHARGING_COLUMNS: Array<Column<ChargingRow>> = [
	{ header: 'Date', kind: 'date', width: 13, value: ({ session }) => session.startTime },
	{ header: 'Start', kind: 'time', width: 7, value: ({ session }) => session.startTime },
	{ header: 'End', kind: 'time', width: 7, value: ({ session }) => session.endTime },
	{
		header: 'Duration (min)',
		kind: 'number',
		digits: 0,
		width: 10,
		value: ({ session }) => finite(session.duration / 60)
	},
	{
		header: 'Odometer (km)',
		kind: 'number',
		digits: 0,
		width: 12,
		value: ({ session }) => finite(session.odometer)
	},
	{
		header: 'Charge from (%)',
		kind: 'number',
		digits: 0,
		width: 10,
		value: ({ session }) => finite(session.socStart)
	},
	{
		header: 'Charge to (%)',
		kind: 'number',
		digits: 0,
		width: 10,
		value: ({ session }) => finite(session.socEnd)
	},
	{
		header: 'Energy (kWh)',
		kind: 'number',
		digits: 2,
		width: 11,
		value: ({ session }) => finite(session.kwhDelivered)
	},
	{
		header: 'Peak power (kW)',
		kind: 'number',
		digits: 1,
		width: 11,
		value: ({ session }) => finite(session.maxKw)
	},
	{
		header: 'Average power (kW)',
		kind: 'number',
		digits: 1,
		width: 12,
		value: ({ session }) => finite(session.avgKw)
	},
	{ header: 'Type', kind: 'text', width: 6, value: ({ session }) => (session.isDc ? 'DC' : 'AC') },
	{
		header: 'Estimated cost',
		kind: 'number',
		digits: 2,
		width: 11,
		value: ({ session, pricePerKwh }) =>
			pricePerKwh > 0 ? finite(session.kwhDelivered * pricePerKwh) : null
	}
];
