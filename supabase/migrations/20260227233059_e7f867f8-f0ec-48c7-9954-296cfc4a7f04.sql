
-- Allow admins/owners to insert lottery rounds
CREATE POLICY "Page access: insert lottery rounds"
  ON public.lottery_rounds FOR INSERT
  WITH CHECK (jwt_has_page_access('lottery'::text));

-- Allow admins/owners to update lottery rounds
CREATE POLICY "Page access: update lottery rounds"
  ON public.lottery_rounds FOR UPDATE
  USING (jwt_has_page_access('lottery'::text));

-- Allow admins/owners to insert lottery tickets
CREATE POLICY "Page access: insert lottery tickets"
  ON public.lottery_tickets FOR INSERT
  WITH CHECK (jwt_has_page_access('lottery'::text));

-- Allow admins/owners to update lottery tickets
CREATE POLICY "Page access: update lottery tickets"
  ON public.lottery_tickets FOR UPDATE
  USING (jwt_has_page_access('lottery'::text));
