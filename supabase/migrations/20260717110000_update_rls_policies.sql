-- Drop old SELECT policies for staff_members and promotion_submissions
DROP POLICY IF EXISTS "Allow select own or admin/owner" ON public.staff_members;
DROP POLICY IF EXISTS "Allow select own or admin/owner" ON public.promotion_submissions;

-- Create new SELECT policies that allow all authenticated users to read records
CREATE POLICY "Allow select for all authenticated" ON public.staff_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow select for all authenticated" ON public.promotion_submissions
  FOR SELECT TO authenticated USING (true);
