/**
 * Stops a deploy that would ship blanks.
 *
 * Two files are written with stand-ins for facts only the owner has: the D1
 * database id in `wrangler.jsonc`, and the name, address and supervisory
 * authority in the legal pages. Deploying with them still in place publishes an
 * imprint that says `[STREET AND NUMBER]`, and a Worker bound to no database.
 *
 * Run as the first step of the deploy workflow's `migrate` job, and not in CI,
 * where it would fail every pull request until the values are filled in.
 *
 *     node tooling/check-placeholders.ts
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `[STREET AND NUMBER]`: capitals and spaces between square brackets. */
const LEGAL_PLACEHOLDER = /\[[A-Z][A-Z ]*\]/g;
const WRANGLER_PLACEHOLDER = /REPLACE_WITH_[A-Z0-9_]+/g;

export interface Finding {
	file: string;
	line: number;
	text: string;
}

function scan(root: string, file: string, pattern: RegExp): Finding[] {
	const found: Finding[] = [];
	const lines = readFileSync(join(root, file), 'utf8').split('\n');
	lines.forEach((line, index) => {
		for (const match of line.matchAll(pattern)) {
			found.push({ file: relative(root, join(root, file)), line: index + 1, text: match[0] });
		}
	});
	return found;
}

/** Every placeholder still in the files a deploy publishes, under `root`. */
export function findPlaceholders(root: string): Finding[] {
	const found = scan(root, 'wrangler.jsonc', WRANGLER_PLACEHOLDER);

	const legal = readdirSync(join(root, 'src/routes/legal'), {
		recursive: true,
		withFileTypes: true
	});
	for (const entry of legal) {
		if (!entry.isFile()) continue;
		const file = relative(root, join(entry.parentPath, entry.name));
		found.push(...scan(root, file, LEGAL_PLACEHOLDER));
	}

	return found;
}

if (import.meta.main) {
	const root = fileURLToPath(new URL('..', import.meta.url));
	const found = findPlaceholders(root);

	if (found.length > 0) {
		console.error('Fill these in before deploying:\n');
		for (const { file, line, text } of found) console.error(`  ${file}:${line}  ${text}`);
		process.exit(1);
	}
}
