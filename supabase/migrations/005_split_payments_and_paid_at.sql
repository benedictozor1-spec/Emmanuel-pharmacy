-- ============================================
-- Emmanuel Pharmacy — Migration 005: Split Payments & Paid At Timestamp (Corrected 005)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add payment_breakdown JSONB and paid_at TIMESTAMPTZ to orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS payment_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 2. Trigger to automatically set paid_at = now() (server time) when status becomes 'paid'
CREATE OR REPLACE FUNCTION public.set_order_paid_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'paid' THEN
      NEW.paid_at := COALESCE(NEW.paid_at, now());
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
      NEW.paid_at := COALESCE(NEW.paid_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_paid_at ON public.orders;
CREATE TRIGGER trg_set_order_paid_at
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_paid_at();
