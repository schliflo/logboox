/**
 * A list as a document.
 *
 * The one format here meant to be printed, filed or handed to somebody, which
 * is why it carries a heading, a period, the totals, and a line at the end
 * saying where the numbers came from and what they are not.
 *
 * pdf-lib and its font parser are both imported only when this function runs.
 * Together they are a few hundred kilobytes for a button most people never
 * press, and the service worker leaves the chunk out of what it fetches on
 * arrival — so a PDF export is the one thing in the app that needs a
 * connection the first time.
 *
 * Inter is embedded rather than using one of the fourteen fonts every PDF
 * reader already has, because those cover Windows-1252 and pdf-lib *throws* on
 * anything outside it. A Fahrtenbuch with Łódź in it would fail to export, and
 * silently dropping the character would be worse than the wait.
 */

import { INTER_REGULAR_URL, INTER_SEMIBOLD_URL } from '../og/fonts';
import type { Column } from './columns';

/** A4 landscape in points: a Fahrtenbuch has eleven columns to fit. */
const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = 40;

const INK = { text: 0.08, quiet: 0.42, rule: 0.78 };

export interface Totals {
	label: string;
	value: string;
}

export interface Document<T> {
	title: string;
	/** The car and the period, on one line under the title. */
	subtitle: string;
	columns: Array<Column<T>>;
	rows: T[];
	timeZone: string;
	/** Figures printed under the table. */
	totals?: Totals[];
	/** Anything the reader should know before trusting it. */
	notes?: string[];
}

async function fontBytes(url: string): Promise<ArrayBuffer> {
	const response = await fetch(url);
	if (!response.ok) throw new Error('The typeface for the PDF could not be fetched.');
	return response.arrayBuffer();
}

function formatters(timeZone: string) {
	const date = new Intl.DateTimeFormat('en-GB', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		timeZone
	});
	const time = new Intl.DateTimeFormat('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone
	});
	return { date, time };
}

/**
 * Cut a string to a width the embedded font can actually measure.
 *
 * Unlike the link-preview cards, there is a font here to ask, so this is exact
 * rather than a guess from the character count.
 */
function fit(
	text: string,
	width: number,
	size: number,
	measure: (text: string, size: number) => number
): string {
	if (measure(text, size) <= width) return text;
	let cut = text;
	while (cut.length > 1 && measure(`${cut}…`, size) > width) cut = cut.slice(0, -1);
	return `${cut}…`;
}

