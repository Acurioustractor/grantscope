#!/usr/bin/env bash
# One command for the repo's documented health stack, so /ship and /ship-merge have a single gate
# to call instead of remembering two. Mirrors CLAUDE.md "Health Stack".
#
# Usage: scripts/precheck.sh [--fast|--build|--no-build]
#   --fast      typecheck only. For a mid-work sanity check, NOT for a push.
#   --build     force the production build step.
#   --no-build  skip it even when the diff says it is needed. Escape hatch, not a default.
#
# WHY A BUILD STEP AT ALL (2026-08-19). PR #289 passed tsc and 742 tests, then hung the
# Vercel build twice and had to be closed. tsc and vitest never compile the app, so adding
# a dependency or touching the root layout can break the build past a fully green gate.
# Running `next build` on every invocation would cost ~5 minutes each time, so it runs only
# when the diff touches something that can break a build without breaking a typecheck.
set -euo pipefail

cd "$(dirname "$0")/.."

FAST=0
FORCE_BUILD=0
SKIP_BUILD=0
case "${1:-}" in
  --fast)     FAST=1 ;;
  --build)    FORCE_BUILD=1 ;;
  --no-build) SKIP_BUILD=1 ;;
esac

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

# ── production build, when the diff can break one without breaking tsc ────────────
BASE="$(git merge-base HEAD origin/main 2>/dev/null || echo HEAD)"
CHANGED="$(git diff --name-only "$BASE" 2>/dev/null; git diff --name-only --cached 2>/dev/null; git ls-files -m 2>/dev/null)"
BUILD_TRIGGER=""
while read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    */package.json|package.json)       BUILD_TRIGGER="a dependency change ($f)" ;;
    pnpm-lock.yaml|*/pnpm-lock.yaml)   BUILD_TRIGGER="a lockfile change ($f)" ;;
    apps/web/next.config.*)            BUILD_TRIGGER="a Next config change ($f)" ;;
    apps/web/src/app/layout.tsx)       BUILD_TRIGGER="the root layout ($f)" ;;
    apps/web/src/middleware.ts)        BUILD_TRIGGER="middleware ($f)" ;;
  esac
done <<< "$CHANGED"

if [[ $SKIP_BUILD -eq 1 ]]; then
  [[ -n "$BUILD_TRIGGER" ]] && echo "⚠ --no-build: skipping the build this diff asked for ($BUILD_TRIGGER)."
elif [[ $FORCE_BUILD -eq 1 || -n "$BUILD_TRIGGER" ]]; then
  if [[ -n "$BUILD_TRIGGER" ]]; then
    echo "→ production build (next build) — required because the diff touches $BUILD_TRIGGER"
  else
    echo "→ production build (next build) — forced with --build"
  fi
  ( cd apps/web && npx next build )
  echo "✓ production build"
fi

echo "✓ precheck passed"
