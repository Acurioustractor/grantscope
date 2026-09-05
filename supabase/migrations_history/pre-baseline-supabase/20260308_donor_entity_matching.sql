-- Political Donation Entity Matching Infrastructure
-- Resolves donor names from AEC Transparency Register to ABNs via ASIC/ACNC name matching
-- Created: 2026-03-08

-- 1. Name normalization function for fuzzy matching
CREATE OR REPLACE FUNCTION normalize_company_name(name text) RETURNS text AS $$
DECLARE
  result text;
BEGIN
  result := UPPER(COALESCE(name, ''));
  -- Strip "as trustee for..." / "ATF..." suffixes
  result := REGEXP_REPLACE(result, '\s*(AS\s+TRUSTEE\s+FOR|ATF|A\.T\.F\.)\s+.*$', '');
  -- Strip dash suffixes like "- Hotel Loan"
  result := REGEXP_REPLACE(result, '\s*-\s+.*$', '');
  -- Strip possessives
  result := REGEXP_REPLACE(result, '''S?\s', ' ', 'g');
  -- Remove common company suffixes
  result := REGEXP_REPLACE(result, '\mPTY\M', '', 'g');
  result := REGEXP_REPLACE(result, '\mLTD\M', '', 'g');
  result := REGEXP_REPLACE(result, '\mLIMITED\M', '', 'g');
  result := REGEXP_REPLACE(result, '\mINC\M', '', 'g');
  result := REGEXP_REPLACE(result, '\mINCORPORATED\M', '', 'g');
  result := REGEXP_REPLACE(result, '\mCORPORATION\M', '', 'g');
  result := REGEXP_REPLACE(result, '\mTHE\M', '', 'g');
  -- Strip non-alphanumeric (keep spaces)
  result := REGEXP_REPLACE(result, '[^A-Z0-9 ]', '', 'g');
  -- Collapse whitespace and trim
  result := TRIM(REGEXP_REPLACE(result, '\s+', ' ', 'g'));
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Donor entity matches table (stores resolved ABN matches)
CREATE TABLE IF NOT EXISTS donor_entity_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name text NOT NULL,
  donor_name_normalized text NOT NULL,
  matched_entity_type text NOT NULL,  -- 'asic', 'acnc', 'manual'
  matched_entity_name text,
  matched_abn text,
  match_method text NOT NULL,  -- 'exact', 'trigram', 'manual'
  match_confidence numeric(4,3),  -- 0.000 to 1.000
  total_donated numeric,
  donation_count int,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_donor_matches_donor_name ON donor_entity_matches(donor_name);
CREATE INDEX IF NOT EXISTS idx_donor_matches_abn ON donor_entity_matches(matched_abn);
CREATE INDEX IF NOT EXISTS idx_donor_matches_confidence ON donor_entity_matches(match_confidence DESC);

-- 3. ASIC normalized name lookup (for fast trigram matching)
CREATE TABLE IF NOT EXISTS asic_name_lookup (
  abn text NOT NULL,
  company_name text NOT NULL,
  name_normalized text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_asic_lookup_trgm ON asic_name_lookup USING gin (name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_asic_lookup_exact ON asic_name_lookup (name_normalized);

-- 4. Materialized view: donor-to-contract cross-reference (deduped by ABN)
-- Shows political donors who also hold government contracts (via ABN matching)
-- Aggregates across name variants (e.g. "Thales Australia" + "THALES AUSTRALIA LIMITED")
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_donor_contract_crossref AS
SELECT
  d.donor_abn,
  d.primary_donor_name as donor_name,
  d.total_donated,
  d.donation_count,
  d.parties_donated_to,
  d.name_variants,
  c.contract_count,
  c.total_contract_value,
  c.buyers
FROM (
  SELECT
    donor_abn,
    (ARRAY_AGG(donor_name ORDER BY cnt DESC))[1] as primary_donor_name,
    SUM(total_amount) as total_donated,
    SUM(cnt) as donation_count,
    STRING_AGG(DISTINCT party, ', ' ORDER BY party) as parties_donated_to,
    COUNT(DISTINCT donor_name)::int as name_variants
  FROM (
    SELECT
      donor_abn,
      donor_name,
      SUM(amount) as total_amount,
      COUNT(*) as cnt,
      UNNEST(ARRAY_AGG(DISTINCT donation_to)) as party
    FROM political_donations
    WHERE donor_abn IS NOT NULL AND donor_abn != '' AND donor_abn != '0'
    GROUP BY donor_abn, donor_name
  ) sub
  GROUP BY donor_abn
) d
JOIN (
  SELECT
    supplier_abn,
    COUNT(*) as contract_count,
    SUM(contract_value) as total_contract_value,
    STRING_AGG(DISTINCT buyer_name, ', ' ORDER BY buyer_name) as buyers
  FROM austender_contracts
  WHERE supplier_abn IS NOT NULL AND supplier_abn != ''
  GROUP BY supplier_abn
) c ON d.donor_abn = c.supplier_abn
ORDER BY d.total_donated DESC;

CREATE INDEX IF NOT EXISTS idx_mv_donor_crossref_abn ON mv_donor_contract_crossref(donor_abn);

-- 5. Materialized view: data quality scorecard across all datasets
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_data_quality AS
SELECT 'foundations'::text as dataset, COUNT(*)::int as total_records,
  ROUND(100.0 * COUNT(*) FILTER (WHERE name IS NOT NULL AND name != '') / NULLIF(COUNT(*), 0), 1) as pct_name,
  ROUND(100.0 * COUNT(*) FILTER (WHERE description IS NOT NULL AND description != '') / NULLIF(COUNT(*), 0), 1) as pct_description,
  ROUND(100.0 * COUNT(*) FILTER (WHERE website IS NOT NULL AND website != '') / NULLIF(COUNT(*), 0), 1) as pct_website,
  NULL::numeric as pct_abn, NULL::numeric as pct_amount, NULL::numeric as pct_geo
FROM foundations
UNION ALL
SELECT 'grant_opportunities'::text, COUNT(*)::int,
  ROUND(100.0 * COUNT(*) FILTER (WHERE name IS NOT NULL AND name != '') / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE description IS NOT NULL AND description != '') / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE url IS NOT NULL AND url != '') / NULLIF(COUNT(*), 0), 1),
  NULL::numeric, ROUND(100.0 * COUNT(*) FILTER (WHERE amount_max IS NOT NULL AND amount_max > 0) / NULLIF(COUNT(*), 0), 1), NULL::numeric
FROM grant_opportunities
WHERE source != 'ghl_sync'  -- Exclude CRM pipeline data
UNION ALL
SELECT 'acnc_charities'::text, COUNT(*)::int,
  ROUND(100.0 * COUNT(*) FILTER (WHERE name IS NOT NULL AND name != '') / NULLIF(COUNT(*), 0), 1),
  NULL::numeric,
  ROUND(100.0 * COUNT(*) FILTER (WHERE website IS NOT NULL AND website != '') / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE abn IS NOT NULL AND abn != '') / NULLIF(COUNT(*), 0), 1),
  NULL::numeric,
  ROUND(100.0 * COUNT(*) FILTER (WHERE postcode IS NOT NULL AND postcode != '') / NULLIF(COUNT(*), 0), 1)
FROM acnc_charities
UNION ALL
SELECT 'oric_corporations'::text, COUNT(*)::int,
  ROUND(100.0 * COUNT(*) FILTER (WHERE name IS NOT NULL AND name != '') / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE enriched_description IS NOT NULL AND enriched_description != '') / NULLIF(COUNT(*), 0), 1),
  NULL::numeric,
  ROUND(100.0 * COUNT(*) FILTER (WHERE abn IS NOT NULL AND abn != '') / NULLIF(COUNT(*), 0), 1),
  NULL::numeric,
  ROUND(100.0 * COUNT(*) FILTER (WHERE state IS NOT NULL AND state != '') / NULLIF(COUNT(*), 0), 1)
FROM oric_corporations
UNION ALL
SELECT 'political_donations'::text, COUNT(*)::int,
  ROUND(100.0 * COUNT(*) FILTER (WHERE donor_name IS NOT NULL AND donor_name != '') / NULLIF(COUNT(*), 0), 1),
  NULL::numeric, NULL::numeric,
  ROUND(100.0 * COUNT(*) FILTER (WHERE donor_abn IS NOT NULL AND donor_abn != '' AND donor_abn != '0') / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE amount IS NOT NULL AND amount > 0) / NULLIF(COUNT(*), 0), 1),
  NULL::numeric
FROM political_donations
UNION ALL
SELECT 'austender_contracts'::text, COUNT(*)::int,
  ROUND(100.0 * COUNT(*) FILTER (WHERE supplier_name IS NOT NULL AND supplier_name != '') / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE description IS NOT NULL AND description != '') / NULLIF(COUNT(*), 0), 1),
  NULL::numeric,
  ROUND(100.0 * COUNT(*) FILTER (WHERE supplier_abn IS NOT NULL AND supplier_abn != '') / NULLIF(COUNT(*), 0), 1),
  ROUND(100.0 * COUNT(*) FILTER (WHERE contract_value IS NOT NULL AND contract_value > 0) / NULLIF(COUNT(*), 0), 1),
  NULL::numeric
FROM austender_contracts;

-- 6. Materialized view: cross-reference linkage quality
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_crossref_quality AS
SELECT 'grant→foundation' as link_type,
  COUNT(*)::int as total,
  COUNT(*) FILTER (WHERE foundation_id IS NOT NULL)::int as linked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE foundation_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as pct_linked
FROM grant_opportunities
UNION ALL
SELECT 'donation→entity_match' as link_type,
  (SELECT COUNT(DISTINCT donor_name) FROM political_donations)::int as total,
  (SELECT COUNT(*) FROM donor_entity_matches)::int as linked,
  ROUND(100.0 * (SELECT COUNT(*) FROM donor_entity_matches)::numeric /
    NULLIF((SELECT COUNT(DISTINCT donor_name) FROM political_donations), 0), 1)
UNION ALL
SELECT 'donation→contract' as link_type,
  (SELECT COUNT(DISTINCT donor_abn) FROM political_donations WHERE donor_abn IS NOT NULL AND donor_abn != '' AND donor_abn != '0')::int,
  (SELECT COUNT(*) FROM mv_donor_contract_crossref)::int,
  ROUND(100.0 * (SELECT COUNT(*) FROM mv_donor_contract_crossref)::numeric /
    NULLIF((SELECT COUNT(DISTINCT donor_abn) FROM political_donations WHERE donor_abn IS NOT NULL AND donor_abn != '' AND donor_abn != '0'), 0), 1)
UNION ALL
SELECT 'oric→acnc' as link_type,
  (SELECT COUNT(*) FROM oric_corporations WHERE status = 'Registered')::int,
  (SELECT COUNT(*) FROM oric_corporations WHERE status = 'Registered' AND abn IS NOT NULL AND abn != '' AND EXISTS (SELECT 1 FROM acnc_charities c WHERE c.abn = oric_corporations.abn))::int,
  ROUND(100.0 * (SELECT COUNT(*) FROM oric_corporations WHERE status = 'Registered' AND abn IS NOT NULL AND abn != '' AND EXISTS (SELECT 1 FROM acnc_charities c WHERE c.abn = oric_corporations.abn))::numeric /
    NULLIF((SELECT COUNT(*) FROM oric_corporations WHERE status = 'Registered'), 0), 1);
