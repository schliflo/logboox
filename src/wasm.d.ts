/**
 * What a `.wasm` import is worth.
 *
 * Both paths in `tooling/wasm-modules.ts` hand back an already-compiled module:
 * wrangler's `CompiledWasm` rule in the deployed Worker, `WebAssembly.compile`
 * from disk under Node. Never the bytes, and never an instance.
 */
declare module '*.wasm' {
	const module: WebAssembly.Module;
	export default module;
}
