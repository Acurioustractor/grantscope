#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/benknight/Code/grantscope"
cd "$ROOT"

LIMIT="${LIMIT:-40}"
CONCURRENCY="${CONCURRENCY:-1}"
PROVIDER="${PROVIDER:-minimax}"
MODE="${MODE:-strict-public}"

exec npx tsx scripts/discover-foundation-programs.mjs --limit="$LIMIT" --concurrency="$CONCURRENCY" --provider="$PROVIDER" --mode="$MODE"
