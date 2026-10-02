import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { wasmModules } from './tooling/wasm-modules.ts';
import { onDemand } from './tooling/on-demand.ts';

export default defineConfig({
	plugins: [
		wasmModules(),
		// The PDF writer and the typeface it embeds, left for whoever asks for one.
		onDemand({ entry: 'src/lib/export/pdf.ts' }),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	server: {
		watch: {
			// Wrangler's local state lives here: the emulated database, the
			// bucket, and a file per message the mail binding "sends". Watching
			// it means every sign-in link reloads the page that just asked for
			// one, which is a strange way to test a sign-in link.
			ignored: ['**/.wrangler/**']
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				server: {
					watch: {
						// Wrangler's local state lives here: the emulated database, the
						// bucket, and a file per message the mail binding "sends". Watching
						// it means every sign-in link reloads the page that just asked for
						// one, which is a strange way to test a sign-in link.
						ignored: ['**/.wrangler/**']
					}
				},
				test: {
					name: 'server',
					environment: 'node',
					// `tooling` too: the build plugins have logic worth testing, and it
					// is the kind that only shows up in a deploy if it is not.
					include: ['src/**/*.{test,spec}.{js,ts}', 'tooling/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
