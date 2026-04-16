-- Drop existing storage policies for banners
DROP POLICY IF EXISTS "Admins can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update banners" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete banners" ON storage.objects;

-- Create new policies using the correct function chain
CREATE POLICY "Admins can upload banners"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'banners' 
  AND has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
);

CREATE POLICY "Admins can update banners"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'banners' 
  AND has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
);

CREATE POLICY "Admins can delete banners"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'banners' 
  AND has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
);