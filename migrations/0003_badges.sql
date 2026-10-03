-- Medals, and the one message that tells somebody they won one.
--
-- The medals themselves are not stored: they are read off `board_entries`, so
-- a place taken down takes its medal with it. All that needs remembering is
-- the latest month somebody has been told about, so nobody is told twice.
ALTER TABLE users ADD COLUMN award_mailed_month TEXT;
