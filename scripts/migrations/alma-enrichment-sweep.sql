-- ALMA Enrichment Sweep
-- 2026-03-27
--
-- Sources: gs_entities, acnc_charities, justice_funding, austender_contracts, postcode_geo
--
-- Phase 1: Link 3 remaining matchable interventions
-- Phase 2: Enrich years_operating from ACNC date_established (622 orgs)
-- Phase 3: Enrich website from ACNC where missing (482 available)
-- Phase 4: Enrich coordinates from postcode_geo via entity postcode (306 enrichable)
-- Phase 5: Enrich current_funding from justice_funding + contracts (643 missing → ~278 fillable)
-- Phase 6: Recalculate portfolio_score with real data

BEGIN;

-- ============================================================
-- PHASE 1: Link 3 matchable interventions
-- ============================================================

-- YACWA → Youth Affairs Council Of Wa Inc
UPDATE alma_interventions
SET gs_entity_id = 'cded2a38-2504-47be-8851-5538a81c3ddc'
WHERE name = 'YACWA (Youth Affairs Council of WA)' AND gs_entity_id IS NULL;

-- ABCN → Australian Business And Community Network Limited
UPDATE alma_interventions
SET gs_entity_id = '0f1dc973-9d56-450e-a355-df7b65e71f27'
WHERE name = 'ABCN' AND gs_entity_id IS NULL;

-- GIFSA → Goldfields Individual & Family Support Association Inc
UPDATE alma_interventions
SET gs_entity_id = 'b7785cb6-57a6-4cad-880d-ee7b6be072c1'
WHERE name = 'Goldfields Individual and Family Support Association (GIFSA)' AND gs_entity_id IS NULL;

-- ============================================================
-- PHASE 2: Enrich years_operating from ACNC date_established
-- ============================================================
-- Only update where years_operating is NULL and ACNC has a date

UPDATE alma_interventions ai
SET years_operating = EXTRACT(YEAR FROM AGE(NOW(), ac.date_established))::int
FROM gs_entities ge
JOIN acnc_charities ac ON ac.abn = ge.abn
WHERE ai.gs_entity_id = ge.id
  AND ai.years_operating IS NULL
  AND ac.date_established IS NOT NULL
  AND ge.abn IS NOT NULL
  AND (ai.data_quality != 'quarantined' OR ai.data_quality IS NULL);

-- ============================================================
-- PHASE 3: Enrich website from ACNC where missing
-- ============================================================

UPDATE alma_interventions ai
SET website = ac.website
FROM gs_entities ge
JOIN acnc_charities ac ON ac.abn = ge.abn
WHERE ai.gs_entity_id = ge.id
  AND ai.website IS NULL
  AND ac.website IS NOT NULL
  AND ge.abn IS NOT NULL
  AND (ai.data_quality != 'quarantined' OR ai.data_quality IS NULL);

-- ============================================================
-- PHASE 4: Enrich coordinates from postcode_geo
-- ============================================================
-- Use entity's postcode → postcode_geo lat/long

UPDATE alma_interventions ai
SET
  latitude = pg.latitude,
  longitude = pg.longitude
FROM gs_entities ge
JOIN postcode_geo pg ON pg.postcode = ge.postcode
WHERE ai.gs_entity_id = ge.id
  AND ai.latitude IS NULL
  AND ge.postcode IS NOT NULL
  AND pg.latitude IS NOT NULL
  AND (ai.data_quality != 'quarantined' OR ai.data_quality IS NULL);

-- ============================================================
-- PHASE 5: Enrich current_funding from justice_funding + contracts
-- ============================================================
-- current_funding is an enum: Unfunded, Pilot/seed, Established, Oversubscribed, At-risk
-- Classify based on total funding flowing to the org:
--   >$1M = Established, $100K-$1M = Pilot/seed, <$100K = Unfunded
-- Store actual dollar amount in metadata.

UPDATE alma_interventions ai
SET
  current_funding = CASE
    WHEN funding.total_dollars >= 1000000 THEN 'Established'
    WHEN funding.total_dollars >= 100000 THEN 'Pilot/seed'
    ELSE 'Unfunded'
  END,
  metadata = COALESCE(ai.metadata, '{}'::jsonb) || jsonb_build_object(
    'total_org_funding_dollars', ROUND(funding.total_dollars::numeric, 2),
    'justice_funding_dollars', ROUND(funding.jf_dollars::numeric, 2),
    'contract_dollars', ROUND(funding.ct_dollars::numeric, 2),
    'funding_enriched_at', NOW()::text
  )
FROM (
  SELECT ai2.id,
    COALESCE(jf.total, 0) as jf_dollars,
    COALESCE(ct.total, 0) as ct_dollars,
    COALESCE(jf.total, 0) + COALESCE(ct.total, 0) as total_dollars
  FROM alma_interventions ai2
  JOIN gs_entities ge ON ge.id = ai2.gs_entity_id
  LEFT JOIN (
    SELECT gs_entity_id, SUM(amount_dollars) as total
    FROM justice_funding
    WHERE amount_dollars > 0
    GROUP BY gs_entity_id
  ) jf ON jf.gs_entity_id = ai2.gs_entity_id
  LEFT JOIN (
    SELECT supplier_abn, SUM(contract_value) as total
    FROM austender_contracts
    WHERE contract_value > 0
    GROUP BY supplier_abn
  ) ct ON ct.supplier_abn = ge.abn AND ge.abn IS NOT NULL
  WHERE ai2.current_funding IS NULL
    AND ai2.gs_entity_id IS NOT NULL
    AND (ai2.data_quality != 'quarantined' OR ai2.data_quality IS NULL)
    AND (COALESCE(jf.total, 0) + COALESCE(ct.total, 0)) > 0
) funding
WHERE ai.id = funding.id;

-- ============================================================
-- PHASE 6: Recalculate portfolio_score
-- ============================================================
-- portfolio_score = weighted average of 5 signals (0-1 each)
-- Recalculate evidence_strength_signal based on actual evidence links

UPDATE alma_interventions ai
SET evidence_strength_signal = CASE
    WHEN ev_count >= 5 THEN 1.0
    WHEN ev_count >= 3 THEN 0.8
    WHEN ev_count >= 1 THEN 0.5
    ELSE 0.1
  END
FROM (
  SELECT intervention_id, COUNT(*) as ev_count
  FROM alma_intervention_evidence
  GROUP BY intervention_id
) ev
WHERE ai.id = ev.intervention_id
  AND (ai.data_quality != 'quarantined' OR ai.data_quality IS NULL);

-- Set evidence_strength_signal = 0.1 for interventions with NO evidence
UPDATE alma_interventions
SET evidence_strength_signal = 0.1
WHERE id NOT IN (SELECT DISTINCT intervention_id FROM alma_intervention_evidence)
  AND (data_quality != 'quarantined' OR data_quality IS NULL);

-- Recalculate portfolio_score as weighted average
UPDATE alma_interventions
SET portfolio_score = ROUND((
  COALESCE(evidence_strength_signal, 0.1) * 0.30 +
  COALESCE(community_authority_signal, 0.5) * 0.25 +
  COALESCE(harm_risk_signal, 0.5) * 0.15 +
  COALESCE(implementation_capability_signal, 0.5) * 0.15 +
  COALESCE(option_value_signal, 0.5) * 0.15
)::numeric, 3)
WHERE (data_quality != 'quarantined' OR data_quality IS NULL);

-- ============================================================
-- Refresh stats
-- ============================================================
ANALYZE alma_interventions;

COMMIT;
