/**
 * The Fahrtenbuch as something to hand over.
 *
 * The rows are the easy part and live in `$lib/export/columns`. This is
 * everything around them: which period the file covers, what was driven for
 * what reason, and — the part that matters most — how many kilometres the book
 * cannot account for.
 *
 * That last one is why the summary exists at all. A logbook kept for tax has to
 * explain every kilometre on the odometer, and this app knows exactly where it
 * cannot: the gaps between one trip's final reading and the next one's first.
 * Printing the figure is the honest thing to do, and quietly leaving it out
 * would make the document look more complete than it is.
 *
 * Offered from two pages, so it is assembled once.
 */

import type { Trip } from '../data/analytics/trips';
import type { Annotation } from './types';
import { analyseLogbook } from './analytics';
import { LOGBOOK_COLUMNS, type LogbookRow } from '../export/columns';
import type { Column } from '../export/columns';
import { measure, num } from '../og/format';

export interface LogbookDocument {
	title: string;
	subtitle: string;
	columns: Array<Column<LogbookRow>>;
	rows: LogbookRow[];
	totals: Array<{ label: string; value: string }>;
	notes: string[];
	from: number;
	to: number;
}

const PURPOSE_LABELS: Record<string, string> = {
	business: 'Business',
	commute: 'Commute',
	private: 'Private',
	unlabelled: 'Unlabelled'
};

function period(from: number, to: number, timeZone: string): string {
	const format = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone
	});
	const start = format.format(new Date(from * 1000));
	const end = format.format(new Date(to * 1000));
	return start === end ? start : `${start} – ${end}`;
}

export function logbookDocument(
	trips: Trip[],
	notes: Map<number, Annotation>,
	timeZone: string,
	/** The model, and the vehicle number as the reader chose to see it. */
	vehicle: string,
	pricePerKwh = 0
): LogbookDocument {
	// Chronological, and complete: a book with the rows in the order the table
	// happened to be sorted in, or with a filter still applied, is not a book.
	const rows: LogbookRow[] = [...trips]
		.sort((a, b) => a.startTime - b.startTime)
		.map((trip) => ({ trip, note: notes.get(trip.startTime) }));

	const from = rows.length ? rows[0].trip.startTime : 0;
	const to = rows.length ? rows[rows.length - 1].trip.endTime : 0;
	const analysis = analyseLogbook(trips, notes, timeZone, pricePerKwh);

	const totals = [
		{ label: 'Trips', value: `${num(analysis.coverage.trips)}` },
		{ label: 'Distance', value: measure(analysis.coverage.km, 'km', 1) },
		...analysis.purposes.map((bucket) => ({
			label: PURPOSE_LABELS[bucket.purpose] ?? bucket.purpose,
			value: `${measure(bucket.km, 'km', 1)} over ${num(bucket.trips)} ${
				bucket.trips === 1 ? 'trip' : 'trips'
			}`
		}))
	];

	const written: string[] = [];
	const { labelled, trips: count, unrecordedKm, gaps } = analysis.coverage;
	if (count > 0 && labelled < count) {
		written.push(
			`${num(count - labelled)} of ${num(count)} trips have no origin or destination against them.`
		);
	}
	if (unrecordedKm >= 1) {
		written.push(
			`${measure(unrecordedKm, 'km', 1)} are unaccounted for, across ${num(gaps.length)} ${
				gaps.length === 1 ? 'gap' : 'gaps'
			} between the end of one recorded trip and the start of the next.`
		);
	}

	return {
		title: 'Fahrtenbuch',
		subtitle: rows.length ? `${vehicle} · ${period(from, to, timeZone)}` : vehicle,
		columns: LOGBOOK_COLUMNS,
		rows,
		totals,
		notes: written,
		from,
		to
	};
}
