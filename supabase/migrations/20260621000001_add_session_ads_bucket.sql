-- ─────────────────────────────────────────────────────────────────
-- Storage bucket สำหรับรูปภาพโฆษณา session_ads
-- ─────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-ads',
  'session-ads',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT DO NOTHING;

-- อ่านได้สาธารณะ (ใช้แสดงใน Discord embed)
CREATE POLICY "session_ads_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'session-ads');

-- เฉพาะ owner/admin เท่านั้นที่อัปโหลดได้
CREATE POLICY "session_ads_admin_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'session-ads' AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  );

-- เฉพาะ owner/admin เท่านั้นที่ลบได้
CREATE POLICY "session_ads_admin_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'session-ads' AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  );
