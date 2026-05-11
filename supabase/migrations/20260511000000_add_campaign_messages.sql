-- ═══════════════════════════════════════════════════════════════
-- Campaign Messages — Smart Automated Announcement System
-- Discord Component-Based Ad Campaigns (type 17 container)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS campaign_messages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ─── Identity ───────────────────────────────────────────────
  internal_name     text        NOT NULL CHECK (char_length(internal_name) BETWEEN 1 AND 100),

  -- ─── Content ────────────────────────────────────────────────
  content_text      text        NOT NULL CHECK (char_length(content_text) BETWEEN 1 AND 2000),
  image_url         text        CHECK (image_url IS NULL OR image_url ~* '^https?://'),

  -- ─── Button (optional) ──────────────────────────────────────
  has_button        boolean     NOT NULL DEFAULT false,
  button_label      text        CHECK (
                                  (has_button = false AND button_label IS NULL)
                                  OR (has_button = true AND char_length(button_label) BETWEEN 1 AND 80)
                                ),
  button_url        text        CHECK (
                                  (has_button = false AND button_url IS NULL)
                                  OR (has_button = true AND button_url ~* '^https?://')
                                ),
  button_emoji_id   text        CHECK (button_emoji_id IS NULL OR button_emoji_id ~ '^\d+$'),
  button_emoji_name text        CHECK (button_emoji_name IS NULL OR char_length(button_emoji_name) <= 32),

  -- ─── Targeting ──────────────────────────────────────────────
  target_channels   text[]      NOT NULL DEFAULT '{}',

  -- ─── Scheduling / State ─────────────────────────────────────
  sort_order        integer     NOT NULL DEFAULT 0,
  is_active         boolean     NOT NULL DEFAULT true,
  last_sent_at      timestamptz,

  -- ─── Audit ──────────────────────────────────────────────────
  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── Auto-update updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_campaign_messages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_campaign_messages_updated_at
  BEFORE UPDATE ON campaign_messages
  FOR EACH ROW EXECUTE FUNCTION update_campaign_messages_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_campaign_messages_is_active
  ON campaign_messages (is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_last_sent_at
  ON campaign_messages (last_sent_at);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;

-- Admins / moderators can do everything
CREATE POLICY "campaign_messages_admin_all"
  ON campaign_messages FOR ALL
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

-- Service role (edge functions) can read active campaigns
CREATE POLICY "campaign_messages_service_read"
  ON campaign_messages FOR SELECT
  USING (true);

-- ─── Storage bucket for campaign images ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-images',
  'campaign-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "campaign_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-images');

-- Admin upload
CREATE POLICY "campaign_images_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'campaign-images'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  );

-- Admin delete
CREATE POLICY "campaign_images_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'campaign-images'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
  );
