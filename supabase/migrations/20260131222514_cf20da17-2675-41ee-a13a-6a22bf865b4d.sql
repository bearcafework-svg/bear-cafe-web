-- Create site_settings table for maintenance mode
CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view settings
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
CREATE POLICY "Anyone can view site settings"
ON public.site_settings
FOR SELECT
USING (true);

-- Only moderators (Owners) can update settings
DROP POLICY IF EXISTS "Owners can update site settings" ON public.site_settings;
CREATE POLICY "Owners can update site settings"
ON public.site_settings
FOR UPDATE
USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role));

-- Only moderators (Owners) can insert settings
DROP POLICY IF EXISTS "Owners can insert site settings" ON public.site_settings;
CREATE POLICY "Owners can insert site settings"
ON public.site_settings
FOR INSERT
WITH CHECK (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role));

-- Insert default maintenance_mode setting (disabled by default)
INSERT INTO public.site_settings (key, value)
VALUES ('maintenance_mode', '{"enabled": false, "message": "เว็บไซต์กำลังปรับปรุง กรุณากลับมาใหม่ภายหลัง"}'::jsonb);

-- Enable realtime for site_settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;