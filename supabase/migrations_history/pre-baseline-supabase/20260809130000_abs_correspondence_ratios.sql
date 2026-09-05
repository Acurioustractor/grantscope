-- ABS correspondence ratios: SAL 2021 -> LGA 2021 and POA 2021 -> LGA 2022.
--
-- APPLY (run from the repo root — the \copy paths are relative):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -f supabase/migrations/20260809130000_abs_correspondence_ratios.sql
--
-- WHY. abs_locality_lga (SAL 2021 x LGA 2025) says WHICH councils a locality
-- touches (lga_count) but not HOW MUCH of it each council holds. The 2026-08-09
-- mop-up nulled 689 straddler postcode_geo rows on Ben's verdict: the legacy
-- first-seen council was a coin flip, and the principled refill is this import
-- - ABS population-weighted ratios that resolve each straddler to its dominant
-- council deliberately (>=90% dominance; genuine splits stay NULL, honest).
-- The POA file does the same at postcode grain for the 61,416 entities stamped
-- unresolved_multi_lga_postcode.
--
-- SOURCE. ASGS Edition 3 (2021) correspondence files, ABS Geospatial Solutions
-- via data.gov.au (dataset asgs-edition-3-2021-correspondences, resource
-- 33d822ba-138e-47ae-a15f-460279c3acc3, asgs2021correspondences.zip,
-- downloaded 2026-08-09):
--   * CG_SAL_2021_LGA_2021.csv - verbatim from the zip. 16,372 rows,
--     15,353 distinct SALs (exactly abs_locality_lga's locality universe).
--   * CG_POA_2021_LGA_2022.csv - converted from CG_POA_2021_LGA_2022.xlsx
--     (sheet CG_POA_2021_LGA_2022_All; one all-NULL BMOS total row dropped).
--     3,968 rows. The LGA 2022 edition is the latest POA->LGA the ABS
--     publishes and the closest to the LGA 2025 scheme abs_locality_lga uses.
-- data/ is gitignored, so the CSVs live only on disk; re-fetch from the
-- data.gov.au resource above if absent.
--
-- RATIO_FROM_TO is the ABS population-weighted share of the FROM region
-- (SAL / POA) that falls in the TO region (LGA). Rows for special SALs
-- (Migratory, No usual address) load as-is; they never match a real locality.
--
-- Reversible: pure additive - DROP TABLE undoes everything.

DROP TABLE IF EXISTS abs_sal_lga_ratio;
CREATE TABLE abs_sal_lga_ratio (
  sal_code        text NOT NULL,
  sal_name        text NOT NULL,
  lga_code        text NOT NULL,
  lga_name        text NOT NULL,
  ratio           numeric NOT NULL,
  indiv_quality   text,
  overall_quality text,
  bmos_null_flag  int,
  source          text DEFAULT 'CG_SAL_2021_LGA_2021 (ASGS Ed3 correspondences, data.gov.au)',
  loaded_at       timestamptz DEFAULT now()
);

\copy abs_sal_lga_ratio (sal_code, sal_name, lga_code, lga_name, ratio, indiv_quality, overall_quality, bmos_null_flag) FROM 'data/abs/CG_SAL_2021_LGA_2021.csv' WITH (FORMAT csv, HEADER true)

CREATE INDEX idx_abs_sal_lga_ratio_name ON abs_sal_lga_ratio (upper(sal_name));
CREATE INDEX idx_abs_sal_lga_ratio_lga ON abs_sal_lga_ratio (lga_code);
ANALYZE abs_sal_lga_ratio;

DROP TABLE IF EXISTS abs_poa_lga_ratio;
CREATE TABLE abs_poa_lga_ratio (
  poa_code        text NOT NULL,
  lga_code        text NOT NULL,
  lga_name        text NOT NULL,
  ratio           numeric NOT NULL,
  indiv_quality   text,
  overall_quality text,
  bmos_null_flag  int,
  source          text DEFAULT 'CG_POA_2021_LGA_2022 (ASGS Ed3 correspondences, data.gov.au)',
  loaded_at       timestamptz DEFAULT now()
);

\copy abs_poa_lga_ratio (poa_code, lga_code, lga_name, ratio, indiv_quality, overall_quality, bmos_null_flag) FROM 'data/abs/CG_POA_2021_LGA_2022.csv' WITH (FORMAT csv, HEADER true)

CREATE INDEX idx_abs_poa_lga_ratio_poa ON abs_poa_lga_ratio (poa_code);
ANALYZE abs_poa_lga_ratio;

-- On the record: row counts and ratio closure (each FROM region's ratios
-- should sum to ~1; BMOS rounding leaves small residue).
SELECT 'abs_sal_lga_ratio' AS tbl, count(*) AS rows, count(DISTINCT sal_code) AS from_regions,
       count(*) FILTER (WHERE ratio < 0.999) AS split_rows
  FROM abs_sal_lga_ratio
UNION ALL
SELECT 'abs_poa_lga_ratio', count(*), count(DISTINCT poa_code),
       count(*) FILTER (WHERE ratio < 0.999)
  FROM abs_poa_lga_ratio;

SELECT 'ratio closure off by >1%' AS check, count(*)
  FROM (SELECT sal_code FROM abs_sal_lga_ratio GROUP BY 1
        HAVING abs(sum(ratio) - 1) > 0.01) x;
