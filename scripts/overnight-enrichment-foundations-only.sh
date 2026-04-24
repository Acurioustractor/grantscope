#!/bin/bash
# Overnight Enrichment — runs all 3 enrichment scripts sequentially
# to maximize throughput without rate limit collisions.
#
# Usage: bash scripts/overnight-enrichment.sh

set -e
cd "$(dirname "$0")/.."

echo "=== OVERNIGHT ENRICHMENT START: $(date) ==="
echo ""

# Phase 1: Re-profile foundations missing descriptions (3,500 targets)
echo "--- Phase 1: Re-profile foundations (missing descriptions) ---"
echo "Started: $(date)"
npx tsx scripts/reprofile-missing-descriptions.mjs --limit=500 --concurrency=2 || true
echo "Phase 1 complete: $(date)"
echo ""

# Phase 2: Enrich unenriched foundations (1,881 targets)
echo "--- Phase 2: Enrich unenriched foundations ---"
echo "Started: $(date)"
npx tsx scripts/build-foundation-profiles.mjs --limit=500 --concurrency=2 || true
echo "Phase 2 complete: $(date)"
echo ""

# Phase 3: Enrich charities (community_orgs, ~500 targets)
echo "--- Phase 3: Enrich charities ---"
echo "Started: $(date)"
npx tsx scripts/enrich-charities.mjs --limit=500 --concurrency=2 || true
echo "Phase 3 complete: $(date)"
echo ""

# Round 2 — go again with fresh rate limits
echo "--- Round 2: Re-profile foundations ---"
echo "Started: $(date)"
npx tsx scripts/reprofile-missing-descriptions.mjs --limit=500 --concurrency=2 || true
echo "Round 2 Phase 1 complete: $(date)"
echo ""

echo "--- Round 2: Enrich foundations ---"
echo "Started: $(date)"
npx tsx scripts/build-foundation-profiles.mjs --limit=500 --concurrency=2 || true
echo "Round 2 Phase 2 complete: $(date)"
echo ""

echo "--- Round 2: Enrich charities ---"
echo "Started: $(date)"
npx tsx scripts/enrich-charities.mjs --limit=500 --concurrency=2 || true
echo "Round 2 Phase 3 complete: $(date)"
echo ""

echo "=== OVERNIGHT ENRICHMENT COMPLETE: $(date) ==="
