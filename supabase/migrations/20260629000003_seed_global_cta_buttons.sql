-- ── Global CTA Buttons ────────────────────────────────────────────────────────
-- เก็บ CTA ส่วนกลางใน site_settings (key: global_cta_buttons)
-- รองรับหลายปุ่ม, กำหนด placement, เปิด/ปิดได้รายปุ่ม
--
-- Schema ของแต่ละ object ใน array:
--   id         : string  — unique identifier สำหรับ reference
--   type       : number  — Discord component type (2 = button)
--   style      : number  — Discord button style (5 = link)
--   url        : string  — URL เมื่อกดปุ่ม
--   label      : string  — ข้อความบนปุ่ม
--   emoji      : object  — { name: string, id?: string, animated?: boolean }
--   is_active  : boolean — เปิด/ปิดปุ่มนี้
--   placement  : string[] — function ที่ปุ่มนี้จะโชว์
--                           เช่น ["session_webhook", "campaign"]

INSERT INTO public.site_settings (key, value)
VALUES (
  'global_cta_buttons',
  '[
    {
      "id": "advertise",
      "type": 2,
      "style": 5,
      "url": "https://discord.com/channels/1144251788493602848/1202239170219868190",
      "label": "ลงโฆษณากับเรา",
      "emoji": { "name": "🫂" },
      "is_active": true,
      "placement": ["session_webhook", "campaign"]
    }
  ]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
