import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
import { LOGBOOK_COLUMNS, type LogbookRow } from './columns';
import type { Column } from './columns';

interface Row {
	text: string;
	km: number;
	when: number;
}

const COLUMNS: Array<Column<Row>> = [
	{ header: 'Place', kind: 'text', width: 10, value: (row) => row.text },
	{ header: 'Delta (km)', kind: 'number', digits: 1, width: 10, value: (row) => row.km },
	{ header: 'Date', kind: 'date', width: 10, value: (row) => row.when }
];

const WHEN = Date.UTC(2026, 8, 14, 14, 35, 0) / 1000;

function body(rows: Row[]): string[] {
	return toCsv(COLUMNS, rows, 'Europe/Berlin').replace('﻿', '').trim().split('\r\n').slice(1);
}

describe('a formula in free text', () => {
	it.each(['=HYPERLINK("http://evil";"x")', '+1+1', '-Büro', '@SUM(A1)', '\t=1', '\r=1'])(
		'is made text: %j',
		(text) => {
			const [line] = body([{ text, km: 1, when: WHEN }]);
			// Quoted or not, the apostrophe is the first thing in the cell.
			expect(line.replace(/^"/, '').startsWith("'")).toBe(true);
		}
	);

	it('is quoted as usual after the apostrophe', () => {
		const [line] = body([{ text: '=A1;B1', km: 1, when: WHEN }]);
		expect(line.startsWith(`"'=A1;B1"`)).toBe(true);
	});

	it('shows the apostrophe on a phone number or a dash that continues into text', () => {
		const [phone] = body([{ text: '+49 89 1234', km: 1, when: WHEN }]);
		expect(phone.startsWith("'+49 89 1234;")).toBe(true);
		const [dash] = body([{ text: '-Büro', km: 1, when: WHEN }]);
		expect(dash.startsWith("'-Büro;")).toBe(true);
	});

	it.each(['-', '+'])('leaves a cell that is only %j alone, as it cannot be a formula', (text) => {
		const [line] = body([{ text, km: 1, when: WHEN }]);
		expect(line.startsWith(`${text};`)).toBe(true);
	});

	it.each(['--', '-1', '+ ', '=', '@'])('still guards %j', (text) => {
		const [line] = body([{ text, km: 1, when: WHEN }]);
		expect(line.replace(/^"/, '').startsWith("'")).toBe(true);
	});

	it('leaves text that merely contains the characters alone', () => {
		const [line] = body([{ text: 'A-Straße = 5 @ home', km: 1, when: WHEN }]);
		expect(line.startsWith('A-Straße = 5 @ home;')).toBe(true);
	});

	it('is caught in the comment of a logbook row', () => {
		const row = {
			trip: {
				startTime: WHEN,
				endTime: WHEN + 600,
				odoStart: 100,
				odoEnd: 110,
				distanceKm: 10,
				duration: 600
			},
			note: { origin: '-Büro', destination: 'Home', purpose: 'business', comment: '=1+1' }
		} as unknown as LogbookRow;
		const line = toCsv(LOGBOOK_COLUMNS, [row], 'Europe/Berlin')
			.replace('﻿', '')
			.trim()
			.split('\r\n')[1];
		expect(line).toContain(";'-Büro;Home;business;'=1+1");
	});
});

describe('numbers and dates', () => {
	it('keep their minus sign', () => {
		const [line] = body([{ text: 'x', km: -12.34, when: WHEN }]);
		expect(line.split(';')[1]).toBe('-12,3');
	});

	it('are not touched', () => {
		const [line] = body([{ text: 'x', km: 5, when: WHEN }]);
		expect(line).toBe('x;5,0;14/09/2026');
	});
});
