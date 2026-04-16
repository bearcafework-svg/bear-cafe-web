-- Add INSERT policy for profiles table to allow service role inserts
-- The service role key should bypass RLS, but we need to ensure the policy exists

-- First, drop all existing policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Recreate policies with PERMISSIVE instead of RESTRICTIVE
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'moderator'));

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- Add INSERT policy for authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Allow service role to do everything (this is handled by default, but let's be explicit)
CREATE POLICY "Service role has full access"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);