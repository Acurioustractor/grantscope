-- Gazetteer round 1b — the three ratified verdicts (Ben via grouped AskUserQuestion 2026-08-09):
--   Tjirrkarli: correct to Ngaanyatjarraku · Nhulunbuy: own-name town rows only (5) ·
--   Bloomfield pair: Lundinwarra -> Cook, Burungu -> Douglas.
-- Evidence: ORIC register detail pages (ICN 599, 1718) fetched this session; SAL ratios in abs_sal_lga_ratio;
--   China Camp = Douglas Shire (Bonzle atlas; Douglas Shire Council road ownership; postal via Ayton IGA corroborates).
-- Guard-check: all 7 placements NULL-lga, correction pair at 53220 (verified pre-apply).
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f supabase/migrations/20260809190000_gazetteer_round_one_b.sql
--
-- New stamp values (honest ratio provenance, distinct forever):
--   own_name_town+sal_ratio_dominant   — town evidence + SAL ratio >=90% winner (Nhulunbuy 0.974 Unincorp NT)
--   oric_register_address+sal_ratio_dominant — register street locality + SAL ratio >=90% winner (Bloomfield 0.922 Cook)
-- NOT placed on purpose: 12 Yolngu/homelands-flavored Nhulunbuy acnc rows + 10 ORIC postal corps (street rung);
--   NO 'GOVE' alias row (Gove Peninsula spans East Arnhem communities — an alias would be a trap).

BEGIN;

-- Alias row: China Camp (durable for the street-address rung)
INSERT INTO abs_locality_lga (locality, state_name, lga_code, lga_name, lga_count, source) VALUES
  ('CHINA CAMP','Queensland','32810','Douglas',1,
   'gazetteer_r1b: China Camp, CREB track — Douglas Shire (Bonzle atlas; Douglas Shire Council); Ayton-end section in Wujal Wujal noted');

-- Correction: Tjirrkarli pair, East Pilbara -> Ngaanyatjarraku (own SAL 1.000 beats postal line's Gibson Desert North)
UPDATE gs_entities
SET lga_name='Ngaanyatjarraku', lga_code='56620'
WHERE gs_id IN ('AU-ABN-28254807963','AU-ORIC-534') AND lga_code='53220';

-- Nhulunbuy: own-name town institutions -> Unincorporated NT (SAL Nhulunbuy 0.974 dominant)
UPDATE gs_entities e
SET lga_name='Unincorporated NT', lga_code='79399', lga_source='own_name_town+sal_ratio_dominant'
WHERE e.gs_id IN ('AU-ABN-54030042427','AU-ABN-79711380752','AU-ABN-45857814899',
                  'AU-ABN-73148533994','AU-ABN-74182566770')
  AND e.lga_code IS NULL;

-- Bloomfield pair
UPDATE gs_entities
SET lga_name='Cook', lga_code='32500', lga_source='oric_register_address+sal_ratio_dominant'
WHERE gs_id='AU-ABN-33649114857' AND lga_code IS NULL; -- Lundinwarra: street Lot 1 R2566 Bloomfield Rd, Bloomfield (SAL 0.922 Cook); WW line is postal only

UPDATE gs_entities
SET lga_name='Douglas', lga_code='32810', lga_source='oric_register_address+gazetteer'
WHERE gs_id='AU-ABN-58028493266' AND lga_code IS NULL; -- Burungu: Ranger Station, CREB track, China Camp (Douglas); postal Ayton corroborates

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM gs_entities WHERE gs_id IN ('AU-ABN-28254807963','AU-ORIC-534') AND lga_code='56620';
  IF n <> 2 THEN RAISE EXCEPTION 'Tjirrkarli correction: expected 2, got %', n; END IF;

  SELECT count(*) INTO n FROM gs_entities WHERE lga_source='own_name_town+sal_ratio_dominant' AND lga_code='79399';
  IF n <> 5 THEN RAISE EXCEPTION 'Nhulunbuy own-name set: expected 5, got %', n; END IF;

  SELECT count(*) INTO n FROM gs_entities WHERE gs_id='AU-ABN-33649114857' AND lga_code='32500'
    AND lga_source='oric_register_address+sal_ratio_dominant';
  IF n <> 1 THEN RAISE EXCEPTION 'Lundinwarra did not land'; END IF;

  SELECT count(*) INTO n FROM gs_entities WHERE gs_id='AU-ABN-58028493266' AND lga_code='32810'
    AND lga_source='oric_register_address+gazetteer';
  IF n <> 1 THEN RAISE EXCEPTION 'Burungu did not land'; END IF;

  SELECT count(*) INTO n FROM abs_locality_lga WHERE source LIKE 'gazetteer_r1b:%';
  IF n <> 1 THEN RAISE EXCEPTION 'China Camp alias: expected 1, got %', n; END IF;
END $$;

COMMIT;

-- Post-apply verification (informational)
SELECT lga_source, count(*) AS n FROM gs_entities
WHERE lga_source IN ('own_name_town+sal_ratio_dominant','oric_register_address+sal_ratio_dominant',
                     'oric_register_address+gazetteer','oric_register_address+abs_asgs')
GROUP BY 1 ORDER BY 1;

SELECT count(*) AS unresolved_multi_lga_postcode FROM gs_entities WHERE lga_source='unresolved_multi_lga_postcode';
