-- ═══════════════════════════════════════════════════════════════
-- Secret Table Feature Migration
-- ═══════════════════════════════════════════════════════════════

-- 1. Chat Topics (admin-managed moods/themes)
CREATE TABLE IF NOT EXISTS chat_topics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  image_url   text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Naming system — prefixes (e.g. "นุ่มนิ่ม", "หอมกรุ่น")
CREATE TABLE IF NOT EXISTS chat_name_prefixes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Naming system — menu names (e.g. "ลาเต้", "ครัวซองต์")
CREATE TABLE IF NOT EXISTS chat_name_menus (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Active chat sessions (one row per matched pair)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id        uuid REFERENCES chat_topics(id) ON DELETE SET NULL,
  user_a_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_a_alias    text NOT NULL,
  user_b_alias    text NOT NULL,
  user_a_avatar   text NOT NULL DEFAULT 'bear',
  user_b_avatar   text NOT NULL DEFAULT 'bear',
  -- reveal state
  user_a_reveal_req  boolean NOT NULL DEFAULT false,
  user_b_reveal_req  boolean NOT NULL DEFAULT false,
  revealed           boolean NOT NULL DEFAULT false,
  -- lifecycle
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 5. Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-delete messages older than 7 days via pg_cron (if available)
-- Fallback: handled by application-level cleanup

-- 6. Post-chat ratings
CREATE TABLE IF NOT EXISTS chat_ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  rater_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rated_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stars       smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, rater_id)
);

-- 7. Matchmaking queue
CREATE TABLE IF NOT EXISTS chat_queue (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id    uuid NOT NULL REFERENCES chat_topics(id) ON DELETE CASCADE,
  alias       text NOT NULL,
  avatar      text NOT NULL DEFAULT 'bear',
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)  -- one queue entry per user
);

-- ─── Seed default topics ─────────────────────────────────────────────────────
INSERT INTO chat_topics (name, description, sort_order) VALUES
  ('Latte',      'บรรยากาศอบอุ่น นุ่มนวล เหมาะสำหรับการพูดคุยทั่วไป', 0),
  ('Espresso',   'เข้มข้น ตรงไปตรงมา สำหรับคนที่อยากคุยเรื่องจริงจัง', 1),
  ('Matcha',     'สงบ ผ่อนคลาย เหมาะสำหรับการแบ่งปันความรู้สึก',       2),
  ('Hojicha',    'อบอุ่นเหมือนบ้าน เหมาะสำหรับการระบาย',               3),
  ('Oolong',     'ลึกลับ น่าค้นหา สำหรับการสนทนาที่ไม่ธรรมดา',         4)
ON CONFLICT DO NOTHING;

-- ─── Seed default prefixes ───────────────────────────────────────────────────
INSERT INTO chat_name_prefixes (word) VALUES
  ('นุ่มนิ่ม'), ('หอมกรุ่น'), ('อ่อนโยน'), ('แสนดี'), ('ใจดี'),
  ('เงียบขรึม'), ('ร่าเริง'), ('อบอุ่น'), ('สดใส'), ('ลึกลับ')
ON CONFLICT DO NOTHING;

-- ─── Seed default menu names ─────────────────────────────────────────────────
INSERT INTO chat_name_menus (word) VALUES
  ('ลาเต้'), ('ครัวซองต์'), ('มัทฉะ'), ('เอสเปรสโซ่'), ('วาฟเฟิล'),
  ('มาการอง'), ('ชีสเค้ก'), ('บราวนี่'), ('สโคน'), ('ทาร์ต')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE chat_topics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_name_prefixes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_name_menus     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_ratings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_queue          ENABLE ROW LEVEL SECURITY;

-- Topics: public read, owner write
CREATE POLICY "topics_read"   ON chat_topics FOR SELECT USING (true);
CREATE POLICY "topics_write"  ON chat_topics FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')));

-- Prefixes / Menus: public read, owner write
CREATE POLICY "prefixes_read"  ON chat_name_prefixes FOR SELECT USING (true);
CREATE POLICY "prefixes_write" ON chat_name_prefixes FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')));

CREATE POLICY "menus_read"  ON chat_name_menus FOR SELECT USING (true);
CREATE POLICY "menus_write" ON chat_name_menus FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')));

-- Queue: users manage their own row; admins see all
CREATE POLICY "queue_select" ON chat_queue FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "queue_insert" ON chat_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "queue_delete" ON chat_queue FOR DELETE USING (auth.uid() = user_id);

-- Sessions: participants can read their own sessions
CREATE POLICY "sessions_select" ON chat_sessions FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin')));
CREATE POLICY "sessions_insert" ON chat_sessions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "sessions_update" ON chat_sessions FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Messages: participants can read/insert in their sessions
CREATE POLICY "messages_select" ON chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chat_sessions s
    WHERE s.id = session_id AND (s.user_a_id = auth.uid() OR s.user_b_id = auth.uid())
  ));
CREATE POLICY "messages_insert" ON chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = session_id AND s.status = 'active'
        AND (s.user_a_id = auth.uid() OR s.user_b_id = auth.uid())
    )
  );

-- Ratings: users can insert their own rating once per session
CREATE POLICY "ratings_select" ON chat_ratings FOR SELECT
  USING (auth.uid() = rater_id OR auth.uid() = rated_id);
CREATE POLICY "ratings_insert" ON chat_ratings FOR INSERT
  WITH CHECK (auth.uid() = rater_id);

-- ═══════════════════════════════════════════════════════════════
-- Realtime: enable broadcast + presence on relevant tables
-- ═══════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE chat_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
