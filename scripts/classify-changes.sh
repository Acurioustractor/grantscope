#!/usr/bin/env bash
# VISIBLE vs SAFE, for the /ship-merge landing posture.
#
# SAFE   → the loop may merge on green CI without asking.
# VISIBLE→ the loop pushes and opens the PR, then STOPS so Ben can eyeball the Vercel preview.
#
# The distinction is "could a human land on this and see something wrong before we do". Backend,
# ops/admin, migrations, scripts, docs and .claude/ (skills, rules: agent tooling that never renders) are SAFE because a mistake there shows up in CI, in the
# data, or on a screen only Ben uses. Anything that renders to a visitor or a buyer is VISIBLE.
#
# Deliberately fails toward VISIBLE: an unrecognised path is treated as public. Being asked about
# a safe change costs one message; auto-merging a broken public page costs trust.
#
# Usage: scripts/classify-changes.sh [base-ref]      (default: origin/main)
# Output: "SAFE" or "VISIBLE" on stdout, plus the reasoning on stderr. Exit 0 either way.
set -euo pipefail

cd "$(dirname "$0")/.."
BASE="${1:-origin/main}"

# Committed changes vs the base, PLUS anything still in the working tree. Without the second part
# this reported "no changes -> SAFE" whenever it ran before the commit — a false SAFE, which is the
# one answer that must never be wrong, because SAFE is what auto-merges.
FILES="$(
  # Untracked files count (a new page not yet committed is still a change), but a symlinked node_modules is not:
  # .gitignore's `node_modules/` pattern does not match a symlink, so a worktree with linked deps read as VISIBLE
  # twice on 2026-09-05 for no change at all. The `|| true` matters: under pipefail, grep -v exits 1 when it has
  # nothing to filter (no untracked files), which silently failed the whole listing on the first version of this line.
  { git diff --name-only "$BASE"...HEAD; git status --porcelain | awk '{print $NF}' | { grep -vE '(^|/)node_modules$' || true; }; } | sort -u
)"
if [[ -z "$FILES" ]]; then
  echo "no changes vs $BASE and nothing uncommitted" >&2
  echo "SAFE"
  exit 0
fi

# Paths whose changes cannot surprise a visitor.
SAFE_RE='^(scripts/|migrations/|docs/|thoughts/|supabase/|\.github/|\.claude/|[^/]*\.md$|apps/web/src/lib/|apps/web/src/app/api/|apps/web/src/app/ops/|apps/web/src/app/admin/|apps/web/tests/|.*\.test\.(ts|tsx)$|apps/web/package\.json$|package\.json$)'

VISIBLE_FILES=()
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [[ ! "$f" =~ $SAFE_RE ]]; then
    VISIBLE_FILES+=("$f")
  fi
done <<< "$FILES"

if [[ ${#VISIBLE_FILES[@]} -eq 0 ]]; then
  echo "all $(wc -l <<< "$FILES" | tr -d ' ') changed file(s) are backend/ops/docs" >&2
  echo "SAFE"
else
  echo "public-surface files changed (${#VISIBLE_FILES[@]}):" >&2
  printf '  %s\n' "${VISIBLE_FILES[@]}" >&2
  echo "VISIBLE"
fi
