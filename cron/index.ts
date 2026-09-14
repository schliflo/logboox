/**
 * The reminder Worker.
 *
 * All it does is ask the app, once a day, to send whatever reminders are due.
 * It exists as a Worker of its own because the one SvelteKit generates exports
 * a fetch handler and nothing else, and the Cloudflare adapter writes that
 * generated file over whatever `main` points at — so a hand-written entry that
 * added a `scheduled` export would be deleted by the next build.
 *
 * Twenty lines and a shared secret is a smaller price than a build that
 * quietly removes its own entry point. The work itself lives in the app, with
 * the database and the templates.
 */

interface Env {
	/** Where the app answers. */
	LOGBOOX_ORIGIN: string;
	/** Shared with the app, which refuses the request without it. */
	CRON_SECRET: string;
}

export default {
	async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(trigger(env));
	},

	/**
	 * Also reachable directly, which is what `wrangler dev --test-scheduled`
	 * and a manual run need. It carries no secret of its own: the app is the
	 * thing that checks, and this only forwards.
	 */
	async fetch(_request: Request, env: Env): Promise<Response> {
		const report = await trigger(env);
		return new Response(report, { headers: { 'content-type': 'application/json' } });
	}
} satisfies ExportedHandler<Env>;

async function trigger(env: Env): Promise<string> {
	const response = await fetch(`${env.LOGBOOX_ORIGIN}/internal/cron/reminders`, {
		method: 'POST',
		headers: { authorization: `Bearer ${env.CRON_SECRET}` }
	});

	const body = await response.text();
	if (!response.ok) {
		// Logged rather than thrown: a failed run is retried tomorrow, and the
		// reminder it would have sent is a week late at worst.
		console.error(`reminder run failed (${response.status}): ${body}`);
	}
	return body;
}
