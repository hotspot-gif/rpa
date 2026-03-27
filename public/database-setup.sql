-- ============================================================
-- RETAILER PERFORMANCE ANALYTICS — FULL DATABASE SETUP (ITALY)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. ENABLE UUID EXTENSION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rpa_users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  auth_user_id uuid UNIQUE,
  username text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['HS-ADMIN','RSM','ASM'])),
  branches text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rpa_users_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.retailer_summary (
  retailer_id text NOT NULL,
  branch text NOT NULL,
  zone text NOT NULL,
  ga_cnt numeric NOT NULL DEFAULT 0,
  pi_l6 numeric NOT NULL DEFAULT 0,
  pi_g6 numeric NOT NULL DEFAULT 0,
  np_l6 numeric NOT NULL DEFAULT 0,
  np_g6 numeric NOT NULL DEFAULT 0,
  port_in numeric NOT NULL DEFAULT 0,
  port_out numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  pi_raw numeric NOT NULL DEFAULT 0,
  add_gara numeric NOT NULL DEFAULT 0,
  pi_total numeric NOT NULL DEFAULT 0,
  incentive numeric NOT NULL DEFAULT 0,
  renewal_rate numeric NOT NULL DEFAULT 0,
  po_deduction numeric NOT NULL DEFAULT 0,
  clawback numeric NOT NULL DEFAULT 0,
  renewal_impact numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retailer_summary_pkey PRIMARY KEY (retailer_id)
);

CREATE TABLE IF NOT EXISTS public.retailer_monthly (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  retailer_id text NOT NULL REFERENCES public.retailer_summary(retailer_id),
  branch text NOT NULL,
  month text NOT NULL,
  ga_cnt numeric NOT NULL DEFAULT 0,
  pi_l6 numeric NOT NULL DEFAULT 0,
  pi_g6 numeric NOT NULL DEFAULT 0,
  np_l6 numeric NOT NULL DEFAULT 0,
  np_g6 numeric NOT NULL DEFAULT 0,
  port_in numeric NOT NULL DEFAULT 0,
  port_out numeric NOT NULL DEFAULT 0,
  po_deduction numeric NOT NULL DEFAULT 0,
  clawback numeric NOT NULL DEFAULT 0,
  renewal_impact numeric NOT NULL DEFAULT 0,
  total_ded numeric NOT NULL DEFAULT 0,
  pi_raw numeric NOT NULL DEFAULT 0,
  add_gara numeric NOT NULL DEFAULT 0,
  pi_total numeric NOT NULL DEFAULT 0,
  incentive numeric NOT NULL DEFAULT 0,
  renewal_rate numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.import_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filename text NOT NULL,
  imported_by uuid REFERENCES public.rpa_users(id),
  rows_processed integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  new_retailers integer NOT NULL DEFAULT 0,
  upd_retailers integer NOT NULL DEFAULT 0,
  new_months text[] NOT NULL DEFAULT '{}',
  upd_months text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'success' CHECK (status = ANY (ARRAY['success','partial','failed'])),
  error_msg text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_retailer_monthly_unique
  ON public.retailer_monthly (retailer_id, month);

-- 3. ROW LEVEL SECURITY
-- --------------------------------------------------------
ALTER TABLE public.rpa_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.rpa_users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.rpa_users;
DROP POLICY IF EXISTS "Users can read retailers in their branches" ON public.retailer_summary;
DROP POLICY IF EXISTS "Users can read monthly data for their branches" ON public.retailer_monthly;
DROP POLICY IF EXISTS "Admins can insert retailer_summary" ON public.retailer_summary;
DROP POLICY IF EXISTS "Admins can update retailer_summary" ON public.retailer_summary;
DROP POLICY IF EXISTS "Admins can insert retailer_monthly" ON public.retailer_monthly;
DROP POLICY IF EXISTS "Admins can update retailer_monthly" ON public.retailer_monthly;
DROP POLICY IF EXISTS "Admins can manage import_log" ON public.import_log;
DROP POLICY IF EXISTS "Users can read import_log" ON public.import_log;

-- rpa_users: users can read their own profile
CREATE POLICY "Users can read own profile" ON public.rpa_users
  FOR SELECT USING (auth_user_id = auth.uid());

-- rpa_users: admins can manage all users
CREATE POLICY "Admins can manage users" ON public.rpa_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rpa_users u
      WHERE u.auth_user_id = auth.uid() AND u.role = 'HS-ADMIN'
    )
  );

