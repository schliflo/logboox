-- Community leaderboards, and the names people appear under.
--
-- Nothing here is published by existing. A candidate is the app noticing that
-- one of your trips would rank; an entry is you having said yes to that. The
-- two are separate tables for exactly that reason — one is private to the
-- account it belongs to, the other is the public table.
--
-- Times are Unix epoch seconds, as everywhere else. A month is `YYYY-MM` in
-- the driver's own zone, which is why it is stored rather than derived here:
-- SQLite would compute it in UTC and put a late-evening drive in the wrong one.

-- A visible name, chosen only when someone first claims a place. Unique
-- without regard to case, so two people cannot appear as the same name in
-- different clothes, but displayed exactly as it was typed.
ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN username_changed_at INTEGER;

-- Being told when a trip would rank. Separate from the export reminder in
-- every respect: its own switch, its own timestamp, its own unsubscribe token,
-- so turning one off never silently turns off the other.
ALTER TABLE users ADD COLUMN board_notify INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN board_mailed_at INTEGER;
ALTER TABLE users ADD COLUMN board_unsubscribe_token_hash TEXT;
ALTER TABLE users ADD COLUMN roundup_mailed_year INTEGER;

-- The zone the car was driven in, sent with the upload. Without it there is no
-- way to say which month a drive belongs to.
ALTER TABLE exports ADD COLUMN time_zone TEXT;

CREATE UNIQUE INDEX users_username ON users (username COLLATE NOCASE) WHERE username IS NOT NULL;

-- Somewhere a place is being held for you, until you say yes or no to it.
--
-- One per board per month per account: only your best is worth telling you
-- about, and being told seven times about seven trips to the same board would
-- be a good way to make someone turn the whole thing off.
CREATE TABLE board_candidates (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	board TEXT NOT NULL,
	month TEXT NOT NULL,
	-- Worked out when the candidate is found, so every later decision about it
	-- is a comparison rather than a recalculation in some other zone.
	locks_at INTEGER NOT NULL,
	kind TEXT NOT NULL,
	vin TEXT NOT NULL,
	start_time INTEGER NOT NULL,
	value REAL NOT NULL,
	-- The value turned so larger always wins, so one index serves every board.
	score REAL NOT NULL,
	detail_json TEXT NOT NULL,
	vmodel TEXT NOT NULL,
	rank_at_detection INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	-- Seen in the app, mailed about, turned down, or accepted.
	seen_at INTEGER,
	mailed_at INTEGER,
	dismissed_at INTEGER,
	entry_id TEXT,
	UNIQUE (user_id, board, month)
);

CREATE INDEX board_candidates_pending ON board_candidates (user_id, entry_id, dismissed_at);
CREATE INDEX board_candidates_mail ON board_candidates (mailed_at, seen_at, created_at);

-- The public table. Claimed deliberately, removable at any time — including
-- after the month has locked, because withdrawing something you published has
-- to keep working when nothing else about the month does.
CREATE TABLE board_entries (
	id TEXT PRIMARY KEY,
	board TEXT NOT NULL,
	month TEXT NOT NULL,
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	kind TEXT NOT NULL,
	-- Kept so the owner can see which of their trips this was, and never
	-- returned by anything public.
	vin TEXT NOT NULL,
	start_time INTEGER NOT NULL,
	value REAL NOT NULL,
	score REAL NOT NULL,
	detail_json TEXT NOT NULL,
	vmodel TEXT NOT NULL,
	-- An optional public share, so a row can link to the curve behind it.
	share_id TEXT,
	claimed_at INTEGER NOT NULL,
	removed_at INTEGER,
	UNIQUE (board, month, user_id)
);

CREATE INDEX board_entries_rank ON board_entries (board, month, removed_at, score);
CREATE INDEX board_entries_user ON board_entries (user_id, claimed_at);
