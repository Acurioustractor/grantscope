-- Link buyers whose name differs from the register only by a leading state code.
--
-- AusTender state disclosures prefix the department with its state: the
-- contract data says "QLD Department of Child Safety, Youth and Women", the
-- register says "Department of Child Safety, Youth and Women". After
-- 20260922090000, 153 of the 157 unlinked buyers carried such a prefix.
--
-- Found by scripts/jev-entity-match.mjs (#484): 88 of its 92 confident buyer
-- matches were exactly this. That makes it a rule for code, not a job for a
-- model, so it is one more EXACT rung here. The model's suggestions are not used.
--
-- Safety: the stripped name must be unique among government bodies (or, failing
-- any, among non-person entities) IN THE STATE THE PREFIX NAMES, and at least 6
-- characters. An entity with no recorded state never matches this rung: the
-- prefix is the only discriminator, and dropping it without checking the state
-- sent Queensland's Department of Education to Victoria's in the dry run. Links record link_method = 'unique_name_no_prefix', so they stay
-- distinguishable from an exact name match. Exact rungs still win when both hit.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260922100000_buyer_link_state_prefix.sql

BEGIN;

ALTER TABLE se_buyer_prospects DROP CONSTRAINT IF EXISTS se_buyer_prospects_link_method_check;
ALTER TABLE se_buyer_prospects ADD CONSTRAINT se_buyer_prospects_link_method_check
  CHECK (link_method IN ('graph_edge', 'unique_name', 'unique_name_no_prefix'));

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
  ), by_name_in_state AS (
    -- The prefix is the only thing saying WHICH state. Without this, "QLD
    -- Department of Education" linked to Victoria's (ABN 52705101522, 794
    -- contracts) in the dry run, because that was the one entity with the name.
    SELECT lower(trim(canonical_name)) AS k, upper(state) AS st,
           (array_agg(id) FILTER (WHERE entity_type = 'government_body' OR gs_id LIKE 'AU-GOV-%'))[1] AS gov_id,
           count(*) FILTER (WHERE entity_type = 'government_body' OR gs_id LIKE 'AU-GOV-%') AS gov_n,
           (array_agg(id))[1] AS any_id,
           count(*) AS any_n
      FROM gs_entities
     WHERE entity_type NOT IN ('person', 'political_party')
       AND state IS NOT NULL AND state <> ''
       AND lower(trim(canonical_name)) IN (
             SELECT lower(trim(regexp_replace(buyer_name, '^(QLD|NSW|VIC|NT|SA|WA|TAS|ACT)\s+', '', 'i'))) FROM se_buyer_prospects
              WHERE buyer_name ~* '^(QLD|NSW|VIC|NT|SA|WA|TAS|ACT)\s+'
                AND length(trim(regexp_replace(buyer_name, '^(QLD|NSW|VIC|NT|SA|WA|TAS|ACT)\s+', '', 'i'))) >= 6)
     GROUP BY 1, 2
  ), resolved AS (
    SELECT p.buyer_name,
           coalesce(CASE WHEN e.n = 1 THEN e.entity_id END,
                    CASE WHEN b.gov_n = 1 THEN b.gov_id END,
                    CASE WHEN b.gov_n = 0 AND b.any_n = 1 THEN b.any_id END,
                    CASE WHEN s.gov_n = 1 THEN s.gov_id END,
                    CASE WHEN s.gov_n = 0 AND s.any_n = 1 THEN s.any_id END) AS entity_id,
           CASE WHEN e.n = 1 THEN 'graph_edge'
                WHEN b.gov_n = 1 OR (b.gov_n = 0 AND b.any_n = 1) THEN 'unique_name'
                WHEN s.gov_n = 1 OR (s.gov_n = 0 AND s.any_n = 1) THEN 'unique_name_no_prefix' END AS method
      FROM se_buyer_prospects p
      LEFT JOIN edge e ON e.buyer_name = p.buyer_name
      LEFT JOIN by_name b ON b.k = lower(trim(p.buyer_name))
      LEFT JOIN by_name_in_state s
             ON p.buyer_name ~* '^(QLD|NSW|VIC|NT|SA|WA|TAS|ACT)\s+'
            AND s.st = upper(substring(p.buyer_name from '^(\w+)\s'))
            AND s.k = lower(trim(regexp_replace(p.buyer_name, '^(QLD|NSW|VIC|NT|SA|WA|TAS|ACT)\s+', '', 'i')))
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

COMMIT;
