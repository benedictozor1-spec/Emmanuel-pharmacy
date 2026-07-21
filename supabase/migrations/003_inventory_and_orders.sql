-- ============================================
-- Emmanuel Pharmacy — Products, Orders & Order Counter Migration (Updated 003)
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
  late_night BOOLEAN NOT NULL DEFAULT false, -- Flag for orders created between 00:00 and 06:00
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to automatically flag late_night orders (created between 00:00 and 06:00)
CREATE OR REPLACE FUNCTION public.check_late_night_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXTRACT(HOUR FROM NEW.created_at) >= 0 AND EXTRACT(HOUR FROM NEW.created_at) < 6 THEN
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

-- Attendants may ONLY update their own orders while status is still 'waiting_for_payment'
CREATE POLICY "Attendants can update own pending orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'attendant'
    AND attendant_id = auth.uid()
    AND status = 'waiting_for_payment'
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
  ('Artemether / Lumefantrine', 'Novartis · Coartem', 'Antimalarial', 'pack', 1300.00, 1800.00, 45, 10, '2028-05-31', '890123456703'),
  ('Vitamin C 1000mg', 'Emzor', 'Supplement', 'tab', 20.00, 30.00, 500, 50, '2027-11-30', '890123456704'),
  ('Metformin 500mg', 'Swiss Pharma', 'Antidiabetic', 'tab', 55.00, 80.00, 15, 20, '2026-12-31', '890123456705'),
  ('ORS Sachet', 'Generic', 'Rehydration', 'sachet', 70.00, 100.00, 120, 25, '2027-06-30', '890123456706'),
  ('Ciprofloxacin 500mg', 'Fidson', 'Antibiotic', 'tab', 150.00, 250.00, 60, 15, '2027-04-30', '890123456707'),
  ('Ibuprofen 400mg', 'Emzor', 'Analgesic', 'tab', 40.00, 60.00, 180, 30, '2028-01-31', '890123456708')
ON CONFLICT (barcode) DO NOTHING;
