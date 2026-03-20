-- Ingest NDIS provider + participant data from CSVs
-- Source: dataresearch.ndis.gov.au Dec 2025

-- === Active Providers ===
CREATE TEMP TABLE tmp_ap (
  rdt text, sc text, sdn text, dgn text, ab text, scl text, pc text
);
\copy tmp_ap FROM 'output/ndis/active-providers-dec2025.csv' CSV HEADER

INSERT INTO ndis_active_providers (report_date, state_code, service_district_name, disability_group_name, age_band, support_class, provider_count)
SELECT
  to_date(rdt, 'DDMONYYYY'),
  sc, sdn, dgn, ab, scl,
  NULLIF(replace(pc, ',', ''), '')::int
FROM tmp_ap
WHERE pc IS NOT NULL AND pc != '' AND pc NOT LIKE '<%'
ON CONFLICT DO NOTHING;

DROP TABLE tmp_ap;

-- === Market Concentration ===
CREATE TEMP TABLE tmp_mc (
  rdt text, sc text, sdn text, scl text, pst text, pb text
);
\copy tmp_mc FROM 'output/ndis/market-concentration.csv' CSV HEADER

INSERT INTO ndis_market_concentration (report_date, state_code, service_district_name, support_class, payment_share_top10_pct, payment_band)
SELECT
  to_date(rdt, 'DDMONYYYY'),
  sc, sdn, scl,
  NULLIF(replace(pst, '%', ''), '')::numeric,
  pb
FROM tmp_mc
WHERE rdt IS NOT NULL
ON CONFLICT DO NOTHING;

DROP TABLE tmp_mc;

-- === Participants ===
CREATE TEMP TABLE tmp_pt (
  rdt text, sc text, sdn text, dgn text, ab text, scl text, avg_b text, ap text
);
\copy tmp_pt FROM 'output/ndis/participants-dec2025.csv' CSV HEADER

INSERT INTO ndis_participants (report_date, state, service_district, disability_group, age_band, support_class, avg_annual_budget, active_participants, source)
SELECT
  to_date(rdt, 'DDMONYYYY'),
  sc, sdn, dgn, ab, scl,
  NULLIF(replace(avg_b, ',', ''), '')::numeric,
  NULLIF(replace(ap, ',', ''), '')::int,
  'dataresearch.ndis.gov.au'
FROM tmp_pt
WHERE rdt IS NOT NULL AND ap IS NOT NULL AND ap != '' AND ap NOT LIKE '<%'
ON CONFLICT DO NOTHING;

DROP TABLE tmp_pt;
