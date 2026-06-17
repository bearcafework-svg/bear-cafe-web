-- เพิ่ม column image_url_2 สำหรับรูปหลักฐานที่ 2
ALTER TABLE public.tag_warn_logs
  ADD COLUMN IF NOT EXISTS image_url_2 text;

-- ลบ column punish_link ออก (ไม่ใช้แล้ว)
ALTER TABLE public.tag_warn_logs
  DROP COLUMN IF EXISTS punish_link;
