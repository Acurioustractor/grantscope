-- ABS Census 2021 ILOC-grain overcrowding backfill for goods_communities (NT).
-- Source: ABS 2021 Census Indigenous Profile DataPack, table I16 (Housing Suitability),
-- ILOC geography, short-header; persons from I02. Downloaded 2026-08-24 from
-- https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_IP_ILOC_for_NT_short-header.zip
-- "need 1+ extra bedrooms" is the CNOS overcrowding proxy (same measure as ABS QuickStats).
-- Gotcha honoured: ABS small-cell randomisation means components can exceed totals —
-- only ABS-supplied Tot columns are loaded, nothing summed or differenced.
--
-- Apply (CSV piped on stdin; \copy FROM STDIN cannot take a psql variable path):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f migrations/2026-08-24-abs-iloc-overcrowding-backfill.sql < nt_iloc_overcrowding.csv

-- Permanent reference table: the full 189-ILOC dataset, so future matching passes
-- (outstations, renamed communities) don't re-download the pack.
CREATE TABLE IF NOT EXISTS abs_nt_iloc_overcrowding (
  iloc_code text PRIMARY KEY,
  iloc_name text NOT NULL,
  occupied_dwellings integer,
  need_1plus integer,
  need_1plus_pct numeric(5,1),
  atsip_households integer,
  atsip_need_1plus integer,
  persons integer,
  persons_per_dwelling numeric(6,2),
  loaded_at timestamptz DEFAULT now()
);

TRUNCATE abs_nt_iloc_overcrowding;
\copy abs_nt_iloc_overcrowding (iloc_code, iloc_name, occupied_dwellings, need_1plus, need_1plus_pct, atsip_households, atsip_need_1plus, persons, persons_per_dwelling) FROM pstdin WITH (FORMAT csv, HEADER true);

SELECT count(*) AS iloc_rows FROM abs_nt_iloc_overcrowding;

-- Match report BEFORE writing: exact normalised name, NT rows only, unambiguous only.
WITH m AS (
  SELECT gc.id, gc.community_name, a.iloc_code,
         count(*) OVER (PARTITION BY gc.id) AS gc_matches
  FROM goods_communities gc
  JOIN abs_nt_iloc_overcrowding a
    ON upper(trim(a.iloc_name)) = upper(trim(gc.community_name))
  WHERE gc.state = 'NT'
)
SELECT count(DISTINCT id) AS communities_matched,
       count(DISTINCT id) FILTER (WHERE gc_matches > 1) AS ambiguous
FROM m;

-- The write: exact-name, unambiguous matches only. Everything else stays NULL
-- (deliberately unplaced rather than confidently wrong — same rule as the LGA work).
UPDATE goods_communities gc
SET abs_iloc_code            = a.iloc_code,
    occupied_dwellings       = a.occupied_dwellings,
    overcrowded_dwellings    = a.need_1plus,
    overcrowded_pct          = a.need_1plus_pct,
    persons_per_dwelling     = a.persons_per_dwelling,
    overcrowding_source      = 'ABS Census 2021 IP DataPack I16, ILOC ' || a.iloc_code || ' (' || a.iloc_name || '); CNOS need-1+-extra-bedroom; persons/dwelling derived I02/I16 (approximate)',
    overcrowding_as_at       = '2021-08-10'
FROM abs_nt_iloc_overcrowding a
WHERE gc.state = 'NT'
  AND upper(trim(a.iloc_name)) = upper(trim(gc.community_name))
  AND (SELECT count(*) FROM abs_nt_iloc_overcrowding a2
       WHERE upper(trim(a2.iloc_name)) = upper(trim(gc.community_name))) = 1;

SELECT count(*) AS rows_backfilled FROM goods_communities WHERE overcrowding_source LIKE 'ABS Census 2021%';

-- Pass 2 (added after pass 1 matched 64): ABS ILOC names carry suffixes the register
-- doesn't ("X and Outstations", "X (Nguiu)", "X exc. Town Camps"). Normalise those and
-- match again, still exact-and-unambiguous, still NULL over guess. The caveat travels in
-- overcrowding_source because "exc. Town Camps" genuinely narrows the geography.
WITH norm AS (
  SELECT a.*, upper(trim(regexp_replace(regexp_replace(a.iloc_name,
           '\s*(\(.*\)|and Outstations|exc\. Town Camps|- .*)$', '', 'g'), '\s+', ' ', 'g'))) AS norm_name
  FROM abs_nt_iloc_overcrowding a
), uniq AS (
  SELECT norm_name, min(iloc_code) AS iloc_code
  FROM norm GROUP BY norm_name HAVING count(*) = 1
)
UPDATE goods_communities gc
SET abs_iloc_code            = a.iloc_code,
    occupied_dwellings       = a.occupied_dwellings,
    overcrowded_dwellings    = a.need_1plus,
    overcrowded_pct          = a.need_1plus_pct,
    persons_per_dwelling     = a.persons_per_dwelling,
    overcrowding_source      = 'ABS Census 2021 IP DataPack I16, ILOC ' || a.iloc_code || ' (' || a.iloc_name || '); CNOS need-1+-extra-bedroom; matched on normalised ILOC name' ||
                               CASE WHEN a.iloc_name ILIKE '%exc. Town Camps%' THEN '; NOTE ILOC excludes town camps' ELSE '' END,
    overcrowding_as_at       = '2021-08-10'
FROM uniq u
JOIN abs_nt_iloc_overcrowding a ON a.iloc_code = u.iloc_code
WHERE gc.state = 'NT'
  AND gc.overcrowding_source IS NULL
  AND u.norm_name = upper(trim(gc.community_name))
  AND (SELECT count(*) FROM goods_communities g2
       WHERE g2.state='NT' AND upper(trim(g2.community_name)) = u.norm_name) = 1;

SELECT count(*) AS total_backfilled FROM goods_communities WHERE overcrowding_source LIKE 'ABS Census 2021%';