-- retailer_summary: users can only see retailers in their branches
CREATE POLICY "Users can read retailers in their branches" ON public.retailer_summary
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rpa_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.is_active = true
        AND (
          u.role = 'HS-ADMIN'
          OR branch = ANY(u.branches)
        )
    )
  );

-- retailer_monthly: same branch-based access
CREATE POLICY "Users can read monthly data for their branches" ON public.retailer_monthly
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rpa_users u
      WHERE u.auth_user_id = auth.uid()
        AND u.is_active = true
        AND (
          u.role = 'HS-ADMIN'
          OR branch = ANY(u.branches)
        )
    )
  );

-- Admin write policies for retailer_summary
CREATE POLICY "Admins can insert retailer_summary" ON public.retailer_summary
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rpa_users u
      WHERE u.auth_user_id = auth.uid() AND u.role = 'HS-ADMIN'
    )
  );

CREATE POLICY "Admins can update retailer_summary" ON public.retailer_summary
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.rpa_users u
      WHERE u.auth_user_id = auth.uid() AND u.role = 'HS-ADMIN'
    )
  );

-- Admin write policies for retailer_monthly
CREATE POLICY "Admins can insert retailer_monthly" ON public.retailer_monthly
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rpa_users u
      WHERE u.auth_user_id = auth.uid() AND u.role = 'HS-ADMIN'
    )
  );

CREATE POLICY "Admins can update retailer_monthly" ON public.retailer_monthly
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.rpa_users u
      WHERE u.auth_user_id = auth.uid() AND u.role = 'HS-ADMIN'
    )
  );

-- import_log: admins can write, all can read
CREATE POLICY "Users can read import_log" ON public.import_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rpa_users u
      WHERE u.auth_user_id = auth.uid() AND u.is_active = true
    )
  );

CREATE POLICY "Admins can manage import_log" ON public.import_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rpa_users u
      WHERE u.auth_user_id = auth.uid() AND u.role = 'HS-ADMIN'
    )
  );


-- 4. SEED DATA — RETAILER SUMMARIES (ITALY)
-- --------------------------------------------------------
-- North Region: Milan, Bologna, Torino, Padova
-- South Region: Rome, Napoli, Palermo, Bari

