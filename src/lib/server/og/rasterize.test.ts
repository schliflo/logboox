import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// `read()` is the adapter's job — over `ASSETS.fetch` in the Worker, over the
// filesystem in `vite dev`. Neither exists here, so the test plays the adapter
// and serves the very files the `?url` imports point at. Synchronously: `read`
// hands back a Response, not a promise of one.
vi.mock('$app/server', () => ({
	read: (url: string) => {
		const name = (url.split('/').pop() ?? '').replace(/^(Inter-\w+).*\.ttf$/, '$1.ttf');
		return new Response(
			readFileSync(fileURLToPath(new URL(`../../og/fonts/${name}`, import.meta.url)))
		);
	}
}));

const { renderPng } = await import('./rasterize');
const { boardCard, shareCard } = await import('./card');
const { decimate, toPath } = await import('./series');

/** Width and height out of a PNG's first chunk, which is always IHDR. */
function size(png: Uint8Array): { width: number; height: number } {
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

const GROUND = '<rect width="1200" height="630" fill="#0e0e0d"/>';

function svg(body: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${GROUND}${body}</svg>`;
}

function label(weight: number): string {
	return svg(
		`<text x="60" y="320" font-family="Inter" font-weight="${weight}" font-size="64" fill="#ffffff">Łódź · 43,4 kWh</text>`
	);
}

describe('renderPng', () => {
	let png: Buffer;

	beforeAll(async () => {
		png = Buffer.from(await renderPng(label(400)));
	});

	it('writes a PNG at the size the document asks for', () => {
		expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
		expect(size(png)).toEqual({ width: 1200, height: 630 });
	});

	it('draws the text rather than leaving the ground bare', async () => {
		// The one failure mode that looks like success: fonts that never loaded
		// render nothing at all, and a card of flat colour is still a valid PNG.
		const bare = Buffer.from(await renderPng(svg('')));
		expect(png.equals(bare)).toBe(false);
	});

	it('picks the bold face from the same family name', async () => {
		// Both faces call themselves Inter, so a weight is all resvg gets to go on.
		const bold = Buffer.from(await renderPng(label(600)));
		expect(bold.equals(png)).toBe(false);
	});

	it('renders repeatedly without reinitialising the module', async () => {
		// `initWasm` throws on a second call; a second render proves it was not made.
		await expect(renderPng(label(400))).resolves.toBeInstanceOf(Uint8Array);
	});
});

// resvg parses XML far more strictly than the checker in `card.test.ts`, and
// refuses a document outright rather than skipping what it cannot read. These
// two are the proof that the hand-written cards are really SVG.
describe('the cards themselves', () => {
	it('rasterises a share card, curve and all', async () => {
		const x = Array.from({ length: 5000 }, (_, i) => i);
		const y = x.map((i) => (i > 2000 && i < 2200 ? Number.NaN : 120 * Math.sin(i / 700) ** 2));

		const png = await renderPng(
			shareCard({
				heading: 'A 43.4 kWh charge',
				subtitle: '35 min on a 250 kW charger, from an XPeng F30b',
				stats: [
					{ label: 'Delivered', value: '43.4 kWh' },
					{ label: 'Peak', value: '181 kW' }
				],
				series: toPath(decimate(x, y))
			})
		);
		expect(size(png)).toEqual({ width: 1200, height: 630 });
	});

	it('rasterises a board card', async () => {
		const png = await renderPng(
			boardCard({
				title: 'September 2026',
				badge: 'Open · settles 15 October',
				tiles: [
					{ board: 'Peak charge', name: 'Łódź driver', value: '181 kW' },
					{ board: 'Efficiency', name: 'Tom & Jerry', value: '11.4 kWh/100 km' }
				]
			})
		);
		expect(size(png)).toEqual({ width: 1200, height: 630 });
	});
});
