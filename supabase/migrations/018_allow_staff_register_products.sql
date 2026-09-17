-- ============================================================
-- Emmanuel Pharmacy — Allow Staff to Register New Products (018)
-- Grants INSERT permission on public.products to all authenticated staff
-- ============================================================

DROP POLICY IF EXISTS "Only Admin can insert products" ON public.products;
DROP POLICY IF EXISTS "Staff can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;

CREATE POLICY "Authenticated users can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
