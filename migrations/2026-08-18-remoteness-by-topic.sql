-- Topic-scoped remoteness shares for the dashboard chart (UX pass 2), 2026-08-18.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-18-remoteness-by-topic.sql
--
-- The dashboard's remoteness chart read mv_funding_by_postcode, which rolls up gs_relationships
-- (grant + contract + donation) with no topic dimension. It therefore could not follow the topic
-- filter, and — worse — it was measuring a different universe from every other number on the
-- page, which are justice_funding under the three mandatory filters. The chart said so in its
-- header, but "the filters above do not scope this chart" is a disclosure, not a fix.
--
-- This aggregates the SAME basis as the tiles: measure_kind='grant', is_aggregate IS NOT TRUE,
-- and the non-recipient name blocklist, kept in parity with NON_RECIPIENT_NAMES in
-- apps/web/src/lib/justice-money.ts.
--
-- Remoteness comes from the entity the row is linked to. Rows with no gs_entity_id, or an entity
-- with no remoteness, cannot be placed — they are returned as a separate unplaced total rather
-- than being dropped, so the page can state what share of the money the chart does not show.
-- For youth-justice that is about 10% of dollars; the caller must disclose it.
--
-- Aggregation happens HERE, not in the app: pulling justice_funding rows through PostgREST would
-- silently stop at 1,000 rows and the shares would be quietly wrong.

CREATE OR REPLACE FUNCTION funding_remoteness_by_topic(
  p_topic text,
  p_fy text DEFAULT NULL
)
RETURNS TABLE (
  remoteness text,
  dollars numeric,
  grants bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(btrim(e.remoteness), ''), '(unplaced)') AS remoteness,
    sum(j.amount_dollars) AS dollars,
    count(*) AS grants
  FROM justice_funding j
  LEFT JOIN gs_entities e ON e.id = j.gs_entity_id
  WHERE j.measure_kind = 'grant'
    AND j.is_aggregate IS NOT TRUE
    AND j.recipient_name IS NOT NULL
    AND lower(btrim(j.recipient_name)) <> ALL (ARRAY[
      'total','totals','grand total','subtotal','sub-total','various',
      'n/a','na','unknown','tbc','other','(blank)'])
    AND (p_topic IS NULL OR j.topics @> ARRAY[p_topic])
    AND (NULLIF(p_fy, '') IS NULL OR j.financial_year = p_fy)
  GROUP BY 1
$$;

GRANT EXECUTE ON FUNCTION funding_remoteness_by_topic(text, text) TO anon, authenticated, service_role;
