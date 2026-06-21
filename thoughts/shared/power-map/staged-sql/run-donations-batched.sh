#!/usr/bin/env bash
# ============================================================================
# A1 backfill - political_donations (scope B: company/org donors, IND excluded).
# BATCHED + RESUMABLE. Run this OFF-PEAK (low AEST traffic).
#
# WHY this exists: political_donations has 8 indexes and lives on an
# under-provisioned shared Supabase (Small compute, pool 15, ~6 projects). A
# single 414K-row UPDATE times out; even a 30K batch took 18+ min during a
# contention window on 2026-06-21. So we update in small batches that each
# commit fast and resume on re-run (fills NULLs only).
#
# Reads the STEP-1 staging table _a1_pd_resolved (must still exist; re-run
# STEP 1 if it was dropped). The justice half (STEP 2a) is already committed.
#
# RUN (foreground):   bash thoughts/shared/power-map/staged-sql/run-donations-batched.sh
# RUN (overnight):    nohup bash thoughts/shared/power-map/staged-sql/run-donations-batched.sh > /tmp/donations.log 2>&1 &
#                     then: tail -f /tmp/donations.log
# SAFE TO RE-RUN: yes - it only fills rows still NULL, so it continues.
# ============================================================================
cd /Users/benknight/Code/grantscope || { echo "repo not found"; exit 1; }
source .env
export PGPASSWORD="$DATABASE_PASSWORD"
# NOTE: do NOT add -q here — it suppresses the "UPDATE <n>" command tag that the
# loop below parses to count rows written. With -q the count is always 0, so the
# loop concludes "done" after a single batch even though rows were written.
PSQL="psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres -v ON_ERROR_STOP=1"

BATCH=10000          # small enough to fit comfortably under the timeout off-peak
MAX_BATCHES=80       # 80 * 10k = 800k cap (need ~42 for ~414k); a runaway guard
TOTAL=0

# guard: staging table present?
if ! $PSQL -tAc "SELECT to_regclass('public._a1_pd_resolved')" | grep -q _a1_pd_resolved; then
  echo "Staging table _a1_pd_resolved is missing - re-run STEP 1 first."; exit 1
fi

for i in $(seq 1 $MAX_BATCHES); do
  OUT=$($PSQL -c "SET lock_timeout='15s'; SET statement_timeout='300s'; WITH batch AS (
      SELECT pd.id AS pid, r.matched_abn AS abn
      FROM political_donations pd
      JOIN _a1_pd_resolved r ON r.pd_id = pd.id
      WHERE (pd.donor_abn IS NULL OR pd.donor_abn = '')
        AND r.entity_type_code IS DISTINCT FROM 'IND'
      LIMIT $BATCH)
    UPDATE political_donations pd SET donor_abn = b.abn
    FROM batch b WHERE pd.id = b.pid;" 2>&1)
  RC=$?
  if [ $RC -ne 0 ]; then
    echo "batch $i FAILED (rolled back, nothing lost): $OUT"
    echo ">> re-run this script to resume from here (it skips already-filled rows)."
    exit 1
  fi
  CNT=$(printf '%s' "$OUT" | grep -oE 'UPDATE [0-9]+' | grep -oE '[0-9]+' | tail -1)
  CNT=${CNT:-0}
  TOTAL=$((TOTAL + CNT))
  echo "batch $i: +$CNT  (running total $TOTAL)"
  if [ "$CNT" -eq 0 ]; then echo "DONE - total donor_abn backfilled: $TOTAL"; break; fi
done

echo "--- political_donations null donor_abn remaining ---"
$PSQL -c "SELECT count(*) FILTER (WHERE donor_abn IS NULL OR donor_abn='') AS still_null FROM political_donations;"
echo ">> after this completes, the nightly MV refresh (3am AEST) will fold the"
echo "   recovered rows into mv_entity_power_index automatically."
