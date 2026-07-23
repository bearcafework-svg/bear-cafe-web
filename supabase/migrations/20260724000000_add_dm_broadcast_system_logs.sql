-- Migration: Add dm_broadcast_system_logs table for Thai live bot status logs

CREATE TABLE IF NOT EXISTS public.dm_broadcast_system_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    queue_id UUID REFERENCES public.dm_broadcast_queues(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'info',
    message_th TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dm_broadcast_system_logs ENABLE ROW LEVEL SECURITY;

-- Allow public / authenticated / anon read and insert
CREATE POLICY "Allow public read dm_broadcast_system_logs" ON public.dm_broadcast_system_logs
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert dm_broadcast_system_logs" ON public.dm_broadcast_system_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete dm_broadcast_system_logs" ON public.dm_broadcast_system_logs
    FOR DELETE USING (true);
