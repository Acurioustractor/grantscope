#!/usr/bin/env bash
# Vercel "Ignored Build Step". Decides whether a commit is worth a build at all.
#
#   exit 0 -> SKIP the build   (Vercel's convention, and the opposite of intuition)
#   exit 1 -> BUILD
#
# WHY
#
# Every push to every branch was building the whole Next.js app at 4GB — 20 deployments in one
# 8.9-hour session (13 preview + 7 production), a large share of them for commits that changed no
# application code at all: migrations, ingest scripts, findings docs, the handoff ledger. A SQL file
# cannot change what Next renders, and paying a full build to prove it is money for nothing.
#
# Conservative by construction: it SKIPS only when it can see the diff and every changed path is on
# the no-build list. Anything unrecognised, any error, any missing base commit, and it BUILDS —
# a needless build costs a few cents, a wrongly-skipped one ships nothing and looks like a deploy
# that silently did not take.
set -uo pipefail

# Vercel provides the previous deployment's SHA. Without it we cannot diff, so build.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [[ -z "$BASE" ]]; then
  echo "no VERCEL_GIT_PREVIOUS_SHA — building"
  exit 1
fi

if ! git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
  echo "base $BASE not in this clone (shallow fetch?) — building"
  exit 1
fi

CHANGED="$(git diff --name-only "$BASE" HEAD 2>/dev/null)" || {
  echo "diff failed — building"
  exit 1
}

if [[ -z "$CHANGED" ]]; then
  echo "no changed files vs $BASE — skipping"
  exit 0
fi

# Paths that cannot affect what the app renders or how it builds.
NO_BUILD_RE='^(migrations/|scripts/|docs/|thoughts/|data/|supabase/|\.github/|\.claude/|[^/]*\.md$|LICENSE$)'

NEEDS_BUILD=()
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [[ ! "$f" =~ $NO_BUILD_RE ]]; then
    NEEDS_BUILD+=("$f")
  fi
done <<< "$CHANGED"

if [[ ${#NEEDS_BUILD[@]} -eq 0 ]]; then
  echo "skipping build — $(wc -l <<< "$CHANGED" | tr -d ' ') changed file(s), none affect the app:"
  sed 's/^/  /' <<< "$CHANGED" | head -20
  exit 0
fi

echo "building — ${#NEEDS_BUILD[@]} app file(s) changed:"
printf '  %s\n' "${NEEDS_BUILD[@]}" | head -20
exit 1
