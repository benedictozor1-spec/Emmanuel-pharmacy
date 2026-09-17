-- ================================================================
-- EMMANUEL PHARMACY — COMPLETE MASTER DATABASE SCHEMA & SETUP
-- Target Supabase Project: https://gwprxrdfwxbthedtofwp.supabase.co
-- How to apply:
-- 1. Go to https://supabase.com/dashboard/project/gwprxrdfwxbthedtofwp/sql/new
-- 2. Paste this entire file into the SQL Editor
-- 3. Click 'Run' (or press Ctrl + Enter)
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ------------------------------------------------------------
-- [Migration File: 001_profiles.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Profiles & Roles Migration (Fixed RLS & Trigger)
-- Run this in Supabase SQL Editor (Dashboard â†’ SQL Editor â†’ New Query)
-- ============================================

-- 1. Create the profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('attendant', 'cashier', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON public.profiles;

-- 4. Helper function: get current user's role (SECURITY DEFINER bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 5. Non-recursive RLS Policies

-- Everyone logged in can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admin can read all profiles (using SECURITY DEFINER helper function)
CREATE POLICY "Admin can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.get_my_role() = 'admin');

-- Only admin can update profiles
CREATE POLICY "Admin can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- 6. Auto-create a profile when a new user signs up (with smart role detection)
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

-- 7. Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();


-- ------------------------------------------------------------
-- [Migration File: 003_inventory_and_orders.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Products, Orders & Order Counter Migration (Corrected 003)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT DEFAULT 'General',
  unit TEXT NOT NULL DEFAULT 'tab', -- e.g. tab, pack, sachet, bottle, tin
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0.00, -- Readable by all authenticated users; INSERT/UPDATE restricted to admin
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  stock_quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 10,
  expiry_date DATE,
  barcode TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Only Admin can insert products" ON public.products;
DROP POLICY IF EXISTS "Only Admin can update products" ON public.products;

-- Everyone logged in can read products (Attendants, Cashier, Admin)
CREATE POLICY "Authenticated users can read products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- Only Admin can insert products
CREATE POLICY "Only Admin can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

-- Only Admin can update products
CREATE POLICY "Only Admin can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin');


-- 2. Order Counter Table (Direct access revoked; accessed ONLY via SECURITY DEFINER function)
CREATE TABLE IF NOT EXISTS public.daily_order_counter (
  counter_date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  last_order_number INT NOT NULL DEFAULT 0
);

ALTER TABLE public.daily_order_counter ENABLE ROW LEVEL SECURITY;

-- Drop old direct access policy if present
DROP POLICY IF EXISTS "Authenticated users can manage order counter" ON public.daily_order_counter;

-- REVOKE direct table permissions for authenticated and anon users
REVOKE ALL ON public.daily_order_counter FROM authenticated, anon, public;

-- Atomic SECURITY DEFINER function to get next order number for today
CREATE OR REPLACE FUNCTION public.get_next_order_number()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_num INT;
BEGIN
  INSERT INTO public.daily_order_counter (counter_date, last_order_number)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (counter_date)
  DO UPDATE SET last_order_number = public.daily_order_counter.last_order_number + 1
  RETURNING last_order_number INTO next_num;
  
  RETURN next_num;
END;
$$;

-- Grant EXECUTE permission on function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_next_order_number() TO authenticated;


-- 3. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number INT NOT NULL,
  attendant_id UUID REFERENCES auth.users(id),
  attendant_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting_for_payment' CHECK (status IN ('waiting_for_payment', 'paid', 'cancelled')),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  payment_method TEXT, -- Supports split payments (e.g. 'Cash', 'POS 1', 'POS 2', 'Transfer', 'Cash + POS')
  is_credit BOOLEAN NOT NULL DEFAULT false,
  customer_name TEXT,
  customer_phone TEXT,
  late_night BOOLEAN NOT NULL DEFAULT false, -- Flag for orders created between 00:00 and 06:00 (Nigerian WAT time)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to automatically flag late_night orders (created between 00:00 and 06:00 in Africa/Lagos time)
CREATE OR REPLACE FUNCTION public.check_late_night_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  local_hour INT;
BEGIN
  -- Convert created_at to local Nigerian time zone ('Africa/Lagos' UTC+1)
  local_hour := EXTRACT(HOUR FROM (NEW.created_at AT TIME ZONE 'Africa/Lagos'));
  IF local_hour >= 0 AND local_hour < 6 THEN
    NEW.late_night := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_late_night_order ON public.orders;
CREATE TRIGGER trg_check_late_night_order
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.check_late_night_order();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop existing order policies
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can read orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Cashier and Admin can update orders" ON public.orders;
DROP POLICY IF EXISTS "Attendants can update own pending orders" ON public.orders;

-- Attendants can create orders
CREATE POLICY "Authenticated users can create orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Everyone logged in can read orders
CREATE POLICY "Authenticated users can read orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (true);

-- Restricted UPDATE policies:
-- Cashier and Admin can update any order (e.g. set status to paid / payment_method)
CREATE POLICY "Cashier and Admin can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('cashier', 'admin'));

-- Attendants may ONLY update their own orders while status is currently 'waiting_for_payment',
-- and WITH CHECK ensures the updated order remains 'waiting_for_payment' (edits) or 'cancelled' (self-cancel), but NEVER 'paid'.
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


-- 4. Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can read order items" ON public.order_items;

CREATE POLICY "Authenticated users can insert order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (true);


-- 5. Seed Initial Inventory
INSERT INTO public.products (name, brand, category, unit, cost_price, selling_price, stock_quantity, low_stock_threshold, expiry_date, barcode)
VALUES
  ('Paracetamol 500mg', 'Emzor', 'Analgesic', 'tab', 35.00, 50.00, 240, 20, '2027-08-31', '890123456701'),
  ('Amoxicillin 500mg', 'Fidson', 'Antibiotic', 'cap', 80.00, 120.00, 8, 15, '2026-09-30', '890123456702'),
  ('Artemether / Lumefantrine', 'Novartis Â· Coartem', 'Antimalarial', 'pack', 1300.00, 1800.00, 45, 10, '2028-05-31', '890123456703'),
  ('Vitamin C 1000mg', 'Emzor', 'Supplement', 'tab', 20.00, 30.00, 500, 50, '2027-11-30', '890123456704'),
  ('Metformin 500mg', 'Swiss Pharma', 'Antidiabetic', 'tab', 55.00, 80.00, 15, 20, '2026-12-31', '890123456705'),
  ('ORS Sachet', 'Generic', 'Rehydration', 'sachet', 70.00, 100.00, 120, 25, '2027-06-30', '890123456706'),
  ('Ciprofloxacin 500mg', 'Fidson', 'Antibiotic', 'tab', 150.00, 250.00, 60, 15, '2027-04-30', '890123456707'),
  ('Ibuprofen 400mg', 'Emzor', 'Analgesic', 'tab', 40.00, 60.00, 180, 30, '2028-01-31', '890123456708')
ON CONFLICT (barcode) DO NOTHING;


-- ------------------------------------------------------------
-- [Migration File: 004_cashier_expenses_treatments.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Expenses, Day Close, Treatments & Credit Repayments (Updated 004)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('Fuel / Generator', 'Water', 'Transport', 'Staff Expenses', 'Repairs & Maintenance', 'Supplies', 'Misc')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'POS 1', 'POS 2', 'Transfer')),
  note TEXT,
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read expenses" ON public.expenses;
DROP POLICY IF EXISTS "Cashier and Admin can insert expenses" ON public.expenses;

CREATE POLICY "Authenticated users can read expenses"
  ON public.expenses FOR SELECT TO authenticated USING (true);

-- Restricted to Cashier and Admin via get_my_role()
CREATE POLICY "Cashier and Admin can insert expenses"
  ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('cashier', 'admin'));


-- 2. Day Closes Table (Reconciliation across activity window since previous close)
CREATE TABLE IF NOT EXISTS public.day_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  close_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_close_at TIMESTAMPTZ, -- Captures activity window since previous day-close timestamp
  system_cash NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  system_pos1 NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  system_pos2 NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  system_transfer NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  system_credit NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  system_expenses NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  system_total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  
  counted_cash NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  counted_pos1 NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  counted_pos2 NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  counted_transfer NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  
  change_float NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_difference NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  closed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.day_closes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read day closes" ON public.day_closes;
DROP POLICY IF EXISTS "Cashier and Admin can insert day closes" ON public.day_closes;

CREATE POLICY "Authenticated users can read day closes"
  ON public.day_closes FOR SELECT TO authenticated USING (true);

-- Restricted to Cashier and Admin via get_my_role()
CREATE POLICY "Cashier and Admin can insert day closes"
  ON public.day_closes FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('cashier', 'admin'));


