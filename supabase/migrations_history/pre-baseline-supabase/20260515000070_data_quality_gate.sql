-- P8a: Data quality gate.
--
-- Problem: act_grant_recommendations was scoring against alma_funding_opportunities
-- without filtering out non-grants (policy frameworks, awards, partnerships) and
-- placeholder rows with funder-homepage URLs (no current round verified).
-- The /ops page showed 67 strong fits — but only ~7 were actually fundable.
--
-- Fix:
--   1. opportunity_type — classify each row (open_grant, invitation_only, award,
--      policy_framework, partnership, tender, placeholder)
--   2. verification_status — verified (current round confirmed) /
--      placeholder (real funder, no current round) / stale (404/closed) /
--      unverified (default)
--   3. verified_at — timestamp of last live check
--   4. MV filters to opportunity_type='open_grant' AND verification_status='verified'
--
-- Manual classifications below are based on a 2026-05-15 audit. Future scrapers
-- must populate opportunity_type='open_grant' AND verification_status='verified'
-- only after confirming the program-level URL points to a live application page.

-- ── Schema additions ──────────────────────────────────────────────────────

ALTER TABLE alma_funding_opportunities
  ADD COLUMN IF NOT EXISTS opportunity_type text,
  ADD COLUMN IF NOT EXISTS verification_status text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_notes text;

-- Set defaults for any existing rows that haven't been classified yet
UPDATE alma_funding_opportunities
SET opportunity_type = 'unverified',
    verification_status = 'unverified'
WHERE opportunity_type IS NULL;

ALTER TABLE alma_funding_opportunities
  ALTER COLUMN opportunity_type SET DEFAULT 'unverified',
  ALTER COLUMN verification_status SET DEFAULT 'unverified';

ALTER TABLE alma_funding_opportunities
  ADD CONSTRAINT alma_opp_type_check
    CHECK (opportunity_type IN (
      'open_grant',        -- public application channel, current round verified
      'invitation_only',   -- funder does not accept unsolicited applications
      'award',             -- award/recognition, not a fundable program
      'policy_framework',  -- strategy/plan, not a grant channel
      'partnership',       -- partnership program, not a grant
      'tender',            -- procurement tender, not a grant
      'placeholder',       -- real funder, no current round verified
      'unverified'         -- default before classification
    )),
  ADD CONSTRAINT alma_verification_check
    CHECK (verification_status IN ('verified','placeholder','stale','unverified'));

CREATE INDEX IF NOT EXISTS idx_alma_opp_type_verification
  ON alma_funding_opportunities (opportunity_type, verification_status)
  WHERE opportunity_type = 'open_grant' AND verification_status = 'verified';

COMMENT ON COLUMN alma_funding_opportunities.opportunity_type IS
  'What is this row really? Only open_grant flows through act_grant_recommendations.';
COMMENT ON COLUMN alma_funding_opportunities.verification_status IS
  'Has the program-level URL been confirmed live with current round? verified | placeholder | stale | unverified.';

-- ── Classification: 21 manual_seed rows (mark as NOT real grants) ────────

-- Policy frameworks / strategies (not grants — funders use these as orientation,
-- not as application channels)
UPDATE alma_funding_opportunities
SET opportunity_type = 'policy_framework',
    verification_status = 'placeholder',
    verification_notes = 'Policy framework / strategy — NIAA / CTG use these for orientation but fund via specific tenders not this channel.'
WHERE scrape_source = 'manual_seed_2026_05_04'
  AND name IN (
    'Closing the Gap Priority Reform 2 — Community-Controlled Sector',
    'Indigenous Advancement Strategy — Safety and Wellbeing',
    'Central Australia Youth Safety Plan',
    'NT Aboriginal Justice Agreement Implementation Fund'
  );

-- Award (recognition, not a fundable grant)
UPDATE alma_funding_opportunities
SET opportunity_type = 'award',
    verification_status = 'placeholder',
    verification_notes = 'Award / recognition program, not a grant round.'
WHERE name = 'Reconciliation Australia — Indigenous Governance Awards';

-- Partnership (court program, not a grant)
UPDATE alma_funding_opportunities
SET opportunity_type = 'partnership',
    verification_status = 'placeholder',
    verification_notes = 'Federal Court partnership program with Aboriginal corporations, not an open grant round.'
WHERE name = 'Federal Court of Australia — True Justice Partnership';

