/**
 * The deploy guard. What matters is that it stops on each kind of blank and
 * says nothing about a file that is finished.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findPlaceholders } from './check-placeholders';

let root: string;

function write(file: string, content: string) {
	mkdirSync(join(root, file, '..'), { recursive: true });
	writeFileSync(join(root, file), content);
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'placeholders-'));
	write('wrangler.jsonc', '{ "database_id": "0a1b2c" }');
	write('src/routes/legal/imprint/+page.svelte', '<p>Jane Doe, Main Street 1</p>');
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('placeholders', () => {
	it('finds nothing in finished files', () => {
		expect(findPlaceholders(root)).toEqual([]);
	});

	it('finds the database id stand-in in wrangler.jsonc', () => {
		write('wrangler.jsonc', '{\n"database_id": "REPLACE_WITH_D1_DATABASE_ID"\n}');
		expect(findPlaceholders(root)).toEqual([
			{ file: 'wrangler.jsonc', line: 2, text: 'REPLACE_WITH_D1_DATABASE_ID' }
		]);
	});

	it('finds bracketed capitals anywhere under the legal pages', () => {
		write('src/routes/legal/imprint/+page.svelte', '<p>\n[STREET AND NUMBER]<br />[EMAIL]</p>');
		write('src/routes/legal/privacy/+page.svelte', 'the [YOUR STATE DATA PROTECTION AUTHORITY]');

		const found = findPlaceholders(root).map(({ file, text }) => `${file} ${text}`);
		expect(found.sort()).toEqual([
			'src/routes/legal/imprint/+page.svelte [EMAIL]',
			'src/routes/legal/imprint/+page.svelte [STREET AND NUMBER]',
			'src/routes/legal/privacy/+page.svelte [YOUR STATE DATA PROTECTION AUTHORITY]'
		]);
	});

	it('leaves ordinary brackets alone', () => {
		write('src/routes/legal/terms/+page.svelte', '<p>{items[index]} [see below] [a]</p>');
		expect(findPlaceholders(root)).toEqual([]);
	});
});
