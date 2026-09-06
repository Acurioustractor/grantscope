-- 20260907130000_foundations_giving_placeholders.sql
-- Replace the guessed Giving / yr figure on foundations with the charity's own reported grants.
--
-- foundations.total_giving_annual held one of three guessed amounts ($25k, $100k, $500k) on 9,242 of 11,205 rows,
-- written by the original scrape and LLM enrichment (enrichment_source in person_roles-join, scrape+llm, llm-only,
-- null). Measured 2026-09-07: those rows summed to $731m of guesses while their latest ACNC Annual Information
-- Statements report $3.33bn of actual grants and donations made. refresh-acnc-ais.mjs was meant to overwrite them
-- but its UPDATE runs through exec_sql, which is SELECT-only, so it has never done so.
--
-- What this does, per placeholder row (a guessed amount AND enrichment_source not from the ACNC):
--   latest AIS grants_donations_au > 0   ->  that figure                       (4,278 rows)
--   latest AIS grants_donations_au = 0   ->  0, a real "gave nothing away"     (4,119 rows)
--   no AIS on file                        ->  NULL, an honest blank             (843 rows)
-- The old guess and the source of the new value are kept in metadata (placeholder_giving, giving_source), and
-- enrichment_source becomes 'acnc_ais_<year>' or 'no_ais_return' so the refresh script's placeholder test
-- (enrichment_source not ILIKE 'acnc%') never treats these as guesses again.
-- The 955 non-placeholder rows are untouched: they are scraped figures for specific organisations and some mix
-- program spend with grantmaking (World Vision $514m), which the page footnote already says.
BEGIN;

WITH latest AS (
  SELECT f.id,
         f.total_giving_annual AS old_giving,
         a.grants_donations_au AS granted,
         a.ais_year
  FROM foundations f
  LEFT JOIN LATERAL (
    SELECT grants_donations_au, ais_year FROM acnc_ais a WHERE a.abn = f.acnc_abn ORDER BY ais_year DESC LIMIT 1
  ) a ON true
  WHERE f.total_giving_annual IN (25000, 100000, 500000)
    AND (f.enrichment_source IS NULL OR f.enrichment_source NOT ILIKE 'acnc%')
)
UPDATE foundations f
SET total_giving_annual = l.granted,                       -- NULL when no return
    enrichment_source   = CASE WHEN l.ais_year IS NULL THEN 'no_ais_return' ELSE 'acnc_ais_' || l.ais_year END,
    enriched_at         = now(),
    metadata            = coalesce(f.metadata, '{}'::jsonb)
                          || jsonb_build_object('placeholder_giving', l.old_giving,
                                                'giving_source', CASE WHEN l.ais_year IS NULL THEN 'no_ais_return' ELSE 'acnc_ais_' || l.ais_year END,
                                                'giving_replaced_on', current_date),
    updated_at          = now()
FROM latest l
WHERE l.id = f.id;

COMMIT;
