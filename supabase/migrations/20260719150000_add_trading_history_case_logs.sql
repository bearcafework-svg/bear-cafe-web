-- 1. สร้างตาราง trading_history_case_logs
CREATE TABLE IF NOT EXISTS public.trading_history_case_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  record_id text NOT NULL,
  record_source text NOT NULL, -- 'legacy' (trading_history) หรือ 'new' (orders)
  operator_id text NOT NULL,
  operator_name text NOT NULL,
  operator_avatar text,
  before_data jsonb,
  after_data jsonb,
  details text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trading_history_case_logs_pkey PRIMARY KEY (id)
);

ALTER TABLE public.trading_history_case_logs ENABLE ROW LEVEL SECURITY;

-- 2. สร้างนโยบาย RLS (Row Level Security) สำหรับความปลอดภัย
CREATE POLICY "Allow authenticated users to view trading_history_case_logs"
  ON public.trading_history_case_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert trading_history_case_logs"
  ON public.trading_history_case_logs FOR INSERT TO authenticated WITH CHECK (true);