INSERT INTO public.retailer_summary (retailer_id, branch, zone, ga_cnt, pi_l6, pi_g6, np_l6, np_g6, port_in, port_out, total_deductions, pi_raw, add_gara, pi_total, incentive, renewal_rate, po_deduction, clawback, renewal_impact, updated_at)
VALUES
  -- MILAN (8 retailers)
  ('MI-1001', 'Milan', 'Centro', 542, 4820.50, 18950.75, 3250.00, 12800.50, 8450.25, 45, 2890.50, 39821.75, 4520.00, 12970.25, 49901.50, 78.5, 1250.00, 980.50, 660.00, now()),
  ('MI-1002', 'Milan', 'Centro', 312, 2910.25, 11450.00, 1890.50, 7650.75, 5120.00, 32, 1780.25, 23901.50, 2780.00, 7900.00, 30021.25, 72.3, 820.00, 560.25, 400.00, now()),
  ('MI-1003', 'Milan', 'Navigli', 678, 6250.75, 24500.25, 4180.00, 16450.50, 10890.75, 58, 3650.00, 51381.50, 5890.25, 16780.75, 64512.25, 81.2, 1580.00, 1240.00, 830.00, now()),
  ('MI-1004', 'Milan', 'Navigli', 225, 1980.00, 7820.50, 1320.75, 5280.25, 3450.00, 22, 1290.00, 16401.50, 1890.00, 5340.00, 20451.50, 69.8, 580.00, 420.00, 290.00, now()),
  ('MI-1005', 'Milan', 'Brera', 445, 3920.50, 15400.75, 2680.25, 10500.00, 6890.50, 38, 2450.75, 32501.50, 3750.25, 10640.75, 40691.50, 76.1, 1050.00, 820.75, 580.00, now()),
  ('MI-1006', 'Milan', 'Brera', 389, 3450.25, 13500.00, 2290.75, 9150.50, 5980.25, 34, 2120.50, 28391.50, 3250.00, 9230.25, 35501.25, 74.5, 920.00, 710.50, 490.00, now()),
  ('MI-1007', 'Milan', 'Porta Romana', 501, 4420.00, 17350.50, 2950.00, 11780.25, 7650.75, 42, 2780.25, 36500.75, 4120.50, 11771.25, 45491.75, 77.8, 1180.00, 950.25, 650.00, now()),
  ('MI-1008', 'Milan', 'Porta Romana', 623, 5580.25, 21900.00, 3720.50, 14850.75, 9680.50, 52, 3350.00, 46051.50, 5250.75, 14931.25, 57632.75, 80.1, 1450.00, 1120.00, 780.00, now()),

  -- BOLOGNA (7 retailers)
  ('BO-2001', 'Bologna', 'Centro Storico', 598, 5340.75, 20980.25, 3560.00, 14200.50, 9250.50, 50, 3180.25, 44081.50, 5020.00, 14270.50, 55171.75, 79.3, 1380.00, 1060.25, 740.00, now()),
  ('BO-2002', 'Bologna', 'Centro Storico', 425, 3780.25, 14850.50, 2520.75, 10050.00, 6550.25, 36, 2280.50, 31201.50, 3560.25, 10110.50, 39031.50, 75.6, 980.00, 770.50, 530.00, now()),
  ('BO-2003', 'Bologna', 'San Donato', 710, 6450.50, 25320.75, 4290.25, 17120.00, 11250.00, 62, 3890.00, 53181.50, 6120.50, 17370.50, 66662.00, 82.1, 1680.00, 1320.00, 890.00, now()),
  ('BO-2004', 'Bologna', 'San Donato', 198, 1750.00, 6880.25, 1170.50, 4650.75, 3050.00, 20, 1120.25, 14451.50, 1650.00, 4700.00, 18031.25, 68.2, 510.00, 370.25, 240.00, now()),
  ('BO-2005', 'Bologna', 'Navile', 480, 4250.75, 16700.00, 2830.50, 11280.25, 7350.50, 40, 2580.75, 35061.50, 3980.25, 11330.75, 43811.50, 76.8, 1100.00, 880.75, 600.00, now()),
  ('BO-2006', 'Bologna', 'Navile', 356, 3150.25, 12380.50, 2110.00, 8400.75, 5480.25, 30, 1920.50, 26041.50, 2980.00, 8460.25, 32581.25, 73.4, 840.00, 650.50, 430.00, now()),
  ('BO-2007', 'Bologna', 'Reno', 545, 4880.50, 19150.25, 3240.75, 12920.50, 8420.00, 46, 2950.00, 40191.50, 4580.00, 13000.00, 50241.50, 78.2, 1280.00, 990.00, 680.00, now()),

  -- TORINO (7 retailers)
  ('TO-3001', 'Torino', 'Centro', 520, 4650.25, 18250.50, 3100.75, 12350.00, 8050.50, 44, 2780.00, 38351.50, 4380.25, 12430.75, 48002.25, 77.9, 1200.00, 940.00, 640.00, now()),
  ('TO-3002', 'Torino', 'Centro', 380, 3380.50, 13280.75, 2250.25, 8980.50, 5850.25, 32, 2050.50, 27891.50, 3180.00, 9030.25, 34901.25, 74.1, 890.00, 690.50, 470.00, now()),
  ('TO-3003', 'Torino', 'San Salvario', 645, 5780.00, 22700.25, 3850.50, 15350.75, 10020.00, 56, 3480.25, 47681.50, 5450.50, 15470.50, 59671.75, 81.5, 1510.00, 1180.25, 790.00, now()),
  ('TO-3004', 'Torino', 'San Salvario', 210, 1850.25, 7280.50, 1240.00, 4920.75, 3220.25, 20, 1180.50, 15291.50, 1750.00, 4970.25, 19031.25, 67.8, 540.00, 390.50, 250.00, now()),
  ('TO-3005', 'Torino', 'Lingotto', 458, 4080.75, 16020.00, 2720.25, 10850.50, 7080.50, 38, 2480.00, 33671.50, 3850.00, 10930.50, 42121.50, 76.3, 1060.00, 840.00, 580.00, now()),
  ('TO-3006', 'Torino', 'Lingotto', 342, 3050.00, 11980.25, 2020.50, 8080.00, 5260.00, 30, 1850.75, 25130.75, 2860.25, 8120.25, 31301.25, 73.0, 810.00, 620.75, 420.00, now()),
  ('TO-3007', 'Torino', 'Aurora', 495, 4420.50, 17350.75, 2940.00, 11720.25, 7640.75, 42, 2680.25, 36431.50, 4150.50, 11791.25, 45542.50, 77.5, 1150.00, 910.25, 620.00, now()),

  -- PADOVA (6 retailers)
  ('PD-4001', 'Padova', 'Centro Storico', 485, 4320.75, 16980.50, 2880.25, 11480.00, 7490.50, 40, 2620.00, 35661.50, 4080.00, 11570.50, 44692.00, 77.0, 1120.00, 890.00, 610.00, now()),
  ('PD-4002', 'Padova', 'Centro Storico', 365, 3250.50, 12750.25, 2160.75, 8620.50, 5620.25, 32, 1980.50, 26781.50, 3060.00, 8680.25, 33501.25, 73.8, 860.00, 670.50, 450.00, now()),
  ('PD-4003', 'Padova', 'Arcella', 580, 5180.25, 20350.75, 3450.50, 13750.00, 8960.75, 48, 3120.00, 42731.50, 4880.25, 13841.00, 53452.50, 79.5, 1350.00, 1060.00, 710.00, now()),
  ('PD-4004', 'Padova', 'Arcella', 235, 2080.00, 8180.50, 1390.25, 5540.75, 3620.00, 22, 1320.50, 17191.50, 1970.00, 5590.00, 21481.00, 69.2, 600.00, 430.50, 290.00, now()),
  ('PD-4005', 'Padova', 'Prato della Valle', 432, 3850.50, 15120.75, 2560.00, 10200.25, 6650.50, 36, 2350.75, 31731.50, 3620.00, 10270.50, 39641.25, 75.8, 1010.00, 800.75, 540.00, now()),
  ('PD-4006', 'Padova', 'Prato della Valle', 298, 2650.25, 10420.00, 1760.50, 7020.75, 4580.25, 26, 1620.50, 21851.50, 2490.25, 7070.50, 27791.50, 71.5, 740.00, 530.50, 350.00, now()),

  -- ROME (8 retailers)
  ('RM-5001', 'Rome', 'Trastevere', 560, 5010.75, 19680.00, 3340.25, 13320.50, 8680.25, 48, 3020.00, 41351.50, 4720.50, 13400.75, 51732.25, 79.0, 1310.00, 1020.00, 690.00, now()),
  ('RM-5002', 'Rome', 'Trastevere', 410, 3650.00, 14350.50, 2420.75, 9650.25, 6290.00, 34, 2220.25, 30071.50, 3420.50, 9710.50, 37561.75, 75.2, 950.00, 760.25, 510.00, now()),
  ('RM-5003', 'Rome', 'Testaccio', 690, 6180.50, 24280.75, 4100.25, 16350.00, 10650.50, 58, 3700.00, 50911.50, 5800.25, 16450.75, 63662.25, 81.8, 1600.00, 1260.00, 840.00, now()),
  ('RM-5004', 'Rome', 'Testaccio', 250, 2220.00, 8720.50, 1480.25, 5900.75, 3850.00, 24, 1400.50, 18321.50, 2100.00, 5950.00, 22871.00, 70.5, 640.00, 460.50, 300.00, now()),
  ('RM-5005', 'Rome', 'EUR', 510, 4550.50, 17880.25, 3020.75, 12050.00, 7850.00, 42, 2720.50, 37501.50, 4280.00, 12130.00, 46911.00, 78.0, 1170.00, 920.50, 630.00, now()),
  ('RM-5006', 'Rome', 'EUR', 350, 3120.25, 12250.50, 2060.00, 8220.75, 5350.50, 30, 1890.75, 25651.50, 2910.00, 8260.50, 31921.25, 73.2, 820.00, 640.75, 430.00, now()),
  ('RM-5007', 'Rome', 'Prati', 595, 5320.75, 20900.00, 3540.25, 14120.50, 9200.25, 50, 3200.00, 43881.50, 5000.50, 14200.75, 54882.25, 79.8, 1380.00, 1090.00, 730.00, now()),
  ('RM-5008', 'Rome', 'Prati', 215, 1910.00, 7500.25, 1270.50, 5060.00, 3300.00, 20, 1210.50, 15741.75, 1800.00, 5100.00, 19631.25, 68.5, 550.00, 400.50, 260.00, now()),

  -- NAPOLI (7 retailers)
  ('NA-6001', 'Napoli', 'Chiaia', 530, 4740.50, 18620.75, 3150.00, 12560.25, 8190.50, 44, 2840.00, 39071.50, 4460.00, 12650.50, 48882.00, 78.2, 1220.00, 960.00, 660.00, now()),
  ('NA-6002', 'Napoli', 'Chiaia', 395, 3520.25, 13830.50, 2340.00, 9330.75, 6080.25, 34, 2140.50, 29021.50, 3300.00, 9380.25, 36261.25, 74.8, 930.00, 720.50, 490.00, now()),
  ('NA-6003', 'Napoli', 'Vomero', 650, 5820.00, 22860.25, 3870.50, 15430.75, 10060.50, 56, 3490.25, 47981.50, 5480.50, 15541.00, 60032.25, 81.0, 1520.00, 1180.25, 790.00, now()),
  ('NA-6004', 'Napoli', 'Vomero', 220, 1950.25, 7660.50, 1300.00, 5180.75, 3380.00, 22, 1240.50, 16091.50, 1840.00, 5220.00, 20071.00, 69.0, 570.00, 410.50, 260.00, now()),
  ('NA-6005', 'Napoli', 'Fuorigrotta', 475, 4240.00, 16650.25, 2820.50, 11240.75, 7320.75, 40, 2600.50, 34951.50, 3980.25, 11301.00, 43651.50, 76.8, 1110.00, 880.50, 610.00, now()),
  ('NA-6006', 'Napoli', 'Fuorigrotta', 330, 2940.50, 11550.75, 1950.25, 7780.50, 5070.00, 28, 1790.25, 24221.50, 2760.00, 7830.00, 30261.25, 72.5, 780.00, 600.25, 410.00, now()),
  ('NA-6007', 'Napoli', 'Posillipo', 490, 4380.25, 17200.50, 2910.00, 11600.75, 7560.50, 42, 2640.25, 36091.50, 4120.50, 11681.00, 45132.25, 77.2, 1130.00, 900.25, 610.00, now()),

  -- PALERMO (6 retailers)
  ('PA-7001', 'Palermo', 'Libertà', 500, 4460.75, 17520.00, 2960.25, 11800.50, 7700.50, 42, 2700.00, 36741.50, 4200.00, 11900.50, 45942.00, 77.5, 1160.00, 920.00, 620.00, now()),
  ('PA-7002', 'Palermo', 'Libertà', 360, 3210.50, 12610.25, 2130.75, 8500.00, 5540.25, 30, 1950.50, 26451.50, 3020.00, 8560.25, 33061.25, 73.5, 850.00, 660.50, 440.00, now()),
  ('PA-7003', 'Palermo', 'Politeama', 610, 5460.25, 21440.75, 3630.50, 14480.00, 9430.50, 52, 3280.00, 45011.50, 5140.25, 14570.75, 56302.25, 79.8, 1420.00, 1100.00, 760.00, now()),
  ('PA-7004', 'Palermo', 'Politeama', 240, 2130.00, 8380.50, 1420.25, 5660.75, 3690.00, 22, 1350.50, 17591.50, 2010.00, 5700.00, 21941.00, 69.8, 620.00, 440.50, 290.00, now()),
  ('PA-7005', 'Palermo', 'Mondello', 450, 4010.50, 15750.75, 2670.00, 10640.25, 6930.50, 38, 2430.00, 33071.50, 3780.00, 10710.50, 41361.50, 76.0, 1040.00, 830.00, 560.00, now()),
  ('PA-7006', 'Palermo', 'Mondello', 285, 2540.25, 9980.50, 1690.50, 6740.00, 4390.25, 26, 1550.75, 20951.25, 2400.00, 6790.25, 26191.00, 71.0, 670.00, 530.75, 350.00, now()),

  -- BARI (6 retailers)
  ('BA-8001', 'Bari', 'Murat', 515, 4600.50, 18070.25, 3060.75, 12200.00, 7950.00, 44, 2750.00, 37931.50, 4340.00, 12290.00, 47471.50, 77.8, 1180.00, 940.00, 630.00, now()),
  ('BA-8002', 'Bari', 'Murat', 370, 3300.50, 12960.75, 2190.25, 8730.50, 5690.25, 32, 2000.50, 27181.50, 3100.00, 8790.25, 33971.25, 74.0, 870.00, 680.50, 450.00, now()),
  ('BA-8003', 'Bari', 'Poggiofranco', 630, 5640.25, 22150.00, 3750.50, 14950.75, 9740.50, 54, 3380.00, 46491.50, 5310.50, 15051.00, 58162.50, 80.5, 1460.00, 1140.00, 780.00, now()),
  ('BA-8004', 'Bari', 'Poggiofranco', 200, 1780.00, 6990.50, 1180.25, 4700.75, 3070.00, 18, 1120.25, 14651.50, 1680.00, 4750.00, 18281.25, 67.5, 510.00, 370.25, 240.00, now()),
  ('BA-8005', 'Bari', 'Madonnella', 465, 4150.25, 16300.50, 2760.00, 11000.25, 7170.50, 38, 2520.00, 34211.00, 3900.00, 11070.50, 42761.50, 76.5, 1080.00, 860.00, 580.00, now()),
  ('BA-8006', 'Bari', 'Madonnella', 310, 2760.50, 10840.75, 1830.25, 7300.50, 4760.25, 26, 1680.25, 22731.50, 2590.25, 7350.50, 28401.75, 72.2, 730.00, 570.25, 380.00, now())
