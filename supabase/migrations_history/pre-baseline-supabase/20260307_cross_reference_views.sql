-- Cross-reference views for connecting AusTender, ACNC, ORIC, and ATO datasets
-- These power the /reports/cross-reference page with live data

-- 1. Summary by entity type (charity, indigenous corp, other)
CREATE OR REPLACE VIEW v_austender_entity_summary AS
SELECT
  CASE
    WHEN c.abn IS NOT NULL THEN 'Charity'
    WHEN o.abn IS NOT NULL THEN 'Indigenous Corp'
    ELSE 'Corporate/Other'
  END as entity_type,
  count(*) as contracts,
  round(sum(a.value_amount)) as total_value
FROM austender_contracts a
LEFT JOIN acnc_charities c ON a.supplier_abn = c.abn
LEFT JOIN oric_corporations o ON a.supplier_abn = o.abn
WHERE a.supplier_abn IS NOT NULL AND a.value_amount IS NOT NULL
GROUP BY entity_type
ORDER BY total_value DESC;

-- 2. Procurement method breakdown by entity type
CREATE OR REPLACE VIEW v_austender_procurement_by_type AS
SELECT
  CASE
    WHEN c.abn IS NOT NULL THEN 'Charity'
    WHEN o.abn IS NOT NULL THEN 'Indigenous Corp'
    ELSE 'Corporate/Other'
  END as entity_type,
  a.procurement_method,
  count(*) as contracts,
  round(sum(a.value_amount)) as total_value
FROM austender_contracts a
LEFT JOIN acnc_charities c ON a.supplier_abn = c.abn
LEFT JOIN oric_corporations o ON a.supplier_abn = o.abn
WHERE a.supplier_abn IS NOT NULL AND a.value_amount IS NOT NULL
GROUP BY entity_type, a.procurement_method
ORDER BY entity_type, total_value DESC;

-- 3. Top charities by government contract value
CREATE OR REPLACE VIEW v_austender_top_charities AS
SELECT
  c.charity_name as name,
  c.abn,
  count(a.id) as contracts,
  round(sum(a.value_amount)) as total_value
FROM austender_contracts a
JOIN acnc_charities c ON a.supplier_abn = c.abn
WHERE a.supplier_abn IS NOT NULL AND a.value_amount IS NOT NULL
GROUP BY c.charity_name, c.abn
ORDER BY total_value DESC
LIMIT 25;

-- 4. Top indigenous corporations by government contract value
CREATE OR REPLACE VIEW v_austender_top_oric AS
SELECT
  o.name,
  o.abn,
  o.state,
  count(a.id) as contracts,
  round(sum(a.value_amount)) as total_value
FROM austender_contracts a
JOIN oric_corporations o ON a.supplier_abn = o.abn
WHERE a.supplier_abn IS NOT NULL AND o.abn IS NOT NULL AND a.value_amount IS NOT NULL
GROUP BY o.name, o.abn, o.state
ORDER BY total_value DESC
LIMIT 25;

-- 5. Top government suppliers cross-referenced with ATO tax data
CREATE OR REPLACE VIEW v_austender_supplier_tax AS
WITH top_suppliers AS (
  SELECT
    supplier_name,
    supplier_abn,
    count(*) as contracts,
    round(sum(value_amount)) as govt_value
  FROM austender_contracts
  WHERE value_amount IS NOT NULL AND supplier_abn IS NOT NULL
  GROUP BY supplier_name, supplier_abn
  ORDER BY govt_value DESC
  LIMIT 50
)
SELECT
  ts.supplier_name,
  ts.supplier_abn,
  ts.contracts,
  ts.govt_value,
  ato.entity_name,
  ato.total_income,
  ato.taxable_income,
  ato.tax_payable,
  ato.report_year,
  CASE
    WHEN ato.total_income > 0 THEN round((ato.tax_payable::numeric / ato.total_income::numeric) * 100, 2)
    ELSE 0
  END as effective_rate
FROM top_suppliers ts
INNER JOIN ato_tax_transparency ato ON ts.supplier_abn = ato.abn
WHERE ato.report_year IN ('2022-23', '2023-24')
ORDER BY ts.govt_value DESC;

-- 6. Australia's largest entities by income with effective tax rate
CREATE OR REPLACE VIEW v_ato_largest_entities AS
SELECT
  entity_name,
  total_income,
  taxable_income,
  tax_payable,
  report_year,
  CASE
    WHEN total_income > 0 THEN round((tax_payable::numeric / total_income::numeric) * 100, 2)
    ELSE 0
  END as effective_rate
FROM ato_tax_transparency
WHERE report_year = '2022-23' AND total_income > 1000000000
ORDER BY total_income DESC
LIMIT 30;

-- 7. AusTender overall stats
CREATE OR REPLACE VIEW v_austender_stats AS
SELECT
  count(*) as total_contracts,
  round(sum(value_amount)) as total_value,
  count(DISTINCT supplier_abn) as unique_suppliers,
  count(*) FILTER (WHERE supplier_abn IS NOT NULL) as contracts_with_abn
FROM austender_contracts
WHERE value_amount IS NOT NULL;
