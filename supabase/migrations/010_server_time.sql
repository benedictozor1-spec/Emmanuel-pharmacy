-- ============================================
-- Emmanuel Pharmacy — Server Time Function (010)
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
