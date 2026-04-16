-- Add bot notification channel field to discord_servers
ALTER TABLE public.discord_servers
  ADD COLUMN IF NOT EXISTS notify_channel_id TEXT;
