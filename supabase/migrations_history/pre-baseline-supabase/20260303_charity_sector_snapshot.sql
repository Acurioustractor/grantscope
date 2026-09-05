-- charity_sector_snapshot: Pre-aggregated data for /charities/insights page
-- Returns all sector-level aggregates in one call (~1-2s)

CREATE OR REPLACE FUNCTION charity_sector_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'by_size', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(c.charity_size, 'Unknown') AS size,
          COUNT(*)::int AS count,
          COALESCE(SUM(a.total_revenue), 0)::bigint AS total_revenue,
          COALESCE(SUM(a.total_expenses), 0)::bigint AS total_expenses,
          COALESCE(SUM(a.total_assets), 0)::bigint AS total_assets,
          COALESCE(SUM(COALESCE(a.grants_donations_au, 0) + COALESCE(a.grants_donations_intl, 0)), 0)::bigint AS total_grants,
          COALESCE(SUM(a.staff_fte), 0)::int AS total_staff,
          COALESCE(SUM(a.staff_volunteers), 0)::int AS total_volunteers
        FROM acnc_charities c
        LEFT JOIN mv_acnc_latest a ON c.abn = a.abn
        GROUP BY c.charity_size
        ORDER BY COALESCE(SUM(a.total_revenue), 0) DESC
      ) t
    ),

    'by_state', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(c.state, 'Unknown') AS state,
          COUNT(*)::int AS count,
          COALESCE(SUM(a.total_revenue), 0)::bigint AS total_revenue
        FROM acnc_charities c
        LEFT JOIN mv_acnc_latest a ON c.abn = a.abn
        GROUP BY c.state
        ORDER BY COUNT(*) DESC
      ) t
    ),

    'operating_states', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT state_name, COUNT(*)::int AS count
        FROM (
          SELECT 'NSW' AS state_name FROM acnc_charities WHERE operates_in_nsw = true
          UNION ALL SELECT 'VIC' FROM acnc_charities WHERE operates_in_vic = true
          UNION ALL SELECT 'QLD' FROM acnc_charities WHERE operates_in_qld = true
          UNION ALL SELECT 'WA' FROM acnc_charities WHERE operates_in_wa = true
          UNION ALL SELECT 'SA' FROM acnc_charities WHERE operates_in_sa = true
          UNION ALL SELECT 'TAS' FROM acnc_charities WHERE operates_in_tas = true
          UNION ALL SELECT 'ACT' FROM acnc_charities WHERE operates_in_act = true
          UNION ALL SELECT 'NT' FROM acnc_charities WHERE operates_in_nt = true
        ) s
        GROUP BY state_name
        ORDER BY COUNT(*) DESC
      ) t
    ),

    'purpose_counts', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT purpose, COUNT(*)::int AS count
        FROM (
          SELECT 'Religion' AS purpose FROM acnc_charities WHERE purpose_religion = true
          UNION ALL SELECT 'Education' FROM acnc_charities WHERE purpose_education = true
          UNION ALL SELECT 'Health' FROM acnc_charities WHERE purpose_health = true
          UNION ALL SELECT 'Social Welfare' FROM acnc_charities WHERE purpose_social_welfare = true
          UNION ALL SELECT 'Culture' FROM acnc_charities WHERE purpose_culture = true
          UNION ALL SELECT 'Environment' FROM acnc_charities WHERE purpose_natural_environment = true
          UNION ALL SELECT 'Human Rights' FROM acnc_charities WHERE purpose_human_rights = true
          UNION ALL SELECT 'General Public' FROM acnc_charities WHERE purpose_general_public = true
          UNION ALL SELECT 'Animal Welfare' FROM acnc_charities WHERE purpose_animal_welfare = true
          UNION ALL SELECT 'Reconciliation' FROM acnc_charities WHERE purpose_reconciliation = true
          UNION ALL SELECT 'Law & Policy' FROM acnc_charities WHERE purpose_law_policy = true
          UNION ALL SELECT 'Security' FROM acnc_charities WHERE purpose_security = true
        ) s
        GROUP BY purpose
        ORDER BY COUNT(*) DESC
      ) t
    ),

    'beneficiary_counts', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT beneficiary, COUNT(*)::int AS count
        FROM (
          SELECT 'General Community' AS beneficiary FROM acnc_charities WHERE ben_general_community = true
          UNION ALL SELECT 'Children' FROM acnc_charities WHERE ben_children = true
          UNION ALL SELECT 'Youth' FROM acnc_charities WHERE ben_youth = true
          UNION ALL SELECT 'Aged' FROM acnc_charities WHERE ben_aged = true
          UNION ALL SELECT 'Families' FROM acnc_charities WHERE ben_families = true
          UNION ALL SELECT 'Disability' FROM acnc_charities WHERE ben_people_with_disabilities = true
          UNION ALL SELECT 'Financially Disadvantaged' FROM acnc_charities WHERE ben_financially_disadvantaged = true
          UNION ALL SELECT 'Rural & Remote' FROM acnc_charities WHERE ben_rural_regional_remote = true
          UNION ALL SELECT 'Females' FROM acnc_charities WHERE ben_females = true
          UNION ALL SELECT 'Males' FROM acnc_charities WHERE ben_males = true
          UNION ALL SELECT 'Adults' FROM acnc_charities WHERE ben_adults = true
          UNION ALL SELECT 'Migrants & Refugees' FROM acnc_charities WHERE ben_migrants_refugees = true
          UNION ALL SELECT 'First Nations' FROM acnc_charities WHERE ben_aboriginal_tsi = true
          UNION ALL SELECT 'Early Childhood' FROM acnc_charities WHERE ben_early_childhood = true
          UNION ALL SELECT 'Chronic Illness' FROM acnc_charities WHERE ben_people_with_chronic_illness = true
          UNION ALL SELECT 'Homelessness Risk' FROM acnc_charities WHERE ben_people_at_risk_of_homelessness = true
          UNION ALL SELECT 'Ethnic Groups' FROM acnc_charities WHERE ben_ethnic_groups = true
          UNION ALL SELECT 'Overseas Communities' FROM acnc_charities WHERE ben_communities_overseas = true
          UNION ALL SELECT 'Veterans' FROM acnc_charities WHERE ben_veterans = true
          UNION ALL SELECT 'Unemployed' FROM acnc_charities WHERE ben_unemployed = true
          UNION ALL SELECT 'Victims of Crime' FROM acnc_charities WHERE ben_victims_of_crime = true
          UNION ALL SELECT 'Victims of Disaster' FROM acnc_charities WHERE ben_victims_of_disaster = true
          UNION ALL SELECT 'Pre/Post Release' FROM acnc_charities WHERE ben_pre_post_release = true
          UNION ALL SELECT 'LGBTIQA+' FROM acnc_charities WHERE ben_lgbtiqa = true
          UNION ALL SELECT 'Other Charities' FROM acnc_charities WHERE ben_other_charities = true
          UNION ALL SELECT 'Animals' FROM acnc_charities WHERE ben_animals = true
          UNION ALL SELECT 'Environment' FROM acnc_charities WHERE ben_environment = true
          UNION ALL SELECT 'Other Gender Identities' FROM acnc_charities WHERE ben_other_gender_identities = true
        ) s
        GROUP BY beneficiary
        ORDER BY COUNT(*) DESC
      ) t
    ),

    'pbi_by_size', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(c.charity_size, 'Unknown') AS size,
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE c.pbi = true)::int AS pbi_count
        FROM acnc_charities c
        GROUP BY c.charity_size
        ORDER BY COUNT(*) DESC
      ) t
    ),

    'yearly_trends', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          ais_year AS year,
          COUNT(*)::int AS count,
          COALESCE(SUM(total_revenue), 0)::bigint AS revenue,
          COALESCE(SUM(total_expenses), 0)::bigint AS expenses,
          COALESCE(SUM(total_assets), 0)::bigint AS assets,
          COALESCE(SUM(COALESCE(grants_donations_au, 0) + COALESCE(grants_donations_intl, 0)), 0)::bigint AS grants,
          COALESCE(SUM(staff_fte), 0)::int AS staff,
          COALESCE(SUM(staff_volunteers), 0)::int AS volunteers
        FROM acnc_ais
        WHERE ais_year >= 2017
        GROUP BY ais_year
        ORDER BY ais_year
      ) t
    ),

    'top_revenue', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          c.name,
          c.charity_size AS size,
          c.state,
          a.total_revenue::bigint AS revenue,
          a.total_assets::bigint AS assets,
          (COALESCE(a.grants_donations_au, 0) + COALESCE(a.grants_donations_intl, 0))::bigint AS grants_given
        FROM acnc_charities c
        JOIN mv_acnc_latest a ON c.abn = a.abn
        WHERE a.total_revenue IS NOT NULL
        ORDER BY a.total_revenue DESC
        LIMIT 20
      ) t
    ),

    'top_grant_makers', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          c.name,
          c.charity_size AS size,
          c.state,
          c.is_foundation,
          (COALESCE(a.grants_donations_au, 0) + COALESCE(a.grants_donations_intl, 0))::bigint AS grants_given,
          a.total_revenue::bigint AS revenue
        FROM acnc_charities c
        JOIN mv_acnc_latest a ON c.abn = a.abn
        WHERE (COALESCE(a.grants_donations_au, 0) + COALESCE(a.grants_donations_intl, 0)) > 0
        ORDER BY (COALESCE(a.grants_donations_au, 0) + COALESCE(a.grants_donations_intl, 0)) DESC
        LIMIT 20
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;
