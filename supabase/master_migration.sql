-- ============================================================================
-- Emmanuel Pharmacy — ALL-IN-ONE MASTER DATABASE MIGRATION
-- Run this SINGLE file in Supabase Dashboard → SQL Editor → New Query → Run
-- It is 100% safe to run multiple times (idempotent with IF NOT EXISTS / REPLACE)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES & ROLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('attendant', 'cashier', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;
CREATE POLICY "Admin can read all profiles" ON public.profiles FOR SELECT USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admin can update profiles" ON public.profiles;
CREATE POLICY "Admin can update profiles" ON public.profiles FOR UPDATE USING (public.get_my_role() = 'admin');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  detected_role TEXT;
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    detected_role := NEW.raw_user_meta_data->>'role';
  ELSIF NEW.email LIKE 'admin%' THEN
    detected_role := 'admin';
  ELSIF NEW.email LIKE 'cashier%' THEN
    detected_role := 'cashier';
  ELSE
    detected_role := 'attendant';
  END IF;

  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    detected_role
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. PRODUCTS & INVENTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  stock_quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 10,
  expiry_date DATE,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
CREATE POLICY "Anyone can read products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert or update products" ON public.products;
CREATE POLICY "Anyone can insert or update products" ON public.products FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- 3. ORDERS & ORDER ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE,
  receipt_ref TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payment_method TEXT,
  cash_amount NUMERIC DEFAULT 0,
  pos1_amount NUMERIC DEFAULT 0,
  pos2_amount NUMERIC DEFAULT 0,
  transfer_amount NUMERIC DEFAULT 0,
  credit_amount NUMERIC DEFAULT 0,
  is_credit BOOLEAN DEFAULT false,
  customer_name TEXT,
  customer_phone TEXT,
  attendant_name TEXT,
  cashier_name TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read orders" ON public.orders;
CREATE POLICY "Anyone can read orders" ON public.orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert or update orders" ON public.orders;
CREATE POLICY "Anyone can insert or update orders" ON public.orders FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read order_items" ON public.order_items;
CREATE POLICY "Anyone can read order_items" ON public.order_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert or update order_items" ON public.order_items;
CREATE POLICY "Anyone can insert or update order_items" ON public.order_items FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- 4. AUTOMATIC STOCK DEDUCTION TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity),
        updated_at = now()
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_deduct_stock ON public.order_items;
CREATE TRIGGER trigger_deduct_stock
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_product_stock();

-- ----------------------------------------------------------------------------
-- 5. EXPENSES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  note TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read expenses" ON public.expenses;
CREATE POLICY "Anyone can read expenses" ON public.expenses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert expenses" ON public.expenses;
CREATE POLICY "Anyone can insert expenses" ON public.expenses FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- 6. DAY CLOSES (SHIFT RECONCILIATIONS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.day_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  close_date TIMESTAMPTZ DEFAULT now(),
  system_total NUMERIC NOT NULL DEFAULT 0,
  system_cash NUMERIC NOT NULL DEFAULT 0,
  system_pos1 NUMERIC NOT NULL DEFAULT 0,
  system_transfer NUMERIC NOT NULL DEFAULT 0,
  system_credit NUMERIC NOT NULL DEFAULT 0,
  system_expenses NUMERIC NOT NULL DEFAULT 0,
  counted_cash NUMERIC NOT NULL DEFAULT 0,
  counted_pos1 NUMERIC NOT NULL DEFAULT 0,
  counted_transfer NUMERIC NOT NULL DEFAULT 0,
  total_difference NUMERIC NOT NULL DEFAULT 0,
  closed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.day_closes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read day_closes" ON public.day_closes;
CREATE POLICY "Anyone can read day_closes" ON public.day_closes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert day_closes" ON public.day_closes;
CREATE POLICY "Anyone can insert day_closes" ON public.day_closes FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- 7. NOTIFICATIONS & ALERTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read notifications" ON public.notifications;
CREATE POLICY "Anyone can read notifications" ON public.notifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can update notifications" ON public.notifications;
CREATE POLICY "Anyone can update notifications" ON public.notifications FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- 8. SHOP SETTINGS (LIMITS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_settings (
  id INT PRIMARY KEY DEFAULT 1,
  daily_expense_limit NUMERIC NOT NULL DEFAULT 25000,
  mismatch_alert_limit NUMERIC NOT NULL DEFAULT 5000,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.shop_settings (id, daily_expense_limit, mismatch_alert_limit)
VALUES (1, 25000, 5000)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read shop_settings" ON public.shop_settings;
CREATE POLICY "Anyone can read shop_settings" ON public.shop_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can update shop_settings" ON public.shop_settings;
CREATE POLICY "Anyone can update shop_settings" ON public.shop_settings FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- 9. PATIENT CLINICAL TREATMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  patient_age INT,
  patient_weight NUMERIC,
  diagnosis TEXT NOT NULL,
  drug_used TEXT,
  amount_charged NUMERIC NOT NULL DEFAULT 0,
  deposit_paid NUMERIC NOT NULL DEFAULT 0,
  balance_remaining NUMERIC NOT NULL DEFAULT 0,
  return_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read treatments" ON public.treatments;
CREATE POLICY "Anyone can read treatments" ON public.treatments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert or update treatments" ON public.treatments;
CREATE POLICY "Anyone can insert or update treatments" ON public.treatments FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- 10. SERVER TIME FUNCTION (WAT Timezone)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT timezone('Africa/Lagos', now());
$$;
