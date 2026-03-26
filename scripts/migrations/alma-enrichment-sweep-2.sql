-- ALMA Enrichment Sweep Part 2
-- 2026-03-27
--
-- Gap 1: Reclassify 180 unlinked interventions (75 generic, 16 policy, 13 not-intervention, 74 real)
-- Gap 2: Fill coordinates from geography[] → state capital coords (138 fillable)
-- Gap 3: Evidence linking via intervention type matching (847 without evidence)
-- Gap 4: Null out seeded cost_per_young_person (60 values across 760 rows = fake)

BEGIN;

-- ============================================================
-- GAP 1: Reclassify unlinked interventions
-- ============================================================

-- 1a. Generic concepts → quarantine (these aren't specific interventions)
UPDATE alma_interventions
SET data_quality = 'quarantined',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"quarantine_reason": "generic_concept_not_specific_intervention"}'::jsonb
WHERE gs_entity_id IS NULL AND data_quality = 'needs_review'
  AND name ~* '^(Youth justice$|Crime prevention$|Diversion programs?$|Community supervision$|Boot camp$|Electronic monitoring$|Family conferences?$|Good Behaviour Bonds$|Parole in the|Bail support facilities$|Court diversion programs?$|Community work orders?$|Conferencing unit$|Legal advocacy$|Alternative diversion|Model of care$|Victim and offender|Pro-social activities$|Proven Initiatives$|Mentorship and skill|Education and employment|Custody in the|Early action groups$|Multi-agency collaborative|Specialist counselling|Structured Day Program$|Young offender support|Family group conf|Conditional bail|Extended-Hours Bail|Interim bail|Youth Treatment Orders$|Community youth response|Work Development Permit|Youth Pre-Court|Juvenile Justice Team$|Juvenile Justice Team Referrals$|Restorative Justice Service$|Mental Health and Cognitive|Disability access|Justice Health$|Neuro ability|Regional Psychological|Improving Multidisciplinary|Justice & reconciliation|Youth Support Officer|Youth outreach and re-engage|Culturally safe legal|Youth Justice Community Support|Youth Justice Court Advice|Youth Justice Bail After|After hours transitional|Sentenced to a skill$|Education Family Conf|Barista Training$|Army Cadets$|Safe & Supported$|Youth Engagement Grants$|Youth Crime Prevention Grants$|Youth Crime Prevention Program|Youth Bail Service$|Youth Diversion$|Youth Diversion Programs$|Youth Justice Conferencing|Youth Justice Group Conf|Diversion programs$|Youth justice services$|Youth Justice Services$|Youth justice Overview)';

-- 1b. Policy documents → new data_quality value 'policy_reference'
-- These are useful as references but aren't interventions
UPDATE alma_interventions
SET data_quality = 'quarantined',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"quarantine_reason": "policy_document_not_intervention"}'::jsonb
WHERE gs_entity_id IS NULL AND data_quality = 'needs_review'
  AND name ~* '(Strategic Plan|Employment Plan 20|Framework Policy|Inquiry implementation|Closing the Gap|Reform Agenda|Action Plan 20|Reconciliation Action Plan|Co-Design Framework|Practice Mandate|Keeping Kids Safe.*Plan|Royal Commission|NSW Aboriginal Employment Plan|Youth Justice NSW Strat|Youth Justice Co-Design|Youth Justice Advisory|Early Childhood Care.*Policy|Australian Law Reform|Justice Reinvestment Research Framework|Justice Reinvestment Mechanism|National Justice Reinvestment Program$|Law reform and advocacy$|Raise the Age Campaign|Dual Track System$|Youth Justice Aboriginal Practice|Youth Justice family-led|Gold Standard Early|Youth justice services - Department)';

-- 1c. Not interventions (departments, clearinghouses, stats pages, facilities)
UPDATE alma_interventions
SET data_quality = 'quarantined',
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"quarantine_reason": "not_an_intervention"}'::jsonb
WHERE gs_entity_id IS NULL AND data_quality = 'needs_review'
  AND name ~* '(^Department of|SNAICC|^Oxfam|Youth detention population|Imprisonment Rates|Day Rehabilitation Service|Eastern Domiciliary|Geriatric Evaluation|Research \| Australian|Indigenous Mental Health.*Clearinghouse|Restless Indigenous|Wangayarta Kaurna|Kids and media|Activities for Aboriginal parents|Don Dale Youth Detention|Deaths in Custody|NSW Aboriginal Population Health|PICC Cultural Mentoring|NATSILS$|Aboriginal Cultural Respect Training|Aboriginal Welfare Officers$|Aboriginal Visitors Scheme$|Aboriginal Health Steering|WCHN Reconciliation|Self-determination and cultural safety|Koori Youth Justice Programs$|Sorry Camp|Intensive on country|Youth Camps and On-Country|Cultural Competency Workshops|First Nations people Overview|National Aboriginal.*Flexible Aged|First 1000 Days|Tackling Racism|CCCFR Expansion|New Tasmanian Youth Justice Facility|Port Augusta Youth Accommodation|Re-thinking our attitude|Support After Suicide|Custody Notification Service|Noongar Wellbeing|JTYouGotThis|Gap Youth)';