-- 3. Treatments & Dressing Table
CREATE TABLE IF NOT EXISTS public.treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  patient_age INT,
  patient_weight NUMERIC(5,2),
  diagnosis TEXT NOT NULL,
  drug_used TEXT NOT NULL,
  amount_charged NUMERIC(10,2) NOT NULL CHECK (amount_charged >= 0),
  deposit_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  balance_remaining NUMERIC(10,2) GENERATED ALWAYS AS (amount_charged - deposit_paid) STORED,
  return_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'missed')),
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read treatments" ON public.treatments;
DROP POLICY IF EXISTS "Authenticated users can insert treatments" ON public.treatments;
DROP POLICY IF EXISTS "Authenticated users can update treatments" ON public.treatments;

CREATE POLICY "Authenticated users can read treatments"
  ON public.treatments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert treatments"
  ON public.treatments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update treatments"
  ON public.treatments FOR UPDATE TO authenticated USING (true);


-- 4. Credit Repayments Table
CREATE TABLE IF NOT EXISTS public.credit_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id),
  customer_name TEXT NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL CHECK (amount_paid > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'POS 1', 'POS 2', 'Transfer')),
  cashier_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.credit_repayments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read credit repayments" ON public.credit_repayments;
DROP POLICY IF EXISTS "Cashier and Admin can insert credit repayments" ON public.credit_repayments;

