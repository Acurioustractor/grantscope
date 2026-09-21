-- Give se_buyer_prospects and alma_funding_opportunities a key into gs_entities.
--
-- Both tables named organisations the graph could not see: 438 government
-- buyers and 846 distinct funders. scripts/check-table-linkage.mjs listed them
-- as the two real gaps on 2026-09-22.
--
-- ── Only certain links ──────────────────────────────────────────────────────
--
-- Every link records how it was made, in link_method:
--   graph_edge   the buyer's own contract edges in gs_relationships all point at
--                one entity. This reuses the graph's buyer resolver
--                (scripts/lib/graph-edge-datasets.mjs) by reading its OUTPUT,
--                so the two cannot drift apart.
--   unique_name  exactly one government body has this name; failing that,
--                exactly one non-person entity does. Same rungs as the graph.
-- A name shared by two entities links to nothing. Unmatched names stay NULL:
-- renamed departments ("QLD Department of Child Safety, Youth and Women") are
-- predecessors, and guessing a successor would invent a merge.
--
-- ── Why funders go through a lookup table ───────────────────────────────────
--
-- alma_funding_opportunities has 23,705 rows but 846 funder names, and many
-- writers. Keying the NAME once, in funder_entity_links, and filling the row
-- column by trigger means no writer has to change and a new row from a known
-- funder is linked on insert. A new link row back-fills existing rows.
--
-- ── Why se_buyer_prospects is filled here AND in the scout ──────────────────
--
-- scripts/scout-se-buyers.mjs truncates and rebuilds the table each run, so the
-- scout computes the key itself (same SQL). This file fills the current rows so
-- the column is not empty until the next scout run.
--
-- No foreign key to gs_entities: the graph rebuild merges and deletes entities,
-- and an FK here would make those deletes fail. The linkage guard reads the
-- column name, and a stale id reads as unlinked, which is the honest state.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260922090000_key_buyer_prospects_and_funders.sql

BEGIN;

-- 1. Buyers ------------------------------------------------------------------

ALTER TABLE se_buyer_prospects
  ADD COLUMN IF NOT EXISTS gs_entity_id uuid,
  ADD COLUMN IF NOT EXISTS link_method text
    CHECK (link_method IN ('graph_edge', 'unique_name'));

-- One definition, called here and by scripts/scout-se-buyers.mjs after every
-- rebuild, so the scout cannot drift from what this file did.
-- Names under 6 characters never match by name: "DoE" matched a node literally
-- named "DoE" in the dry run, and an acronym is not an identity.
CREATE OR REPLACE FUNCTION link_se_buyer_prospects() RETURNS integer
LANGUAGE sql AS $$
  WITH edge AS (
    SELECT r.properties->>'buyer_name' AS buyer_name,
           (array_agg(DISTINCT r.source_entity_id))[1] AS entity_id,
           count(DISTINCT r.source_entity_id) AS n
      FROM gs_relationships r
     WHERE r.dataset = 'austender' AND r.relationship_type = 'contract'
       AND r.properties->>'buyer_name' IN (SELECT buyer_name FROM se_buyer_prospects)
     GROUP BY 1
  ), by_name AS (
    SELECT lower(trim(canonical_name)) AS k,
           (array_agg(id) FILTER (WHERE entity_type = 'government_body' OR gs_id LIKE 'AU-GOV-%'))[1] AS gov_id,
           count(*) FILTER (WHERE entity_type = 'government_body' OR gs_id LIKE 'AU-GOV-%') AS gov_n,
           (array_agg(id))[1] AS any_id,
           count(*) AS any_n
      FROM gs_entities
     WHERE entity_type NOT IN ('person', 'political_party')
       AND lower(trim(canonical_name)) IN (SELECT lower(trim(buyer_name)) FROM se_buyer_prospects
                                            WHERE length(trim(buyer_name)) >= 6)
     GROUP BY 1
  ), resolved AS (
    SELECT p.buyer_name,
           coalesce(CASE WHEN e.n = 1 THEN e.entity_id END,
                    CASE WHEN b.gov_n = 1 THEN b.gov_id END,
                    CASE WHEN b.gov_n = 0 AND b.any_n = 1 THEN b.any_id END) AS entity_id,
           CASE WHEN e.n = 1 THEN 'graph_edge'
                WHEN b.gov_n = 1 OR (b.gov_n = 0 AND b.any_n = 1) THEN 'unique_name' END AS method
      FROM se_buyer_prospects p
      LEFT JOIN edge e ON e.buyer_name = p.buyer_name
      LEFT JOIN by_name b ON b.k = lower(trim(p.buyer_name))
  ), upd AS (
    UPDATE se_buyer_prospects p
       SET gs_entity_id = r.entity_id, link_method = r.method
      FROM resolved r
     WHERE r.buyer_name = p.buyer_name
    RETURNING r.entity_id
  )
  SELECT count(entity_id)::int FROM upd
