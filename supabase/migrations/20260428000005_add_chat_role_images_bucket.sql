-- Storage bucket for chat role images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-role-images', 'chat-role-images', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "role_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-role-images');

CREATE POLICY "role_images_admin_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-role-images' AND
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin'))
  );

CREATE POLICY "role_images_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-role-images' AND
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('moderator','admin'))
  );
