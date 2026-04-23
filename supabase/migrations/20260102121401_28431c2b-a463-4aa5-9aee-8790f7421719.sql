-- 1. Fix profiles RLS - restrict to own profile only
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators can view profiles" ON public.profiles;

DO $$ BEGIN
  CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(
    (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')),
    'admin'
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Moderators can view profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(
    (SELECT public.get_profile_by_discord_id(auth.jwt() ->> 'discord_id')),
    'moderator'
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Fix action_logs RLS
DROP POLICY IF EXISTS "Authenticated users can create logs" ON public.action_logs;

-- 3. Session note constraint
ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_note_length_check;

ALTER TABLE public.sessions
ADD CONSTRAINT sessions_note_length_check
CHECK (note IS NULL OR length(note) <= 200);