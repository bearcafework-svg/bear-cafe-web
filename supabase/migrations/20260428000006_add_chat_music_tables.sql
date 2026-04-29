-- ═══════════════════════════════════════════════════════════════
-- Chat Music: categories + tracks managed by admin
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_music_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_music_tracks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES chat_music_categories(id) ON DELETE CASCADE,
  title       text NOT NULL,
  src         text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_music_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_music_tracks     ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "music_cat_read"   ON chat_music_categories FOR SELECT USING (true);
CREATE POLICY "music_track_read" ON chat_music_tracks     FOR SELECT USING (true);

-- Admin write
CREATE POLICY "music_cat_write" ON chat_music_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')));

CREATE POLICY "music_track_write" ON chat_music_tracks FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')));

-- Seed defaults
INSERT INTO chat_music_categories (label, sort_order) VALUES
  ('Lo-fi Chill', 0),
  ('Ambient',     1),
  ('Jazz Cafe',   2)
ON CONFLICT DO NOTHING;
