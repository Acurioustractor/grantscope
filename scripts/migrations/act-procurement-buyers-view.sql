-- Procurement Buyers View
-- 2026-05-22 — aggregates austender_contracts into ACT-relevant buyer prospects
-- Surfaces government buyers who procure the kind of work ACT delivers (data,
-- intelligence, evaluation, evidence, storytelling, community engagement).

BEGIN;

DROP VIEW IF EXISTS v_act_procurement_buyers CASCADE;

CREATE VIEW v_act_procurement_buyers AS
WITH relevant_contracts AS (
  SELECT
    buyer_name,
    contract_value,
    title,
    description,
    contract_start,
    contract_end,
    date_published,
    category,
    procurement_method,
    -- Score keywords found in this contract — used both for scoring and
    -- "why this matters" labels in the UI.
    (
      (CASE WHEN lower(title || ' ' || coalesce(description,'')) ~ '\m(data|analytics|dashboard|intelligence|reporting)\M' THEN 1 ELSE 0 END) +
      (CASE WHEN lower(title || ' ' || coalesce(description,'')) ~ '\m(evaluation|impact assessment|monitoring|measurement)\M' THEN 1 ELSE 0 END) +
      (CASE WHEN lower(title || ' ' || coalesce(description,'')) ~ '\m(research|evidence|study|review|scoping)\M' THEN 1 ELSE 0 END) +
      (CASE WHEN lower(title || ' ' || coalesce(description,'')) ~ '\m(mapping|gis|spatial|geo)\M' THEN 1 ELSE 0 END) +
      (CASE WHEN lower(title || ' ' || coalesce(description,'')) ~ '\m(consultation|engagement|community-led|co-design)\M' THEN 1 ELSE 0 END) +
      (CASE WHEN lower(title || ' ' || coalesce(description,'')) ~ '\m(storytelling|narrative|communications|content)\M' THEN 1 ELSE 0 END) +
      (CASE WHEN lower(title || ' ' || coalesce(description,'')) ~ '\m(indigenous|first nations|aboriginal|torres strait)\M' THEN 1 ELSE 0 END)
    ) AS topic_score
  FROM austender_contracts
  WHERE
    buyer_name IS NOT NULL
    AND contract_value >= 25000
    AND date_published >= CURRENT_DATE - INTERVAL '3 years'
    AND lower(title || ' ' || coalesce(description,'')) ~
      '\m(data|analytics|dashboard|intelligence|reporting|evaluation|impact assessment|monitoring|measurement|research|evidence|study|review|scoping|mapping|gis|spatial|geo|consultation|engagement|community-led|co-design|storytelling|narrative|communications|content|indigenous|first nations|aboriginal|torres strait)\M'
)
SELECT
  buyer_name,
  COUNT(*) AS contract_count,
  SUM(contract_value)::numeric(14,2) AS total_relevant_spend,
  AVG(contract_value)::numeric(14,2) AS avg_contract_value,
  MAX(contract_value)::numeric(14,2) AS max_contract_value,
  MIN(contract_value)::numeric(14,2) AS min_contract_value,
  MAX(date_published) AS most_recent_contract,
  COUNT(*) FILTER (WHERE date_published >= CURRENT_DATE - INTERVAL '1 year') AS contracts_last_year,
  COUNT(*) FILTER (WHERE date_published >= CURRENT_DATE - INTERVAL '6 months') AS contracts_last_6mo,
  AVG(topic_score)::numeric(4,2) AS avg_topic_score,
  -- Top categories (semicolon-separated, dedup, top 3 by frequency)
  (
    SELECT string_agg(cat, ' · ' ORDER BY n DESC)
    FROM (
      SELECT category AS cat, COUNT(*) AS n
      FROM relevant_contracts rc2
      WHERE rc2.buyer_name = rc.buyer_name AND category IS NOT NULL
      GROUP BY category ORDER BY 2 DESC LIMIT 3
    ) sub
  ) AS top_categories,
  -- Sample 3 most recent contract titles for context
  (
    SELECT array_agg(title ORDER BY date_published DESC)
    FROM (
      SELECT title, date_published
      FROM relevant_contracts rc3
      WHERE rc3.buyer_name = rc.buyer_name
      ORDER BY date_published DESC LIMIT 3
    ) sub
  ) AS recent_contract_titles
FROM relevant_contracts rc
GROUP BY buyer_name
HAVING COUNT(*) >= 2  -- buyer must have 2+ relevant contracts to qualify as a prospect
ORDER BY SUM(contract_value) DESC;

COMMENT ON VIEW v_act_procurement_buyers IS
  'Government buyers who procure ACT-deliverable work (data/intelligence/evaluation/evidence/etc.) — scored from austender_contracts last 3 years, >$25K, 2+ contracts.';

COMMIT;
