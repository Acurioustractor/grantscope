-- ACT income history — canonical views over xero_invoices
--
-- The full ACT book of business lives in xero_invoices (sole-trader ABN
-- 21591780066 = Nicholas Marchesi). funder_context_snapshot only covers
-- 7 of 34 actual counterparties — the other 27 (PICC, Ingkerreke, SMART
-- Recovery, etc) have never been surfaced anywhere in the UI.
--
-- These views are the single canonical lens for:
--   /org/act dashboard "Income History" section
--   org-income-service.ts getOrgIncomeHistory()
--   pipeline kanban Won column backfill
--   any future "what did ACT actually earn" question
--
-- Status semantics:
--   PAID                — money in the bank
--   AUTHORISED          — invoice sent, awaiting payment (an A/R asset)
--   DRAFT, SUBMITTED    — not yet sent; visible but not banked
--   VOIDED, DELETED     — excluded
--
-- Funder category derivation runs on contact_name patterns. Imperfect but
-- good enough as a default — manual override can land in a new
-- funder_category_overrides table later if it matters.

-- View 1: one row per income invoice, joined to context + categorisation
CREATE OR REPLACE VIEW v_act_income_history AS
SELECT
  xi.id                       AS invoice_id,
  xi.invoice_number,
  xi.contact_name             AS funder_name,
  xi.project_code,
  xi.date                     AS invoice_date,
  xi.due_date,
  xi.status,
  xi.total::numeric,
  xi.amount_paid::numeric,
  xi.amount_due::numeric,
  xi.currency_code,
  xi.reference,
  -- Days since the invoice was sent (only meaningful for AUTHORISED)
  CASE
    WHEN xi.status = 'AUTHORISED' AND xi.date IS NOT NULL
      THEN EXTRACT(DAY FROM (now() - xi.date::timestamptz))::integer
    ELSE NULL
  END AS days_outstanding,
  -- Funder category from name patterns (PostgreSQL POSIX uses \y not \b for word boundaries)
  CASE
    -- Aboriginal corporations + community-controlled organisations first (more specific)
    WHEN lower(xi.contact_name) ~ 'aboriginal corp|aboriginal council|community company|picc|elders-in-council|julalikari|ingkerreke|mala''la|minjerribah|homeland' THEN 'community_controlled'
    -- Government (departments, states, ministries)
    WHEN lower(xi.contact_name) ~ 'department of|state of|ministry|niaa|nih |government' THEN 'government'
    -- Philanthropic (foundation, trust, forum, philanthropy)
    WHEN lower(xi.contact_name) ~ 'foundation|trust|forum|philanth' THEN 'philanthropic'
    -- Civil society (rotary, school, association, society — but not "limited"/"pty ltd")
    WHEN lower(xi.contact_name) ~ 'rotary|streetsmart|red dust|smart recovery|reinvest' THEN 'civil_society'
    -- Commercial (pty ltd, gmbh, limited, inc, fitness)
    WHEN lower(xi.contact_name) ~ 'pty ltd|gmbh|limited|\binc\b|\bltd\b|fitness|studio|properties|obsession|powerhouse|bigmeats|qic' THEN 'commercial'
    ELSE 'other'
  END AS funder_category,
  fcs.relationship_score,
  fcs.foundation_id,
  fcs.abn                     AS funder_abn,
  fcs.contacts_count,
  fcs.most_recent_contact_at
FROM xero_invoices xi
LEFT JOIN funder_context_snapshot fcs
  ON lower(fcs.funder_name) = lower(xi.contact_name)
  OR xi.contact_name = ANY(COALESCE(fcs.funder_aliases, ARRAY[]::text[]))
WHERE xi.type = 'ACCREC'
  AND xi.status IN ('PAID', 'AUTHORISED', 'DRAFT', 'SUBMITTED');

COMMENT ON VIEW v_act_income_history IS
  'One row per ACCREC invoice (PAID/AUTHORISED/DRAFT/SUBMITTED) joined to funder_context_snapshot + funder_category. Canonical income lens for /org/act.';

-- View 2: per-funder aggregate (the dashboard top-of-page summary)
CREATE OR REPLACE VIEW v_act_income_by_funder AS
SELECT
  funder_name,
  funder_category,
  relationship_score,
  COUNT(*) FILTER (WHERE status = 'PAID')        AS paid_invoice_count,
  COUNT(*) FILTER (WHERE status = 'AUTHORISED')  AS auth_invoice_count,
  COUNT(*) FILTER (WHERE status = 'DRAFT')       AS draft_invoice_count,
  ROUND(SUM(total) FILTER (WHERE status = 'PAID'), 0)::numeric        AS paid_total,
  ROUND(SUM(total) FILTER (WHERE status = 'AUTHORISED'), 0)::numeric  AS auth_total,
  ROUND(SUM(total) FILTER (WHERE status = 'DRAFT'), 0)::numeric       AS draft_total,
  MIN(invoice_date) FILTER (WHERE status = 'PAID')   AS first_paid_date,
  MAX(invoice_date) FILTER (WHERE status = 'PAID')   AS last_paid_date,
  array_agg(DISTINCT project_code ORDER BY project_code) FILTER (WHERE project_code IS NOT NULL AND project_code != '') AS project_codes,
  MAX(days_outstanding) FILTER (WHERE status = 'AUTHORISED') AS longest_outstanding_days
FROM v_act_income_history
GROUP BY 1, 2, 3;

COMMENT ON VIEW v_act_income_by_funder IS
  'Per-funder lifetime totals (paid/auth/draft) with project mix and outstanding days. Drives the Income History table on /org/act.';

-- View 3: per-project aggregate (the "where did money flow" lens)
CREATE OR REPLACE VIEW v_act_income_by_project AS
SELECT
  project_code,
  COUNT(*) FILTER (WHERE status = 'PAID')        AS paid_invoice_count,
  ROUND(SUM(total) FILTER (WHERE status = 'PAID'), 0)::numeric  AS paid_total,
  ROUND(SUM(total) FILTER (WHERE status = 'AUTHORISED'), 0)::numeric  AS auth_total,
  ROUND(SUM(total) FILTER (WHERE status = 'DRAFT'), 0)::numeric  AS draft_total,
  COUNT(DISTINCT funder_name) AS distinct_funders,
  MIN(invoice_date) FILTER (WHERE status = 'PAID')   AS first_paid_date,
  MAX(invoice_date) FILTER (WHERE status = 'PAID')   AS last_paid_date
FROM v_act_income_history
WHERE project_code IS NOT NULL AND project_code != ''
GROUP BY 1;

COMMENT ON VIEW v_act_income_by_project IS
  'Per-project lifetime income totals. Drives the project-cards income overlay on /org/act.';
