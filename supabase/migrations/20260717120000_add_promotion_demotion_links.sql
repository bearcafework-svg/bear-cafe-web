-- Alter table staff_levels: Remove display_order and add promotion/demotion pathways
ALTER TABLE public.staff_levels DROP COLUMN IF EXISTS display_order;

ALTER TABLE public.staff_levels ADD COLUMN IF NOT EXISTS next_level_id uuid REFERENCES public.staff_levels(id) ON DELETE SET NULL;
ALTER TABLE public.staff_levels ADD COLUMN IF NOT EXISTS prev_level_id uuid REFERENCES public.staff_levels(id) ON DELETE SET NULL;
