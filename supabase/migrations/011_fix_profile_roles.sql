-- ============================================
-- Emmanuel Pharmacy — Fix Profile Roles Migration (011)
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
