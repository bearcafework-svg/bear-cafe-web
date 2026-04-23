-- Add category_id to banned_words table for category-specific banned words
-- NULL category_id means the word is banned globally across all categories
ALTER TABLE public.banned_words 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_banned_words_category_id ON public.banned_words(category_id);

-- Update RLS policy to allow authenticated users to view banned words for validation
DROP POLICY IF EXISTS "Moderators can view banned words" ON public.banned_words;
DROP POLICY IF EXISTS "Admins can view banned words" ON public.banned_words;
DROP POLICY IF EXISTS "Admins can manage banned words" ON public.banned_words;

-- Anyone can view banned words (needed for client-side validation)
DROP POLICY IF EXISTS "Anyone can view banned words" ON public.banned_words;
CREATE POLICY "Anyone can view banned words" 
ON public.banned_words 
FOR SELECT 
USING (true);

-- Admins can manage banned words
DROP POLICY IF EXISTS "Admins can manage banned words" ON public.banned_words;
CREATE POLICY "Admins can manage banned words" 
ON public.banned_words 
FOR ALL
USING (has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role));