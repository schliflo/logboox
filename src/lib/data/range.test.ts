import { describe, expect, it } from 'vitest';
import type { DayBucket } from './analytics';
import { localDayKey, startOfLocalDay } from './analytics/daily';
import {
	addDays,
	customRange,
	dayRangeLabel,
	defaultRange,
	rangeDays,
	rangePresets,
	sessionLink,
	snapToSpans,
	startFromParam,
	tripLink
} from './range';

const TZ = 'Europe/Berlin';
const DAY = 86400;

/** What the presets read from an analysis: its extent, and which days were recorded. */
function extent(first: string, last: string, holes: string[] = []) {
	const days: DayBucket[] = [];
	for (let day = first; day <= last; day = addDays(day, 1)) {
		days.push({ date: day, covered: !holes.includes(day) } as DayBucket);
	}
	return {
		// Mid-afternoon on the first day to mid-morning on the last, as an
		// export cut at an arbitrary hour would be.
		startTime: startOfLocalDay(first, TZ) + 15 * 3600,
		endTime: startOfLocalDay(last, TZ) + 10 * 3600,
		days
	};
}

function daysOf(from: string, to: string): string[] {
	const out: string[] = [];
	for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
	return out;
}

const isMidnight = (t: number) => localDayKey(t - 1, TZ) !== localDayKey(t, TZ);

describe('rangePresets', () => {
	it('anchors the last days to the last recorded day, not to today', () => {
		const presets = rangePresets(extent('2026-08-01', '2026-08-31'), TZ);
		const week = presets.find((p) => p.preset === 'last-7')!;
		expect(week.label).toBe('Last 7 days');
		expect(week.from).toBe(startOfLocalDay('2026-08-25', TZ));
		expect(week.to).toBe(startOfLocalDay('2026-09-01', TZ));
	});

	it('offers only spans shorter than what is loaded', () => {
		expect(rangePresets(extent('2026-08-01', '2026-08-31'), TZ).map((p) => p.preset)).toEqual([
			'last-7',
			'last-30'
		]);
		expect(rangePresets(extent('2026-08-25', '2026-08-31'), TZ)).toEqual([]);
	});

	it('lists calendar months once there is more than one', () => {
		const presets = rangePresets(extent('2026-07-15', '2026-09-20'), TZ);
		const months = presets.filter((p) => p.preset.startsWith('month-'));
		expect(months.map((p) => p.label)).toEqual(['July 2026', 'August 2026', 'September 2026']);
		const september = months[2];
		expect(september.from).toBe(startOfLocalDay('2026-09-01', TZ));
		expect(september.to).toBe(startOfLocalDay('2026-10-01', TZ));
		expect(presets.some((p) => p.preset.startsWith('year-'))).toBe(false);
	});

	it('leaves out a month that falls entirely in a hole between exports', () => {
		const presets = rangePresets(
			extent('2026-06-20', '2026-08-10', daysOf('2026-07-01', '2026-07-31')),
			TZ
		);
		expect(presets.filter((p) => p.preset.startsWith('month-')).map((p) => p.label)).toEqual([
			'June 2026',
			'August 2026'
		]);
	});

	it('lists calendar years once there is more than one', () => {
		const presets = rangePresets(extent('2025-12-10', '2026-01-20'), TZ);
		const years = presets.filter((p) => p.preset.startsWith('year-'));
		expect(years.map((p) => p.label)).toEqual(['2025', '2026']);
		expect(years[0].from).toBe(startOfLocalDay('2025-01-01', TZ));
		expect(years[0].to).toBe(startOfLocalDay('2026-01-01', TZ));
	});

	it('puts every boundary on a local midnight', () => {
		const presets = rangePresets(extent('2025-11-20', '2026-04-10'), TZ);
		expect(presets.length).toBeGreaterThan(5);
		for (const preset of presets) {
			expect(isMidnight(preset.from)).toBe(true);
			expect(isMidnight(preset.to)).toBe(true);
		}
	});

	it('keeps the extra hour of the day the clocks go back', () => {
		// 25 October 2026 is the last Sunday of October: 25 hours in Berlin.
		const presets = rangePresets(extent('2026-10-01', '2026-10-31'), TZ);
		const week = presets.find((p) => p.preset === 'last-7')!;
		expect(week.to - week.from).toBe(7 * DAY + 3600);
	});
});

