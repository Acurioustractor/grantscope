-- community_directory_orgs: make the (source, source_url) unique index non-partial.
--
-- The original index carried WHERE (source_url IS NOT NULL), which PostgREST/Supabase
-- upserts cannot target via ON CONFLICT (conflict inference needs the predicate, and
-- PostgREST never sends one) — so every scraper/ingest upsert failed with
-- "no unique or exclusion constraint matching the ON CONFLICT specification".
--
-- Dropping the predicate changes nothing for NULL source_url rows: Postgres unique
-- indexes treat NULLs as distinct, so multiple URL-less rows still coexist and remain
-- governed by community_directory_orgs_source_name_pc_uniq.
DROP INDEX IF EXISTS community_directory_orgs_source_url_uniq;
CREATE UNIQUE INDEX community_directory_orgs_source_url_uniq
  ON community_directory_orgs (source, source_url);
