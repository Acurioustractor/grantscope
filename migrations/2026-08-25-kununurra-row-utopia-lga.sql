-- Two placement facts, both evidence-backed:
--
-- 1. KUNUNURRA had register-delivered assets (2 Stretch Beds) but no goods_communities
--    row at all. Inserted with its verified geography and the already-loaded ILOC data
--    (50400601, exc. Town Camps — caveat kept in the source string).
--
-- 2. UTOPIA LGA RULING: Arlparra/Utopia homelands sit in BARKLY Regional Council
--    (70420). Three convergent public sources, checked 2026-08-25: Barkly Regional
--    Council's own communities page (Arlparra is one of its elected local authorities),
--    Wikipedia "Utopia, Northern Territory" (local government authority = Barkly
--    Regional Council), and Urapuntja Health Service ("in the Barkly Region").
--    Applied to the ARLPARRA and ARAWERR rows.
--
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql ... -f <this file>

INSERT INTO goods_communities (
  community_name, state, postcode, lga_code, lga_name, region_label, remoteness,
  community_type, signal_type, signal_source,
  abs_iloc_code, occupied_dwellings, overcrowded_dwellings, overcrowded_pct,
  persons_per_dwelling, overcrowding_source, overcrowding_as_at, notes
) VALUES (
  'KUNUNURRA', 'WA', '6743', '59340', 'Wyndham-East Kimberley', 'East Kimberley',
  'Remote Australia', 'town', 'exact', 'Goods register: 2 Stretch Beds delivered',
  '50400601', 1361, 97, 7.1, 3.34,
  'ABS Census 2021 IP DataPack I16, ILOC 50400601 (Kununurra exc. Town Camps); CNOS need-1+-extra-bedroom; NOTE ILOC excludes town camps',
  '2021-08-10',
  'Row created 2026-08-25: register held delivered assets for Kununurra but no community row existed.'
)
ON CONFLICT (community_name, state) DO NOTHING;

UPDATE goods_communities
SET lga_code = '70420', lga_name = 'Barkly',
    notes = coalesce(notes || ' | ', '') ||
      'LGA set 2026-08-25 by evidence ruling: Utopia homelands are in Barkly Regional Council (council communities page lists Arlparra local authority; Wikipedia Utopia NT; Urapuntja Health Service).'
WHERE upper(community_name) IN ('ARLPARRA', 'ARAWERR') AND state = 'NT' AND lga_code IS NULL;

SELECT community_name, state, lga_code, lga_name, abs_iloc_code, overcrowded_pct
FROM goods_communities
WHERE upper(community_name) IN ('KUNUNURRA','ARLPARRA','ARAWERR');
