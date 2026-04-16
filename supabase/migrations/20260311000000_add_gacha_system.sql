-- Create Enum for Gacha Reward Type
DO $$ BEGIN
    CREATE TYPE public.gacha_reward_type AS ENUM ('point', 'role', 'money', 'item', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create user_gacha_stats table
CREATE TABLE IF NOT EXISTS public.user_gacha_stats (
    discord_id TEXT PRIMARY KEY,
    match_count INT DEFAULT 0,
    gacha_coins INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create gacha_rewards table
CREATE TABLE IF NOT EXISTS public.gacha_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type public.gacha_reward_type NOT NULL,
    value TEXT, -- Can be role_id, point amount, etc.
    drop_rate NUMERIC NOT NULL, -- Percentage (0-100)
    max_limit INT, -- NULL means unlimited
    claimed_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_gacha_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_rewards ENABLE ROW LEVEL SECURITY;

-- Policies for user_gacha_stats
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.user_gacha_stats;
CREATE POLICY "Allow read access for authenticated users" ON public.user_gacha_stats
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow update for owners" ON public.user_gacha_stats;
CREATE POLICY "Allow update for owners" ON public.user_gacha_stats
    FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Allow users to update their own coin balance (for gacha spinning)
-- Note: Ideally this should be done via Edge Function to prevent cheating, but for MVP we allow it.
CREATE POLICY "Allow update own stats" ON public.user_gacha_stats
    FOR UPDATE TO authenticated
    USING (discord_id = (select discord_id from profiles where id = auth.uid()))
    WITH CHECK (discord_id = (select discord_id from profiles where id = auth.uid()));

-- Policies for gacha_rewards
DROP POLICY IF EXISTS "Allow read access for all users" ON public.gacha_rewards;
CREATE POLICY "Allow read access for all users" ON public.gacha_rewards
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow manage rewards for owners" ON public.gacha_rewards;
CREATE POLICY "Allow manage rewards for owners" ON public.gacha_rewards
    FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

-- RPC function to safely increment claimed_count
CREATE OR REPLACE FUNCTION public.increment_gacha_claimed_count(reward_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.gacha_rewards
  SET claimed_count = COALESCE(claimed_count, 0) + 1
  WHERE id = reward_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON TABLE public.user_gacha_stats TO authenticated;
GRANT ALL ON TABLE public.user_gacha_stats TO service_role;
GRANT ALL ON TABLE public.gacha_rewards TO authenticated;
GRANT ALL ON TABLE public.gacha_rewards TO service_role;
