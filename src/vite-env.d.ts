/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POINTS_API_URL: string;
  readonly VITE_TURNSTILE_SITE_KEY: string;

  // Supabase env vars may use `VITE_SUPABASE_PUBLISHABLE_KEY` instead of `VITE_SUPABASE_ANON_KEY`.
  // Keep them optional so TS doesn't force both keys.
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;

  readonly VITE_DISCORD_BOT_CLIENT_ID: string;
}
