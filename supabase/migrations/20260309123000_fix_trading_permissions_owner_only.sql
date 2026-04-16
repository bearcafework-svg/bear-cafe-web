-- ฟังก์ชันตรวจสอบว่าเป็น Owner (role = 'moderator') หรือไม่
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'moderator'::public.app_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ฟังก์ชันตรวจสอบสิทธิ์การเข้าถึงหน้า (Page Access)
CREATE OR REPLACE FUNCTION public.has_page_access(page_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Owner เข้าถึงได้เสมอ
  IF public.is_owner() THEN
    RETURN TRUE;
  END IF;

  -- ตรวจสอบสิทธิ์จากตาราง custom_permissions
  RETURN EXISTS (
    SELECT 1
    FROM public.user_custom_permissions ucp
    JOIN public.custom_permissions cp ON ucp.permission_id = cp.id
    WHERE ucp.user_id = auth.uid()
    AND page_id = ANY(cp.allowed_pages)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- จัดการสิทธิ์ตาราง trading_history (บิล)
-- ==========================================

-- เปิดใช้งาน RLS
ALTER TABLE public.trading_history ENABLE ROW LEVEL SECURITY;

-- ล้าง Policy เก่า
DROP POLICY IF EXISTS "Enable read access for all users" ON public.trading_history;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.trading_history;
DROP POLICY IF EXISTS "Enable update for service_id" ON public.trading_history;
DROP POLICY IF EXISTS "Staff can view trading history" ON public.trading_history;
DROP POLICY IF EXISTS "Owner can manage trading history" ON public.trading_history;

-- Policy 1: การดูข้อมูล (SELECT)
-- อนุญาตให้ Owner หรือคนที่มีสิทธิ์เข้าถึงหน้า 'trading-history' ดูได้
CREATE POLICY "Allow view trading history based on permission"
ON public.trading_history FOR SELECT
TO authenticated
USING ( public.has_page_access('trading-history') );

-- Policy 2: การเพิ่ม/แก้ไข/ลบ (INSERT/UPDATE/DELETE)
-- อนุญาตเฉพาะ Owner เท่านั้น (ตามที่ขอ "บิลไรงี้ให้ Owner คนเดียว")
CREATE POLICY "Allow manage trading history for Owner only"
ON public.trading_history FOR ALL
TO authenticated
USING ( public.is_owner() )
WITH CHECK ( public.is_owner() );


-- ==========================================
-- จัดการสิทธิ์ Storage Bucket 'slip-images'
-- ==========================================

-- ตรวจสอบและสร้าง Bucket (ถ้าไม่มี)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'slip-images', 
  'slip-images', 
  true, 
  5242880, 
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

-- ล้าง Policy เก่า
DROP POLICY IF EXISTS "Allow authenticated uploads to slip-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public view of slip-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update own files in slip-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own files in slip-images" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to slip-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to slip-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes to slip-images" ON storage.objects;

-- Policy 1: ดูรูปภาพ (SELECT) - ให้ทุกคนดูได้ (เพื่อการแสดงผลที่ราบรื่น)
CREATE POLICY "Allow public view of slip-images"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'slip-images' );

-- Policy 2: จัดการรูปภาพ (INSERT/UPDATE/DELETE) - เฉพาะ Owner เท่านั้น
CREATE POLICY "Allow manage slip-images for Owner only"
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'slip-images' AND public.is_owner() )
WITH CHECK ( bucket_id = 'slip-images' AND public.is_owner() );
