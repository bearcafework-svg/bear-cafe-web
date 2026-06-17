-- แยก spoiler flag สำหรับรูปที่ 2 ออกมาเป็น column ของตัวเอง
ALTER TABLE public.tag_warn_logs
  ADD COLUMN IF NOT EXISTS is_spoiler_2 boolean NOT NULL DEFAULT false;
