-- Migration: Support Advertising Contracts in Contracts Table
-- Date: 2026-07-15

-- 0. The contracts table was originally created directly on the remote DB
--    and never captured in a migration. Create it here if missing so fresh
--    (local) databases can apply this migration. No-op where it already exists.
DO $$
BEGIN
  IF to_regclass('public.contracts') IS NULL THEN
    CREATE TABLE public.contracts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL CONSTRAINT contracts_type_check CHECK (type IN ('house', 'role', 'personal_role')),
      member_id TEXT NOT NULL,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ,
      room_link TEXT,
      role_name TEXT,
      discord_role_id TEXT,
      operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      operator_name TEXT,
      edit_log JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    );

    ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Admins can manage contracts"
      ON public.contracts FOR ALL
      TO authenticated
      USING ( public.has_page_access('contracts') )
      WITH CHECK ( public.has_page_access('contracts') );

    CREATE POLICY "Service role full access to contracts"
      ON public.contracts FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 1. Drop existing type check constraint
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_type_check;

-- 2. Add updated type check constraint supporting 'ad'
ALTER TABLE public.contracts ADD CONSTRAINT contracts_type_check CHECK (type IN ('house', 'role', 'personal_role', 'ad'));

-- 3. Add package_name column if not exists
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS package_name TEXT;
