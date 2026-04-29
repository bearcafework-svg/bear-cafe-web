-- Add image_url column to chat_music_tracks for vinyl disc artwork
ALTER TABLE chat_music_tracks
  ADD COLUMN IF NOT EXISTS image_url text;
