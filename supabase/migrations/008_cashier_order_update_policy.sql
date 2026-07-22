-- ============================================
-- Emmanuel Pharmacy — Migration 008: Order Update RLS Policy Fix
-- Ensure authenticated staff can update order status and payment fields
-- ============================================

DROP POLICY IF EXISTS "Cashier and Admin can update orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;

-- Allow all authenticated staff (Cashier, Admin, Attendants) to update orders (e.g. set status to 'paid' / payment_method)
CREATE POLICY "Authenticated users can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
