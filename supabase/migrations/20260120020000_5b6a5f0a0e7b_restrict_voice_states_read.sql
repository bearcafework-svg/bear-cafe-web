-- Restrict voice_states reads to authenticated users
DROP POLICY IF EXISTS "Anyone can view voice states" ON public.voice_states;

DROP POLICY IF EXISTS "Authenticated users can view voice states" ON public.voice_states;
CREATE POLICY "Authenticated users can view voice states"
ON public.voice_states
FOR SELECT
TO authenticated
USING (true);

REVOKE ALL ON public.voice_states FROM anon;
GRANT SELECT ON public.voice_states TO authenticated;
