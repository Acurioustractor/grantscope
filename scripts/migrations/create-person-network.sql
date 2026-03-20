-- Person Power Network: cross-system influence scoring
-- Each person scored by: boards held, donation $, contract $ through their orgs,
-- justice funding, political connections, foundation trusteeships

BEGIN;

-- Step 1: Person-level aggregation across all systems
DROP MATERIALIZED VIEW IF EXISTS mv_person_network CASCADE;

CREATE MATERIALIZED VIEW mv_person_network AS
WITH person_boards AS (
  -- Unique people and their board positions
  SELECT
    person_name_normalised,
    COUNT(DISTINCT company_abn) FILTER (WHERE company_abn IS NOT NULL) AS board_count,
    COUNT(*) AS role_count,
    array_agg(DISTINCT source) AS sources,
    array_agg(DISTINCT company_abn) FILTER (WHERE company_abn IS NOT NULL) AS org_abns,
    bool_or(source LIKE '%parliament%' OR source = 'openpolitics_au') AS is_politician,
    bool_or(source = 'foundation_board') AS is_foundation_trustee
  FROM person_roles
  WHERE person_name_normalised IS NOT NULL
    AND person_name_normalised != ''
  GROUP BY person_name_normalised
),

-- Step 2: Donation totals per person (matched by name)
person_donations AS (
  SELECT
    UPPER(TRIM(regexp_replace(pd.donor_name, '\s+', ' ', 'g'))) AS person_name_normalised,
    COUNT(*) AS donation_count,
    COUNT(DISTINCT pd.donation_to) AS parties_count,
    SUM(pd.amount)::bigint AS total_donated
  FROM political_donations pd
  WHERE pd.amount > 0
    AND pd.donor_name IS NOT NULL
  GROUP BY UPPER(TRIM(regexp_replace(pd.donor_name, '\s+', ' ', 'g')))
),

-- Step 3: Contract value flowing through orgs where person is a director
person_contracts AS (
  SELECT
    pr.person_name_normalised,
    COUNT(DISTINCT ac.id) AS contract_count,
    SUM(ac.contract_value)::bigint AS total_contract_value
  FROM person_roles pr
  JOIN austender_contracts ac ON ac.supplier_abn = pr.company_abn
  WHERE pr.company_abn IS NOT NULL
    AND ac.contract_value > 0
  GROUP BY pr.person_name_normalised
),

-- Step 4: Justice funding flowing through orgs where person is a director
person_justice AS (
  SELECT
    pr.person_name_normalised,
    COUNT(DISTINCT jf.id) AS justice_grant_count,
    SUM(jf.amount_dollars)::bigint AS total_justice_funding
  FROM person_roles pr
  JOIN justice_funding jf ON jf.recipient_abn = pr.company_abn
  WHERE pr.company_abn IS NOT NULL
    AND jf.amount_dollars > 0
  GROUP BY pr.person_name_normalised
),

-- Step 5: Foundation giving through orgs where person is a trustee
person_foundations AS (
  SELECT
    pr.person_name_normalised,
    COUNT(DISTINCT f.id) AS foundation_count,
    SUM(f.total_giving_annual)::bigint AS total_foundation_giving
  FROM person_roles pr
  JOIN foundations f ON f.acnc_abn = pr.company_abn
  WHERE pr.company_abn IS NOT NULL
    AND f.total_giving_annual > 0
  GROUP BY pr.person_name_normalised
)

