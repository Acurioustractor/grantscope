#!/usr/bin/env bash
# Regenerate supabase/types/database.types.ts.
#
# The one working route for this project, found the hard way on 2026-09-21.
#
# What does NOT work, so nobody re-derives it:
#   - the Supabase MCP: returns "Unauthorized", no SUPABASE_ACCESS_TOKEN is set
#   - `--project-id`: needs that same access token
#   - DATABASE_URL from .env: points at db.<ref>.supabase.co, which is
#     IPv6-ONLY. It has an AAAA record and no A record, so on a host without
#     IPv6 routing getaddrinfo fails and psql reports
#     "could not translate host name", which reads like a dead hostname and is
#     not one. Supabase moved direct connections to IPv6-only; the pooler
#     (aws-0-ap-southeast-2.pooler.supabase.com) is the way in from here.
#
#     Corrected 2026-09-21. This comment previously said the host "DOES NOT
#     RESOLVE", which sends the next person hunting a dead DNS record instead
#     of an IPv6 route or the IPv4 add-on.
#
#     DATABASE_URL is also a DIFFERENT CREDENTIAL from DATABASE_PASSWORD, not
#     the same secret in another wrapper: the password inside the URL fails
#     against the pooler with "password authentication failed". Scripts that
#     need psql want DATABASE_PASSWORD.
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
