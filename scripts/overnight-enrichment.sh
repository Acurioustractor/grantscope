#!/usr/bin/env bash
# Overnight data enrichment sweep — hardens the data behind the strategic
# investigations (Consulting Class, Indigenous Proxy, Revolving Door, Board
# Interlocks) and closes gaps against the Path D repositioning.
#
# Usage:
#   bash scripts/overnight-enrichment.sh              # full sweep
#   bash scripts/overnight-enrichment.sh --skip-geo   # skip phase 2
#   bash scripts/overnight-enrichment.sh --start=3    # resume at phase 3
#   bash scripts/overnight-enrichment.sh --dry-run    # preview only
#
# Each phase runs sequentially. Individual agent failures do not abort the
# sweep. Phase outputs are logged to logs/overnight-YYYYMMDD-HHMMSS.log.
#
# Expected runtime:
#   Phase 1 (ABN):        60-90 min
#   Phase 2 (Geo):        45-60 min
#   Phase 3 (Classify):   30-60 min (LLM rate-limited)
#   Phase 4 (Linkage):    60-90 min
#   Phase 5 (Profiles):   45-60 min
#   Phase 6 (MVs):        10-20 min
#   Phase 7 (Audit):      5 min
#   Total:                ~4-6 hours
#
# Safe to interrupt with Ctrl-C. Resume from the last completed phase.
# Previous narrow foundations-only script preserved at
# scripts/overnight-enrichment-foundations-only.sh

set -u
cd "$(dirname "$0")/.."

STAMP=$(date +%Y%m%d-%H%M%S)
LOG_DIR="logs"
LOG_FILE="$LOG_DIR/overnight-$STAMP.log"
mkdir -p "$LOG_DIR"

# Parse flags
START_PHASE=1
SKIP_PHASES=""
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --start=*) START_PHASE="${arg#*=}" ;;
    --skip-geo) SKIP_PHASES="$SKIP_PHASES 2" ;;
    --skip-classify) SKIP_PHASES="$SKIP_PHASES 3" ;;
    --skip-profiles) SKIP_PHASES="$SKIP_PHASES 5" ;;
    --dry-run) DRY_RUN=1 ;;
  esac
done

log() {
  local msg="[$(date +%H:%M:%S)] $*"
  echo "$msg" | tee -a "$LOG_FILE"
}

run_agent() {
  local label="$1"
  shift
  log "▶ $label"
  if [ "$DRY_RUN" = "1" ]; then
    log "  DRY-RUN: would run $*"
    return 0
  fi
  local start_ts
  start_ts=$(date +%s)
  if "$@" >>"$LOG_FILE" 2>&1; then
    local dur=$(( $(date +%s) - start_ts ))
    log "  ✓ $label (${dur}s)"
  else
    local dur=$(( $(date +%s) - start_ts ))
    log "  ✗ $label FAILED after ${dur}s — continuing"
  fi
}

run_sql() {
  local label="$1"
  local query="$2"
  log "▶ $label"
  if [ "$DRY_RUN" = "1" ]; then
    log "  DRY-RUN: would run SQL"
    return 0
  fi
  if node --env-file=.env scripts/gsql.mjs "$query" >>"$LOG_FILE" 2>&1; then
    log "  ✓ $label"
  else
    log "  ✗ $label FAILED — continuing"
  fi
}

should_run_phase() {
  local phase="$1"
  if [ "$phase" -lt "$START_PHASE" ]; then return 1; fi
  for skip in $SKIP_PHASES; do
    if [ "$phase" = "$skip" ]; then return 1; fi
  done
  return 0
}

snapshot_before() {
  log "=== PRE-SWEEP DATA HEALTH ==="
  run_sql "pre: entity coverage" \
    "SELECT COUNT(*) FILTER (WHERE abn IS NULL) as no_abn, COUNT(*) FILTER (WHERE lga_name IS NULL) as no_lga, COUNT(*) FILTER (WHERE sector IS NULL) as no_sector, COUNT(*) FILTER (WHERE is_community_controlled) as cc_flagged FROM gs_entities"
  run_sql "pre: ALMA linkage" \
    "SELECT COUNT(*) FILTER (WHERE gs_entity_id IS NULL) as unlinked, COUNT(*) FILTER (WHERE gs_entity_id IS NOT NULL) as linked FROM alma_interventions"
  run_sql "pre: foundation enrichment" \
    "SELECT COUNT(*) FILTER (WHERE enriched_at IS NULL) as unenriched FROM foundations"
}

