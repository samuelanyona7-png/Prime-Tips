-- SUPABASE SCHEMA FOR PRIME-TIPS

-- 1. PRICES TABLE
CREATE TABLE prices (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  package_key TEXT UNIQUE NOT NULL,
  price_kes BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. VIP PACKAGES (Multi-day pricing)
CREATE TABLE vip_packages (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  package_name TEXT UNIQUE NOT NULL,
  days INTEGER NOT NULL,
  price_kes BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PASSWORDS/ACCESS CODES
CREATE TABLE access_codes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  section_key TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  client_name TEXT,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. FREE PICKS (Weekly by day)
CREATE TABLE free_picks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  day_of_week TEXT NOT NULL,
  match_name TEXT NOT NULL,
  pick TEXT NOT NULL,
  odds DECIMAL(5,2) NOT NULL,
  confidence TEXT,
  status TEXT DEFAULT 'Pending',
  pick_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CORRECT SCORE PICKS
CREATE TABLE correct_score_picks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  match_name TEXT NOT NULL,
  score TEXT NOT NULL,
  odds DECIMAL(8,2) NOT NULL,
  status TEXT DEFAULT 'Pending',
  pick_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. BTTS PICKS
CREATE TABLE btts_picks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  match_name TEXT NOT NULL,
  pick TEXT NOT NULL,
  odds DECIMAL(5,2) NOT NULL,
  confidence TEXT,
  status TEXT DEFAULT 'Pending',
  pick_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. OVER/UNDER PICKS
CREATE TABLE over_under_picks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  match_name TEXT NOT NULL,
  pick TEXT NOT NULL,
  odds DECIMAL(5,2) NOT NULL,
  confidence TEXT,
  status TEXT DEFAULT 'Pending',
  pick_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. BASKETBALL PICKS
CREATE TABLE basketball_picks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  match_name TEXT NOT NULL,
  pick TEXT NOT NULL,
  odds DECIMAL(5,2) NOT NULL,
  confidence TEXT,
  status TEXT DEFAULT 'Pending',
  pick_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. WINNING PROOFS
CREATE TABLE winning_proofs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  odds DECIMAL(8,2) NOT NULL,
  proof_date DATE,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. PENDING PAYMENTS
CREATE TABLE pending_payments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  section_key TEXT NOT NULL,
  phone_email TEXT NOT NULL,
  amount_kes BIGINT NOT NULL,
  currency_symbol TEXT,
  plan_name TEXT,
  reference_code TEXT NOT NULL,
  screenshot_url TEXT,
  payment_status TEXT DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. VIP CONTENT
CREATE TABLE vip_content (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  section_key TEXT UNIQUE NOT NULL,
  html_content TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY (Optional but recommended)
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE free_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE correct_score_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE btts_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE over_under_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE winning_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;

-- ALLOW PUBLIC READ ACCESS (Everyone can see picks/proofs)
CREATE POLICY "Allow public read" ON free_picks FOR SELECT USING (TRUE);
CREATE POLICY "Allow public read" ON correct_score_picks FOR SELECT USING (TRUE);
CREATE POLICY "Allow public read" ON btts_picks FOR SELECT USING (TRUE);
CREATE POLICY "Allow public read" ON over_under_picks FOR SELECT USING (TRUE);
CREATE POLICY "Allow public read" ON basketball_picks FOR SELECT USING (TRUE);
CREATE POLICY "Allow public read" ON winning_proofs FOR SELECT USING (TRUE);
CREATE POLICY "Allow public read" ON prices FOR SELECT USING (TRUE);

-- INSERT DEFAULT DATA
INSERT INTO prices (package_key, price_kes) VALUES
('daily', 500),
('bestthree', 1200),
('draws', 1500),
('correctscore', 3000),
('overunder', 800)
ON CONFLICT (package_key) DO NOTHING;

INSERT INTO vip_packages (package_name, days, price_kes) VALUES
('Weekly', 7, 3000),
('Monthly', 30, 10000),
('Quarterly', 90, 21000),
('Lifetime', 36500, 100000)
ON CONFLICT (package_name) DO NOTHING;
