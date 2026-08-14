-- Migration: Fix Tag Warn Storage Bucket RLS Policies for evidence and warn-images
-- Date: 2026-08-14

-- 1. Ensure storage buckets exist and are public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('warn-images', 'warn-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  ('evidence', 'evidence', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow public SELECT on 'warn-images' and 'evidence'
DROP POLICY IF EXISTS "storage_warn_images_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_evidence_select" ON storage.objects;

CREATE POLICY "storage_warn_images_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'warn-images');
CREATE POLICY "storage_evidence_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'evidence');

-- 3. Allow authenticated users to manage files in 'evidence' and 'warn-images'
DROP POLICY IF EXISTS "storage_warn_images_manage" ON storage.objects;
DROP POLICY IF EXISTS "storage_evidence_manage" ON storage.objects;

CREATE POLICY "storage_warn_images_manage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'warn-images' AND (public.has_page_access('tag-warn') OR public.is_owner()))
  WITH CHECK (bucket_id = 'warn-images' AND (public.has_page_access('tag-warn') OR public.is_owner()));

CREATE POLICY "storage_evidence_manage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'evidence' AND (public.has_page_access('tag-warn') OR public.is_owner()))
  WITH CHECK (bucket_id = 'evidence' AND (public.has_page_access('tag-warn') OR public.is_owner()));
