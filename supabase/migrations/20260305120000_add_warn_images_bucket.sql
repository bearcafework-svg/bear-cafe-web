-- Create the storage bucket 'warn-images' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('warn-images', 'warn-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files to 'warn-images'
DROP POLICY IF EXISTS "Allow authenticated uploads to warn-images" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to warn-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'warn-images' );

-- Policy to allow public to view files in 'warn-images'
DROP POLICY IF EXISTS "Allow public view of warn-images" ON storage.objects;
CREATE POLICY "Allow public view of warn-images"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'warn-images' );

-- Policy to allow users to update their own files in warn-images
DROP POLICY IF EXISTS "Allow users to update own files in warn-images" ON storage.objects;
CREATE POLICY "Allow users to update own files in warn-images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'warn-images' AND owner = auth.uid() )
WITH CHECK ( bucket_id = 'warn-images' AND owner = auth.uid() );

-- Policy to allow users to delete their own files in warn-images
DROP POLICY IF EXISTS "Allow users to delete own files in warn-images" ON storage.objects;
CREATE POLICY "Allow users to delete own files in warn-images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'warn-images' AND owner = auth.uid() );
