/**
 * A list as a spreadsheet.
 *
 * An `.xlsx` is a zip of XML parts, and the six written here are the smallest
 * set Excel will open without complaint. No library: the two that could do this
 * are a megabyte apiece, which is a lot to ship to every visitor for a button
 * most of them never press, and fflate — already a dependency, since it is what
 * reads the export in the first place — does the only hard part.
 *
 * The reason to write one at all rather than leave people with the CSV: a CSV
 * has no types. Dates arrive as text, a decimal comma arrives as text in half
 * the world's locales, and the first thing anyone does with a downloaded list
 * is sort it by date. Here a date is a date and a number is a number.
 *
 * Two rules are worth knowing before editing this. Element order inside a
 * worksheet is fixed by the schema and Excel enforces it — `sheetViews`,
 * `sheetFormatPr`, `cols`, `sheetData`, `autoFilter`, in that order and no
 * other. And a cell claiming to hold a number had better hold one: `NaN` in a
 * `<v>` makes Excel call the whole file corrupt and offer to repair it, so a
 * reading the car never took is written as no cell at all.
 */

import { strToU8, zipSync } from 'fflate';
import type { Column } from './columns';

export interface Sheet<T> {
	/** Shown on the tab. Excel forbids brackets, slashes, stars, question marks
	 * and colons in one, and more than 31 characters of it. */
	name: string;
	columns: Array<Column<T>>;
	rows: T[];
	/** The driver's zone: a spreadsheet date carries no zone of its own. */
	timeZone: string;
}

/** Style indices into `cellXfs` below, in the order they are declared there. */
const STYLE = { general: 0, header: 1, date: 2, time: 3, whole: 4, oneDecimal: 5, twoDecimal: 6 };

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escape(text: string): string {
	return (
		text
			// XML 1.0 carries no control characters at all, and a comment typed into
			// a phone occasionally has one.
			.replace(new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]', 'g'), '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	);
}

/** A1, B1 … Z1, AA1: the column letters a spreadsheet addresses cells by. */
export function cellRef(column: number, row: number): string {
	let letters = '';
	for (let n = column; n >= 0; n = Math.floor(n / 26) - 1) {
		letters = String.fromCharCode(65 + (n % 26)) + letters;
	}
	return `${letters}${row}`;
}

/**
 * An instant as the number a spreadsheet means by a date.
 *
 * Days since 30 December 1899, with the time as a fraction — and read off the
 * wall clock in the driver's zone, because the file carries no zone and a
 * journey that started at 08:15 has to still say 08:15 wherever it is opened.
 * `whole: false` returns only the fraction, for a column that is a time of day
 * rather than a moment.
 */
export function serial(epochSeconds: number, timeZone: string, whole = true): number {
	const parts = new Intl.DateTimeFormat('en-GB', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
		timeZone
	}).formatToParts(new Date(epochSeconds * 1000));

	const at = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
	// Midnight is `24` from some implementations and `0` from others.
	const hour = at('hour') % 24;
	const fraction = (hour * 3600 + at('minute') * 60 + at('second')) / 86400;
	if (!whole) return fraction;

	const days =
		(Date.UTC(at('year'), at('month') - 1, at('day')) - Date.UTC(1899, 11, 30)) / 86400000;
	return days + fraction;
}

function styleFor(kind: Column<unknown>['kind'], digits: number): number {
	if (kind === 'date') return STYLE.date;
	if (kind === 'time') return STYLE.time;
	if (kind !== 'number') return STYLE.general;
	if (digits >= 2) return STYLE.twoDecimal;
	return digits === 1 ? STYLE.oneDecimal : STYLE.whole;
}

function textCell(ref: string, style: number, text: string): string {
	// Leading or trailing space in a place name is meaningful enough to keep,
	// and is thrown away without this attribute.
	const space = text !== text.trim() ? ' xml:space="preserve"' : '';
	return `<c r="${ref}" s="${style}" t="inlineStr"><is><t${space}>${escape(text)}</t></is></c>`;
}

