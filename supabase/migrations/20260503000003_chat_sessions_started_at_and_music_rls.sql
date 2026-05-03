-- ═══════════════════════════════════════════════════════════════
-- 1. Add started_at to chat_sessions for server-authoritative timer
--    Both clients read this timestamp and compute remaining time
--    independently, so the countdown stays in sync even after reload.
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT NULL;

-- Back-fill existing rows: use created_at as the start time
UPDATE chat_sessions
  SET started_at = created_at
  WHERE started_at IS NULL;

COMMENT ON COLUMN chat_sessions.started_at IS
  'Timestamp when the session became active (join overlay dismissed). Used by both clients to compute a synchronized countdown.';

-- ═══════════════════════════════════════════════════════════════
-- 2. Allow authenticated users to read chat_music_tracks columns
--    (image_url, artist) — previously only title/src were readable
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "music_tracks_read" ON chat_music_tracks;

CREATE POLICY "music_tracks_read" ON chat_music_tracks
  FOR SELECT USING (true);

-- Also ensure categories are readable
DROP POLICY IF EXISTS "music_categories_read" ON chat_music_categories;

CREATE POLICY "music_categories_read" ON chat_music_categories
  FOR SELECT USING (true);
