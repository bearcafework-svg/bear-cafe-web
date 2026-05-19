-- Bartender mode for /secret-chat

CREATE TABLE IF NOT EXISTS chat_bartender_presence (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  is_online boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT false,
  standby_mode boolean NOT NULL DEFAULT false,
  status_text text NOT NULL DEFAULT '🧸 พร้อมคุย',
  alias text,
  avatar text,
  active_session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_bartender_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bartender_read" ON chat_bartender_presence;
CREATE POLICY "bartender_read" ON chat_bartender_presence
FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "bartender_manage_self" ON chat_bartender_presence;
CREATE POLICY "bartender_manage_self" ON chat_bartender_presence
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bartender_admin_manage" ON chat_bartender_presence;
CREATE POLICY "bartender_admin_manage" ON chat_bartender_presence
FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin'))
);

CREATE INDEX IF NOT EXISTS idx_chat_bartender_presence_available
  ON chat_bartender_presence (is_online, is_available, standby_mode, updated_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_bartender_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_bartender_presence;
  END IF;
END $$;
