-- Recreate remaining cascaded MVs (4-8)
-- MVs 1-3 already created: mv_revolving_door, mv_person_entity_network, mv_person_influence

-- ═══ 4. mv_board_interlocks (deps: mv_entity_power_index) ═══
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_board_interlocks AS
WITH multi_board_persons AS (
  SELECT person_name_normalised FROM person_roles
  WHERE person_name_normalised IS NOT NULL AND person_name_normalised != '' AND company_abn IS NOT NULL
  GROUP BY person_name_normalised HAVING COUNT(DISTINCT company_abn) >= 2
),
person_summary AS (
  SELECT pr.person_name_normalised, MIN(pr.person_name) as person_name_display,
    COUNT(DISTINCT pr.company_abn) as board_count,
    array_agg(DISTINCT pr.company_name ORDER BY pr.company_name) as organisations,
    array_agg(DISTINCT pr.company_abn ORDER BY pr.company_abn) as organisation_abns,
    array_agg(DISTINCT pr.entity_id) FILTER (WHERE pr.entity_id IS NOT NULL) as entity_ids,
    array_agg(DISTINCT pr.role_type ORDER BY pr.role_type) as role_types,
    array_agg(DISTINCT pr.source ORDER BY pr.source) as sources
  FROM person_roles pr JOIN multi_board_persons mb ON mb.person_name_normalised = pr.person_name_normalised
  WHERE pr.company_abn IS NOT NULL GROUP BY pr.person_name_normalised
)
SELECT ps.*,
  COALESCE(pi_agg.total_procurement_dollars, 0) as total_procurement_dollars,
  COALESCE(pi_agg.total_justice_dollars, 0) as total_justice_dollars,
  COALESCE(pi_agg.total_donation_dollars, 0) as total_donation_dollars,
  COALESCE(pi_agg.max_system_count, 0) as max_entity_system_count,
  COALESCE(pi_agg.sum_power_score, 0) as total_power_score,
  COALESCE(pi_agg.has_community_controlled, false) as connects_community_controlled,
  (ps.board_count * LN(GREATEST(COALESCE(pi_agg.total_procurement_dollars, 0) + COALESCE(pi_agg.total_justice_dollars, 0) + COALESCE(pi_agg.total_donation_dollars, 0), 0) + 1) *
   GREATEST(COALESCE(pi_agg.max_system_count, 1), 1))::numeric(12,2) as interlock_score