export async function toPdf<T>(document: Document<T>): Promise<Uint8Array<ArrayBuffer>> {
	const [{ PDFDocument, rgb }, { default: fontkit }] = await Promise.all([
		import('pdf-lib'),
		import('@pdf-lib/fontkit')
	]);
	const [regularBytes, boldBytes] = await Promise.all([
		fontBytes(INTER_REGULAR_URL),
		fontBytes(INTER_SEMIBOLD_URL)
	]);

	const pdf = await PDFDocument.create();
	pdf.registerFontkit(fontkit);
	const regular = await pdf.embedFont(regularBytes, { subset: true });
	const bold = await pdf.embedFont(boldBytes, { subset: true });

	pdf.setTitle(document.title);
	pdf.setCreator('LogbooX');
	pdf.setProducer('LogbooX');

	const { columns, rows, timeZone } = document;
	const { date, time } = formatters(timeZone);
	const grey = (value: number) => rgb(value, value, value);

	const SIZE = { title: 20, subtitle: 10, header: 8, body: 8, foot: 7.5 };
	const ROW = 15;
	/** Breathing room either side of a cell's text. */
	const PAD = 6;

	const cell = (column: Column<T>, row: T): string => {
		const value = column.value(row);
		if (value === null || value === undefined) return '';
		switch (column.kind) {
			case 'date':
				return date.format(new Date(Number(value) * 1000));
			case 'time':
				return time.format(new Date(Number(value) * 1000));
			case 'number':
				return Number.isFinite(Number(value)) ? Number(value).toFixed(column.digits ?? 0) : '';
			default:
				return String(value);
		}
	};

	/**
	 * Column widths, from what is actually in the column.
	 *
	 * There is a real font here, so nothing has to be guessed: every heading and
	 * every cell can be measured. Each column asks for the width of its widest
	 * entry, and gets at least the width of its own heading — a column of
	 * five-digit odometer readings needs little room for the readings and a great
	 * deal for the words "Odometer start (km)", and a table with cut headings is
	 * a table nobody can read.
	 *
	 * When the page cannot grant every request, the headings are paid for first
	 * and what is left is shared in proportion to what each column asked for, so
	 * a free-text comment gives up room before a date does. The declared widths
	 * only decide who gets the *surplus* when the page is roomier than the table.
	 */
	const usable = PAGE.width - MARGIN * 2;
	const declared = columns.reduce((sum, column) => sum + column.width, 0);

	// One pathological comment must not take a quarter of the page with it, and
	// a very long list is sampled rather than measured to the end.
	const CEILING = usable * 0.25;
	const sample = rows.slice(0, 500);

	const base = columns.map(
		(column) => bold.widthOfTextAtSize(column.header, SIZE.header) + PAD * 2
	);
	const wanted = columns.map((column, i) => {
		let widest = 0;
		for (const row of sample) {
			const text = cell(column, row);
			if (text) widest = Math.max(widest, regular.widthOfTextAtSize(text, SIZE.body));
		}
		return Math.max(base[i], Math.min(widest + PAD * 2, CEILING));
	});

	const floor = base.reduce((sum, width) => sum + width, 0);
	const appetite = wanted.reduce((sum, width) => sum + width, 0);
	const widths = new Array<number>(columns.length).fill(0);

	if (floor >= usable) {
		// More headings than page: everything shrinks together, which at least
		// keeps the columns aligned under whatever is left of them.
		for (const [i, width] of base.entries()) widths[i] = (width / floor) * usable;
	} else if (appetite <= usable) {
		// Everything fits. The declared widths decide only who gets the room left
		// over, which is where a comment column earns its generous declaration.
		const surplus = usable - appetite;
		for (const [i, width] of wanted.entries()) {
			widths[i] = width + (columns[i].width / declared) * surplus;
		}
	} else {
		// More table than page. The narrow columns are left whole and the loss is
		// taken by the widest, because a date cut by three characters is unusable
		// and a free-text comment cut by three is merely shorter. Columns are
		// served smallest-first, each capped at an equal share of what is left.
		let remaining = usable;
		let unserved = columns.length;
		const order = columns.map((_, i) => i).sort((a, b) => wanted[a] - wanted[b]);

		for (const i of order) {
			const share = remaining / unserved;
			widths[i] = wanted[i] <= share ? wanted[i] : Math.max(base[i], share);
			remaining -= widths[i];
			unserved--;
		}
	}

	const offsets = widths.map((_, i) => MARGIN + widths.slice(0, i).reduce((a, b) => a + b, 0));

	const pages: Array<ReturnType<typeof pdf.addPage>> = [];
	let page = pdf.addPage([PAGE.width, PAGE.height]);
	pages.push(page);
	let y = PAGE.height - MARGIN;

	// --- the heading, on the first page only --------------------------------
	page.drawText(document.title, {
		x: MARGIN,
		y: y - SIZE.title,
		size: SIZE.title,
		font: bold,
		color: grey(INK.text)
	});
	y -= SIZE.title + 10;
	page.drawText(document.subtitle, {
		x: MARGIN,
		y: y - SIZE.subtitle,
		size: SIZE.subtitle,
		font: regular,
		color: grey(INK.quiet)
	});
	y -= SIZE.subtitle + 18;

	const header = () => {
		for (const [i, column] of columns.entries()) {
			const width = widths[i] - PAD * 2;
			const text = fit(column.header, width, SIZE.header, (t, s) => bold.widthOfTextAtSize(t, s));
			const right = column.kind === 'number';
			page.drawText(text, {
				x: right
					? offsets[i] + widths[i] - PAD - bold.widthOfTextAtSize(text, SIZE.header)
					: offsets[i] + PAD,
				y: y - SIZE.header,
				size: SIZE.header,
				font: bold,
				color: grey(INK.text)
			});
		}
		y -= SIZE.header + 6;
		page.drawRectangle({
			x: MARGIN,
			y,
			width: usable,
			height: 0.7,
			color: grey(INK.rule)
		});
		y -= 8;
	};

	header();

	for (const row of rows) {
		if (y - ROW < MARGIN + 40) {
			page = pdf.addPage([PAGE.width, PAGE.height]);
			pages.push(page);
			y = PAGE.height - MARGIN;
			// Every page repeats the headings; a table whose second page is a
			// wall of unlabelled numbers is not a document anybody can read.
			header();
		}

		for (const [i, column] of columns.entries()) {
			const text = cell(column, row);
			if (!text) continue;
			const width = widths[i] - PAD * 2;
			const shown = fit(text, width, SIZE.body, (t, s) => regular.widthOfTextAtSize(t, s));
			// Numbers right-aligned, so a column of them lines up on the decimal.
			const right = column.kind === 'number';
			page.drawText(shown, {
				x: right
					? offsets[i] + widths[i] - PAD - regular.widthOfTextAtSize(shown, SIZE.body)
					: offsets[i] + PAD,
				y: y - SIZE.body,
				size: SIZE.body,
				font: regular,
				color: grey(INK.text)
			});
		}
		y -= ROW;
	}

	// --- totals and the caveat ----------------------------------------------
	const tail = [
		...(document.totals ?? []).map((total) => `${total.label}: ${total.value}`),
		...(document.notes ?? [])
	];

	if (tail.length) {
		if (y - tail.length * 13 < MARGIN + 30) {
			page = pdf.addPage([PAGE.width, PAGE.height]);
			pages.push(page);
			y = PAGE.height - MARGIN;
		}
		y -= 8;
		page.drawRectangle({ x: MARGIN, y, width: usable, height: 0.7, color: grey(INK.rule) });
		y -= 16;

		for (const [i, line] of tail.entries()) {
			const isTotal = i < (document.totals?.length ?? 0);
			page.drawText(
				fit(line, usable, SIZE.body, (t, s) => regular.widthOfTextAtSize(t, s)),
				{
					x: MARGIN,
					y,
					size: SIZE.body,
					font: isTotal ? bold : regular,
					color: grey(isTotal ? INK.text : INK.quiet)
				}
			);
			y -= 13;
		}
	}

	// --- the footer, once the page count is known ---------------------------
	const origin = 'Worked out by LogbooX from an XPeng EU Data Act export. Not a certified logbook.';
	for (const [i, sheet] of pages.entries()) {
		sheet.drawText(origin, {
			x: MARGIN,
			y: MARGIN - 14,
			size: SIZE.foot,
			font: regular,
			color: grey(INK.quiet)
		});
		const label = `Page ${i + 1} of ${pages.length}`;
		sheet.drawText(label, {
			x: PAGE.width - MARGIN - regular.widthOfTextAtSize(label, SIZE.foot),
			y: MARGIN - 14,
			size: SIZE.foot,
			font: regular,
			color: grey(INK.quiet)
		});
	}

	// Onto a buffer of its own, so the bytes can go straight into a Blob.
	return new Uint8Array(await pdf.save());
}
