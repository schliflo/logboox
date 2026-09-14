/**
 * The months a leaderboard is kept in, and when they close.
 *
 * A board covers a calendar month in the driver's own time zone, because a
 * drive at half past eleven on the 31st belongs to the month the driver was
 * living in, not to UTC's idea of it.
 *
 * Months do not close when they end. XPeng hands out its export on request and
 * after the fact, so the trips of the 30th are usually imported somewhere in
 * the following fortnight; closing on the 1st would quietly exclude everyone
 * who asks for their data monthly rather than daily. A month therefore stays
 * open for `GRACE_DAYS` afterwards and is then locked for good: no new claims,
 * and the table stops moving under the people reading it.
 */

/** How long after a month ends it still accepts claims. */
export const GRACE_DAYS = 14;

const MONTH = /^(\d{4})-(\d{2})$/;
const YEAR = /^(\d{4})$/;

/** Sane bounds for a period, so a URL cannot ask for the year 900 000. */
const FIRST_YEAR = 2015;
const LAST_YEAR = 2100;

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * A formatter for a zone, kept because building one is expensive and the same
 * two or three zones are asked for over and over.
 */
function formatter(timeZone: string): Intl.DateTimeFormat {
	let found = formatters.get(timeZone);
	if (!found) {
		found = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit'
		});
		formatters.set(timeZone, found);
	}
	return found;
}

/**
 * Whether a zone name is one this runtime knows.
 *
 * The zone arrives from a browser and is stored, so it is checked rather than
 * trusted. Workers carry the full zone database, but `resolvedOptions()` there
 * reports UTC, which is why every call in this module passes a zone explicitly
 * instead of relying on the ambient one.
 */
export function isValidTimeZone(zone: unknown): zone is string {
	if (typeof zone !== 'string' || zone.length === 0 || zone.length > 64) return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: zone });
		return true;
	} catch {
		return false;
	}
}

/** The month an instant falls in, as `YYYY-MM`, in the given zone. */
export function monthOf(epochSeconds: number, timeZone: string): string {
	// en-CA gives `YYYY-MM`, which is the shape we want and sorts correctly.
	return formatter(timeZone)
		.format(new Date(epochSeconds * 1000))
		.slice(0, 7);
}

/** The month that is running now, in the given zone. */
export function currentMonth(now: number, timeZone: string): string {
	return monthOf(now, timeZone);
}

function parts(month: string): { year: number; month: number } | null {
	const match = MONTH.exec(month);
	if (!match) return null;
	const year = Number(match[1]);
	const index = Number(match[2]);
	if (index < 1 || index > 12 || year < FIRST_YEAR || year > LAST_YEAR) return null;
	return { year, month: index };
}

/** `YYYY-MM` for a year and a one-based month. */
export function monthKey(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * The instant a month stops accepting claims.
 *
 * Measured from the end of the month in UTC rather than per driver: a board is
 * one table shared by everyone reading it, so it has to close once rather than
 * once per zone. The fortnight of grace dwarfs the day the zones span.
 */
export function locksAt(month: string): number {
	const value = parts(month);
	if (!value) return 0;
	const nextMonth = Date.UTC(value.year, value.month, 1) / 1000;
	return nextMonth + GRACE_DAYS * 86400;
}

/**
 * A range of instants certain to contain the month, in every zone.
 *
 * Widened by a day at each end, because a month's boundary moves by up to
 * fourteen hours between zones and a query bounded by UTC would drop the first
 * evening in Auckland or the last in Honolulu. Whoever asks narrows the result
 * with `monthOf` in the driver's own zone; this is only here to keep a query
 * from reading every trip an account has ever recorded.
 */
export function monthWindow(month: string): { from: number; to: number } {
	const value = parts(month);
	if (!value) return { from: 0, to: 0 };
	const day = 86400;
	return {
		from: Date.UTC(value.year, value.month - 1, 1) / 1000 - day,
		to: Date.UTC(value.year, value.month, 1) / 1000 + day
	};
}

/** Whether a month still accepts claims. A month yet to happen counts as open. */
export function isMonthOpen(month: string, now: number): boolean {
	const at = locksAt(month);
	return at > 0 && now < at;
}

/** Whether every month of a year has closed, which is what makes a year final. */
export function isYearFinal(year: number, now: number): boolean {
	return now >= locksAt(monthKey(year, 12));
}

/** Every month of a year, oldest first. */
export function monthsOfYear(year: number): string[] {
	return Array.from({ length: 12 }, (_, index) => monthKey(year, index + 1));
}

export function previousMonth(month: string): string {
	const value = parts(month);
	if (!value) return month;
	return value.month === 1 ? monthKey(value.year - 1, 12) : monthKey(value.year, value.month - 1);
}

export function nextMonth(month: string): string {
	const value = parts(month);
	if (!value) return month;
	return value.month === 12 ? monthKey(value.year + 1, 1) : monthKey(value.year, value.month + 1);
}

export function yearOf(month: string): number {
	return parts(month)?.year ?? 0;
}

export type Period = { kind: 'month'; month: string } | { kind: 'year'; year: number };

/** Reads `YYYY-MM` or `YYYY` from a URL, or nothing if it is neither. */
export function parsePeriod(text: string): Period | null {
	if (MONTH.test(text)) {
		return parts(text) ? { kind: 'month', month: text } : null;
	}
	if (YEAR.test(text)) {
		const year = Number(text);
		return year >= FIRST_YEAR && year <= LAST_YEAR ? { kind: 'year', year } : null;
	}
	return null;
}

const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

/** `September 2026`, for a heading. */
export function monthLabel(month: string): string {
	const value = parts(month);
	return value ? `${MONTH_NAMES[value.month - 1]} ${value.year}` : month;
}
