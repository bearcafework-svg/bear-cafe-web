-- Migration: Fix Trading History and Storage RLS Policies
-- Date: 2026-06-29

-- 1. Update policies on public.orders to allow SELECT, INSERT, UPDATE for staff/admins, and DELETE for owners.
DROP POLICY IF EXISTS "Admins can read orders" ON public.orders;
DROP POLICY IF EXISTS "Owner can manage orders" ON public.orders;

CREATE POLICY "Admins can select orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING ( public.has_page_access('trading-history') );

CREATE POLICY "Admins can insert orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK ( public.has_page_access('trading-history') );

CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING ( public.has_page_access('trading-history') )
  WITH CHECK ( public.has_page_access('trading-history') );

CREATE POLICY "Owner can delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING ( public.is_owner() );


-- 2. Update policies on public.purchase_items to allow SELECT, INSERT, UPDATE for staff/admins, and DELETE for owners.
DROP POLICY IF EXISTS "Admins can read purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Owner can manage purchase_items" ON public.purchase_items;

CREATE POLICY "Admins can select purchase_items"
  ON public.purchase_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = purchase_items.order_id
        AND public.has_page_access('trading-history')
    )
  );

CREATE POLICY "Admins can insert purchase_items"
  ON public.purchase_items FOR INSERT
  TO authenticated
  WITH CHECK ( public.has_page_access('trading-history') );

CREATE POLICY "Admins can update purchase_items"
  ON public.purchase_items FOR UPDATE
  TO authenticated
  USING ( public.has_page_access('trading-history') )
  WITH CHECK ( public.has_page_access('trading-history') );

CREATE POLICY "Owner can delete purchase_items"
  ON public.purchase_items FOR DELETE
  TO authenticated
  USING ( public.is_owner() );


-- 3. Update storage.objects policies for slip-images bucket.
DROP POLICY IF EXISTS "storage_slip_images_manage_owner" ON storage.objects;

CREATE POLICY "storage_slip_images_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'slip-images' AND (public.is_owner() OR public.has_page_access('trading-history')));

CREATE POLICY "storage_slip_images_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'slip-images' AND public.is_owner());

CREATE POLICY "storage_slip_images_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'slip-images' AND public.is_owner())
WITH CHECK (bucket_id = 'slip-images' AND public.is_owner());
