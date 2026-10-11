/** Calendar labels in the current language. */

import type { TimeRange } from '../data/range';
import { rangeDays } from '../data/range';
import { intlLocale, m } from './index.svelte';

function utc(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

/** `September 2026` for `2026-09`. */
export function monthLabel(month: string): string {
	if (!/^\d{4}-\d{2}$/.test(month)) return month;
	return new Intl.DateTimeFormat(intlLocale(), {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(utc(`${month}-01`));
}

/** `September 2026` for a month, `2026` for a year. */
export function periodLabel(period: string): string {
	return /^\d{4}$/.test(period) ? period : monthLabel(period);
}

/** `3 – 9 Sep`, `28 Sep – 4 Oct`, `28 Dec 2025 – 3 Jan 2026`, or one day. */
export function dayRangeLabel(first: string, last: string): string {
	const locale = intlLocale();
	const dayMonth = new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});
	if (first === last) return dayMonth.format(utc(last));
	const format = new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		...(first.slice(0, 4) !== last.slice(0, 4) ? { year: 'numeric' } : {}),
		timeZone: 'UTC'
	});
	return format.formatRange(utc(first), utc(last));
}

/** What a time range is called on screen. */
export function rangeLabel(range: TimeRange, timeZone: string): string {
	const { preset } = range;
	if (preset.startsWith('last-')) return m.range.lastDays(Number(preset.slice(5)));
	if (preset.startsWith('month-')) return monthLabel(preset.slice(6));
	if (preset.startsWith('year-')) return preset.slice(5);
	const { first, last } = rangeDays(range, timeZone);
	return dayRangeLabel(first, last);
}
