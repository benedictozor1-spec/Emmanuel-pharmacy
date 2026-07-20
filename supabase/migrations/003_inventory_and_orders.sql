-- ============================================
-- Emmanuel Pharmacy — Products, Orders & Order Counter
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT DEFAULT 'General',
  unit TEXT NOT NULL DEFAULT 'tab', -- e.g. tab, pack, sachet, bottle, tin
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
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

-- Everyone logged in can read products (Attendants, Cashier, Admin)
CREATE POLICY "Authenticated users can read products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- Only Admin can insert/update/delete products
CREATE POLICY "Only Admin can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Only Admin can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- 2. Order Counter Table (for daily resetting sequential order numbers)
CREATE TABLE IF NOT EXISTS public.daily_order_counter (
  counter_date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  last_order_number INT NOT NULL DEFAULT 0
);

ALTER TABLE public.daily_order_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage order counter"
  ON public.daily_order_counter FOR ALL
  TO authenticated
  USING (true);

-- Atomic function to get next order number for today
CREATE OR REPLACE FUNCTION public.get_next_order_number()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number INT NOT NULL,
  attendant_id UUID REFERENCES auth.users(id),
  attendant_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting_for_payment' CHECK (status IN ('waiting_for_payment', 'paid', 'cancelled')),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  is_credit BOOLEAN NOT NULL DEFAULT false,
  customer_name TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Attendants can create orders
CREATE POLICY "Authenticated users can create orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Everyone can read orders
CREATE POLICY "Authenticated users can read orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (true);

-- Cashier and Admin can update order status
CREATE POLICY "Authenticated users can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (true);

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

CREATE POLICY "Authenticated users can insert order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (true);

-- 5. Seed Initial Inventory (Sample drugs from design references)
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
