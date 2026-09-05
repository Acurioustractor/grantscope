-- justice_funding.financial_year normalisation (data-cleaning lane, 2026-08-16)
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-16-justice-fy-normalise.sql
--
-- The column mixes single FYs ('2020-21'), verbose single FYs ('2026-2027'),
-- multi-year spans ('2021-25' = 2021→2025, '2024-2034'), open-ended programs
-- ('2020-ongoing') and one bare calendar year ('2024'). Forcing spans into
-- YYYY-YY format would misstate multi-year grants as single-year money, so:
--   1. financial_year keeps the source string (provenance), EXCEPT the two
--      '2026-2027' rows, whose span (2026→2027) is definitionally FY 2026-27
--      under either reading — rewritten to canonical '2026-27'.
--   2. New parsed columns fy_start/fy_end/fy_open_ended carry the machine
--      meaning for every row; a trigger keeps them in sync on insert/update.
--   3. v_vocab_financial_years lists only genuine single FYs (fy_end = fy_start+1),
--      so span rows never appear in the dashboard dropdown.
-- Trap that motivated this: '2021-25' (15 PRF rows) matches the canonical
-- YYYY-YY shape but is a four-year portfolio span.

BEGIN;

ALTER TABLE justice_funding
  ADD COLUMN IF NOT EXISTS fy_start smallint,
  ADD COLUMN IF NOT EXISTS fy_end smallint,
  ADD COLUMN IF NOT EXISTS fy_open_ended boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION parse_financial_year(fy text,
  OUT fy_start smallint, OUT fy_end smallint, OUT fy_open_ended boolean)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  a int; b int;
BEGIN
  fy_open_ended := false;
  IF fy IS NULL OR trim(fy) = '' THEN
    RETURN;
  END IF;
  fy := trim(fy);
  IF fy ~ '^\d{4}-\d{2}$' THEN
    a := left(fy, 4)::int;
    b := (a / 100) * 100 + right(fy, 2)::int;
    IF b <= a THEN b := b + 100; END IF;   -- e.g. 1999-00
    fy_start := a; fy_end := b;            -- covers both FY '2020-21' and span '2021-25'
  ELSIF fy ~ '^\d{4}-\d{4}$' THEN
    a := left(fy, 4)::int; b := right(fy, 4)::int;
    IF b >= a THEN fy_start := a; fy_end := b; END IF;  -- reversed ranges stay unparsed
  ELSIF fy ~* '^\d{4}-ongoing$' THEN
    fy_start := left(fy, 4)::int; fy_end := NULL; fy_open_ended := true;
  ELSIF fy ~ '^\d{4}$' THEN
    fy_start := fy::int; fy_end := fy::int; -- bare calendar year; excluded from FY vocab
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION justice_funding_parse_fy()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  p record;
BEGIN
  p := parse_financial_year(NEW.financial_year);
  NEW.fy_start := p.fy_start;
  NEW.fy_end := p.fy_end;
  NEW.fy_open_ended := p.fy_open_ended;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_justice_funding_parse_fy ON justice_funding;
CREATE TRIGGER trg_justice_funding_parse_fy
  BEFORE INSERT OR UPDATE OF financial_year ON justice_funding
  FOR EACH ROW EXECUTE FUNCTION justice_funding_parse_fy();

-- String normalisation: only the verbose-but-single-FY form.
UPDATE justice_funding
SET financial_year = left(financial_year, 4) || '-' || right(financial_year, 2)
WHERE financial_year ~ '^\d{4}-\d{4}$'
  AND right(financial_year, 4)::int = left(financial_year, 4)::int + 1;

-- Backfill parsed columns for all rows (trigger only fires on financial_year updates).
UPDATE justice_funding
SET (fy_start, fy_end, fy_open_ended) =
  (SELECT p.fy_start, p.fy_end, p.fy_open_ended
   FROM parse_financial_year(financial_year) p);

-- Dropdown vocabulary: genuine single FYs only. Spans/ongoing/bare-year rows
-- keep their data but never masquerade as a financial year in the shell.
CREATE OR REPLACE VIEW v_vocab_financial_years AS
SELECT financial_year, count(*) AS grant_rows
FROM justice_funding
WHERE measure_kind = 'grant'
  AND is_aggregate IS NOT TRUE
  AND financial_year IS NOT NULL
  AND fy_end = fy_start + 1
GROUP BY financial_year
ORDER BY financial_year;

GRANT SELECT ON v_vocab_financial_years TO anon, authenticated, service_role;

COMMIT;
