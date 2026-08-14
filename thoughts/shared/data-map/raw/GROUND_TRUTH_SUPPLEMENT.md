# GROUND TRUTH SUPPLEMENT — beyond tables

Collected 2026-08-14 by direct psql. Covers the objects a table-only census misses.
Companion to `GROUND_TRUTH.md`.

## Full public-schema object count: 1,024

| Kind | Count |
|---|---|
| tables (`r`) | 714 |
| materialized views (`m`) | 98 |
| **regular views (`v`)** | **212** |
| **total** | **1,024** |

The 212 regular views were NOT in the original 812-object census. They are catalogued in
`views.csv` (view_name, owner, definition length).

## Database functions / RPCs: 410

Catalogued in `functions.csv` (proname, args, language, prokind). These matter because the apps
call them via `.rpc()` — a data map that only lists tables misses the entire RPC surface.
`prokind`: f = function, p = procedure, a = aggregate, w = window.

## Scheduled jobs (pg_cron): 5, all active

| jobid | schedule | name |
|---|---|---|
| 1 | `*/15 * * * *` | retry-missed-reactions |
| 2 | `0 3 * * *` | cleanup-pg-net-responses |
| 4 | `0 17 * * *` | refresh-civicgraph-mvs-nightly |
| 9 | `0 4 * * *` | act-auto-pass-stale-pipeline |
| 10 | `30 17 * * *` | refresh-closing-the-gap-state-summary |

Only ONE job (`refresh-civicgraph-mvs-nightly`, 17:00 UTC) refreshes the 98 materialized views.
Any matview not in that job's body is silently stale — this is the freshness question the
catalog UI must answer.

## Row-level security

- RLS enabled: **693** tables
- RLS **disabled: 21** tables

The 21 without RLS are worth a look on a database that serves two public-facing apps with an
anon key. Not necessarily wrong (service-role-only pipeline tables are fine), but it should be
a deliberate list, not an accident.

## Other schemas

`auth` 23 · `realtime` 9 · `storage` 8 · `extensions` 2 · `net` 2 · `supabase_migrations` 2 ·
`vault` 2 · `cron` 2 · `drizzle` 1

The presence of a `drizzle` schema alongside Supabase migrations suggests two migration systems
have been used at different times — worth confirming which is authoritative.

## Files

`views.csv` · `functions.csv` — both in this scratchpad directory.
