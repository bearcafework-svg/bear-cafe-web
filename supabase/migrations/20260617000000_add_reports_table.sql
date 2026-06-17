-- Create enums (safe, skips if already exists)
DO $$ BEGIN
  CREATE TYPE public.report_type AS ENUM (
    'inappropriate_behavior',
    'adult_content',
    'spam',
    'harassment',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM (
    'open',
    'investigating',
    'resolved',
    'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  reporter_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_type      public.report_type  NOT NULL,
  description      text        NOT NULL,
  evidence_url     text,
  status           public.report_status NOT NULL DEFAULT 'open',
  admin_notes      text,
  handled_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  handled_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_status         ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_session_id     ON public.reports(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id    ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at     ON public.reports(created_at DESC);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Admins and moderators can read all reports
DROP POLICY IF EXISTS "Admins can read reports" ON public.reports;
CREATE POLICY "Admins can read reports"
  ON public.reports
  FOR SELECT
  USING (
    public.has_role(
      public.get_profile_by_discord_id(public.get_jwt_discord_id()),
      'admin'::public.app_role
    )
    OR public.has_role(
      public.get_profile_by_discord_id(public.get_jwt_discord_id()),
      'moderator'::public.app_role
    )
  );

-- Admins and moderators can update report status / notes
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
  ON public.reports
  FOR UPDATE
  USING (
    public.has_role(
      public.get_profile_by_discord_id(public.get_jwt_discord_id()),
      'admin'::public.app_role
    )
    OR public.has_role(
      public.get_profile_by_discord_id(public.get_jwt_discord_id()),
      'moderator'::public.app_role
    )
  );

-- Any authenticated user can submit a report against themselves (reporter_id = own id)
DROP POLICY IF EXISTS "Authenticated users can insert reports" ON public.reports;
CREATE POLICY "Authenticated users can insert reports"
  ON public.reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Reporter can read their own submitted reports
DROP POLICY IF EXISTS "Reporter can read own reports" ON public.reports;
CREATE POLICY "Reporter can read own reports"
  ON public.reports
  FOR SELECT
  USING (auth.uid() = reporter_id);
