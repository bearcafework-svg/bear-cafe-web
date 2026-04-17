-- Bear Cafe bootstrap: tables, indexes, table-dependent functions, triggers

-- Core identity
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
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);

-- Custom permissions
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

-- Content / configuration
create table if not exists public.site_settings (
  key text primary key,
  value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table if not exists public.banned_words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  category_id uuid references public.categories(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Sessions / voice
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

-- Reports / moderation
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

-- Banners (homepage)
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

-- Tag warn
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

-- Redeem / points
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

-- Trading
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

-- Staff
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

-- Roles: banned / transfer
create table if not exists public.banned_discord_roles (
  id uuid primary key default gen_random_uuid(),
  discord_role_id text not null unique,
  role_name text not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

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

-- Lottery
create table if not exists public.lottery_rounds (
  id uuid primary key default gen_random_uuid(),
  round_number integer generated always as identity unique,
  status text default 'open' check (status in ('open', 'closed', 'announced', 'cancelled')),
  draw_date timestamptz not null,
  winning_number text,
  prize_details jsonb,
  ticket_price numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint lottery_rounds_winning_number_check check (winning_number is null or winning_number ~ '^[0-9]{6}$')
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

-- Gacha
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

-- Discord server listing
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

create table if not exists public.server_click_stats (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.discord_servers(id) on delete cascade,
  stat_date date not null default current_date,
  click_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (server_id, stat_date)
);

-- Healing messages
create table if not exists public.healing_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) <= 300),
  author_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create or replace function public.get_random_healing_message()
returns table (message text, discord_id text, username text, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select hm.message, p.discord_id, p.username, p.avatar_url
  from public.healing_messages hm
  left join public.profiles p on p.id = hm.author_id
  where hm.status = 'approved'
  order by random()
  limit 1;
$$;

-- Table-dependent access helpers
create or replace function public.get_profile_by_discord_id(_discord_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where discord_id = _discord_id limit 1;
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role);
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
  select public.has_page_access(coalesce(public.get_profile_by_discord_id(public.get_jwt_discord_id()), auth.uid()), _page);
$$;

-- Triggers
drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at before update on public.profiles
for each row execute function public.update_updated_at_column();

drop trigger if exists update_categories_updated_at on public.categories;
create trigger update_categories_updated_at before update on public.categories
for each row execute function public.update_updated_at_column();

drop trigger if exists update_discord_roles_updated_at on public.discord_roles;
create trigger update_discord_roles_updated_at before update on public.discord_roles
for each row execute function public.update_updated_at_column();

drop trigger if exists update_custom_permissions_updated_at on public.custom_permissions;
create trigger update_custom_permissions_updated_at before update on public.custom_permissions
for each row execute function public.update_updated_at_column();

drop trigger if exists update_site_settings_updated_at on public.site_settings;
create trigger update_site_settings_updated_at before update on public.site_settings
for each row execute function public.update_updated_at_column();

drop trigger if exists update_sessions_updated_at on public.sessions;
create trigger update_sessions_updated_at before update on public.sessions
for each row execute function public.update_updated_at_column();

drop trigger if exists update_banners_updated_at on public.banners;
create trigger update_banners_updated_at before update on public.banners
for each row execute function public.update_updated_at_column();

drop trigger if exists set_tag_warn_cancel_requests_updated_at on public.tag_warn_cancel_requests;
create trigger set_tag_warn_cancel_requests_updated_at before update on public.tag_warn_cancel_requests
for each row execute function public.set_tag_warn_cancel_requests_updated_at();

drop trigger if exists update_lottery_rounds_updated_at on public.lottery_rounds;
create trigger update_lottery_rounds_updated_at before update on public.lottery_rounds
for each row execute function public.update_updated_at_column();

drop trigger if exists update_user_gacha_stats_updated_at on public.user_gacha_stats;
create trigger update_user_gacha_stats_updated_at before update on public.user_gacha_stats
for each row execute function public.update_updated_at_column();

drop trigger if exists update_gacha_rewards_updated_at on public.gacha_rewards;
create trigger update_gacha_rewards_updated_at before update on public.gacha_rewards
for each row execute function public.update_updated_at_column();

drop trigger if exists update_discord_servers_updated_at on public.discord_servers;
create trigger update_discord_servers_updated_at before update on public.discord_servers
for each row execute function public.update_updated_at_column();

drop trigger if exists set_server_ratings_updated_at on public.server_ratings;
create trigger set_server_ratings_updated_at before update on public.server_ratings
for each row execute function public.update_updated_at_column();

drop trigger if exists set_server_click_stats_updated_at on public.server_click_stats;
create trigger set_server_click_stats_updated_at before update on public.server_click_stats
for each row execute function public.update_updated_at_column();

