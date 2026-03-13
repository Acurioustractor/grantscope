#!/usr/bin/env bash
set -uo pipefail

ROOT="/Users/benknight/Code/grantscope"
cd "$ROOT"

mkdir -p tmp output

STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$ROOT/tmp/overnight-data-push-$STAMP.log"
PID_FILE="$ROOT/tmp/overnight-data-push.pid"

echo $$ > "$PID_FILE"
exec >>"$LOG_FILE" 2>&1

log() {
  printf '[overnight-data-push] %s\n' "$*"
}

run_step() {
  local name="$1"
  shift
  log "START $name"
  if "$@"; then
    log "DONE  $name"
  else
    log "FAIL  $name"
  fi
}

log "Log file: $LOG_FILE"
log "PID file: $PID_FILE"
log "Starting curated overnight data push"

run_step "run-scraping-agents" npx tsx scripts/run-scraping-agents.mjs --force
run_step "social-traders" node --env-file=.env scripts/ingest-social-traders.mjs
run_step "buyability" node --env-file=.env scripts/import-buyability.mjs --concurrency=4
run_step "ndis-provider-market" node --env-file=.env scripts/import-ndis-provider-market.mjs
run_step "ndis-provider-register" node --env-file=.env scripts/import-ndis-provider-register.mjs --concurrency=4
run_step "bcorp-au" node --env-file=.env scripts/import-bcorp-au.mjs --pages=10
run_step "state-se-networks" node --env-file=.env scripts/import-state-se-networks.mjs
run_step "indigenous-directories" node --env-file=.env scripts/import-indigenous-directories.mjs
run_step "lobbying-register" node --env-file=.env scripts/import-lobbying-register.mjs --skip-download
run_step "government-grants" node --env-file=.env scripts/import-gov-grants.mjs
run_step "discover-foundation-programs" env LIMIT=40 CONCURRENCY=1 PROVIDER=minimax MODE=strict-public bash scripts/run-discover-foundation-programs.sh
run_step "sync-foundation-programs" node --env-file=.env scripts/sync-foundation-programs.mjs --cleanup-invalid
run_step "enrich-foundations" node --env-file=.env scripts/enrich-foundations.mjs --limit=100 --provider=minimax
run_step "classify-foundation-power-profiles" node --env-file=.env scripts/classify-foundation-power-profiles.mjs
run_step "enrich-charities" npx tsx scripts/enrich-charities.mjs --limit=100 --concurrency=2 --provider=minimax
run_step "enrich-social-enterprises" bash scripts/run-enrich-social-enterprises.sh
run_step "enrich-social-enterprises-oric" env LIMIT=150 CONCURRENCY=1 PROVIDER=minimax SOURCE=oric bash scripts/run-enrich-social-enterprises.sh
run_step "classify-acnc-social-enterprises" node --env-file=.env scripts/classify-acnc-social-enterprises.mjs --apply --limit=100 --min-confidence=0.7
run_step "profile-community-orgs" npx tsx scripts/profile-community-orgs.mjs --limit 500
run_step "data-gap-audit" node --env-file=.env scripts/data-gap-audit.mjs
run_step "power-coverage-brief" node --env-file=.env scripts/power-coverage-brief.mjs
run_step "philanthropy-power-brief" npx tsx scripts/philanthropy-power-brief.ts

log "Overnight data push finished"
log "Log file: $LOG_FILE"
