-- Bulk insert crossover alerts for all contracts >= $100K
-- where supplier ABN matches a political donor ABN
-- Skip contracts that already have alerts
SET statement_timeout = '600s';

INSERT INTO procurement_alerts (alert_type, severity, status, title, body, payload)
SELECT
  'donor_contract_crossover',
  CASE
    WHEN c.contract_value > 10000000 THEN 'critical'
    WHEN c.contract_value > 1000000 THEN 'high'
    ELSE 'medium'
  END,
  'unread',
  'Donor-contractor crossover: ' || c.supplier_name,
  'Won $' || TO_CHAR(c.contract_value, 'FM999,999,999,999') || ' contract from ' || c.buyer_name || '. ' ||
  'Has donated $' || TO_CHAR(d.total_donated, 'FM999,999,999,999') || ' across ' || d.donation_count || ' donation records.',
  jsonb_build_object(
    'contract_id', c.id,
    'contract_value', c.contract_value,
    'buyer_name', c.buyer_name,
    'supplier_abn', c.supplier_abn,
    'supplier_name', c.supplier_name,
    'total_donated', d.total_donated,
    'donation_count', d.donation_count,
    'category', c.category
  )
FROM austender_contracts c
JOIN (
  SELECT donor_abn, SUM(amount) as total_donated, COUNT(*) as donation_count
  FROM political_donations
  WHERE donor_abn IS NOT NULL AND donor_abn != ''
  GROUP BY donor_abn
) d ON d.donor_abn = c.supplier_abn
WHERE c.supplier_abn IS NOT NULL
  AND c.contract_value >= 100000
  AND NOT EXISTS (
    SELECT 1 FROM procurement_alerts pa
    WHERE pa.alert_type = 'donor_contract_crossover'
      AND pa.payload->>'contract_id' = c.id::text
  );

RESET statement_timeout;
