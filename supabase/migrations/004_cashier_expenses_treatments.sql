-- ============================================
-- Emmanuel Pharmacy — Expenses, Day Close, Treatments & Credit Repayments (Updated 004)
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