ON CONFLICT (retailer_id) DO NOTHING;


-- 5. SEED DATA — MONTHLY PERFORMANCE DATA
-- --------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  yr INT;
  mo INT;
  month_str TEXT;
  max_month INT;
  season_factor NUMERIC;
  year_growth NUMERIC;
  base_ga NUMERIC;
  base_pi_l6 NUMERIC;
  base_pi_g6 NUMERIC;
  base_np_l6 NUMERIC;
  base_np_g6 NUMERIC;
  base_port_in NUMERIC;
  v_ga_cnt NUMERIC;
  v_pi_l6 NUMERIC;
  v_pi_g6 NUMERIC;
  v_np_l6 NUMERIC;
  v_np_g6 NUMERIC;
  v_port_in NUMERIC;
  v_port_out NUMERIC;
  v_po_deduction NUMERIC;
  v_clawback NUMERIC;
  v_renewal_impact NUMERIC;
  v_total_ded NUMERIC;
  v_pi_raw NUMERIC;
  v_add_gara NUMERIC;
  v_pi_total NUMERIC;
  v_incentive NUMERIC;
  v_renewal_rate NUMERIC;
BEGIN
  FOR r IN SELECT retailer_id, branch, ga_cnt AS total_ga, incentive AS total_inc FROM public.retailer_summary
  LOOP
    base_ga := GREATEST(r.total_ga / 29.0, 5);
    base_pi_l6 := GREATEST(base_ga * 8.5, 40);
    base_pi_g6 := GREATEST(base_ga * 33.0, 150);
    base_np_l6 := GREATEST(base_ga * 5.8, 25);
    base_np_g6 := GREATEST(base_ga * 22.0, 80);
    base_port_in := GREATEST(base_ga * 14.5, 60);

    FOR yr IN 2024..2026 LOOP
      IF yr = 2026 THEN max_month := 5;
      ELSE max_month := 12;
      END IF;

      IF yr = 2024 THEN year_growth := 1.0;
      ELSIF yr = 2025 THEN year_growth := 1.12;
      ELSE year_growth := 1.22;
      END IF;

      FOR mo IN 1..max_month LOOP
        month_str := yr::TEXT || '-' || LPAD(mo::TEXT, 2, '0');

        IF mo >= 10 OR mo <= 2 THEN season_factor := 1.25;
        ELSIF mo >= 6 AND mo <= 8 THEN season_factor := 0.82;
        ELSE season_factor := 1.0;
        END IF;

        v_ga_cnt := ROUND(base_ga * season_factor * year_growth * (0.85 + random() * 0.30));
        v_pi_l6 := ROUND((base_pi_l6 * season_factor * year_growth * (0.85 + random() * 0.30))::NUMERIC, 2);
        v_pi_g6 := ROUND((base_pi_g6 * season_factor * year_growth * (0.85 + random() * 0.30))::NUMERIC, 2);
        v_np_l6 := ROUND((base_np_l6 * season_factor * year_growth * (0.85 + random() * 0.30))::NUMERIC, 2);
        v_np_g6 := ROUND((base_np_g6 * season_factor * year_growth * (0.85 + random() * 0.30))::NUMERIC, 2);
        v_port_in := ROUND((base_port_in * season_factor * year_growth * (0.85 + random() * 0.30))::NUMERIC, 2);
        v_port_out := ROUND(((v_ga_cnt * 0.06 + random() * 3)::NUMERIC), 0);
        v_po_deduction := ROUND(((v_port_out * 28 + random() * 40)::NUMERIC), 2);
        v_clawback := ROUND(((v_ga_cnt * 2.2 + random() * 30)::NUMERIC), 2);
        v_renewal_impact := ROUND(((v_ga_cnt * 1.4 + random() * 20)::NUMERIC), 2);
        v_total_ded := v_po_deduction + v_clawback + v_renewal_impact;
        v_pi_raw := v_pi_l6 + v_pi_g6 + v_np_l6 + v_np_g6;
        v_add_gara := ROUND(((v_ga_cnt * 7.5 + random() * 50)::NUMERIC), 2);
        v_pi_total := v_port_in + v_add_gara;
        v_incentive := v_pi_raw + v_pi_total - v_total_ded;
        v_renewal_rate := ROUND((60 + random() * 30)::NUMERIC, 1);

        INSERT INTO public.retailer_monthly (
          retailer_id, branch, month, ga_cnt, pi_l6, pi_g6, np_l6, np_g6,
          port_in, port_out, po_deduction, clawback, renewal_impact, total_ded,
          pi_raw, add_gara, pi_total, incentive, renewal_rate
        ) VALUES (
          r.retailer_id, r.branch, month_str, v_ga_cnt, v_pi_l6, v_pi_g6, v_np_l6, v_np_g6,
          v_port_in, v_port_out, v_po_deduction, v_clawback, v_renewal_impact, v_total_ded,
          v_pi_raw, v_add_gara, v_pi_total, v_incentive, v_renewal_rate
        ) ON CONFLICT (retailer_id, month) DO NOTHING;

      END LOOP;
    END LOOP;
  END LOOP;
