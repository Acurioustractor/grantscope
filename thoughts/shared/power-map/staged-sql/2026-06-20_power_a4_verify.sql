-- ============================================================================
-- A4 de-collide — BEFORE/AFTER verification. READ-ONLY.
-- Run in the SAME psql session right after the migration:
--   psql ... -f 2026-06-20_power_a4_decollide_person_money.sql \
--            -f 2026-06-20_power_a4_verify.sql
-- Runs through psql (no 8s statement-timeout cap that bites gsql.mjs on the
-- 241K-row GROUP BY). Proof comes entirely from mv_person_identity_influence_v2,
-- which carries BOTH the old collided figure (*_affiliated) and the de-collided
-- figure (*_attributed) side by side.
-- ============================================================================

\echo '======== BEFORE (affiliated = original collided rollup) ========'
\echo 'Clusters of >=3 distinct non-nominee people sharing an IDENTICAL procurement total:'
SELECT total_procurement_affiliated::numeric(14,2) AS shared_total,
       count(*) AS people_sharing
FROM mv_person_identity_influence_v2
WHERE NOT is_nominee_block AND total_procurement_affiliated > 0
GROUP BY total_procurement_affiliated
HAVING count(*) >= 3
ORDER BY 1 DESC
LIMIT 8;

\echo ''
\echo '======== AFTER (attributed = de-collided, even-split per director) ========'
\echo 'Same query shape on the de-collided figure. NOTE: clusters PERSIST and that is'
\echo 'CORRECT — co-directors of one entity get the SAME per-director share. Success ='
\echo 'figures SHRANK to the per-director share (e.g. $7.57B/8 -> $757M each = 1/10th),'
\echo 'so the aggregate no longer multiplies the same dollars across people:'
SELECT attributed_procurement::numeric(14,2) AS shared_total,
       count(*) AS people_sharing
FROM mv_person_identity_influence_v2
WHERE NOT is_nominee_block AND attributed_procurement > 0
GROUP BY attributed_procurement
HAVING count(*) >= 3
ORDER BY 1 DESC
LIMIT 8;

\echo ''
\echo '======== The former $7.57B / 8-people cluster, person by person ========'
SELECT person_name,
       board_count,
       total_procurement_affiliated::numeric(14,2) AS before_collided,
       attributed_procurement::numeric(14,2)        AS after_attributed,
       max_board_director_count AS biggest_shared_board
FROM mv_person_identity_influence_v2
WHERE total_procurement_affiliated = 7570752694.37
ORDER BY attributed_procurement DESC;

\echo ''
\echo '======== Honest cross-system people leaderboard (top 15 by attributed influence) ========'
\echo 'This is what the /power leaderboard (move C) would render:'
SELECT person_name,
       board_count,
       financial_system_count AS systems,
       attributed_procurement::numeric(14,2) AS proc_attr,
       attributed_justice::numeric(14,2)     AS justice_attr,
       attributed_donations::numeric(14,2)   AS donations_attr,
       shares_board_entities,
       is_nominee_block
FROM mv_person_identity_influence_v2
WHERE NOT is_nominee_block AND board_count <= 10
ORDER BY influence_score_attributed DESC
LIMIT 15;

\echo ''
\echo '======== Row count + nominee split ========'
SELECT count(*) AS total_identities,
       count(*) FILTER (WHERE is_nominee_block) AS nominee_blocks,
       count(*) FILTER (WHERE shares_board_entities) AS share_a_board
FROM mv_person_identity_influence_v2;
