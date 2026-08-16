-- Vocab views for shell dropdowns — real vocabularies, never hardcoded lists.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-16-vocab-views.sql
--
-- Both views carry the two DB-side grant filters (measure_kind + is_aggregate) so the
-- vocabularies describe the same row population the money surfaces sum. The name-based
-- third filter is app-side (see justice-money.ts) and does not change which years/topics exist.

CREATE OR REPLACE VIEW v_vocab_financial_years AS
SELECT financial_year, count(*) AS grant_rows
FROM justice_funding
WHERE measure_kind = 'grant'
  AND is_aggregate IS NOT TRUE
  AND financial_year IS NOT NULL
GROUP BY financial_year
ORDER BY financial_year;

CREATE OR REPLACE VIEW v_vocab_topics AS
SELECT topic, count(*) AS grant_rows
FROM justice_funding
CROSS JOIN LATERAL unnest(topics) AS topic
WHERE measure_kind = 'grant'
  AND is_aggregate IS NOT TRUE
GROUP BY topic
ORDER BY grant_rows DESC;

-- Views default to owner-only; without these grants the dropdowns render empty (Goods chip lesson).
GRANT SELECT ON v_vocab_financial_years, v_vocab_topics TO anon, authenticated, service_role;
