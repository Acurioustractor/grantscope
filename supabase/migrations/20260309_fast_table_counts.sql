-- Fast table counts using pg_stat_user_tables (no table scans)
-- Returns estimated row counts for all tracked tables in one call

CREATE OR REPLACE FUNCTION get_table_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_object_agg(relname, n_live_tup)
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
    AND relname IN (
      'gs_entities', 'gs_relationships',
      'acnc_charities', 'political_donations', 'austender_contracts',
      'oric_corporations', 'seifa_2021', 'asic_companies',
      'ato_tax_transparency', 'rogs_justice_spending', 'asx_companies',
      'money_flows', 'justice_funding',
      'alma_interventions', 'alma_outcomes', 'alma_evidence',
      'grant_opportunities', 'foundations', 'foundation_programs',
      'community_orgs', 'social_enterprises'
    );
$$;
