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

# Vercel provides the previous deployment's SHA.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [[ -z "$BASE" ]]; then
  # Production without it: no diff, so build.
  if [[ "${VERCEL_ENV:-}" == "production" ]]; then
    echo "no VERCEL_GIT_PREVIOUS_SHA on production — building"
    exit 1
  fi
  # A branch's FIRST preview never has one, so every migration branch paid a 6-9 minute
  # preview build nobody opened: 22 previews in the three days to 2026-09-27, most of them db/
  # branches whose production build this script then skipped.
  #
  # Compare with where the branch left main instead. Vercel's build machine cannot fetch main
  # (tried 2026-09-27: the fetch failed), but its shallow clone holds the branch's recent history,
  # and every PR lands on main as one squash commit whose subject ends "(#N)". The newest such
  # commit below HEAD is the branch point. None within reach: build, as before.
  BASE="$(git log --format='%H %s' -n 30 HEAD~1 2>/dev/null | awk '$NF ~ /^\(#[0-9]+\)$/ { print $1; exit }')"
  if [[ -z "$BASE" ]]; then
    echo "no VERCEL_GIT_PREVIOUS_SHA and no merged PR commit in this clone — building"
    exit 1
  fi
  echo "first preview of ${VERCEL_GIT_COMMIT_REF:-this branch}: comparing with $(git log -1 --format='%h %s' "$BASE" | cut -c1-80)"
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
  # An empty diff means a redeploy of the same commit, and a push never produces one. Redeploys
  # exist to pick up changed environment variables, which only a new build can do: skipping here
  # cancelled the 2026-09-28 redeploy for GRANTSCOPE_SYNC_SECRET and left the Goods feed on 503.
  echo "no changed files vs $BASE — a deliberate redeploy, building"
  exit 1
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
