-- Consolidated bootstrap schema + RLS for Bear Cafe
-- Fresh database bootstrap script derived from current app usage and Supabase migrations.
-- Recommended for a new project/database, not as a replay-safe migration on an existing DB.

create extension if not exists "pgcrypto";

-- ============================================================================
-- Enums
-- ============================================================================

do $$ begin
  create type public.app_role as enum ('admin', 'moderator', 'user');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.session_status as enum ('active', 'completed', 'cancelled', 'flagged', 'open');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.report_status as enum ('open', 'investigating', 'resolved', 'dismissed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.report_type as enum ('inappropriate_behavior', 'adult_content', 'spam', 'harassment', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tag_warn_cancel_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.gacha_reward_type as enum ('point', 'role', 'money', 'item', 'other');
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- Helper functions
-- ============================================================================

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_tag_warn_cancel_requests_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.get_jwt_discord_id()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    auth.jwt() -> 'user_metadata' ->> 'discord_id',
    auth.jwt() -> 'app_metadata' ->> 'discord_id',
    nullif(auth.jwt() ->> 'sub', '')
  );
$$;

-- ============================================================================
-- Core tables
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_id text not null unique,
  username text not null,
  discord_username text,
  avatar_url text,
  banner_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_session_at timestamptz,
  is_banned boolean not null default false,
  ban_reason text
);

create index if not exists idx_profiles_discord_id on public.profiles(discord_id);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  allowed_pages text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);

create table if not exists public.custom_permissions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  allowed_pages text[] not null default '{}',
  color text default '#6366f1',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_custom_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.custom_permissions(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, permission_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text not null default '📁',
  sort_order integer default 0,
  is_active boolean not null default true,
  allow_voice_channel boolean not null default true,
  require_role_selection boolean not null default false,
  rules_text text,
  tldr_points jsonb,
  do_dont_examples jsonb,
  fields_schema jsonb,
  mode text,
  subtitle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discord_roles (
  id uuid primary key default gen_random_uuid(),
  discord_role_id text not null unique,
  display_name text not null,
  emoji text,
  color text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discord_roles_display_name_not_blank check (btrim(display_name) <> ''),
  constraint discord_roles_discord_role_id_not_blank check (btrim(discord_role_id) <> ''),
  constraint discord_roles_description_not_blank check (description is null or btrim(description) <> '')
);

create table if not exists public.category_roles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  role_id uuid not null references public.discord_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (category_id, role_id)
);

create index if not exists idx_category_roles_category_id on public.category_roles(category_id);
create index if not exists idx_category_roles_role_id on public.category_roles(role_id);

create table if not exists public.rules_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rules_text text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  selected_role_id uuid references public.discord_roles(id) on delete set null,
  duration_minutes integer not null default 30,
  note text,
  voice_channel_id text,
  voice_channel_name text,
  include_voice_channel boolean not null default false,
  status public.session_status not null default 'active',
  discord_message_id text,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  matched_user_id uuid references public.profiles(id) on delete set null,
  session_mode text not null default 'dm',
  title text,
  max_participants integer,
  description text,
  constraint sessions_note_length check (note is null or char_length(note) <= 200)
);

create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_status on public.sessions(status);
create index if not exists idx_sessions_category_id on public.sessions(category_id);
create index if not exists idx_sessions_matched_user_id on public.sessions(matched_user_id);

