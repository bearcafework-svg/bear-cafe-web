-- Migration: Fix contracts_type_check constraint, contract-icons bucket, and trading_history / orders / storage RLS policies
-- Date: 2026-08-08

-- 1. Update contracts_type_check constraint to allow 'boost_role'
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_type_check;

ALTER TABLE public.contracts ADD CONSTRAINT contracts_type_check 
  CHECK (type IN ('house', 'role', 'personal_role', 'ad', 'boost_role'));

-- 2. Setup contract-icons storage bucket for contract type icons
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-icons', 
  'contract-icons', 
  true, 
  5242880, 
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

DROP POLICY IF EXISTS "Allow public view of contract-icons" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated management of contract-icons" ON storage.objects;

CREATE POLICY "Allow public view of contract-icons"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'contract-icons' );

CREATE POLICY "Allow authenticated management of contract-icons"
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'contract-icons' )
WITH CHECK ( bucket_id = 'contract-icons' );

-- 3. Update is_owner() helper to check both auth.uid() and JWT discord_id
DROP FUNCTION IF EXISTS public.is_owner() CASCADE;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
DECLARE
  v_discord_id TEXT;
BEGIN
  -- Check native auth.uid()
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'moderator'::public.app_role
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check JWT discord_id
  v_discord_id := public.get_jwt_discord_id();
  IF v_discord_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE p.discord_id = v_discord_id
      AND ur.role = 'moderator'::public.app_role
    );
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update has_page_access() helper function
DROP FUNCTION IF EXISTS public.has_page_access(text) CASCADE;

CREATE OR REPLACE FUNCTION public.has_page_access(_page text)
RETURNS BOOLEAN AS $$
DECLARE
  v_discord_id TEXT;
  v_profile_id UUID;
BEGIN
  -- Owner always has access
  IF public.is_owner() THEN
    RETURN TRUE;
  END IF;

  -- Check via auth.uid()
  IF EXISTS (
    SELECT 1
    FROM public.user_custom_permissions ucp
    JOIN public.custom_permissions cp ON ucp.permission_id = cp.id
    WHERE ucp.user_id = auth.uid()
    AND _page = ANY(cp.allowed_pages)
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check via JWT discord_id
  v_discord_id := public.get_jwt_discord_id();
  IF v_discord_id IS NOT NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE discord_id = v_discord_id LIMIT 1;
    IF v_profile_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.user_custom_permissions ucp
        JOIN public.custom_permissions cp ON ucp.permission_id = cp.id
        WHERE ucp.user_id = v_profile_id
        AND _page = ANY(cp.allowed_pages)
      ) THEN
        RETURN TRUE;
      END IF;
    END IF;
  END IF;

  -- Fallback to jwt_has_page_access
  RETURN public.jwt_has_page_access(_page);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Enable RLS and set policies on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can select orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Owner can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can select orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can delete orders" ON public.orders;

CREATE POLICY "Staff can select orders" ON public.orders FOR SELECT TO authenticated
  USING ( public.has_page_access('trading-history') );

CREATE POLICY "Staff can insert orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK ( public.has_page_access('trading-history') );

CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE TO authenticated
  USING ( public.has_page_access('trading-history') )
  WITH CHECK ( public.has_page_access('trading-history') );

CREATE POLICY "Staff can delete orders" ON public.orders FOR DELETE TO authenticated
  USING ( public.has_page_access('trading-history') );

-- 6. Enable RLS and set policies on purchase_items table
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can select purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Admins can insert purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Admins can update purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Owner can delete purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Staff can select purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Staff can insert purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Staff can update purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Staff can delete purchase_items" ON public.purchase_items;

CREATE POLICY "Staff can select purchase_items" ON public.purchase_items FOR SELECT TO authenticated
  USING ( public.has_page_access('trading-history') );

CREATE POLICY "Staff can insert purchase_items" ON public.purchase_items FOR INSERT TO authenticated
  WITH CHECK ( public.has_page_access('trading-history') );

CREATE POLICY "Staff can update purchase_items" ON public.purchase_items FOR UPDATE TO authenticated
  USING ( public.has_page_access('trading-history') )
  WITH CHECK ( public.has_page_access('trading-history') );

CREATE POLICY "Staff can delete purchase_items" ON public.purchase_items FOR DELETE TO authenticated
  USING ( public.has_page_access('trading-history') );

-- 7. Enable RLS and set policies on trading_history table
ALTER TABLE public.trading_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Page access: view trading history" ON public.trading_history;
DROP POLICY IF EXISTS "Page access: insert trading history" ON public.trading_history;
DROP POLICY IF EXISTS "Page access: update trading history" ON public.trading_history;
DROP POLICY IF EXISTS "Owner only: delete trading history" ON public.trading_history;
DROP POLICY IF EXISTS "Allow manage trading history for Owner only" ON public.trading_history;
DROP POLICY IF EXISTS "Staff select trading history" ON public.trading_history;
DROP POLICY IF EXISTS "Staff insert trading history" ON public.trading_history;
DROP POLICY IF EXISTS "Staff update trading history" ON public.trading_history;
DROP POLICY IF EXISTS "Staff delete trading history" ON public.trading_history;

CREATE POLICY "Staff select trading history" ON public.trading_history FOR SELECT TO authenticated
  USING ( public.has_page_access('trading-history') );

CREATE POLICY "Staff insert trading history" ON public.trading_history FOR INSERT TO authenticated
  WITH CHECK ( public.has_page_access('trading-history') );

CREATE POLICY "Staff update trading history" ON public.trading_history FOR UPDATE TO authenticated
  USING ( public.has_page_access('trading-history') )
  WITH CHECK ( public.has_page_access('trading-history') );

CREATE POLICY "Staff delete trading history" ON public.trading_history FOR DELETE TO authenticated
  USING ( public.has_page_access('trading-history') );

-- 8. Enable RLS and set policies on trading_history_case_logs table
ALTER TABLE public.trading_history_case_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view trading_history_case_logs" ON public.trading_history_case_logs;
DROP POLICY IF EXISTS "Allow authenticated users to insert trading_history_case_logs" ON public.trading_history_case_logs;
DROP POLICY IF EXISTS "Staff view trading_history_case_logs" ON public.trading_history_case_logs;
DROP POLICY IF EXISTS "Staff insert trading_history_case_logs" ON public.trading_history_case_logs;

CREATE POLICY "Staff view trading_history_case_logs" ON public.trading_history_case_logs FOR SELECT TO authenticated
  USING ( public.has_page_access('trading-history') );

CREATE POLICY "Staff insert trading_history_case_logs" ON public.trading_history_case_logs FOR INSERT TO authenticated
  WITH CHECK ( public.has_page_access('trading-history') );

-- 9. Storage bucket 'slip-images' policies update
DROP POLICY IF EXISTS "Allow public view of slip-images" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to slip-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow manage slip-images for Owner only" ON storage.objects;
DROP POLICY IF EXISTS "storage_slip_images_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_slip_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_slip_images_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_slip_images_delete" ON storage.objects;

CREATE POLICY "storage_slip_images_select" ON storage.objects
  FOR SELECT TO public
  USING ( bucket_id = 'slip-images' );

CREATE POLICY "storage_slip_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'slip-images'
    AND public.has_page_access('trading-history')
  );

CREATE POLICY "storage_slip_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'slip-images'
    AND public.has_page_access('trading-history')
  );

CREATE POLICY "storage_slip_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'slip-images'
    AND public.has_page_access('trading-history')
  );
