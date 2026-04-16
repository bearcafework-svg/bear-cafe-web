create table if not exists public.discord_user_cache (
  discord_id text primary key,
  username text,
  global_name text,
  avatar_url text,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.discord_user_cache enable row level security;
