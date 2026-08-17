-- Trigram index for the entities search (code-review follow-up, phase "One shell, all data").
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-gs-entities-name-trgm.sql
--
-- /dashboard/entities searches gs_entities (609K rows) with a leading-wildcard ILIKE, which
-- forces a sequential scan per request without this. GIN trigram serves %q% directly.
-- CONCURRENTLY: not inside a transaction — psql -f runs it standalone.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gs_entities_canonical_name_trgm
  ON gs_entities USING gin (canonical_name extensions.gin_trgm_ops);
