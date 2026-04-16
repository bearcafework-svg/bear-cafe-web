-- Create storage bucket for icons
INSERT INTO storage.buckets (id, name, public)
VALUES ('icons', 'icons', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view icons
CREATE POLICY "Anyone can view icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'icons');

-- Allow authenticated users to upload icons
CREATE POLICY "Authenticated users can upload icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'icons' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their icons
CREATE POLICY "Authenticated users can update icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'icons' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete icons
CREATE POLICY "Authenticated users can delete icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'icons' AND auth.role() = 'authenticated');