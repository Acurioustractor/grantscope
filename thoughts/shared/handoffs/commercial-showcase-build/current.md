---
date: 2026-03-21T20:30:00Z
session_name: commercial-showcase-build
branch: main
status: active
---

# Work Stream: commercial-showcase-build

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-21T20:30:00Z
**Goal:** Build world-class public-facing commercial showcase pages for CivicGraph — entity intelligence, funding maps, power index, comparison, person profiles. Done when all pages work, type-check, and look professional enough to sell.
**Branch:** main
**Test:** cd apps/web && npx tsc --noEmit

### Now
[->] Ready for next feature batch — contract alerts, investigation workflow, or LGA boundary choropleth

### This Session
- [x] Entity search page + API (`/entity`, `/api/data/entity/search`)
- [x] Entity profile enhancement — power index, ATO, board members, revolving door, cross-system badges
- [x] Funding desert map + API (`/map`, `/api/data/map`) — Leaflet CircleMarker, state filter, remoteness breakdown
- [x] Map→entity linkage — click LGA shows top entities in detail panel
- [x] Power Index leaderboard (`/entity/top`, `/api/data/entity/top`) — 160K entities, filters
- [x] Entity comparison (`/entity/compare`, `/api/data/entity/compare`) — side-by-side 2-5 entities
- [x] Person profile (`/person/[name]`, `/api/data/person`) — board seats, financial footprint
- [x] Person search leaderboard (`/person`) — "Who Runs Australia?" ranked by influence
- [x] Nav mega menu — "Intelligence" section with all 6 new pages, workspace sub-nav updated
- [x] Entity network neighborhood graph — react-force-graph-2d mini graph on entity profile
- [x] Network API (`/api/data/entity/network`) — 60 relationships + 15 board members
- [x] Shared utility extraction — `lib/format.ts`, `lib/sql.ts`, `lib/table-styles.ts`
- [x] SQL injection fixes — Zod validation on all 6 API routes, `esc()` on all user inputs
- [x] Rate limiting — `lib/rate-limit.ts`, 30 req/min/IP on all public APIs
- [x] money() dedup — migrated 29 of 40 files to shared import (12 kept local for variant logic)
- [x] FTS indexes — already existed (trigram on gs_entities + person_roles)
- [x] All TypeScript type checks pass clean
- [x] Three commits pushed: showcase build, refactor, rate limiting

### Next
- [ ] Contract alerts + investigation workflow (entity → investigate → deep dive)
- [ ] LGA boundary GeoJSON choropleth (instead of bubble map)
- [ ] Load NT postcodes into postcode_geo to fix NT gap on map
- [ ] Sector-level aggregation views (all charities in sector X)
- [ ] PDF export / report generation from entity profiles
- [ ] Visual QA of all new pages (screenshots, responsive check)
- [ ] Migrate remaining 12 variant money() functions to shared lib (need to unify formatting logic)

### Decisions
- Public pages use `/entity/` (no auth), workspace uses `/entities/` (auth-gated): parallel paths
- Person URL format: `/person/Name-With-Dashes` (slugified from person_name)
- Comparison preset IDs use AU-ABN format (actual gs_ids from database)
- Map uses react-leaflet CircleMarker (not GeoJSON polygons) — faster, simpler, good enough for v1
- Person influence MV has name collision issue (Mark Smith = 714 seats) — known, future dedup
- Rate limiter is in-memory (not Redis) — sufficient for single-instance, needs upgrade for multi-instance
- Nav mega menu expanded to 6-column grid to accommodate Intelligence section
- SQL sanitization via `esc()` function — not parameterized queries (exec_sql doesn't support params)

### Open Questions
- UNCONFIRMED: Should entity profile have an "Investigate" button that triggers an agentic research workflow?
- UNCONFIRMED: Do 12 variant money() files need unification or are the differences intentional?

### Workflow State
pattern: iterative-build
phase: 4
total_phases: 6
retries: 0
max_retries: 3

#### Resolved
- goal: "Build commercial showcase pages for CivicGraph"
- resource_allocation: aggressive
- nav_mega_menu: DONE — Intelligence section added
- sql_injection: FIXED — Zod + esc() on all routes
- rate_limiting: DONE — 30 req/min/IP
- code_dedup: DONE — shared libs extracted

#### Unknowns
- Investigation workflow UX: UNKNOWN — how should agentic investigation be triggered and displayed?
- LGA boundary data source: UNKNOWN — need to download ABS LGA boundaries as GeoJSON

#### Last Failure
(none)

---

## Context

### Commits (this session)
- `bdc6650` feat: commercial showcase — nav, network graph, all pages (17 files, +3,086)
- `2b7d73a` refactor: shared utils, Zod validation, SQL injection fixes (20 files, +249/-166)
- `5196ed5` chore: rate limiting, money() dedup across 20 pages (27 files, +133/-154)

### Shared Libraries Created
```
apps/web/src/lib/format.ts       — money(), fmt(), truncate(), slugify()
apps/web/src/lib/sql.ts          — safe(), esc(), validateUuid(), validateGsId(), validateAbn(), whitelist()
apps/web/src/lib/table-styles.ts — TH, TH_R, TD, TD_R, THEAD, ROW
apps/web/src/lib/rate-limit.ts   — rateLimit() — in-memory sliding window, 30/min default
```

### Files Created
```
apps/web/src/app/entity/page.tsx                    — Entity search (client-side, debounced)
apps/web/src/app/entity/top/page.tsx                — Power Index leaderboard
apps/web/src/app/entity/compare/page.tsx            — Entity comparison (2-5 side-by-side)
apps/web/src/app/entity/[gsId]/network-graph.tsx    — Mini force-directed graph component
apps/web/src/app/person/page.tsx                    — "Who Runs Australia?" person leaderboard
apps/web/src/app/person/[name]/page.tsx             — Person profile (SSR)
apps/web/src/app/map/page.tsx                       — Funding desert map
apps/web/src/app/map/map-view.tsx                   — Leaflet map component
apps/web/src/app/api/data/entity/search/route.ts    — Entity search API
apps/web/src/app/api/data/entity/top/route.ts       — Top entities API
apps/web/src/app/api/data/entity/compare/route.ts   — Comparison API
apps/web/src/app/api/data/entity/network/route.ts   — Network graph API
apps/web/src/app/api/data/map/route.ts              — Map API
apps/web/src/app/api/data/person/route.ts           — Person API
```

### Key APIs
| Endpoint | Purpose |
|----------|---------|
| `/api/data/entity/search?q=X&lga=X` | Text/ABN/LGA entity search |
| `/api/data/entity/top?system=X&state=X&sort=X` | Power index leaderboard |
| `/api/data/entity/compare?ids=X,Y,Z` | Side-by-side comparison data |
| `/api/data/entity/network?id=UUID` | Entity network graph data |
| `/api/data/map?state=X` | Funding desert map data |
| `/api/data/person?q=X&name=X` | Person search/profile |

### Known Issues
- NT has 0 rows in postcode_geo → NT LGAs don't appear on map
- Person name collisions in mv_person_influence (Mark Smith = 714 seats = many different people)
- Comparison presets are hardcoded — should be dynamic or user-configurable
- Map uses bubble markers not proper LGA boundary polygons
- 12 report pages still have variant money() (different formatting: Math.abs, en-AU locale, null handling)
