-- ─────────────────────────────────────────────────────────────────────────────
-- Refactor delivery_mode: ตัด 'all' ออก
-- random_one = สุ่ม 1 ชิ้นจาก session_ads โดยตรง
-- ordered    = เอาอันดับแรกจาก ad_placement_items ตาม sort_order
-- ─────────────────────────────────────────────────────────────────────────────

-- migrate row ที่ยังเป็น 'all' → 'random_one'
UPDATE public.ad_placements
SET delivery_mode = 'random_one'
WHERE delivery_mode = 'all';

-- ปรับ CHECK constraint ให้รองรับแค่ 2 mode
ALTER TABLE public.ad_placements
  DROP CONSTRAINT IF EXISTS ad_placements_delivery_mode_check;

ALTER TABLE public.ad_placements
  ADD CONSTRAINT ad_placements_delivery_mode_check
    CHECK (delivery_mode IN ('random_one', 'ordered'));
