-- ACT payables triage — view + decision table for chewing through the
-- 359 stale bills sitting $641K overdue 60d+ on the sole trader's books.
--
-- v_act_payables_triage:
--   One row per AUTHORISED ACCPAY invoice, with age bucket
--   (this_week / 30d / 60d / 90d / 180d / over_180d), payee category,
--   project code, days outstanding.
--   Ordered by oldest first (longest outstanding shows up top).
--
-- act_payable_decisions:
--   Per-invoice decision: pay_now / scheduled / dispute / write_off /
--   chase_supplier / paid. Mirrors act_grant_recommendation_decisions
--   pattern. Drives a kanban-style triage page at /org/[slug]/payables.

-- Age buckets ordered: this_week (urgent), 30d, 60d, 90d, 180d, over_180d (write-off candidates)
CREATE OR REPLACE VIEW v_act_payables_triage AS
SELECT
  xi.id                                    AS invoice_id,
  xi.invoice_number,
  xi.contact_name                          AS payee_name,
  xi.project_code,
  xi.date                                  AS invoice_date,
  xi.due_date,
  xi.total::numeric,
  xi.amount_due::numeric,
  EXTRACT(DAY FROM (now() - xi.date::timestamptz))::integer  AS days_old,
  CASE
    WHEN xi.date >= (now() - INTERVAL '7 days')   THEN 'this_week'
    WHEN xi.date >= (now() - INTERVAL '30 days')  THEN 'within_30d'
    WHEN xi.date >= (now() - INTERVAL '60 days')  THEN '30_to_60d'
    WHEN xi.date >= (now() - INTERVAL '90 days')  THEN '60_to_90d'
    WHEN xi.date >= (now() - INTERVAL '180 days') THEN '90_to_180d'
    ELSE 'over_180d'
  END AS age_bucket,
  CASE
    WHEN lower(xi.contact_name) ~ 'defy|zinus|telford|tanner|crust mech|equipment|engineering' THEN 'manufacturing'
    WHEN lower(xi.contact_name) ~ 'bunnings|kennards|tradies|hardware|nuts and bolts|reece|mitre' THEN 'supplies'
    WHEN lower(xi.contact_name) ~ 'qantas|virgin|jetstar|airbnb|hotel|accommodation|hire car|avis|hertz' THEN 'travel'
    WHEN lower(xi.contact_name) ~ 'aws|google|github|notion|figma|adobe|slack|zoom|atlassian|cloudflare|vercel|openai|anthropic|sentry|datadog|portabl' THEN 'software'
    WHEN lower(xi.contact_name) ~ 'knight photography|consultancy|consulting|photography|advisor|coaching|design studio|imaging' THEN 'people_contractors'
    WHEN lower(xi.contact_name) ~ 'oonchiumpa|orange sky|aboriginal corp|community company|elders|streetsmart|sustainable table' THEN 'partner_orgs'
    WHEN lower(xi.contact_name) ~ 'stripe|paypal|wise|bank|nab\b|commonwealth|westpac\b|anz\b|ato\b|tax office' THEN 'banking_fees'
    WHEN lower(xi.contact_name) ~ 'energy|telstra|optus|water|electricity|gas\b|storage|rent|landlord|self storage' THEN 'utilities_property'
    WHEN lower(xi.contact_name) ~ 'insurance|legal|lawyer|solicitor|accountant|bookkeep|standard ledger|asic' THEN 'compliance'
    ELSE 'other'
  END AS payee_category,
  xi.reference
FROM xero_invoices xi
WHERE xi.type = 'ACCPAY'
  AND xi.status = 'AUTHORISED';

COMMENT ON VIEW v_act_payables_triage IS
  'One row per AUTHORISED ACCPAY with age bucket + category. Drives /org/[slug]/payables kanban.';

-- Decision states for the triage kanban
CREATE TABLE IF NOT EXISTS act_payable_decisions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES xero_invoices(id) ON DELETE CASCADE,
  decision    text NOT NULL,
  decided_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at  timestamptz NOT NULL DEFAULT now(),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT act_payable_decisions_invoice_unique UNIQUE (invoice_id),
  CONSTRAINT act_payable_decisions_decision_check CHECK (
    decision = ANY (ARRAY[
      'undecided',
      'pay_now',
      'scheduled',
      'dispute',
      'write_off',
      'chase_supplier',
      'paid'
    ])
  )
);

CREATE INDEX IF NOT EXISTS act_payable_decisions_decision_idx ON act_payable_decisions(decision);
CREATE INDEX IF NOT EXISTS act_payable_decisions_decided_at_idx ON act_payable_decisions(decided_at DESC);

COMMENT ON TABLE act_payable_decisions IS
  'Per-payable decision (pay_now/scheduled/dispute/write_off/chase_supplier/paid). One row per xero_invoice. Drives the payables kanban triage UI.';
