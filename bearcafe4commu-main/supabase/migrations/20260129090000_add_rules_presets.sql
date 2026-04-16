-- Create rules_presets table for reusable rule sets
CREATE TABLE public.rules_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rules_text TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.rules_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rules presets"
ON public.rules_presets
FOR ALL
TO authenticated
USING (public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin'))
WITH CHECK (public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin'));

CREATE TRIGGER update_rules_presets_updated_at
BEFORE UPDATE ON public.rules_presets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
