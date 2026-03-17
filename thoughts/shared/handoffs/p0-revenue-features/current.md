---
date: 2026-03-18T12:00:00Z
session_name: p0-revenue-features
branch: main
status: active
---

# Work Stream: p0-revenue-features

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-03-18T12:00:00Z
**Goal:** Ship all P0 revenue features from civicgraph-product-vision.md PRD. Done when DD pack, email capture, portfolio, and intake conversion are live and blocker-free.
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit`

### Now
[->] P1 UX improvements (mid-report CTAs, empty DD reframing, portfolio upgrade gate, tooltips)

### This Session
- [x] Assessed existing code — DD service, PDF, button, API route all pre-built
- [x] Fixed DD API type error (Uint8Array → Buffer)
- [x] DD preview page verified working at /entities/[gsId]/due-diligence
- [x] Created ReportCTA component (apps/web/src/app/reports/_components/report-cta.tsx)
- [x] Added email capture CTA to 9 flagship reports
- [x] Created funder_portfolios + funder_portfolio_entities tables (with RLS)
- [x] Built portfolio API routes (CRUD + entity add/remove)
- [x] Built portfolio dashboard at /home/portfolio with aggregate stats
- [x] Added portfolio link to home page Quick Actions
- [x] Added middleware matcher for /home/:path*
- [x] Added intake conversion CTA to /start/[intakeId]/brief
- [x] QA tested all 4 features — found 3 blockers
- [x] Fixed blocker: DD preview auth UX (conditional buttons based on auth state)
- [x] Fixed blocker: intake claim endpoint (POST /api/start/[intakeId]/claim)
- [x] Fixed blocker: post-registration import (IntakeClaimer component on /home)

### Commits
- `5d13b31` feat: P0 revenue features — DD pack, email capture, funder portfolio, intake conversion
- `2cdce89` fix: resolve 3 QA blockers — DD auth UX, intake claim, post-reg import

### Next (P1 UX from QA)
- [ ] Mid-report email CTA — add after first 2-3 sections, not just bottom
- [ ] Reframe empty DD sections — "Clean record" instead of "No data available"
- [ ] Portfolio tier upgrade gate — show pricing prompt for Community/Professional users
- [ ] Add tooltips for jargon (SEIFA, ALMA, PBI) on DD preview page
- [ ] DD auto-insights — 3-bullet executive summary at top of preview
- [ ] Find better demo entity (with ACNC financials + contracts + ALMA) for sales demos
- [ ] Add CTA to reports index page (/reports)

### Decisions
- Funders are primary customer (PRD: civicgraph-product-vision.md, dated 2026-03-17)
- DD Pack is P0 feature #1 — first thing a foundation will pay for
- Email capture uses existing report_leads table + /api/reports/leads endpoint
- Portfolio gated by `allocation` module (Organisation tier minimum)
- Intake claim merges anonymous intake with authenticated user + imports matches
- Paused: Journey Builder, new reports, new data pipelines, crime data expansion

### Open Questions
- UNCONFIRMED: Do saved_grants/saved_foundations have unique constraints on (user_id, grant_id)/(user_id, foundation_id)? Claim endpoint uses upsert with onConflict
- UNCONFIRMED: Is /register redirect param `redirect` or `next`? Brief page uses `redirect`, middleware uses `next`

### Key Files
- DD service: `apps/web/src/lib/services/due-diligence-service.ts`
- DD PDF: `apps/web/src/lib/due-diligence-pdf.ts`
- DD API: `apps/web/src/app/api/entities/[gsId]/due-diligence/route.ts`
- DD preview: `apps/web/src/app/entities/[gsId]/due-diligence/page.tsx`
- Email CTA: `apps/web/src/app/reports/_components/report-cta.tsx`
- Portfolio page: `apps/web/src/app/home/portfolio/page.tsx`
- Portfolio client: `apps/web/src/app/home/portfolio/portfolio-client.tsx`
- Portfolio API: `apps/web/src/app/api/portfolio/`
- Intake claim: `apps/web/src/app/api/start/[intakeId]/claim/route.ts`
- Intake claimer: `apps/web/src/app/home/intake-claimer.tsx`
- PRD: `thoughts/shared/plans/civicgraph-product-vision.md`

### Workflow State
pattern: build-qa-fix
phase: 3
total_phases: 4
retries: 0
max_retries: 3

#### Resolved
- goal: "Ship P0 revenue features from PRD"
- resource_allocation: aggressive

#### Unknowns
- saved_grants unique constraint: UNKNOWN
- register redirect param name: UNKNOWN

#### Last Failure
(none)

---

## Context

### PRD Summary (civicgraph-product-vision.md)
- Primary revenue target: Funders ($499-1,999/mo)
- P0 features: DD Pack PDF, email capture on reports, funder portfolio, intake→account conversion
- Path to $500K ARR: 30 foundations + 5 govt departments + 200 NFPs
- GTM: Generate DD Pack for a foundation's grantee, email program officer, convert to trial

### QA Findings (from visual journey testing)
- DD Pack: 7 sections render with real data, 4 sections show "No data" for test entity
- Email capture: submits successfully, success state shows, but CTA only at page bottom
- Portfolio: auth gating works, aggregate stats meaningful, empty state clear
- Intake: conversion CTA prominent, but brief wasn't linked to account (now fixed)

### Architecture
- DD service assembles data from 9 parallel Supabase queries (entity, ACNC, funding, contracts, donations, ALMA, geo, SEIFA, stats)
- PDF generated server-side via pdf-lib (no browser dependency)
- Portfolio uses mv_gs_entity_stats and mv_gs_donor_contractors materialized views
- Intake claim endpoint does atomic update + import in single request
