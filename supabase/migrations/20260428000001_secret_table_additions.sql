-- ═══════════════════════════════════════════════════════════════
-- Secret Table: additions for profile management + violation logs
-- ═══════════════════════════════════════════════════════════════

-- 1. Admin-managed chat profiles (custom name + avatar image)
CREATE TABLE IF NOT EXISTS chat_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  image_url   text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Violation log — records banned-word incidents per session
CREATE TABLE IF NOT EXISTS chat_violations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word        text NOT NULL,
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. Add session_duration_seconds to chat_sessions (default 420 = 7 min)
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS duration_seconds integer NOT NULL DEFAULT 420;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE chat_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_violations ENABLE ROW LEVEL SECURITY;

-- Drop first to avoid "already exists" on re-run
DROP POLICY IF EXISTS "chat_profiles_read"    ON chat_profiles;
DROP POLICY IF EXISTS "chat_profiles_write"   ON chat_profiles;
DROP POLICY IF EXISTS "violations_admin_read" ON chat_violations;
DROP POLICY IF EXISTS "violations_insert"     ON chat_violations;

-- Profiles: public read, owner/admin write
CREATE POLICY "chat_profiles_read"  ON chat_profiles FOR SELECT USING (true);
CREATE POLICY "chat_profiles_write" ON chat_profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')));

-- Violations: only admins/owners can read; system inserts
CREATE POLICY "violations_admin_read" ON chat_violations FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')));
CREATE POLICY "violations_insert" ON chat_violations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── Seed default profiles ────────────────────────────────────────────────────
INSERT INTO chat_profiles (name, image_url, sort_order) VALUES
  ('หมีน้อย',    'https://api.dicebear.com/7.x/bottts/svg?seed=bear',   0),
  ('แมวขาว',    'https://api.dicebear.com/7.x/bottts/svg?seed=cat',    1),
  ('กระต่ายชมพู', 'https://api.dicebear.com/7.x/bottts/svg?seed=rabbit', 2),
  ('คุกกี้หวาน',  'https://api.dicebear.com/7.x/bottts/svg?seed=cookie', 3),
  ('เค้กช็อค',   'https://api.dicebear.com/7.x/bottts/svg?seed=cake',   4),
  ('โดนัทสี',    'https://api.dicebear.com/7.x/bottts/svg?seed=donut',  5)
ON CONFLICT DO NOTHING;

-- Realtime for violations (admin monitor)
-- Guard against "already member of publication" error when re-running
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_violations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_violations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_profiles;
  END IF;
END $$;