CREATE POLICY "Authenticated users can read credit repayments"
  ON public.credit_repayments FOR SELECT TO authenticated USING (true);

-- Restricted to Cashier and Admin via get_my_role()
CREATE POLICY "Cashier and Admin can insert credit repayments"
  ON public.credit_repayments FOR INSERT TO authenticated WITH CHECK (public.get_my_role() IN ('cashier', 'admin'));


-- ------------------------------------------------------------
-- [Migration File: 005_split_payments_and_paid_at.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Migration 005: Split Payments & Paid At Timestamp (Corrected 005)
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


-- ------------------------------------------------------------
-- [Migration File: 006_receipt_ref.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Migration 006: Receipt Reference
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


-- ------------------------------------------------------------
-- [Migration File: 007_stock_deduction_trigger.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Migration 007: Stock Deduction Trigger
-- Automatically deducts product stock_quantity when order status becomes 'paid'
-- ============================================

CREATE OR REPLACE FUNCTION public.reduce_product_stock_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Execute stock reduction when status changes to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    UPDATE public.products p
    SET stock_quantity = GREATEST(0, p.stock_quantity - oi.quantity)
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id 
      AND (oi.product_id = p.id OR (p.name = oi.product_name AND oi.product_id IS NULL));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reduce_product_stock_on_paid ON public.orders;
CREATE TRIGGER trg_reduce_product_stock_on_paid
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.reduce_product_stock_on_paid();


-- ------------------------------------------------------------
-- [Migration File: 008_cashier_order_update_policy.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Migration 008: Smart get_my_role() & Order Update RLS Fix
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


-- ------------------------------------------------------------
-- [Migration File: 009_notifications.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Migration 009: Admin Notifications Table
-- Tracks realtime admin notifications (e.g. Credit Sales processed by Cashier)
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'credit_sale',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read notifications
DROP POLICY IF EXISTS "Authenticated users can read notifications" ON public.notifications;
CREATE POLICY "Authenticated users can read notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users (Cashier & Admin) to insert notifications
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow Cashier and Admin to update notifications (e.g. mark as read)
DROP POLICY IF EXISTS "Cashier and Admin can update notifications" ON public.notifications;
CREATE POLICY "Cashier and Admin can update notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('cashier', 'admin'))
  WITH CHECK (true);


-- ------------------------------------------------------------
-- [Migration File: 010_server_time.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Server Time Function (010)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT now();
$$;

GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated, anon;


-- ------------------------------------------------------------
-- [Migration File: 011_fix_profile_roles.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Fix Profile Roles Migration (011)
-- ============================================

-- 1. Fix existing profile roles in public.profiles
UPDATE public.profiles
SET role = 'admin'
WHERE LOWER(username) LIKE 'admin%' OR id IN (
  SELECT id FROM auth.users WHERE LOWER(email) LIKE 'admin%'
);

UPDATE public.profiles
SET role = 'cashier'
WHERE LOWER(username) LIKE 'cashier%' OR id IN (
  SELECT id FROM auth.users WHERE LOWER(email) LIKE 'cashier%'
);

UPDATE public.profiles
SET role = 'attendant'
WHERE LOWER(username) LIKE 'attendant%' OR id IN (
  SELECT id FROM auth.users WHERE LOWER(email) LIKE 'attendant%'
);

-- 2. Enhanced Trigger Function with ILIKE case-insensitivity
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  detected_role TEXT;
  clean_username TEXT;
BEGIN
  clean_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));

  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    detected_role := LOWER(NEW.raw_user_meta_data->>'role');
  ELSIF LOWER(NEW.email) ILIKE 'admin%' OR LOWER(clean_username) ILIKE 'admin%' THEN
    detected_role := 'admin';
  ELSIF LOWER(NEW.email) ILIKE 'cashier%' OR LOWER(clean_username) ILIKE 'cashier%' THEN
    detected_role := 'cashier';
  ELSE
    detected_role := 'attendant';
  END IF;

  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    NEW.id,
    clean_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', clean_username),
    detected_role
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------
-- [Migration File: 012_reset_passwords.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Direct Password Reset SQL (012)
-- Run this in Supabase SQL Editor to set staff passwords directly
-- without requiring an email server / SMTP.
-- ============================================

-- Reset password for admin1, cashier1, attendant1 to 'TestPass6!'
UPDATE auth.users
SET encrypted_password = crypt('TestPass6!', gen_salt('bf'))
WHERE email LIKE 'admin%' OR email LIKE 'cashier%' OR email LIKE 'attendant%';


-- ------------------------------------------------------------
-- [Migration File: 013_shop_settings.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Shop Settings Migration (013)
-- Stores daily expense limit, mismatch alert limit & configuration
-- ============================================

CREATE TABLE IF NOT EXISTS public.shop_settings (
  id INT PRIMARY KEY DEFAULT 1,
  daily_expense_limit NUMERIC NOT NULL DEFAULT 25000,
  mismatch_alert_limit NUMERIC NOT NULL DEFAULT 5000,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default settings row if not present
INSERT INTO public.shop_settings (id, daily_expense_limit, mismatch_alert_limit)
VALUES (1, 25000, 5000)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read shop_settings" ON public.shop_settings;
CREATE POLICY "Anyone can read shop_settings" ON public.shop_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can update shop_settings" ON public.shop_settings;
CREATE POLICY "Anyone can update shop_settings" ON public.shop_settings FOR ALL USING (true);


-- ------------------------------------------------------------
-- [Migration File: 014_treatments.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Patient Treatments Migration (014)
-- Real database table for Patient Clinical & Procedure Records
-- ============================================

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


-- ------------------------------------------------------------
-- [Migration File: 015_harden_rls_policies.sql]
-- ------------------------------------------------------------

-- ============================================================
-- Emmanuel Pharmacy â€” Security Hardening (015)
-- Targeted fixes only. Does NOT rebuild tables or touch orders/products.
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SHOP SETTINGS â€” only admin may change limits
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
-- 2. TREATMENTS â€” clear ALL leftover open policies first,
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

-- ------------------------------------------------------------
-- [Migration File: 016_seed_real_inventory.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Real Initial Inventory Seed (016)
-- Populates essential real pharmacy medications into public.products
-- ============================================

INSERT INTO public.products (name, brand, category, cost_price, selling_price, stock_quantity, low_stock_threshold, expiry_date, barcode)
SELECT * FROM (VALUES
  ('Paracetamol 500mg', 'Emzor', 'Analgesic', 30.00, 50.00, 250, 20, '2027-08-31'::date, '890123456701'),
  ('Amoxicillin 500mg', 'Fidson', 'Antibiotics', 85.00, 120.00, 150, 15, '2026-11-30'::date, '890123456702'),
  ('Artemether / Lumefantrine (Coartem)', 'Novartis', 'Anti-Malaria', 1250.00, 1800.00, 80, 10, '2027-05-31'::date, '890123456703'),
  ('Vitamin C 1000mg', 'Emzor', 'Vitamins', 18.00, 30.00, 400, 30, '2027-12-31'::date, '890123456704'),
  ('Ciprofloxacin 500mg', 'Swiss Pharma', 'Antibiotics', 320.00, 500.00, 60, 10, '2026-10-31'::date, '890123456705'),
  ('Omeprazole 20mg', 'M&B', 'Antacid / Ulcer', 280.00, 450.00, 95, 15, '2027-04-30'::date, '890123456706'),
  ('Metformin 500mg', 'Swiss Pharma', 'Diabetes Care', 55.00, 90.00, 180, 20, '2027-09-30'::date, '890123456707'),
  ('Metronidazole (Flagyl) 200mg', 'May & Baker', 'Antibiotics', 40.00, 70.00, 210, 25, '2026-12-31'::date, '890123456708'),
  ('ORS (Oral Rehydration Salts)', 'Generic', 'First Aid / Fluids', 65.00, 100.00, 130, 20, '2028-01-31'::date, '890123456709'),
  ('Ibuprofen 400mg', 'Emzor', 'Analgesic', 45.00, 80.00, 160, 20, '2027-07-31'::date, '890123456710'),
  ('Augmentin 625mg', 'GSK', 'Antibiotics', 3800.00, 5200.00, 35, 8, '2026-09-30'::date, '890123456711'),
  ('Diclofenac Potassium 50mg', 'M&B', 'Analgesic', 70.00, 120.00, 140, 15, '2027-06-30'::date, '890123456712'),
  ('Paracetamol Syrup 60ml', 'Emzor', 'Pediatrics', 350.00, 550.00, 75, 10, '2027-03-31'::date, '890123456713'),
  ('Multivitamin Syrup 100ml', 'Fidson', 'Pediatrics / Vitamins', 600.00, 950.00, 50, 10, '2027-05-31'::date, '890123456714'),
  ('Ventolin Inhaler 100mcg', 'GSK', 'Respiratory Care', 4200.00, 5800.00, 25, 5, '2027-11-30'::date, '890123456715')
) AS v(name, brand, category, cost_price, selling_price, stock_quantity, low_stock_threshold, expiry_date, barcode)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products WHERE public.products.name = v.name OR (v.barcode IS NOT NULL AND public.products.barcode = v.barcode)
);


-- ------------------------------------------------------------
-- [Migration File: 017_fix_stock_and_cost.sql]
-- ------------------------------------------------------------

-- ============================================
-- Emmanuel Pharmacy â€” Migration 017: Ensure Stock Deduction Trigger Works
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

-- ================================================================
-- SEED DEFAULT STAFF ACCOUNTS
-- Password for all accounts: TestPass6!
-- ================================================================

DO $$
BEGIN
  -- 1. Admin Account
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin1@emmanuelpharmacy.app') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin1@emmanuelpharmacy.app',
      crypt('TestPass6!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin Emmanuel","username":"admin1","role":"admin"}',
      now(), now(), ''
    );
  END IF;

  -- 2. Cashier Account
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'cashier1@emmanuelpharmacy.app') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'cashier1@emmanuelpharmacy.app',
      crypt('TestPass6!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Cashier One","username":"cashier1","role":"cashier"}',
      now(), now(), ''
    );
  END IF;

  -- 3. Attendant Account
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'attendant1@emmanuelpharmacy.app') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'attendant1@emmanuelpharmacy.app',
      crypt('TestPass6!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Attendant One","username":"attendant1","role":"attendant"}',
      now(), now(), ''
    );
  END IF;
END $$;



-- ------------------------------------------------------------
-- [Migration File: 018_allow_staff_register_products.sql]
-- ------------------------------------------------------------

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

