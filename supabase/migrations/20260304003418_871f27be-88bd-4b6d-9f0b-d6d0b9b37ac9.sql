
-- Allow admin CRUD on redeem_codes
CREATE POLICY "Page access: manage redeem codes"
ON public.redeem_codes
FOR ALL
TO authenticated
USING (jwt_has_page_access('redeem-codes'))
WITH CHECK (jwt_has_page_access('redeem-codes'));

-- Allow admin to manage redeem_logs
CREATE POLICY "Page access: manage redeem logs"
ON public.redeem_logs
FOR ALL
TO authenticated
USING (jwt_has_page_access('redeem-codes'))
WITH CHECK (jwt_has_page_access('redeem-codes'));

-- Allow service role insert on redeem_logs (for edge function)
CREATE POLICY "Service role insert redeem logs"
ON public.redeem_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow service role update on redeem_codes (for used_count increment)
CREATE POLICY "Service role manage redeem codes"
ON public.redeem_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow service role manage user_points
CREATE POLICY "Service role manage user_points"
ON public.user_points
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
