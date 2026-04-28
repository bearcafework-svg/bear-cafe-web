-- ═══════════════════════════════════════════════════════════════
-- Chat Roles table — admin-managed role definitions
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE CHECK (key IN ('talk', 'listen', 'both', 'chill')),
  label       text NOT NULL,
  sub         text NOT NULL,
  image_url   text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_roles_read" ON chat_roles FOR SELECT USING (true);
CREATE POLICY "chat_roles_write" ON chat_roles FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')));

-- Seed defaults
INSERT INTO chat_roles (key, label, sub, sort_order) VALUES
  ('talk',   'Talk',   'อยากเล่า ระบาย หรือแชร์เรื่องราว',  0),
  ('listen', 'Listen', 'อยากฟัง รับฟัง และให้กำลังใจ',       1),
  ('both',   'Both',   'คุยได้ทั้งสองฝ่าย ยืดหยุ่น',         2),
  ('chill',  'Chill',  'ชิล ๆ ไม่จริงจัง แค่อยากคุย',        3)
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_roles;
  END IF;
END $$;
