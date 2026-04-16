-- Add description and button fields to banners table
ALTER TABLE public.banners 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS button_text TEXT,
ADD COLUMN IF NOT EXISTS button_url TEXT;