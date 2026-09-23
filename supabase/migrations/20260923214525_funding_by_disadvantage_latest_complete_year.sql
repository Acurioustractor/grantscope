-- Read the latest COMPLETE ACNC reporting year in the two funding-by-disadvantage matviews.
--
-- Both views picked `max(acnc_ais.ais_year)`. On 2026-09-24 that year was 2025, holding exactly one
-- early filing (Federation of Ethnic Communities' Councils of Australia), so /reports/funding-equity
-- said "1 charities matched" and that the most disadvantaged areas get 0.0% of charity income.
-- mv_indigenous_funding_by_disadvantage had 0 rows. The years before it hold ~54,000 filings each.
--
-- The latest year now means the latest year with at least 10,000 filings: 2024 today, and 2025 once
-- it has filled in. Definitions are otherwise unchanged; nothing depends on either view.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260923214525_funding_by_disadvantage_latest_complete_year.sql
-- Post-check: SELECT sum(charity_count) FROM mv_funding_by_disadvantage;  -- expect tens of thousands, not 1
-- Undo: re-create with `max(acnc_ais.ais_year)` (the pre-change definition is in the baseline dump).

BEGIN;
SET LOCAL statement_timeout = 0;

DROP MATERIALIZED VIEW public.mv_funding_by_disadvantage;
CREATE MATERIALIZED VIEW public.mv_funding_by_disadvantage AS
 SELECT s.decile_national AS irsd_decile,
        CASE
            WHEN s.decile_national <= 3 THEN 'Most Disadvantaged'::text
            WHEN s.decile_national <= 7 THEN 'Middle'::text
            ELSE 'Least Disadvantaged'::text
        END AS disadvantage_group,
    count(DISTINCT c.abn) AS charity_count,
    round(sum(a.total_gross_income), 0) AS total_income,
    round(sum(a.revenue_from_government), 0) AS govt_revenue,
    round(sum(a.donations_and_bequests), 0) AS donations,
    round(sum(a.total_expenses), 0) AS total_expenses,
    round(avg(a.total_gross_income), 0) AS avg_income,
    round(avg(a.revenue_from_government), 0) AS avg_govt_revenue,
    round(avg(a.staff_fte), 1) AS avg_staff_fte,
    sum(a.staff_volunteers) AS total_volunteers
   FROM acnc_charities c
     JOIN seifa_2021 s ON c.postcode = s.postcode AND s.index_type = 'IRSD'::text
     JOIN acnc_ais a ON c.abn = a.abn
  WHERE a.ais_year = (SELECT y.ais_year FROM acnc_ais y GROUP BY y.ais_year HAVING count(*) >= 10000
                       ORDER BY y.ais_year DESC LIMIT 1)
    AND a.total_gross_income IS NOT NULL AND a.total_gross_income > 0::numeric AND s.decile_national IS NOT NULL
  GROUP BY s.decile_national;
CREATE UNIQUE INDEX idx_mv_funding_disadvantage_decile ON public.mv_funding_by_disadvantage USING btree (irsd_decile);
GRANT ALL ON public.mv_funding_by_disadvantage TO service_role;
GRANT SELECT ON public.mv_funding_by_disadvantage TO agent_readonly;

DROP MATERIALIZED VIEW public.mv_indigenous_funding_by_disadvantage;
CREATE MATERIALIZED VIEW public.mv_indigenous_funding_by_disadvantage AS
 SELECT s.decile_national AS irsd_decile,
        CASE
            WHEN s.decile_national <= 3 THEN 'Most Disadvantaged'::text
            WHEN s.decile_national <= 7 THEN 'Middle'::text
            ELSE 'Least Disadvantaged'::text
        END AS disadvantage_group,
    count(DISTINCT c.abn) AS charity_count,
    round(sum(a.total_gross_income), 0) AS total_income,
    round(sum(a.revenue_from_government), 0) AS govt_revenue,
    round(sum(a.donations_and_bequests), 0) AS donations,
    round(avg(a.total_gross_income), 0) AS avg_income,
    round(avg(a.revenue_from_government), 0) AS avg_govt_revenue,
    round(avg(a.staff_fte), 1) AS avg_staff_fte
   FROM acnc_charities c
     JOIN seifa_2021 s ON c.postcode = s.postcode AND s.index_type = 'IRSD'::text
     JOIN acnc_ais a ON c.abn = a.abn
  WHERE a.ais_year = (SELECT y.ais_year FROM acnc_ais y GROUP BY y.ais_year HAVING count(*) >= 10000
                       ORDER BY y.ais_year DESC LIMIT 1)
    AND a.total_gross_income IS NOT NULL AND a.total_gross_income > 0::numeric AND s.decile_national IS NOT NULL
    AND c.ben_aboriginal_tsi = true
  GROUP BY s.decile_national;
CREATE UNIQUE INDEX idx_mv_indigenous_funding_decile ON public.mv_indigenous_funding_by_disadvantage USING btree (irsd_decile);
GRANT ALL ON public.mv_indigenous_funding_by_disadvantage TO service_role;
GRANT SELECT ON public.mv_indigenous_funding_by_disadvantage TO agent_readonly;

DO $$
DECLARE n int;
BEGIN
  SELECT sum(charity_count) INTO n FROM public.mv_funding_by_disadvantage;
  IF coalesce(n, 0) < 10000 THEN RAISE EXCEPTION 'mv_funding_by_disadvantage covers only % charities', n; END IF;
  SELECT sum(charity_count) INTO n FROM public.mv_indigenous_funding_by_disadvantage;
  IF coalesce(n, 0) < 100 THEN RAISE EXCEPTION 'mv_indigenous_funding_by_disadvantage covers only % charities', n; END IF;
END $$;

COMMIT;
