-- Bear Cafe bootstrap: extensions, enums, shared functions

create extension if not exists "pgcrypto";

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