FROM person_summary ps
LEFT JOIN LATERAL (
  SELECT SUM(pi.procurement_dollars) as total_procurement_dollars, SUM(pi.justice_dollars) as total_justice_dollars,
    SUM(pi.donation_dollars) as total_donation_dollars, MAX(pi.system_count) as max_system_count,
    SUM(pi.power_score) as sum_power_score, bool_or(pi.is_community_controlled) as has_community_controlled
  FROM mv_entity_power_index pi WHERE pi.id = ANY(ps.entity_ids)
) pi_agg ON true
ORDER BY interlock_score DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_board_interlocks_person ON mv_board_interlocks (person_name_normalised);
CREATE INDEX IF NOT EXISTS idx_mv_board_interlocks_score ON mv_board_interlocks (interlock_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_mv_board_interlocks_board_count ON mv_board_interlocks (board_count DESC);

-- ═══ 5. mv_disability_landscape (deps: mv_entity_power_index, mv_funding_deserts) ═══
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_disability_landscape AS
WITH ndis_by_lga AS (
  SELECT lga_name, state, SUM(participant_count) AS ndis_participants
  FROM ndis_participants_lga WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_participants_lga)
  GROUP BY lga_name, state
), disability_entities AS (
  SELECT ge.lga_name, ge.state, COUNT(*) AS civicgraph_disability_entities,
    COUNT(*) FILTER (WHERE ge.is_community_controlled) AS community_controlled_disability,
    SUM(CASE WHEN pi.in_justice_funding = 1 THEN 1 ELSE 0 END) AS also_in_justice,
    SUM(CASE WHEN pi.in_procurement = 1 THEN 1 ELSE 0 END) AS also_in_procurement,
    AVG(pi.system_count) AS avg_system_count
  FROM gs_entities ge JOIN ndis_registered_providers nrp ON nrp.abn = ge.abn
  LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
  WHERE ge.lga_name IS NOT NULL GROUP BY ge.lga_name, ge.state
), utilisation_by_state AS (
  SELECT state, AVG(utilisation_rate) FILTER (WHERE disability_type = 'ALL' AND age_group = 'ALL' AND support_class = 'ALL' AND service_district != 'ALL') AS overall_utilisation,
    MIN(utilisation_rate) FILTER (WHERE disability_type = 'ALL' AND age_group = 'ALL' AND support_class = 'ALL' AND service_district != 'ALL') AS min_utilisation
  FROM ndis_utilisation WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_utilisation) GROUP BY state
), first_nations_by_state AS (
  SELECT state, SUM(participant_count) FILTER (WHERE remoteness = 'All') AS fn_total_participants,
    SUM(participant_count) FILTER (WHERE remoteness = 'Very Remote') AS fn_very_remote_participants,
    AVG(avg_annualised_support) FILTER (WHERE remoteness = 'All') AS fn_avg_budget,
    AVG(avg_annualised_support) FILTER (WHERE remoteness = 'Very Remote') AS fn_very_remote_avg_budget
  FROM ndis_first_nations WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_first_nations) GROUP BY state
), alma_disability AS (
  SELECT COALESCE(ge.lga_name, 'Unknown') AS lga_name, COALESCE(ge.state, 'Unknown') AS state,
    COUNT(*) AS disability_interventions, AVG(ai.portfolio_score) AS avg_evidence_score
  FROM alma_interventions ai LEFT JOIN gs_entities ge ON ge.id = ai.gs_entity_id
  WHERE ai.topics @> ARRAY['ndis'] OR ai.name ILIKE '%disab%' OR ai.description ILIKE '%disab%' OR ai.target_cohort::text ILIKE '%disab%'
  GROUP BY COALESCE(ge.lga_name, 'Unknown'), COALESCE(ge.state, 'Unknown')
), desert AS (SELECT lga_name, state, remoteness, desert_score, avg_irsd_decile FROM mv_funding_deserts)
SELECT COALESCE(n.lga_name, de.lga_name, ds.lga_name) AS lga_name, COALESCE(n.state, de.state, ds.state) AS state,
  ds.remoteness, ds.desert_score, ds.avg_irsd_decile,
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
  CASE WHEN COALESCE(de.civicgraph_disability_entities, 0) > 0
    THEN round(COALESCE(n.ndis_participants, 0)::numeric / de.civicgraph_disability_entities, 1) ELSE NULL
  END AS participants_per_provider
FROM ndis_by_lga n
FULL JOIN disability_entities de ON de.lga_name = n.lga_name AND de.state = n.state
LEFT JOIN desert ds ON ds.lga_name = COALESCE(n.lga_name, de.lga_name) AND ds.state = COALESCE(n.state, de.state)
LEFT JOIN utilisation_by_state u ON u.state = COALESCE(n.state, de.state)
LEFT JOIN first_nations_by_state fn ON fn.state = COALESCE(n.state, de.state)
LEFT JOIN alma_disability al ON al.lga_name = COALESCE(n.lga_name, de.lga_name) AND al.state = COALESCE(n.state, de.state)
WHERE COALESCE(n.lga_name, de.lga_name) IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_disability_landscape_state ON mv_disability_landscape(state);
CREATE INDEX IF NOT EXISTS idx_disability_landscape_thin ON mv_disability_landscape(thin_market_status);

-- ═══ 6. mv_foundation_need_alignment ═══
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_foundation_need_alignment AS
WITH grantee_locations AS (
  SELECT fg.foundation_name, fg.foundation_abn, fg.grantee_name, fg.grantee_abn,
    e.lga_name, e.lga_code, e.state, e.remoteness, e.seifa_irsd_decile, e.is_community_controlled
  FROM mv_foundation_grantees fg JOIN gs_entities e ON e.abn = fg.grantee_abn
  WHERE e.lga_name IS NOT NULL
)
SELECT gl.foundation_name, gl.foundation_abn, gl.lga_name, gl.state, gl.remoteness,
  COUNT(DISTINCT gl.grantee_abn) as grantee_count,
  COALESCE(fd.desert_score, 0) as desert_score,
  COALESCE(fd.avg_irsd_decile, 0) as avg_lga_disadvantage,
  COALESCE(fd.total_funding_all_sources, 0) as existing_funding,
  COUNT(DISTINCT gl.grantee_abn) FILTER (WHERE gl.is_community_controlled) as community_controlled_count,
  AVG(gl.seifa_irsd_decile) as avg_grantee_disadvantage_decile
FROM grantee_locations gl
LEFT JOIN mv_funding_deserts fd ON fd.lga_name = gl.lga_name
GROUP BY gl.foundation_name, gl.foundation_abn, gl.lga_name, gl.state, gl.remoteness,
  fd.desert_score, fd.avg_irsd_decile, fd.total_funding_all_sources;