$$;

SELECT link_se_buyer_prospects();

-- 2. Funders -----------------------------------------------------------------

CREATE TEMP TABLE _by_name ON COMMIT DROP AS
  SELECT lower(trim(canonical_name)) AS k,
         (array_agg(id) FILTER (WHERE entity_type = 'government_body' OR gs_id LIKE 'AU-GOV-%'))[1] AS gov_id,
         count(*) FILTER (WHERE entity_type = 'government_body' OR gs_id LIKE 'AU-GOV-%') AS gov_n,
         (array_agg(id))[1] AS any_id,
         count(*) AS any_n
    FROM gs_entities
   WHERE entity_type NOT IN ('person', 'political_party')
     AND lower(trim(canonical_name)) IN (SELECT lower(trim(funder_name)) FROM alma_funding_opportunities
                                          WHERE length(trim(funder_name)) >= 6)
   GROUP BY 1;

CREATE TABLE IF NOT EXISTS funder_entity_links (
  funder_key   text PRIMARY KEY,          -- lower(trim(funder_name))
  gs_entity_id uuid NOT NULL,
  link_method  text NOT NULL CHECK (link_method IN ('unique_name', 'reviewed')),
  linked_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE funder_entity_links ENABLE ROW LEVEL SECURITY;

INSERT INTO funder_entity_links (funder_key, gs_entity_id, link_method)
SELECT DISTINCT k.k,
       CASE WHEN b.gov_n = 1 THEN b.gov_id ELSE b.any_id END,
       'unique_name'
  FROM (SELECT DISTINCT lower(trim(funder_name)) AS k FROM alma_funding_opportunities
         WHERE funder_name IS NOT NULL AND trim(funder_name) <> '') k
  JOIN _by_name b ON b.k = k.k
 WHERE b.gov_n = 1 OR (b.gov_n = 0 AND b.any_n = 1)
ON CONFLICT (funder_key) DO NOTHING;

ALTER TABLE alma_funding_opportunities
  ADD COLUMN IF NOT EXISTS funder_entity_id uuid;

CREATE OR REPLACE FUNCTION set_funder_entity_id() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.funder_entity_id := (
    SELECT l.gs_entity_id FROM funder_entity_links l
     WHERE l.funder_key = lower(trim(NEW.funder_name)));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_funder_entity_id ON alma_funding_opportunities;
CREATE TRIGGER trg_set_funder_entity_id
  BEFORE INSERT OR UPDATE OF funder_name ON alma_funding_opportunities
  FOR EACH ROW EXECUTE FUNCTION set_funder_entity_id();

CREATE OR REPLACE FUNCTION propagate_funder_entity_link() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE alma_funding_opportunities
     SET funder_entity_id = NEW.gs_entity_id
   WHERE lower(trim(funder_name)) = NEW.funder_key
     AND funder_entity_id IS DISTINCT FROM NEW.gs_entity_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_propagate_funder_entity_link ON funder_entity_links;
CREATE TRIGGER trg_propagate_funder_entity_link
  AFTER INSERT OR UPDATE OF gs_entity_id ON funder_entity_links
  FOR EACH ROW EXECUTE FUNCTION propagate_funder_entity_link();

-- The INSERT above ran before the propagation trigger existed, so fill once.
--
-- Two existing triggers are switched off for this one statement, because they
-- would otherwise rewrite rows this migration has no business touching:
--   trigger_funding_opportunities_updated  stamps updated_at = now() on every
--     row, so all opportunities would read as updated on the day of a key backfill;
--   trigger_funding_status_update          flips 'open' rows past their deadline
--     to 'closed' as a side effect. Whether those statuses should change is a
--     separate decision, measured and reported, not made here.
-- The later propagation trigger does NOT do this: when one reviewed link is
-- added, that funder's rows get a fresh updated_at. That is a few rows and true.
ALTER TABLE alma_funding_opportunities
  DISABLE TRIGGER trigger_funding_opportunities_updated,
  DISABLE TRIGGER trigger_funding_status_update;

UPDATE alma_funding_opportunities a
   SET funder_entity_id = l.gs_entity_id
  FROM funder_entity_links l
 WHERE l.funder_key = lower(trim(a.funder_name))
   AND a.funder_entity_id IS DISTINCT FROM l.gs_entity_id;

ALTER TABLE alma_funding_opportunities
  ENABLE TRIGGER trigger_funding_opportunities_updated,
  ENABLE TRIGGER trigger_funding_status_update;

COMMIT;
