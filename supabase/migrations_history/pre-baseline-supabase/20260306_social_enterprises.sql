-- Social Enterprises table
-- New first-class entity type for GrantScope

CREATE TABLE social_enterprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abn TEXT,
  acn TEXT,
  icn TEXT,
  website TEXT,
  description TEXT,

  -- Classification
  org_type TEXT NOT NULL DEFAULT 'social_enterprise',
  legal_structure TEXT,
  sector TEXT[],

  -- Location
  state TEXT,
  city TEXT,
  postcode TEXT,
  geographic_focus TEXT[],

  -- Certification
  certifications JSONB DEFAULT '[]',
  -- e.g. [{body: "social-traders", status: "certified", since: "2024"}]

  -- Source tracking
  sources JSONB DEFAULT '[]',
  -- e.g. [{source: "social-traders", url: "...", scraped_at: "..."}]
  source_primary TEXT,

  -- Enrichment
  enriched_at TIMESTAMPTZ,
  profile_confidence TEXT DEFAULT 'low',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Dedup: name + state combo
  UNIQUE(name, state)
);

-- Indexes
CREATE INDEX idx_se_abn ON social_enterprises(abn) WHERE abn IS NOT NULL;
CREATE INDEX idx_se_icn ON social_enterprises(icn) WHERE icn IS NOT NULL;
CREATE INDEX idx_se_org_type ON social_enterprises(org_type);
CREATE INDEX idx_se_state ON social_enterprises(state);
CREATE INDEX idx_se_name_trgm ON social_enterprises USING gin (name gin_trgm_ops);

-- Flag on existing charities table
ALTER TABLE acnc_charities ADD COLUMN IF NOT EXISTS is_social_enterprise BOOLEAN DEFAULT false;

-- RLS (public read, service role write)
ALTER TABLE social_enterprises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON social_enterprises FOR SELECT USING (true);
CREATE POLICY "Service write" ON social_enterprises FOR ALL USING (auth.role() = 'service_role');

-- Update v_charity_detail to include is_social_enterprise flag
CREATE OR REPLACE VIEW v_charity_detail AS
SELECT
  c.abn,
  c.name,
  c.other_names,
  c.charity_size,
  c.pbi,
  c.hpc,
  c.registration_date,
  c.date_established,
  c.town_city,
  c.state,
  c.postcode,
  c.website,
  c.purposes,
  c.beneficiaries,
  c.operating_states,
  c.is_foundation,
  c.is_social_enterprise,

  -- Latest AIS financials
  a.total_revenue,
  a.total_expenses,
  a.total_assets,
  a.net_assets_liabilities,
  a.staff_fte,
  a.staff_volunteers,
  a.grants_donations_au,
  a.grants_donations_intl,
  COALESCE(a.grants_donations_au, 0) + COALESCE(a.grants_donations_intl, 0) AS total_grants_given,
  a.ais_year AS latest_financial_year,

  -- Community org enrichment (NULL if not enriched)
  co.id AS community_org_id,
  co.description AS enriched_description,
  co.domain AS enriched_domains,
  co.programs AS enriched_programs,
  co.outcomes AS enriched_outcomes,
  co.admin_burden_hours,
  co.admin_burden_cost,
  co.annual_funding_received,
  co.profile_confidence AS enrichment_confidence,
  co.enriched_at

FROM acnc_charities c
LEFT JOIN mv_acnc_latest a ON c.abn = a.abn
LEFT JOIN community_orgs co ON c.abn = co.acnc_abn;

GRANT SELECT ON v_charity_detail TO anon, authenticated, service_role;
