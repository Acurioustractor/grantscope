#!/usr/bin/env bash
# Rebuild the figures in thoughts/shared/drafts/2026-09-22-who-holds-the-giving.md from Jev's
# classifications (data/jev-check/charity-classify.jsonl, made by scripts/jev-charity-classify.mjs).
# Read-only: loads the jsonl into a TEMP table and sums ACNC filings in SQL. Jev never sees a dollar.
# A judgement counts only at confidence >= 0.9; the rest are reported as "for review".
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source <(grep -E '^DATABASE_PASSWORD=' .env); set +a
CSV=$(mktemp)
node -e '
const fs=require("fs");const q=v=>v==null?"":`"${String(v).replace(/"/g,"\"\"")}"`;
for (const l of fs.readFileSync("data/jev-check/charity-classify.jsonl","utf8").split("\n").filter(Boolean)){
  const r=JSON.parse(l);console.log([r.abn,r.sector,r.sector_conf,r.control,r.control_conf,r.school,r.school_conf].map(q).join(","));}' > "$CSV"
PGPASSWORD=$DATABASE_PASSWORD psql -h aws-0-ap-southeast-2.pooler.supabase.com -U postgres.tednluwflfhxyucgwigh -d postgres -X -v ON_ERROR_STOP=1 <<SQL
SET statement_timeout = 0;
CREATE TEMP TABLE j (abn text, sector text, sector_conf numeric, control text, control_conf numeric, school text, school_conf numeric);
\copy j FROM '$CSV' CSV
CREATE TEMP TABLE f AS
  SELECT DISTINCT ON (l.abn) l.abn, l.charity_name, l.total_revenue rev, l.revenue_from_government govt,
         l.donations_and_bequests don, l.net_assets_liabilities assets, l.net_surplus_deficit surplus, c.ben_aboriginal_tsi atsi, c.is_oric_corporation oric
    FROM acnc_ais l JOIN acnc_charities c ON c.abn = l.abn
   WHERE l.ais_year >= 2022 AND coalesce(l.total_revenue, 0) < 3e10
   ORDER BY l.abn, l.ais_year DESC;
CREATE TEMP TABLE fj AS SELECT f.*, j.sector, j.sector_conf, j.control, j.control_conf, j.school, j.school_conf FROM f JOIN j USING (abn);

\echo '== coverage'
SELECT (SELECT count(*) FROM f) charities, count(*) classified FROM j;

\echo '== 1. money by MAIN sector (exclusive, conf >= 0.9)'
SELECT CASE WHEN sector_conf >= 0.9 THEN sector ELSE '(for review)' END sector, count(*) orgs,
       round(sum(rev)/1e9,2) rev_bn, round(sum(govt)/1e9,2) govt_bn, round(sum(don)/1e6) don_m, round(sum(assets)/1e9,2) assets_bn
  FROM fj GROUP BY 1 ORDER BY rev_bn DESC NULLS LAST;

\echo '== 2. charities ticking Aboriginal & TSI beneficiaries (or ORIC): who holds the money'
SELECT CASE WHEN control_conf >= 0.9 THEN control ELSE '(for review)' END control, count(*) orgs,
       round(sum(rev)/1e9,2) rev_bn, round(100*sum(rev)/sum(sum(rev)) OVER (),1) rev_pct,
       round(sum(don)/1e6) don_m, round(100*sum(don)/sum(sum(don)) OVER (),1) don_pct, round(sum(assets)/1e9,2) assets_bn
  FROM fj WHERE atsi OR oric GROUP BY 1 ORDER BY rev_bn DESC NULLS LAST;

\echo '== 2b. largest confident community-controlled, and largest "for review" (eyeball these)'
SELECT charity_name, round(rev/1e6) rev_m, control, control_conf FROM fj WHERE (atsi OR oric) AND control='community_controlled' AND control_conf>=0.9 ORDER BY rev DESC NULLS LAST LIMIT 10;
SELECT charity_name, round(rev/1e6) rev_m, control, control_conf FROM fj WHERE (atsi OR oric) AND control_conf<0.9 ORDER BY rev DESC NULLS LAST LIMIT 10;

\echo '== 3. schools and school funds (conf >= 0.9)'
SELECT CASE WHEN school_conf >= 0.9 THEN school ELSE '(for review)' END school, count(*) orgs,
       round(sum(rev)/1e9,2) rev_bn, round(sum(govt)/1e9,2) govt_bn, round(sum(don)/1e6) don_m, round(sum(assets)/1e9,2) assets_bn, round(sum(surplus)/1e6) surplus_m
  FROM fj WHERE school IS NOT NULL GROUP BY 1 ORDER BY rev_bn DESC NULLS LAST;
\echo '== 3b. largest school funds by net assets'
SELECT charity_name, round(assets/1e6,1) assets_m, round(don/1e6,1) don_m FROM fj WHERE school='school_fund' AND school_conf>=0.9 ORDER BY assets DESC NULLS LAST LIMIT 10;

\echo '== 4. donations: school funds vs confident community-controlled orgs vs ORIC corporations'
SELECT round(sum(don) FILTER (WHERE school='school_fund' AND school_conf>=0.9)/1e6,1) school_funds_don_m,
       round(sum(don) FILTER (WHERE control='community_controlled' AND control_conf>=0.9)/1e6,1) cc_don_m,
       round(sum(don) FILTER (WHERE oric)/1e6,1) oric_don_m
  FROM fj;
SQL
rm -f "$CSV"
