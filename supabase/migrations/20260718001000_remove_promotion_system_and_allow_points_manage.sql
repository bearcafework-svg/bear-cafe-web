-- Remove promotion system and grant moderators management access on user_points

-- 1. Drop promotion-related tables and their dependent objects (triggers, views, functions)
DROP TABLE IF EXISTS public.promotion_submissions CASCADE;
DROP TABLE IF EXISTS public.promotion_reminder_logs CASCADE;

-- 2. Drop promotion-related functions
DROP FUNCTION IF EXISTS public.approve_promotion_submission(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rollback_promotion_approval(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.tr_before_promotion_submission_update() CASCADE;

-- 3. Delete promotion settings from system settings
DELETE FROM public.system_settings WHERE key = 'promotion_settings';

-- 4. Update user_points RLS policies to allow moderators to manage (INSERT, UPDATE, DELETE, SELECT) all user points
DROP POLICY IF EXISTS "Owner can update user_points" ON public.user_points;
DROP POLICY IF EXISTS "Moderators can manage user_points" ON public.user_points;

CREATE POLICY "Moderators can manage user_points"
ON public.user_points
FOR ALL
TO authenticated
USING (
  public.has_role(
    public.get_profile_by_discord_id(public.get_jwt_discord_id()),
    'moderator'
  )
)
WITH CHECK (
  public.has_role(
    public.get_profile_by_discord_id(public.get_jwt_discord_id()),
    'moderator'
  )
);
