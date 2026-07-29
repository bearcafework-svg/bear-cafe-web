-- Migration: Create rent_house_settings table
-- Stores configuration, access permissions, and passcodes for Rent House voice channels

CREATE TABLE IF NOT EXISTS public.rent_house_settings (
  channel_id TEXT NOT NULL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  password TEXT NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  hidden BOOLEAN NOT NULL DEFAULT false,
  trusted_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  co_owner_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rent_house_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to rent_house_settings"
  ON public.rent_house_settings FOR SELECT USING (true);

CREATE POLICY "Allow service_role full access to rent_house_settings"
  ON public.rent_house_settings FOR ALL USING (true) WITH CHECK (true);
