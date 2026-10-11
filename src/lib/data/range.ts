/**
 * The stretches of time the dashboard can be narrowed to.
 *
 * An export opens on the last thirty days, or the last seven when it holds
 * less than that, so a long merged timeline does not start as one blur of
 * everything (`defaultRange`). Everything is always one pick away.
 *
 * An export is history, so "the last seven days" means the last seven days it
 * recorded, not the seven before today: a month read a fortnight after it was
 * issued would otherwise offer a week with nothing in it.
 *
 * Every boundary is a local midnight in the reader's zone, found rather than
 * computed by adding days, because the day the clocks go back is twenty-five
 * hours long and a range that assumed otherwise would drop its last hour.
 */

import type { DerivedData } from './analytics';
import { localDayKey, startOfLocalDay } from './analytics/daily';
import { monthLabel, nextMonth } from '../leaderboard/periods';

export interface TimeRange {
	/** Epoch seconds, inclusive: a local midnight. */
	from: number;
	/** Epoch seconds, exclusive: the midnight after the last day included. */
	to: number;
	label: string;
	/** Which choice produced it, so the control can mark it: `last-7`, `month-2026-09`, `custom`. */
	preset: string;
}

/** What the dashboard shows when no range is chosen. */
export const EVERYTHING = 'Everything';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const LAST_DAYS = [7, 30, 90];

/**
 * Recorded days that make an export worth opening on its last thirty. An XPeng
 * export is a rolling thirty days and often arrives as twenty-nine.
 */
export const MONTH_EXPORT_DAYS = 29;

/** XPeng keeps a rolling thirty days; whatever is older than that is gone for good. */
export const EXPORT_WINDOW_DAYS = 30;

type Extent = Pick<DerivedData, 'startTime' | 'endTime' | 'days'>;

/** Calendar arithmetic on `YYYY-MM-DD`, which has no time zone to get wrong. */
export function addDays(day: string, count: number): string {
	const [year, month, date] = day.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, date + count)).toISOString().slice(0, 10);
}

/** The first and last local days anything was recorded on. */
export function recordedSpan(derived: Extent, timeZone: string): { first: string; last: string } {
	return {
		first: localDayKey(derived.startTime, timeZone),
		last: localDayKey(derived.endTime, timeZone)
	};
}

/** Calendar days from one key to another, both included. */
function daysBetween(first: string, last: string): number {
	return Math.round((Date.parse(last) - Date.parse(first)) / 86_400_000) + 1;
}

function span(first: string, last: string, timeZone: string) {
	return {
		from: startOfLocalDay(first, timeZone),
		to: startOfLocalDay(addDays(last, 1), timeZone)
	};
}

function lastDays(count: number, last: string, timeZone: string): TimeRange {
	return {
		...span(addDays(last, -(count - 1)), last, timeZone),
		label: `Last ${count} days`,
		preset: `last-${count}`
	};
}

/**
 * Where a freshly opened export starts: the last thirty days when it holds
 * about a month or more, else the last seven when it holds a week, else
 * null, which is all of it.
 *
 * For an export that is exactly that long the range covers everything, and
 * the store turns that into no range at all, so nothing is labelled as
 * narrowed when it is not.
 */
export function defaultRange(derived: Extent, timeZone: string): TimeRange | null {
	const { first, last } = recordedSpan(derived, timeZone);
	const length = daysBetween(first, last);
	if (length >= MONTH_EXPORT_DAYS) return lastDays(30, last, timeZone);
	if (length >= 7) return lastDays(7, last, timeZone);
	return null;
}

/**
 * The ranges worth offering for what is loaded: the last week, month and
 * quarter when the data is longer than that, and each calendar month and year
 * once there is more than one of them.
 */
