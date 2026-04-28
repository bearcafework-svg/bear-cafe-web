-- ═══════════════════════════════════════════════════════════════
-- Chat Mood Similarity Config
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_config (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_config ENABLE ROW LEVEL SECURITY;

-- Public read (client needs to load config at runtime)
CREATE POLICY "chat_config_read" ON chat_config
  FOR SELECT USING (true);

-- Only owner/admin can write
CREATE POLICY "chat_config_write" ON chat_config
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('moderator', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('moderator', 'admin')
  ));

-- Seed default config
INSERT INTO chat_config (key, value) VALUES
  ('similar_mood', jsonb_build_object(
    'enabled', true,
    'similar_phase_delay_seconds', 15,
    'map', '{}'::jsonb
  ))
ON CONFLICT (key) DO NOTHING;

-- Realtime for hot-reload support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_config;
  END IF;
END $$;
