-- Research grants table — ARC + NHMRC + future research funding sources
CREATE TABLE IF NOT EXISTS research_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,                    -- 'arc' | 'nhmrc'
  grant_code text NOT NULL,                -- e.g. 'DP240100123'
  scheme_name text,                        -- e.g. 'Discovery Projects'
  program text,                            -- e.g. 'Discovery', 'Linkage'
  title text,                              -- grant summary / title
  lead_investigator text,
  investigators text,                      -- comma-separated list
  admin_organisation text,                 -- administering university/org
  admin_organisation_abn text,             -- ABN if resolved
  funding_amount numeric,                  -- current funding amount
  announced_amount numeric,                -- originally announced amount
  commencement_year int,
  end_date date,
  status text,                             -- 'Active', 'Completed', etc.
  field_of_research text,                  -- primary FOR code + name
  national_interest text,                  -- national interest test statement
  gs_entity_id uuid REFERENCES gs_entities(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source, grant_code)
);

CREATE INDEX idx_research_grants_source ON research_grants(source);
CREATE INDEX idx_research_grants_org ON research_grants(admin_organisation);
CREATE INDEX idx_research_grants_abn ON research_grants(admin_organisation_abn) WHERE admin_organisation_abn IS NOT NULL;
CREATE INDEX idx_research_grants_gs_entity ON research_grants(gs_entity_id) WHERE gs_entity_id IS NOT NULL;
CREATE INDEX idx_research_grants_year ON research_grants(commencement_year);
