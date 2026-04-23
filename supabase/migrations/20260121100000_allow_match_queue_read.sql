-- Allow authenticated users to read match queue entries for matchmaking
DROP POLICY IF EXISTS "Authenticated users can read match queue" ON public.match_queue;
CREATE POLICY "Authenticated users can read match queue"
ON public.match_queue FOR SELECT
TO authenticated
USING (true);
