-- ============================================
-- Emmanuel Pharmacy — Migration 008: Restore Strict Order Update RLS Policies
-- Cashier and Admin can update any order (e.g. set status to 'paid' / payment_method)
-- Attendants can ONLY update their own pending orders ('waiting_for_payment' or 'cancelled', NEVER 'paid')
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Cashier and Admin can update orders" ON public.orders;
DROP POLICY IF EXISTS "Attendants can update own pending orders" ON public.orders;

-- 1. Cashier and Admin can update any order
CREATE POLICY "Cashier and Admin can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('cashier', 'admin'));

-- 2. Attendants can ONLY update their own pending orders (NEVER set to 'paid')
CREATE POLICY "Attendants can update own pending orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'attendant'
    AND attendant_id = auth.uid()
    AND status = 'waiting_for_payment'
  )
  WITH CHECK (
    public.get_my_role() = 'attendant'
    AND attendant_id = auth.uid()
    AND status IN ('waiting_for_payment', 'cancelled')
  );
