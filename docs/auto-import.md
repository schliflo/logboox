# Automatic import from XPeng

LogbooX fetches an owner's Data Act export from XPeng every day and adds the
new rows to their account, so the record grows into one continuous history
without anyone opening the app. It uses the XPeng Open Platform: the owner
authorises LogbooX in XPeng's Data Center, and LogbooX calls XPeng on their
behalf. API details and how the credentials were obtained:
[xpeng-open-platform.md](xpeng-open-platform.md).

## How it works

The account holds one timeline per car, stored as weekly blocks (ordinary
exports with ids `wk-{week}-{vin tag}-{version}`, Monday to Monday UTC). Any
new data is merged into the blocks it reaches and each merged block replaces
the old one. Design: [plan-weekly-blocks.md](plan-weekly-blocks.md).

```
import Worker (import/), :45 every hour
  ├─ fetch: for each owner who is due, POST open.xpeng.com/open/oauth2/queryData
  │    ├─ DataFileExporting → ask again next hour (free)
  │    └─ download URL      → stream ZIP into R2 (users/{id}/xpeng/…)
  ├─ uploads the app could not merge at once → merged into blocks
  └─ each fetched ZIP
       ├─ read the CSVs straight out of the ZIP in R2 (range reads)
       ├─ parse rows from `imported_to` less a day, in 4-day slices
       ├─ merge each slice into its weekly blocks
       └─ delete the ZIP
"Update now" on the account page → app → import Worker (service binding)
  └─ the same fetch and import for one owner, at once; the app asks again
     every 15 s while XPeng builds the file
upload from the browser → complete → merged into blocks in the same request
browser, on start and after an upload
  └─ pulls new blocks, drops replaced ones and uploads that were merged
```

Parsing, analysis and storage are the browser's own code
(`src/lib/data/…`, `src/lib/history/codec.ts`), so a block is an ordinary
export: trips, charging sessions and leaderboard places work the same.

- **Daily.** Each fetch holds thirty days; only rows from `imported_to` less a
  day are read, and merging them twice is harmless (newer wins).
- **No hold-back.** A drive still running when the export ends is completed
  when the next day's export is merged over it.
- **One writer per account** (`timeline_locks`): the hourly run, an upload and
  "Update now" never rewrite the same week at once. A busy upload is left for
  the next hourly run.
- **Budget**, real month: an upload merge takes ~4 s CPU and ~60 MB at peak
  (measured in Node); the XPeng import ~25 s for a first thirty days in workerd,
  a few seconds daily. Worker limit 128 MB. The import Worker allows 5 min CPU
  per request (`limits.cpu_ms`) for "Update now".

| Behaviour                    | Value                                                    |
| ---------------------------- | -------------------------------------------------------- |
| Fetch cadence                | daily (`FETCH_EVERY_DAYS`); first within the hour        |
| "Update now"                 | a new XPeng export at most every 6 h (`MANUAL_EVERY`)    |
| Polling a running export     | at most every 10 s (`POLL_EVERY`); free at XPeng         |
| New XPeng submissions        | at most one per owner per run; XPeng allows 5 a day      |
| Fetched, not yet imported    | at most 3 per owner, then fetching pauses                |
| Import of one ZIP fails      | retried next run, deleted after 3 tries (`MAX_ATTEMPTS`) |
| Owner token rejected         | stops until new credentials are entered                  |
| XPeng failed / limit reached | retried the next day                                     |
| Other errors                 | retried within the hour                                  |

Code: `import/index.ts` (the Worker), `src/lib/server/timeline/blocks.ts`
(weekly blocks, lock), `src/lib/server/xpeng/fetch.ts`, `import.ts`,
`update.ts` and `zip.ts`, `src/lib/state/history.svelte.ts`
(`adoptTimeline`), `src/lib/state/xpeng.ts` and
`src/lib/components/app/XpengImport.svelte` (account page),
`src/lib/xpeng-open/` (signing and the API call).

Known limits:

- One car per account for the import cursor, as one XPeng authorisation is per
  owner.
- Weeks are UTC weeks. A drive across Monday 00:00 UTC (01:00–02:00 in
  Berlin) is split in the account's trip list, not on the dashboard.
- Rewriting a block revokes a share of that whole block; shares of trips are
  unaffected. Range shares come with phase 4 of the plan.
- Exports uploaded before blocks stay as they are (phase 3 of the plan).
- ZIP64 archives are not read (an export would have to exceed 4 GB).

## Setting it up (operator)

You need the `appId` and `appSecret` XPeng mailed to the enterprise contact
address.

