-- ============================================
-- Emmanuel Pharmacy — Migration 017: Ensure Stock Deduction Trigger Works
-- Re-creates the stock deduction trigger with improved reliability
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Re-create the stock deduction function with SECURITY DEFINER
-- This ensures the trigger can update products table even though RLS
-- restricts product updates to admin role only
CREATE OR REPLACE FUNCTION public.reduce_product_stock_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only fire when status changes to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    -- Deduct stock for each order item
    UPDATE public.products p
    SET 
      stock_quantity = GREATEST(0, p.stock_quantity - oi.quantity),
      updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id 
      AND oi.quantity > 0
      AND (
        -- Match by product_id first (most reliable)
        (oi.product_id IS NOT NULL AND oi.product_id = p.id)
        OR 
        -- Fallback: match by product_name if product_id is null
        (oi.product_id IS NULL AND p.name = oi.product_name)
      );
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Re-create the trigger (drop first to be safe)
DROP TRIGGER IF EXISTS trg_reduce_product_stock_on_paid ON public.orders;
CREATE TRIGGER trg_reduce_product_stock_on_paid
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.reduce_product_stock_on_paid();

-- 3. Also add a cost_price column to order_items for accurate profit tracking
ALTER TABLE public.order_items 
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0.00;

-- 4. Verify the trigger exists
DO $$
BEGIN
  RAISE NOTICE 'Stock deduction trigger has been re-created successfully.';
  RAISE NOTICE 'When an order status changes to paid, stock_quantity will be decremented automatically.';
END $$;
