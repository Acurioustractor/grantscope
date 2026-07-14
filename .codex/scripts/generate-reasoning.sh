#!/usr/bin/env bash
# Generate a compact reasoning note for a commit.
#
# Usage:
#   bash .codex/scripts/generate-reasoning.sh <commit-hash> "<commit-message>"
#
# The GrantScope commit skill calls this after commits. Keep this script
# deterministic: it records verified git facts and a human-fillable reasoning
# scaffold, without inventing implementation rationale.

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <commit-hash> <commit-message>" >&2
  exit 2
fi

COMMIT_HASH="$1"
COMMIT_MESSAGE="$2"

if ! git rev-parse --verify "${COMMIT_HASH}^{commit}" >/dev/null 2>&1; then
  echo "Commit not found: ${COMMIT_HASH}" >&2
  exit 2
fi

SHORT_HASH="$(git rev-parse --short "$COMMIT_HASH")"
COMMIT_DATE="$(git show -s --format=%cI "$COMMIT_HASH")"
AUTHOR_NAME="$(git show -s --format=%an "$COMMIT_HASH")"
AUTHOR_EMAIL="$(git show -s --format=%ae "$COMMIT_HASH")"
OUT_DIR=".codex/reasoning"
OUT_FILE="${OUT_DIR}/${SHORT_HASH}.md"

mkdir -p "$OUT_DIR"

{
  echo "# Commit Reasoning: ${SHORT_HASH}"
  echo
  echo "- Commit: \`${COMMIT_HASH}\`"
  echo "- Message: ${COMMIT_MESSAGE}"
  echo "- Date: ${COMMIT_DATE}"
  echo "- Author: ${AUTHOR_NAME} <${AUTHOR_EMAIL}>"
  echo
  echo "## Summary"
  echo
  git show --stat --oneline --no-renames "$COMMIT_HASH"
  echo
  echo "## Changed Files"
  echo
  git diff-tree --no-commit-id --name-status -r "$COMMIT_HASH" | sed 's/^/- /'
  echo
  echo "## Reasoning Notes"
  echo
  echo "- Intent: recorded by the commit message and changed files above."
  echo "- Risk areas: review the changed files and validation output from the commit session."
  echo "- Validation: fill in with checks run for this commit when needed."
  echo
  echo "## Diff Summary"
  echo
  git show --summary --format=fuller --no-renames "$COMMIT_HASH"
} > "$OUT_FILE"

echo "Wrote ${OUT_FILE}"
