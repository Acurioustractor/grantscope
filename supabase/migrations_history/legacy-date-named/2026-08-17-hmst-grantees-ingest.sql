-- Helen Macpherson Smith Trust grantee ingest — from the trust's own published grants
-- database CSV (hmstrust.org.au/grants-database, downloaded 2026-08-17; 4,976 grants
-- 1955–2026, $150.6M total).
-- 773 of 1,589 distinct grantee names resolved to graph entities: exact-name matches
-- (confidence 'reported'), trigram >=0.80 auto-accepts and judge-adjudicated 0.60–0.80
-- band accepts (188 of 355; 167 rejected — false-friend rules: locality, state,
-- federated-structure, org-vs-its-foundation), all confidence 'inferred'. One >=0.80
-- match hand-demoted: Royal Women's Hospital Foundation (Melbourne) had matched the
-- SYDNEY Royal Hospital For Women Foundation.
-- Linked: 2,873 grant rows, $99,219,436. Held out: 2,103 rows / $51.4M across 816
-- unresolved names (heavily pre-2000 Victorian orgs that no longer exist).
-- Row data: data/ingest/hmst-grants-linked.tsv (committed alongside this migration).
-- REVERSIBLE: DELETE FROM gs_relationships WHERE dataset='hmst_grants_database_2026';
-- Apply (from repo root): source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-hmst-grantees-ingest.sql

BEGIN;
CREATE TEMP TABLE hmst_raw (name text, amount bigint, year int, gs_id text, confidence text);
\copy hmst_raw FROM 'data/ingest/hmst-grants-linked.tsv' WITH (FORMAT text)
CREATE TEMP TABLE hmst_stg AS SELECT *, row_number() OVER (PARTITION BY name, year ORDER BY amount) AS rn FROM hmst_raw;
INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, amount, year, dataset, source_url, confidence, source_record_id)
SELECT s.id, t.id, 'grant', r.amount, r.year, 'hmst_grants_database_2026',
       'https://hmstrust.org.au/grants-database',
       r.confidence,
       r.name || '|' || r.year || '|' || r.rn
FROM hmst_stg r
JOIN gs_entities s ON s.gs_id = 'AU-ABN-58481949605'
JOIN gs_entities t ON t.gs_id = r.gs_id;
COMMIT;
