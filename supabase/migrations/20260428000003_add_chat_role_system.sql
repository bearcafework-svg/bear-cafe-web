-- ═══════════════════════════════════════════════════════════════
-- Add role column to chat_queue and chat_sessions
-- Seed default categories (replacing old topics)
-- ═══════════════════════════════════════════════════════════════

-- Add role to chat_queue
ALTER TABLE chat_queue
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'both'
  CHECK (role IN ('talk', 'listen', 'both', 'chill'));

-- Add role columns to chat_sessions for record-keeping
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS user_a_role text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS user_b_role text NOT NULL DEFAULT 'both';

-- Ensure chat_topics has all required columns
ALTER TABLE chat_topics
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Seed default categories (upsert by name to avoid duplicates)
INSERT INTO chat_topics (name, description, is_active, sort_order) VALUES
  ('Heal',          'ระบายความรู้สึก ฮีลใจกัน',              true, 0),
  ('Casual',        'คุยเล่น ไม่มีเรื่องจริงจัง',             true, 1),
  ('Deep Talk',     'แลกเปลี่ยนความคิด มุมมองชีวิต',          true, 2),
  ('Open Mind',     'เปิดใจ รับฟังสิ่งใหม่ๆ',                 true, 3),
  ('Same Interest', 'หาคนสายเดียวกัน ชอบอะไรเหมือนกัน',       true, 4)
ON CONFLICT DO NOTHING;
