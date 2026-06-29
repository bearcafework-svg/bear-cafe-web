-- Migration: New Billing System
-- สร้าง 4 tables ใหม่ (product_catalog, member_roles, orders, purchase_items)
-- ไม่แตะ trading_history เดิมเลย (852 แถว คงไว้เป็น read-only ข้อมูลเก่า)
-- Date: 2026-06-29

-- ============================================================
-- 1. Enum: product_type
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.product_type AS ENUM (
    'class_role',
    'decoration_role',
    'rental',
    'promo_package',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. product_catalog — สินค้า/role ทุกอย่างที่ขายได้
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_catalog (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         text          UNIQUE,            -- Discord role ID (null ถ้าไม่มี role จริง)
  display_name    text          NOT NULL,
  product_type    public.product_type NOT NULL DEFAULT 'other',
  current_price   numeric       CHECK (current_price IS NULL OR current_price >= 0),
  is_purchasable  boolean       NOT NULL DEFAULT true,
  is_active       boolean       NOT NULL DEFAULT true, -- false = role ถูกลบจาก Discord แล้ว (soft delete)
  sort_order      integer       NOT NULL DEFAULT 0,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_catalog_product_type
  ON public.product_catalog (product_type);
CREATE INDEX IF NOT EXISTS idx_product_catalog_is_purchasable
  ON public.product_catalog (is_purchasable) WHERE is_purchasable = true;
CREATE INDEX IF NOT EXISTS idx_product_catalog_role_id
  ON public.product_catalog (role_id) WHERE role_id IS NOT NULL;

-- ============================================================
-- 3. member_roles — role ปัจจุบันของสมาชิกแต่ละคน
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_roles (
  discord_id    text        NOT NULL,
  role_id       text        NOT NULL REFERENCES public.product_catalog (role_id)
                              ON DELETE RESTRICT ON UPDATE CASCADE,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  source        text        NOT NULL DEFAULT 'purchase'
                              CHECK (source IN ('purchase', 'admin_manual', 'migration')),
  PRIMARY KEY (discord_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_member_roles_discord_id
  ON public.member_roles (discord_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_role_id
  ON public.member_roles (role_id);

-- ============================================================
-- 4. orders — บิล 1 ใบ (แทน trading_history สำหรับการขายใหม่)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        text        NOT NULL,   -- Discord ID ผู้ซื้อ
  staff_id         text,                   -- Discord ID พนักงานที่ทำรายการ
  transaction_date date        NOT NULL,
  total_amount     numeric     NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  type_bill        text,                   -- ธนาคารทั่วไป / ทรูมันนี่
  slip_url         text,
  slip_url_2       text,
  log_timestamp    timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_member_id
  ON public.orders (member_id);
CREATE INDEX IF NOT EXISTS idx_orders_transaction_date
  ON public.orders (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

-- ============================================================
-- 5. purchase_items — รายการสินค้าในบิล (1 แถวต่อ 1 สินค้า)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id              uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid      NOT NULL REFERENCES public.orders (id)
                              ON DELETE CASCADE,
  product_id      uuid      NOT NULL REFERENCES public.product_catalog (id)
                              ON DELETE RESTRICT,
  price_paid      numeric   NOT NULL DEFAULT 0 CHECK (price_paid >= 0),
  original_price  numeric   CHECK (original_price IS NULL OR original_price >= 0),
  is_promotion    boolean   NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_order_id
  ON public.purchase_items (order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id
  ON public.purchase_items (product_id);

-- ============================================================
-- 6. Trigger: อัปเดต orders.total_amount อัตโนมัติ
--    ทุกครั้งที่ INSERT / UPDATE / DELETE purchase_items
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_update_order_total_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- หา order_id จาก row ที่เปลี่ยน
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  -- คำนวณ sum ใหม่จาก purchase_items ทั้งหมดในบิลนั้น
  UPDATE public.orders
  SET    total_amount = COALESCE(
           (SELECT SUM(price_paid) FROM public.purchase_items WHERE order_id = v_order_id),
           0
         )
  WHERE  id = v_order_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_order_total_amount ON public.purchase_items;
CREATE TRIGGER trg_update_order_total_amount
  AFTER INSERT OR UPDATE OF price_paid OR DELETE
  ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_order_total_amount();

-- ============================================================
-- 7. Trigger: upsert member_roles เมื่อซื้อ class_role / decoration_role
--    - class_role: ลบ class_role เก่าออกก่อน (ถือได้แค่ 1 ระดับ)
--    - decoration_role: ไม่ลบของเดิม (ถือพร้อมกันได้หลายตัว)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_grant_member_role_on_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_type  public.product_type;
  v_role_id       text;
  v_order_member  text;
BEGIN
  -- ดึงข้อมูล product ที่ซื้อ
  SELECT p.product_type, p.role_id
  INTO   v_product_type, v_role_id
  FROM   public.product_catalog p
  WHERE  p.id = NEW.product_id;

  -- ถ้า product นี้ไม่มี role_id ผูกอยู่ ก็ไม่ต้องทำอะไร
  IF v_role_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- ดึง member_id จาก orders
  SELECT member_id INTO v_order_member
  FROM   public.orders
  WHERE  id = NEW.order_id;

  IF v_product_type = 'class_role' THEN
    -- ลบ class_role เก่าออกก่อน (ถือได้แค่ 1 ระดับ)
    DELETE FROM public.member_roles mr
    USING public.product_catalog pc
    WHERE mr.discord_id = v_order_member
      AND mr.role_id    = pc.role_id
      AND pc.product_type = 'class_role'
      AND pc.role_id    <> v_role_id;

    -- Upsert class_role ใหม่
    INSERT INTO public.member_roles (discord_id, role_id, granted_at, source)
    VALUES (v_order_member, v_role_id, now(), 'purchase')
    ON CONFLICT (discord_id, role_id) DO UPDATE
      SET granted_at = now(),
          source     = 'purchase';

  ELSIF v_product_type = 'decoration_role' THEN
    -- ถือพร้อมกันได้หลายตัว — upsert โดยไม่ลบของเดิม
    INSERT INTO public.member_roles (discord_id, role_id, granted_at, source)
    VALUES (v_order_member, v_role_id, now(), 'purchase')
    ON CONFLICT (discord_id, role_id) DO UPDATE
      SET granted_at = now(),
          source     = 'purchase';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_member_role_on_purchase ON public.purchase_items;
CREATE TRIGGER trg_grant_member_role_on_purchase
  AFTER INSERT
  ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_grant_member_role_on_purchase();

-- ============================================================
-- 8. Salmon Point Trigger บน orders (เหมือน trading_history)
--    ใช้ fn_sync_salmon_point เดิม — แต่ต้อง bind ใหม่กับตาราง orders
--    เนื่องจาก fn_sync_salmon_point อ้างอิง column ชื่อ member_id / amount
--    ซึ่งตรงกับ orders.member_id / orders.total_amount พอดี
--    → สร้าง wrapper function ชื่อใหม่เพื่อ map total_amount → amount
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_salmon_point_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_discord_id    TEXT;
  v_old_sp        INTEGER;
  v_new_sp        INTEGER;
  v_delta         INTEGER;
  v_amount_before NUMERIC;
  v_amount_after  NUMERIC;
  v_change_type   TEXT;
  v_bill_id       UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_discord_id    := NEW.member_id;
    v_bill_id       := NEW.id;
    v_delta         := FLOOR(COALESCE(NEW.total_amount, 0) / 100);
    v_change_type   := 'insert';
    v_amount_before := NULL;
    v_amount_after  := NEW.total_amount;

  ELSIF TG_OP = 'UPDATE' THEN
    IF FLOOR(COALESCE(NEW.total_amount, 0) / 100) = FLOOR(COALESCE(OLD.total_amount, 0) / 100) THEN
      RETURN NEW;
    END IF;
    v_discord_id    := NEW.member_id;
    v_bill_id       := NEW.id;
    v_delta         := FLOOR(COALESCE(NEW.total_amount, 0) / 100) - FLOOR(COALESCE(OLD.total_amount, 0) / 100);
    v_change_type   := 'update';
    v_amount_before := OLD.total_amount;
    v_amount_after  := NEW.total_amount;

  ELSIF TG_OP = 'DELETE' THEN
    v_discord_id    := OLD.member_id;
    v_bill_id       := OLD.id;
    v_delta         := -(FLOOR(COALESCE(OLD.total_amount, 0) / 100));
    v_change_type   := 'delete';
    v_amount_before := OLD.total_amount;
    v_amount_after  := NULL;
  END IF;

  IF v_delta = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(salmon_point, 0)
  INTO   v_old_sp
  FROM   public.user_points
  WHERE  discord_id = v_discord_id;

  v_old_sp := COALESCE(v_old_sp, 0);
  v_new_sp := GREATEST(0, v_old_sp + v_delta);

  INSERT INTO public.user_points (discord_id, salmon_point)
  VALUES (v_discord_id, v_new_sp)
  ON CONFLICT (discord_id) DO UPDATE
    SET salmon_point = v_new_sp,
        updated_at   = now();

  INSERT INTO public.salmon_point_logs
    (discord_id, bill_id, change_type,
     old_salmon_point, new_salmon_point, delta,
     amount_before, amount_after, created_at)
  VALUES
    (v_discord_id, v_bill_id, v_change_type,
     v_old_sp, v_new_sp, v_new_sp - v_old_sp,
     v_amount_before, v_amount_after, now());

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger fires on orders INSERT / UPDATE(total_amount) / DELETE
DROP TRIGGER IF EXISTS trg_sync_salmon_point_orders ON public.orders;
CREATE TRIGGER trg_sync_salmon_point_orders
  AFTER INSERT OR UPDATE OF total_amount OR DELETE
  ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_salmon_point_orders();

-- ============================================================
-- 9. View: v_all_bills — UNION trading_history (เก่า) + orders (ใหม่)
--    ใช้สำหรับ overview ยอดรวมเก่า+ใหม่
-- ============================================================
CREATE OR REPLACE VIEW public.v_all_bills AS
  -- บิลเก่าจาก trading_history
  SELECT
    id,
    member_id,
    service_id    AS staff_id,
    transaction   AS transaction_date_str,
    amount        AS total_amount,
    type_bill,
    slip_url,
    slip_url_2,
    log_timestamp,
    created_at,
    'legacy'      AS bill_source
  FROM public.trading_history

  UNION ALL

  -- บิลใหม่จาก orders
  SELECT
    id,
    member_id,
    staff_id,
    transaction_date::text AS transaction_date_str,
    total_amount,
    type_bill,
    slip_url,
    slip_url_2,
    log_timestamp,
    created_at,
    'new'         AS bill_source
  FROM public.orders;

-- ============================================================
-- 10. RLS สำหรับ 4 tables ใหม่
-- ============================================================

-- ---- product_catalog ----
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read product_catalog" ON public.product_catalog;
CREATE POLICY "Admins can read product_catalog"
  ON public.product_catalog FOR SELECT
  TO authenticated
  USING ( public.has_page_access('trading-history') );

DROP POLICY IF EXISTS "Owner can manage product_catalog" ON public.product_catalog;
CREATE POLICY "Owner can manage product_catalog"
  ON public.product_catalog FOR ALL
  TO authenticated
  USING ( public.is_owner() )
  WITH CHECK ( public.is_owner() );

DROP POLICY IF EXISTS "Service role full access to product_catalog" ON public.product_catalog;
CREATE POLICY "Service role full access to product_catalog"
  ON public.product_catalog FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ---- member_roles ----
ALTER TABLE public.member_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read member_roles" ON public.member_roles;
CREATE POLICY "Admins can read member_roles"
  ON public.member_roles FOR SELECT
  TO authenticated
  USING ( public.has_page_access('trading-history') );

DROP POLICY IF EXISTS "Owner can manage member_roles" ON public.member_roles;
CREATE POLICY "Owner can manage member_roles"
  ON public.member_roles FOR ALL
  TO authenticated
  USING ( public.is_owner() )
  WITH CHECK ( public.is_owner() );

DROP POLICY IF EXISTS "Service role full access to member_roles" ON public.member_roles;
CREATE POLICY "Service role full access to member_roles"
  ON public.member_roles FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ---- orders ----
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read orders" ON public.orders;
CREATE POLICY "Admins can read orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING ( public.has_page_access('trading-history') );

DROP POLICY IF EXISTS "Owner can manage orders" ON public.orders;
CREATE POLICY "Owner can manage orders"
  ON public.orders FOR ALL
  TO authenticated
  USING ( public.is_owner() )
  WITH CHECK ( public.is_owner() );

DROP POLICY IF EXISTS "Service role full access to orders" ON public.orders;
CREATE POLICY "Service role full access to orders"
  ON public.orders FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ---- purchase_items ----
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read purchase_items" ON public.purchase_items;
CREATE POLICY "Admins can read purchase_items"
  ON public.purchase_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = purchase_items.order_id
        AND public.has_page_access('trading-history')
    )
  );

DROP POLICY IF EXISTS "Owner can manage purchase_items" ON public.purchase_items;
CREATE POLICY "Owner can manage purchase_items"
  ON public.purchase_items FOR ALL
  TO authenticated
  USING ( public.is_owner() )
  WITH CHECK ( public.is_owner() );

DROP POLICY IF EXISTS "Service role full access to purchase_items" ON public.purchase_items;
CREATE POLICY "Service role full access to purchase_items"
  ON public.purchase_items FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