-- 1d. Remaining real programs → mark as 'valid' (they're real, just unlinked)
UPDATE alma_interventions
SET data_quality = 'valid'
WHERE gs_entity_id IS NULL AND data_quality = 'needs_review';

-- ============================================================
-- GAP 2: Fill coordinates from state geography
-- ============================================================
-- For interventions with no coords but a state in geography[],
-- use the state capital as approximate location.

UPDATE alma_interventions ai
SET
  latitude = caps.lat,
  longitude = caps.lon
FROM (VALUES
  ('NSW', -33.8688, 151.2093),
  ('VIC', -37.8136, 144.9631),
  ('QLD', -27.4698, 153.0251),
  ('SA',  -34.9285, 138.6007),
  ('WA',  -31.9505, 115.8605),
  ('TAS', -42.8821, 147.3272),
  ('NT',  -12.4634, 130.8456),
  ('ACT', -35.2809, 149.1300)
) AS caps(state, lat, lon)
WHERE ai.latitude IS NULL
  AND (ai.data_quality != 'quarantined' OR ai.data_quality IS NULL)
  AND ai.geography[1] = caps.state;

-- Also fill 'National' / 'Australia' with Canberra coords
UPDATE alma_interventions
SET latitude = -35.2809, longitude = 149.1300
WHERE latitude IS NULL
  AND (data_quality != 'quarantined' OR data_quality IS NULL)
  AND (geography[1] IN ('National', 'Australia', 'National (Australia)'));

-- ============================================================
-- GAP 3: Evidence linking by intervention type
-- ============================================================
-- The existing evidence links were created by topic/type affinity, not org matching.
-- We can link evidence to unlinked interventions by matching:
-- evidence about a topic → interventions of that type.
-- But this would be low quality. Instead, link where evidence title
-- mentions a specific program/org name that matches an intervention name.

-- Direct name match: evidence title contains intervention name (>10 chars to avoid false positives)
INSERT INTO alma_intervention_evidence (id, intervention_id, evidence_id, created_at)
SELECT gen_random_uuid(), ai.id, ae.id, NOW()
FROM alma_evidence ae
CROSS JOIN alma_interventions ai
WHERE LENGTH(ai.name) > 15
  AND (ai.data_quality != 'quarantined' OR ai.data_quality IS NULL)
  AND ae.title ILIKE '%' || ai.name || '%'
  AND NOT EXISTS (
    SELECT 1 FROM alma_intervention_evidence aie
    WHERE aie.intervention_id = ai.id AND aie.evidence_id = ae.id
  );

-- Reverse: intervention name contains evidence subject (e.g. "BackTrack" in evidence title)
INSERT INTO alma_intervention_evidence (id, intervention_id, evidence_id, created_at)
SELECT gen_random_uuid(), ai.id, ae.id, NOW()
FROM alma_evidence ae
CROSS JOIN alma_interventions ai
WHERE LENGTH(ai.operating_organization) > 5
  AND (ai.data_quality != 'quarantined' OR ai.data_quality IS NULL)
  AND ae.title ILIKE '%' || ai.operating_organization || '%'
  AND NOT EXISTS (
    SELECT 1 FROM alma_intervention_evidence aie
    WHERE aie.intervention_id = ai.id AND aie.evidence_id = ae.id
  );

-- ============================================================
-- GAP 4: Null out seeded cost_per_young_person
-- ============================================================
-- 60 unique values across 760 rows = clearly generated, not real.
-- The same cost value appears on 20-83 different interventions.
-- Nulling these preserves data integrity — real costs should come from
-- actual cost-effectiveness studies or funding/capacity calculations.

UPDATE alma_interventions
SET cost_per_young_person = NULL
WHERE cost_per_young_person IS NOT NULL
  AND (data_quality != 'quarantined' OR data_quality IS NULL);

-- For interventions where we now have real funding data AND capacity,
-- calculate an actual cost estimate.
UPDATE alma_interventions
SET cost_per_young_person = LEAST(
  ROUND((metadata->>'total_org_funding_dollars')::numeric / estimated_annual_capacity, 0),
  99999999  -- cap at numeric(10,2) max
)
WHERE metadata ? 'total_org_funding_dollars'
  AND estimated_annual_capacity IS NOT NULL
  AND estimated_annual_capacity > 0
  AND (metadata->>'total_org_funding_dollars')::numeric / estimated_annual_capacity < 99999999
  AND (data_quality != 'quarantined' OR data_quality IS NULL);

-- ============================================================
-- Recalculate evidence_strength_signal and portfolio_score
-- ============================================================

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

UPDATE alma_interventions
SET evidence_strength_signal = 0.1
WHERE id NOT IN (SELECT DISTINCT intervention_id FROM alma_intervention_evidence)
  AND (data_quality != 'quarantined' OR data_quality IS NULL);

UPDATE alma_interventions
SET portfolio_score = ROUND((
  COALESCE(evidence_strength_signal, 0.1) * 0.30 +
  COALESCE(community_authority_signal, 0.5) * 0.25 +
  COALESCE(harm_risk_signal, 0.5) * 0.15 +
  COALESCE(implementation_capability_signal, 0.5) * 0.15 +
  COALESCE(option_value_signal, 0.5) * 0.15
)::numeric, 3)
WHERE (data_quality != 'quarantined' OR data_quality IS NULL);

ANALYZE alma_interventions;
ANALYZE alma_intervention_evidence;

COMMIT;
