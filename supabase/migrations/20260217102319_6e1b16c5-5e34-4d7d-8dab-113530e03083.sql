
-- Add session_mode column to sessions table
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS session_mode text NOT NULL DEFAULT 'dm';

-- Add comment for clarity
COMMENT ON COLUMN public.sessions.session_mode IS 'dm = private chat, voice_room = join voice channel';
