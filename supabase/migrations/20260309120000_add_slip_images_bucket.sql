CREATE TABLE IF NOT EXISTS public.trading_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id text NOT NULL,
  service_id text,
  transaction text,
  item text,
  amount numeric,
  type_bill text,
  slip_url text,
  slip_url_2 text,
  log_timestamp text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create the storage bucket 'slip-images' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('slip-images', 'slip-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files to 'slip-images'
DROP POLICY IF EXISTS "Allow authenticated uploads to slip-images" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to slip-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'slip-images' );

-- Policy to allow public to view files in 'slip-images'
DROP POLICY IF EXISTS "Allow public view of slip-images" ON storage.objects;
CREATE POLICY "Allow public view of slip-images"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'slip-images' );

-- Policy to allow users to update their own files in slip-images
DROP POLICY IF EXISTS "Allow users to update own files in slip-images" ON storage.objects;
CREATE POLICY "Allow users to update own files in slip-images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'slip-images' AND owner = auth.uid() )
WITH CHECK ( bucket_id = 'slip-images' AND owner = auth.uid() );

-- Policy to allow users to delete their own files in slip-images
DROP POLICY IF EXISTS "Allow users to delete own files in slip-images" ON storage.objects;
CREATE POLICY "Allow users to delete own files in slip-images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'slip-images' AND owner = auth.uid() );

-- Add slip_url_2 column to trading_history if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trading_history' AND column_name = 'slip_url_2') THEN
        ALTER TABLE public.trading_history ADD COLUMN slip_url_2 text DEFAULT NULL;
    END IF;
END $$;
