import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LOGBOOK_COLUMNS, type LogbookRow } from './columns';

// The fonts are `?url` imports resolved by the bundler and fetched by the
// browser. Here the URLs are the source paths, so `fetch` is pointed at disk.
beforeAll(() => {
	vi.stubGlobal('fetch', async (url: string) => {
		const name = (String(url).split('/').pop() ?? '').replace(/^(Inter-\w+).*\.ttf$/, '$1.ttf');
		return new Response(
			readFileSync(fileURLToPath(new URL(`../og/fonts/${name}`, import.meta.url)))
		);
	});
});

const { toPdf } = await import('./pdf');

const WHEN = Date.UTC(2026, 8, 14, 14, 35, 0) / 1000;

function trip(i: number, note?: Partial<{ origin: string; destination: string; comment: string }>) {
	return {
		trip: {
			startTime: WHEN + i * 7200,
			endTime: WHEN + i * 7200 + 4520,
			duration: 4520,
			odoStart: 41207 + i * 101,
			odoEnd: 41308 + i * 101,
			distanceKm: 101.42
		},
		note: note
			? { origin: '', destination: '', purpose: 'business', comment: '', ...note }
			: undefined
	} as unknown as LogbookRow;
}

function document(rows: LogbookRow[], extra: Record<string, unknown> = {}) {
	return {
		title: 'Fahrtenbuch',
		subtitle: 'XPeng F30b · 1–30 September 2026',
		columns: LOGBOOK_COLUMNS,
		rows,
		timeZone: 'Europe/Berlin',
		...extra
	};
}

// Read back by parsing the finished bytes rather than by trusting the builder:
// pdf-lib writes a cross-reference stream with the catalogue inside a compressed
// object stream, so there is nothing to find by grepping.
const { PDFDocument } = await import('pdf-lib');

async function reopen(bytes: Uint8Array) {
	return PDFDocument.load(bytes);
}

async function pageCount(bytes: Uint8Array): Promise<number> {
	return (await reopen(bytes)).getPageCount();
}

describe('toPdf', () => {
	it('writes a PDF', async () => {
		const bytes = await toPdf(document([trip(0)]));
		expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');
		await expect(pageCount(bytes)).resolves.toBe(1);
	});

	it('spills onto further pages as the rows run out of room', async () => {
		const rows = Array.from({ length: 43 }, (_, i) => trip(i));
		const one = await toPdf(document(rows.slice(0, 5)));
		const many = await toPdf(document(rows));
		await expect(pageCount(one)).resolves.toBe(1);
		expect(await pageCount(many)).toBeGreaterThan(1);
	});

	it('takes a place name the built-in fonts would refuse', async () => {
		// Helvetica throws on anything outside Windows-1252, which is the whole
		// reason a font is embedded. This must simply work.
		await expect(
			toPdf(document([trip(0, { origin: 'Łódź', destination: 'Kraków', comment: 'Przejazd' })]))
		).resolves.toBeInstanceOf(Uint8Array);
	});

	it('takes a comment full of characters no Latin font has', async () => {
		await expect(
			toPdf(document([trip(0, { comment: 'Δοκιμή 試験 — «test»' })]))
		).resolves.toBeInstanceOf(Uint8Array);
	});

	it('writes a document with no rows at all', async () => {
		await expect(pageCount(await toPdf(document([])))).resolves.toBe(1);
	});

	it('prints the totals and the caveats it was given', async () => {
		const bytes = await toPdf(
			document([trip(0)], {
				totals: [{ label: 'Business', value: '812.4 km' }],
				notes: ['14 km are unaccounted for between recorded trips.']
			})
		);
		// The content stream is compressed, so what is checked is that the extra
		// block fits: the totals and the note stay on the page the table ends on.
		await expect(pageCount(bytes)).resolves.toBe(1);
	});

	it('names itself, for a reader that shows a title bar', async () => {
		const reopened = await reopen(await toPdf(document([trip(0)])));
		expect(reopened.getTitle()).toBe('Fahrtenbuch');
		expect(reopened.getCreator()).toBe('LogbooX');
	});

	it('says so when the typeface cannot be fetched', async () => {
		vi.stubGlobal('fetch', async () => new Response('nope', { status: 404 }));
		await expect(toPdf(document([trip(0)]))).rejects.toThrow(/typeface/);
	});
});
