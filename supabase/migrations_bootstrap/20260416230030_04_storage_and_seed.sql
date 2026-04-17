-- Bear Cafe bootstrap: storage buckets/policies + seed settings

insert into storage.buckets (id, name, public)
values
  ('icons', 'icons', true),
  ('banners', 'banners', true),
  ('warn-images', 'warn-images', true),
  ('slip-images', 'slip-images', true)
on conflict (id) do nothing;

-- icons bucket
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

-- banners bucket (managed by page access)
drop policy if exists "storage_banners_public_read" on storage.objects;
create policy "storage_banners_public_read" on storage.objects
for select to public
using (bucket_id = 'banners');

drop policy if exists "storage_banners_manage" on storage.objects;
create policy "storage_banners_manage" on storage.objects
for all to authenticated
using (bucket_id = 'banners' and has_page_access('banners'))
with check (bucket_id = 'banners' and has_page_access('banners'));

-- warn-images bucket
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

-- slip-images bucket (owner-only manage)
drop policy if exists "storage_slip_images_public_read" on storage.objects;
create policy "storage_slip_images_public_read" on storage.objects
for select to public
using (bucket_id = 'slip-images');

drop policy if exists "storage_slip_images_manage_owner" on storage.objects;
create policy "storage_slip_images_manage_owner" on storage.objects
for all to authenticated
using (bucket_id = 'slip-images' and is_owner())
with check (bucket_id = 'slip-images' and is_owner());

-- Seed settings used by UI toggles
insert into public.site_settings (key, value)
values
  ('trading_webhook_enabled', 'true'::jsonb),
  ('tag_warn_webhook_enabled', 'true'::jsonb)
on conflict (key) do nothing;

