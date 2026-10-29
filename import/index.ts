/**
 * The import Worker: automatic import from XPeng, without anyone opening the
 * app. See docs/auto-import.md.
 *
 * Hourly, it takes one fetching step per owner who is due (one new XPeng
 * export a day each), then merges every fetched ZIP and every upload the app
 * could not merge at once into the timeline, with the same code the browser
 * runs. The app calls `Importer.update` over a service binding for an owner's
 * "Update now". A Worker of its own because SvelteKit's
 * generated one cannot have a `scheduled` handler (see cron/), and because
 * parsing wants the whole of an isolate's memory and an hourly cron's 15
 * minutes of CPU.
 */

import { WorkerEntrypoint } from 'cloudflare:workers';
import { runFetches, type XpengApp } from '../src/lib/server/xpeng/fetch';
import { runImports } from '../src/lib/server/xpeng/import';
import { updateNow, type ImportService, type UpdateResult } from '../src/lib/server/xpeng/update';

interface Env {
	DB: D1Database;
	STORAGE: R2Bucket;
	XPENG_APP_ID?: string;
	XPENG_APP_SECRET?: string;
	XPENG_OPEN_ENV?: string;
}

/** Leaves room inside the 15-minute limit for the run that is under way. */
const BUDGET_MS = 12 * 60_000;

function app(env: Env): XpengApp | null {
	if (!env.XPENG_APP_ID || !env.XPENG_APP_SECRET) {
		console.error('XPENG_APP_ID or XPENG_APP_SECRET is not set; nothing was fetched.');
		return null;
	}
	return {
		env: env.XPENG_OPEN_ENV === 'uat' ? 'uat' : 'prod',
		app: { appId: env.XPENG_APP_ID, appSecret: env.XPENG_APP_SECRET }
	};
}

/** For the app's service binding. The caller has checked who is asking. */
export class Importer extends WorkerEntrypoint<Env> implements ImportService {
	async update(userId: string): Promise<UpdateResult> {
		const xpeng = app(this.env);
		if (!xpeng) return { kind: 'failed', message: 'appError' };
		return updateNow(this.env.DB, this.env.STORAGE, xpeng, userId);
	}
}

export default {
	async scheduled(_event: ScheduledController, env: Env) {
		const started = Date.now();
		const xpeng = app(env);
		const fetched = xpeng ? await runFetches(env.DB, env.STORAGE, xpeng) : null;
		const imported = await runImports(env.DB, env.STORAGE, started + BUDGET_MS);
		console.log(JSON.stringify({ fetched, imported, ms: Date.now() - started }));
	}
} satisfies ExportedHandler<Env>;
