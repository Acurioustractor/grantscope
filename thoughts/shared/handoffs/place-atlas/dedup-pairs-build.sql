-- Dedup lane: derive AU-ORIC/AU-ABN name-bridged pairs (pre-materialized form — pooler stalls on the direct join)
DROP TABLE IF EXISTS stg_oric_norm;
CREATE TABLE stg_oric_norm AS
SELECT id, gs_id, lower(trim(canonical_name)) AS nname, canonical_name, state, lga_code, lga_name
FROM gs_entities WHERE gs_id LIKE 'AU-ORIC-%';
CREATE INDEX ON stg_oric_norm (nname);
ANALYZE stg_oric_norm;

DROP TABLE IF EXISTS stg_oric_dupe_pairs;
CREATE TABLE stg_oric_dupe_pairs AS
SELECT o.gs_id AS oric_gs_id, o.id AS oric_id, a.gs_id AS abn_gs_id, a.id AS abn_id,
       o.canonical_name, o.state AS o_state, a.state AS a_state,
       o.lga_code AS o_lga, a.lga_code AS a_lga
FROM gs_entities a
JOIN stg_oric_norm o ON o.nname = lower(trim(a.canonical_name))
WHERE a.gs_id LIKE 'AU-ABN-%';
DROP TABLE stg_oric_norm;

SELECT count(*) AS pairs,
       count(*) FILTER (WHERE o_lga IS DISTINCT FROM a_lga) AS lga_disagree,
       count(*) FILTER (WHERE o_state IS DISTINCT FROM a_state) AS state_disagree
FROM stg_oric_dupe_pairs;
