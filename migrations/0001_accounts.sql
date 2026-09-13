-- Accounts, and everything an account may keep.
--
-- All of this is optional: the app reads an export, keeps it in the browser
-- and never touches these tables unless someone signs in. Times are Unix epoch
-- seconds throughout, except `exports.record_json`, which holds the record
-- exactly as the browser wrote it and therefore keeps its own milliseconds.

CREATE TABLE users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL,
	last_seen_at INTEGER NOT NULL,
	-- Reminders to request the next export. XPeng only ever holds a rolling
	-- thirty days, so a missed month is gone for good.
	reminder_enabled INTEGER NOT NULL DEFAULT 1,
	reminder_after_days INTEGER NOT NULL DEFAULT 25,
	reminded_at INTEGER,
	-- Whether a freshly imported export is copied to the account by itself.
	auto_sync INTEGER NOT NULL DEFAULT 1,
	unsubscribe_token_hash TEXT NOT NULL
);

-- Sign-in links. Single use, short lived, and only ever stored hashed, so a
-- copy of this table is not a set of working keys.
CREATE TABLE magic_links (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	consumed_at INTEGER,
	ip TEXT
);
CREATE INDEX magic_links_email ON magic_links (email, created_at);
CREATE INDEX magic_links_ip ON magic_links (ip, created_at);

CREATE TABLE sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	last_used_at INTEGER NOT NULL,
	user_agent TEXT
);
CREATE INDEX sessions_user ON sessions (user_id);

-- Long-lived tokens the user creates for themselves, for Home Assistant and
-- anything else that reads their data. Shown once, kept hashed.
CREATE TABLE api_tokens (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	-- The last few characters, so a token can be told apart in the list.
	hint TEXT NOT NULL,
	scopes TEXT NOT NULL DEFAULT 'read',
	created_at INTEGER NOT NULL,
	last_used_at INTEGER,
	revoked_at INTEGER
);
CREATE INDEX api_tokens_user ON api_tokens (user_id);

-- One row per export kept in the account. The scalar columns are what the
-- library lists, so listing never parses the record.
CREATE TABLE exports (
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	id TEXT NOT NULL,
	vin TEXT NOT NULL,
	vmodel TEXT NOT NULL,
	version INTEGER NOT NULL,
	start_time INTEGER NOT NULL,
	end_time INTEGER NOT NULL,
	rows INTEGER NOT NULL,
	days INTEGER NOT NULL,
	distance_km REAL NOT NULL,
	trips INTEGER NOT NULL,
	stored_bytes INTEGER NOT NULL,
	is_demo INTEGER NOT NULL DEFAULT 0,
	record_json TEXT NOT NULL,
	uploaded_at INTEGER NOT NULL,
	-- Set once every buffer named by the record is in the bucket. An upload
	-- interrupted halfway leaves this at 0 and is swept up later.
	complete INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (user_id, id)
);
CREATE INDEX exports_vin ON exports (user_id, vin, start_time);

-- Derived summaries, computed in the browser at import time and uploaded with
-- the export. The Worker could not recompute them: a month is hundreds of
-- megabytes once inflated, and analysis already runs in the data worker.
CREATE TABLE trips (
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	vin TEXT NOT NULL,
	start_time INTEGER NOT NULL,
	end_time INTEGER NOT NULL,
	export_id TEXT NOT NULL,
	odo_start INTEGER,
	odo_end INTEGER,
	distance_km REAL,
	summary_json TEXT NOT NULL,
	PRIMARY KEY (user_id, vin, start_time)
);

CREATE TABLE charging_sessions (
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	vin TEXT NOT NULL,
	start_time INTEGER NOT NULL,
	end_time INTEGER NOT NULL,
	export_id TEXT NOT NULL,
	odometer INTEGER,
	summary_json TEXT NOT NULL,
	PRIMARY KEY (user_id, vin, start_time)
);

-- The latest the account knows about each car: what an integration polls for.
CREATE TABLE vehicles (
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	vin TEXT NOT NULL,
	vmodel TEXT NOT NULL,
	last_sample_time INTEGER,
	odometer_km INTEGER,
	soc REAL,
	range_km REAL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (user_id, vin)
);

-- Comments and logbook entries. Written locally first and synced up, so they
-- work without an account; last writer wins, and a delete is a tombstone so it
-- can travel to the other devices too.
CREATE TABLE annotations (
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	vin TEXT NOT NULL,
	start_time INTEGER NOT NULL,
	odo_start INTEGER,
	comment TEXT,
	origin TEXT,
	destination TEXT,
	purpose TEXT,
	updated_at INTEGER NOT NULL,
	deleted_at INTEGER,
	PRIMARY KEY (user_id, vin, start_time)
);

-- A trip, a charging session or a whole export, made readable by anyone with
-- the link. The VIN is deliberately absent: a share carries the model and
-- nothing that identifies the car or its owner.
CREATE TABLE shares (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	kind TEXT NOT NULL,
	vmodel TEXT NOT NULL,
	title TEXT,
	description TEXT,
	start_time INTEGER NOT NULL,
	end_time INTEGER NOT NULL,
	time_zone TEXT NOT NULL,
	-- Set for a whole-export share, which reads the owner's own objects rather
	-- than a copy.
	export_id TEXT,
	owner_user_id TEXT,
	meta_json TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	revoked_at INTEGER,
	views INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX shares_user ON shares (user_id, created_at);
