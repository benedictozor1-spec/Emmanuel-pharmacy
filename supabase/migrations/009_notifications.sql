-- ============================================
-- Emmanuel Pharmacy — Migration 009: Admin Notifications Table
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
