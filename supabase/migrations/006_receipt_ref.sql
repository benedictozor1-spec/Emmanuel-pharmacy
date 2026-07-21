-- ============================================
-- Emmanuel Pharmacy — Migration 006: Receipt Reference
-- Run this in Supabase SQL Editor
-- ============================================

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS receipt_ref TEXT;

-- Helper function to auto-generate receipt_ref if missing on insert
CREATE OR REPLACE FUNCTION public.set_order_receipt_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.receipt_ref IS NULL OR NEW.receipt_ref = '' THEN
    NEW.receipt_ref := 'EP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 5));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_receipt_ref ON public.orders;
CREATE TRIGGER trg_set_order_receipt_ref
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_receipt_ref();
