-- Migration: Add Live Activity fields to discord_servers
-- Date: 2026-09-15
-- Phase 1: Real-time Activity Sync via Akari Bot

-- 1. เพิ่มคอลัมน์สำหรับเก็บสถิติความเคลื่อนไหวสดจาก Akari Bot
ALTER TABLE public.discord_servers
  ADD COLUMN IF NOT EXISTS live_voice_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_joins_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_akari_bot boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS activity_synced_at timestamptz;

-- 2. สร้าง Index สำหรับการค้นหาและเรียงลำดับเซิร์ฟเวอร์ที่กำลังคุยสด (Live Voice)
CREATE INDEX IF NOT EXISTS idx_discord_servers_live_voice 
  ON public.discord_servers(live_voice_count DESC, bumped_at DESC);

-- 3. เพิ่ม Comment อธิบายฟิลด์
COMMENT ON COLUMN public.discord_servers.live_voice_count IS 'จำนวนผู้ใช้ที่กำลังอยู่ในห้องเสียง (Voice Channels) ปัจจุบัน';
COMMENT ON COLUMN public.discord_servers.weekly_joins_count IS 'จำนวนสมาชิกใหม่ที่เข้าร่วมเซิร์ฟเวอร์ในรอบ 7 วัน';
COMMENT ON COLUMN public.discord_servers.has_akari_bot IS 'ระบุว่าเซิร์ฟเวอร์นี้มีบอท Akari ประจำการอยู่หรือไม่';
COMMENT ON COLUMN public.discord_servers.activity_synced_at IS 'วันเวลาล่าสุดที่ Akari Bot ซิงค์สถิติเข้าสู่ฐานข้อมูล';
