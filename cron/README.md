# The cron Worker

Wakes up at 06:15 UTC and asks logboox.app to do the daily run. It does nothing
itself; the app, at `/internal/cron/reminders`, does the work:

- sends the export reminders that are due;
- sends messages about places waiting on a board, and the yearly summary;
- sweeps up what has expired: uploads never finished, sign-in links, sessions.

The app answers 500 if `MAIL_SECRET` is not set and 502 if it tried to send mail
and every message failed. This Worker logs any non-2xx answer.

It is separate because `@sveltejs/adapter-cloudflare` writes its generated
Worker over whatever `main` names in the root `wrangler.jsonc`, on every build.
A hand-written entry that re-exported SvelteKit's `fetch` and added `scheduled`
would be deleted by the next `pnpm build` — silently, and only noticed at
deploy time.

The work lives in the app, with the database and the mail templates beside it.

```sh
# From the repository root
pnpm deploy:cron

# Locally: fires the schedule on demand at /__scheduled
pnpm --dir cron exec wrangler dev --test-scheduled
```

`CRON_SECRET` must match on both Workers. Set it with `wrangler secret put
CRON_SECRET` in each, or let the deploy workflow do it from the repository's
own secrets. The workflow runs this Worker's deploy from the `cron` directory:
the secret is uploaded from the working directory, so run from the root it would
land on the app's Worker instead.
