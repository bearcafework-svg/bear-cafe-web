-- Inventory System
-- Items are admin-managed (inserted via SQL/migrations only).
-- Users accumulate items via add_inventory_item_to_user().

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table if not exists public.inventory_items (
  id          uuid primary key default gen_random_uuid(),
  item_key    text not null unique,           -- stable identifier used in code
  name        text not null,
  description text,
  rarity      text not null default 'common', -- common | uncommon | rare | epic | legendary
  max_stack   int  not null default 99,
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_inventories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item_id    uuid not null references public.inventory_items(id),
  quantity   int  not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

-- ─── Helper function ──────────────────────────────────────────────────────────
-- Grants qty of item_id to user_id.
-- source: 'grant' | 'checkin' | etc. (stored in note)
-- Respects max_stack. Raises exception if stack would overflow.

create or replace function public.add_inventory_item_to_user(
  p_user_id  uuid,
  p_item_id  uuid,
  p_qty      int,
  p_source   text default 'grant',
  p_note     text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_max_stack int;
  v_current   int;
begin
  select max_stack into v_max_stack
  from public.inventory_items
  where id = p_item_id and is_active = true;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  select coalesce(quantity, 0) into v_current
  from public.user_inventories
  where user_id = p_user_id and item_id = p_item_id;

  if v_current is null then
    v_current := 0;
  end if;

  if v_current + p_qty > v_max_stack then
    raise exception 'inventory_stack_full';
  end if;

  insert into public.user_inventories (user_id, item_id, quantity, updated_at)
  values (p_user_id, p_item_id, p_qty, now())
  on conflict (user_id, item_id)
  do update set
    quantity   = public.user_inventories.quantity + excluded.quantity,
    updated_at = now();
end;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.inventory_items enable row level security;
alter table public.user_inventories enable row level security;

-- inventory_items: public read, admin write
create policy "Anyone can view inventory_items"
  on public.inventory_items for select
  using (true);

create policy "Admins can insert inventory_items"
  on public.inventory_items for insert
  with check (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

create policy "Admins can update inventory_items"
  on public.inventory_items for update
  using (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  )
  with check (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

create policy "Admins can delete inventory_items"
  on public.inventory_items for delete
  using (
    has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'admin'::app_role)
    or has_role(get_profile_by_discord_id(get_jwt_discord_id()), 'moderator'::app_role)
  );

-- user_inventories: users see their own rows; writes via service role only
create policy "Users can view own inventory"
  on public.user_inventories for select
  using (
    user_id = get_profile_by_discord_id(get_jwt_discord_id())
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists idx_user_inventories_user_id on public.user_inventories(user_id);
create index if not exists idx_user_inventories_item_id on public.user_inventories(item_id);
