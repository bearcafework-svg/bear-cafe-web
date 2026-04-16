-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create enum for session status
CREATE TYPE public.session_status AS ENUM ('active', 'completed', 'cancelled', 'flagged');

-- Create enum for report status
CREATE TYPE public.report_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');

-- Create enum for report type
CREATE TYPE public.report_type AS ENUM ('inappropriate_behavior', 'adult_content', 'spam', 'harassment', 'other');

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    last_session_at TIMESTAMP WITH TIME ZONE,
    is_banned BOOLEAN DEFAULT false NOT NULL,
    ban_reason TEXT
);

-- Create user_roles table for role management (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

-- Create categories table for dynamic category management
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT NOT NULL DEFAULT '📁',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true NOT NULL,
    allow_voice_channel BOOLEAN DEFAULT true NOT NULL,
    require_role_selection BOOLEAN DEFAULT false NOT NULL,
    rules_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create discord_roles table for Discord role management
CREATE TABLE public.discord_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_role_id TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    emoji TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create category_roles junction table (many-to-many relationship)
CREATE TABLE public.category_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
    role_id UUID REFERENCES public.discord_roles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (category_id, role_id)
);

-- Create sessions table for session tracking
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    selected_role_id UUID REFERENCES public.discord_roles(id) ON DELETE SET NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    note TEXT,
    voice_channel_id TEXT,
    voice_channel_name TEXT,
    include_voice_channel BOOLEAN DEFAULT false NOT NULL,
    status session_status DEFAULT 'active' NOT NULL,
    discord_message_id TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create banned_words table for content moderation
CREATE TABLE public.banned_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create reports table for session reporting
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    report_type report_type NOT NULL,
    description TEXT NOT NULL,
    evidence_url TEXT,
    status report_status DEFAULT 'open' NOT NULL,
    admin_notes TEXT,
    handled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    handled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (session_id, reporter_id) -- One report per session per user
);

-- Create action_logs table for audit trail
CREATE TABLE public.action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user profile by Discord ID
CREATE OR REPLACE FUNCTION public.get_profile_by_discord_id(_discord_id TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE discord_id = _discord_id LIMIT 1
$$;

-- Create function to check if user has active session
CREATE OR REPLACE FUNCTION public.has_active_session(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE user_id = _user_id
      AND status = 'active'
      AND ends_at > now()
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Anyone can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')));

-- RLS Policies for user_roles (admin only for modification)
CREATE POLICY "Anyone can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin'));

-- RLS Policies for categories (everyone can view, admin can modify)
CREATE POLICY "Anyone can view active categories"
ON public.categories FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin'));

CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL
TO authenticated
USING (public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin'));

-- RLS Policies for discord_roles
CREATE POLICY "Anyone can view active discord roles"
ON public.discord_roles FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin'));

CREATE POLICY "Authenticated discord users can view discord roles"
ON public.discord_roles FOR SELECT
TO authenticated
USING (auth.jwt()->>'discord_id' IS NOT NULL);

CREATE POLICY "Admins can manage discord roles"
ON public.discord_roles FOR ALL
TO authenticated
USING (public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin'));

-- RLS Policies for category_roles
CREATE POLICY "Anyone can view category roles"
ON public.category_roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated discord users can view category roles"
ON public.category_roles FOR SELECT
TO authenticated
USING (auth.jwt()->>'discord_id' IS NOT NULL);

CREATE POLICY "Admins can manage category roles"
ON public.category_roles FOR ALL
TO authenticated
USING (public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin'));

-- RLS Policies for sessions
CREATE POLICY "Users can view own sessions"
ON public.sessions FOR SELECT
TO authenticated
USING (
  user_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
  OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin')
  OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'moderator')
);

CREATE POLICY "Users can create own sessions"
ON public.sessions FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')));

CREATE POLICY "Users can update own sessions"
ON public.sessions FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
  OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin')
);

-- RLS Policies for banned_words
CREATE POLICY "Anyone can view banned words"
ON public.banned_words FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage banned words"
ON public.banned_words FOR ALL
TO authenticated
USING (public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin'));

-- RLS Policies for reports
CREATE POLICY "Users can view own reports or admins can view all"
ON public.reports FOR SELECT
TO authenticated
USING (
  reporter_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id'))
  OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin')
  OR public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'moderator')
);

CREATE POLICY "Users can create reports"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (reporter_id = (SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')));

CREATE POLICY "Admins can update reports"
ON public.reports FOR UPDATE
TO authenticated
USING (public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin'));

-- RLS Policies for action_logs
CREATE POLICY "Admins can view action logs"
ON public.action_logs FOR SELECT
TO authenticated
USING (public.has_role((SELECT public.get_profile_by_discord_id(auth.jwt()->>'discord_id')), 'admin'));

CREATE POLICY "Authenticated users can create logs"
ON public.action_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discord_roles_updated_at
BEFORE UPDATE ON public.discord_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_profiles_discord_id ON public.profiles(discord_id);
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_sessions_category_id ON public.sessions(category_id);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_session_id ON public.reports(session_id);
CREATE INDEX idx_category_roles_category_id ON public.category_roles(category_id);
CREATE INDEX idx_category_roles_role_id ON public.category_roles(role_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_action_logs_user_id ON public.action_logs(user_id);
CREATE INDEX idx_action_logs_created_at ON public.action_logs(created_at DESC);