-- Invitation-only foundations (no public application channel)
UPDATE alma_funding_opportunities
SET opportunity_type = 'invitation_only',
    verification_status = 'placeholder',
    verification_notes = 'Funder does not accept unsolicited applications. Build relationship first.'
WHERE name IN (
  'BHP Foundation — Community Investment Pool',
  'Paul Ramsay Foundation — Inclusive Communities',
  'Vincent Fairfax Family Foundation — Indigenous Australians',
  'Minderoo Communities — Place-Based Partnership',
  'Equity Trustees — Indigenous Programs Pooled Funds'
);

-- Real funders but URL points to homepage — no current round verified
UPDATE alma_funding_opportunities
SET opportunity_type = 'placeholder',
    verification_status = 'placeholder',
    verification_notes = 'Real funder with public grants but URL is funder homepage — current round / deadline / amount not verified at program level.'
WHERE scrape_source = 'manual_seed_2026_05_04'
  AND name IN (
    'QLD Kickstarter Youth Mentoring',
    'NAB Foundation — Microgrants and Multi-Year',
    'Snow Foundation Community Grants',
    'Ian Potter Foundation — Community Wellbeing',
    'Lord Mayors Charitable Foundation — Vulnerable Young People',
    'Dusseldorp Forum — Collective Action for Place',
    'Creative Australia — First Nations Strategy',
    'Just Reinvest NSW — Place-Based Justice Reinvestment',
    'Healing Foundation — Stolen Generations and Trauma',
    'Myer Foundation — Education and Indigenous Australians'
  );

-- ── Classification: 7 oracle-research rows from this session ─────────────
-- These were captured with program-level URLs and current deadlines.

UPDATE alma_funding_opportunities
SET opportunity_type = 'open_grant',
    verification_status = 'verified',
    verified_at = now(),
    verification_notes = 'Verified 2026-05-15 by oracle research — program-level URL confirmed live with current round info.'
WHERE scrape_source = 'oracle-research-2026-05-15'
  AND name IN (
    'Strengthening Rural Communities — Small & Vital (Round 30)',
    'Tackling Tough Times Together — Multi-year drought support',
    'Future Drought Fund Communities Program — Small Network Grants (Round 2)',
    'Disaster Resilient: Future Ready — Burnett Inland (QLD)',
    'Sustainable Table Fund — Regenerative Food & Farming Map pipeline'
  );

-- Coca-Cola requires DGR + employee co-applicant — real program but high friction
UPDATE alma_funding_opportunities
SET opportunity_type = 'open_grant',
    verification_status = 'verified',
    verified_at = now(),
    verification_notes = 'Verified — requires DGR1 status + Coca-Cola employee co-applicant. High friction for ACT (no DGR).'
WHERE name = 'Employee Connected Grants' AND funder_name = 'Coca-Cola Australia Foundation';

-- LMCF 2027 is forward-looking (round not yet open) — placeholder, not verified
UPDATE alma_funding_opportunities
SET opportunity_type = 'placeholder',
    verification_status = 'placeholder',
    verification_notes = '2027 round not yet open. Geographic scope = Greater Melbourne only — Witta is out of geography.'
WHERE name = 'Greater Melbourne Foundation Funding Round 2027 (anticipated)';

-- Past-deadline rows (closed but kept for forward tracking)
UPDATE alma_funding_opportunities
SET opportunity_type = 'open_grant',
    verification_status = 'stale',
    verified_at = now(),
    verification_notes = 'Verified real program but current round has closed. Re-verify when next round opens.'
WHERE name IN (
  'Rebuilding Futures (Suncorp partnership) — Round 6',
  'WELA Giving Circle Grant Round'
);


-- ── MV rebuild: filter on opportunity_type + verification_status ─────────

DROP MATERIALIZED VIEW IF EXISTS act_grant_recommendations CASCADE;

