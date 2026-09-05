-- Crime statistics per LGA (initially NSW BOCSAR, extensible to other states)
CREATE TABLE IF NOT EXISTS crime_stats_lga (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lga_name text NOT NULL,
  state text NOT NULL,
  offence_group text,
  offence_type text NOT NULL,
  year_period text NOT NULL,
  incidents integer,
  rate_per_100k numeric,
  two_year_trend_pct numeric,
  ten_year_trend_pct numeric,
  lga_rank integer,
  source text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crime_stats_lga_name ON crime_stats_lga (lga_name);
CREATE INDEX IF NOT EXISTS idx_crime_stats_lga_offence ON crime_stats_lga (offence_type);
CREATE INDEX IF NOT EXISTS idx_crime_stats_lga_year ON crime_stats_lga (year_period);
CREATE INDEX IF NOT EXISTS idx_crime_stats_lga_source ON crime_stats_lga (source);

COMMENT ON TABLE crime_stats_lga IS 'LGA-level crime statistics from BOCSAR (NSW) and other state agencies. Links to postcode_geo via lga_name.';
