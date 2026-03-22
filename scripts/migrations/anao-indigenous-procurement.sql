-- ANAO Report 40 (2024-25): Indigenous Procurement Policy compliance
-- Source: Auditor-General Report No.40 2024-25
-- "Targets for Minimum Indigenous Employment or Supply Use in Major Australian Government Procurements — Follow-up"
-- Data extracted from Tables 3.1, A.1, A.2, A.3, A.5, A.6

-- 1. Portfolio-level MMR exemption data (Table 3.1)
CREATE TABLE IF NOT EXISTS anao_mmr_exemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio TEXT NOT NULL,
  total_contracts INTEGER,
  exempted_contracts INTEGER,
  exemption_rate NUMERIC,
  exempted_value_aud NUMERIC,
  total_value_aud NUMERIC,
  period TEXT DEFAULT 'July 2016 to September 2024',
  source TEXT DEFAULT 'ANAO Report 40 (2024-25) Table 3.1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio, period)
);

-- 2. Portfolio-level MMR compliance reporting (Table A.6)
CREATE TABLE IF NOT EXISTS anao_mmr_compliance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio TEXT NOT NULL,
  contracts_not_setup INTEGER,
  contracts_in_reporting INTEGER,
  contracts_compliant INTEGER,
  compliance_rate NUMERIC,
  period TEXT DEFAULT 'July 2023 to May 2024',
  source TEXT DEFAULT 'ANAO Report 40 (2024-25) Table A.6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio, period)
);

-- 3. UNSPSC MMR category reference (Table A.1)
CREATE TABLE IF NOT EXISTS mmr_unspsc_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  unspsc_prefix TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  mmr_start_date DATE NOT NULL,
  exemption_subcategories TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert UNSPSC MMR categories from Table A.1
INSERT INTO mmr_unspsc_categories (unspsc_prefix, description, mmr_start_date, exemption_subcategories) VALUES
  ('70', 'Farming and fishing and forestry and wildlife contracting services', '2015-07-01', NULL),
  ('72', 'Building and facility construction and maintenance services', '2015-07-01', NULL),
  ('76', 'Industrial cleaning services', '2015-07-01', NULL),
  ('78', 'Transportation, storage and mail services', '2015-07-01', NULL),
  ('82', 'Editorial and design and graphic and fine art services', '2015-07-01', NULL),
  ('86', 'Education and training services', '2015-07-01', NULL),
  ('90', 'Travel and food and lodging and entertainment services', '2015-07-01', NULL),
  ('93', 'Politics and civic affairs services', '2015-07-01', NULL),
  ('64', 'Financial instruments, products, contracts and agreements', '2020-07-01', NULL),
  ('71', 'Mining and oil and gas services', '2020-07-01', NULL),
  ('73', 'Industrial production and manufacturing services', '2020-07-01', NULL),
  ('77', 'Environmental services', '2020-07-01', NULL),
  ('80', 'Management and business professionals and administrative services', '2020-07-01', ARRAY['80131500','80131501','80131503']),
  ('81', 'Engineering and research and technology-based services', '2020-07-01', NULL),
  ('84', 'Financial and insurance services', '2020-07-01', ARRAY['84130000','84131800']),
  ('85', 'Healthcare services', '2020-07-01', NULL),
  ('91', 'Personal and domestic services', '2020-07-01', NULL),
  ('92', 'National defence and public order and security and safety services', '2020-07-01', ARRAY['9211000','92111700']),
  ('94', 'Organisations and clubs', '2020-07-01', NULL)
ON CONFLICT (unspsc_prefix) DO NOTHING;

-- Insert portfolio exemption data from Table 3.1
INSERT INTO anao_mmr_exemptions (portfolio, total_contracts, exempted_contracts, exemption_rate, exempted_value_aud, total_value_aud) VALUES
  ('Defence', 746, 470, 0.63, 35900000000, NULL),
  ('Foreign Affairs and Trade', 198, 178, 0.90, 9400000000, NULL),
  ('Health and Aged Care', 203, 130, 0.64, 5200000000, NULL),
  ('Home Affairs', 176, 91, 0.52, 3500000000, NULL),
  ('Infrastructure, Transport, Regional Development, Communications and the Arts', 86, 51, 0.59, 3400000000, NULL),
  ('Industry, Science and Resources', 56, 41, 0.73, 2600000000, NULL),
  ('Climate Change, Energy, the Environment and Water', 79, 62, 0.78, 2200000000, NULL),
  ('Agriculture, Fisheries and Forestry', 62, 53, 0.85, 2000000000, NULL),
  ('Education', 105, 86, 0.82, 1500000000, NULL),
  ('Employment and Workplace Relations', 324, 72, 0.22, 1200000000, NULL),
  ('Treasury', 103, 57, 0.55, 800000000, NULL),
  ('Finance', 101, 53, 0.52, 700000000, NULL),
  ('Social Services', 88, 50, 0.57, 300000000, NULL),
  ('Attorney-Generals', 42, 17, 0.40, 200000000, NULL),
  ('Veterans Affairs', 36, 20, 0.56, 100000000, NULL),
  ('Prime Minister and Cabinet', 25, 14, 0.56, 100000000, NULL),
  ('Parliamentary Departments', 3, 2, 0.67, 100000000, NULL),
  ('National Indigenous Australians Agency', 7, 2, 0.29, 100000000, NULL)
