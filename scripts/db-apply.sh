#!/usr/bin/env bash
# The one way to apply a migration to the shared Supabase project.
#
#   scripts/db-apply.sh supabase/migrations/20260905141000_some_change.sql
#
# 1. Refuses a file that is not under supabase/migrations/ or lacks a 14-digit version prefix.
# 2. Refuses if the version is already in supabase_migrations.schema_migrations.
# 3. Runs the file with psql -v ON_ERROR_STOP=1 (a failing statement rolls back the file's transaction;
#    write BEGIN/COMMIT in the file).
# 4. On success inserts the version + name into the tracker, so scripts/check-migration-parity.mjs and any
#    other repo can see the schema moved.
#
# Tier 3 in the workflow rules: run only on Ben's explicit verb. Needs DATABASE_PASSWORD in .env.
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:-}"
[[ -n "$FILE" ]] || { echo "usage: scripts/db-apply.sh supabase/migrations/<version>_<name>.sql" >&2; exit 2; }
[[ "$FILE" == supabase/migrations/*.sql ]] || { echo "refusing: migrations live in supabase/migrations/ only" >&2; exit 2; }
BASE="$(basename "$FILE" .sql)"
VERSION="${BASE:0:14}"
NAME="${BASE:15}"
[[ "$VERSION" =~ ^[0-9]{14}$ ]] || { echo "refusing: '$BASE' has no 14-digit version prefix" >&2; exit 2; }
[[ -f .env ]] && set -a && source .env && set +a
: "${DATABASE_PASSWORD:?DATABASE_PASSWORD not set (Supabase Dashboard > Settings > Database)}"
PSQL=(psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -v ON_ERROR_STOP=1 -q)
export PGPASSWORD="$DATABASE_PASSWORD"
already="$("${PSQL[@]}" -tAc "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='$VERSION'")"
[[ "$already" == "0" ]] || { echo "refusing: version $VERSION is already in the tracker" >&2; exit 3; }
echo "→ applying $FILE"
"${PSQL[@]}" -f "$FILE"
"${PSQL[@]}" -c "INSERT INTO supabase_migrations.schema_migrations (version, name, statements, created_by) VALUES ('$VERSION', '$NAME', '{}', 'scripts/db-apply.sh $(whoami) $(date -u +%Y-%m-%dT%H:%MZ)')"
echo "✓ applied and tracked as $VERSION ($NAME)"
echo "  next: regenerate supabase/types/database.types.ts and run scripts/check-migration-parity.mjs"
