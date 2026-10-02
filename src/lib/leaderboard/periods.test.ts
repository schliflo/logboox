/**
 * Which month a drive belongs to, and when that month stops accepting claims.
 *
 * The zone is the whole point of the first half: a drive home late on the last
 * of the month belongs to the month the driver was in.
 */

import { describe, expect, it } from 'vitest';
import {
	GRACE_DAYS,
	currentMonth,
	isMonthOpen,
	isValidTimeZone,
	isYearFinal,
	locksAt,
	monthKey,
	monthLabel,
	monthOf,
	monthsOfYear,
	nextMonth,
	parsePeriod,
	previousMonth
} from './periods';

const BERLIN = 'Europe/Berlin';

describe('the month an instant falls in', () => {
	it('reads it in the driver’s zone, not in UTC', () => {
		// 23:30 on 30 September in Berlin is already 21:30 UTC the same day —
		// but half an hour later it is October in Berlin and still September in
		// London, which is the case that matters.
		const lateSeptember = Math.floor(Date.UTC(2026, 8, 30, 22, 30) / 1000);
		expect(monthOf(lateSeptember, BERLIN)).toBe('2026-10');
		expect(monthOf(lateSeptember, 'Europe/London')).toBe('2026-09');
	});

	it('handles a zone behind UTC at the turn of a year', () => {
		const newYear = Math.floor(Date.UTC(2027, 0, 1, 2, 0) / 1000);
		expect(monthOf(newYear, BERLIN)).toBe('2027-01');
		expect(monthOf(newYear, 'America/New_York')).toBe('2026-12');
	});

	it('is unmoved by a daylight saving change', () => {
		// Germany goes back an hour on the last Sunday of October.
		const beforeChange = Math.floor(Date.UTC(2026, 9, 25, 0, 30) / 1000);
		const afterChange = Math.floor(Date.UTC(2026, 9, 25, 1, 30) / 1000);
		expect(monthOf(beforeChange, BERLIN)).toBe('2026-10');
		expect(monthOf(afterChange, BERLIN)).toBe('2026-10');
	});

	it('names the month that is running now', () => {
		expect(currentMonth(Math.floor(Date.UTC(2026, 8, 14, 12) / 1000), BERLIN)).toBe('2026-09');
	});
});

describe('checking a zone before storing it', () => {
	it('accepts the ones a browser reports', () => {
		expect(isValidTimeZone(BERLIN)).toBe(true);
		expect(isValidTimeZone('UTC')).toBe(true);
	});

	it('refuses nonsense, and anything too long to be a zone', () => {
		expect(isValidTimeZone('Mars/Olympus')).toBe(false);
		expect(isValidTimeZone('')).toBe(false);
		expect(isValidTimeZone(42)).toBe(false);
		expect(isValidTimeZone('x'.repeat(200))).toBe(false);
	});
});

describe('when a month closes', () => {
	const OCTOBER_FIRST = Date.UTC(2026, 9, 1) / 1000;

	it('stays open for the fortnight after it ends', () => {
		expect(locksAt('2026-09')).toBe(OCTOBER_FIRST + GRACE_DAYS * 86400);
	});

	it('is open on the last day of grace and shut on the first day after', () => {
		const lock = locksAt('2026-09');
		expect(isMonthOpen('2026-09', lock - 1)).toBe(true);
		expect(isMonthOpen('2026-09', lock)).toBe(false);
		expect(isMonthOpen('2026-09', lock + 86400)).toBe(false);
	});

	it('counts a month that has not happened yet as open', () => {
		expect(isMonthOpen('2027-06', OCTOBER_FIRST)).toBe(true);
	});

	it('refuses a month that is not one', () => {
		expect(locksAt('2026-13')).toBe(0);
		expect(isMonthOpen('nonsense', OCTOBER_FIRST)).toBe(false);
	});

	it('calls a year final once its December has closed', () => {
		const decemberLock = locksAt('2026-12');
		expect(isYearFinal(2026, decemberLock - 1)).toBe(false);
		expect(isYearFinal(2026, decemberLock)).toBe(true);
	});
});

describe('moving between periods', () => {
	it('steps over the turn of a year in both directions', () => {
		expect(previousMonth('2026-01')).toBe('2025-12');
		expect(nextMonth('2026-12')).toBe('2027-01');
		expect(previousMonth('2026-09')).toBe('2026-08');
		expect(nextMonth('2026-09')).toBe('2026-10');
	});

	it('lists a year as twelve months', () => {
		const months = monthsOfYear(2026);
		expect(months).toHaveLength(12);
		expect(months[0]).toBe('2026-01');
		expect(months[11]).toBe('2026-12');
	});

	it('pads a single-digit month', () => {
		expect(monthKey(2026, 3)).toBe('2026-03');
	});
});

describe('reading a period from a URL', () => {
	it('takes a month or a year', () => {
		expect(parsePeriod('2026-09')).toEqual({ kind: 'month', month: '2026-09' });
		expect(parsePeriod('2026')).toEqual({ kind: 'year', year: 2026 });
	});

	it('refuses everything else', () => {
		for (const text of ['2026-13', '2026-00', '1999', '20260', 'september', '', '2026-9']) {
			expect(parsePeriod(text)).toBeNull();
		}
	});
});

describe('naming a month', () => {
	it('writes it out', () => {
		expect(monthLabel('2026-09')).toBe('September 2026');
	});

	it('leaves something it cannot read alone', () => {
		expect(monthLabel('nonsense')).toBe('nonsense');
	});
});
