/**
 * A D1-shaped database backed by SQLite, for the tests.
 *
 * The server code is written against the smallest interface D1 satisfies, so
 * the same queries can run here against Node's own SQLite. That is the whole
 * point: the migration under test is the migration that ships, and the SQL is
 * executed by a real engine rather than checked against a mock that agrees
 * with whatever it is told.
 *
 * Only what the app uses is implemented. Anything else should fail loudly
 * rather than quietly differ from the real thing.
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Db, Statement } from '../db';

const MIGRATIONS = new URL('../../../../migrations', import.meta.url).pathname;

type Value = string | number | null;

/** D1 takes booleans and undefined; SQLite takes neither. */
function coerce(value: unknown): Value {
	if (value === undefined || value === null) return null;
	if (typeof value === 'boolean') return value ? 1 : 0;
	if (typeof value === 'number' || typeof value === 'string') return value;
	if (typeof value === 'bigint') return Number(value);
	throw new TypeError(`Cannot bind a ${typeof value} to a query.`);
}

class SqliteStatement implements Statement {
	constructor(
		private readonly db: DatabaseSync,
		private readonly sql: string,
		private readonly values: Value[] = []
	) {}

	bind(...values: unknown[]): Statement {
		return new SqliteStatement(this.db, this.sql, values.map(coerce));
	}

	async first<T>(): Promise<T | null> {
		const row = this.db.prepare(this.sql).get(...this.values);
		return (row as T | undefined) ?? null;
	}

	async run(): Promise<{ meta: { changes: number } }> {
		const result = this.db.prepare(this.sql).run(...this.values);
		return { meta: { changes: Number(result.changes) } };
	}

	async all<T>(): Promise<{ results: T[] }> {
		return { results: this.db.prepare(this.sql).all(...this.values) as T[] };
	}
}

export interface TestDb extends Db {
	/** Closes the underlying handle. Call it when a suite is done. */
	close(): void;
}

/**
 * An empty database with every migration applied, in file order — the same
 * order `wrangler d1 migrations apply` uses.
 */
export function migratedDb(): TestDb {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');

	for (const name of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
		sqlite.exec(readFileSync(join(MIGRATIONS, name), 'utf8'));
	}

	return {
		prepare: (sql: string) => new SqliteStatement(sqlite, sql),
		batch: async (statements: Statement[]) => {
			const out: unknown[] = [];
			for (const statement of statements) out.push(await statement.run());
			return out;
		},
		close: () => sqlite.close()
	};
}
