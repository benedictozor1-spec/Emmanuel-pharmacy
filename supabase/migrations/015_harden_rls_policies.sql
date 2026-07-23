-- ============================================================
-- Emmanuel Pharmacy — Security Hardening (015)
-- Targeted fixes only. Does NOT rebuild tables or touch orders/products.
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SHOP SETTINGS — only admin may change limits
--    (all staff can still READ, so the cashier's limit works)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can update shop_settings" ON public.shop_settings;
DROP POLICY IF EXISTS "Admin update shop_settings"      ON public.shop_settings;
DROP POLICY IF EXISTS "Admin can modify shop_settings"  ON public.shop_settings;

CREATE POLICY "Admin can modify shop_settings"
  ON public.shop_settings
  FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ------------------------------------------------------------
-- 2. TREATMENTS — clear ALL leftover open policies first,
--    then: everyone reads, only cashier/admin writes
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert or update treatments"      ON public.treatments;
DROP POLICY IF EXISTS "Anyone can read treatments"                  ON public.treatments;
DROP POLICY IF EXISTS "Authenticated users can insert treatments"   ON public.treatments;
DROP POLICY IF EXISTS "Authenticated users can read treatments"     ON public.treatments;
DROP POLICY IF EXISTS "Authenticated users can update treatments"   ON public.treatments;
DROP POLICY IF EXISTS "Cashier and Admin treatments policy"         ON public.treatments;
DROP POLICY IF EXISTS "Staff can read treatments"                   ON public.treatments;
DROP POLICY IF EXISTS "Cashier and Admin can insert treatments"     ON public.treatments;
DROP POLICY IF EXISTS "Cashier and Admin can update treatments"     ON public.treatments;

CREATE POLICY "Staff can read treatments"
  ON public.treatments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Cashier and Admin can insert treatments"
  ON public.treatments FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() IN ('cashier', 'admin'));

CREATE POLICY "Cashier and Admin can update treatments"
  ON public.treatments FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('cashier', 'admin'));

-- ------------------------------------------------------------
-- 3. REMOVE ADMIN AUTO-ESCALATION
--    Before: an account whose email/username started with "admin"
--            was automatically made an admin. Also, the role could
--            be set by whatever the client sent.
--    After:  every new account is 'attendant'. Only an existing
--            admin can promote someone (profiles UPDATE is admin-only).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username',  split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'attendant'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;