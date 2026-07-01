-- Dev-only: grant CRUD on all public tables to anon/authenticated.
-- Applied after migrations via `npm run supabase:start` (not deployed to remote).
-- RLS policies still control row-level access.

DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon, authenticated, public, service_role, postgres;',
      tbl.tablename
    );
  END LOOP;
END $$;
