-- ACT financial pulse — single-row view combining cash position, burn rate,
-- runway, and outstanding A/R + A/P. Drives the top-of-dashboard tile.
--
-- Cash: sum of active ACT-named bank accounts (T/as ACT Everyday, ACT
-- Maximiser, ACT credit card). Excludes "Personal" accounts.
--
-- Burn: average of last 90 days of paid expenses (ACCPAY), projected monthly.
-- Runway: cash / monthly_burn (capped display at 99 months).
--
-- Outstanding A/R: sum of AUTHORISED ACCREC (invoices sent, awaiting payment).
-- Outstanding A/P: sum of AUTHORISED ACCPAY (bills approved, awaiting payment).
-- Overdue 60d+: subset of both, useful for "what needs chasing now".

CREATE OR REPLACE VIEW v_act_financial_pulse AS
WITH cash AS (
  SELECT
    ROUND(SUM(current_balance), 0)::numeric AS cash_total,
    COUNT(*) AS account_count,
    MAX(balance_updated_at) AS last_balance_sync
  FROM xero_bank_accounts
  WHERE status = 'ACTIVE'
    AND (lower(name) LIKE '%act %' OR lower(name) LIKE '%t/as act%')
    AND lower(name) NOT LIKE '%personal%'
), burn_90d AS (
  SELECT
    COALESCE(ROUND(SUM(total) FILTER (WHERE date >= (now() - INTERVAL '90 days')), 0), 0)::numeric AS expense_90d,
    COALESCE(ROUND(SUM(total) FILTER (WHERE date >= (now() - INTERVAL '30 days')), 0), 0)::numeric AS expense_30d,
    COUNT(*) FILTER (WHERE date >= (now() - INTERVAL '90 days')) AS bills_90d
  FROM xero_invoices
  WHERE type = 'ACCPAY' AND status = 'PAID'
), income_30d AS (
  SELECT
    COALESCE(ROUND(SUM(total) FILTER (WHERE date >= (now() - INTERVAL '30 days')), 0), 0)::numeric AS income_30d,
    COALESCE(ROUND(SUM(total) FILTER (WHERE date >= (now() - INTERVAL '90 days')), 0), 0)::numeric AS income_90d
  FROM xero_invoices
  WHERE type = 'ACCREC' AND status = 'PAID'
), ar_outstanding AS (
  SELECT
    COALESCE(ROUND(SUM(total), 0), 0)::numeric AS ar_total,
    COUNT(*) AS ar_count,
    COALESCE(ROUND(SUM(total) FILTER (WHERE date < (now() - INTERVAL '60 days')), 0), 0)::numeric AS ar_overdue_60d,
    COUNT(*) FILTER (WHERE date < (now() - INTERVAL '60 days')) AS ar_overdue_60d_count
  FROM xero_invoices
  WHERE type = 'ACCREC' AND status = 'AUTHORISED'
), ap_outstanding AS (
  SELECT
    COALESCE(ROUND(SUM(total), 0), 0)::numeric AS ap_total,
    COUNT(*) AS ap_count,
    COALESCE(ROUND(SUM(total) FILTER (WHERE date < (now() - INTERVAL '60 days')), 0), 0)::numeric AS ap_overdue_60d,
    COUNT(*) FILTER (WHERE date < (now() - INTERVAL '60 days')) AS ap_overdue_60d_count
  FROM xero_invoices
  WHERE type = 'ACCPAY' AND status = 'AUTHORISED'
)
SELECT
  c.cash_total,
  c.account_count,
  c.last_balance_sync,
  b.expense_30d AS burn_30d,
  b.expense_90d AS burn_90d,
  ROUND(b.expense_90d / 3.0, 0)::numeric AS monthly_burn_avg,
  i.income_30d,
  i.income_90d,
  ROUND(i.income_90d / 3.0, 0)::numeric AS monthly_income_avg,
  (i.income_30d - b.expense_30d)::numeric AS net_30d,
  ROUND((i.income_90d - b.expense_90d) / 3.0, 0)::numeric AS monthly_net_avg,
  CASE
    WHEN b.expense_90d <= 0 THEN NULL
    ELSE ROUND(c.cash_total / NULLIF(b.expense_90d / 3.0, 0), 1)::numeric
  END AS runway_months,
  ar.ar_total,
  ar.ar_count,
  ar.ar_overdue_60d,
  ar.ar_overdue_60d_count,
  ap.ap_total,
  ap.ap_count,
  ap.ap_overdue_60d,
  ap.ap_overdue_60d_count,
  -- Working capital = cash + A/R - A/P (the headline solvency metric)
  (c.cash_total + ar.ar_total - ap.ap_total)::numeric AS working_capital,
  now() AS computed_at
FROM cash c, burn_90d b, income_30d i, ar_outstanding ar, ap_outstanding ap;

COMMENT ON VIEW v_act_financial_pulse IS
  'Single-row financial snapshot for ACT: cash, burn, runway, A/R, A/P, working capital. Drives the top-of-dashboard pulse tile.';
