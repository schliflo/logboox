/**
 * WebAssembly modules that survive the trip to a Worker.
 *
 * The link-preview images are rasterised by resvg, which is a WebAssembly
 * module, and workerd refuses to compile WebAssembly from bytes at runtime:
 * `WebAssembly.compile(bytes)` throws "Wasm code generation disallowed by
 * embedder". The only way in is to let wrangler's bundler see the `.wasm` as an
 * import, which its default `CompiledWasm` rule turns into an already-compiled
 * `WebAssembly.Module` — precisely what `initWasm()` wants.
 *
 * Vite would otherwise do something reasonable and wrong. It handles a bare
 * `.wasm` import itself, and for a server build emits glue that reads the file
 * with `node:fs` and calls `WebAssembly.instantiate(buffer)` — the forbidden
 * call, in a runtime with no `node:fs`. So this plugin runs first and takes the
 * import away from it, differently in each mode:
 *
 * - **build**: leave the specifier alone and mark it external, so it reaches
 *   `.svelte-kit/output/server/**` verbatim and wrangler resolves it.
 * - **serve** (`vite dev` and vitest, which is the `ssr` environment): compile
 *   it from disk, which Node is perfectly happy to do.
 *
 * Client builds are untouched: nothing in the browser imports a `.wasm`.
 */

import { createRequire } from 'node:module';
import type { Plugin } from 'vite';

const WASM = /\.wasm$/;

/**
 * Marks an id as ours, and as nobody else's business. It carries the original
 * specifier rather than the resolved path, because vitest decides what to hand
 * to Node by looking for `/node_modules/` in the id — a resolved path would be
 * externalised despite the prefix — and it has no colon, because what is left
 * after the prefix is stripped in a stack trace should not read as a protocol.
 */
const PREFIX = '\0wasm/';

export function wasmModules(): Plugin {
	const require = createRequire(import.meta.url);

	return {
		name: 'logboox:wasm-modules',
		// Ahead of Vite's own wasm handling, which is what we are replacing.
		enforce: 'pre',

		resolveId(source) {
			if (source.startsWith(PREFIX)) return source;
			if (!WASM.test(source) || this.environment.config.consumer !== 'server') return null;
			if (this.environment.mode === 'build') return { id: source, external: true };

			try {
				require.resolve(source);
			} catch {
				return null;
			}
			return PREFIX + source;
		},

		async load(id) {
			if (!id.startsWith(PREFIX)) return null;
			const file = require.resolve(id.slice(PREFIX.length));

			// Read at import time rather than inlined here: the module is megabytes,
			// and a megabyte of JavaScript array literal is slower than a file read.
			return {
				code: [
					"import { readFile } from 'node:fs/promises';",
					`export default await WebAssembly.compile(await readFile(${JSON.stringify(file)}));`
				].join('\n'),
				moduleType: 'js'
			};
		}
	};
}
