DROP POLICY IF EXISTS "Authenticated users can view basic profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view basic profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);