function sheetXml<T>(sheet: Sheet<T>): string {
	const { columns, rows, timeZone } = sheet;
	const last = cellRef(columns.length - 1, rows.length + 1);

	const cols = columns
		.map(
			(column, i) => `<col min="${i + 1}" max="${i + 1}" width="${column.width}" customWidth="1"/>`
		)
		.join('');

	const head = columns
		.map((column, i) => textCell(cellRef(i, 1), STYLE.header, column.header))
		.join('');

	const body = rows
		.map((row, r) => {
			const cells = columns
				.map((column, i) => {
					const value = column.value(row);
					if (value === null || value === undefined || value === '') return '';
					const ref = cellRef(i, r + 2);
					const style = styleFor(column.kind, column.digits ?? 0);

					if (column.kind === 'text') return textCell(ref, style, String(value));

					const raw = Number(value);
					// The rule at the top of the file: no number, no cell.
					if (!Number.isFinite(raw)) return '';
					if (column.kind === 'date')
						return `<c r="${ref}" s="${style}"><v>${serial(raw, timeZone)}</v></c>`;
					if (column.kind === 'time')
						return `<c r="${ref}" s="${style}"><v>${serial(raw, timeZone, false)}</v></c>`;
					return `<c r="${ref}" s="${style}"><v>${raw}</v></c>`;
				})
				.join('');
			return `<row r="${r + 2}">${cells}</row>`;
		})
		.join('');

	return `${HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData><row r="1">${head}</row>${body}</sheetData>
<autoFilter ref="A1:${last}"/>
</worksheet>`;
}

function styles(): string {
	return `${HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/><numFmt numFmtId="165" formatCode="hh:mm"/><numFmt numFmtId="166" formatCode="0.0"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

/** A sheet name Excel will accept, however it was arrived at. */
function tabName(name: string, fallback: string): string {
	const cleaned = name.replace(/[[\]*/\\?:]/g, ' ').trim();
	return (cleaned || fallback).slice(0, 31);
}

/**
 * The workbook.
 *
 * Sheets take relationship ids 1..n and the stylesheet the one after, which is
 * the only ordering constraint worth stating: get it wrong and Excel opens a
 * workbook with no formatting and no explanation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toXlsx(sheets: Array<Sheet<any>>): Uint8Array<ArrayBuffer> {
	if (sheets.length === 0) throw new Error('A workbook needs at least one sheet.');

	const names = sheets.map((sheet, i) => tabName(sheet.name, `Sheet${i + 1}`));
	const styleId = sheets.length + 1;

	const contentTypes = `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets
	.map(
		(_, i) =>
			`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
	)
	.join('\n')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

	const rootRels = `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

	// The name Excel itself writes for an auto-filter, so reopening the file
	// finds the filter where it left it rather than quietly dropping it.
	const filters = sheets
		.map(
			(sheet, i) =>
				`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${names[i].replace(/'/g, "''")}'!$A$1:$${cellRef(sheet.columns.length - 1, 1).replace(/\d+$/, '')}$${sheet.rows.length + 1}</definedName>`
		)
		.join('');

	const workbook = `${HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((name, i) => `<sheet name="${escape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
<definedNames>${filters}</definedNames>
</workbook>`;

	const workbookRels = `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets
	.map(
		(_, i) =>
			`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
	)
	.join('\n')}
<Relationship Id="rId${styleId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

	const files: Record<string, Uint8Array> = {
		'[Content_Types].xml': strToU8(contentTypes),
		'_rels/.rels': strToU8(rootRels),
		'xl/workbook.xml': strToU8(workbook),
		'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
		'xl/styles.xml': strToU8(styles())
	};
	for (const [i, sheet] of sheets.entries()) {
		files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet));
	}

	return zipSync(files, { level: 6 }) as Uint8Array<ArrayBuffer>;
}