snapshot_after() {
  log "=== POST-SWEEP DATA HEALTH ==="
  run_sql "post: entity coverage" \
    "SELECT COUNT(*) FILTER (WHERE abn IS NULL) as no_abn, COUNT(*) FILTER (WHERE lga_name IS NULL) as no_lga, COUNT(*) FILTER (WHERE sector IS NULL) as no_sector, COUNT(*) FILTER (WHERE is_community_controlled) as cc_flagged FROM gs_entities"
  run_sql "post: ALMA linkage" \
    "SELECT COUNT(*) FILTER (WHERE gs_entity_id IS NULL) as unlinked, COUNT(*) FILTER (WHERE gs_entity_id IS NOT NULL) as linked FROM alma_interventions"
  run_sql "post: foundation enrichment" \
    "SELECT COUNT(*) FILTER (WHERE enriched_at IS NULL) as unenriched FROM foundations"
  run_sql "post: relationships by type" \
    "SELECT relationship_type, COUNT(*) FROM gs_relationships GROUP BY relationship_type ORDER BY count DESC LIMIT 10"
}

CURRENT_PHASE=0
trap 'log "Interrupted — resume with --start=$CURRENT_PHASE"; exit 130' INT

log "CivicGraph overnight enrichment sweep"
log "Log: $LOG_FILE"
log "Start phase: $START_PHASE · Skip: '$SKIP_PHASES' · Dry-run: $DRY_RUN"

snapshot_before

# ─── Phase 1: ABN backfill (highest leverage — every other linker depends on this)
CURRENT_PHASE=1
if should_run_phase 1; then
  log ""
  log "═══════════════════════════════════════════════════════════"
  log "PHASE 1 — ABN backfill (target: reduce 247K gap)"
  log "═══════════════════════════════════════════════════════════"
  run_agent "ABR → gs_entities ABNs"           node --env-file=.env scripts/backfill-acn-from-abr.mjs
  run_agent "ORIC Indigenous corp ABNs"        node --env-file=.env scripts/backfill-oric-abns.mjs
  run_agent "QGIP Indigenous procurement ABNs" node --env-file=.env scripts/backfill-qgip-abns.mjs
  run_agent "AusTender supplier → entities"    node --env-file=.env scripts/backfill-austender-entities.mjs
  run_agent "Create missing entities (ABR)"    node --env-file=.env scripts/enrich-create-missing-entities.mjs
fi

# ─── Phase 2: Geography backfill
CURRENT_PHASE=2
if should_run_phase 2; then
  log ""
  log "═══════════════════════════════════════════════════════════"
  log "PHASE 2 — Geography backfill (target: reduce 288K LGA gap)"
  log "═══════════════════════════════════════════════════════════"
  run_agent "Postcodes from ABR"           node --env-file=.env scripts/backfill-postcodes-from-abr.mjs
  run_agent "Postcodes from ABR API"       node --env-file=.env scripts/backfill-postcodes-from-abr-api.mjs
  run_agent "Postcodes from ORIC"          node --env-file=.env scripts/backfill-postcodes-from-oric.mjs
  run_agent "SA2 codes"                    node --env-file=.env scripts/backfill-sa2-codes.mjs
  run_agent "Remoteness from ABS"          node --env-file=.env scripts/backfill-remoteness-from-abs.mjs
  run_agent "Entity remoteness (MV join)"  node --env-file=.env scripts/backfill-entity-remoteness.mjs
  run_agent "Geo enrichment (LGA + place)" node --env-file=.env scripts/enrich-entities-geo.mjs
fi

# ─── Phase 3: Classification (Indigenous flag, sector, social enterprise, foundations)
CURRENT_PHASE=3
if should_run_phase 3; then
  log ""
  log "═══════════════════════════════════════════════════════════"
  log "PHASE 3 — Classification (Indigenous flag, sector)"
  log "═══════════════════════════════════════════════════════════"
  run_agent "Community-controlled classifier"   node --env-file=.env scripts/classify-community-controlled.mjs
  run_agent "ACNC social enterprise classifier" node --env-file=.env scripts/classify-acnc-social-enterprises.mjs
  run_agent "Foundations classifier"            node --env-file=.env scripts/classify-foundations.mjs
  run_agent "Foundation power profiles"         node --env-file=.env scripts/classify-foundation-power-profiles.mjs
  run_agent "Entity enrichment (sector + desc)" node --env-file=.env scripts/enrich-entities.mjs
  run_agent "Charity enrichment"                node --env-file=.env scripts/enrich-charities.mjs
