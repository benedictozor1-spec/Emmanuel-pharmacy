-- ============================================
-- Emmanuel Pharmacy — Migration 007: Stock Deduction Trigger
-- Automatically deducts product stock_quantity when order status becomes 'paid'
-- ============================================

CREATE OR REPLACE FUNCTION public.reduce_product_stock_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Execute stock reduction when status changes to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    UPDATE public.products p
    SET stock_quantity = GREATEST(0, p.stock_quantity - oi.quantity)
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id 
      AND (oi.product_id = p.id OR (p.name = oi.product_name AND oi.product_id IS NULL));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reduce_product_stock_on_paid ON public.orders;
CREATE TRIGGER trg_reduce_product_stock_on_paid
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.reduce_product_stock_on_paid();
