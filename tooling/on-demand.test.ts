/**
 * Which files the build says can wait.
 *
 * The interesting cases are all about restraint. Deferring a file the app turns
 * out to need on load means a blank page for somebody with no connection, which
 * is far worse than the download this exists to avoid — so every test here is
 * about a file that must *not* be deferred.
 */

import { describe, expect, it } from 'vitest';
import { onDemand } from './on-demand';

interface FakeChunk {
	fileName: string;
	facadeModuleId?: string | null;
	imports?: string[];
	dynamicImports?: string[];
	isEntry?: boolean;
	isDynamicEntry?: boolean;
	assets?: string[];
}

const ROOT = '/repo';

function chunk(chunk: FakeChunk) {
	return {
		type: 'chunk' as const,
		fileName: chunk.fileName,
		facadeModuleId: chunk.facadeModuleId ? `${ROOT}/${chunk.facadeModuleId}` : null,
		imports: chunk.imports ?? [],
		dynamicImports: chunk.dynamicImports ?? [],
		isEntry: chunk.isEntry ?? false,
		isDynamicEntry: chunk.isDynamicEntry ?? false,
		viteMetadata: { importedAssets: new Set(chunk.assets ?? []) }
	};
}

/** Runs the plugin over a made-up bundle and returns what it published. */
function run(chunks: FakeChunk[], consumer: 'client' | 'server' = 'client') {
	const plugin = onDemand({ entry: 'src/lib/export/pdf.ts' });
	const emitted: Array<{ fileName?: string; source?: unknown }> = [];
	const warnings: string[] = [];

	const context = {
		environment: { config: { consumer } },
		warn: (message: string) => warnings.push(String(message)),
		emitFile: (file: { fileName?: string; source?: unknown }) => emitted.push(file)
	};

	const bundle = Object.fromEntries(chunks.map((c) => [c.fileName, chunk(c)]));
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(plugin.generateBundle as any).call(context, {}, bundle);

	const list = emitted[0]?.source === undefined ? null : JSON.parse(String(emitted[0].source));
	return { emitted, warnings, list: list as string[] | null };
}

/** The shape the real build has: an app, and a PDF writer hanging off it. */
const BUNDLE: FakeChunk[] = [
	{ fileName: 'entry/app.js', isEntry: true, imports: ['chunks/shared.js'] },
	{
		fileName: 'nodes/trips.js',
		isEntry: true,
		imports: ['chunks/shared.js'],
		// The page reaches the writer the only way anything reaches it.
		dynamicImports: ['chunks/pdf.js']
	},
	{ fileName: 'chunks/shared.js', assets: ['assets/app.css'] },
	{
		fileName: 'chunks/pdf.js',
		facadeModuleId: 'src/lib/export/pdf.ts',
		isDynamicEntry: true,
		imports: ['chunks/shared.js'],
		dynamicImports: ['chunks/pdf-lib.js', 'chunks/fontkit.js'],
		assets: ['assets/Inter-Regular.ttf']
	},
	{ fileName: 'chunks/pdf-lib.js', isDynamicEntry: true, imports: ['chunks/pdf-common.js'] },
	{ fileName: 'chunks/fontkit.js', isDynamicEntry: true, imports: ['chunks/pdf-common.js'] },
	{ fileName: 'chunks/pdf-common.js' }
];

describe('onDemand', () => {
	it('defers the entry, what it lazily pulls in, and what those share', () => {
		expect(run(BUNDLE).list).toEqual([
			'/assets/Inter-Regular.ttf',
			'/chunks/fontkit.js',
			'/chunks/pdf-common.js',
			'/chunks/pdf-lib.js',
			'/chunks/pdf.js'
		]);
	});

	it('keeps a chunk the app reaches on load', () => {
		// The whole trap: the writer imports `shared` too, and the page that
		// exports a PDF imports the writer. Following that dynamic edge backwards
		// would mark the writer as needed and defer nothing at all.
		expect(run(BUNDLE).list).not.toContain('/chunks/shared.js');
		expect(run(BUNDLE).list).not.toContain('/entry/app.js');
	});

	it('keeps an asset that something else needs as well', () => {
		expect(run(BUNDLE).list).not.toContain('/assets/app.css');
	});

	it('keeps a chunk another feature also loads on demand', () => {
		// Shared between two lazy features is still shared: deferring it would
		// make the spreadsheet export wait for a download it does not need.
		const shared = run([
			...BUNDLE,
			{
				fileName: 'chunks/xlsx.js',
				facadeModuleId: 'src/lib/export/xlsx.ts',
				isDynamicEntry: true,
				imports: ['chunks/pdf-common.js']
			}
		]);
		expect(shared.list).not.toContain('/chunks/pdf-common.js');
		expect(shared.list).toContain('/chunks/pdf-lib.js');
	});

	it('says so and defers nothing when the entry has moved', () => {
		const moved = run(BUNDLE.filter((c) => c.fileName !== 'chunks/pdf.js'));
		expect(moved.list).toEqual([]);
		expect(moved.warnings.join(' ')).toMatch(/nothing deferred/);
	});

	it('matches the entry by its whole path, not by its name', () => {
		const decoy = run([
			{ fileName: 'entry/app.js', isEntry: true },
			{ fileName: 'chunks/other.js', facadeModuleId: 'src/routes/api/pdf.ts', isDynamicEntry: true }
		]);
		expect(decoy.list).toEqual([]);
		expect(decoy.warnings).toHaveLength(1);
	});

	it('publishes nothing at all from the server build', () => {
		const server = run(BUNDLE, 'server');
		expect(server.emitted).toHaveLength(0);
	});

	it('publishes to a path the app can fetch, outside the immutable output', () => {
		// It names this build's files, so it must not be cached forever.
		expect(run(BUNDLE).emitted[0].fileName).toBe('_app/on-demand.json');
	});
});
