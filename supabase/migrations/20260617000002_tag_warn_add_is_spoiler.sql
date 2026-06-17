-- เพิ่ม column is_spoiler สำหรับจำสถานะ spoiler ของรูปภาพ
ALTER TABLE public.tag_warn_logs
  ADD COLUMN IF NOT EXISTS is_spoiler boolean NOT NULL DEFAULT false;
