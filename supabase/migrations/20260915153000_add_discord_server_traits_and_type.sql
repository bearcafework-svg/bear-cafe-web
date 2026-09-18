-- Migration: Add server_type and traits to discord_servers
-- Date: 2026-09-15
-- Phase 2: Vibe & Trait Tags, Community/Shop Separation

-- 1. เพิ่มคอลัมน์ server_type และ traits
ALTER TABLE public.discord_servers
  ADD COLUMN IF NOT EXISTS server_type text DEFAULT 'community',
  ADD COLUMN IF NOT EXISTS traits text[] DEFAULT '{}';

-- 2. สร้าง Index สำหรับการกรองประเภทเซิร์ฟเวอร์
CREATE INDEX IF NOT EXISTS idx_discord_servers_server_type
  ON public.discord_servers(server_type);

-- 3. เพิ่ม Comment อธิบายฟิลด์
COMMENT ON COLUMN public.discord_servers.server_type IS 'ประเภทของเซิร์ฟเวอร์: community (คอมมูนิตี้พูดคุย) หรือ shop (ร้านค้า/ผู้ให้บริการ)';
COMMENT ON COLUMN public.discord_servers.traits IS 'รายการ Trait / Vibe Tags ที่เจ้าของกำหนด';
