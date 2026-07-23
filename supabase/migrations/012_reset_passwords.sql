-- ============================================
-- Emmanuel Pharmacy — Direct Password Reset SQL (012)
-- Run this in Supabase SQL Editor to set staff passwords directly
-- without requiring an email server / SMTP.
-- ============================================

-- Reset password for admin1, cashier1, attendant1 to 'TestPass6!'
UPDATE auth.users
SET encrypted_password = crypt('TestPass6!', gen_salt('bf'))
WHERE email LIKE 'admin%' OR email LIKE 'cashier%' OR email LIKE 'attendant%';
