import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
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
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
