/**
 * Walks the built Worker the way a reader, a poller and the cron Worker do.
 *
 * The unit tests hand every route a database of their own, so none of them
 * notices when the real Worker stops receiving its bindings, or when the
 * framework starts refusing a request before a route runs. Both have happened
 * on an upgrade, with every other check green. This runs what `pnpm build`
 * produced under Wrangler, with a throwaway local database, and asks for the
 * things that need a binding.
 *
 *     pnpm build && pnpm test:smoke
 */

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cron from '../cron/index.ts';

const PORT = 4179;
const ORIGIN = `http://localhost:${PORT}`;
const CRON_SECRET = 'smoke-cron-secret';
const WORKER = '.svelte-kit/cloudflare/_worker.js';

const state = mkdtempSync(join(tmpdir(), 'logboox-smoke-'));
const wrangler = (...args: string[]) => ['exec', 'wrangler', ...args, '--persist-to', state];

const migrated = spawnSync('pnpm', wrangler('d1', 'migrations', 'apply', 'logboox', '--local'), {
	encoding: 'utf8',
	env: { ...process.env, CI: '1' }
});
assert.equal(migrated.status, 0, `migrations failed:\n${migrated.stdout}${migrated.stderr}`);

const server = spawn(
	'pnpm',
	wrangler(
		'dev',
		WORKER,
		'--port',
		String(PORT),
		'--var',
		`CRON_SECRET:${CRON_SECRET}`,
		'--var',
		'MAIL_SECRET:smoke-mail-secret'
	),
	{ stdio: ['ignore', 'pipe', 'pipe'], detached: true }
);
let log = '';
server.stdout.on('data', (chunk) => (log += chunk));
server.stderr.on('data', (chunk) => (log += chunk));

async function until<T>(what: string, probe: () => T | Promise<T>, seconds = 60): Promise<T> {
	const deadline = Date.now() + seconds * 1000;
	for (;;) {
		try {
			const value = await probe();
			if (value) return value;
		} catch {
			// Not up yet.
		}
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}.\n${log}`);
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
}

/** A JSON request from the app's own pages, with the session cookie once there is one. */
let cookie = '';
function app(path: string, body?: unknown): Promise<Response> {
	return fetch(ORIGIN + path, {
		method: body === undefined ? 'GET' : 'POST',
		headers: {
			...(body === undefined ? {} : { 'content-type': 'application/json', origin: ORIGIN }),
			...(cookie ? { cookie } : {})
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

async function expectStatus(response: Response, status: number, what: string): Promise<void> {
	if (response.status === status) return;
	assert.fail(`${what}: ${response.status} ${await response.text()}`);
}

try {
	await until('the Worker', async () => (await fetch(ORIGIN + '/robots.txt')).ok);

	// Sign-in: needs the database and the mail binding.
	await expectStatus(
		await app('/api/v1/auth/request', { email: 'smoke@example.com' }),
		202,
		'asking for a sign-in link'
	);
	const mail = await until('the sign-in mail', () => /Text: (.+\.txt)/.exec(log)?.[1], 15);
	const token = /[?&]token=([^\s&]+)/.exec(readFileSync(mail, 'utf8'))?.[1];
	assert.ok(token, 'the sign-in mail carries no link');

	const verified = await app('/api/v1/auth/verify', { token: decodeURIComponent(token) });
	await expectStatus(verified, 200, 'opening the sign-in link');
	cookie = verified.headers
		.getSetCookie()
		.map((c) => c.split(';')[0])
		.join('; ');

	const me = await app('/api/v1/me');
	await expectStatus(me, 200, 'reading the account');
	assert.equal((await me.json()).user.email, 'smoke@example.com');

	// A poller: a bearer token and no cookie.
	const minted = await app('/api/v1/tokens', { name: 'smoke', scopes: ['read'] });
	await expectStatus(minted, 200, 'minting a token');
	const bearer = (await minted.json()).token;
	await expectStatus(
		await fetch(ORIGIN + '/api/v1/vehicles', { headers: { authorization: `Bearer ${bearer}` } }),
		200,
		'reading with a token'
	);

	// Server-rendered from the database, and drawn by the wasm renderer.
	const month = new Date().toISOString().slice(0, 7);
	await expectStatus(await app(`/leaderboard/${month}`), 200, 'the leaderboard page');
	await expectStatus(await app(`/api/v1/leaderboard/${month}`), 200, 'the leaderboard API');
	const card = await app(`/leaderboard/${month}/og.png`);
	await expectStatus(card, 200, 'the leaderboard card');
	assert.equal(card.headers.get('content-type'), 'image/png');

	// A badge nobody holds: reaches the database, and says so to any origin.
	const badge = await app('/badge/2020-01/peak-charge/nobody.png');
	await expectStatus(badge, 404, 'a badge nobody holds');
	assert.equal(badge.headers.get('cross-origin-resource-policy'), 'cross-origin');

	// The daily run, through the cron Worker's own code, so that the request
	// under test is the one production sends.
	const report = await cron.fetch(new Request('http://cron.invalid/'), {
		LOGBOOX_ORIGIN: ORIGIN,
		CRON_SECRET
	});
	const text = await report.text();
	let parsed: { error?: string } | null = null;
	try {
		parsed = JSON.parse(text);
	} catch {
		// Reported below.
	}
	assert.ok(parsed && !parsed.error, `the daily run was refused: ${text}`);

	console.log('smoke: the built Worker signs in, reads, draws and runs the daily job.');
} finally {
	// The whole group: pnpm is the child, and Wrangler and workerd hang off it.
	if (server.pid) process.kill(-server.pid, 'SIGTERM');
	rmSync(state, { recursive: true, force: true });
}
