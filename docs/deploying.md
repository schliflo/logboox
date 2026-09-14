# Deploying LogbooX

Merging to `main` deploys. The workflow in
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) runs the same
checks CI runs, applies any pending database migrations, then ships three
Workers in order:

1. **logboox.app** — the app itself.
2. **logboox-cron** — the Worker that asks for reminders once a day.
3. **xpeng-data-export-browser** — the old workers.dev address, which still
   serves the full app with a notice pointing at the new one.

Production is deployed before legacy on purpose. Wrangler attaches a custom
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

```bash
wrangler d1 create logboox
```

Paste the `database_id` it prints into `d1_databases[0].database_id` in
[`wrangler.jsonc`](../wrangler.jsonc) and commit it. The id is not a secret; it
names a database that nothing can reach without the account's own credentials.

```bash
wrangler r2 bucket create logboox-exports
```

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

Under **Settings → Environments → production** in GitHub:

| Secret                  | What it is                                        |
| ----------------------- | ------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | The token above                                   |
| `CLOUDFLARE_ACCOUNT_ID` | From any Workers page in the dashboard            |
| `CRON_SECRET`           | Any long random string; both Workers are given it |

`CRON_SECRET` is deployed with the Workers rather than set in the dashboard, so
there is one place it can drift out of step: this list.

## Locally

```bash
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

Wrangler's platform proxy gives `vite dev` the same bindings the deployed
Worker has, backed by a local database and bucket under `.wrangler/state`. With
no `EMAIL` binding in that mode, messages are printed to the terminal — which
is how you follow a sign-in link locally.

To exercise the real email binding and the service worker, build first:

```bash
pnpm build
pnpm preview
```

`send_email` writes an `.eml` file locally and logs its path; nothing leaves
the machine.

To fire the reminder schedule on demand:

```bash
pnpm --dir cron exec wrangler dev --test-scheduled
# then, in another terminal
curl 'http://localhost:8787/__scheduled'
```

## By hand, when the workflow cannot

The scripts are still there, and the order still matters:

```bash
pnpm db:migrate
pnpm run deploy        # `run` is not optional: `pnpm deploy` is a pnpm builtin
pnpm deploy:cron
pnpm deploy:legacy
```

## Checking a deploy

- `https://logboox.app/api/v1/me` answers **401** when signed out. A 503 means
  the Worker has no `DB` binding, which means it was deployed from a config
  without one.
- The old address still shows the moved notice, and its `/api/v1/me` answers
  **503** — it has no bindings on purpose.
- `wrangler d1 migrations list logboox --remote` reports nothing pending.
- `wrangler tail logboox-cron` the morning after shows one request.

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
