-- ============================================================
-- ADMIN USER SETUP — RUN AFTER CREATING AUTH USER
-- ============================================================
--
-- STEP 1: Go to Supabase Dashboard → Authentication → Users
--         Create a user with your desired email + password
--
-- STEP 2: Copy the user's UUID from the dashboard
--         (Click on the user → copy the UUID shown)
--
-- STEP 3: Replace 'YOUR-AUTH-USER-UUID-HERE' below with the actual UUID
--
-- STEP 4: Run this SQL in the Supabase SQL Editor
-- ============================================================

-- OPTION A: If you already have rows in rpa_users table,
-- the app will auto-link by email when you first log in.
-- Just make sure the email in rpa_users matches the auth email.

-- OPTION B: Insert admin user directly:
INSERT INTO public.rpa_users (
  auth_user_id,
  username,
  full_name,
  email,
  role,
  branches,
  is_active
) VALUES (
  -- ⚠️ REPLACE THIS with the UUID from Supabase Auth dashboard:
  'YOUR-AUTH-USER-UUID-HERE',
  'admin',
  'Administrator',
  -- ⚠️ REPLACE THIS with the same email you used in Supabase Auth:
  'your-admin@email.com',
  'HS-ADMIN',
  ARRAY['LMIT-HS-MILAN','LMIT-HS-BOLOGNA','LMIT-HS-TORINO','LMIT-HS-PADOVA','LMIT-HS-ROME','LMIT-HS-NAPLES','LMIT-HS-PALERMO','LMIT-HS-BARI'],
  true
) ON CONFLICT (username) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  branches = EXCLUDED.branches;


-- ============================================================
-- SAMPLE USERS (RSM + ASM) — Add after admin is set up
-- ============================================================

-- RSM - North Region Manager (Milan, Bologna, Torino, Padova)
-- INSERT INTO public.rpa_users (username, full_name, email, role, branches, is_active)
-- VALUES ('rsm_north', 'Marco Rossi', 'rsm.north@company.com', 'RSM',
--         ARRAY['LMIT-HS-MILAN','LMIT-HS-BOLOGNA','LMIT-HS-TORINO','LMIT-HS-PADOVA'], true);

-- RSM - South Region Manager (Rome, Napoli, Palermo, Bari)
-- INSERT INTO public.rpa_users (username, full_name, email, role, branches, is_active)
-- VALUES ('rsm_south', 'Giulia Bianchi', 'rsm.south@company.com', 'RSM',
--         ARRAY['LMIT-HS-ROME','LMIT-HS-NAPLES','LMIT-HS-PALERMO','LMIT-HS-BARI'], true);

-- ASM - Milan Area Manager
-- INSERT INTO public.rpa_users (username, full_name, email, role, branches, is_active)
-- VALUES ('asm_milan', 'Andrea Verdi', 'asm.milan@company.com', 'ASM',
--         ARRAY['LMIT-HS-MILAN'], true);

-- ASM - Rome Area Manager
-- INSERT INTO public.rpa_users (username, full_name, email, role, branches, is_active)
-- VALUES ('asm_rome', 'Sofia Romano', 'asm.rome@company.com', 'ASM',
--         ARRAY['LMIT-HS-ROME'], true);
