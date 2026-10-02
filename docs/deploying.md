# Deploying LogbooX

Merging to `main` deploys. The workflow in
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) runs the same
checks CI runs, then the deploy check (below), applies any pending database
migrations, and ships three Workers:

1. **logboox.app** — the app itself. Goes first.
2. **logboox-cron** — the Worker that starts the daily run: reminders, board
   messages, the yearly summary and the tidying up.
3. **xpeng-data-export-browser** — the old workers.dev address, which still
   serves the full app with a notice pointing at the new one.

Once production is out, the cron and legacy jobs run side by side. Production
is deployed before legacy on purpose. Wrangler attaches a custom
domain to whichever Worker claimed it last, and an empty `routes` list on the
legacy environment does **not** detach a domain already attached — only
redeploying production reclaims it.

Everything below is a one-time setup, or a thing to check when something looks
wrong.

## One-time setup

### Disconnect Workers Builds

Cloudflare's own build integration, if it is still connected to this
repository, deploys `main` into whichever Worker it was bound to and fights
this workflow for the custom domain. Disconnect it in the dashboard under
**Workers & Pages → logboox → Settings → Builds** before the first run.

### Create the database and the bucket

Both can be pinned to the EU, and this is the recommended way. The location
cannot be changed afterwards, so decide before creating them.

```bash
wrangler d1 create logboox --jurisdiction eu
```

Paste the `database_id` it prints into `d1_databases[0].database_id` in
[`wrangler.jsonc`](../wrangler.jsonc) and commit it. The id is not a secret; it
names a database that nothing can reach without the account's own credentials.

```bash
wrangler r2 bucket create logboox-exports --jurisdiction eu
```

A bucket created in a jurisdiction has to be bound with the same one, so add it
to the bucket's entry in `wrangler.jsonc`:

```jsonc
"r2_buckets": [
	{ "binding": "STORAGE", "bucket_name": "logboox-exports", "jurisdiction": "eu" }
]
```

Both were created this way, and the privacy notice says so under "Where it is
stored". If they are ever recreated elsewhere, that sentence has to change.

Then apply the migrations once by hand, so the first deploy is not also the
first schema change:

```bash
pnpm db:migrate
```

### Verify the sender domain

Email Service refuses to send from a domain it has not verified, with
`E_SENDER_NOT_VERIFIED`. Add `logboox.app` under **Email → Email Service →
Sending** in the dashboard; because the zone is already in the account, the DNS
records are added for you. Sending needs the Workers Paid plan; 3,000 messages
a month are included, which is a great many sign-in links.

The address messages come from is `MAIL_FROM` in `wrangler.jsonc`.

### Make the API token

**My Profile → API Tokens → Create Token**, with:

| Permission                   | Level |
| ---------------------------- | ----- |
| Account → Workers Scripts    | Edit  |
| Account → D1                 | Edit  |
| Account → Workers R2 Storage | Edit  |
| Account → Account Settings   | Read  |

### Add the repository secrets

Under **Settings → Secrets and variables → Actions → Repository secrets** in
GitHub, not under an environment:

| Secret                  | What it is                                                                |
| ----------------------- | ------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | The token above                                                           |
| `CLOUDFLARE_ACCOUNT_ID` | From any Workers page in the dashboard                                    |
| `CRON_SECRET`           | Any long random string; the app and the cron Worker are both given it     |
| `MAIL_SECRET`           | A long random string (`openssl rand -base64 32`); signs unsubscribe links |

The workflow uses two environments, and a secret set on one is invisible to the
other. The jobs for migrations, logboox.app and the cron Worker run in
`production`; the legacy job runs in `legacy`. All of them need
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, so repository level is the
simple answer: every job reads them. (Environment secrets would work too, but
the two Cloudflare ones would have to be set in both.) `CRON_SECRET` is used by
the production and cron jobs, and `MAIL_SECRET` by the production job only.

Both are deployed with the Workers rather than set in the dashboard, so there is
one place they can drift out of step: this list.

