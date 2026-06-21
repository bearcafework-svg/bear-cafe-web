-- ─────────────────────────────────────────────────────────────────
-- session_ads: ระบบโฆษณาที่แทรกใน Component v2 ของ send-session-webhook
-- ภาพขนาด 1200x480 และลิงก์ที่ดึงไปใช้ตามลำดับ sort_order
-- ─────────────────────────────────────────────────────────────────

create table if not exists public.session_ads (
  id           uuid primary key default gen_random_uuid(),
  image_url    text not null,
  link_url     text not null,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index สำหรับการดึงข้อมูลเรียงลำดับ
create index if not exists session_ads_sort_order_idx
  on public.session_ads (sort_order asc)
  where is_active = true;

-- Auto-update updated_at
create or replace function public.set_session_ads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_session_ads_updated_at on public.session_ads;
create trigger trg_session_ads_updated_at
  before update on public.session_ads
  for each row execute function public.set_session_ads_updated_at();

-- RLS
alter table public.session_ads enable row level security;

-- Owner/admin อ่านได้ทุก row ผ่าน service role (Supabase function)
-- Frontend admin ใช้ service role key → bypass RLS
-- อ่านโดย public: ไม่อนุญาต (ดึงผ่าน Edge Function เท่านั้น)
create policy "service role full access"
  on public.session_ads
  for all
  to service_role
  using (true)
  with check (true);

-- Allow authenticated users (admin) to manage via supabase client
create policy "authenticated read session_ads"
  on public.session_ads
  for select
  to authenticated
  using (true);

create policy "authenticated insert session_ads"
  on public.session_ads
  for insert
  to authenticated
  with check (true);

create policy "authenticated update session_ads"
  on public.session_ads
  for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated delete session_ads"
  on public.session_ads
  for delete
  to authenticated
  using (true);
