-- Backfill funder_context_snapshot with every distinct Xero ACCREC contact
-- that doesn't already have a row. Today only 7 of 34 actual ACT payers
-- have a context snapshot — extending it so PICC, Ingkerreke, SMART Recovery
-- and the other 20 surface in v_act_income_history + the dashboard.
--
-- Relationship_score computed from Xero alone (no foundations/ACNC/GHL
-- data for these counterparties): +30 if paid > $50K, +20 if paid > $10K,
-- +10 if paid > $0, +10 if has authorised, +5 if last paid < 90d. Caps at 65.
--
-- refresh-funder-context.mjs (the nightly script) will eventually fold this
-- logic in. For now this is a one-shot manual backfill.

WITH xero_income AS (
  SELECT
    contact_name AS funder_name,
    COUNT(*) FILTER (WHERE status='PAID') AS paid_count,
    COALESCE(ROUND(SUM(total) FILTER (WHERE status='PAID'), 2), 0)::numeric AS paid_total,
    COALESCE(ROUND(SUM(total) FILTER (WHERE status='AUTHORISED'), 2), 0)::numeric AS auth_total,
    MAX(date) FILTER (WHERE status='PAID') AS last_paid_date,
    MAX(date) FILTER (WHERE status='AUTHORISED') AS last_auth_date
  FROM xero_invoices
  WHERE type='ACCREC'
  GROUP BY 1
), scored AS (
  SELECT
    funder_name,
    paid_total,
    auth_total,
    last_paid_date,
    last_auth_date,
    LEAST(
      65,
      CASE WHEN paid_total > 50000 THEN 30
           WHEN paid_total > 10000 THEN 20
           WHEN paid_total > 0     THEN 10
           ELSE 0 END
      + CASE WHEN auth_total > 0 THEN 10 ELSE 0 END
      + CASE WHEN last_paid_date IS NOT NULL
                  AND last_paid_date >= (CURRENT_DATE - INTERVAL '90 days')
             THEN 5 ELSE 0 END
    )::integer AS score
  FROM xero_income
)
INSERT INTO funder_context_snapshot (
  funder_name,
  funder_aliases,
  xero_paid_total,
  xero_authorised_total,
  xero_last_payment_date,
  xero_last_invoice_date,
  contacts_count,
  grantee_count,
  total_decisions,
  decisions,
  email_count,
  relationship_score,
  refreshed_at
)
SELECT
  s.funder_name,
  ARRAY[]::text[],
  s.paid_total,
  s.auth_total,
  s.last_paid_date,
  s.last_auth_date,
  0,
  0,
  0,
  '{}'::jsonb,
  0,
  s.score,
  now()
FROM scored s
ON CONFLICT (funder_name) DO UPDATE SET
  xero_paid_total = EXCLUDED.xero_paid_total,
  xero_authorised_total = EXCLUDED.xero_authorised_total,
  xero_last_payment_date = EXCLUDED.xero_last_payment_date,
  xero_last_invoice_date = EXCLUDED.xero_last_invoice_date,
  relationship_score = GREATEST(funder_context_snapshot.relationship_score, EXCLUDED.relationship_score),
  refreshed_at = now();