fi

# ─── Phase 4: Cross-system linkage (justice ↔ graph, ALMA, person roles)
CURRENT_PHASE=4
if should_run_phase 4; then
  log ""
  log "═══════════════════════════════════════════════════════════"
  log "PHASE 4 — Linkage (ALMA, justice, people, interlocks)"
  log "═══════════════════════════════════════════════════════════"
  run_agent "ALMA → entity linker (90% unlinked)" node --env-file=.env scripts/enrich-alma-orgs.mjs
  run_agent "Justice funding → entity bridge"     node --env-file=.env scripts/bridge-justice-funding.mjs
  run_agent "Justice → graph (relationships)"     node --env-file=.env scripts/bridge-justice-to-graph.mjs
  run_agent "Person roles bridge"                 node --env-file=.env scripts/bridge-person-roles.mjs
  run_agent "Person network builder"              node --env-file=.env scripts/build-person-network.mjs
  run_agent "Cross-system linker"                 node --env-file=.env scripts/civic-cross-linker.mjs
  run_agent "Donor-contract crossover check"      node --env-file=.env scripts/check-donor-contract-crossover.mjs
fi

# ─── Phase 5: Profiles + embeddings + mega-linker
CURRENT_PHASE=5
if should_run_phase 5; then
  log ""
  log "═══════════════════════════════════════════════════════════"
  log "PHASE 5 — Profiles + mega-linker"
  log "═══════════════════════════════════════════════════════════"
  run_agent "Reprofile missing descriptions"  npx tsx scripts/reprofile-missing-descriptions.mjs --limit=500 --concurrency=2
  run_agent "Foundation profiles"             npx tsx scripts/build-foundation-profiles.mjs --limit=500 --concurrency=2
  run_agent "Entity graph builder"            node --env-file=.env scripts/build-entity-graph.mjs
  run_agent "Money flow aggregates"           node --env-file=.env scripts/build-money-flow-data.mjs
  run_agent "Entity embeddings"               node --env-file=.env scripts/backfill-entity-embeddings.mjs
  run_agent "Foundation embeddings"           node --env-file=.env scripts/backfill-foundation-embeddings.mjs
  # Mega-linker is destructive — dry-run only. Pass --live separately if you want writes.
  run_agent "Mega-linker (DRY-RUN)"           node --env-file=.env scripts/link-entities-mega.mjs
fi

# ─── Phase 6: Materialized views
CURRENT_PHASE=6
if should_run_phase 6; then
  log ""
  log "═══════════════════════════════════════════════════════════"
  log "PHASE 6 — Refresh materialized views"
  log "═══════════════════════════════════════════════════════════"
  run_agent "Refresh all MVs (dependency order)" node --env-file=.env scripts/refresh-views.mjs
fi

# ─── Phase 7: Audit + report
CURRENT_PHASE=7
if should_run_phase 7; then
  log ""
  log "═══════════════════════════════════════════════════════════"
  log "PHASE 7 — Audit + final report"
  log "═══════════════════════════════════════════════════════════"
  run_agent "Data gap audit"            node --env-file=.env scripts/data-gap-audit.mjs
  run_agent "Contract alerts check"     node --env-file=.env scripts/check-contract-alerts.mjs
  run_agent "Entity watches check"      node --env-file=.env scripts/check-entity-watches.mjs
fi

snapshot_after

log ""
log "═══════════════════════════════════════════════════════════"
log "SWEEP COMPLETE"
log "Log: $LOG_FILE"
log "Next: review the pre/post deltas above. Expect biggest wins in:"
log "  - gs_entities.abn coverage (should drop from 247K gap)"
log "  - alma_interventions.gs_entity_id linkage (target: <50 unlinked)"
log "  - gs_entities.sector (target: <200K gap)"
log "═══════════════════════════════════════════════════════════"
