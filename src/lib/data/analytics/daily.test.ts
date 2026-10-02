import { describe, expect, it } from 'vitest';
import type { Dataset } from '../store/columnar';
import { enumerateDays, startOfLocalDay } from './daily';

const TZ = 'Europe/Berlin';

/** Only the timeline matters to the functions under test. */
function spanning(first: number, last: number): Dataset {
	return { time: Uint32Array.from([first, last]) } as Dataset;
}

describe('enumerateDays', () => {
	it('stops on the day of the last sample, even when that is in the evening', () => {
		const first = startOfLocalDay('2026-09-02', TZ) + 9 * 3600;
		const last = startOfLocalDay('2026-09-04', TZ) + 21 * 3600;
		expect(enumerateDays(spanning(first, last), TZ)).toEqual([
			'2026-09-02',
			'2026-09-03',
			'2026-09-04'
		]);
	});

	it('does not skip the day the clocks go back', () => {
		const first = startOfLocalDay('2026-10-24', TZ) + 23 * 3600;
		const last = startOfLocalDay('2026-10-26', TZ) + 60;
		expect(enumerateDays(spanning(first, last), TZ)).toEqual([
			'2026-10-24',
			'2026-10-25',
			'2026-10-26'
		]);
	});

	it('gives one day for a single day of data', () => {
		const first = startOfLocalDay('2026-09-02', TZ) + 60;
		expect(enumerateDays(spanning(first, first + 20 * 3600), TZ)).toEqual(['2026-09-02']);
	});
});
