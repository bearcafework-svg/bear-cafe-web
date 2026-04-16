-- Enable Row Level Security on the table
ALTER TABLE public.tag_warn_logs ENABLE ROW LEVEL SECURITY;

-- 1. Allow authenticated users to SELECT (View) logs
DROP POLICY IF EXISTS "Allow authenticated to read tag_warn_logs" ON public.tag_warn_logs;
CREATE POLICY "Allow authenticated to read tag_warn_logs"
ON public.tag_warn_logs
FOR SELECT
TO authenticated
USING (true);

-- 2. Allow authenticated users to INSERT (Create) new logs
DROP POLICY IF EXISTS "Allow authenticated to insert tag_warn_logs" ON public.tag_warn_logs;
CREATE POLICY "Allow authenticated to insert tag_warn_logs"
ON public.tag_warn_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. Allow authenticated users to UPDATE logs (Optional, but good to have)
DROP POLICY IF EXISTS "Allow authenticated to update tag_warn_logs" ON public.tag_warn_logs;
CREATE POLICY "Allow authenticated to update tag_warn_logs"
ON public.tag_warn_logs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Allow authenticated users to DELETE logs (Optional)
DROP POLICY IF EXISTS "Allow authenticated to delete tag_warn_logs" ON public.tag_warn_logs;
CREATE POLICY "Allow authenticated to delete tag_warn_logs"
ON public.tag_warn_logs
FOR DELETE
TO authenticated
USING (true);