CREATE INDEX IF NOT EXISTS idx_fna_foundation_lga ON mv_foundation_need_alignment (foundation_abn, lga_name);
CREATE INDEX IF NOT EXISTS idx_fna_desert ON mv_foundation_need_alignment (desert_score DESC);

-- ═══ 7. mv_foundation_scores ═══
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_foundation_scores AS
WITH foundation_base AS (
  SELECT f.id as foundation_id, f.name, f.acnc_abn, f.total_giving_annual, f.type, f.parent_company, f.thematic_focus, f.geographic_focus
  FROM foundations f WHERE f.acnc_abn IS NOT NULL AND f.total_giving_annual > 100000
),
transparency AS (
  SELECT fb.foundation_id, COUNT(DISTINCT fg.grantee_abn) as grantee_count, COUNT(DISTINCT fg.link_method) as link_methods,
    LEAST(100, COUNT(DISTINCT fg.grantee_abn) * 5) as transparency_score
  FROM foundation_base fb LEFT JOIN mv_foundation_grantees fg ON fg.foundation_abn = fb.acnc_abn GROUP BY fb.foundation_id
),
need_align AS (
  SELECT fb.foundation_id, COUNT(DISTINCT fna.lga_name) as lgas_funded, COALESCE(AVG(fna.desert_score), 0) as avg_desert_score,
    COALESCE(AVG(fna.avg_lga_disadvantage), 5) as avg_disadvantage,
    SUM(fna.community_controlled_count) as community_controlled_grantees,
    LEAST(100, COALESCE(AVG(fna.desert_score), 0) * 1.2) as need_alignment_score
  FROM foundation_base fb LEFT JOIN mv_foundation_need_alignment fna ON fna.foundation_abn = fb.acnc_abn GROUP BY fb.foundation_id
),
evidence AS (
  SELECT fb.foundation_id, COUNT(DISTINCT ebf.grantee_abn) as evidence_backed_orgs, COUNT(DISTINCT ebf.intervention_name) as interventions,
    COALESCE(AVG(ebf.portfolio_score), 0) as avg_portfolio_score,
    CASE WHEN t.grantee_count = 0 THEN 0
      ELSE LEAST(100, (COUNT(DISTINCT ebf.grantee_abn)::float / GREATEST(t.grantee_count, 1) * 100 * 2))
    END as evidence_score
  FROM foundation_base fb LEFT JOIN mv_evidence_backed_funding ebf ON ebf.foundation_abn = fb.acnc_abn
  LEFT JOIN transparency t ON t.foundation_id = fb.foundation_id
  GROUP BY fb.foundation_id, t.grantee_count
),
concentration AS (
  SELECT fb.foundation_id, COUNT(DISTINCT fna.state) as states_funded, COUNT(DISTINCT fna.remoteness) as remoteness_categories,
    COUNT(DISTINCT fna.lga_name) as unique_lgas,
    LEAST(100, COALESCE(COUNT(DISTINCT fna.state), 0) * 10 + COALESCE(COUNT(DISTINCT fna.remoteness), 0) * 10 + LEAST(50, COALESCE(COUNT(DISTINCT fna.lga_name), 0))) as concentration_score
  FROM foundation_base fb LEFT JOIN mv_foundation_need_alignment fna ON fna.foundation_abn = fb.acnc_abn GROUP BY fb.foundation_id
),
governance AS (
  SELECT fb.foundation_id, COUNT(DISTINCT tgc.trustee_name) as total_trustees,
    COUNT(DISTINCT tgc.trustee_name) FILTER (WHERE tgc.trustee_on_grantee_board) as overlapping_trustees,
    COUNT(*) FILTER (WHERE tgc.trustee_on_grantee_board) as overlap_instances
  FROM foundation_base fb LEFT JOIN mv_trustee_grantee_chain tgc ON tgc.foundation_abn = fb.acnc_abn GROUP BY fb.foundation_id
)
SELECT fb.foundation_id, fb.name, fb.acnc_abn, fb.total_giving_annual, fb.type, fb.parent_company,
  COALESCE(t.transparency_score, 0)::int as transparency_score, COALESCE(na.need_alignment_score, 0)::int as need_alignment_score,
  COALESCE(ev.evidence_score, 0)::int as evidence_score, COALESCE(co.concentration_score, 0)::int as concentration_score,
  (COALESCE(t.transparency_score, 0) * 0.25 + COALESCE(na.need_alignment_score, 0) * 0.30 + COALESCE(ev.evidence_score, 0) * 0.25 + COALESCE(co.concentration_score, 0) * 0.20)::int as foundation_score,
  COALESCE(t.grantee_count, 0) as grantee_count, COALESCE(na.lgas_funded, 0) as lgas_funded,
  COALESCE(na.avg_desert_score, 0)::numeric(5,1) as avg_desert_score,
  COALESCE(na.community_controlled_grantees, 0) as community_controlled_grantees,
  COALESCE(ev.evidence_backed_orgs, 0) as evidence_backed_orgs, COALESCE(ev.interventions, 0) as interventions_funded,
  COALESCE(co.states_funded, 0) as states_funded, COALESCE(co.unique_lgas, 0) as unique_lgas,
  COALESCE(g.total_trustees, 0) as total_trustees, COALESCE(g.overlapping_trustees, 0) as overlapping_trustees,
  COALESCE(g.overlap_instances, 0) as overlap_instances
