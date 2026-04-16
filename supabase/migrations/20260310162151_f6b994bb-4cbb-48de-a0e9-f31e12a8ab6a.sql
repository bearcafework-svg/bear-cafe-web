
-- Drop the restrictive owner-only ALL policy that blocks non-owner staff
DROP POLICY IF EXISTS "Allow manage trading history for Owner only" ON public.trading_history;

-- Drop the overly broad authenticated ALL policy  
DROP POLICY IF EXISTS "Allow update/delete for authenticated" ON public.trading_history;

-- Drop the old insert policy
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.trading_history;

-- Drop the old public read policy
DROP POLICY IF EXISTS "Allow public read access" ON public.trading_history;

-- Create proper page-access based policies
-- SELECT: anyone with trading-history page access
CREATE POLICY "Page access: view trading history"
ON public.trading_history FOR SELECT TO authenticated
USING (has_page_access(get_profile_by_discord_id(get_jwt_discord_id()), 'trading-history'));

-- INSERT: anyone with trading-history page access
CREATE POLICY "Page access: insert trading history"
ON public.trading_history FOR INSERT TO authenticated
WITH CHECK (has_page_access(get_profile_by_discord_id(get_jwt_discord_id()), 'trading-history'));

-- UPDATE: anyone with trading-history page access
CREATE POLICY "Page access: update trading history"
ON public.trading_history FOR UPDATE TO authenticated
USING (has_page_access(get_profile_by_discord_id(get_jwt_discord_id()), 'trading-history'));

-- DELETE: only owners
CREATE POLICY "Owner only: delete trading history"
ON public.trading_history FOR DELETE TO authenticated
USING (is_owner());

-- Service role full access
CREATE POLICY "Service role full access trading history"
ON public.trading_history FOR ALL TO service_role
USING (true) WITH CHECK (true);
