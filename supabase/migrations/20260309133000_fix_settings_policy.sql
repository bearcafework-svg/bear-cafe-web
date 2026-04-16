-- สร้างตาราง site_settings ถ้ายังไม่มี
CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- เปิดใช้งาน RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- ล้าง Policy เก่า (ถ้ามี)
DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON public.site_settings;
DROP POLICY IF EXISTS "Allow full access for owners" ON public.site_settings;
DROP POLICY IF EXISTS "Allow update for owners" ON public.site_settings;
DROP POLICY IF EXISTS "Allow insert for owners" ON public.site_settings;

-- Policy 1: อนุญาตให้ User ที่ Login แล้วทุกคน "อ่าน" ค่าตั้งค่าได้ (SELECT)
-- เพื่อให้หน้าเว็บโหลดสถานะเปิด/ปิด Webhook มาแสดงผลได้ถูกต้อง
CREATE POLICY "Allow read access for all authenticated users"
ON public.site_settings FOR SELECT
TO authenticated
USING (true);

-- Policy 2: อนุญาตให้เฉพาะ Owner เท่านั้นที่ "แก้ไข/เพิ่ม" ค่าตั้งค่าได้ (INSERT/UPDATE)
CREATE POLICY "Allow manage settings for Owner only"
ON public.site_settings FOR ALL
TO authenticated
USING ( public.is_owner() )
WITH CHECK ( public.is_owner() );

-- เพิ่มข้อมูล Default สำหรับ Webhook toggle ถ้ายังไม่มี
INSERT INTO public.site_settings (key, value)
VALUES 
  ('trading_webhook_enabled', 'true'::jsonb),
  ('tag_warn_webhook_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
