-- ═══════════════════════════════════════════════════════════════
-- Sticky Channels — Discord Sticky Component v2 Messages
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sticky_channels (
  channel_id      text        PRIMARY KEY,
  delay_ms        integer     NOT NULL DEFAULT 6000 CHECK (delay_ms >= 500 AND delay_ms <= 300000),
  payload         jsonb       NOT NULL,
  refresh_trigger integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Auto-update updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_sticky_channels_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sticky_channels_updated_at ON sticky_channels;
CREATE TRIGGER trg_sticky_channels_updated_at
  BEFORE UPDATE ON sticky_channels
  FOR EACH ROW EXECUTE FUNCTION update_sticky_channels_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE sticky_channels ENABLE ROW LEVEL SECURITY;

-- Admins / moderators / users with custom permissions can do everything
DROP POLICY IF EXISTS "sticky_channels_admin_all" ON sticky_channels;
CREATE POLICY "sticky_channels_admin_all"
  ON sticky_channels FOR ALL
  USING (
    public.jwt_has_page_access('sticky-messages')
  )
  WITH CHECK (
    public.jwt_has_page_access('sticky-messages')
  );

-- Service role and authenticated users can read (including Discord bot)
DROP POLICY IF EXISTS "sticky_channels_select" ON sticky_channels;
CREATE POLICY "sticky_channels_select"
  ON sticky_channels FOR SELECT
  USING (true);

-- ─── Enable Supabase Realtime Replication ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sticky_channels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sticky_channels;
  END IF;
END $$;
