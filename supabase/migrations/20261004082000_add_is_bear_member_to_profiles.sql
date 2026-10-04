-- Add is_bear_member column to profiles table to track Bear Cafe server membership
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_bear_member boolean DEFAULT false;
