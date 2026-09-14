/**
 * Which files exist only for one rarely-used feature.
 *
 * The service worker fills its store with every file of the build on a
 * visitor's first arrival, and one of those files is the PDF writer: pdf-lib
 * and its font parser, several hundred kilobytes serving a button most people
 * never press. It should be fetched the first time somebody exports a PDF and
 * not before.
 *
 * The worker cannot work out which file that is. Its list comes from Vite's
 * client manifest, as a flat array of URLs, and SvelteKit names every chunk by
 * its hash alone — deliberately, so that a filename cannot say which pages a
 * site has. There is no string to match on, and overriding the naming to create
 * one defeats the splitting that keeps the chunk small in the first place.
 *
 * Nor can it be told at build time. SvelteKit builds the worker in a separate
 * Vite pass configured with `configFile: false` and one plugin of its own,
 * which rejects any import it does not recognise — so no plugin of ours runs
 * there, and no virtual module can reach it.
 *
 * What it can do is read a file. So this walks the finished client bundle,
 * works out which chunks and assets are reachable *only* from the given entry,
 * and publishes their names beside them. The worker fetches that list while
 * installing and leaves those files for later. Nothing here assumes a filename,
 * a build order, or anything about the shape of the output; if the list is
 * missing the worker simply stores everything, as it did before.
 */

import type { Plugin } from 'vite';

export interface OnDemandOptions {
	/**
	 * The module whose private dependencies should be deferred, as a path
	 * relative to the project root.
	 */
	entry: string;
	/** Where the list is published, relative to the client output root. */
	fileName?: string;
}

/** Rollup reports POSIX paths on every platform; ids do not always follow. */
function normalise(path: string): string {
	return path.replace(/\\/g, '/');
}

export function onDemand({ entry, fileName = '_app/on-demand.json' }: OnDemandOptions): Plugin {
	const wanted = normalise(entry).replace(/^\.?\//, '');

	return {
		name: 'logboox:on-demand',
		apply: 'build',

		generateBundle(_options, bundle) {
			// Only the browser build has a service worker to inform.
			if (this.environment.config.consumer !== 'client') return;

			const chunks = Object.values(bundle).filter((part) => part.type === 'chunk');
			const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));

			const start = chunks.find((chunk) =>
				normalise(chunk.facadeModuleId ?? '').endsWith(`/${wanted}`)
			);

			// A refactor that moves or inlines the entry must not fail the build;
			// the cost of missing it is a larger first download, not a broken app.
			if (!start) {
				this.warn(`on-demand: no chunk was built from ${entry}; nothing deferred`);
			}

			const reach = (from: Iterable<string>, dynamic: boolean): Set<string> => {
				const seen = new Set<string>();
				const pending = [...from];
				while (pending.length > 0) {
					const name = pending.pop()!;
					if (seen.has(name)) continue;
					seen.add(name);
					const chunk = byName.get(name);
					if (!chunk) continue;
					pending.push(...chunk.imports);
					if (dynamic) pending.push(...chunk.dynamicImports);
				}
				return seen;
			};

			// Everything the entry drags in, including what it imports lazily in
			// turn: pdf-lib and its font parser are each their own chunk, and
			// neither exists for any other reason.
			const mine = start ? reach([start.fileName], true) : new Set<string>();

			// Everything the rest of the app reaches *on load*. Static imports only,
			// and deliberately: a chunk is deferrable precisely because it is
			// reached by a dynamic import, so following those would rediscover this
			// entry through the page that lazily imports it and defer nothing at
			// all. A chunk the app needs before anyone presses a button is reached
			// statically, and stays in the store.
			const shared = reach(
				chunks
					.filter((chunk) => (chunk.isEntry || chunk.isDynamicEntry) && !mine.has(chunk.fileName))
					.map((chunk) => chunk.fileName),
				false
			);

			/** The files a set of chunks pulls in beside themselves — fonts, mostly. */
			const assetsOf = (names: Iterable<string>): Set<string> => {
				const out = new Set<string>();
				for (const name of names) {
					for (const asset of byName.get(name)?.viteMetadata?.importedAssets ?? []) {
						out.add(asset);
					}
				}
				return out;
			};

			const deferredChunks = [...mine].filter((name) => !shared.has(name));
			const sharedAssets = assetsOf(shared);
			const deferredAssets = [...assetsOf(deferredChunks)].filter(
				(asset) => !sharedAssets.has(asset)
			);

			const deferred = [...deferredChunks, ...deferredAssets].sort().map((name) => `/${name}`);

			this.emitFile({
				type: 'asset',
				fileName,
				source: `${JSON.stringify(deferred, null, '\t')}\n`
			});
		}
	};
}
