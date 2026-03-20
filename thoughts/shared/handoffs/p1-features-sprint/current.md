---
date: 2026-03-18T08:30:00Z
session_name: p1-features-sprint
branch: main
status: active
---

# Work Stream: p1-features-sprint

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-18T10:15:00Z
**Goal:** Ship P1+P2 features, fix CI, QA, then move to growth priorities.
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit`

### Now
[->] Ready for next priorities — QA in browser, API rate limiting, or ALMA linkage expansion

### Previous Session
- [x] Crime data expansion — SA + ACT (6/8 states covered)
- [x] GTM target list — 10 foundations with DD pack URLs
- [x] Watchlist dashboard (`/home/watchlist`)
- [x] Entity watches table + API
- [x] Custom Report Builder (`/home/report-builder`)
- [x] Tender Brief (`/home/tender-brief`)
- [x] Home page Quick Actions updated

### This Session
- [x] Committed P1 features (75 files, 13K lines) — `c6144fd`
- [x] Fixed CI: integration tests skip when .env unavailable — `a99150c`
- [x] Built API Key Management (`/home/api-keys`, `/api/keys`) — funder+ tier gated
- [x] Built Board Report Generator (`/home/board-report`, `/api/board-report`) — printable entity reports
- [x] Built Entity Watch Notification Cron (`scripts/check-entity-watches.mjs`) with email delivery
- [x] Added both features to home Quick Actions
- [x] Registered check-entity-watches agent in agent registry
- [x] Fixed all test type errors (NextRequest casts, async params)
- [x] Type check clean, all pushed to origin/main
- [x] CI: type check green, unit tests green (E2E still needs Supabase secrets in CI — pre-existing)

### Next
- [ ] QA new pages in browser (need logged-in session with cookie import)
- [ ] API rate limiting enforcement (rate_limit_per_hour stored but not enforced)
- [ ] ALMA entity linkage expansion (currently 43.5% → target 60%+)
- [ ] E2E test fix in CI (add Supabase secrets or mock client)
- [ ] Governed Proof pilot (outcome tracking + community voice)
- [ ] Relationship Flywheel (warm introduction paths)
- [ ] GTM Phase 1 execution (outreach to 10 foundation targets)

### Decisions
- API keys use `cg_` prefix + 64 hex chars, SHA-256 hash storage, one-time raw key display
- API access gated by `api` module (funder+ tier), board report by `research` (all tiers)
- Entity watch email uses Gmail via Google service account delegation (same as grant notifications)
- Email template: HTML with Bauhaus styling, entity link, watchlist management link
- Cron supports --dry-run flag, gracefully skips if Gmail not configured

### Open Questions
- UNCONFIRMED: Do the new pages render correctly when logged in? Need browser QA
- UNCONFIRMED: Are board report queries fast enough for large entities? May need caching
- UNCONFIRMED: Gmail service account configured in production? (GOOGLE_SERVICE_ACCOUNT_KEY env var)

### Workflow State
pattern: build-ship
phase: 5
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Ship P1+P2 features and fix CI"
- resource_allocation: aggressive

#### Unknowns
- gmail_production_config: UNKNOWN — need to verify GOOGLE_SERVICE_ACCOUNT_KEY is set in production
- api_rate_limiting: UNKNOWN — enforcement not yet built

#### Last Failure
(none)

### Key Files Created This Session
- `apps/web/src/app/api/keys/route.ts` — API key CRUD (GET/POST)
- `apps/web/src/app/api/keys/[keyId]/route.ts` — API key revoke/update (DELETE/PATCH)
- `apps/web/src/app/home/api-keys/page.tsx` — API keys server page
- `apps/web/src/app/home/api-keys/api-keys-client.tsx` — API keys client UI
- `apps/web/src/app/api/board-report/route.ts` — Board report generation API
- `apps/web/src/app/home/board-report/page.tsx` — Board report server page
- `apps/web/src/app/home/board-report/board-report-client.tsx` — Board report client (search + printable report)
- `scripts/check-entity-watches.mjs` — Entity watch cron with Gmail email delivery
- `apps/web/tests/unit/api/keys/route.test.ts` — API key route tests (18 tests)
- `apps/web/tests/unit/api/board-report/route.test.ts` — Board report route tests (7 tests)

### Commits This Session
- `c6144fd` — feat: P1 features (watchlist, report builder, tender brief, org dashboard, crime data)
- `a99150c` — fix: skip integration tests in CI when .env unavailable
- `7bb0bd5` — feat: P2 features (API key management, board report, entity watch cron)
- `d6e0476` — feat: add email delivery to entity watch notification cron

---

## Context
This session continued from the P0 revenue features sprint. P0 was complete (DD pack, email capture, portfolio, intake conversion). P1 UX improvements were also done in the prior session (mid-report CTAs, tooltips, empty DD reframing, auto-insights, portfolio tier gate).

Previous session focused on:
1. Finishing crime data expansion (SA + ACT, completing 6/8 Australian jurisdictions)
2. Building GTM Phase 1 outreach materials (10 foundation targets)
3. Building 3 P1 features: Watchlist, Custom Report Builder, Tender Brief

This session focused on:
1. Committing and shipping all P1 work (75 files)
2. Fixing CI (integration tests skip without .env)
3. Building P2 features: API Key Management, Board Report Generator, Entity Watch Cron
4. Wiring up email delivery for entity watch notifications

The PRD (`thoughts/shared/plans/civicgraph-product-vision.md`) drives all priorities.
Revenue target: 30 foundations at $499/mo + 5 govt departments at $1,999/mo = $548,940/yr.
