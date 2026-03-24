---
date: 2026-03-21T01:10:00Z
session_name: autoresearch-and-graph
branch: main
status: active
---

# Work Stream: autoresearch-and-graph

## Ledger
**Updated:** 2026-03-21T01:10:00Z
**Goal:** Build autonomous monitoring + clean/QA the enriched graph. Done when all 4 tasks below complete.
**Branch:** main
**Test:** `node --env-file=.env scripts/scheduler.mjs --dry-run`

### Now
[->] 4 tasks queued: entity dedup, graph QA, wire unmapped schedulers, foundation page

### This Session
- [x] Entity mega-linker: +232K person entities, +425K edges (shared_director, directorship, affiliated_with)
- [x] Fixed 44/44 MVs (rewrote mv_person_entity_network, cascade-recreated mv_person_influence)
- [x] Built autoresearch infrastructure: discoveries table, scheduler, cron (every 6h)
- [x] watch-board-changes agent: 1,479 discoveries from 7-day lookback
- [x] Mission Control discoveries feed: severity filters, ack/dismiss, real-time updates
- [x] 3 new watchers: funding-anomalies, data-quality, entity-changes
- [x] Data quality watcher found 50 duplicate name clusters (up to 141 copies!)
- [x] Cleaned stale git branches (3 deleted)
- [x] All pushed to main, cron registered

### Next
- [ ] **Entity dedup script** — merge duplicate entities (141x "BROAD CONSTRUCTION PTY LTD" etc). Merge strategy: keep entity with most relationships, redirect others. Update gs_relationships source/target IDs.
- [ ] **Graph QA** — test /graph at 1.51M edge scale. Check if shared_director/directorship edges render well. May need filtering or graph mode updates.
- [ ] **Wire unmapped scheduler agents** — 50 agents in agent_schedules with no script. Map existing scripts (refresh-materialized-views → refresh-views, build-entity-graph, etc).
- [ ] **Foundation intelligence page** — /foundation page in progress from earlier sessions. Check what exists, complete it.

### Decisions
- Autoresearch pattern: watcher agents → discoveries table → Mission Control UI
- Scheduler cron: every 6h, checks agent_schedules for due agents
- Watcher intervals: board=6h, funding=12h, entity=12h, data-quality=24h
- Entity inserts: always test 1 row before batch (learned from confidence constraint failure)
- gs_entities has NO dataset column, confidence must be explicit (not 'medium')

### Open Questions
- UNCONFIRMED: Does /graph handle 1.51M edges without melting?
- UNCONFIRMED: What foundation page code exists from earlier sessions?
- UNCONFIRMED: Which of the 50 unmapped scheduler agents have existing scripts?

### Workflow State
pattern: parallel-tasks
phase: 2
total_phases: 3
retries: 0
max_retries: 3

#### Resolved
- goal: "Build autonomous monitoring + clean/QA enriched graph"
- resource_allocation: aggressive

#### Unknowns
- graph_performance_at_scale: UNKNOWN
- foundation_page_state: UNKNOWN

#### Last Failure
(none)

---

## Context

### Database State (2026-03-21)
- gs_entities: 565,660 (was 333K pre-mega-linker)
- gs_relationships: 1.51M (was 1.08M)
- discoveries: ~1,540 (1,479 board + 53 data-quality + 8 entity-changes)
- person_roles: 339,687 (237K unique people)
- 44/44 MVs healthy

### Key Files
- `scripts/scheduler.mjs` — cron scheduler (AGENT_SCRIPTS map)
- `scripts/watch-board-changes.mjs` — board watcher
- `scripts/watch-funding-anomalies.mjs` — funding watcher
- `scripts/watch-data-quality.mjs` — data quality watcher
- `scripts/watch-entity-changes.mjs` — entity change watcher
- `scripts/link-entities-mega.mjs` — mega-linker (3 phases)
- `apps/web/src/app/mission-control/mission-control-client.tsx` — MC + discoveries feed
- `apps/web/src/app/api/mission-control/discoveries/[id]/route.ts` — dismiss/review API

### Recent Commits
- 69ef5b8: feat: 3 new autoresearch watchers
- 66b7248: feat: Mission Control discoveries feed
- fe9af6b: feat: autoresearch infrastructure
- d9125a6: feat: entity mega-linker — 425K new edges

### Data Quality Issues Found
- "BROAD CONSTRUCTION PTY LTD" appears 141 times
- "The Corporation Of The Synod Of The Diocese Of Brisbane" appears 127 times
- 2,958 indigenous_corp entities missing ABN
- 1,432 company entities missing ABN
- 50 duplicate name clusters with 3+ copies each