SELECT
  pb.person_name_normalised,
  pb.board_count,
  pb.role_count,
  pb.sources,
  pb.org_abns,
  pb.is_politician,
  pb.is_foundation_trustee,

  -- Donations
  COALESCE(pd.donation_count, 0) AS donation_count,
  COALESCE(pd.parties_count, 0) AS parties_donated_to,
  COALESCE(pd.total_donated, 0) AS total_donated,

  -- Contracts (through their orgs)
  COALESCE(pc.contract_count, 0) AS contract_count,
  COALESCE(pc.total_contract_value, 0) AS total_contract_value,

  -- Justice funding (through their orgs)
  COALESCE(pj.justice_grant_count, 0) AS justice_grant_count,
  COALESCE(pj.total_justice_funding, 0) AS total_justice_funding,

  -- Foundation giving (through their orgs)
  COALESCE(pf.foundation_count, 0) AS foundation_count,
  COALESCE(pf.total_foundation_giving, 0) AS total_foundation_giving,

  -- System count: how many systems this person touches
  (CASE WHEN pb.board_count > 0 THEN 1 ELSE 0 END
   + CASE WHEN COALESCE(pd.total_donated, 0) > 0 THEN 1 ELSE 0 END
   + CASE WHEN COALESCE(pc.contract_count, 0) > 0 THEN 1 ELSE 0 END
   + CASE WHEN COALESCE(pj.justice_grant_count, 0) > 0 THEN 1 ELSE 0 END
   + CASE WHEN COALESCE(pf.foundation_count, 0) > 0 THEN 1 ELSE 0 END
   + CASE WHEN pb.is_politician THEN 1 ELSE 0 END
  ) AS system_count,

  -- Power score: weighted composite
  (
    -- Board influence (log scale, capped)
    LEAST(pb.board_count, 20) * 2
    -- Political donation influence (log scale)
    + CASE WHEN COALESCE(pd.total_donated, 0) > 0
        THEN LEAST(LOG(pd.total_donated + 1)::int, 20)
        ELSE 0 END
    -- Contract pipeline influence
    + CASE WHEN COALESCE(pc.total_contract_value, 0) > 0
        THEN LEAST(LOG(pc.total_contract_value + 1)::int, 20)
        ELSE 0 END
    -- Justice funding influence
    + CASE WHEN COALESCE(pj.total_justice_funding, 0) > 0
        THEN LEAST(LOG(pj.total_justice_funding + 1)::int, 15)
        ELSE 0 END
    -- Foundation giving influence
    + CASE WHEN COALESCE(pf.total_foundation_giving, 0) > 0
        THEN LEAST(LOG(pf.total_foundation_giving + 1)::int, 15)
        ELSE 0 END
    -- Politician bonus
    + CASE WHEN pb.is_politician THEN 10 ELSE 0 END
    -- Cross-system multiplier
    + (CASE WHEN pb.board_count > 0 THEN 1 ELSE 0 END
       + CASE WHEN COALESCE(pd.total_donated, 0) > 0 THEN 1 ELSE 0 END
       + CASE WHEN COALESCE(pc.contract_count, 0) > 0 THEN 1 ELSE 0 END
       + CASE WHEN COALESCE(pj.justice_grant_count, 0) > 0 THEN 1 ELSE 0 END
       + CASE WHEN COALESCE(pf.foundation_count, 0) > 0 THEN 1 ELSE 0 END
       + CASE WHEN pb.is_politician THEN 1 ELSE 0 END
      ) * 5
  ) AS power_score

FROM person_boards pb
LEFT JOIN person_donations pd ON pd.person_name_normalised = pb.person_name_normalised
LEFT JOIN person_contracts pc ON pc.person_name_normalised = pb.person_name_normalised
LEFT JOIN person_justice pj ON pj.person_name_normalised = pb.person_name_normalised
LEFT JOIN person_foundations pf ON pf.person_name_normalised = pb.person_name_normalised;

-- Indexes for fast lookups
CREATE INDEX idx_person_network_power ON mv_person_network (power_score DESC);
CREATE INDEX idx_person_network_name ON mv_person_network (person_name_normalised);
CREATE INDEX idx_person_network_systems ON mv_person_network (system_count DESC);
CREATE INDEX idx_person_network_politician ON mv_person_network (is_politician) WHERE is_politician = true;
CREATE INDEX idx_person_network_trustee ON mv_person_network (is_foundation_trustee) WHERE is_foundation_trustee = true;
CREATE INDEX idx_person_network_donor ON mv_person_network (total_donated DESC) WHERE total_donated > 0;

COMMIT;

-- Step 6: Foundation trustee → grantee overlap detection
-- People who sit on a foundation board AND on a board of an org funded by that foundation
DROP MATERIALIZED VIEW IF EXISTS mv_trustee_grantee_overlaps CASCADE;

CREATE MATERIALIZED VIEW mv_trustee_grantee_overlaps AS
SELECT
  pr_foundation.person_name_normalised,
  pr_foundation.company_name AS foundation_name,
  pr_foundation.company_abn AS foundation_abn,
  pr_recipient.company_name AS recipient_name,
  pr_recipient.company_abn AS recipient_abn,
  f.total_giving_annual AS foundation_giving,
  SUM(jf.amount_dollars)::bigint AS funding_to_recipient,
  COUNT(DISTINCT jf.id) AS grant_count
FROM person_roles pr_foundation
JOIN foundations f ON f.acnc_abn = pr_foundation.company_abn
JOIN person_roles pr_recipient
  ON pr_recipient.person_name_normalised = pr_foundation.person_name_normalised
  AND pr_recipient.company_abn IS NOT NULL
  AND pr_recipient.company_abn != pr_foundation.company_abn
JOIN justice_funding jf ON jf.recipient_abn = pr_recipient.company_abn
WHERE pr_foundation.company_abn IS NOT NULL
  AND jf.amount_dollars > 0
GROUP BY
  pr_foundation.person_name_normalised,
  pr_foundation.company_name,
  pr_foundation.company_abn,
  pr_recipient.company_name,
  pr_recipient.company_abn,
  f.total_giving_annual;

CREATE INDEX idx_trustee_grantee_person ON mv_trustee_grantee_overlaps (person_name_normalised);
CREATE INDEX idx_trustee_grantee_funding ON mv_trustee_grantee_overlaps (funding_to_recipient DESC);
