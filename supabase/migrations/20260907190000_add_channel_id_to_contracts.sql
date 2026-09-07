-- Migration: Add channel_id and channel_deleted_at to contracts for advertising contracts
-- Date: 2026-09-07

ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS channel_id TEXT;

ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS channel_deleted_at TIMESTAMPTZ;

-- Index for querying expired ad contracts with pending channel deletion
CREATE INDEX IF NOT EXISTS idx_contracts_ad_expired_channels 
ON public.contracts (end_at) 
WHERE type = 'ad' AND channel_id IS NOT NULL AND channel_deleted_at IS NULL;

COMMENT ON COLUMN public.contracts.channel_id IS 'Discord Channel ID ที่ผูกกับสัญญาโฆษณา (ลบอัตโนมัติเมื่อหมดสัญญา)';
COMMENT ON COLUMN public.contracts.channel_deleted_at IS 'เวลาที่ห้อง Discord ถูกลบออกจากระบบ';
