-- Wave A: opportunity_type backfill on org_pipeline
-- 2026-05-22 — classify each pipeline row by inferred type so the grant kanban
-- stops conflating revenue streams + foundation watchlist + grants.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 0. Expand the opportunity_type CHECK constraint
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE org_pipeline DROP CONSTRAINT IF EXISTS org_pipeline_opportunity_type_check;
ALTER TABLE org_pipeline ADD CONSTRAINT org_pipeline_opportunity_type_check CHECK (
  opportunity_type IN (
    'grant','foundation','procurement','partnership','capital',
    'revenue_stream','certification','scholarship'
  )
);

-- ─────────────────────────────────────────────────────────────────────
-- 1. REVENUE_STREAM — earned revenue (Farm/Harvest products, services)
-- Signal: funder is a customer/audience descriptor OR null + name suggests product/service
-- ─────────────────────────────────────────────────────────────────────
UPDATE org_pipeline SET
  opportunity_type = 'revenue_stream',
  notes = COALESCE(notes,'') || E'\n[auto-typed revenue_stream · 2026-05-22]',
  updated_at = now()
WHERE opportunity_type = 'grant'  -- default we set in the migration
  AND status IN ('prospect','upcoming')
  AND (
    -- Customer/audience-style funder values
    lower(coalesce(funder,'')) ~ '\m(customers?|guests?|diners?|students?|market customers|event clients|visitors|workshop participants|retreat guests|schools? / corporates|independent retailers|wwoof australia|gardeners? / farmers?|carbon market|seller listings|local community members|nq hotels|nq restaurants|reef tourism)\M'
    OR (
      funder IS NULL AND
      lower(name) ~ '\m(cafe|restaurant|cooking|workshop|retreat|farmstay|farmers market|cabin|glamping|gallery|exhibition|wedding|yoga|seed library|pdc|certificate course|paddock|farm walk|farm experience|nature play|holiday program|venue|festival|tour|hosting program|csa share|marketplace transaction|carbon credit|supply partnership|guided)\M'
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 2. FOUNDATION — relationship target, no live application
-- Signal: name == funder (or one is substring of the other) AND no deadline
-- ─────────────────────────────────────────────────────────────────────
UPDATE org_pipeline SET
  opportunity_type = 'foundation',
  notes = COALESCE(notes,'') || E'\n[auto-typed foundation · 2026-05-22]',
  updated_at = now()
WHERE opportunity_type = 'grant'
  AND deadline IS NULL
  AND funder IS NOT NULL
  AND (
    lower(name) = lower(funder)
    OR (lower(funder) LIKE '%foundation%' AND lower(name) LIKE '%' || lower(funder) || '%' )
    OR (lower(name) LIKE '%foundation%' AND lower(name) LIKE '%' || lower(funder) || '%' )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 3. CERTIFICATION — membership/accreditation
-- ─────────────────────────────────────────────────────────────────────
UPDATE org_pipeline SET
  opportunity_type = 'certification',
  notes = COALESCE(notes,'') || E'\n[auto-typed certification · 2026-05-22]',
  updated_at = now()
WHERE opportunity_type = 'grant'
  AND lower(name) ~ '\m(certification|accreditation|membership)\M';

-- ─────────────────────────────────────────────────────────────────────
-- 4. PARTNERSHIP — strategic collab (Social Traders, Supply Nation as relationships)
-- ─────────────────────────────────────────────────────────────────────
UPDATE org_pipeline SET
  opportunity_type = 'partnership',
  notes = COALESCE(notes,'') || E'\n[auto-typed partnership · 2026-05-22]',
  updated_at = now()
WHERE opportunity_type = 'grant'
  AND lower(name) ~ '\m(supply nation|social traders|partnership|integration|marketplace integration)\M'
  AND opportunity_type != 'certification';  -- don't override

-- ─────────────────────────────────────────────────────────────────────
-- 5. Everything else remains 'grant' (or NULL if column missing pre-migration)
-- ─────────────────────────────────────────────────────────────────────
UPDATE org_pipeline SET opportunity_type = 'grant'
WHERE opportunity_type IS NULL;

-- Summary
SELECT opportunity_type, COUNT(*) AS rows
FROM org_pipeline
GROUP BY 1
ORDER BY 2 DESC;

COMMIT;
