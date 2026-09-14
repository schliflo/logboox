# The reminder Worker

Wakes up at 06:15 UTC and asks logboox.app to send whatever import reminders
are due. That is all it does.

It is separate because `@sveltejs/adapter-cloudflare` writes its generated
Worker over whatever `main` names in the root `wrangler.jsonc`, on every build.
A hand-written entry that re-exported SvelteKit's `fetch` and added `scheduled`
would be deleted by the next `pnpm build` — silently, and only noticed at
deploy time.

The work itself lives in the app, at `/internal/cron/reminders`, with the
database and the mail templates beside it.

```sh
# From the repository root
pnpm deploy:cron

# Locally: fires the schedule on demand at /__scheduled
pnpm --dir cron exec wrangler dev --test-scheduled
```

`CRON_SECRET` must match on both Workers. Set it with `wrangler secret put
CRON_SECRET` in each, or let the deploy workflow do it from the repository's
own secrets.
