-- Merge case-duplicate funder_context_snapshot rows.
-- funder_name is PK (case-sensitive TEXT), so 'StreetSmart' and 'Streetsmart'
-- created two rows when the Xero backfill ran. Keep the row with the higher
-- relationship_score, delete the rest.

WITH ranked AS (
  SELECT
    funder_name,
    ROW_NUMBER() OVER (
      PARTITION BY lower(funder_name)
      ORDER BY relationship_score DESC NULLS LAST, refreshed_at DESC
    ) AS rn
  FROM funder_context_snapshot
)
DELETE FROM funder_context_snapshot
WHERE funder_name IN (SELECT funder_name FROM ranked WHERE rn > 1);
