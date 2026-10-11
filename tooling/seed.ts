/**
 * Fills the local database with a believable community, so every page that
 * reads it can be seen without an account in production.
 *
 * Like the demonstration month, it is generated from a seed: the same people,
 * places and numbers every run. Fourteen made-up drivers and one local
 * developer hold places on every board for the current month (still open) and
 * the three before it (closed, so medals show). Everything it writes has an id
 * starting `seed-`, and a run removes the previous run's rows first, so it can
 * be repeated freely and never touches anything else.
 *
 *     pnpm db:migrate:local && pnpm db:seed:local
 *
 * Then sign in as dev@logboox.test (the link is printed in the dev server's
 * terminal) to see the boards as somebody with places of their own, or use the
 * session cookie it prints.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BOARDS, scoreOf, type Board } from '../src/lib/leaderboard/boards.ts';

const DEV_EMAIL = 'dev@logboox.test';
const DEV_NAME = 'local_dev';
/** A fixed session secret, for scripts and screenshots. Local databases only. */
const DEV_SESSION = 'seed-local-development-session';

const NAMES = [
	'voltwanderer',
	'g6_nordkap',
	'quietkilometre',
	'ampere_anna',
	'p7plus_paul',
	'regenrider',
	'x9family',
	'lowsocmike',
	'brakelessbea',
	'heatpumphans',
	'autobahn_ada',
	'fjordfahrer',
	'kwh_karl',
	'tidalturtle'
];
const MODELS = ['G6', 'G9', 'P7', 'P7+', 'X9'];

/** A small deterministic generator, so every run seeds the same community. */
function generator(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 2 ** 32;
	};
}

const random = generator(20260801);
const between = (low: number, high: number) => low + random() * (high - low);
const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];

/** Plausible winning values per board: best case, and how far the field trails. */
const RANGES: Record<string, [number, number]> = {
	'peak-charge': [120, 215],
	'biggest-charge': [45, 79],
	'longest-drive': [140, 520],
	'efficient-drive': [11.2, 16.5],
	'best-regen': [0.15, 0.26],
	'hardest-launch': [0.42, 0.72],
	'most-grip': [0.45, 0.93],
	'monthly-distance': [900, 6200]
};

function detailFor(board: Board, value: number): Record<string, number> {
	switch (board.id) {
		case 'peak-charge':
		case 'biggest-charge': {
			const socStart = Math.round(between(5, 35));
			return {
				kwhDelivered: board.id === 'biggest-charge' ? value : Math.round(between(28, 55) * 10) / 10,
				maxKw: board.id === 'peak-charge' ? value : Math.round(between(7, 150)),
				socStart,
				socEnd: Math.min(100, socStart + Math.round(between(40, 70))),
				durationSeconds: Math.round(between(1200, 9000))
			};
		}
		case 'best-regen': {
			const energyKwh = Math.round(between(4, 14) * 10) / 10;
			return {
				distanceKm: Math.round(between(20, 80)),
				energyKwh,
				regenKwh: Math.round(energyKwh * value * 10) / 10
			};
		}
		case 'monthly-distance':
			return {
				trips: Math.round(value / between(30, 60)),
				longestKm: Math.round(between(80, 480))
			};
		default:
			return {
				distanceKm: board.id === 'longest-drive' ? value : Math.round(between(25, 140)),
				durationSeconds: Math.round(between(1500, 12000)),
				avgSpeed: Math.round(between(38, 96)),
				consumption: board.id === 'efficient-drive' ? value : Math.round(between(14, 21) * 10) / 10
			};
	}
}

