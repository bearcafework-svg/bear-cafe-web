-- Add banner_url column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN banner_url text;