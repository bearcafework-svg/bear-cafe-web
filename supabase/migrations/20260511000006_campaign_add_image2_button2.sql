-- ═══════════════════════════════════════════════════════════════
-- Add second image and second button to campaign_messages
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE campaign_messages
  ADD COLUMN IF NOT EXISTS image_url_2       text
    CHECK (image_url_2 IS NULL OR image_url_2 ~* '^https?://'),

  ADD COLUMN IF NOT EXISTS button_2_label    text
    CHECK (button_2_label IS NULL OR char_length(button_2_label) <= 80),

  ADD COLUMN IF NOT EXISTS button_2_url      text
    CHECK (button_2_url IS NULL OR button_2_url ~* '^https?://'),

  ADD COLUMN IF NOT EXISTS button_2_emoji_id   text
    CHECK (button_2_emoji_id IS NULL OR button_2_emoji_id ~ '^\d+$'),

  ADD COLUMN IF NOT EXISTS button_2_emoji_name text
    CHECK (button_2_emoji_name IS NULL OR char_length(button_2_emoji_name) <= 32);
