import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { cellRef, serial, toXlsx, type Sheet } from './xlsx';
import type { Column } from './columns';

interface Row {
	when: number;
	place: string;
	km: number;
}

const COLUMNS: Array<Column<Row>> = [
	{ header: 'Date', kind: 'date', width: 11, value: (row) => row.when },
	{ header: 'Start', kind: 'time', width: 7, value: (row) => row.when },
	{ header: 'Distance (km)', kind: 'number', digits: 1, width: 11, value: (row) => row.km },
	{ header: 'Origin', kind: 'text', width: 20, value: (row) => row.place }
];

// 14 September 2026, 16:35:00 in Berlin (CEST, UTC+2).
const WHEN = Date.UTC(2026, 8, 14, 14, 35, 0) / 1000;

function sheet(rows: Row[], name = 'Trips'): Sheet<Row> {
	return { name, columns: COLUMNS, rows, timeZone: 'Europe/Berlin' };
}

function parts(bytes: Uint8Array): Record<string, string> {
	const files = unzipSync(bytes);
	return Object.fromEntries(Object.entries(files).map(([name, data]) => [name, strFromU8(data)]));
}

describe('cellRef', () => {
	it('counts in spreadsheet letters', () => {
		expect(cellRef(0, 1)).toBe('A1');
		expect(cellRef(10, 43)).toBe('K43');
		expect(cellRef(25, 1)).toBe('Z1');
		expect(cellRef(26, 1)).toBe('AA1');
		expect(cellRef(51, 2)).toBe('AZ2');
	});
});

describe('serial', () => {
	it('reads the wall clock in the driver’s zone, not the reader’s', () => {
		// 16:35 on the 14th in Berlin is 02:35 on the 15th in Auckland, and the
		// file has no zone to say so — whoever opens it sees the driver's clock.
		const berlin = serial(WHEN, 'Europe/Berlin');
		const auckland = serial(WHEN, 'Pacific/Auckland');
		expect(Math.floor(auckland)).toBe(Math.floor(berlin) + 1);
		expect(berlin - Math.floor(berlin)).toBeCloseTo((16 * 60 + 35) / 1440, 9);
		expect(auckland - Math.floor(auckland)).toBeCloseTo((2 * 60 + 35) / 1440, 9);
	});

	it('places a known date where the epoch says it should be', () => {
		// 1 January 2000 is serial 36526 in every spreadsheet ever shipped.
		expect(serial(Date.UTC(2000, 0, 1) / 1000, 'UTC')).toBe(36526);
	});

	it('gives the time of day on its own when asked', () => {
		expect(serial(WHEN, 'Europe/Berlin', false)).toBeCloseTo((16 * 60 + 35) / 1440, 9);
	});

	it('puts midnight at zero rather than at a whole day', () => {
		expect(serial(Date.UTC(2026, 8, 14, 22, 0, 0) / 1000, 'Europe/Berlin', false)).toBe(0);
	});
});

describe('toXlsx', () => {
	const book = toXlsx([sheet([{ when: WHEN, place: 'Kraków', km: 101.42 }])]);
	const files = parts(book);

	it('writes every part the format requires and nothing else', () => {
		expect(Object.keys(files).sort()).toEqual([
			'[Content_Types].xml',
			'_rels/.rels',
			'xl/_rels/workbook.xml.rels',
			'xl/styles.xml',
			'xl/workbook.xml',
			'xl/worksheets/sheet1.xml'
		]);
	});

	it('orders the worksheet elements the way the schema insists on', () => {
		const xml = files['xl/worksheets/sheet1.xml'];
		const order = ['sheetViews', 'sheetFormatPr', '<cols>', '<sheetData>', '<autoFilter'];
		const positions = order.map((tag) => xml.indexOf(tag));
		expect(positions.every((at) => at >= 0)).toBe(true);
		expect(positions).toEqual([...positions].sort((a, b) => a - b));
	});

	it('writes a date as a number carrying the date format', () => {
		const xml = files['xl/worksheets/sheet1.xml'];
		expect(xml).toContain(`<c r="A2" s="2"><v>${serial(WHEN, 'Europe/Berlin')}</v></c>`);
		expect(files['xl/styles.xml']).toContain('numFmtId="164" formatCode="yyyy\\-mm\\-dd"');
	});

	it('writes a number as a number, unrounded, with a format to show it by', () => {
		expect(files['xl/worksheets/sheet1.xml']).toContain('<c r="C2" s="5"><v>101.42</v></c>');
	});

	it('writes text inline, escaped, with the accents intact', () => {
		expect(files['xl/worksheets/sheet1.xml']).toContain(
			'<c r="D2" s="0" t="inlineStr"><is><t>Kraków</t></is></c>'
		);
	});

	it('freezes the header row and filters the range the rows actually occupy', () => {
		const xml = files['xl/worksheets/sheet1.xml'];
		expect(xml).toContain('ySplit="1"');
		expect(xml).toContain('state="frozen"');
		expect(xml).toContain('<autoFilter ref="A1:D2"/>');
		expect(files['xl/workbook.xml']).toContain(`'Trips'!$A$1:$D$2`);
	});

	it('leaves out a cell rather than writing a reading the car never took', () => {
		// A number cell holding NaN makes Excel call the whole file corrupt.
		const xml = parts(toXlsx([sheet([{ when: WHEN, place: '', km: Number.NaN }])]))[
			'xl/worksheets/sheet1.xml'
		];
		expect(xml).not.toContain('NaN');
		expect(xml).not.toContain('r="C2"');
		expect(xml).not.toContain('r="D2"');
		expect(xml).toContain('r="A2"');
	});

	it('keeps whitespace somebody typed at the edge of a place name', () => {
		const xml = parts(toXlsx([sheet([{ when: WHEN, place: ' Bad Tölz ', km: 1 }])]))[
			'xl/worksheets/sheet1.xml'
		];
		expect(xml).toContain('<t xml:space="preserve"> Bad Tölz </t>');
	});

	it('survives a comment full of markup and control characters', () => {
		const nasty = `a & b <c> "d"${String.fromCharCode(0)}`;
		const xml = parts(toXlsx([sheet([{ when: WHEN, place: nasty, km: 1 }])]))[
			'xl/worksheets/sheet1.xml'
		];
		expect(xml).toContain('a &amp; b &lt;c&gt; &quot;d&quot;');
		expect(xml).not.toContain(String.fromCharCode(0));
	});

	it('numbers several sheets, and points the stylesheet past the last of them', () => {
		const files = parts(toXlsx([sheet([{ when: WHEN, place: 'a', km: 1 }]), sheet([], 'Summary')]));
		expect(files['xl/worksheets/sheet2.xml']).toBeDefined();
		expect(files['xl/workbook.xml']).toContain('<sheet name="Summary" sheetId="2" r:id="rId2"/>');
		expect(files['xl/_rels/workbook.xml.rels']).toContain('Id="rId3"');
		expect(files['xl/_rels/workbook.xml.rels']).toContain('Target="styles.xml"');
	});

	it('cleans a tab name Excel would refuse', () => {
		const files = parts(toXlsx([sheet([], 'Trips [2026/09]')]));
		expect(files['xl/workbook.xml']).toContain(`name="Trips  2026 09"`);
	});

	it('refuses to write a workbook with no sheets', () => {
		expect(() => toXlsx([])).toThrow();
	});

	it('writes a header row in bold', () => {
		expect(files['xl/worksheets/sheet1.xml']).toContain(
			'<c r="A1" s="1" t="inlineStr"><is><t>Date</t></is></c>'
		);
		expect(files['xl/styles.xml']).toContain('<font><b/>');
	});
});
