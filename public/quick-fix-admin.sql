-- ============================================================
-- QUICK FIX: Auto-create admin from existing auth user
-- ============================================================
-- Run this if you already created an auth user but can't log in.
-- This finds your auth user by email and creates/links an rpa_users profile.
--
-- ⚠️ Replace 'your-email@example.com' with the email you used to sign up
-- ============================================================

-- Step 1: Find your auth user UUID
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Step 2: Create admin profile (replace the UUID and email below)
-- Copy the UUID from Step 1 result and paste it below:

/*
INSERT INTO public.rpa_users (
  auth_user_id, username, full_name, email, role, branches, is_active
) VALUES (
  'PASTE-YOUR-UUID-HERE',
  'admin',
  'Administrator',
  'your-email@example.com',
  'HS-ADMIN',
  ARRAY['LMIT-HS-MILAN','LMIT-HS-BOLOGNA','LMIT-HS-TORINO','LMIT-HS-PADOVA','LMIT-HS-ROME','LMIT-HS-NAPLES','LMIT-HS-PALERMO','LMIT-HS-BARI'],
  true
) ON CONFLICT (username) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  role = 'HS-ADMIN',
  branches = ARRAY['LMIT-HS-MILAN','LMIT-HS-BOLOGNA','LMIT-HS-TORINO','LMIT-HS-PADOVA','LMIT-HS-ROME','LMIT-HS-NAPLES','LMIT-HS-PALERMO','LMIT-HS-BARI'];
*/

-- ============================================================
-- OR: Easiest method — just run this single command
-- It will find ALL existing auth users with no rpa_users profile
-- and create HS-ADMIN profiles for them
-- ============================================================

INSERT INTO public.rpa_users (auth_user_id, username, full_name, email, role, branches, is_active)
SELECT
  au.id,
  SPLIT_PART(au.email, '@', 1),
  'Administrator',
  au.email,
  'HS-ADMIN',
  ARRAY['LMIT-HS-MILAN','LMIT-HS-BOLOGNA','LMIT-HS-TORINO','LMIT-HS-PADOVA','LMIT-HS-ROME','LMIT-HS-NAPLES','LMIT-HS-PALERMO','LMIT-HS-BARI'],
  true
FROM auth.users au
LEFT JOIN public.rpa_users ru ON ru.auth_user_id = au.id
WHERE ru.id IS NULL
ON CONFLICT (username) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  role = 'HS-ADMIN',
  branches = ARRAY['LMIT-HS-MILAN','LMIT-HS-BOLOGNA','LMIT-HS-TORINO','LMIT-HS-PADOVA','LMIT-HS-ROME','LMIT-HS-NAPLES','LMIT-HS-PALERMO','LMIT-HS-BARI'];
