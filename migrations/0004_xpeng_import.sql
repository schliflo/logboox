-- One timeline per car, and automatic import from XPeng into it.
-- See docs/auto-import.md and docs/plan-weekly-blocks.md.
--
-- The timeline is stored as weekly blocks: ordinary exports with ids
-- `wk-{week}-{vin tag}-{version}`, one per car and Monday-to-Monday UTC week.
-- New data (an upload, or the ZIP XPeng generates daily) is merged into the
-- blocks it touches; each merged block replaces the one before it.

-- The owner half of the Open Platform credentials, as XPeng mailed them to the
-- owner. The accessToken is useless without our appSecret, which only the
-- Worker holds.
CREATE TABLE xpeng_links (
	user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
	open_id TEXT NOT NULL,
	access_token TEXT NOT NULL,
	scope_code TEXT NOT NULL,
	-- Byte for byte what the owner typed in the Data Center.
	enterprise_name TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	-- 'waiting' for next_at, 'exporting' while XPeng builds the file,
	-- 'reauth' once XPeng rejects the owner's token: nothing more until it is
	-- replaced.
	state TEXT NOT NULL DEFAULT 'waiting',
	next_at INTEGER,
	fetched_at INTEGER,
	-- What went wrong last, as a code the account page explains.
	message TEXT,
	-- The owner's zone, for which day a drive belongs to. From their browser.
	time_zone TEXT,
	-- Everything before this (epoch seconds) is already in the account.
	imported_to INTEGER,
	-- When a new XPeng export was last asked for, for the manual update's limit.
	submitted_at INTEGER,
	-- When XPeng was last asked anything, so polling cannot hammer it.
	checked_at INTEGER
);
CREATE INDEX xpeng_links_due ON xpeng_links (next_at);

-- Fetched ZIPs not parsed yet. Normally gone within the same run.
CREATE TABLE xpeng_downloads (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	r2_key TEXT NOT NULL,
	bytes INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	-- Failed imports; given up on after a few, so a bad file cannot loop.
	attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX xpeng_downloads_user ON xpeng_downloads (user_id, created_at);

-- An upload not yet merged into the timeline. Normally merged within the
-- request that completes it; the import Worker sweeps up the rest.
ALTER TABLE exports ADD COLUMN fold INTEGER NOT NULL DEFAULT 0;
CREATE INDEX exports_fold ON exports (fold) WHERE fold = 1;

-- Uploads that were merged into the timeline and then removed, so a browser
-- that still holds one knows it is in the account and does not send it again.
CREATE TABLE folded_exports (
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	id TEXT NOT NULL,
	folded_at INTEGER NOT NULL,
	PRIMARY KEY (user_id, id)
);

-- One writer per account's timeline at a time: the hourly run, an upload and
-- a manual update could otherwise rewrite the same week from stale copies.
CREATE TABLE timeline_locks (
	user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
	holder TEXT NOT NULL,
	until INTEGER NOT NULL
);