END $$;


-- 6. UPDATE SUMMARY TOTALS FROM MONTHLY DATA
-- --------------------------------------------------------
UPDATE public.retailer_summary rs SET
  ga_cnt = sub.ga_cnt,
  pi_l6 = sub.pi_l6,
  pi_g6 = sub.pi_g6,
  np_l6 = sub.np_l6,
  np_g6 = sub.np_g6,
  port_in = sub.port_in,
  port_out = sub.port_out,
  po_deduction = sub.po_deduction,
  clawback = sub.clawback,
  renewal_impact = sub.renewal_impact,
  total_deductions = sub.total_ded,
  pi_raw = sub.pi_raw,
  add_gara = sub.add_gara,
  pi_total = sub.pi_total,
  incentive = sub.incentive,
  renewal_rate = sub.renewal_rate,
  updated_at = now()
FROM (
  SELECT
    retailer_id,
    SUM(ga_cnt) AS ga_cnt,
    SUM(pi_l6) AS pi_l6,
    SUM(pi_g6) AS pi_g6,
    SUM(np_l6) AS np_l6,
    SUM(np_g6) AS np_g6,
    SUM(port_in) AS port_in,
    SUM(port_out) AS port_out,
    SUM(po_deduction) AS po_deduction,
    SUM(clawback) AS clawback,
    SUM(renewal_impact) AS renewal_impact,
    SUM(total_ded) AS total_ded,
    SUM(pi_raw) AS pi_raw,
    SUM(add_gara) AS add_gara,
    SUM(pi_total) AS pi_total,
    SUM(incentive) AS incentive,
    ROUND(AVG(renewal_rate), 1) AS renewal_rate
  FROM public.retailer_monthly
  GROUP BY retailer_id
) sub
WHERE rs.retailer_id = sub.retailer_id;


-- 7. VERIFY DATA
-- --------------------------------------------------------
SELECT 'retailer_summary' AS table_name, COUNT(*) AS row_count FROM public.retailer_summary
UNION ALL
SELECT 'retailer_monthly', COUNT(*) FROM public.retailer_monthly
UNION ALL
SELECT 'Distinct branches', COUNT(DISTINCT branch) FROM public.retailer_summary;

SELECT branch, COUNT(*) AS retailers,
       SUM(ga_cnt) AS total_ga,
       ROUND(SUM(incentive)::NUMERIC, 2) AS total_incentive
FROM public.retailer_summary
GROUP BY branch
ORDER BY branch;
