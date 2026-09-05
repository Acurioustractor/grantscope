-- v_charity_detail: Unified charity view joining ACNC register + financials + community enrichment
-- Used by /charities/[abn] detail page

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

COMMENT ON VIEW v_charity_detail IS 'Unified charity detail view: ACNC register + latest financials + community org enrichment data.';

-- Update v_charity_explorer to include enrichment flag for listing page badges
CREATE OR REPLACE VIEW v_charity_explorer AS
SELECT
  c.*,
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
  (co.id IS NOT NULL) AS has_enrichment
FROM acnc_charities c
LEFT JOIN mv_acnc_latest a ON c.abn = a.abn
LEFT JOIN community_orgs co ON c.abn = co.acnc_abn;

GRANT SELECT ON v_charity_explorer TO anon, authenticated, service_role;