export function rangePresets(derived: Extent, timeZone: string): TimeRange[] {
	const { first, last } = recordedSpan(derived, timeZone);
	const length = daysBetween(first, last);
	const presets: TimeRange[] = [];

	for (const count of LAST_DAYS) {
		if (count >= length) continue;
		presets.push(lastDays(count, last, timeZone));
	}

	// Months a merged timeline only passes through, in a hole between exports,
	// have nothing to show and are not offered.
	const recorded = derived.days.filter((day) => day.covered).map((day) => day.date);
	const months = [...new Set(recorded.map((day) => day.slice(0, 7)))].sort();
	if (months.length > 1) {
		for (const month of months) {
			presets.push({
				from: startOfLocalDay(`${month}-01`, timeZone),
				to: startOfLocalDay(`${nextMonth(month)}-01`, timeZone),
				label: monthLabel(month),
				preset: `month-${month}`
			});
		}
	}

	const years = [...new Set(months.map((month) => month.slice(0, 4)))];
	if (years.length > 1) {
		for (const year of years) {
			presets.push({
				...span(`${year}-01-01`, `${year}-12-31`, timeZone),
				label: year,
				preset: `year-${year}`
			});
		}
	}

	return presets;
}

/**
 * Two calendar dates, both included, held to what was recorded. Null when
 * either is not a date or nothing recorded lies between them.
 */
export function customRange(
	derived: Extent,
	fromDay: string,
	toDay: string,
	timeZone: string
): TimeRange | null {
	if (!DAY_KEY.test(fromDay) || !DAY_KEY.test(toDay)) return null;
	const { first, last } = recordedSpan(derived, timeZone);
	// Keys sort as dates, so plain comparison clamps them.
	const [a, b] = fromDay <= toDay ? [fromDay, toDay] : [toDay, fromDay];
	const start = a < first ? first : a;
	const end = b > last ? last : b;
	if (start > end) return null;
	return { ...span(start, end, timeZone), label: dayRangeLabel(start, end), preset: 'custom' };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `3 – 9 Sep`, `28 Sep – 4 Oct`, `28 Dec 2025 – 3 Jan 2026`, or one day. */
export function dayRangeLabel(first: string, last: string): string {
	const [y1, m1, d1] = first.split('-').map(Number);
	const [y2, m2, d2] = last.split('-').map(Number);
	const end = `${d2} ${MONTHS[m2 - 1]}`;
	if (first === last) return end;
	if (y1 !== y2) return `${d1} ${MONTHS[m1 - 1]} ${y1} – ${end} ${y2}`;
	if (m1 !== m2) return `${d1} ${MONTHS[m1 - 1]} – ${end}`;
	return `${d1} – ${end}`;
}

/** The days a range covers, for filling the date fields back in. */
export function rangeDays(range: TimeRange, timeZone: string): { first: string; last: string } {
	return { first: localDayKey(range.from, timeZone), last: localDayKey(range.to - 1, timeZone) };
}

/**
 * Moves a range's edges off any drive or charge that crosses them.
 *
 * A boundary is a midnight, and cars are driven and charged across midnights.
 * Cutting one in two would show half a trip with half its distance, so each
 * belongs whole to the day it began: one that started before the range is left
 * out, one that started inside it is kept to its end.
 *
 * When one drive or charge covers the whole range, snapping would leave
 * nothing, so the range is left as chosen and the trip is cut by it.
 */
export function snapToSpans(
	from: number,
	to: number,
	spans: Array<{ startTime: number; endTime: number }>
): { from: number; to: number } {
	let snappedFrom = from;
	let snappedTo = to;
	for (const span of spans) {
		if (span.startTime < from && span.endTime >= from) {
			snappedFrom = Math.max(snappedFrom, span.endTime + 1);
		}
		if (span.startTime >= from && span.startTime < to && span.endTime >= to) {
			snappedTo = Math.max(snappedTo, span.endTime + 1);
		}
	}
	return snappedFrom < snappedTo ? { from: snappedFrom, to: snappedTo } : { from, to };
}

/**
 * Links to one trip or one charging session, named by when it started.
 *
 * A position in a list would change meaning whenever the range does; a start
 * time is the same in every range, since ranges never cut a trip.
 */
export function tripLink(startTime: number): string {
	return `/dash/trips?trip=${startTime}`;
}

export function sessionLink(startTime: number): string {
	return `/dash/charging?session=${startTime}`;
}

/** The start time a link carries, or null when it is absent or not one. */
export function startFromParam(raw: string | null): number | null {
	if (raw === null || !/^\d+$/.test(raw)) return null;
	const start = Number(raw);
	return Number.isSafeInteger(start) ? start : null;
}
