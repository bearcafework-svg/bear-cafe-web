-- Migration: Remove contract-icons storage bucket and associated policies
-- Contract types now use standard emojis:
--   house: 🏡
--   personal_role: 🏅
--   boost_role: 🌸
--   ad: 📢

-- 1. Drop storage policies for contract-icons bucket
DROP POLICY IF EXISTS "Allow public view of contract-icons" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated management of contract-icons" ON storage.objects;

-- 2. Clean up any stored objects in contract-icons bucket
DELETE FROM storage.objects WHERE bucket_id = 'contract-icons';

-- 3. Delete the contract-icons bucket
DELETE FROM storage.buckets WHERE id = 'contract-icons';
