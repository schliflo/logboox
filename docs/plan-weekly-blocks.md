# Plan: one timeline per car, stored as weekly blocks

Status: phases 1 and 2 built (blocks, auto-import, uploads merged synchronously,
"Update now"); phases 3 and 4 open.

## Goal

An account holds one continuous timeline per car instead of a pile of
overlapping exports. Everything that writes data (auto-import, an upload)
merges into it, and the user exports or shares a time range they choose.

## Core idea

A **block** is one car's samples for one week, stored exactly as an export is
today: an `ExportRecord` plus one gzipped buffer per column, in R2, with a row
in `exports`. So the codec, R2 layout, quota, browser store, backup format,
merge and dashboard all keep working unchanged. What changes is who decides
the boundaries:

- **Boundaries are fixed:** Monday 00:00 UTC. A drive across it is split in
  the account's trip list (rare: 01:00–02:00 in Berlin); the dashboard merges
  blocks back together, so it shows it whole.
- **One block per car and week.** New data for a week is merged into its block
  (`mergeSources`, newer wins), stored under a new id, and the old block is
  deleted. Blocks are still immutable once written; a rewrite is a replacement.
- **Id:** `wk-{weekStart}-{vinTag}-{version}`. No VIN in ids; a random
  version makes each rewrite unique, so browser caches and the sync logic
  never see a changed block under an old id.
- **One writer at a time:** the hourly run, an upload's completion and
  "Update now" each take the account's `timeline_locks` row first, so two
  writers can never race on the same week.

Size: a week is ~1.5–4 MB compressed, ~100 objects. Rewriting the current week
daily is ~3,000 R2 writes per car per month (negligible).

## What gets simpler

The auto-import loses most of its special cases:

- no `xp-` slices, no `mergeClosedWeeks`, no `sliceEnd`/`PARKED` hold-back:
  each day's ZIP is merged into its weeks, and a drive still running at the end
  of a ZIP is completed by the next day's (trips upsert by `vin, start_time`);
- `imported_to` stays only to skip re-reading old days of a ZIP;
- the browser's `pullAutomatic` becomes the general "pull new blocks, drop
  replaced ones" step it already almost is.

## Phases

Each phase ships on its own.

**1. Block store + auto-import on blocks** (this branch)

- `src/lib/server/timeline/blocks.ts`: `weekCuts(time)`,
  `mergeIntoBlocks(db, storage, userId, dataset, timeZone)`, tests.
- `import.ts` calls it per 4-day window; delete slices, weekly merge, hold-back.
- Browser: pull new `wk-` blocks, drop replaced ones (existing logic, new prefix).

**2. Uploads go into the timeline** (this branch)

- "Keep in account" uploads as today; `complete` marks the export `fold = 1`
  and merges it into blocks in the same request, then removes it and notes it
  in `folded_exports`. If the timeline is busy, the next hourly run does it.
- The browser pulls the new blocks and drops its local copy
  (`history.adoptTimeline`).
- "Update now" (account page) runs the XPeng fetch and import for one owner
  in the import Worker over a service binding, rate-limited.
- Signed out: unchanged, exports stay per file in the browser.

**3. Existing accounts** (same PR as 2)

- One-off: the import Worker marks every complete, non-demo export `pending`, so
  phase 2 folds them in, account by account, within its time budget.
- Whole-export shares are first turned into copies (phase 4) so they survive.

**4. Range export and share** (third PR)

- Library: one row per car (covered span, gaps), blocks behind "details".
- Opening loads the blocks overlapping the chosen range instead of "newest
  exports up to `RECORD_BUDGET`"; picking a range outside what is loaded loads
  those blocks.
- **Download range:** the blocks overlapping it, restricted to the range, as one
  export in the existing backup ZIP (lossless, opens anywhere here).
- **Share range:** a copy under the share's prefix, like trip shares, capped at
  31 days, so later block rewrites never break a link. Replaces `kind: 'export'`.
- Public API: `GET /api/v1/exports` lists blocks; add `?vin&from&to`.

## Risks and limits

- A car awake across the whole Monday (no sleep gap for a day) gets cut at the
  latest candidate; one drive split, as today's shortcut.
- Memory per rewrite: one week block + one window of new rows. Below the 42 MB
  measured for a 4-day parse, but to be measured in workerd.
- Phase 2 delays an upload's arrival in the account by up to an hour.
- Weeks are UTC weeks; the boundary is invisible to the user apart from block
  details.

## Open questions

1. Range download format: backup ZIP (proposed) or XPeng-style CSVs?
2. Signed-out users keep per-file exports (proposed), or block locally too?
3. Ship order: phase 1 in this PR, 2–4 after (proposed)?
