-- Add featured/verified/partner/highlight fields to discord_servers
ALTER TABLE public.discord_servers
  ADD COLUMN IF NOT EXISTS is_verified    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_partner     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS highlight_color TEXT,
  ADD COLUMN IF NOT EXISTS carousel_order INTEGER;

-- Ensure is_featured is NOT NULL (was nullable in original schema)
ALTER TABLE public.discord_servers
  ALTER COLUMN is_featured SET DEFAULT false;
UPDATE public.discord_servers SET is_featured = false WHERE is_featured IS NULL;
ALTER TABLE public.discord_servers
  ALTER COLUMN is_featured SET NOT NULL;

-- Index for carousel ordering (IS TRUE handles the NOT NULL we just enforced)
CREATE INDEX IF NOT EXISTS idx_discord_servers_featured
  ON public.discord_servers (carousel_order)
  WHERE is_featured IS TRUE;
