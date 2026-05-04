-- ═══════════════════════════════════════════════════════════════
-- 1. Add cohort column to profiles
--    Default: 'pioneer' — all existing and new users get this tier.
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cohort text NOT NULL DEFAULT 'pioneer';

COMMENT ON COLUMN profiles.cohort IS
  'User tier/cohort for cosmetic unlocks. e.g. pioneer, veteran, supporter';

-- ═══════════════════════════════════════════════════════════════
-- 2. Profile Frames table
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profile_frames (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  image_url        text        NOT NULL,
  required_cohort  text        NOT NULL DEFAULT 'pioneer',
  sort_order       integer     NOT NULL DEFAULT 0,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE profile_frames IS
  'Cosmetic profile frames unlocked by user cohort/tier.';

-- RLS
ALTER TABLE profile_frames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "frames_public_read"  ON profile_frames;
DROP POLICY IF EXISTS "frames_admin_write"  ON profile_frames;

-- Anyone can read active frames (needed for frontend display)
CREATE POLICY "frames_public_read" ON profile_frames
  FOR SELECT USING (true);

-- Only admins/owners can insert/update/delete
CREATE POLICY "frames_admin_write" ON profile_frames
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('moderator', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('moderator', 'admin')
  ));

-- ═══════════════════════════════════════════════════════════════
-- 3. Storage bucket: cosmetics
--    Stores profile frame PNG/WebP images.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cosmetics',
  'cosmetics',
  true,
  5242880,  -- 5 MB per file
  ARRAY['image/png', 'image/webp', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "cosmetics_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'cosmetics');

-- Admin upload
CREATE POLICY "cosmetics_admin_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cosmetics' AND
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator', 'admin'))
  );

-- Admin delete
CREATE POLICY "cosmetics_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'cosmetics' AND
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator', 'admin'))
  );

-- Admin update
CREATE POLICY "cosmetics_admin_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'cosmetics' AND
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator', 'admin'))
  );
