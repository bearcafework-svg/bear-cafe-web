-- Add matched_user_id to sessions to track matched pair
ALTER TABLE public.sessions
ADD COLUMN matched_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_sessions_matched_user_id ON public.sessions(matched_user_id);

-- Allow matched users to view sessions
CREATE POLICY "Matched users can view sessions"
ON public.sessions FOR SELECT
TO authenticated
USING (
  matched_user_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
);

-- Create match queue table
CREATE TABLE public.match_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
    selected_role_id UUID REFERENCES public.discord_roles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (user_id)
);

ALTER TABLE public.match_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queue entry"
ON public.match_queue FOR SELECT
TO authenticated
USING (
  user_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
  OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin')
  OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'moderator')
);

CREATE POLICY "Users can manage own queue entry"
ON public.match_queue FOR ALL
TO authenticated
USING (
  user_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
)
WITH CHECK (
  user_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
);

CREATE INDEX idx_match_queue_category_id ON public.match_queue(category_id);
CREATE INDEX idx_match_queue_selected_role_id ON public.match_queue(selected_role_id);
CREATE INDEX idx_match_queue_created_at ON public.match_queue(created_at);
