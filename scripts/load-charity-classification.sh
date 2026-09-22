#!/usr/bin/env bash
# Load Jev's charity classifications into gs_charity_classification (migration 20260923060000).
# Idempotent: upserts by ABN, so a re-run after re-classifying refreshes rows in place.
#   bash scripts/load-charity-classification.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source <(grep -E '^DATABASE_PASSWORD=' .env); set +a
SRC=data/jev-check/charity-classify.jsonl
[ -f "$SRC" ] || { echo "missing $SRC — run scripts/jev-charity-classify.mjs first"; exit 1; }
CSV=$(mktemp)
node -e '
const fs=require("fs");const q=v=>v==null||v===""?"":`"${String(v).replace(/"/g,"\"\"")}"`;
for (const l of fs.readFileSync(process.argv[1],"utf8").split("\n").filter(Boolean)){
  const r=JSON.parse(l);
  console.log([r.abn,r.sector,r.sector_conf,r.control,r.control_conf,r.school,r.school_conf].map(q).join(","));
}' "$SRC" > "$CSV"
echo "loading $(wc -l < "$CSV" | tr -d ' ') rows"
PGPASSWORD=$DATABASE_PASSWORD psql -h "${PGHOST:-aws-0-ap-southeast-2.pooler.supabase.com}" -U "${PGUSER:-postgres.tednluwflfhxyucgwigh}" -d "${PGDATABASE:-postgres}" -X -v ON_ERROR_STOP=1 <<SQL
SET statement_timeout = 0;
CREATE TEMP TABLE stage (abn text, sector text, sector_conf numeric, control text, control_conf numeric, school text, school_conf numeric);
\copy stage FROM '$CSV' CSV
INSERT INTO gs_charity_classification (abn, sector, sector_conf, control, control_conf, school, school_conf, classified_at)
SELECT abn, sector, sector_conf, control, control_conf, school, school_conf, now() FROM stage
ON CONFLICT (abn) DO UPDATE SET
  sector = EXCLUDED.sector, sector_conf = EXCLUDED.sector_conf,
  control = EXCLUDED.control, control_conf = EXCLUDED.control_conf,
  school = EXCLUDED.school, school_conf = EXCLUDED.school_conf,
  classified_at = EXCLUDED.classified_at;
SELECT count(*) AS rows_in_table, count(*) FILTER (WHERE sector_conf >= 0.9) AS confident_sector FROM gs_charity_classification;
SQL
rm -f "$CSV"
