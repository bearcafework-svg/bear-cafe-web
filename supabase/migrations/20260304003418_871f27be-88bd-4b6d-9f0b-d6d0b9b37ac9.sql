
CREATE TABLE IF NOT EXISTS public.redeem_codes (
  code text PRIMARY KEY,
  reward_type text,
  points integer,
  role_id text,
  max_uses integer,
  used_count integer DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.redeem_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text REFERENCES public.redeem_codes(code) ON DELETE SET NULL,
  discord_id text,
  reward_details jsonb,
  redeemed_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_points (
  discord_id text PRIMARY KEY,
  points integer NOT NULL DEFAULT 0,
  max_cap integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

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
