-- Function to return timing window summary without loading all 189K rows
CREATE OR REPLACE FUNCTION get_timing_windows()
RETURNS TABLE (
  timing_window TEXT,
  match_count BIGINT,
  entity_count BIGINT,
  contract_value NUMERIC
) LANGUAGE SQL STABLE AS $$
  SELECT
    timing_window,
    COUNT(*) as match_count,
    COUNT(DISTINCT abn) as entity_count,
    SUM(contract_value) as contract_value
  FROM mv_donation_contract_timing
  GROUP BY timing_window
  ORDER BY CASE timing_window
    WHEN 'immediate' THEN 1
    WHEN 'short' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'long' THEN 4
    ELSE 5
  END;
$$;
