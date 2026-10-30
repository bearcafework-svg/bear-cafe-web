-- Migration: Restore orders total_amount trigger and recalculation function
-- Date: 2026-10-30
-- Purpose: Automatically calculate and update orders.total_amount from purchase_items on INSERT, UPDATE, or DELETE

-- 1. Create function to recalculate orders.total_amount
CREATE OR REPLACE FUNCTION public.fn_update_order_total_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  UPDATE public.orders
  SET    total_amount = COALESCE(
           (SELECT SUM(price_paid) FROM public.purchase_items WHERE order_id = v_order_id),
           0
         )
  WHERE  id = v_order_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Create trigger on purchase_items
DROP TRIGGER IF EXISTS trg_update_order_total_amount ON public.purchase_items;
CREATE TRIGGER trg_update_order_total_amount
  AFTER INSERT OR UPDATE OF price_paid OR DELETE
  ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_order_total_amount();

