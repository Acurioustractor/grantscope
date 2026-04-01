-- Fix mv_disability_landscape: NDIS LGA names like "Brisbane (C)" don't match
-- gs_entities/postcode_geo names like "Brisbane". Strip the type suffix.
-- Also fix the desert join which has the same mismatch.

DROP MATERIALIZED VIEW IF EXISTS mv_disability_landscape;

CREATE MATERIALIZED VIEW mv_disability_landscape AS
WITH ndis_by_lga AS (
    SELECT
        -- Strip LGA type suffix: "Brisbane (C)" → "Brisbane", "Central Coast (C) (NSW)" → "Central Coast"
        regexp_replace(lga_name, ' \([^)]*\)(\s*\([^)]*\))?$', '') AS lga_name,
        state,
        SUM(participant_count) AS ndis_participants
    FROM ndis_participants_lga
    WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_participants_lga)
    GROUP BY regexp_replace(lga_name, ' \([^)]*\)(\s*\([^)]*\))?$', ''), state
), disability_entities AS (
    SELECT
        -- Strip state disambiguators: "Campbelltown (NSW)" → "Campbelltown", "Kingston (Vic.)" → "Kingston"
        regexp_replace(ge.lga_name, ' \([^)]*\)$', '') AS lga_name,
        UPPER(ge.state) AS state,
        COUNT(*) AS civicgraph_disability_entities,
        COUNT(*) FILTER (WHERE ge.is_community_controlled) AS community_controlled_disability,
        SUM(CASE WHEN pi.in_justice_funding = 1 THEN 1 ELSE 0 END) AS also_in_justice,
        SUM(CASE WHEN pi.in_procurement = 1 THEN 1 ELSE 0 END) AS also_in_procurement,
        AVG(pi.system_count) AS avg_system_count
    FROM gs_entities ge
    JOIN ndis_registered_providers nrp ON nrp.abn = ge.abn
    LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
    WHERE ge.lga_name IS NOT NULL
    GROUP BY regexp_replace(ge.lga_name, ' \([^)]*\)$', ''), UPPER(ge.state)
), utilisation_by_state AS (
    SELECT
        state,
        AVG(utilisation_rate) FILTER (
            WHERE disability_type = 'ALL' AND age_group = 'ALL'
            AND support_class = 'ALL' AND service_district != 'ALL'
        ) AS overall_utilisation,
        MIN(utilisation_rate) FILTER (
            WHERE disability_type = 'ALL' AND age_group = 'ALL'
            AND support_class = 'ALL' AND service_district != 'ALL'
        ) AS min_utilisation
    FROM ndis_utilisation
    WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_utilisation)
    GROUP BY state
), first_nations_by_state AS (
    SELECT
        state,
        SUM(participant_count) FILTER (WHERE remoteness = 'All') AS fn_total_participants,
        SUM(participant_count) FILTER (WHERE remoteness = 'Very Remote') AS fn_very_remote_participants,
        AVG(avg_annualised_support) FILTER (WHERE remoteness = 'All') AS fn_avg_budget,
        AVG(avg_annualised_support) FILTER (WHERE remoteness = 'Very Remote') AS fn_very_remote_avg_budget
    FROM ndis_first_nations
    WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_first_nations)
    GROUP BY state
), alma_disability AS (
    SELECT
        COALESCE(ge.lga_name, 'Unknown') AS lga_name,
        COALESCE(ge.state, 'Unknown') AS state,
        COUNT(*) AS disability_interventions,
        AVG(ai.portfolio_score) AS avg_evidence_score
    FROM alma_interventions ai
    LEFT JOIN gs_entities ge ON ge.id = ai.gs_entity_id
    WHERE ai.topics @> ARRAY['ndis']
       OR ai.name ILIKE '%disab%'
       OR ai.description ILIKE '%disab%'
       OR ai.target_cohort::text ILIKE '%disab%'
    GROUP BY COALESCE(ge.lga_name, 'Unknown'), COALESCE(ge.state, 'Unknown')
), desert AS (
    SELECT DISTINCT ON (lga_name, UPPER(state))
        lga_name, UPPER(state) AS state, remoteness, desert_score, avg_irsd_decile
    FROM mv_funding_deserts
    WHERE state IS NOT NULL
    ORDER BY lga_name, UPPER(state), desert_score DESC NULLS LAST
)
SELECT
    COALESCE(n.lga_name, de.lga_name, ds.lga_name) AS lga_name,
    COALESCE(n.state, de.state, ds.state) AS state,
    ds.remoteness,
    ds.desert_score,
    ds.avg_irsd_decile,
    COALESCE(n.ndis_participants, 0) AS ndis_participants,
    COALESCE(de.civicgraph_disability_entities, 0) AS disability_entities,
    COALESCE(de.community_controlled_disability, 0) AS community_controlled_disability,
    COALESCE(de.also_in_justice, 0) AS cross_system_justice,
    COALESCE(de.also_in_procurement, 0) AS cross_system_procurement,
    COALESCE(de.avg_system_count, 0) AS avg_entity_system_count,
    COALESCE(u.overall_utilisation, 0) AS state_avg_utilisation,
    COALESCE(u.min_utilisation, 0) AS state_min_utilisation,
    COALESCE(fn.fn_total_participants, 0) AS fn_ndis_participants,
    COALESCE(fn.fn_very_remote_participants, 0) AS fn_very_remote_participants,
    COALESCE(fn.fn_avg_budget, 0) AS fn_avg_budget,
    COALESCE(fn.fn_very_remote_avg_budget, 0) AS fn_very_remote_avg_budget,
    COALESCE(al.disability_interventions, 0) AS alma_disability_interventions,
    COALESCE(al.avg_evidence_score, 0) AS alma_avg_evidence_score,
    CASE
        WHEN COALESCE(n.ndis_participants, 0) > 0 AND COALESCE(de.civicgraph_disability_entities, 0) = 0 THEN 'CRITICAL'
        WHEN COALESCE(n.ndis_participants, 0) > 500 AND COALESCE(de.civicgraph_disability_entities, 0) < 3 THEN 'SEVERE'
        WHEN COALESCE(n.ndis_participants, 0) > 100 AND COALESCE(de.civicgraph_disability_entities, 0) < 5 THEN 'MODERATE'
        WHEN COALESCE(n.ndis_participants, 0) > 0 THEN 'ADEQUATE'
        ELSE 'NO_DATA'
    END AS thin_market_status,
    CASE
        WHEN COALESCE(de.civicgraph_disability_entities, 0) > 0
        THEN ROUND(COALESCE(n.ndis_participants, 0)::numeric / de.civicgraph_disability_entities::numeric, 1)
        ELSE NULL
    END AS participants_per_provider
FROM ndis_by_lga n
FULL JOIN disability_entities de ON de.lga_name = n.lga_name AND de.state = n.state
LEFT JOIN desert ds ON ds.lga_name = COALESCE(n.lga_name, de.lga_name) AND ds.state = COALESCE(n.state, de.state)
LEFT JOIN utilisation_by_state u ON u.state = COALESCE(n.state, de.state)
LEFT JOIN first_nations_by_state fn ON fn.state = COALESCE(n.state, de.state)
LEFT JOIN alma_disability al ON al.lga_name = COALESCE(n.lga_name, de.lga_name) AND al.state = COALESCE(n.state, de.state)
WHERE COALESCE(n.lga_name, de.lga_name) IS NOT NULL;
