-- ACT people — single canonical view unioning the three places people show up:
--   1. gs_entities — Marchesi family (founders, governance)
--   2. xero_invoices ACCPAY — contractors / photographers / individuals ACT pays
--   3. ghl_contacts — warm network tagged with ACT/justicehub/goods
--
-- One row per person (best-effort dedup on lowered name). Source-attributed
-- so the dashboard can show "team / contractors / network" buckets.
--
-- person_category derivation:
--   family       — gs_entities entry with Marchesi surname
--   contractor   — Xero payee with non-org name pattern + paid_total > 0
--   network      — ghl_contacts only (no xero payment)
--   contact      — has both ghl + xero (the relationship overlap is meaningful)

CREATE OR REPLACE VIEW v_act_people AS
WITH xero_people AS (
  -- Heuristic: contact_name looks like a person if it doesn't contain
  -- obvious org tokens. Imperfect but catches the clear cases (Knight
  -- Photography, R M Tanner, Aleisha Keating, Jenn Brazier, etc).
  SELECT
    contact_name AS person_name,
    SUM(total) FILTER (WHERE status = 'PAID')::numeric AS paid_total,
    COUNT(*) FILTER (WHERE status = 'PAID') AS paid_invoice_count,
    MAX(date) FILTER (WHERE status = 'PAID') AS last_paid_date,
    array_agg(DISTINCT project_code ORDER BY project_code) FILTER (WHERE project_code IS NOT NULL AND project_code != '') AS xero_project_codes
  FROM xero_invoices
  WHERE type = 'ACCPAY'
    AND contact_name IS NOT NULL
    AND lower(contact_name) !~ 'pty|ltd|limited|\binc\b|foundation|group|company|corporation|qantas|virgin|bunnings|kennards|bank|council|services|warehouse|trust|gmbh|hire|insurance|systems|hardware|fitness|studio|properties|obsession|powerhouse|bigmeats|qic|university|college|institute|department|trustee|airbnb|engineering|equipment|imaging|station|aboriginal corp|reserve|defy|zinus|washer|telford|orange sky|portabl|sunshine glamping|crust mech|telstra|optus|airtable|notion|google|cloudflare|adobe|figma|stripe|paypal'
  GROUP BY 1
  HAVING SUM(total) FILTER (WHERE status = 'PAID') > 0
), ghl_people_raw AS (
  SELECT
    COALESCE(full_name, TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) AS person_name,
    email,
    company_name,
    tags,
    last_contact_date,
    first_contact_date,
    engagement_status,
    is_storyteller,
    is_elder
  FROM ghl_contacts
  WHERE COALESCE(full_name, first_name, last_name) IS NOT NULL
    AND (
      tags::text ILIKE '%act%'
      OR tags::text ILIKE '%justicehub%'
      OR tags::text ILIKE '%goods%'
      OR tags::text ILIKE '%harvest%'
      OR tags::text ILIKE '%empathy%'
    )
), ghl_people AS (
  -- Dedupe by lowercased name — same person can have multiple GHL rows
  -- (e.g. multiple tag combinations). Pick the most-recent contact_date row.
  SELECT DISTINCT ON (lower(person_name))
    person_name, email, company_name, tags,
    last_contact_date, first_contact_date, engagement_status,
    is_storyteller, is_elder
  FROM ghl_people_raw
  WHERE person_name IS NOT NULL AND person_name != ''
  ORDER BY lower(person_name), last_contact_date DESC NULLS LAST
), family AS (
  SELECT
    canonical_name AS person_name,
    gs_id
  FROM gs_entities
  WHERE entity_type = 'person'
    AND canonical_name ~* '\ymarchesi'
)
SELECT
  COALESCE(xp.person_name, gp.person_name, f.person_name) AS person_name,
  CASE
    WHEN f.gs_id IS NOT NULL THEN 'family'
    WHEN xp.paid_total > 0 AND gp.email IS NOT NULL THEN 'contact'
    WHEN xp.paid_total > 0 THEN 'contractor'
    ELSE 'network'
  END AS person_category,
  -- Sources combined as a comma-list, e.g. "xero,ghl,family"
  array_to_string(
    ARRAY_REMOVE(ARRAY[
      CASE WHEN xp.person_name IS NOT NULL THEN 'xero' END,
      CASE WHEN gp.person_name IS NOT NULL THEN 'ghl' END,
      CASE WHEN f.gs_id IS NOT NULL THEN 'gs_entity' END
    ], NULL),
    ','
  ) AS sources,
  COALESCE(xp.paid_total, 0)::numeric AS paid_total,
  COALESCE(xp.paid_invoice_count, 0) AS paid_invoice_count,
  xp.last_paid_date,
  xp.xero_project_codes,
  gp.email,
  gp.company_name,
  gp.tags,
  gp.last_contact_date,
  gp.first_contact_date,
  gp.engagement_status,
  COALESCE(gp.is_storyteller, false) AS is_storyteller,
  COALESCE(gp.is_elder, false) AS is_elder,
  f.gs_id
FROM ghl_people gp
FULL OUTER JOIN xero_people xp ON lower(xp.person_name) = lower(gp.person_name)
FULL OUTER JOIN family f ON lower(f.person_name) = lower(COALESCE(xp.person_name, gp.person_name))
WHERE COALESCE(xp.person_name, gp.person_name, f.person_name) IS NOT NULL;

COMMENT ON VIEW v_act_people IS
  'One row per ACT-adjacent person from Xero ACCPAY (contractors), GHL (network), gs_entities (Marchesi family). Drives the People section on /org/act.';
