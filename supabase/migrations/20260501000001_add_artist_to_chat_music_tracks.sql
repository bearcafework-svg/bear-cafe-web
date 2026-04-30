-- Add artist column to chat_music_tracks
ALTER TABLE chat_music_tracks
  ADD COLUMN IF NOT EXISTS artist text;
