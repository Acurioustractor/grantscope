-- Lotterywest grantee ingest — from Lotterywest's own approved-grants API
-- (lotterywest.wa.gov.au/api/grants/approved, fetched 2026-08-17; rolling ~12-month
-- window, 568 records). Only rows Lotterywest itself marks publication choice
-- 'Published' AND state 'Granted' are used (426 kept, 142 excluded — their call, not ours).
-- 307 of 372 distinct grantee names resolved: exact ('reported'), trigram >=0.80
-- auto-accepts and judge-adjudicated 0.60–0.80 accepts (36 of 65; 29 rejected —
-- e.g. City of Perth != City of Perth Parking, Southcare != Southern Care), 'inferred'.
-- Linked: 345 grant rows, $141,150,485 (2025–26 calendar dates; year = grant date year).
-- Held out: 81 rows / $35.5M unresolved.
-- Lotterywest's own caveat: the table is general community information, not an official
-- reporting record. Rolling window — re-fetch periodically to extend coverage.
-- Row data: data/ingest/lotterywest-grants-linked.tsv (committed alongside).
-- REVERSIBLE: DELETE FROM gs_relationships WHERE dataset='lotterywest_api_2026';
-- Apply (from repo root): source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-lotterywest-grantees-ingest.sql

BEGIN;
CREATE TEMP TABLE lw_raw (name text, amount bigint, year int, gs_id text, confidence text);
\copy lw_raw FROM 'data/ingest/lotterywest-grants-linked.tsv' WITH (FORMAT text)
CREATE TEMP TABLE lw_stg AS SELECT *, row_number() OVER (PARTITION BY name, year ORDER BY amount) AS rn FROM lw_raw;
INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, amount, year, dataset, source_url, confidence, source_record_id)
SELECT s.id, t.id, 'grant', r.amount, r.year, 'lotterywest_api_2026',
       'https://www.lotterywest.wa.gov.au/grants/grant-recipients',
       r.confidence,
       r.name || '|' || r.year || '|' || r.rn
FROM lw_stg r
JOIN gs_entities s ON s.gs_id = 'AU-ABN-75964258835'
JOIN gs_entities t ON t.gs_id = r.gs_id;
COMMIT;
