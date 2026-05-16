-- ACT expense history — canonical views over xero_invoices ACCPAY
--
-- Mirror of v_act_income_* but for outflows. 1,973 supplier bills, 559
-- distinct payees, $903K paid lifetime under the sole-trader Xero. Completes
-- the financial picture started by 20260516000020_act_income_history_views.sql.
--
-- Payee category derivation runs on name patterns. Imperfect but useful as
-- a default split for the dashboard — manual override can land in a
-- payee_category_overrides table later if needed.

-- View 1: one row per ACCPAY invoice with category + project + payment status
CREATE OR REPLACE VIEW v_act_expense_history AS
SELECT
  xi.id                       AS invoice_id,
  xi.invoice_number,
  xi.contact_name             AS payee_name,
  xi.project_code,
  xi.date                     AS invoice_date,
  xi.due_date,
  xi.status,
  xi.total::numeric,
  xi.amount_paid::numeric,
  xi.amount_due::numeric,
  xi.reference,
  CASE
    WHEN xi.status = 'AUTHORISED' AND xi.date IS NOT NULL
      THEN EXTRACT(DAY FROM (now() - xi.date::timestamptz))::integer
    ELSE NULL
  END AS days_outstanding,
  CASE
    -- Manufacturing + materials (Goods supply chain)
    WHEN lower(xi.contact_name) ~ 'defy|zinus|telford|tanner|crust mech|equipment|engineering' THEN 'manufacturing'
    -- Hardware + supplies
    WHEN lower(xi.contact_name) ~ 'bunnings|kennards|tradies|hardware|nuts and bolts|reece|mitre' THEN 'supplies'
    -- Travel + accommodation
    WHEN lower(xi.contact_name) ~ 'qantas|virgin|jetstar|airbnb|hotel|accommodation|hire car|avis|hertz' THEN 'travel'
    -- Software + tools + tech services
    WHEN lower(xi.contact_name) ~ 'aws|google|github|notion|figma|adobe|slack|zoom|atlassian|cloudflare|vercel|openai|anthropic|sentry|datadog|portabl' THEN 'software'
    -- People (consultants, contractors, photographers)
    WHEN lower(xi.contact_name) ~ 'knight photography|consultancy|consulting|photography|advisor|coaching|design studio|imaging' THEN 'people_contractors'
    -- Partner orgs (Aboriginal corps, social enterprises ACT collaborates with)
    WHEN lower(xi.contact_name) ~ 'oonchiumpa|orange sky|aboriginal corp|community company|elders|streetsmart|sustainable table' THEN 'partner_orgs'
    -- Banking / fees / tax
    WHEN lower(xi.contact_name) ~ 'stripe|paypal|wise|bank|nab\b|commonwealth|westpac\b|anz\b|ato\b|tax office' THEN 'banking_fees'
    -- Utilities + storage + property
    WHEN lower(xi.contact_name) ~ 'energy|telstra|optus|water|electricity|gas\b|storage|rent|landlord|self storage' THEN 'utilities_property'
    -- Insurance + legal + compliance
    WHEN lower(xi.contact_name) ~ 'insurance|legal|lawyer|solicitor|accountant|bookkeep|standard ledger|asic' THEN 'compliance'
    ELSE 'other'
  END AS payee_category
FROM xero_invoices xi
WHERE xi.type = 'ACCPAY'
  AND xi.status IN ('PAID', 'AUTHORISED', 'DRAFT', 'SUBMITTED');

COMMENT ON VIEW v_act_expense_history IS
  'One row per ACCPAY invoice with payee_category derivation. Mirror of v_act_income_history for outflows.';

-- View 2: per-payee lifetime aggregate
CREATE OR REPLACE VIEW v_act_expense_by_payee AS
SELECT
  payee_name,
  payee_category,
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
FROM v_act_expense_history
GROUP BY 1, 2;

COMMENT ON VIEW v_act_expense_by_payee IS
  'Per-payee lifetime totals + category + project mix. Drives the Expense History table on /org/act.';

-- View 3: per-project expense aggregate
CREATE OR REPLACE VIEW v_act_expense_by_project AS
SELECT
  project_code,
  COUNT(*) FILTER (WHERE status = 'PAID')        AS paid_invoice_count,
  ROUND(SUM(total) FILTER (WHERE status = 'PAID'), 0)::numeric  AS paid_total,
  ROUND(SUM(total) FILTER (WHERE status = 'AUTHORISED'), 0)::numeric AS auth_total,
  ROUND(SUM(total) FILTER (WHERE status = 'DRAFT'), 0)::numeric AS draft_total,
  COUNT(DISTINCT payee_name) AS distinct_payees,
  MIN(invoice_date) FILTER (WHERE status = 'PAID')   AS first_paid_date,
  MAX(invoice_date) FILTER (WHERE status = 'PAID')   AS last_paid_date
FROM v_act_expense_history
WHERE project_code IS NOT NULL AND project_code != ''
GROUP BY 1;

COMMENT ON VIEW v_act_expense_by_project IS
  'Per-project lifetime expense totals. Pairs with v_act_income_by_project for net-position per project.';