FROM foundation_base fb
LEFT JOIN transparency t ON t.foundation_id = fb.foundation_id LEFT JOIN need_align na ON na.foundation_id = fb.foundation_id
LEFT JOIN evidence ev ON ev.foundation_id = fb.foundation_id LEFT JOIN concentration co ON co.foundation_id = fb.foundation_id
LEFT JOIN governance g ON g.foundation_id = fb.foundation_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fs_foundation ON mv_foundation_scores (foundation_id);
CREATE INDEX IF NOT EXISTS idx_fs_score ON mv_foundation_scores (foundation_score DESC);
CREATE INDEX IF NOT EXISTS idx_fs_abn ON mv_foundation_scores (acnc_abn);

-- ═══ 8. mv_foundation_readiness ═══
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_foundation_readiness AS
WITH foundation_base AS (
  SELECT f.id, f.name, f.acnc_abn, f.type, f.total_giving_annual,
    f.acnc_data IS NOT NULL AS has_ais_data, f.enrichment_source, f.profile_confidence
  FROM foundations f
  WHERE f.type NOT IN ('university', 'legal_aid', 'primary_health_network', 'religious_organisation', 'education_body', 'hospital', 'service_delivery', 'unknown')
),
entity_match AS (
  SELECT DISTINCT ON (fb.id) fb.id AS foundation_id, e.gs_id, e.id AS entity_uuid
  FROM foundation_base fb JOIN gs_entities e ON e.abn = fb.acnc_abn WHERE fb.acnc_abn IS NOT NULL
),
grantee_counts AS (SELECT foundation_abn, COUNT(*) AS grantee_count FROM mv_foundation_grantees GROUP BY foundation_abn),
score_lookup AS (
  SELECT DISTINCT ON (acnc_abn) acnc_abn AS score_abn, foundation_score,
    CASE WHEN foundation_score >= 50 THEN 'high' WHEN foundation_score >= 20 THEN 'medium' ELSE 'low' END AS score_tier
  FROM mv_foundation_scores WHERE acnc_abn IS NOT NULL ORDER BY acnc_abn, foundation_score DESC
)
SELECT fb.id, fb.name, fb.acnc_abn, fb.type, fb.total_giving_annual::bigint,
  fb.acnc_abn IS NOT NULL AS has_abn, em.gs_id IS NOT NULL AS has_entity, fb.has_ais_data,
  COALESCE(gc.grantee_count, 0)::int AS grantee_count, gc.grantee_count IS NOT NULL AS has_grantees,
  sl.foundation_score IS NOT NULL AS has_score, sl.foundation_score, sl.score_tier,
  (CASE WHEN fb.acnc_abn IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN em.gs_id IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN fb.has_ais_data THEN 1 ELSE 0 END + CASE WHEN gc.grantee_count IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN sl.foundation_score IS NOT NULL THEN 1 ELSE 0 END)::int AS readiness_score,
  em.gs_id, fb.enrichment_source, fb.profile_confidence
FROM foundation_base fb
LEFT JOIN entity_match em ON em.foundation_id = fb.id
LEFT JOIN grantee_counts gc ON gc.foundation_abn = fb.acnc_abn
LEFT JOIN score_lookup sl ON sl.score_abn = fb.acnc_abn
ORDER BY fb.total_giving_annual DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fr_id ON mv_foundation_readiness (id);
CREATE INDEX IF NOT EXISTS idx_fr_readiness ON mv_foundation_readiness (readiness_score);
CREATE INDEX IF NOT EXISTS idx_fr_abn ON mv_foundation_readiness (acnc_abn);
