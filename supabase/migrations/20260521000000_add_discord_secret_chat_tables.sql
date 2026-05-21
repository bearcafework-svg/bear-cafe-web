-- ═══════════════════════════════════════════════════════════════
-- Discord Secret Chat — Bot Metadata Tables
-- Privacy-first: NO message content is ever stored here.
-- All writes come from the Discord bot using the service role key.
-- ═══════════════════════════════════════════════════════════════

-- 1. Sessions — one row per matched pair
CREATE TABLE IF NOT EXISTS discord_secret_sessions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a             text        NOT NULL,   -- Discord user snowflake
  user_id_b             text        NOT NULL,   -- Discord user snowflake
  channel_id            text        NOT NULL,   -- Temporary Discord channel snowflake
  started_at            timestamptz NOT NULL DEFAULT now(),
  ended_at              timestamptz,
  leave_reason          text,                   -- 'timeout' | 'leave' | 'report' | 'channel_deleted'
  report_count          integer     NOT NULL DEFAULT 0,
  created_by_matchmaking boolean    NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_dss_user_a ON discord_secret_sessions (user_id_a);
CREATE INDEX IF NOT EXISTS idx_dss_user_b ON discord_secret_sessions (user_id_b);
CREATE INDEX IF NOT EXISTS idx_dss_channel ON discord_secret_sessions (channel_id);

-- 2. Reports — metadata only, no message content
CREATE TABLE IF NOT EXISTS discord_secret_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES discord_secret_sessions(id) ON DELETE CASCADE,
  reporter_id text        NOT NULL,   -- Discord user snowflake
  reported_id text        NOT NULL,   -- Discord user snowflake
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, reporter_id)    -- one report per user per session
);

CREATE INDEX IF NOT EXISTS idx_dsr_reported ON discord_secret_reports (reported_id);

-- 3. User moderation metadata — strike counter, ban flag
CREATE TABLE IF NOT EXISTS discord_user_moderation (
  user_id     text        PRIMARY KEY,  -- Discord user snowflake
  strike_count integer    NOT NULL DEFAULT 0,
  is_banned   boolean     NOT NULL DEFAULT false,
  banned_at   timestamptz,
  ban_reason  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dss_updated_at
  BEFORE UPDATE ON discord_secret_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_dum_updated_at
  BEFORE UPDATE ON discord_user_moderation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Increment strike helper (called by bot via rpc) ───────────
CREATE OR REPLACE FUNCTION increment_discord_strike(p_user_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO discord_user_moderation (user_id, strike_count)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET strike_count = discord_user_moderation.strike_count + 1,
        updated_at   = now();
END;
$$;

-- Also increment report_count on the session when a report is inserted
CREATE OR REPLACE FUNCTION trg_increment_session_report_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE discord_secret_sessions
  SET report_count = report_count + 1,
      updated_at   = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_report_count
  AFTER INSERT ON discord_secret_reports
  FOR EACH ROW EXECUTE FUNCTION trg_increment_session_report_count();

-- ── Row Level Security ────────────────────────────────────────
-- The bot uses the service role key and bypasses RLS entirely.
-- These policies protect the tables from direct client access.

ALTER TABLE discord_secret_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_secret_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_user_moderation    ENABLE ROW LEVEL SECURITY;

-- No authenticated user should read/write these tables directly.
-- Only the service role (bot) has access.
-- Admins can query via Supabase dashboard using service role.

-- Deny all for authenticated users (bot uses service role, bypasses RLS)
CREATE POLICY "dss_deny_all"  ON discord_secret_sessions  FOR ALL USING (false);
CREATE POLICY "dsr_deny_all"  ON discord_secret_reports   FOR ALL USING (false);
CREATE POLICY "dum_deny_all"  ON discord_user_moderation  FOR ALL USING (false);

-- Grant execute on the RPC function to service role only
-- (service_role bypasses RLS so no explicit grant needed,
--  but we revoke from anon/authenticated for safety)
REVOKE EXECUTE ON FUNCTION increment_discord_strike FROM anon, authenticated;