describe('customRange', () => {
	const loaded = extent('2026-08-01', '2026-08-31');

	it('includes both days', () => {
		const range = customRange(loaded, '2026-08-03', '2026-08-09', TZ)!;
		expect(range.from).toBe(startOfLocalDay('2026-08-03', TZ));
		expect(range.to).toBe(startOfLocalDay('2026-08-10', TZ));
		expect(range.label).toBe('3 – 9 Aug');
		expect(range.preset).toBe('custom');
		expect(rangeDays(range, TZ)).toEqual({ first: '2026-08-03', last: '2026-08-09' });
	});

	it('is held to the recorded days, in either order', () => {
		const range = customRange(loaded, '2026-09-15', '2026-07-01', TZ)!;
		expect(range.from).toBe(startOfLocalDay('2026-08-01', TZ));
		expect(range.to).toBe(startOfLocalDay('2026-09-01', TZ));
	});

	it('refuses dates that are not dates, or miss the data entirely', () => {
		expect(customRange(loaded, '', '2026-08-09', TZ)).toBeNull();
		expect(customRange(loaded, '2026-09-02', '2026-09-09', TZ)).toBeNull();
	});

	it('spans a single day the clocks go back', () => {
		const range = customRange(extent('2026-10-01', '2026-10-31'), '2026-10-25', '2026-10-25', TZ)!;
		expect(range.to - range.from).toBe(25 * 3600);
		expect(range.label).toBe('25 Oct');
	});
});

describe('dayRangeLabel', () => {
	it('says only what differs', () => {
		expect(dayRangeLabel('2026-09-03', '2026-09-09')).toBe('3 – 9 Sep');
		expect(dayRangeLabel('2026-09-28', '2026-10-04')).toBe('28 Sep – 4 Oct');
		expect(dayRangeLabel('2025-12-28', '2026-01-03')).toBe('28 Dec 2025 – 3 Jan 2026');
	});
});

describe('snapToSpans', () => {
	const span = (startTime: number, endTime: number) => ({ startTime, endTime });

	it('leaves a range alone when nothing crosses its edges', () => {
		expect(snapToSpans(1000, 2000, [span(1100, 1200), span(2100, 2200)])).toEqual({
			from: 1000,
			to: 2000
		});
	});

	it('leaves out a drive that began before the range', () => {
		expect(snapToSpans(1000, 2000, [span(900, 1050)])).toEqual({ from: 1051, to: 2000 });
	});

	it('keeps a drive that began inside the range to its end', () => {
		expect(snapToSpans(1000, 2000, [span(1950, 2300)])).toEqual({ from: 1000, to: 2301 });
	});

	it('treats a drive starting exactly on the upper edge as the next day', () => {
		expect(snapToSpans(1000, 2000, [span(2000, 2300)])).toEqual({ from: 1000, to: 2000 });
	});

	it('falls back to the range as chosen when one drive covers all of it', () => {
		// Snapping both edges would leave from past to: "nothing recorded" on a day with samples.
		expect(snapToSpans(1000, 2000, [span(900, 2300)])).toEqual({ from: 1000, to: 2000 });
	});

	it('falls back when a charge runs on past a range it began in', () => {
		expect(snapToSpans(1000, 2000, [span(900, 1500), span(1500, 2500)])).toEqual({
			from: 1501,
			to: 2501
		});
		expect(snapToSpans(1000, 2000, [span(900, 1999)])).toEqual({ from: 1000, to: 2000 });
	});
});

describe('defaultRange', () => {
	/** Days recorded, ending on the last of August. */
	const ending = (days: number) => extent(addDays('2026-08-31', 1 - days), '2026-08-31');
	const covers = (range: { from: number; to: number }, e: ReturnType<typeof extent>) =>
		range.from <= e.startTime && range.to > e.endTime;

	it('is the last thirty days of a long export', () => {
		const fourteenMonths = ending(425);
		const range = defaultRange(fourteenMonths, TZ)!;
		expect(range.preset).toBe('last-30');
		expect(range.label).toBe('Last 30 days');
		expect(range.from).toBe(startOfLocalDay('2026-08-02', TZ));
		expect(range.to).toBe(startOfLocalDay('2026-09-01', TZ));
	});

	it('covers everything for an export of thirty or twenty-nine days', () => {
		for (const days of [30, 29]) {
			const e = ending(days);
			const range = defaultRange(e, TZ)!;
			expect(range.preset).toBe('last-30');
			expect(covers(range, e)).toBe(true);
		}
	});

	it('falls to the last seven days below that', () => {
		const range = defaultRange(ending(28), TZ)!;
		expect(range.preset).toBe('last-7');
		expect(range.from).toBe(startOfLocalDay('2026-08-25', TZ));
	});

	it('covers everything for exactly a week', () => {
		const e = ending(7);
		const range = defaultRange(e, TZ)!;
		expect(range.preset).toBe('last-7');
		expect(covers(range, e)).toBe(true);
	});

	it('is nothing at all for less than a week', () => {
		expect(defaultRange(ending(5), TZ)).toBeNull();
	});
});

describe('links to a trip or a session', () => {
	it('name it by its start time', () => {
		expect(tripLink(1_790_000_000)).toBe('/dash/trips?trip=1790000000');
		expect(sessionLink(1_790_000_000)).toBe('/dash/charging?session=1790000000');
	});

	it('read back a start time, and nothing else', () => {
		expect(startFromParam('1790000000')).toBe(1_790_000_000);
		expect(startFromParam(null)).toBeNull();
		for (const raw of ['', '-5', '1.5', '1e9', 'abc', '12 ', '99999999999999999999']) {
			expect(startFromParam(raw)).toBeNull();
		}
	});
});
