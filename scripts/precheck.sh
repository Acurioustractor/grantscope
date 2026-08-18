#!/usr/bin/env bash
# One command for the repo's documented health stack, so /ship and /ship-merge have a single gate
# to call instead of remembering two. Mirrors CLAUDE.md "Health Stack".
#
# Usage: scripts/precheck.sh [--fast]
#   --fast  typecheck only. For a mid-work sanity check, NOT for a push.
set -euo pipefail

cd "$(dirname "$0")/.."

FAST=0
[[ "${1:-}" == "--fast" ]] && FAST=1

echo "→ typecheck (tsc --noEmit)"
( cd apps/web && npx tsc --noEmit )
echo "✓ typecheck"

if [[ $FAST -eq 1 ]]; then
  echo "⚠ --fast: tests skipped. Do not push on this."
  exit 0
fi

echo "→ tests (vitest run)"
( cd apps/web && npx vitest run )
echo "✓ tests"

echo "✓ precheck passed"
