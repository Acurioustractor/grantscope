-- ============================================================================
-- STAGED - NOT APPLIED. Tier 3 (day-shift). Power map move A1-residue, STEP 1 of 2.
-- READ-ONLY on real tables: this script only CREATEs staging tables from SELECTs.
-- It does NOT modify justice_funding or political_donations. Run it, inspect the
-- _a1_* tables, then run STEP 2 to apply.
--
-- WHAT IT RESOLVES (dry-run verified 2026-06-20):
--   justice_funding : 14,869 name-only rows -> 7,471 UNAMBIGUOUS ABR matches
--                     (202 ambiguous deliberately excluded; never guess collisions)
--   political_donations : ~497K null-donor_abn rows resolvable via
--                     donor_entity_matches at confidence >= 0.8
--
-- NORMALIZATION must match mv_abr_name_lookup.norm_name EXACTLY (verified via
--   pg_get_viewdef): strip the legal/structural words, drop non-alnum-non-space,
--   lower, trim. (The leverage map's formula was wrong and would match ~nothing.)
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f thoughts/shared/power-map/staged-sql/2026-06-20_power_a1_backfill_STEP1_stage.sql
-- ============================================================================

-- ---- JUSTICE_FUNDING: stage unambiguous resolutions --------------------------
DROP TABLE IF EXISTS _a1_jf_resolved;
CREATE TABLE _a1_jf_resolved AS
WITH t AS (
    SELECT jf.id AS jf_id, jf.recipient_name,
        trim(both from lower(regexp_replace(regexp_replace(jf.recipient_name,
            '\m(Aboriginal|Torres Strait Islander|Corporation|Incorporated|Inc|Ltd|Limited|Pty|Co-operative|Association|Assoc|The|Of)\M', '', 'gi'),
            '[^a-zA-Z0-9 ]', '', 'g'))) AS norm
    FROM justice_funding jf
    WHERE (jf.recipient_abn IS NULL OR jf.recipient_abn = '')
      AND jf.recipient_name IS NOT NULL
),
t2 AS (
    SELECT * FROM t
    WHERE length(norm) >= 5
      AND norm NOT LIKE '%unspecified%' AND norm NOT LIKE '%confidential%'
      AND norm NOT LIKE '%various%'     AND norm NOT LIKE '%total%'
),
m AS (
    SELECT t2.jf_id, t2.recipient_name,
        count(DISTINCT l.abn) AS n_abn,
        min(l.abn)         AS resolved_abn,
        min(l.entity_name) AS abr_name
    FROM t2 JOIN mv_abr_name_lookup l ON l.norm_name = t2.norm
    GROUP BY t2.jf_id, t2.recipient_name
),
ge AS (  -- only ABNs that map to exactly ONE gs_entities row
    SELECT abn, (array_agg(id))[1] AS gs_entity_id
    FROM gs_entities WHERE abn IS NOT NULL AND abn <> ''
    GROUP BY abn HAVING count(*) = 1
)
SELECT m.jf_id, m.recipient_name, m.abr_name, m.resolved_abn, ge.gs_entity_id
FROM m LEFT JOIN ge ON ge.abn = m.resolved_abn
WHERE m.n_abn = 1;

CREATE INDEX ON _a1_jf_resolved (jf_id);

-- ---- POLITICAL_DONATIONS: stage via donor_entity_matches (unambiguous, conf>=0.8,
--      government entity types excluded) ----------------------------------------
DROP TABLE IF EXISTS _a1_pd_resolved;
CREATE TABLE _a1_pd_resolved AS
WITH dem1 AS (  -- one matched_abn per donor_name, only where unambiguous
    SELECT donor_name,
        count(DISTINCT matched_abn) AS n_abn,
        (array_agg(matched_abn ORDER BY match_confidence DESC NULLS LAST))[1] AS matched_abn,
        max(match_confidence) AS match_confidence
    FROM donor_entity_matches
    WHERE matched_abn ~ '^[0-9]{11}$'   -- valid 11-digit ABN only (drops '0' and malformed junk)
    GROUP BY donor_name
),
abr_type AS (  -- deduped abn -> entity_type_code (avoid fan-out)
    SELECT abn, min(entity_type_code) AS entity_type_code
    FROM abr_registry GROUP BY abn
)
SELECT pd.id AS pd_id, pd.donor_name, d.matched_abn, d.match_confidence, a.entity_type_code
FROM political_donations pd
JOIN dem1 d ON d.donor_name = pd.donor_name AND d.n_abn = 1 AND d.match_confidence >= 0.8
LEFT JOIN abr_type a ON a.abn = d.matched_abn
WHERE (pd.donor_abn IS NULL OR pd.donor_abn = '')
  AND COALESCE(a.entity_type_code, '') NOT IN ('CGE', 'SGE', 'LGE');  -- exclude govt

CREATE INDEX ON _a1_pd_resolved (pd_id);

-- ---- SELF-REPORT (inspect these before STEP 2) ------------------------------
\echo '--- justice_funding: rows that WILL be updated ---'
SELECT count(*) AS jf_rows_to_update,
       count(gs_entity_id) AS jf_with_gs_entity_id,
       count(DISTINCT resolved_abn) AS distinct_entities
FROM _a1_jf_resolved;

\echo '--- justice_funding: 15-row quality sample (eyeball name -> abr_name) ---'
SELECT recipient_name, abr_name, resolved_abn FROM _a1_jf_resolved LIMIT 15;

\echo '--- political_donations: rows that WILL be updated ---'
SELECT count(*) AS pd_rows_to_update,
       count(DISTINCT matched_abn) AS distinct_donor_abns,
       round(avg(match_confidence), 3) AS avg_confidence
FROM _a1_pd_resolved;

\echo '--- political_donations: 15-row quality sample ---'
SELECT donor_name, matched_abn, match_confidence, entity_type_code FROM _a1_pd_resolved LIMIT 15;