Keep `MAIL_SECRET`. Every mail carries an unsubscribe link signed with it, and
the links never expire; changing it makes every link already sent stop working.
Without it the daily run answers 500 and sends nothing.

### Fill in the placeholders

`pnpm check:deploy` runs at the start of the `migrate` job, before the database
is touched or anything ships. It fails while `wrangler.jsonc` still contains
`REPLACE_WITH_…` (the D1 database id) or a page under `src/routes/legal` still
contains a placeholder such as `[STREET AND NUMBER]`, `[EMAIL]` or `[YOUR STATE
DATA PROTECTION AUTHORITY]`. The imprint and the privacy notice are the owner's
to fill in. The check is not part of CI, where it would fail every pull request
until they are; run it yourself with `pnpm check:deploy`.

## Locally

```bash
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

Wrangler's platform proxy gives `vite dev` the same bindings the deployed
Worker has, backed by a local database and bucket under `.wrangler/state`. In
`vite dev` messages are always printed to the terminal, binding or not, which is
how you follow a sign-in link locally. Unsubscribe links are signed with a fixed
development secret unless `.dev.vars` sets `MAIL_SECRET`.

Anywhere else the printing fallback is gone: if the `EMAIL` binding or
`MAIL_FROM` is missing, sending mail is an error, never a silent print.

To exercise the real email binding and the service worker, build first:

```bash
pnpm build
pnpm preview
```

`send_email` writes an `.eml` file locally and logs its path; nothing leaves
the machine.

To fire the daily run on demand:

```bash
pnpm --dir cron exec wrangler dev --test-scheduled
# then, in another terminal
curl 'http://localhost:8787/__scheduled'
```

## By hand, when the workflow cannot

The scripts are still there, and the order still matters:

```bash
pnpm check:deploy
pnpm db:migrate
pnpm run deploy        # `run` is not optional: `pnpm deploy` is a pnpm builtin
pnpm deploy:cron
pnpm deploy:legacy
```

These ship no secrets. Put them on by hand with `wrangler secret put`:
`CRON_SECRET` and `MAIL_SECRET` on `logboox`, and `CRON_SECRET` on
`logboox-cron` (add `--config cron/wrangler.jsonc` for that one).

## Checking a deploy

- Whether the Worker has a database. `GET /api/v1/me` cannot tell you: it
  answers **401** to a signed-out request before it looks for a database. Ask a
  route that needs one first, with a deliberately malformed address so that no
  mail is sent:

  ```bash
  curl -si -X POST https://logboox.app/api/v1/auth/request \
    -H 'content-type: application/json' -d '{"email":"nobody"}'
  ```

  **503** means no `DB` binding, so it was deployed from a config without one.
  **400** means database and mail are both there. **202** means a database but no
  working mail binding, since a failed send is swallowed on purpose; look for
  `sign-in link failed` in `wrangler tail logboox`. (A well-formed address also
  answers 202 and sends a real sign-in link.)

- The old address still shows the moved notice, and the same request there
  answers **503**: it has no bindings on purpose.
- `wrangler d1 migrations list logboox --remote` reports nothing pending.
- `wrangler tail logboox-cron` the morning after shows one request. It logs a
  line only when the run failed: **500** means `MAIL_SECRET` is not set on the
  app, **502** means every message the run tried to send failed, and **401**
  means `CRON_SECRET` differs between the two Workers.

## Things that have gone wrong before

**`pnpm deploy` does nothing useful.** `deploy` is one of pnpm's own commands,
so it never reaches the script. Use `pnpm run deploy`. Names with a colon, like
`deploy:cron`, are unaffected.

**The apex publishes AAAA before A** right after a custom domain is attached.
It resolves itself within minutes; it is not a misconfiguration.

**The adapter overwrites `main`.** `@sveltejs/adapter-cloudflare` writes its
generated Worker to whatever `main` names in `wrangler.jsonc`, deleting what
was there first. That is why the reminder schedule lives in a second Worker
rather than in a hand-written entry point, and why CI checks that
`.svelte-kit/cloudflare/_worker.js` exists after a build.
