---
date: 2026-03-18T08:30:00Z
session_name: p1-features-sprint
branch: main
status: active
---

# Work Stream: p1-features-sprint

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-18T09:00:00Z
**Goal:** Commit & ship P1 features, then QA and move to next priorities.
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit`

### Now
[->] Awaiting user direction — all P1 features built, need commit + QA

### Previous Session
- [x] Crime data expansion — SA + ACT (6/8 states covered)
- [x] GTM target list — 10 foundations with DD pack URLs
- [x] Watchlist dashboard (`/home/watchlist`)
- [x] Entity watches table + API
- [x] Custom Report Builder (`/home/report-builder`)
- [x] Tender Brief (`/home/tender-brief`)
- [x] Home page Quick Actions updated
- [x] Type check clean

### This Session
- (new session, picking up from commit step)

### Next
- [ ] Commit all uncommitted work (large diff: 6 modified files + ~40 untracked files)
- [ ] Push to origin/main
- [ ] Verify CI passes
- [ ] QA test new pages in browser
- [ ] P2 features: API Access, Board Report Generation
- [ ] GTM Phase 1 execution
- [ ] Entity watch notification cron

### Decisions
- Watchlist uses existing saved_grants/saved_foundations tables + new entity_watches table
- Entity watches gated by `tracker` module (Professional tier+)
- Report Builder gated by `research` module (all tiers have access)
- Tender Brief gated by `procurement` module (Organisation tier+)
- Tender Brief is keyword-based (not URL scraping) — simpler, more reliable
- Crime data: WA skipped (no LGA mapping), TAS skipped (PDF only)
- ACT crime data seeded from published ACTP annual report figures (not raw data)

### Open Questions
- UNCONFIRMED: Do the new pages render correctly? Need browser QA
- UNCONFIRMED: Are the report-builder exec_sql queries fast enough? May need caching
- UNCONFIRMED: Entity watch notification cron — not built yet, just the table/API

### Workflow State
pattern: build-ship
phase: 4
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Ship P1 features: watchlist, report builder, tender brief + GTM prep + crime expansion"
- resource_allocation: aggressive

#### Unknowns
- notification_cron: UNKNOWN — entity watch email notifications not yet implemented

#### Last Failure
(none)

### Key Files Created This Session
- `scripts/ingest-crime-sa.mjs` — SA crime CSV→LGA ingest
- `scripts/ingest-crime-act.mjs` — ACT crime seed from annual report
- `scripts/gtm-target-list.mjs` — 10 foundation targets with DD pack URLs
- `scripts/create-entity-watches.sql` — entity_watches table DDL
- `apps/web/src/app/api/watches/route.ts` — Entity watches CRUD API
- `apps/web/src/app/api/watches/[watchId]/route.ts` — Delete watch
- `apps/web/src/app/home/watchlist/page.tsx` — Watchlist server page
- `apps/web/src/app/home/watchlist/watchlist-client.tsx` — Watchlist client (tabs, entity watch add/remove)
- `apps/web/src/app/api/report-builder/route.ts` — Custom report generation API
- `apps/web/src/app/home/report-builder/page.tsx` — Report builder server page
- `apps/web/src/app/home/report-builder/report-builder-client.tsx` — Report builder client (form + results)
- `apps/web/src/app/api/tender-intelligence/analyze-url/route.ts` — Tender market brief API
- `apps/web/src/app/home/tender-brief/page.tsx` — Tender brief server page
- `apps/web/src/app/home/tender-brief/tender-brief-client.tsx` — Tender brief client

### Files Modified
- `apps/web/src/app/home/home-client.tsx` — Added Watchlist, Report Builder, Tender Brief to Quick Actions

---

## Context
This session continued from the P0 revenue features sprint. P0 was complete (DD pack, email capture, portfolio, intake conversion). P1 UX improvements were also done in the prior session (mid-report CTAs, tooltips, empty DD reframing, auto-insights, portfolio tier gate).

This session focused on:
1. Finishing crime data expansion (SA + ACT, completing 6/8 Australian jurisdictions)
2. Building GTM Phase 1 outreach materials (10 foundation targets)
3. Building 3 P1 features: Watchlist, Custom Report Builder, Tender Brief

The PRD (`thoughts/shared/plans/civicgraph-product-vision.md`) drives all priorities.
Revenue target: 30 foundations at $499/mo + 5 govt departments at $1,999/mo = $548,940/yr.