create table if not exists public.match_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  selected_role_id uuid references public.discord_roles(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled')),
  matched_with uuid references public.profiles(id) on delete set null,
  matched_session_id uuid references public.sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_match_queue_category_id on public.match_queue(category_id);
create index if not exists idx_match_queue_selected_role_id on public.match_queue(selected_role_id);
create index if not exists idx_match_queue_created_at on public.match_queue(created_at desc);

create table if not exists public.banned_words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  category_id uuid references public.categories(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_banned_words_category_id on public.banned_words(category_id);

create table if not exists public.banned_discord_roles (
  id uuid primary key default gen_random_uuid(),
  discord_role_id text not null unique,
  role_name text not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists idx_banned_discord_roles_role_id on public.banned_discord_roles(discord_role_id);

create table if not exists public.non_transferable_roles (
  id uuid primary key default gen_random_uuid(),
  discord_role_id text not null unique,
  role_name text not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.role_transfer_logs (
  id uuid primary key default gen_random_uuid(),
  source_discord_id text not null,
  source_username text,
  target_discord_id text not null,
  target_username text,
  roles_transferred text[] not null default '{}',
  roles_skipped text[] not null default '{}',
  status text not null default 'pending',
  transferred_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  details jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_action_logs_user_id on public.action_logs(user_id);
create index if not exists idx_action_logs_created_at on public.action_logs(created_at desc);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  report_type public.report_type not null,
  description text not null,
  evidence_url text,
  status public.report_status not null default 'open',
  admin_notes text,
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, reporter_id)
);

create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_session_id on public.reports(session_id);

create table if not exists public.voice_states (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text not null unique,
  guild_id text not null,
  channel_id text,
  channel_name text,
  is_connected boolean not null default false,
  joined_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_voice_states_discord_user_id on public.voice_states(discord_user_id);
create index if not exists idx_voice_states_channel_id on public.voice_states(channel_id);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  title text,
  description text,
  link_url text,
  button_text text,
  button_url text,
  sort_order integer default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tag_warn_logs (
  id uuid primary key default gen_random_uuid(),
  barista_id text,
  member_id text,
  message text,
  punish text,
  punish_link text,
  image_url text,
  sequence integer not null default 0,
  log_timestamp text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.tag_warn_cancel_requests (
  id uuid primary key default gen_random_uuid(),
  warn_timestamp text not null,
  warn_sequence text,
  member_id text,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_by_name text,
  request_note text,
  status public.tag_warn_cancel_status not null default 'pending',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  external_sync_status text not null default 'pending' check (external_sync_status in ('pending', 'success', 'failed')),
  external_synced_at timestamptz,
  external_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tag_warn_cancel_requests_pending_unique
  on public.tag_warn_cancel_requests(warn_timestamp)
  where status = 'pending';

create table if not exists public.discord_user_cache (
  discord_id text primary key,
  username text,
  global_name text,
  avatar_url text,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.redeem_codes (
  code text primary key,
  reward_type text,
  points integer,
  role_id text,
  max_uses integer,
  used_count integer default 0,
  start_at timestamptz,
  end_at timestamptz,
  is_enabled boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.redeem_logs (
  id uuid primary key default gen_random_uuid(),
  code text references public.redeem_codes(code) on delete set null,
  discord_id text,
  reward_details jsonb,
  redeemed_at timestamptz default now()
);

create table if not exists public.user_points (
  discord_id text primary key,
  points integer not null default 0,
  max_cap integer not null default 0,
  updated_at timestamptz default now()
);

create table if not exists public.trading_history (
  id uuid primary key default gen_random_uuid(),
  member_id text not null,
  service_id text,
  transaction text,
  item text,
  amount numeric,
  type_bill text,
  slip_url text,
  slip_url_2 text,
  log_timestamp text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null,
  position text not null,
  status text not null default 'active',
  check_in_time timestamptz not null default now(),
  check_out_time timestamptz,
  note text,
  work_detail text
);

create table if not exists public.promotion_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_url text not null,
  image_url text,
  status text not null default 'pending',
  admin_note text,
  submitted_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  leave_type text not null,
  leave_date date not null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Lottery / gacha / server listing / healing
-- ============================================================================

create table if not exists public.lottery_rounds (
  id uuid primary key default gen_random_uuid(),
  round_number integer generated always as identity unique,
  status text default 'open',
  draw_date timestamptz not null,
  winning_number text,
  prize_details jsonb,
  ticket_price numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint lottery_rounds_winning_number_check check (winning_number is null or winning_number ~ '^[0-9]{6}$'),
  constraint lottery_rounds_status_check check (status in ('open', 'closed', 'announced', 'cancelled'))
);

create table if not exists public.lottery_tickets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.lottery_rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  number text not null,
  created_at timestamptz not null default now(),
  unique (round_id, number),
  constraint lottery_tickets_number_check check (number ~ '^[0-9]{6}$')
);

create index if not exists lottery_tickets_round_id_idx on public.lottery_tickets(round_id);
create index if not exists lottery_tickets_user_id_idx on public.lottery_tickets(user_id);
create index if not exists lottery_tickets_round_user_idx on public.lottery_tickets(round_id, user_id);

create table if not exists public.user_gacha_stats (
  discord_id text primary key,
  match_count integer not null default 0,
  gacha_coins integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gacha_rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.gacha_reward_type not null,
  value text,
  drop_rate numeric not null,
  max_limit integer,
  claimed_count integer default 0,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.increment_gacha_claimed_count(reward_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.gacha_rewards
  set claimed_count = coalesce(claimed_count, 0) + 1
  where id = reward_id;
end;
$$;

create table if not exists public.discord_server_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.discord_servers (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null unique,
  owner_id text not null,
  name text not null,
  description text,
  category_id uuid references public.discord_server_categories(id),
  member_count integer default 0,
  icon_url text,
  banner_url text,
  invite_url text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  qc_comment text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  bumped_at timestamptz default now(),
  click_count integer default 0,
  is_verified boolean not null default false,
  is_partner boolean not null default false,
  highlight_color text,
  carousel_order integer,
  notify_channel_id text
);

create index if not exists idx_discord_servers_featured on public.discord_servers(is_featured, bumped_at desc);

create table if not exists public.server_clicks (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.discord_servers(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique (server_id, user_id)
);

create table if not exists public.server_ratings (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.discord_servers(id) on delete cascade,
  user_id text not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (server_id, user_id)
);

create index if not exists idx_server_ratings_server_id on public.server_ratings(server_id);

create table if not exists public.server_click_stats (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.discord_servers(id) on delete cascade,
  stat_date date not null default current_date,
  click_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (server_id, stat_date)
);

create index if not exists idx_server_click_stats_server_date on public.server_click_stats(server_id, stat_date);

create table if not exists public.healing_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) <= 300),
  author_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_healing_messages_status_created_at on public.healing_messages(status, created_at desc);
create index if not exists idx_healing_messages_author_id_created_at on public.healing_messages(author_id, created_at desc);

create or replace function public.get_random_healing_message()
returns table (
  message text,
  discord_id text,
  username text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select
    hm.message,
    p.discord_id,
    p.username,
    p.avatar_url
  from public.healing_messages hm
  left join public.profiles p on p.id = hm.author_id
  where hm.status = 'approved'
  order by random()
  limit 1;
$$;

-- ============================================================================
-- Table-dependent auth / access helpers
-- ============================================================================

create or replace function public.get_profile_by_discord_id(_discord_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where discord_id = _discord_id
  limit 1;
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'moderator');
$$;

create or replace function public.has_page_access(_user_id uuid, _page text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(_user_id, 'moderator')
    or public.has_role(_user_id, 'admin')
    or exists (
      select 1
      from public.user_custom_permissions ucp
      join public.custom_permissions cp on cp.id = ucp.permission_id
      where ucp.user_id = _user_id
        and _page = any (cp.allowed_pages)
    );
$$;

create or replace function public.has_page_access(_page text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_page_access(auth.uid(), _page);
$$;

create or replace function public.jwt_has_page_access(_page text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_page_access(
    coalesce(public.get_profile_by_discord_id(public.get_jwt_discord_id()), auth.uid()),
    _page
  );
$$;

create or replace function public.has_active_session(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.sessions
    where user_id = _user_id
      and status in ('active', 'open')
  );
$$;

-- ============================================================================
-- Optional RPCs / maintenance helpers
-- ============================================================================

create or replace function public.cleanup_old_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
  set status = 'completed',
      completed_at = coalesce(completed_at, now())
  where status = 'active'
    and ends_at < now();
end;
$$;

create or replace function public.complete_expired_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _updated integer;
begin
  update public.sessions
  set status = 'completed',
      completed_at = coalesce(completed_at, now())
  where status = 'active'
    and ends_at < now();

  get diagnostics _updated = row_count;
  return _updated;
end;
$$;

create or replace function public.attempt_match(p_category_id uuid, p_role_id uuid, p_user_id uuid)
returns table (matched_user_id uuid, session_id uuid, success boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  other_user_id uuid;
  new_session_id uuid;
begin
  select mq.user_id
  into other_user_id
  from public.match_queue mq
  where mq.user_id <> p_user_id
    and mq.category_id is not distinct from p_category_id
    and mq.selected_role_id is not distinct from p_role_id
    and mq.status = 'waiting'
  order by mq.created_at asc
  limit 1
  for update skip locked;

  if other_user_id is null then
    return query select null::uuid, null::uuid, false;
    return;
  end if;

  insert into public.sessions (
    user_id,
    category_id,
    selected_role_id,
    duration_minutes,
    include_voice_channel,
    status,
    started_at,
    ends_at,
    matched_user_id,
    session_mode
  )
  values (
    p_user_id,
    p_category_id,
    p_role_id,
    30,
    false,
    'active',
    now(),
    now() + interval '30 minutes',
    other_user_id,
    'match'
  )
  returning id into new_session_id;

  update public.match_queue
  set status = 'matched',
      matched_with = other_user_id,
      matched_session_id = new_session_id,
      updated_at = now()
  where user_id = p_user_id;

  update public.match_queue
  set status = 'matched',
      matched_with = p_user_id,
      matched_session_id = new_session_id,
      updated_at = now()
  where user_id = other_user_id;

  return query select other_user_id, new_session_id, true;
end;
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

drop trigger if exists update_categories_updated_at on public.categories;
create trigger update_categories_updated_at
before update on public.categories
for each row execute function public.update_updated_at_column();

drop trigger if exists update_discord_roles_updated_at on public.discord_roles;
create trigger update_discord_roles_updated_at
before update on public.discord_roles
for each row execute function public.update_updated_at_column();

drop trigger if exists update_rules_presets_updated_at on public.rules_presets;
create trigger update_rules_presets_updated_at
before update on public.rules_presets
for each row execute function public.update_updated_at_column();

drop trigger if exists update_custom_permissions_updated_at on public.custom_permissions;
create trigger update_custom_permissions_updated_at
before update on public.custom_permissions
for each row execute function public.update_updated_at_column();

drop trigger if exists update_match_queue_updated_at on public.match_queue;
create trigger update_match_queue_updated_at
before update on public.match_queue
for each row execute function public.update_updated_at_column();

drop trigger if exists update_banners_updated_at on public.banners;
create trigger update_banners_updated_at
before update on public.banners
for each row execute function public.update_updated_at_column();

drop trigger if exists update_site_settings_updated_at on public.site_settings;
create trigger update_site_settings_updated_at
before update on public.site_settings
for each row execute function public.update_updated_at_column();

drop trigger if exists set_tag_warn_cancel_requests_updated_at on public.tag_warn_cancel_requests;
create trigger set_tag_warn_cancel_requests_updated_at
before update on public.tag_warn_cancel_requests
for each row execute function public.set_tag_warn_cancel_requests_updated_at();

drop trigger if exists update_lottery_rounds_updated_at on public.lottery_rounds;
create trigger update_lottery_rounds_updated_at
before update on public.lottery_rounds
for each row execute function public.update_updated_at_column();

drop trigger if exists update_user_gacha_stats_updated_at on public.user_gacha_stats;
create trigger update_user_gacha_stats_updated_at
before update on public.user_gacha_stats
for each row execute function public.update_updated_at_column();

drop trigger if exists update_gacha_rewards_updated_at on public.gacha_rewards;
create trigger update_gacha_rewards_updated_at
before update on public.gacha_rewards
for each row execute function public.update_updated_at_column();

drop trigger if exists update_discord_servers_updated_at on public.discord_servers;
create trigger update_discord_servers_updated_at
before update on public.discord_servers
for each row execute function public.update_updated_at_column();

drop trigger if exists set_server_ratings_updated_at on public.server_ratings;
create trigger set_server_ratings_updated_at
before update on public.server_ratings
for each row execute function public.update_updated_at_column();

drop trigger if exists set_server_click_stats_updated_at on public.server_click_stats;
create trigger set_server_click_stats_updated_at
before update on public.server_click_stats
for each row execute function public.update_updated_at_column();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.custom_permissions enable row level security;
alter table public.user_custom_permissions enable row level security;
alter table public.categories enable row level security;
alter table public.discord_roles enable row level security;
alter table public.category_roles enable row level security;
alter table public.rules_presets enable row level security;
alter table public.site_settings enable row level security;
alter table public.sessions enable row level security;
alter table public.match_queue enable row level security;
alter table public.banned_words enable row level security;
alter table public.banned_discord_roles enable row level security;
alter table public.non_transferable_roles enable row level security;
alter table public.role_transfer_logs enable row level security;
alter table public.action_logs enable row level security;
alter table public.reports enable row level security;
alter table public.voice_states enable row level security;
alter table public.banners enable row level security;
alter table public.tag_warn_logs enable row level security;
alter table public.tag_warn_cancel_requests enable row level security;
alter table public.discord_user_cache enable row level security;
alter table public.redeem_codes enable row level security;
alter table public.redeem_logs enable row level security;
alter table public.user_points enable row level security;
alter table public.trading_history enable row level security;
alter table public.work_sessions enable row level security;
alter table public.promotion_tasks enable row level security;
alter table public.leave_requests enable row level security;
alter table public.lottery_rounds enable row level security;
alter table public.lottery_tickets enable row level security;
alter table public.user_gacha_stats enable row level security;
alter table public.gacha_rewards enable row level security;
alter table public.discord_server_categories enable row level security;
alter table public.discord_servers enable row level security;
alter table public.server_clicks enable row level security;
alter table public.server_ratings enable row level security;
alter table public.server_click_stats enable row level security;
alter table public.healing_messages enable row level security;

-- Profiles
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
for select to authenticated
using (id = auth.uid() or has_page_access('users'));

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
for update to authenticated
using (id = auth.uid() or has_page_access('users'))
with check (id = auth.uid() or has_page_access('users'));

-- Roles / permissions
drop policy if exists "user_roles_read" on public.user_roles;
create policy "user_roles_read" on public.user_roles
for select to authenticated
using (user_id = auth.uid() or has_page_access('users'));

drop policy if exists "user_roles_manage" on public.user_roles;
create policy "user_roles_manage" on public.user_roles
for all to authenticated
using (has_page_access('users'))
with check (has_page_access('users'));

drop policy if exists "custom_permissions_read" on public.custom_permissions;
create policy "custom_permissions_read" on public.custom_permissions
for select to authenticated using (true);

drop policy if exists "custom_permissions_manage" on public.custom_permissions;
create policy "custom_permissions_manage" on public.custom_permissions
for all to authenticated
using (has_page_access('permissions'))
with check (has_page_access('permissions'));

drop policy if exists "user_custom_permissions_read" on public.user_custom_permissions;
create policy "user_custom_permissions_read" on public.user_custom_permissions
for select to authenticated
using (user_id = auth.uid() or has_page_access('permissions'));

drop policy if exists "user_custom_permissions_manage" on public.user_custom_permissions;
create policy "user_custom_permissions_manage" on public.user_custom_permissions
for all to authenticated
using (has_page_access('permissions'))
with check (has_page_access('permissions'));

-- Categories / roles / presets
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
for select to authenticated
using (is_active or has_page_access('categories'));

drop policy if exists "categories_manage" on public.categories;
create policy "categories_manage" on public.categories
for all to authenticated
using (has_page_access('categories'))
with check (has_page_access('categories'));

drop policy if exists "discord_roles_read" on public.discord_roles;
create policy "discord_roles_read" on public.discord_roles
for select to authenticated
using (is_active or has_page_access('roles'));

drop policy if exists "discord_roles_manage" on public.discord_roles;
create policy "discord_roles_manage" on public.discord_roles
for all to authenticated
using (has_page_access('roles'))
with check (has_page_access('roles'));

drop policy if exists "category_roles_read" on public.category_roles;
create policy "category_roles_read" on public.category_roles
for select to authenticated using (true);

drop policy if exists "category_roles_manage" on public.category_roles;
create policy "category_roles_manage" on public.category_roles
for all to authenticated
using (has_page_access('categories'))
with check (has_page_access('categories'));

drop policy if exists "rules_presets_read" on public.rules_presets;
create policy "rules_presets_read" on public.rules_presets
for select to authenticated using (true);

drop policy if exists "rules_presets_manage" on public.rules_presets;
create policy "rules_presets_manage" on public.rules_presets
for all to authenticated
using (has_page_access('categories'))
with check (has_page_access('categories'));

drop policy if exists "site_settings_read" on public.site_settings;
create policy "site_settings_read" on public.site_settings
for select to authenticated using (true);

drop policy if exists "site_settings_manage" on public.site_settings;
create policy "site_settings_manage" on public.site_settings
for all to authenticated
using (is_owner())
with check (is_owner());

-- Session flow
drop policy if exists "sessions_read" on public.sessions;
create policy "sessions_read" on public.sessions
for select to authenticated
using (user_id = auth.uid() or matched_user_id = auth.uid() or has_page_access('users'));

drop policy if exists "sessions_insert" on public.sessions;
create policy "sessions_insert" on public.sessions
for insert to authenticated
with check (user_id = auth.uid() and not exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.is_banned = true
));

drop policy if exists "sessions_update" on public.sessions;
create policy "sessions_update" on public.sessions
for update to authenticated
using (user_id = auth.uid() or has_page_access('users'))
with check (user_id = auth.uid() or has_page_access('users'));

drop policy if exists "match_queue_read" on public.match_queue;
create policy "match_queue_read" on public.match_queue
for select to authenticated using (true);

drop policy if exists "match_queue_manage_self" on public.match_queue;
create policy "match_queue_manage_self" on public.match_queue
for all to authenticated
using (user_id = auth.uid() or has_page_access('users'))
with check (user_id = auth.uid() or has_page_access('users'));

-- Moderation / admin
drop policy if exists "banned_words_read" on public.banned_words;
create policy "banned_words_read" on public.banned_words
for select to authenticated using (true);

drop policy if exists "banned_words_manage" on public.banned_words;
create policy "banned_words_manage" on public.banned_words
for all to authenticated
using (has_page_access('banned-words'))
with check (has_page_access('banned-words'));

drop policy if exists "banned_discord_roles_read" on public.banned_discord_roles;
create policy "banned_discord_roles_read" on public.banned_discord_roles
for select to authenticated using (true);

drop policy if exists "banned_discord_roles_manage" on public.banned_discord_roles;
create policy "banned_discord_roles_manage" on public.banned_discord_roles
for all to authenticated
using (has_page_access('banned-roles'))
with check (has_page_access('banned-roles'));

drop policy if exists "non_transferable_roles_read" on public.non_transferable_roles;
create policy "non_transferable_roles_read" on public.non_transferable_roles
for select to authenticated using (true);

drop policy if exists "non_transferable_roles_manage" on public.non_transferable_roles;
create policy "non_transferable_roles_manage" on public.non_transferable_roles
for all to authenticated
using (has_page_access('non-transferable-roles'))
with check (has_page_access('non-transferable-roles'));

drop policy if exists "role_transfer_logs_read" on public.role_transfer_logs;
create policy "role_transfer_logs_read" on public.role_transfer_logs
for select to authenticated
using (has_page_access('role-transfer'));

drop policy if exists "role_transfer_logs_insert" on public.role_transfer_logs;
create policy "role_transfer_logs_insert" on public.role_transfer_logs
for insert to authenticated
with check (has_page_access('role-transfer'));

drop policy if exists "role_transfer_logs_update" on public.role_transfer_logs;
create policy "role_transfer_logs_update" on public.role_transfer_logs
for update to authenticated
using (has_page_access('role-transfer'))
with check (has_page_access('role-transfer'));

drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports
for insert to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "reports_read" on public.reports;
create policy "reports_read" on public.reports
for select to authenticated
using (reporter_id = auth.uid() or reported_user_id = auth.uid() or has_page_access('reports'));

drop policy if exists "reports_manage" on public.reports;
create policy "reports_manage" on public.reports
for update to authenticated
using (has_page_access('reports'))
with check (has_page_access('reports'));

drop policy if exists "action_logs_read" on public.action_logs;
create policy "action_logs_read" on public.action_logs
for select to authenticated
using (has_page_access('users'));

drop policy if exists "voice_states_read" on public.voice_states;
create policy "voice_states_read" on public.voice_states
for select to authenticated using (true);

drop policy if exists "banners_public_read" on public.banners;
create policy "banners_public_read" on public.banners
for select to authenticated using (is_active or has_page_access('banners'));

drop policy if exists "banners_manage" on public.banners;
create policy "banners_manage" on public.banners
for all to authenticated
using (has_page_access('banners'))
with check (has_page_access('banners'));

drop policy if exists "tag_warn_logs_read" on public.tag_warn_logs;
create policy "tag_warn_logs_read" on public.tag_warn_logs
for select to authenticated
using (has_page_access('tag-warn'));

drop policy if exists "tag_warn_logs_manage" on public.tag_warn_logs;
create policy "tag_warn_logs_manage" on public.tag_warn_logs
for all to authenticated
using (has_page_access('tag-warn'))
with check (has_page_access('tag-warn'));

drop policy if exists "tag_warn_cancel_requests_read" on public.tag_warn_cancel_requests;
create policy "tag_warn_cancel_requests_read" on public.tag_warn_cancel_requests
for select to authenticated
using (requested_by = auth.uid() or has_page_access('tag-warn'));

drop policy if exists "tag_warn_cancel_requests_insert" on public.tag_warn_cancel_requests;
create policy "tag_warn_cancel_requests_insert" on public.tag_warn_cancel_requests
for insert to authenticated
with check (requested_by = auth.uid() or has_page_access('tag-warn'));

drop policy if exists "tag_warn_cancel_requests_update" on public.tag_warn_cancel_requests;
create policy "tag_warn_cancel_requests_update" on public.tag_warn_cancel_requests
for update to authenticated
using (has_page_access('tag-warn'))
with check (has_page_access('tag-warn'));

drop policy if exists "discord_user_cache_service_only" on public.discord_user_cache;
create policy "discord_user_cache_service_only" on public.discord_user_cache
for all to service_role
using (true)
with check (true);

drop policy if exists "redeem_codes_manage" on public.redeem_codes;
create policy "redeem_codes_manage" on public.redeem_codes
for all to authenticated
using (jwt_has_page_access('redeem-codes'))
with check (jwt_has_page_access('redeem-codes'));

drop policy if exists "redeem_logs_manage" on public.redeem_logs;
create policy "redeem_logs_manage" on public.redeem_logs
for all to authenticated
using (jwt_has_page_access('redeem-codes'))
with check (jwt_has_page_access('redeem-codes'));

drop policy if exists "user_points_manage" on public.user_points;
create policy "user_points_manage" on public.user_points
for all to authenticated
using (jwt_has_page_access('redeem-codes'))
with check (jwt_has_page_access('redeem-codes'));

drop policy if exists "trading_history_view" on public.trading_history;
create policy "trading_history_view" on public.trading_history
for select to authenticated
using (has_page_access('trading-history'));

drop policy if exists "trading_history_insert" on public.trading_history;
create policy "trading_history_insert" on public.trading_history
for insert to authenticated
with check (has_page_access('trading-history'));

drop policy if exists "trading_history_update" on public.trading_history;
create policy "trading_history_update" on public.trading_history
for update to authenticated
using (has_page_access('trading-history'))
with check (has_page_access('trading-history'));

drop policy if exists "trading_history_delete" on public.trading_history;
create policy "trading_history_delete" on public.trading_history
for delete to authenticated
using (is_owner());

drop policy if exists "work_sessions_read" on public.work_sessions;
create policy "work_sessions_read" on public.work_sessions
for select to authenticated
using (user_id = auth.uid() or has_page_access('staff'));

drop policy if exists "work_sessions_manage" on public.work_sessions;
create policy "work_sessions_manage" on public.work_sessions
for all to authenticated
using (user_id = auth.uid() or has_page_access('staff'))
with check (user_id = auth.uid() or has_page_access('staff'));

drop policy if exists "promotion_tasks_read" on public.promotion_tasks;
create policy "promotion_tasks_read" on public.promotion_tasks
for select to authenticated
using (user_id = auth.uid() or has_page_access('staff'));

drop policy if exists "promotion_tasks_manage" on public.promotion_tasks;
create policy "promotion_tasks_manage" on public.promotion_tasks
for all to authenticated
using (user_id = auth.uid() or has_page_access('staff'))
with check (user_id = auth.uid() or has_page_access('staff'));

drop policy if exists "leave_requests_read" on public.leave_requests;
create policy "leave_requests_read" on public.leave_requests
for select to authenticated
using (user_id = auth.uid() or has_page_access('staff'));

drop policy if exists "leave_requests_manage" on public.leave_requests;
create policy "leave_requests_manage" on public.leave_requests
for all to authenticated
using (user_id = auth.uid() or has_page_access('staff'))
with check (user_id = auth.uid() or has_page_access('staff'));

-- Lottery / gacha
drop policy if exists "lottery_rounds_read" on public.lottery_rounds;
create policy "lottery_rounds_read" on public.lottery_rounds
for select to authenticated using (true);

drop policy if exists "lottery_rounds_manage" on public.lottery_rounds;
create policy "lottery_rounds_manage" on public.lottery_rounds
for all to authenticated
using (has_page_access('lottery'))
with check (has_page_access('lottery'));

drop policy if exists "lottery_tickets_read" on public.lottery_tickets;
create policy "lottery_tickets_read" on public.lottery_tickets
for select to authenticated
using (user_id = auth.uid() or has_page_access('lottery'));

drop policy if exists "lottery_tickets_insert" on public.lottery_tickets;
create policy "lottery_tickets_insert" on public.lottery_tickets
for insert to authenticated
with check (user_id = auth.uid() or has_page_access('lottery'));

drop policy if exists "lottery_tickets_manage" on public.lottery_tickets;
create policy "lottery_tickets_manage" on public.lottery_tickets
for all to authenticated
using (has_page_access('lottery'))
with check (has_page_access('lottery'));

drop policy if exists "user_gacha_stats_read" on public.user_gacha_stats;
create policy "user_gacha_stats_read" on public.user_gacha_stats
for select to authenticated using (true);

drop policy if exists "user_gacha_stats_update_self" on public.user_gacha_stats;
create policy "user_gacha_stats_update_self" on public.user_gacha_stats
for update to authenticated
using (discord_id = (select p.discord_id from public.profiles p where p.id = auth.uid()))
with check (discord_id = (select p.discord_id from public.profiles p where p.id = auth.uid()));

drop policy if exists "user_gacha_stats_manage" on public.user_gacha_stats;
create policy "user_gacha_stats_manage" on public.user_gacha_stats
for all to authenticated
using (is_owner())
with check (is_owner());

drop policy if exists "gacha_rewards_read" on public.gacha_rewards;
create policy "gacha_rewards_read" on public.gacha_rewards
for select to authenticated using (true);

drop policy if exists "gacha_rewards_manage" on public.gacha_rewards;
create policy "gacha_rewards_manage" on public.gacha_rewards
for all to authenticated
using (is_owner())
with check (is_owner());

-- Discord servers
drop policy if exists "discord_server_categories_read" on public.discord_server_categories;
create policy "discord_server_categories_read" on public.discord_server_categories
for select to public using (true);

drop policy if exists "discord_server_categories_manage" on public.discord_server_categories;
create policy "discord_server_categories_manage" on public.discord_server_categories
for all to authenticated
using (is_owner())
with check (is_owner());

drop policy if exists "discord_servers_public_read" on public.discord_servers;
create policy "discord_servers_public_read" on public.discord_servers
for select to public
using (status = 'approved');

drop policy if exists "discord_servers_staff_read" on public.discord_servers;
create policy "discord_servers_staff_read" on public.discord_servers
for select to authenticated
using (is_owner() or auth.uid() in (select id from public.profiles where discord_id = owner_id));

drop policy if exists "discord_servers_insert_own" on public.discord_servers;
create policy "discord_servers_insert_own" on public.discord_servers
for insert to authenticated
with check (auth.uid() in (select id from public.profiles where discord_id = owner_id));

drop policy if exists "discord_servers_update_own" on public.discord_servers;
create policy "discord_servers_update_own" on public.discord_servers
for update to authenticated
using (is_owner() or auth.uid() in (select id from public.profiles where discord_id = owner_id))
with check (is_owner() or auth.uid() in (select id from public.profiles where discord_id = owner_id));

drop policy if exists "server_clicks_read" on public.server_clicks;
create policy "server_clicks_read" on public.server_clicks
for select to public using (true);

drop policy if exists "server_clicks_insert" on public.server_clicks;
create policy "server_clicks_insert" on public.server_clicks
for insert to authenticated
with check (true);

drop policy if exists "server_ratings_read" on public.server_ratings;
create policy "server_ratings_read" on public.server_ratings
for select to public using (true);

drop policy if exists "server_ratings_manage" on public.server_ratings;
create policy "server_ratings_manage" on public.server_ratings
for all to authenticated
using (true)
with check (true);

drop policy if exists "server_click_stats_read" on public.server_click_stats;
create policy "server_click_stats_read" on public.server_click_stats
for select to public using (true);

drop policy if exists "server_click_stats_manage" on public.server_click_stats;
create policy "server_click_stats_manage" on public.server_click_stats
for all to authenticated
using (true)
with check (true);

-- Healing messages
drop policy if exists "healing_messages_insert_own" on public.healing_messages;
create policy "healing_messages_insert_own" on public.healing_messages
for insert to authenticated
with check (author_id = auth.uid());

drop policy if exists "healing_messages_select" on public.healing_messages;
create policy "healing_messages_select" on public.healing_messages
for select to authenticated
using (status = 'approved' or author_id = auth.uid() or has_page_access('healing-messages'));

drop policy if exists "healing_messages_manage" on public.healing_messages;
create policy "healing_messages_manage" on public.healing_messages
for all to authenticated
using (has_page_access('healing-messages'))
with check (has_page_access('healing-messages'));

-- ============================================================================
-- Storage buckets / policies used by the app
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('icons', 'icons', true),
  ('banners', 'banners', true),
  ('warn-images', 'warn-images', true),
  ('slip-images', 'slip-images', true)
on conflict (id) do nothing;

drop policy if exists "storage_icons_public_read" on storage.objects;
create policy "storage_icons_public_read" on storage.objects
for select to public
using (bucket_id = 'icons');

drop policy if exists "storage_icons_auth_insert" on storage.objects;
create policy "storage_icons_auth_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'icons');

drop policy if exists "storage_icons_auth_update" on storage.objects;
create policy "storage_icons_auth_update" on storage.objects
for update to authenticated
using (bucket_id = 'icons')
with check (bucket_id = 'icons');

drop policy if exists "storage_icons_auth_delete" on storage.objects;
create policy "storage_icons_auth_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'icons');

drop policy if exists "storage_banners_public_read" on storage.objects;
create policy "storage_banners_public_read" on storage.objects
for select to public
using (bucket_id = 'banners');

drop policy if exists "storage_banners_manage" on storage.objects;
create policy "storage_banners_manage" on storage.objects
for all to authenticated
using (bucket_id = 'banners' and has_page_access('banners'))
with check (bucket_id = 'banners' and has_page_access('banners'));

drop policy if exists "storage_warn_images_public_read" on storage.objects;
create policy "storage_warn_images_public_read" on storage.objects
for select to public
using (bucket_id = 'warn-images');

drop policy if exists "storage_warn_images_insert" on storage.objects;
create policy "storage_warn_images_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'warn-images');

drop policy if exists "storage_warn_images_update" on storage.objects;
create policy "storage_warn_images_update" on storage.objects
for update to authenticated
using (bucket_id = 'warn-images' and owner = auth.uid())
with check (bucket_id = 'warn-images' and owner = auth.uid());

drop policy if exists "storage_warn_images_delete" on storage.objects;
create policy "storage_warn_images_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'warn-images' and owner = auth.uid());

drop policy if exists "storage_slip_images_public_read" on storage.objects;
create policy "storage_slip_images_public_read" on storage.objects
for select to public
using (bucket_id = 'slip-images');

drop policy if exists "storage_slip_images_manage_owner" on storage.objects;
create policy "storage_slip_images_manage_owner" on storage.objects
for all to authenticated
using (bucket_id = 'slip-images' and is_owner())
with check (bucket_id = 'slip-images' and is_owner());

-- ============================================================================
-- Seed data commonly expected by the UI
-- ============================================================================

insert into public.site_settings (key, value)
values
  ('trading_webhook_enabled', 'true'::jsonb),
  ('tag_warn_webhook_enabled', 'true'::jsonb)
on conflict (key) do nothing;
