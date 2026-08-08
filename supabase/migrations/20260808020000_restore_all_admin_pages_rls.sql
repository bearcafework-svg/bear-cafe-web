-- Migration: Safe & Complete RLS Restoration for ALL /admin Pages
-- Date: 2026-08-08

-- ══════════════════════════════════════════════════════════════════════════════
-- Helper Function: Safe RLS & Policy Creator (skips non-existent tables)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.safe_enable_rls_and_policy(
  p_table text,
  p_page_permission text,
  p_public_select boolean DEFAULT true
) RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = p_table) THEN
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Public select ' || p_table, p_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Staff select ' || p_table, p_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Staff manage ' || p_table, p_table);

    IF p_public_select THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO public USING (true)', 'Public select ' || p_table, p_table);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_page_access(%L))', 'Staff select ' || p_table, p_table, p_page_permission);
    END IF;

    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_page_access(%L)) WITH CHECK (public.has_page_access(%L))', 'Staff manage ' || p_table, p_table, p_page_permission, p_page_permission);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- Apply Policies Safely Across All Admin Tables
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. BANNED DISCORD ROLES ('banned-roles')
SELECT public.safe_enable_rls_and_policy('banned_discord_roles', 'banned-roles', true);

-- 2. BANNED NAMES ('banned-name')
SELECT public.safe_enable_rls_and_policy('banned_name', 'banned-name', true);

-- 3. TAG WARN LOGS & CANCEL REQUESTS & TEMPLATES ('tag-warn')
SELECT public.safe_enable_rls_and_policy('tag_warn_logs', 'tag-warn', true);
SELECT public.safe_enable_rls_and_policy('tag_warn_cancel_requests', 'tag-warn', false);
SELECT public.safe_enable_rls_and_policy('tag_warn_templates', 'tag-warn', false);

-- 4. HEALING MESSAGES ('healing-messages')
SELECT public.safe_enable_rls_and_policy('healing_messages', 'healing-messages', true);

-- 5. REPORTS ('reports')
SELECT public.safe_enable_rls_and_policy('reports', 'reports', false);

-- 6. BANNERS & AD PLACEMENTS & SESSION ADS ('banners')
SELECT public.safe_enable_rls_and_policy('banners', 'banners', true);
SELECT public.safe_enable_rls_and_policy('ad_placements', 'banners', true);
SELECT public.safe_enable_rls_and_policy('session_ads', 'banners', true);

-- 7. CHECKIN DAILY & BIG REWARDS ('checkin-rewards')
SELECT public.safe_enable_rls_and_policy('checkin_daily_rewards', 'checkin-rewards', true);
SELECT public.safe_enable_rls_and_policy('checkin_big_reward', 'checkin-rewards', true);

-- 8. REDEEM CODES ('redeem-codes')
SELECT public.safe_enable_rls_and_policy('redeem_codes', 'redeem-codes', false);

-- 9. NON TRANSFERABLE ROLES ('non-transferable-roles')
SELECT public.safe_enable_rls_and_policy('non_transferable_roles', 'non-transferable-roles', true);

-- 10. ROLES TO DELETE ON TRANSFER ('roles-to-delete')
SELECT public.safe_enable_rls_and_policy('roles_to_delete_on_transfer', 'roles-to-delete', true);

-- 11. DISCORD SERVERS & CATEGORIES ('discord-servers')
SELECT public.safe_enable_rls_and_policy('discord_servers', 'discord-servers', true);
SELECT public.safe_enable_rls_and_policy('discord_server_categories', 'discord-servers', true);

-- 12. CAMPAIGNS ('campaigns')
SELECT public.safe_enable_rls_and_policy('campaign_messages', 'campaigns', false);
SELECT public.safe_enable_rls_and_policy('campaign_schedule_config', 'campaigns', false);

-- 13. PRODUCT CATALOG ('product-catalog')
SELECT public.safe_enable_rls_and_policy('product_catalog', 'product-catalog', true);

-- 14. DM BROADCAST LOGS ('dm-broadcast')
SELECT public.safe_enable_rls_and_policy('dm_broadcast_logs', 'dm-broadcast', false);

-- 15. STAFF MEMBERS & STAFF PROMOTIONS ('manage-staff')
SELECT public.safe_enable_rls_and_policy('staff_members', 'manage-staff', true);
SELECT public.safe_enable_rls_and_policy('staff_promotions', 'manage-staff', true);

-- 16. STICKY CHANNELS ('sticky-messages')
SELECT public.safe_enable_rls_and_policy('sticky_channels', 'sticky-messages', true);

-- 17. ROLE TRANSFERS ('role-transfer')
SELECT public.safe_enable_rls_and_policy('role_transfers', 'role-transfer', false);

-- Cleanup helper function after setup
DROP FUNCTION IF EXISTS public.safe_enable_rls_and_policy(text, text, boolean);

-- ══════════════════════════════════════════════════════════════════════════════
-- 18. STORAGE BUCKETS (banners, session-ads, product-images, warn-images)
-- ══════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('banners', 'banners', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  ('session-ads', 'session-ads', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  ('product-images', 'product-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  ('warn-images', 'warn-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "storage_banners_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_banners_manage" ON storage.objects;
CREATE POLICY "storage_banners_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'banners');
CREATE POLICY "storage_banners_manage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'banners' AND (public.has_page_access('banners') OR public.is_owner()))
  WITH CHECK (bucket_id = 'banners' AND (public.has_page_access('banners') OR public.is_owner()));

DROP POLICY IF EXISTS "storage_session_ads_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_session_ads_manage" ON storage.objects;
CREATE POLICY "storage_session_ads_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'session-ads');
CREATE POLICY "storage_session_ads_manage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'session-ads' AND (public.has_page_access('banners') OR public.has_page_access('campaigns') OR public.is_owner()))
  WITH CHECK (bucket_id = 'session-ads' AND (public.has_page_access('banners') OR public.has_page_access('campaigns') OR public.is_owner()));

DROP POLICY IF EXISTS "storage_product_images_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_product_images_manage" ON storage.objects;
CREATE POLICY "storage_product_images_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'product-images');
CREATE POLICY "storage_product_images_manage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND (public.has_page_access('product-catalog') OR public.is_owner()))
  WITH CHECK (bucket_id = 'product-images' AND (public.has_page_access('product-catalog') OR public.is_owner()));

DROP POLICY IF EXISTS "storage_warn_images_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_warn_images_manage" ON storage.objects;
CREATE POLICY "storage_warn_images_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'warn-images');
CREATE POLICY "storage_warn_images_manage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'warn-images' AND (public.has_page_access('tag-warn') OR public.is_owner()))
  WITH CHECK (bucket_id = 'warn-images' AND (public.has_page_access('tag-warn') OR public.is_owner()));
