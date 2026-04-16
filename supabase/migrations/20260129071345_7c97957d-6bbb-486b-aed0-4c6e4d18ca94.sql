-- 1. สร้างตาราง rules_presets สำหรับกฎสำเร็จรูป
CREATE TABLE IF NOT EXISTS public.rules_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  rules_text text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- เปิด RLS
ALTER TABLE public.rules_presets ENABLE ROW LEVEL SECURITY;

-- Policy: ทุกคนดูได้
CREATE POLICY "Anyone can view rules presets"
ON public.rules_presets
FOR SELECT
USING (true);

-- Policy: Admin จัดการได้
CREATE POLICY "Admins can manage rules presets"
ON public.rules_presets
FOR ALL
TO authenticated
USING (
  public.has_role(public.get_profile_by_discord_id(public.get_jwt_discord_id()), 'admin')
)
WITH CHECK (
  public.has_role(public.get_profile_by_discord_id(public.get_jwt_discord_id()), 'admin')
);

-- Trigger อัปเดต updated_at
DROP TRIGGER IF EXISTS update_rules_presets_updated_at ON public.rules_presets;
CREATE TRIGGER update_rules_presets_updated_at
BEFORE UPDATE ON public.rules_presets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. เพิ่ม Policy ให้ Admin สามารถ UPDATE profiles ได้ (สำหรับแบนผู้ใช้)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.has_role(public.get_profile_by_discord_id(public.get_jwt_discord_id()), 'admin')
);