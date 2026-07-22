-- ============================================
-- Emmanuel Pharmacy — Migration 008: Smart get_my_role() & Order Update RLS Fix
-- Ensure Cashier and Admin can update orders regardless of whether role is stored in profiles table or auth JWT
-- ============================================

-- 1. Upgrade get_my_role() to check profiles table, auth JWT metadata, and email prefix
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  db_role TEXT;
  jwt_role TEXT;
  email_text TEXT;
BEGIN
  -- 1. Check database profiles table first
  SELECT role INTO db_role FROM public.profiles WHERE id = auth.uid();
  IF db_role IS NOT NULL AND db_role IN ('admin', 'cashier') THEN
    RETURN db_role;
  END IF;

  -- 2. Check auth JWT user_metadata
  jwt_role := (auth.jwt() -> 'user_metadata' ->> 'role');
  IF jwt_role IS NOT NULL AND jwt_role IN ('admin', 'cashier') THEN
    RETURN jwt_role;
  END IF;

  -- 3. Check auth JWT email prefix
  email_text := (auth.jwt() ->> 'email');
  IF email_text LIKE 'admin%' THEN
    RETURN 'admin';
  ELSIF email_text LIKE 'cashier%' THEN
    RETURN 'cashier';
  END IF;

  RETURN COALESCE(db_role, 'attendant');
END;
$$;

-- Grant EXECUTE to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- 2. Re-create order update policies
DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Cashier and Admin can update orders" ON public.orders;
DROP POLICY IF EXISTS "Attendants can update own pending orders" ON public.orders;

-- Cashier and Admin can update any order (e.g. set status to 'paid', 'cancelled', payment_method)
CREATE POLICY "Cashier and Admin can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('cashier', 'admin'))
  WITH CHECK (public.get_my_role() IN ('cashier', 'admin'));

-- Attendants can ONLY update their own pending orders (NEVER set to 'paid')
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