CREATE MATERIALIZED VIEW act_grant_recommendations AS
WITH project_themes AS (
  SELECT
    arp.project_code,
    p.name AS project_name,
    arp.theme_keywords,
    arp.home_states,
    arp.secondary_states
  FROM act_grant_recommendation_projects arp
  JOIN projects p ON p.code = arp.project_code
  WHERE arp.in_scope = true
),
opps AS (
  SELECT *
  FROM alma_funding_opportunities
  WHERE COALESCE(status, 'open') NOT IN ('archived','closed','cancelled','rejected')
    AND (deadline IS NULL OR deadline >= now())
    -- Data quality gate: only open grants we've verified
    AND opportunity_type = 'open_grant'
    AND verification_status = 'verified'
),
scored AS (
  SELECT
    pt.project_code,
    pt.project_name,
    o.id AS opportunity_id,
    o.name AS opportunity_name,
    o.funder_name,
    o.deadline,
    o.opens_at,
    o.min_grant_amount,
    o.max_grant_amount,
    o.is_national,
    o.jurisdictions,
    o.eligible_org_types,
    o.focus_areas,
    o.keywords,
    o.source_url,
    o.application_url,
    o.opportunity_type,
    o.verification_status,
    o.verified_at,

    LEAST(50,
      (SELECT COUNT(DISTINCT pk) * 10
       FROM unnest(pt.theme_keywords) pk
       WHERE length(pk) >= 4
         AND EXISTS (
           SELECT 1
           FROM unnest(COALESCE(o.focus_areas, '{}'::text[]) || COALESCE(o.keywords, '{}'::text[])) okw
           WHERE length(okw) >= 4
             AND (lower(okw) LIKE '%' || lower(pk) || '%'
               OR lower(pk)  LIKE '%' || lower(okw) || '%')
         ))
    )::int AS theme_score,

    CASE
      WHEN o.is_national THEN 15
      WHEN o.jurisdictions && pt.home_states THEN 15
      WHEN o.jurisdictions && pt.secondary_states THEN 9
      ELSE 0
    END AS geography_score,

    CASE
      WHEN o.eligible_org_types && ARRAY['charity','company','community_organisation','social_enterprise','arts_organisation','collective']::text[] THEN 20
      WHEN o.eligible_org_types && ARRAY['aboriginal_corporation','indigenous_charity','indigenous_org','community_org']::text[] THEN 10
      ELSE 5
    END AS eligibility_score,

    CASE
      WHEN o.deadline IS NULL THEN 8
      WHEN o.deadline >= now() + interval '30 days' THEN 15
      WHEN o.deadline >= now() + interval '7 days'  THEN 8
      WHEN o.deadline >= now()                       THEN 4
      ELSE 0
    END AS timing_score,

    ARRAY_REMOVE(ARRAY[
      CASE WHEN o.requires_deductible_gift_recipient THEN 'requires_dgr' END,
      CASE
        WHEN o.eligible_org_types && ARRAY['aboriginal_corporation','indigenous_charity','indigenous_org']::text[]
         AND NOT (o.eligible_org_types && ARRAY['charity','company','community_organisation']::text[])
        THEN 'partner_required'
      END,
      CASE WHEN o.deadline IS NOT NULL AND o.deadline < now() + interval '14 days' THEN 'tight_deadline' END,
      CASE WHEN o.is_national THEN 'national' END,
      CASE WHEN o.max_grant_amount IS NOT NULL AND o.max_grant_amount >= 500000 THEN 'large_grant' END,
      CASE WHEN o.max_grant_amount IS NOT NULL AND o.max_grant_amount < 50000  THEN 'small_grant' END
    ], NULL) AS flags
  FROM project_themes pt
  CROSS JOIN opps o
)
SELECT
  project_code,
  project_name,
  opportunity_id,
  opportunity_name,
  funder_name,
  deadline,
  opens_at,
  min_grant_amount,
  max_grant_amount,
  is_national,
  jurisdictions,
  eligible_org_types,
  focus_areas,
  keywords,
  source_url,
  application_url,
  opportunity_type,
  verification_status,
  verified_at,
  theme_score,
  geography_score,
  eligibility_score,
  timing_score,
  (theme_score + geography_score + eligibility_score + timing_score) AS fit_score,
  (theme_score > 0 AND (theme_score + geography_score + eligibility_score + timing_score) >= 55) AS is_strong_fit,
  flags,
  now() AS computed_at
FROM scored;

CREATE UNIQUE INDEX idx_act_grant_rec_pk
  ON act_grant_recommendations (project_code, opportunity_id);
CREATE INDEX idx_act_grant_rec_score
  ON act_grant_recommendations (fit_score DESC);
CREATE INDEX idx_act_grant_rec_strong
  ON act_grant_recommendations (project_code, is_strong_fit, fit_score DESC);

COMMENT ON MATERIALIZED VIEW act_grant_recommendations IS
  'v4: data quality gate — only opportunity_type=open_grant AND verification_status=verified rows score. Filters out policy frameworks, awards, invitation-only, placeholders, stale.';
