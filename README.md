# LogbooX

An interactive reader for the vehicle data XPeng gives you under the EU Data
Act. Drop in the export, and it becomes trips, charging sessions, battery
behaviour, driving style, and a plain account of what the file reveals about
your daily life. It runs at [logboox.app](https://logboox.app), and used to be
called XPeng Data Export Browser.

Everything runs in the browser. The export is parsed by a worker inside the
page, kept on your own device so it can be reopened later, and several exports
can be read as one continuous record.

Signing in is optional and changes none of that. An account holds a copy of an
export so it outlives the browser, reminds you before the thirty-day window
closes, serves your own data over an API, and can publish a single trip at a
link. Everything the app does without one, it still does without one.

## What it looks like

All screenshots use the built-in demonstration month, so no real vehicle
appears in them.

![The landing page: a drop zone, and the promise that nothing is uploaded](docs/screenshots/landing.png)

The export never leaves the page. Drop the files in, or explore a generated
demonstration month first.

![One card from the opening sequence: longest single trip, 192 km](docs/screenshots/wrapped.png)

Parsing ends in a full-screen sequence of the month's findings, one per screen —
the things you would not have thought to ask for.

![The overview: distance per day, and driving by weekday and hour](docs/screenshots/overview.png)

Then the dashboard. Every chart names the point under the pointer; here the
punchcard is reporting an hour the car never once moved in.

![A single trip, with speed, power and charge sharing one cursor](docs/screenshots/trip.png)

A trip second by second. Hovering any panel reads out that instant in all of
them, so one moment can be read across speed, power and state of charge at once.

![Driving style: a g-g diagram beside speed and pedal histograms](docs/screenshots/driving.png)

Every second of driving placed by the forces on the car. Cautious driving fills
a narrow cross; the outer rings are where grip runs out.

![What this file knows about you: no location records, VIN on every row](docs/screenshots/privacy.png)

And a plain account of what the file gives away — none of which needed a single
map coordinate.

## Getting your data

Request it from [xpeng.com/data-act](https://www.xpeng.com/data-act). You
receive CSV files named like:

```
DA<request-id>_dwd_opp_gdpr_veh_driving_status_di.csv
DA<request-id>_dwd_opp_gdpr_veh_driving_operation_di.csv
DA<request-id>_dwd_opp_gdpr_veh_driving_power_energy_di.csv
```

Each stream is capped at a million rows, so anything longer spills into
`_part1`, `_part2` and so on — note that the file _without_ a suffix is the
earliest one. Drop the whole set in, or the ZIP as downloaded.

The export covers a rolling thirty days at one sample per second while the car
is awake, which comes to roughly 340 MB and 3.6 million rows.

## Running it

```sh
pnpm install
pnpm dev          # http://localhost:5173
```

Without an export of your own, click **Explore a demonstration month** — a full
synthetic month is generated in the browser, with commutes, a weekend trip and
a rapid-charging stop.

```sh
pnpm test         # unit tests
pnpm check        # types
pnpm build        # production build
```

## Signing in, or not

There is no account until you ask for one, and nothing about reading an export
changes when you have one. What it adds:

- **Exports that outlive this browser.** A copy in the account, restored to any
  browser you sign in on. Browser storage is cleared by accident; Safari
  discards it after a week away.
- **A reminder before the window closes.** XPeng hands out a rolling thirty
  days on request, and a month nobody asked for cannot be recovered later. The
  reminder counts from where your newest export stops, not from when you
  imported it.
- **An API over your own data**, with tokens you make and revoke yourself — see
  [docs/api.md](docs/api.md), which includes a Home Assistant example.
- **A link to one trip or charging session**, or a whole export. Shares carry
  the model of the car and never its identification number, and revoking one
  takes effect immediately.

Signing in is by e-mail alone: a link, good once, for fifteen minutes. There is
no password to lose. Deleting the account removes every byte it holds and
leaves what is in this browser alone.

## Comments and a Fahrtenbuch

The export contains no location data whatsoever, so where a journey went is the
one thing only the driver knows. Each trip takes an origin, a destination, a
purpose and a comment, and the whole month downloads as a CSV a tax office
would recognise.

This works signed out; an account only carries the notes to the next device.

Typing a place twice should be the last time. If the previous trip ended at
41 207 km and this one starts there, the car has not moved, so where that trip
ended is offered as where this one begins. Beyond that, suggestions come from
trips already labelled: the same distance, the same hour, the same sort of day,
and the reverse of a known journey.

## Keeping exports

Every export you open is kept in this browser, in IndexedDB, as the parsed
columns rather than the original CSV: gzipped one signal at a time, which comes
to five to fifteen megabytes for a month that arrived as 340 MB of text. The
start page lists what is kept and reopens any of it in a second or two, with
the analysis recomputed rather than stored.

Nothing is uploaded — there is nowhere to upload it to. Removing an export is
one click, and the browser's own site-data controls clear everything at once.

XPeng only ever gives you a rolling thirty days, so the point of keeping them
is putting them together. Selecting several exports from the same car opens
them as a single timeline: the timestamps are merged, the newer export wins
wherever two of them describe the same second, and the stretches no export
covers are marked as unrecorded rather than counted as days the car stood
still.

Browser storage is not a safe place for the only copy — it can be cleared, and
Safari discards it after a week without a visit. **Back up** writes everything
kept as one ZIP: a manifest, and per export the record and its compressed
buffers. Dropping that ZIP back on the start page restores it, in this browser
or any other.

## Working offline

After the first visit the app opens without a connection. A service worker
stores the app's own files — scripts, styles, fonts, icons and pages, about
1.5 MB in all — when it installs, and serves them from that store from then
on. That store holds the app and nothing else; kept exports live in the
browser's database beside it, so an export opens without a connection too. The
browser's menu can also install it as an app, which opens it in a window of its
own.

A new deployment installs quietly in the background and waits. The page then
offers a reload, and nothing happens until you take it: a page that restarted
on its own would clear the export on screen mid-read.

Trying it needs a production build, since the dev server serves everything
live:

```sh
pnpm build
pnpm preview      # http://localhost:4173
```

Open it once, then stop the server — or set the browser's network panel to
offline — and reload.

## Deploying to Cloudflare Workers

Merging to `main` deploys, through
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): checks, then
database migrations, then logboox.app, the reminder Worker, and the old
address, in that order. **[docs/deploying.md](docs/deploying.md)** covers the
one-time setup — the database, the bucket, the sender domain, the API token —
and the manual commands for when the workflow cannot run.

Almost every route is still prerendered, and the app still reads an export
without a server. What the Worker adds is the account API under `/api`, the
reminder trigger under `/internal`, and the shared pages under `/s` — the only
route rendered per request, because a link preview is built by a scraper that
runs no JavaScript.

The app answers on logboox.app alone. `workers_dev` is off, because a second
address would be a second origin, keeping its own copy of every export and its
own service worker with no way for the two to meet — the whole reason the old
address below is handled the way it is. For the same reason `www` is a redirect
rule in the dashboard rather than a second custom domain.

The pages name themselves from `PUBLIC_SITE_URL`: the canonical link, `og:url`,
the absolute social-image URL and the `Sitemap:` line in `robots.txt`. The
value is read twice — by the prerender, from `.env.production`, and by the
client on start, from the Worker's `vars` — so it is set in both places, and
the two must agree. Without it those tags are simply left out and the social
image is referenced by path, which every major link-preview scraper resolves
against the page it found it on, so a build without it still works.

### The old address

The app first shipped at `xpeng-data-export-browser.schliflo.workers.dev`.
Exports are kept per origin, so anything kept there is invisible from
logboox.app — and a redirect would never reach anyone who installed the app,
because the service worker serves pages from its own store and refuses a
redirect when it checks for updates. So the old Worker keeps serving the full
app, with a notice that points at the new address and offers a backup of
everything kept:

```sh
pnpm deploy:legacy
```

That builds with `PUBLIC_MOVED_TO` set and deploys to the `legacy` environment
in `wrangler.jsonc`, which carries the old Worker's name. Deploy the new
address first, then the old one.

## What the app works out for itself

Nothing in the export is labelled: there are no trips, no charging sessions and
no summary of any kind, only raw signals. These are derived:

- **Trips** — from gear position and odometer movement, ending once the car has
  been parked a while, so a wait at a traffic light does not split a journey.
- **Charging sessions** — from the plug's power signal, joined across the naps
  the car takes mid-charge. Regeneration never appears there, so charging and
  braking are never confused.
- **Energy** — integrated from pack voltage and current, which separates energy
  drawn from energy recovered.
- **Charge limit and charging schedule** — from where charging repeatedly stops
  of its own accord, and when it repeatedly starts. Both are reported only when
  the evidence is there; a car that charges to full has no limit to report.
- **Standby drain** — from charge lost across long parked periods.
- **Real full-charge range** — from the car's own prediction, extrapolated.

## Notes on the data

A few things about the format are worth knowing, and the app handles all of
them:

- Every file begins with a byte-order mark, and every row repeats the VIN.
- Rows carry a date column alongside the timestamp, but it is cut at midnight
  in Beijing — early evening in central Europe. Grouping by it would put an
  evening drive on the next day, so it is ignored and days come from the
  timestamps in your own timezone.
- Signals use unscaled "not available" codes rather than blanks: speed reports
  255, range 1638.3, battery temperature 215. Left in, they wreck every chart.
- A few thousand rows per file arrive twice, and at least one real export has a
  block of an earlier day written after a later one. Rows are sorted and
  de-duplicated before anything is measured.
- Several columns exist in every row and are never filled — window positions
  and the tailgate on this model, the front motor on a rear-drive car. They are
  detected and hidden rather than drawn as empty charts.
- There is no location data anywhere in the export.

## Layout

```
src/lib/data/
  schema/      column registry — units, sentinels, storage type, labels
  parse/       streaming CSV reader, ZIP, ordering, alignment, merging
  store/       columnar storage and the min/max pyramid the charts read
  analytics/   trips, charging, battery, driving style, doors, facts
  worker/      the worker, its protocol, and account transfers
src/lib/history/             kept exports: storage, compression, backup archive
src/lib/logbook/             notes on trips: binding, suggestions, CSV
src/lib/share/               slicing one trip out of a month, and back
src/lib/server/              accounts: auth, exports, shares, reminders, mail
src/hooks.server.ts          who is asking, and whether they may ask this way
migrations/                  the account database, in order
cron/                        the Worker that asks for reminders once a day
src/lib/demo/  synthetic month generator
src/lib/offline/             what the service worker keeps, and how it finds it
src/service-worker.ts        the service worker itself
src/lib/components/charts/   uPlot wrapper, calendar, punchcard, g-g diagram
src/routes/    landing, the opening sequence, the dashboard, the account
src/routes/api/v1/           the account API; docs/api.md describes it
src/routes/s/                public share pages, the one route rendered per request
src/lib/seo.ts               site metadata, shared by every page
static/                      icons, the social card, the manifest
design/og-card.html          source for the social card; render it at 1200x630
```

The column registry is the piece to edit first: adding a signal there gives it
units, sentinel handling, storage and a place in the explorer. Signals the
registry does not know about are still parsed and still plottable.

## Testing

`pnpm test` covers the parser (byte-order marks, chunk boundaries, duplicates,
part ordering, sentinels), the analytics against hand-built cases with known
answers, the demo generator against the ground truth it was built from, what
the service worker decides to keep, and the storage layer end to end — the
compression round trip, merging exports that overlap, the backup archive, and
the database itself against `fake-indexeddb`.

The server is covered the same way, against real SQL rather than a mock: the
migrations that ship are applied to Node's own SQLite, and the sign-in flow,
the export and quota rules, the reminder conditions and the share slices run
against that. What is worth reading there is the logbook suite — a note has to
stay attached to its trip when merging two exports moves the trip's boundaries,
and must never attach to the wrong one.

If a `.samples/` directory is present it is also checked against a real export
end to end; that directory is git-ignored, because a real export identifies a
real vehicle.

## Licence

MIT — see [LICENSE](LICENSE). Not affiliated with, or endorsed by, XPeng.
