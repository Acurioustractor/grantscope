#!/bin/bash
# Overnight enrichment pipeline
# Runs: entity resolution → relationship extraction → enrichment agents → MV refresh
set -e

cd "$(dirname "$0")/.."
LOG="output/enrichment-$(date +%Y%m%d-%H%M%S).log"
mkdir -p output

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

log "=== Enrichment Pipeline Started ==="

# Phase 1: Entity resolution
log "Phase 1: Entity resolution..."
node --env-file=.env scripts/engine-entity-resolution.mjs 2>&1 | tee -a "$LOG"
log "Phase 1 complete."

# Phase 2: Relationship extraction
log "Phase 2: Relationship extraction..."
node --env-file=.env scripts/engine-relationship-extraction.mjs 2>&1 | tee -a "$LOG"
log "Phase 2 complete."

# Phase 3: Enrichment agents (parallel-safe)
log "Phase 3: Enrichment agents..."
for agent in \
  enrich-from-acnc.mjs \
  enrich-from-oric.mjs \
  enrich-companies-from-abr.mjs \
  enrich-companies-from-asic.mjs \
  enrich-postcodes-from-abn.mjs \
  enrich-lga.mjs \
  enrich-foundations.mjs \
  enrich-charities.mjs \
  enrich-social-enterprises.mjs \
  enrich-entity-identifiers.mjs \
  enrich-fuzzy-abn-match.mjs; do
  if [ -f "scripts/$agent" ]; then
    log "  Running $agent..."
    node --env-file=.env "scripts/$agent" 2>&1 | tail -3 | tee -a "$LOG"
    log "  $agent done."
  else
    log "  SKIP $agent (not found)"
  fi
done

# Phase 4: Refresh materialized views
log "Phase 4: Refreshing materialized views..."
node --env-file=.env scripts/refresh-views.mjs 2>&1 | tee -a "$LOG"
log "Phase 4 complete."

log "=== Enrichment Pipeline Complete ==="
