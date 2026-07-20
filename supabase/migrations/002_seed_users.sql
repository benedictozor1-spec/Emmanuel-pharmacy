-- ============================================
-- Emmanuel Pharmacy — Create the 6 Staff Accounts
-- Run this in Supabase SQL Editor AFTER 001_profiles.sql
-- 
-- IMPORTANT: Change the passwords below before running!
-- Each person must have their own private password.
-- ============================================

-- Disable email confirmation for these accounts (they're staff, not public signups)
-- You must also disable "Enable email confirmations" in:
-- Supabase Dashboard → Authentication → Providers → Email → Toggle OFF "Confirm email"

-- Create Admin (Dad)
SELECT supabase_auth_admin.create_user(
  '{"email": "admin@emmanuelpharmacy.app", "password": "CHANGE_ME_admin123", "email_confirm": true, "user_metadata": {"username": "admin", "full_name": "Admin (Dad)", "role": "admin"}}'::jsonb
);

-- Create Cashier
SELECT supabase_auth_admin.create_user(
  '{"email": "cashier@emmanuelpharmacy.app", "password": "CHANGE_ME_cashier123", "email_confirm": true, "user_metadata": {"username": "cashier", "full_name": "Cashier", "role": "cashier"}}'::jsonb
);

-- Create Attendant 1
SELECT supabase_auth_admin.create_user(
  '{"email": "attendant1@emmanuelpharmacy.app", "password": "CHANGE_ME_attend1", "email_confirm": true, "user_metadata": {"username": "attendant1", "full_name": "Attendant 1", "role": "attendant"}}'::jsonb
);

-- Create Attendant 2
SELECT supabase_auth_admin.create_user(
  '{"email": "attendant2@emmanuelpharmacy.app", "password": "CHANGE_ME_attend2", "email_confirm": true, "user_metadata": {"username": "attendant2", "full_name": "Attendant 2", "role": "attendant"}}'::jsonb
);

-- Create Attendant 3
SELECT supabase_auth_admin.create_user(
  '{"email": "attendant3@emmanuelpharmacy.app", "password": "CHANGE_ME_attend3", "email_confirm": true, "user_metadata": {"username": "attendant3", "full_name": "Attendant 3", "role": "attendant"}}'::jsonb
);

-- Create Attendant 4
SELECT supabase_auth_admin.create_user(
  '{"email": "attendant4@emmanuelpharmacy.app", "password": "CHANGE_ME_attend4", "email_confirm": true, "user_metadata": {"username": "attendant4", "full_name": "Attendant 4", "role": "attendant"}}'::jsonb
);
