#!/usr/bin/env bash
# Regenerate supabase/types/database.types.ts.
#
# The one working route for this project, found the hard way on 2026-09-21.
#
# What does NOT work, so nobody re-derives it:
#   - the Supabase MCP: returns "Unauthorized", no SUPABASE_ACCESS_TOKEN is set
#   - `--project-id`: needs that same access token
#   - DATABASE_URL from .env: points at db.<ref>.supabase.co, which DOES NOT
#     RESOLVE. Direct IPv4 is gone from this project; the pooler is the only way
#     in. That env var is stale for every purpose, not just this one.
#
# What the real error was: `LegacyDockerRunError`. `supabase gen types` runs
# postgres-meta in Docker, so it fails with a connection-shaped message when the
# DAEMON is down, which reads like a network problem and is not one. Start
# Docker Desktop first.
#
# BOTH schemas are required. Generating with `--schema public` alone silently
# drops the graphql_public block that the committed file carries.
#
#   ./scripts/gen-types.sh
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop (open -a Docker), wait for it, then re-run." >&2
  exit 1
fi

URL="postgresql://postgres.tednluwflfhxyucgwigh:${DATABASE_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"
OUT=supabase/types/database.types.ts
TMP=$(mktemp)

npx --yes supabase gen types typescript --db-url "$URL" \
  --schema public --schema graphql_public > "$TMP"

# A truncated generation would silently blank the types and typecheck "fine" in
# files that do not use them. Refuse anything obviously short.
lines=$(wc -l < "$TMP")
if [ "$lines" -lt 1000 ]; then
  echo "generated file is only $lines lines; refusing to overwrite $OUT" >&2
  exit 1
fi
for block in "  public: {" "  graphql_public: {"; do
  grep -qF "$block" "$TMP" || { echo "generated file is missing '$block'; refusing" >&2; exit 1; }
done

mv "$TMP" "$OUT"
echo "wrote $OUT ($lines lines)"
echo "next: cd apps/web && npx tsc --noEmit"
