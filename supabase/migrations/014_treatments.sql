-- ============================================
-- Emmanuel Pharmacy — Patient Treatments Migration (014)
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