function month(offset: number): string {
	const now = new Date();
	const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

const sql = (value: string | number | null) =>
	value === null
		? 'NULL'
		: typeof value === 'number'
			? String(value)
			: `'${value.replace(/'/g, "''")}'`;

const now = Math.floor(Date.now() / 1000);
const lines: string[] = [
	"DELETE FROM board_candidates WHERE id LIKE 'seed-%';",
	"DELETE FROM board_entries WHERE id LIKE 'seed-%';",
	"DELETE FROM sessions WHERE id LIKE 'seed-%';",
	"DELETE FROM users WHERE id LIKE 'seed-%';"
];

const people = [
	...NAMES.map((name, index) => ({ id: `seed-${index}`, name, email: `${name}@example.test` })),
	{ id: 'seed-dev', name: DEV_NAME, email: DEV_EMAIL }
];
for (const person of people) {
	lines.push(
		`INSERT INTO users (id, email, created_at, last_seen_at, username, username_changed_at) VALUES (${sql(person.id)}, ${sql(person.email)}, ${now - 86_400 * 120}, ${now}, ${sql(person.name)}, ${now - 86_400 * 120});`
	);
}
const models = new Map(people.map((person) => [person.id, pick(MODELS)]));

let entries = 0;
for (const period of [0, 1, 2, 3].map(month)) {
	const [year, monthNumber] = period.split('-').map(Number);
	const start = Math.floor(Date.UTC(year, monthNumber - 1, 2) / 1000);
	for (const board of BOARDS) {
		const [best, worst] = RANGES[board.id];
		// Not everybody is on every board, and the field thins out on the harder ones.
		const field = people.filter((person) => person.id === 'seed-dev' || random() < 0.75);
		// This month's longest drive is left for the developer to claim, so the
		// "not listed yet" offer can be seen.
		const offered = period === month(0) && board.id === 'longest-drive';
		for (const person of field) {
			const raw = between(best, worst);
			if (offered && person.id === 'seed-dev') {
				const value = Math.round(raw);
				const startTime = start + Math.floor(random() * 26 * 86_400);
				lines.push(
					`INSERT INTO board_candidates (id, user_id, board, month, locks_at, kind, vin, start_time, value, score, detail_json, vmodel, rank_at_detection, created_at) VALUES ('seed-offer', 'seed-dev', ${sql(board.id)}, ${sql(period)}, ${now + 86_400 * 30}, ${sql(board.kind)}, 'SEEDVINSEED-DEV', ${startTime}, ${value}, ${scoreOf(board, value)}, ${sql(JSON.stringify(detailFor(board, value)))}, ${sql(models.get(person.id)!)}, 4, ${now});`
				);
				continue;
			}
			const value =
				board.unit === '%' || board.unit === 'g'
					? Math.round(raw * 100) / 100
					: Math.round(raw * 10 ** board.digits) / 10 ** board.digits;
			const startTime = start + Math.floor(random() * 26 * 86_400);
			lines.push(
				`INSERT INTO board_entries (id, board, month, user_id, kind, vin, start_time, value, score, detail_json, vmodel, share_id, claimed_at, removed_at) VALUES (${sql(`seed-${board.id}-${period}-${person.id}`)}, ${sql(board.id)}, ${sql(period)}, ${sql(person.id)}, ${sql(board.scope === 'month' ? 'month' : board.kind)}, ${sql(`SEEDVIN${person.id.toUpperCase()}`)}, ${startTime}, ${value}, ${scoreOf(board, value)}, ${sql(JSON.stringify(detailFor(board, value)))}, ${sql(models.get(person.id)!)}, NULL, ${startTime + 3600}, NULL);`
			);
			entries++;
		}
	}
}

const tokenHash = createHash('sha256').update(DEV_SESSION).digest('hex');
lines.push(
	`INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_used_at, user_agent) VALUES ('seed-session', 'seed-dev', ${sql(tokenHash)}, ${now}, ${now + 86_400 * 90}, ${now}, 'seed');`
);

const dir = mkdtempSync(join(tmpdir(), 'logboox-seed-'));
const file = join(dir, 'seed.sql');
writeFileSync(file, lines.join('\n') + '\n');
const run = spawnSync(
	'pnpm',
	['exec', 'wrangler', 'd1', 'execute', 'logboox', '--local', '--file', file],
	{
		stdio: 'inherit'
	}
);
rmSync(dir, { recursive: true, force: true });
if (run.status !== 0) process.exit(run.status ?? 1);

console.log(`\nSeeded ${people.length} drivers and ${entries} places over four months.`);
console.log(`Sign in as ${DEV_EMAIL}, or set the cookie lbx_session=${DEV_SESSION} on localhost.`);
