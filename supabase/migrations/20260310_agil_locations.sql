-- AGIL: Australian Government Indigenous Programs & Policy Locations
-- Source: data.gov.au (Creative Commons Attribution 3.0 Australia)
-- 1,546 Indigenous locations with lat/long + preferred/alternate names

CREATE TABLE IF NOT EXISTS agil_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lcode TEXT NOT NULL UNIQUE,
  preferred_name TEXT NOT NULL,
  alternate_names TEXT[] DEFAULT '{}',
  state TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agil_locations_state ON agil_locations(state);
CREATE INDEX IF NOT EXISTS idx_agil_locations_name ON agil_locations USING gin (preferred_name gin_trgm_ops);

COMMENT ON TABLE agil_locations IS 'Australian Government Indigenous Programs & Policy Locations — authoritative Indigenous location names';
