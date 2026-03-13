#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/benknight/Code/grantscope"
cd "$ROOT"

LIMIT="${LIMIT:-150}"
CONCURRENCY="${CONCURRENCY:-1}"
PROVIDER="${PROVIDER:-minimax}"
SOURCE="${SOURCE:-}"

CMD=(node --env-file=.env scripts/enrich-social-enterprises.mjs --limit="$LIMIT" --concurrency="$CONCURRENCY" --provider="$PROVIDER")
if [[ -n "$SOURCE" ]]; then
  CMD+=("--source=$SOURCE")
fi

exec "${CMD[@]}"
