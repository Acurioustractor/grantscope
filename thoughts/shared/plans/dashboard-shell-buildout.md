# Dashboard shell build-out — chrome elements → real data

**2026-08-16.** Ben's direction after the first shell slice: take the full chrome vocabulary of a
mature dashboard (shadcn demo reference) — notifications, profile, dropdowns, help centre, docs —
and wire each one to data we actually hold. Rule: **no chrome without a data source.** A
notification bell with fake dots is worse than no bell.

## Element → data backing

| Chrome element | Backed by (verified objects) | Notes |
|---|---|---|
| **Notifications** | `agent_runs` (status/failures), `mv_refresh_log` (stale/garbage MVs), watchhouse snapshot arrivals | "Data events", not social noise. Failure of a nightly refresh IS the user's business here. |
| **Profile menu** | Supabase auth user + `org_profiles` (tier), impersonation cookie | Sign out, account, admin links when admin. |
| **Help centre** | The 26-question clarity registry + view caveats from `view-registry.ts` + the three money filters | Our docs ARE the provenance. "Why is this number smaller than the press release?" is the #1 help topic. |
| **Documentation** | `thoughts/shared/data-map/` distilled to public-safe pages | Phase 2 — needs a public-safety pass first (the map names private ACT systems). |
| **Dropdowns/selects** | Year ranges from `financial_year` actuals, states, topics from the tag vocabulary | Never hardcode a year list that rots. |
| **Command menu (⌘K)** | Existing GlobalSearch — extend with "jump to view" from the registry | Registry entries become searchable actions. |
| **Empty/error states** | The caveat + sentinel text from DASHBOARD-VIEW-MAP | An empty chart states *why* (e.g. "matview refreshed 0 rows") — we already log this. |

## Build order

1. **Shell menus (this slice):** notifications popover (agent_runs + refresh log), profile
   dropdown, help menu. One client component, data from the server layout.
2. **Shell adoption:** wrap /search and /clarity in the shell so nav stops teleporting between
   layouts.
3. **Help centre page** (`/dashboard/help`): the money filters explained in plain words, the
   view caveats, the question registry index.
4. **ACCO tile + per-view pages:** each registry view gets a real page target.
5. **Docs surface** (public-safe subset of the data map). Needs its own pass.

## Component discipline

Shell components live in `src/app/dashboard/` while the shell owns one route; promote to
`src/components/shell/` when /search adopts it (step 2). Tokens only from `.shell` vars — no
new hex values in components.
