-- Migration: Add recipient_id to orders table for Gifting feature
-- Date: 2026-07-27

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS recipient_id text;

-- Create index for quick lookup by recipient_id
CREATE INDEX IF NOT EXISTS idx_orders_recipient_id 
ON public.orders (recipient_id) 
WHERE recipient_id IS NOT NULL;
