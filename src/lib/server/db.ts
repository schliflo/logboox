/**
 * The account database, behind the smallest interface that fits.
 *
 * Cloudflare's `D1Database` satisfies `Db` structurally, so the Worker passes
 * its binding straight in. Declaring the shape here rather than importing the
 * Cloudflare type is what lets the tests run the same code against SQLite in
 * Node, with no Workers runtime and no emulator — the queries under test are
 * the ones that ship.
 */

export interface Statement {
	bind(...values: unknown[]): Statement;
	first<T = Record<string, unknown>>(): Promise<T | null>;
	run(): Promise<{ meta: { changes: number } }>;
	all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface Db {
	prepare(sql: string): Statement;
	batch(statements: Statement[]): Promise<Array<{ meta?: { changes?: number } }>>;
}

/** Now, in the epoch seconds everything in this schema is measured in. */
export function now(): number {
	return Math.floor(Date.now() / 1000);
}

export async function one<T>(db: Db, sql: string, ...values: unknown[]): Promise<T | null> {
	return db
		.prepare(sql)
		.bind(...values)
		.first<T>();
}

export async function all<T>(db: Db, sql: string, ...values: unknown[]): Promise<T[]> {
	const result = await db
		.prepare(sql)
		.bind(...values)
		.all<T>();
	return result.results ?? [];
}

/** Runs a statement and reports how many rows it actually touched. */
export async function run(db: Db, sql: string, ...values: unknown[]): Promise<number> {
	const result = await db
		.prepare(sql)
		.bind(...values)
		.run();
	return result.meta?.changes ?? 0;
}

/**
 * Statements per `db.batch`. A month is a few dozen round trips at this size,
 * and each batch — one D1 transaction — stays far below its size and time limits.
 */
export const BATCH_SIZE = 250;

/** Runs statements in atomic chunks and says how many rows they changed. */
export async function runBatched(db: Db, statements: Statement[]): Promise<number> {
	let changes = 0;
	for (let i = 0; i < statements.length; i += BATCH_SIZE) {
		const results = await db.batch(statements.slice(i, i + BATCH_SIZE));
		for (const result of results) changes += result?.meta?.changes ?? 0;
	}
	return changes;
}

/** A short opaque id for a row. Not a secret; never used for access. */
export function rowId(): string {
	return crypto.randomUUID();
}
