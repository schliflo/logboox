/**
 * The logbook as a file.
 *
 * A Fahrtenbuch is something people hand to an accountant or a tax office, so
 * what comes out here is a plain table with the columns those expect: the date,
 * the odometer at both ends, the distance, where the journey went and why.
 *
 * Semicolon-separated and with a byte-order mark, because the overwhelmingly
 * likely destination is Excel in a locale where the comma is a decimal point —
 * and a file that opens as one column per row is a file nobody can use.
 */

import type { Trip } from '../data/analytics/trips';
import type { Annotation } from './types';

const SEPARATOR = ';';

const HEADERS = [
	'Date',
	'Start',
	'End',
	'Odometer start (km)',
	'Odometer end (km)',
	'Distance (km)',
	'Duration (min)',
	'Origin',
	'Destination',
	'Purpose',
	'Comment'
];

function cell(value: string | number | null | undefined): string {
	if (value === null || value === undefined) return '';
	const text = String(value);
	// A field containing the separator, a quote or a newline is quoted, and
	// quotes inside it are doubled — the one escaping rule every reader agrees on.
	return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function number(value: number, digits = 0): string {
	if (!Number.isFinite(value)) return '';
	// Decimal comma, to match the separator choice above.
	return value.toFixed(digits).replace('.', ',');
}

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
	return new Intl.DateTimeFormat('en-GB', { ...options, timeZone });
}

export interface LogbookRow {
	trip: Trip;
	note: Annotation | undefined;
}

export function logbookCsv(rows: LogbookRow[], timeZone: string): string {
	const date = formatter(timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' });
	const time = formatter(timeZone, { hour: '2-digit', minute: '2-digit', hour12: false });

	const lines = [HEADERS.join(SEPARATOR)];

	for (const { trip, note } of rows) {
		const start = new Date(trip.startTime * 1000);
		lines.push(
			[
				cell(date.format(start)),
				cell(time.format(start)),
				cell(time.format(new Date(trip.endTime * 1000))),
				cell(number(trip.odoStart)),
				cell(number(trip.odoEnd)),
				cell(number(trip.distanceKm, 1)),
				cell(number(trip.duration / 60)),
				cell(note?.origin ?? ''),
				cell(note?.destination ?? ''),
				cell(note?.purpose ?? ''),
				cell(note?.comment ?? '')
			].join(SEPARATOR)
		);
	}

	// Excel reads a file without this as the platform's legacy encoding, which
	// turns every umlaut in a place name into rubble.
	return `﻿${lines.join('\r\n')}\r\n`;
}

export function logbookFileName(from: number, to: number, timeZone: string): string {
	const day = formatter(timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' });
	const stamp = (seconds: number) =>
		day
			.format(new Date(seconds * 1000))
			.split('/')
			.reverse()
			.join('-');
	return `logboox-fahrtenbuch-${stamp(from)}-to-${stamp(to)}.csv`;
}
