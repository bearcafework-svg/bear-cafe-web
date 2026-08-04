-- Migration: Add topic_a, topic_b, and extend_count to secret_chat_active_rooms
-- Date: 2026-08-04

ALTER TABLE secret_chat_active_rooms
  ADD COLUMN IF NOT EXISTS topic_a TEXT DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS topic_b TEXT DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS extend_count INTEGER DEFAULT 0;
