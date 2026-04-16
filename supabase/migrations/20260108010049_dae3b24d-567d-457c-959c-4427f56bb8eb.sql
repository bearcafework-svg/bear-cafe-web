-- Create voice_states table to store real-time voice channel status
CREATE TABLE IF NOT EXISTS public.voice_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_user_id TEXT NOT NULL UNIQUE,
  channel_id TEXT,
  channel_name TEXT,
  guild_id TEXT NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_voice_states_discord_user_id ON public.voice_states(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_voice_states_channel_id ON public.voice_states(channel_id);

-- Enable RLS
ALTER TABLE public.voice_states ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read voice states (needed for the app to show status)
CREATE POLICY "Anyone can view voice states" 
ON public.voice_states 
FOR SELECT 
USING (true);

-- Enable realtime for voice_states
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_states;