ON CONFLICT (portfolio, period) DO NOTHING;

-- Insert MMR compliance reporting data from Table A.6
INSERT INTO anao_mmr_compliance (portfolio, contracts_not_setup, contracts_in_reporting, contracts_compliant, compliance_rate) VALUES
  ('Agriculture, Fisheries and Forestry', 0, 5, 3, 0.60),
  ('Attorney-Generals', 5, 5, 1, 0.20),
  ('Climate Change, Energy, the Environment and Water', 3, 8, 8, 1.00),
  ('Defence', 5, 168, 139, 0.83),
  ('Education', 0, 10, 10, 1.00),
  ('Employment and Workplace Relations', 9, 157, 144, 0.92),
  ('Finance', 5, 8, 5, 0.63),
  ('Foreign Affairs and Trade', 1, 3, 3, 1.00),
  ('Health and Aged Care', 4, 36, 21, 0.58),
  ('Home Affairs', 3, 32, 25, 0.78),
  ('Industry, Science and Resources', 4, 3, 0, 0.00),
  ('Infrastructure, Transport, Regional Development, Communications and the Arts', 7, 7, 2, 0.29),
  ('Parliamentary Departments', 1, 1, 0, 0.00),
  ('Prime Minister and Cabinet', 1, 4, 3, 0.75),
  ('Social Services', 1, 22, 22, 1.00),
  ('Treasury', 5, 11, 11, 1.00),
  ('Veterans Affairs', 14, 2, 1, 0.50)
ON CONFLICT (portfolio, period) DO NOTHING;

-- 4. Add is_mmr_applicable flag to austender_contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'austender_contracts' AND column_name = 'is_mmr_applicable'
  ) THEN
    ALTER TABLE austender_contracts ADD COLUMN is_mmr_applicable BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 5. Tag MMR-applicable contracts based on UNSPSC category
UPDATE austender_contracts
SET is_mmr_applicable = TRUE
WHERE category IS NOT NULL
  AND (
    category LIKE 'UNSPSC:70%' OR category LIKE 'UNSPSC:72%' OR
    category LIKE 'UNSPSC:76%' OR category LIKE 'UNSPSC:78%' OR
    category LIKE 'UNSPSC:82%' OR category LIKE 'UNSPSC:86%' OR
    category LIKE 'UNSPSC:90%' OR category LIKE 'UNSPSC:93%' OR
    category LIKE 'UNSPSC:64%' OR category LIKE 'UNSPSC:71%' OR
    category LIKE 'UNSPSC:73%' OR category LIKE 'UNSPSC:77%' OR
    category LIKE 'UNSPSC:80%' OR category LIKE 'UNSPSC:81%' OR
    category LIKE 'UNSPSC:84%' OR category LIKE 'UNSPSC:85%' OR
    category LIKE 'UNSPSC:91%' OR category LIKE 'UNSPSC:92%' OR
    category LIKE 'UNSPSC:94%'
  );

-- Create index on MMR flag
CREATE INDEX IF NOT EXISTS idx_austender_mmr ON austender_contracts(is_mmr_applicable) WHERE is_mmr_applicable = TRUE;

-- Summary stats
DO $$
DECLARE
  mmr_count INTEGER;
  mmr_value NUMERIC;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*), ROUND(SUM(contract_value)::numeric / 1e9, 2) INTO mmr_count, mmr_value
  FROM austender_contracts WHERE is_mmr_applicable = TRUE;

  SELECT COUNT(*) INTO total_count FROM austender_contracts;

  RAISE NOTICE 'MMR-applicable contracts: % of % (value: $%B)', mmr_count, total_count, mmr_value;
END $$;
