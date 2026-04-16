-- Add columns for custom TL;DR and Do/Don't examples per category
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS tldr_points jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS do_dont_examples jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.categories.tldr_points IS 'Array of custom TL;DR summary points for this category';
COMMENT ON COLUMN public.categories.do_dont_examples IS 'Array of {doExample, dontExample} objects for this category';