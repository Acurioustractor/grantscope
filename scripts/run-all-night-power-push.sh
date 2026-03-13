#!/usr/bin/env bash
set -uo pipefail

ROOT="/Users/benknight/Code/grantscope"
cd "$ROOT"

mkdir -p tmp output

STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$ROOT/tmp/all-night-power-push-$STAMP.log"
PID_FILE="$ROOT/tmp/all-night-power-push.pid"
TZ_NAME="${ALL_NIGHT_TZ:-Australia/Brisbane}"
CUTOFF_HOUR="${ALL_NIGHT_CUTOFF_HOUR:-6}"

echo $$ > "$PID_FILE"
exec >>"$LOG_FILE" 2>&1

log() {
  printf '[all-night-power-push] %s\n' "$*"
}

compute_cutoff_epoch() {
  python3 - "$TZ_NAME" "$CUTOFF_HOUR" <<'PY'
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
import sys

tz_name = sys.argv[1]
cutoff_hour = int(sys.argv[2])
tz = ZoneInfo(tz_name)
now = datetime.now(tz)
cutoff = datetime.combine(now.date(), time(hour=cutoff_hour), tz)
if now >= cutoff:
    cutoff += timedelta(days=1)
print(int(cutoff.timestamp()))
PY
}

RUN_UNTIL_EPOCH="$(compute_cutoff_epoch)"

before_cutoff() {
  local now_epoch
  now_epoch="$(python3 - <<'PY'
from datetime import datetime
print(int(datetime.now().timestamp()))
PY
)"
  [ "$now_epoch" -lt "$RUN_UNTIL_EPOCH" ]
}

run_with_timeout() {
  local timeout_seconds="$1"
  shift
  python3 - "$timeout_seconds" "$@" <<'PY'
import subprocess
import sys

timeout_seconds = int(sys.argv[1])
command = sys.argv[2:]

try:
    result = subprocess.run(command, check=False, timeout=timeout_seconds)
    sys.exit(result.returncode)
except subprocess.TimeoutExpired:
    print(f"[all-night-power-push] TIMEOUT {' '.join(command)} after {timeout_seconds}s", flush=True)
    sys.exit(124)
PY
}

run_step() {
  local name="$1"
  local timeout_seconds="$2"
  shift 2
  log "START $name"
  if run_with_timeout "$timeout_seconds" "$@"; then
    log "DONE  $name"
  else
    local exit_code="$?"
    if [ "$exit_code" -eq 124 ]; then
      log "TIMEOUT $name"
    else
      log "FAIL  $name (exit $exit_code)"
    fi
  fi
}

log "Log file: $LOG_FILE"
log "PID file: $PID_FILE"
log "Running until cutoff hour $CUTOFF_HOUR in $TZ_NAME"

log "Current background register importer status:"
pgrep -af 'import-ndis-provider-register.mjs' || log "No register importer detected"
run_step "recover-stale-agent-runs" 600 node --env-file=.env scripts/recover-stale-agent-runs.mjs --hours=6

# Curated import wave first.
run_step "buyability" 1800 node --env-file=.env scripts/import-buyability.mjs --concurrency=4
run_step "ndis-provider-market" 1800 node --env-file=.env scripts/import-ndis-provider-market.mjs
run_step "ndis-provider-register" 18000 node --env-file=.env scripts/repair-ndis-provider-register.mjs --concurrency=4
run_step "government-grants" 5400 node --env-file=.env scripts/import-gov-grants.mjs
run_step "lobbying-register" 1800 node --env-file=.env scripts/import-lobbying-register.mjs --skip-download
run_step "modern-slavery" 1800 node --env-file=.env scripts/import-modern-slavery.mjs

wave=1
while before_cutoff; do
  log "START enrichment-wave-$wave"
  run_step "discover-foundation-programs-wave-$wave" 1800 env LIMIT=40 CONCURRENCY=1 PROVIDER=minimax MODE=strict-public bash scripts/run-discover-foundation-programs.sh
  run_step "sync-foundation-programs-wave-$wave" 1200 node --env-file=.env scripts/sync-foundation-programs.mjs --cleanup-invalid
  run_step "enrich-foundations-wave-$wave" 7200 node --env-file=.env scripts/enrich-foundations.mjs --limit=100 --provider=minimax
  run_step "classify-foundation-power-profiles-wave-$wave" 1200 node --env-file=.env scripts/classify-foundation-power-profiles.mjs
  run_step "enrich-charities-wave-$wave" 7200 npx tsx scripts/enrich-charities.mjs --limit=100 --concurrency=2 --provider=minimax
  run_step "enrich-social-enterprises-wave-$wave" 7200 bash scripts/run-enrich-social-enterprises.sh
  run_step "enrich-social-enterprises-oric-wave-$wave" 7200 env LIMIT=150 CONCURRENCY=1 PROVIDER=minimax SOURCE=oric bash scripts/run-enrich-social-enterprises.sh
  run_step "classify-acnc-social-enterprises-wave-$wave" 3600 node --env-file=.env scripts/classify-acnc-social-enterprises.mjs --apply --limit=100 --min-confidence=0.7
  run_step "profile-community-orgs-wave-$wave" 7200 npx tsx scripts/profile-community-orgs.mjs --limit 500
  run_step "data-gap-audit-wave-$wave" 1200 node --env-file=.env scripts/data-gap-audit.mjs
  run_step "power-coverage-brief-wave-$wave" 1200 node --env-file=.env scripts/power-coverage-brief.mjs
  run_step "philanthropy-power-brief-wave-$wave" 1200 npx tsx scripts/philanthropy-power-brief.ts
  log "DONE  enrichment-wave-$wave"
  wave=$((wave + 1))
  sleep 30
done

log "Cutoff reached. Final register counts:"
node --env-file=.env scripts/gsql.mjs "SELECT registration_status, COUNT(*) AS provider_count FROM ndis_registered_providers GROUP BY registration_status ORDER BY registration_status" || true
log "All-night power push finished"
log "Log file: $LOG_FILE"