1. **Try the credentials from a terminal.** Copy `.env.example` to `.env`, fill
   in both halves (yours, and an owner's — your own car is fine), and run:

   ```bash
   pnpm xpeng:query
   ```

   `XPENG_OPEN_ENV=prod` is the default (LogbooX's credentials are production
   ones; UAT answers `12061001 Invalid appId`). The script writes the ZIP to
   `.samples/`. Drop it on `pnpm dev` to confirm it parses. Exit code 6 means
   XPeng refused the appId or signature.

2. **Add the secrets** to GitHub under Settings → Secrets and variables →
   Actions → Repository secrets: `XPENG_APP_ID` and `XPENG_APP_SECRET`. The
   deploy workflow puts them on the `logboox-import` Worker. By hand instead:

   ```bash
   pnpm exec wrangler secret put XPENG_APP_ID --config import/wrangler.jsonc
   ```

   ```bash
   pnpm exec wrangler secret put XPENG_APP_SECRET --config import/wrangler.jsonc
   ```

3. **Deploy.** Merging to `main` runs the migration (`0004_xpeng_import.sql`),
   the app and the import Worker. By hand: `pnpm db:migrate`, `pnpm run deploy`,
   `pnpm deploy:import`.

4. **Check it.** The Automatic import card is on the account page while the
   app's `XPENG_IMPORT` var is `"1"` (`wrangler.jsonc`). After an owner
   connects:

   ```bash
   pnpm exec wrangler tail logboox-import
   ```

   "Update now" shows on the card once the app's `IMPORT` service binding
   reaches the import Worker, which is deployed first for that reason.

   Each run logs one JSON line with the fetch and import counts. Wrong
   appId/appSecret show as `xpeng refused LogbooX's own credentials`.

**Locally:** copy `import/.dev.vars.example` to `import/.dev.vars`, fill it in,
then:

```bash
pnpm exec wrangler dev --config import/wrangler.jsonc --test-scheduled
```

and fire a run with `curl http://localhost:8787/__scheduled`. It uses local D1
and R2; connect an owner through `pnpm dev` first, or insert a row into
`xpeng_links` with `wrangler d1 execute --local`.

To switch the feature off, set `XPENG_IMPORT` to `""` (hides the card) and
stop deploying the import Worker.

## Using it (owner)

1. **Authorise LogbooX at XPeng.** Sign in at
   [xpeng.com/data-act/my-data](https://www.xpeng.com/data-act/my-data) with
   the XPeng account your car is linked to, open the third-party data
   authorisation, and enter exactly:

   | Field                            | Value                    |
   | -------------------------------- | ------------------------ |
   | Integrating enterprise name      | `LogbooX`                |
   | Third-party application name     | `logboox.app`            |
   | Integration owner contact e-mail | `xpeng-data@logboox.app` |

   Select every data category. XPeng compares these byte for byte, so mind
   the capital L and X.

2. **Wait for XPeng's e-mail.** It contains four values: `openId`,
   `accessToken`, `enterpriseName` and `scopeCode`.

3. **Enter them in LogbooX.** Sign in at [logboox.app](https://logboox.app),
   open **Account → Automatic import from XPeng → Connect**, and paste the
   values. The enterprise name is prefilled with `LogbooX`; change it only if
   you typed something else in step 1.

4. **That's it.** The first export is fetched and imported within the hour,
   then every day. **Update now** fetches today's at once (at most every six
   hours; XPeng takes a few minutes to prepare the file). Your account keeps
   one continuous history; any browser you sign in on picks up the new days
   by itself. The account page shows the
   last and next fetch and how far the import has got.

The first import starts where your newest export in the account ends, or
thirty days back if there is none.

The access token cannot be read back from LogbooX, only replaced. **Disconnect**
on the account page deletes it and any export fetched but not imported yet;
withdrawing the authorisation in the XPeng Data Center stops it at the source. Deleting the account deletes the credentials,
any fetched files and the imported exports.

### When the account page shows a problem

| Message                                     | What to do                                                          |
| ------------------------------------------- | ------------------------------------------------------------------- |
| No longer accepts this access token         | Authorise again in the Data Center, then **Enter new credentials**. |
| No authorisation for these credentials      | Check the four values and the enterprise name; otherwise as above.  |
| This account is full                        | Delete old exports, or ask the operator for more room.              |
| Could not import / fetched exports waiting  | Nothing; it retries. If it stays, tell the operator.                |
| Limit of five exports a day / could not gen | Nothing; it retries tomorrow.                                       |
| Refused LogbooX's own credentials           | Nothing; the operator has to fix the server's appId/appSecret.      |

The export reminder mail keeps working alongside, so a stalled import is still
noticed before the window closes.
