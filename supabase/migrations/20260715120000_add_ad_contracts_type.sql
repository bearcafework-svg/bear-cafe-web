-- Migration: Support Advertising Contracts in Contracts Table
-- Date: 2026-07-15

-- 1. Drop existing type check constraint
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_type_check;

-- 2. Add updated type check constraint supporting 'ad'
ALTER TABLE public.contracts ADD CONSTRAINT contracts_type_check CHECK (type IN ('house', 'role', 'personal_role', 'ad'));

-- 3. Add package_name column if not exists
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS package_name TEXT;
