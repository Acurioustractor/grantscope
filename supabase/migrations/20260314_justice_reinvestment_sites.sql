-- Justice Reinvestment Sites
-- Captures JR initiatives across Australia with funders, locations, and outcomes
-- Sources: Paul Ramsay Foundation JR Portfolio Review, justicereinvestment.net.au, AIC

CREATE TABLE IF NOT EXISTS justice_reinvestment_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,          -- e.g. "Bourke, NSW"
  state text,
  postcode text,
  lga_name text,
  latitude numeric,
  longitude numeric,
  status text DEFAULT 'active',    -- active, completed, planned
  start_year integer,
  lead_organisation text,
  lead_organisation_abn text,
  funders text[],                   -- e.g. '{Paul Ramsay Foundation,Commonwealth}'
  total_funding numeric,
  funding_details jsonb,            -- structured: {funder: amount, ...}
  focus_areas text[],               -- e.g. '{youth-justice,indigenous,family-violence}'
  target_population text,
  outcomes jsonb,                   -- structured outcome data
  outcome_summary text,             -- human-readable summary
  model_type text,                  -- place-based, program, systemic
  indigenous_led boolean DEFAULT false,
  source text,
  source_url text,
  gs_entity_id uuid REFERENCES gs_entities(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_jr_sites_state ON justice_reinvestment_sites(state);
CREATE INDEX idx_jr_sites_status ON justice_reinvestment_sites(status);
CREATE INDEX idx_jr_sites_postcode ON justice_reinvestment_sites(postcode);
CREATE INDEX idx_jr_sites_entity ON justice_reinvestment_sites(gs_entity_id);

COMMENT ON TABLE justice_reinvestment_sites IS 'Justice reinvestment initiatives across Australia — connects funders, places, and outcomes';
