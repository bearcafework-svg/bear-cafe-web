-- Create tag_warn_templates table
CREATE TABLE IF NOT EXISTS public.tag_warn_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tag_warn_templates_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.tag_warn_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for tag_warn_templates
CREATE POLICY "Allow all authenticated users to manage tag_warn_templates"
  ON public.tag_warn_templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create tag_warn_case_logs table
CREATE TABLE IF NOT EXISTS public.tag_warn_case_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  operator_id text NOT NULL,
  operator_name text NOT NULL,
  operator_avatar text,
  before_data jsonb,
  after_data jsonb,
  details text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tag_warn_case_logs_pkey PRIMARY KEY (id),
  CONSTRAINT tag_warn_case_logs_case_id_fkey FOREIGN KEY (case_id)
    REFERENCES public.tag_warn_logs (id) MATCH SIMPLE
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.tag_warn_case_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for tag_warn_case_logs
CREATE POLICY "Allow authenticated users to view tag_warn_case_logs"
  ON public.tag_warn_case_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert tag_warn_case_logs"
  ON public.tag_warn_case_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
