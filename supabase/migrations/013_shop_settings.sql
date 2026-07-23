-- ============================================
-- Emmanuel Pharmacy — Shop Settings Migration (013)
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
