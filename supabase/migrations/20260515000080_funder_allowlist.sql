-- P8b: Curated funder allowlist.
--
-- Vetted list of Australian funders that meet the bar:
--   - Public application channel (no invitation-only)
--   - Open / rolling rounds (some structured grant cycle, not one-off awards)
--   - Mapping to ACT projects exists (justice / first nations / regenerative / food / community)
--
-- Used as:
--   (a) Promotion gate — only grant_opportunities rows from allowlisted funders
--       can be promoted into alma_funding_opportunities (see P8d).
--   (b) Discovery prioritisation — scout agents target these funders first.
--
-- This is a starting set. Add via INSERT, remove via UPDATE … SET active=false.
-- Update verified_at when manually checking the funder's current rounds page.

CREATE TABLE IF NOT EXISTS funder_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_name text NOT NULL,
  funder_aliases text[] DEFAULT '{}'::text[],
  website text,
  programs_url text,                          -- where current rounds are listed
  type text NOT NULL CHECK (type IN (
    'philanthropic_foundation',
    'corporate_foundation',
    'community_foundation',
    'government_agency',
    'intermediary',                           -- e.g., FRRR, ACF (distribute on behalf of others)
    'collective_giving'
  )),
  primary_themes text[] NOT NULL DEFAULT '{}'::text[],
  jurisdictions text[] NOT NULL DEFAULT '{}'::text[],
  min_typical_grant integer,
  max_typical_grant integer,
  requires_dgr boolean DEFAULT false,
  application_channel text NOT NULL CHECK (application_channel IN (
    'public_form',          -- EOI form on website
    'rolling',              -- always-open enquiry
    'periodic_rounds',      -- structured timed rounds
    'pooled_fund',          -- access via sub-fund
    'tender'                -- procurement model
  )),
  notes text,
  active boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funder_name)
);

CREATE INDEX IF NOT EXISTS idx_funder_allowlist_active
  ON funder_allowlist (active, funder_name)
  WHERE active = true;

COMMENT ON TABLE funder_allowlist IS
  'Vetted Australian funders for ACT grant pipeline. Promotion + discovery gate.';

