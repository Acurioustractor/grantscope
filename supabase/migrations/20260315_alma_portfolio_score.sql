-- ALMA Portfolio Score Computation
-- Calculates 5 signal columns + composite portfolio_score for all interventions
--
-- Scoring model:
--   evidence_strength_signal (0-1): based on evidence_level + evidence record count
--   community_authority_signal (0-1): based on cultural_authority presence + is_community_controlled entity link
--   harm_risk_signal (0-1): inverted risk — higher = safer (based on consent_level, harm_risk_level)
--   implementation_capability_signal (0-1): based on years_operating, website, operating_org, geo
--   option_value_signal (0-1): based on scalability, replication_readiness, cost_per_young_person
--
--   portfolio_score = weighted composite (0-100)

BEGIN;

-- Step 1: Compute evidence_strength_signal
-- evidence_level enum scoring + evidence record count bonus
UPDATE alma_interventions ai SET
  evidence_strength_signal = (
    -- Base score from evidence_level
    CASE evidence_level
      WHEN 'Proven (RCT/quasi-experimental, replicated)' THEN 0.95
      WHEN 'Effective (strong evaluation, positive outcomes)' THEN 0.75
      WHEN 'Indigenous-led (culturally grounded, community authority)' THEN 0.65
      WHEN 'Promising (community-endorsed, emerging evidence)' THEN 0.40
      WHEN 'Untested (theory/pilot stage)' THEN 0.15
      ELSE 0.10  -- null evidence_level
    END
    +
    -- Bonus for number of evidence records (max +0.05)
    LEAST(0.05, COALESCE((
      SELECT COUNT(*) * 0.005
      FROM alma_intervention_evidence ie
      WHERE ie.intervention_id = ai.id
    ), 0))
  );

-- Step 2: Compute community_authority_signal
-- Based on cultural_authority field presence + entity community-controlled status
UPDATE alma_interventions ai SET
  community_authority_signal = (
    -- cultural_authority field populated = strong signal
    CASE WHEN cultural_authority IS NOT NULL AND LENGTH(cultural_authority) > 10 THEN 0.5 ELSE 0.0 END
    +
    -- linked to community-controlled entity
    CASE WHEN EXISTS (
      SELECT 1 FROM gs_entities e WHERE e.id = ai.gs_entity_id AND e.is_community_controlled = true
    ) THEN 0.3 ELSE 0.0 END
    +
    -- has contributors listed
    CASE WHEN contributors IS NOT NULL AND array_length(contributors, 1) > 0 THEN 0.1 ELSE 0.0 END
    +
    -- consent_level populated
    CASE WHEN consent_level IS NOT NULL AND consent_level <> '' THEN 0.1 ELSE 0.0 END
  );

-- Step 3: Compute harm_risk_signal (inverted — higher = lower risk = better)
UPDATE alma_interventions SET
  harm_risk_signal = (
    -- consent_level as proxy (all 1155 have it)
    CASE
      WHEN consent_level ILIKE '%open%' OR consent_level ILIKE '%public%' THEN 0.8
      WHEN consent_level ILIKE '%research%' OR consent_level ILIKE '%academic%' THEN 0.7
      WHEN consent_level ILIKE '%restricted%' OR consent_level ILIKE '%limited%' THEN 0.5
      WHEN consent_level IS NOT NULL AND consent_level <> '' THEN 0.6
      ELSE 0.4
    END
    +
    -- harm_risk_level if populated
    CASE harm_risk_level
      WHEN 'Low' THEN 0.2
      WHEN 'Medium' THEN 0.1
      WHEN 'High' THEN 0.0
      ELSE 0.1  -- assume moderate if unknown
    END
  );

-- Step 4: Compute implementation_capability_signal
UPDATE alma_interventions SET
  implementation_capability_signal = (
    -- has operating organization
    CASE WHEN operating_organization IS NOT NULL AND operating_organization <> '' THEN 0.25 ELSE 0.0 END
    +
    -- has website
    CASE WHEN website IS NOT NULL AND website <> '' THEN 0.15 ELSE 0.0 END
    +
    -- has geo coordinates
    CASE WHEN latitude IS NOT NULL THEN 0.15 ELSE 0.0 END
    +
    -- has contact info
    CASE WHEN contact_email IS NOT NULL OR contact_phone IS NOT NULL THEN 0.15 ELSE 0.0 END
    +
    -- years operating (maturity)
    CASE
      WHEN years_operating >= 10 THEN 0.20
      WHEN years_operating >= 5 THEN 0.15
      WHEN years_operating >= 2 THEN 0.10
      WHEN years_operating >= 1 THEN 0.05
      ELSE 0.0
    END
    +
    -- linked to entity (institutional backing)
    CASE WHEN gs_entity_id IS NOT NULL THEN 0.10 ELSE 0.0 END
  );

-- Step 5: Compute option_value_signal
-- Scalability, replication readiness, cost efficiency
UPDATE alma_interventions SET
  option_value_signal = (
    -- scalability
    CASE scalability
      WHEN 'High' THEN 0.30
      WHEN 'Medium' THEN 0.20
      WHEN 'Context-dependent' THEN 0.15
      WHEN 'Low' THEN 0.05
      ELSE 0.10  -- unknown, assume some potential
    END
    +
    -- replication readiness
    CASE replication_readiness
      WHEN 'Ready' THEN 0.25
      WHEN 'Adaptable' THEN 0.20
      WHEN 'Emerging' THEN 0.10
      ELSE 0.08  -- unknown
    END
    +
    -- cost efficiency (lower cost = more scalable option value)
    CASE implementation_cost
      WHEN 'Low (<$50k)' THEN 0.25
      WHEN 'Medium ($50k-$250k)' THEN 0.20
      WHEN 'High ($250k-$1M)' THEN 0.10
      WHEN 'Very High (>$1M)' THEN 0.05
      ELSE 0.12  -- unknown
    END
    +
    -- has target cohort defined (intervention specificity)
    CASE WHEN target_cohort IS NOT NULL AND array_length(target_cohort, 1) > 0 THEN 0.10 ELSE 0.0 END
    +
    -- serves youth justice (high policy relevance)
    CASE WHEN serves_youth_justice = true THEN 0.10 ELSE 0.0 END
  );

-- Clamp all signals to 0-1 range
UPDATE alma_interventions SET
  evidence_strength_signal = LEAST(1.0, GREATEST(0, COALESCE(evidence_strength_signal, 0))),
  community_authority_signal = LEAST(1.0, GREATEST(0, COALESCE(community_authority_signal, 0))),
  harm_risk_signal = LEAST(1.0, GREATEST(0, COALESCE(harm_risk_signal, 0))),
  implementation_capability_signal = LEAST(1.0, GREATEST(0, COALESCE(implementation_capability_signal, 0))),
  option_value_signal = LEAST(1.0, GREATEST(0, COALESCE(option_value_signal, 0)));

-- Step 6: Compute composite portfolio_score (0-1 scale, stored in numeric(5,4))
-- Weighted: evidence 30%, community authority 25%, harm risk 15%, implementation 15%, option value 15%
UPDATE alma_interventions SET
  portfolio_score = ROUND(
    LEAST(1.0,
      COALESCE(evidence_strength_signal, 0) * 0.30 +
      COALESCE(community_authority_signal, 0) * 0.25 +
      COALESCE(harm_risk_signal, 0) * 0.15 +
      COALESCE(implementation_capability_signal, 0) * 0.15 +
      COALESCE(option_value_signal, 0) * 0.15
    ),
    4
  );

COMMIT;
