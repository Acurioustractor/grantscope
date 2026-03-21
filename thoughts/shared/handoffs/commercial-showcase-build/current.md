---
date: 2026-03-21T18:00:00Z
session_name: commercial-showcase-build
branch: main
status: active
---

# Work Stream: commercial-showcase-build

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-21T18:00:00Z
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
- [x] Power Index leaderboard (`/entity/top`, `/api/data/entity/top`) — 160K entities, filters by state/system/min-systems/sort/CC
- [x] Entity comparison (`/entity/compare`, `/api/data/entity/compare`) — side-by-side 2-5 entities with relative bars
- [x] Person profile (`/person/[name]`, `/api/data/person`) — board seats, financial footprint, interlock alerts
- [x] Person search leaderboard (`/person`) — "Who Runs Australia?" ranked by influence
- [x] Navigation links across all new pages (Search, Power Index, Compare, People, Map, Graph)
- [x] Board member names link to person profiles
- [x] Entity profile "Compare" button pre-fills current entity
- [x] Fixed: map state filter alias bug, state casing mismatch, NT postcode gap
- [x] Fixed: compare preset gs_ids (AU-ABN format, not GS-ORG)
- [x] All TypeScript type checks pass clean

### Next
- [ ] Contract alerts + investigation workflow (entity → investigate → deep dive)
- [ ] LGA boundary GeoJSON choropleth (instead of bubble map)
- [ ] Load NT postcodes into postcode_geo to fix NT gap on map
- [ ] Entity network neighborhood — small embedded graph on entity profile
- [ ] Sector-level aggregation views (all charities in sector X)
- [ ] PDF export / report generation from entity profiles
- [ ] Add new pages to public nav mega menu

### Decisions
- Public pages use `/entity/` (no auth), workspace uses `/entities/` (auth-gated): parallel paths
- Person URL format: `/person/Name-With-Dashes` (slugified from person_name)
- Comparison preset IDs use AU-ABN format (actual gs_ids from database)
- Map uses react-leaflet CircleMarker (not GeoJSON polygons) — faster, simpler, good enough for v1
- Person influence MV has name collision issue (Mark Smith = 714 seats across multiple real people) — known, future dedup needed

### Open Questions
- UNCONFIRMED: Should new pages be added to the public nav mega menu in nav.tsx?
- UNCONFIRMED: Should entity profile have an "Investigate" button that triggers an agentic research workflow?

### Workflow State
pattern: iterative-build
phase: 3
total_phases: 6
retries: 0
max_retries: 3

#### Resolved
- goal: "Build commercial showcase pages for CivicGraph"
- resource_allocation: aggressive

#### Unknowns
- Investigation workflow UX: UNKNOWN — how should agentic investigation be triggered and displayed?
- LGA boundary data source: UNKNOWN — need to download ABS LGA boundaries as GeoJSON

#### Last Failure
(none)

---

## Context

### Files Created (all new, untracked)
```
apps/web/src/app/entity/page.tsx          — Entity search (client-side, debounced)
apps/web/src/app/entity/top/page.tsx       — Power Index leaderboard
apps/web/src/app/entity/compare/page.tsx   — Entity comparison (2-5 side-by-side)
apps/web/src/app/person/page.tsx           — "Who Runs Australia?" person leaderboard
apps/web/src/app/person/[name]/page.tsx    — Person profile (SSR)
apps/web/src/app/map/page.tsx              — Funding desert map
apps/web/src/app/map/map-view.tsx          — Leaflet map component
apps/web/src/app/api/data/entity/search/route.ts  — Entity search API (text, ABN, LGA)
apps/web/src/app/api/data/entity/top/route.ts     — Top entities API (paginated, filtered)
apps/web/src/app/api/data/entity/compare/route.ts — Comparison API (power + revolving door + boards)
apps/web/src/app/api/data/map/route.ts             — Map API (mv_funding_deserts + postcode_geo centroids)
apps/web/src/app/api/data/person/route.ts          — Person API (search, top, profile)
```

### Files Modified
```
apps/web/src/app/entity/[gsId]/page.tsx — Enhanced with power index, ATO, board (linked to /person), revolving door, cross-system badges, compare link
```

### Key APIs
| Endpoint | Purpose |
|----------|---------|
| `/api/data/entity/search?q=X&lga=X` | Text/ABN/LGA entity search |
| `/api/data/entity/top?system=X&state=X&sort=X&min_systems=N` | Power index leaderboard |
| `/api/data/entity/compare?ids=X,Y,Z` | Side-by-side comparison data |
| `/api/data/map?state=X` | Funding desert map data |
| `/api/data/person?q=X&name=X` | Person search/profile |

### Key MVs Used
- `mv_entity_power_index` (82K entities, 44 columns) — power_score, system_count, dollar flows
- `mv_funding_deserts` (1.6K LGAs) — desert_score, SEIFA, remoteness
- `mv_revolving_door` (4.7K entities) — influence vectors, revolving_door_score
- `mv_person_influence` (4.8K people) — board_count, financial_system_count
- `mv_person_entity_network` (4.9K connections) — person→entity with financials

### Known Issues
- NT has 0 rows in postcode_geo → NT LGAs don't appear on map
- Person name collisions in mv_person_influence (Mark Smith = 714 seats = many different people)
- Comparison presets are hardcoded — should be dynamic or user-configurable
- Map uses bubble markers not proper LGA boundary polygons