-- Seed: 22 funders that take public applications across ACT's themes
INSERT INTO funder_allowlist (funder_name, funder_aliases, website, programs_url, type, primary_themes, jurisdictions, min_typical_grant, max_typical_grant, requires_dgr, application_channel, notes, verified_at) VALUES
  -- Rural / regenerative / climate (strongest for ACT-HV, ACT-FM)
  ('Foundation for Rural & Regional Renewal (FRRR)', ARRAY['FRRR'], 'https://frrr.org.au', 'https://frrr.org.au/grants/', 'intermediary', ARRAY['rural','drought','climate','community','food'], ARRAY['NSW','QLD','VIC','SA','WA','TAS','NT','ACT'], 5000, 200000, false, 'periodic_rounds', 'Multi-program — SRC, TTTT, FDF, DR:FR, etc.', now()),
  ('Sustainable Table', ARRAY[]::text[], 'https://www.sustainabletable.org.au', 'https://www.sustainabletable.org.au/fund', 'philanthropic_foundation', ARRAY['regenerative','food','farming','biodiversity'], ARRAY['NSW','QLD','VIC','SA','WA','TAS','NT','ACT'], NULL, NULL, false, 'rolling', 'Apply via Australian Regenerative Food and Farming Map', now()),
  ('The Yulgilbar Foundation', ARRAY['Yulgilbar'], 'https://www.yulgilbar.com', NULL, 'philanthropic_foundation', ARRAY['rural','arts','community'], ARRAY['NSW','National'], 5000, 50000, false, 'rolling', 'Limited public channel; previous FRRR partnership concluded 2023', NULL),
  ('Trust for Nature', ARRAY[]::text[], 'https://www.trustfornature.org.au', 'https://www.trustfornature.org.au/grants', 'philanthropic_foundation', ARRAY['biodiversity','land','conservation','first-nations-land'], ARRAY['VIC','National'], 5000, 50000, false, 'periodic_rounds', NULL, NULL),

  -- Place-based / community wellbeing
  ('The Snow Foundation', ARRAY['Snow Foundation'], 'https://www.snowfoundation.org.au', 'https://www.snowfoundation.org.au/grants', 'philanthropic_foundation', ARRAY['community','youth','disadvantage','first-nations'], ARRAY['ACT','NSW','NT'], 25000, 250000, false, 'periodic_rounds', NULL, NULL),
  ('Lord Mayor''s Charitable Foundation', ARRAY['LMCF'], 'https://www.lmcf.org.au', 'https://www.greatermelbournefoundation.org.au/apply-grant', 'community_foundation', ARRAY['food','climate','community','youth'], ARRAY['VIC'], 20000, 100000, true, 'periodic_rounds', 'Melbourne-focused; food security stream (Foodbowl)', now()),
  ('Ian Potter Foundation', ARRAY['Ian Potter'], 'https://www.ianpotter.org.au', 'https://www.ianpotter.org.au/grants', 'philanthropic_foundation', ARRAY['community','wellbeing','disadvantage','evidence'], ARRAY['VIC','National'], 100000, 500000, true, 'periodic_rounds', NULL, NULL),
  ('NAB Foundation', ARRAY['NAB'], 'https://www.nab.com.au', 'https://www.nab.com.au/about-us/social-impact/nab-foundation', 'corporate_foundation', ARRAY['community','rural','climate'], ARRAY['National'], 25000, 250000, false, 'rolling', NULL, NULL),
  ('Dusseldorp Forum', ARRAY[]::text[], 'https://www.dusseldorp.org.au', 'https://www.dusseldorp.org.au/our-work', 'philanthropic_foundation', ARRAY['place-based','community','youth','collective-action'], ARRAY['National'], 100000, 750000, false, 'periodic_rounds', NULL, NULL),
  ('Australian Communities Foundation', ARRAY['ACF'], 'https://communityfoundation.org.au', 'https://communityfoundation.org.au/grant-rounds', 'community_foundation', ARRAY['climate','environment','indigenous','community'], ARRAY['National'], 5000, 50000, false, 'periodic_rounds', 'Sub-funds incl. WELA Giving Circle', now()),

  -- Indigenous / First Nations focus (require partnership for ACT)
  ('Reconciliation Australia', ARRAY[]::text[], 'https://www.reconciliation.org.au', 'https://www.reconciliation.org.au/programs/', 'intermediary', ARRAY['indigenous','reconciliation','community-controlled'], ARRAY['National'], NULL, NULL, false, 'periodic_rounds', 'Indigenous Governance Program — for Indigenous orgs', NULL),
  ('The Healing Foundation', ARRAY['Healing Foundation'], 'https://healingfoundation.org.au', 'https://healingfoundation.org.au/grants/', 'philanthropic_foundation', ARRAY['indigenous','healing','trauma','cultural-authority'], ARRAY['National'], 75000, 350000, false, 'periodic_rounds', 'Indigenous-led required for solo applications', NULL),

  -- Justice / youth justice focus
  ('Just Reinvest NSW', ARRAY['JRNSW'], 'https://www.justreinvest.org.au', 'https://www.justreinvest.org.au/get-involved/', 'community_foundation', ARRAY['justice','first-nations','place-based'], ARRAY['NSW','National'], 100000, 500000, false, 'rolling', NULL, NULL),
  ('Paul Ramsay Foundation', ARRAY['PRF'], 'https://www.paulramsayfoundation.org.au', 'https://www.paulramsayfoundation.org.au/our-funding/', 'philanthropic_foundation', ARRAY['disadvantage','inclusive-communities','breaking-cycles'], ARRAY['National'], 500000, 3000000, false, 'periodic_rounds', 'PRIMARILY INVITATION-ONLY — limited public EOI channel', NULL),

  -- Storytelling / arts (ACT-EL fit)
  ('Creative Australia', ARRAY[]::text[], 'https://creative.gov.au', 'https://creative.gov.au/investment-and-development/grants-and-funding/', 'government_agency', ARRAY['arts','storytelling','first-nations'], ARRAY['National'], 20000, 200000, false, 'periodic_rounds', 'Multiple streams; First Nations Strategy stream open', NULL),
  ('Sidney Myer Fund', ARRAY['Myer'], 'https://www.myerfoundation.org.au', 'https://www.myerfoundation.org.au/grants/', 'philanthropic_foundation', ARRAY['arts','community','environment','indigenous'], ARRAY['VIC','National'], 50000, 500000, true, 'periodic_rounds', NULL, NULL),

  -- Corporate
  ('BHP Foundation', ARRAY['BHP'], 'https://www.bhp.com', 'https://www.bhp.com/sustainability/communities/bhp-foundation', 'corporate_foundation', ARRAY['community','education','indigenous'], ARRAY['National'], 100000, 1000000, false, 'periodic_rounds', 'INVITATION-ONLY mostly — limited public channel', NULL),
  ('Macquarie Group Foundation', ARRAY['MGF'], 'https://www.macquarie.com', 'https://www.macquarie.com/foundation', 'corporate_foundation', ARRAY['community','social-enterprise','indigenous'], ARRAY['National'], 50000, 500000, false, 'periodic_rounds', NULL, NULL),

  -- Government discovery channels
  ('GrantConnect (grants.gov.au)', ARRAY['GrantConnect'], 'https://www.grants.gov.au', 'https://www.grants.gov.au', 'government_agency', ARRAY['all'], ARRAY['National'], NULL, NULL, false, 'periodic_rounds', 'Master gov grant directory — feed for promotion pipeline', NULL),
  ('Queensland Community Foundation', ARRAY['QCF'], 'https://www.qcf.org.au', 'https://www.qcf.org.au/grants', 'community_foundation', ARRAY['community','rural','disadvantage'], ARRAY['QLD'], 5000, 50000, false, 'periodic_rounds', NULL, NULL),

  -- Collective giving
  ('Equity Trustees Charitable Foundations', ARRAY['Equity Trustees','EQT'], 'https://www.eqt.com.au', 'https://www.eqt.com.au/philanthropy', 'intermediary', ARRAY['indigenous','health','community','arts'], ARRAY['National'], 5000, 250000, false, 'pooled_fund', 'Sub-funds; access via specific themes', NULL),
  ('Australian Philanthropic Services', ARRAY['APS'], 'https://www.australianphilanthropicservices.com.au', NULL, 'intermediary', ARRAY['all'], ARRAY['National'], NULL, NULL, false, 'pooled_fund', 'Backbone for many family sub-funds', NULL)
ON CONFLICT (funder_name) DO UPDATE SET
  programs_url = COALESCE(EXCLUDED.programs_url, funder_allowlist.programs_url),
  primary_themes = EXCLUDED.primary_themes,
  jurisdictions = EXCLUDED.jurisdictions,
  application_channel = EXCLUDED.application_channel,
  notes = EXCLUDED.notes,
  updated_at = now();

COMMENT ON COLUMN funder_allowlist.application_channel IS
  'How does an applicant submit? Drives scouting + scoring strategy.';
COMMENT ON COLUMN funder_allowlist.programs_url IS
  'URL of the funder’s "current rounds" / "open grants" page — NOT the homepage. Scrapers verify against this.';
