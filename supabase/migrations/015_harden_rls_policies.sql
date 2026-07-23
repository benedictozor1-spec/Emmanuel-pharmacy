-- ============================================
-- Emmanuel Pharmacy — Targeted RLS Security Hardening (015)
-- Small, targeted migration applying role-based security
-- using existing get_my_role() helper without altering tables or triggers
-- ============================================

-- 1. Harden public.shop_settings (Only Admin can modify, all authenticated staff can read)
DROP POLICY IF EXISTS "Anyone can update shop_settings" ON public.shop_settings;
DROP POLICY IF EXISTS "Admin update shop_settings" ON public.shop_settings;

CREATE POLICY "Admin update shop_settings"
  ON public.shop_settings
  FOR ALL
  USING (public.get_my_role() = 'admin');

-- 2. Harden public.treatments (Cashier & Admin can record/collect, all staff can read)
DROP POLICY IF EXISTS "Anyone can insert or update treatments" ON public.treatments;
DROP POLICY IF EXISTS "Cashier and Admin treatments policy" ON public.treatments;

CREATE POLICY "Cashier and Admin treatments policy"
  ON public.treatments
  FOR ALL
  USING (public.get_my_role() IN ('cashier', 'admin'));

-- 3. Harden public.expenses (Cashier & Admin can record expenses, all staff can read)
DROP POLICY IF EXISTS "Anyone can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Cashier and Admin expenses policy" ON public.expenses;

CREATE POLICY "Cashier and Admin expenses policy"
  ON public.expenses
  FOR ALL
  USING (public.get_my_role() IN ('cashier', 'admin'));
