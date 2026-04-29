-- Storage bucket for BGM music files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-music',
  'chat-music',
  true,
  20971520,  -- 20 MB per file
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/flac', 'audio/aac']
)
ON CONFLICT (id) DO NOTHING;

-- Public read (anyone can stream)
CREATE POLICY "chat_music_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-music');

-- Admin upload
CREATE POLICY "chat_music_admin_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-music' AND
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator', 'admin'))
  );

-- Admin delete
CREATE POLICY "chat_music_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-music' AND
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator', 'admin'))
  );

-- Admin update (rename)
CREATE POLICY "chat_music_admin_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'chat-music' AND
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator', 'admin'))
  );
