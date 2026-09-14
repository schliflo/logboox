/**
 * Turning an SVG into the PNG a link preview will actually display.
 *
 * Every scraper worth the name takes PNG or JPEG and nothing else, so the card
 * has to be rasterised before it leaves. There is no browser and no canvas in a
 * Worker, which leaves resvg — the same renderer behind resvg-js — compiled to
 * WebAssembly.
 *
 * Two things are memoised for the life of the isolate, because both are pure
 * setup and one of them can only happen once: `initWasm` throws if it is called
 * a second time, and reading the fonts is a request to the asset store. A cold
 * isolate therefore pays for them and every later render does not.
 *
 * The module itself arrives already compiled — see `tooling/wasm-modules.ts` for
 * why it has to. Handing an existing `WebAssembly.Module` to `instantiate`
 * compiles nothing, which is the one thing workerd objects to.
 */

import { read } from '$app/server';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { FONT_URLS } from '$lib/og/fonts';

let started: Promise<void> | undefined;
let loaded: Promise<Uint8Array[]> | undefined;

async function compiled(): Promise<void> {
	// Imported here rather than at the top of the file so that nothing outside
	// this function ever touches it. SvelteKit's build loads the finished server
	// bundle under Node to read each route's exports, and Node's own loader,
	// handed a wasm-bindgen module, goes looking for an npm package called `wbg`
	// and fails the build. Inside a function it is never reached.
	await initWasm((await import('@resvg/resvg-wasm/index_bg.wasm')).default);
}

function ready(): Promise<void> {
	started ??= compiled();
	return started;
}

function fonts(): Promise<Uint8Array[]> {
	loaded ??= Promise.all(
		FONT_URLS.map(async (url) => new Uint8Array(await read(url).arrayBuffer()))
	);
	return loaded;
}

/**
 * Render an SVG document at its own dimensions.
 *
 * The renderer and its image hold memory on the WebAssembly heap that no
 * garbage collector will reclaim, so both are freed before returning — a Worker
 * isolate serves many requests, and a leak here would end them all.
 */
export async function renderPng(svg: string): Promise<Uint8Array<ArrayBuffer>> {
	const [, fontBuffers] = await Promise.all([ready(), fonts()]);

	const renderer = new Resvg(svg, {
		font: { fontBuffers, defaultFontFamily: 'Inter' },
		fitTo: { mode: 'original' }
	});

	try {
		const image = renderer.render();
		try {
			// Copied out before the image is freed, and onto a buffer of its own:
			// what comes back is a view whose backing store belongs to the
			// WebAssembly heap, and a `Response` must not be handed one of those.
			return new Uint8Array(image.asPng());
		} finally {
			image.free();
		}
	} finally {
		renderer.free();
	}
}
