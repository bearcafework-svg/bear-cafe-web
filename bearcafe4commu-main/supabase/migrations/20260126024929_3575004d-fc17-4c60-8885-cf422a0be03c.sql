-- Create banners table for homepage carousel
CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  title TEXT,
  link_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Anyone can view active banners
CREATE POLICY "Anyone can view active banners"
ON public.banners
FOR SELECT
USING (is_active = true OR has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));

-- Admins can manage banners
CREATE POLICY "Admins can manage banners"
ON public.banners
FOR ALL
USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));

-- Create storage bucket for banners
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true);

-- Storage policies for banners bucket
CREATE POLICY "Anyone can view banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

CREATE POLICY "Admins can upload banners"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'banners' AND has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));

CREATE POLICY "Admins can update banners"
ON storage.objects FOR UPDATE
USING (bucket_id = 'banners' AND has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));

CREATE POLICY "Admins can delete banners"
ON storage.objects FOR DELETE
USING (bucket_id = 'banners' AND has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));