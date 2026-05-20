/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POINTS_API_URL: string;
  readonly VITE_TURNSTILE_SITE_KEY: string;

  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_SERVICE_ROLE_KEY?: string;

  readonly VITE_DISCORD_BOT_CLIENT_ID: string;
}
