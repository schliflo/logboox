/**
 * A cold start that fails once must not fail every card after it.
 *
 * The renderer is stubbed here, unlike in `rasterize.test.ts`: what is under
 * test is only whether a rejected setup promise is kept.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ initFailures: 0, readFailures: 0, inits: 0 }));

vi.mock('$app/server', () => ({
	read: () => {
		if (state.readFailures > 0) {
			state.readFailures--;
			throw new Error('asset store unavailable');
		}
		return new Response(new Uint8Array([0]));
	}
}));

vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({ default: {} }));

vi.mock('@resvg/resvg-wasm', () => ({
	initWasm: async () => {
		state.inits++;
		if (state.initFailures > 0) {
			state.initFailures--;
			throw new Error('instantiate failed');
		}
	},
	Resvg: class {
		render() {
			return { asPng: () => new Uint8Array([137, 80, 78, 71]), free() {} };
		}
		free() {}
	}
}));

beforeEach(() => {
	vi.resetModules();
	state.initFailures = 0;
	state.readFailures = 0;
	state.inits = 0;
});

describe('renderPng after a failed setup', () => {
	it('initialises again rather than keeping the failure', async () => {
		const { renderPng } = await import('./rasterize');
		state.initFailures = 1;
		await expect(renderPng('<svg/>')).rejects.toThrow('instantiate failed');
		await expect(renderPng('<svg/>')).resolves.toBeInstanceOf(Uint8Array);
		await renderPng('<svg/>');
		expect(state.inits).toBe(2);
	});

	it('reads the fonts again rather than keeping the failure', async () => {
		const { renderPng } = await import('./rasterize');
		state.readFailures = 1;
		await expect(renderPng('<svg/>')).rejects.toThrow('asset store unavailable');
		await expect(renderPng('<svg/>')).resolves.toBeInstanceOf(Uint8Array);
	});
});
