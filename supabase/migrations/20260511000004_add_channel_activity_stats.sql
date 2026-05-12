-- ═══════════════════════════════════════════════════════════════
-- Channel Activity Stats
-- Stores message count snapshots for the reference channel
-- Updated by cron-smart-announcements every minute
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS channel_activity_stats (
  channel_id      text        PRIMARY KEY,
  channel_name    text,
  -- message counts per window (from latest 100 messages sample)
  count_24h       integer     NOT NULL DEFAULT 0,
  count_7d        integer     NOT NULL DEFAULT 0,
  count_30d       integer     NOT NULL DEFAULT 0,
  -- raw sample: timestamp of the oldest message in the last fetch
  oldest_sampled  timestamptz,
  -- when this snapshot was last updated
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channel_activity_stats ENABLE ROW LEVEL SECURITY;

-- Public read (admin page reads without service role)
CREATE POLICY "channel_activity_stats_read"
  ON channel_activity_stats FOR SELECT
  USING (true);

-- Only service role / admins can write
CREATE POLICY "channel_activity_stats_write"
  ON channel_activity_stats FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  );

-- Enable realtime so the admin page updates live
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'channel_activity_stats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE channel_activity_stats;
  END IF;
END $$;
