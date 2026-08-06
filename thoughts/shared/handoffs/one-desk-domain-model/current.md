# Handoff — One Desk domain model → Engagement layer

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-06T21:30:00+10:00
**Goal:** Map #143 (One Desk domain model) COMPLETE + built slice 1. New map #158 (Engagement layer) CHARTED with 5 tickets. Separate urgent sprint: ACT site launch + first newsletters (GHL) THIS WEEK — not started.
**Branch:** main (all merged through PR #157, squash 64ab9b6; local == origin)
**Test:** cd apps/web && npx tsc --noEmit (repo has no vitest test files)

### Now
[->] Three parallel tracks, pick per session:
1. **Newsletter sprint (URGENT, day shift):** ACT site live this week + newsletters via GHL for Goods + JusticeHub + ACT general. Needs: GHL email/audience capability check, content in ACT voice (/act-voice skill), Ben in loop. NOT STARTED.
2. **Triage sitting OPEN:** 11 live Won opportunities need obligation terms dictated by Ben (5 Snow/Centrecorp funder grants, 6 buyer sales to community orgs — list in act_ask_none_owed context below). Mint via /api or We-owe tab.
3. **Engagement map:** `/mattpocock-skills:wayfinder 158` — 4 grilling tickets open (#159 Community entity, #160 digest, #161 GHL tasks bridge, #162 grants→Notion). #163 research: RESOLVED+CLOSED — findings in docs/funder-pipeline-gap-audit.md on branch research/funder-pipeline-gaps (pipeline split across 4 surfaces, no five-stage rendering, no $-weighted view, fit-70–84 invisible). Likely spawns a 'one pipeline screen' spec ticket on #158.

### This Session (2026-08-06 afternoon)
- [x] Map #143 finished: #153 (widened desk spec), #154 (people surface spec), #155 (delivery surfaces spec), #156 (backfill) — all specs in docs/specs/
- [x] BUILT + MERGED PR #157: We-owe tab at /org/act/goods/we-owe — act_obligations + act_ask_none_owed tables (migration APPLIED to prod), act-obligations.ts service (incl. getDeskObligations desk feed, thresholds baked), org-scoped API (Done/Dropped terminal, community drops need reason), Bauhaus skin
- [x] Triage sitting part 1: 19 of 30 Won opps bulk-flagged none-owed (17 'A Curious Tractor' 2025 pipeline rows + 2 historical Xero rows) — flagged_by='ben-triage-2026-08-06', reversible per-row
- [x] Charted map #158 + tickets #159–#163; fired research agent on #163
- Ben's charting decisions: notifications = email digest + GHL tasks ONLY (desk stays primary, no new realtime channel); community unit = place records; newsletter = separate sprint

### Next
- [ ] Newsletter sprint session (fresh context, day shift)
- [ ] Ben dictates terms for 11 live Wons → mint obligations
- [ ] Wayfinder 158 tickets, one per session
- [ ] Later build order (from docs/specs/backfill-prompt-list.md): desk widening (obligation+person rows, service feed exists) + /people surface + enable mismatch rows AFTER triage completes

### Decisions
- All domain decisions in CONTEXT.md + docs/adr/0001–0003 + docs/specs/*.md — read those, not this ledger
- Desk mismatch rows stay OFF until triage sitting completes (backfill-prompt-list.md)
- We-owe tab uses Bauhaus (workspace family consistency), desk stays Quiet Ledger

### Open Questions
- 11 live Wons' real obligation terms — only Ben knows

## Key artifacts
- Specs: docs/specs/{one-desk-widened,people-surface,delivery-surfaces}-ux-spec.md, docs/specs/backfill-prompt-list.md
- Maps: gh issues #143 (closed-out, all decisions indexed) and #158 (live)
- We-owe: apps/web/src/app/org/[slug]/goods/we-owe/, lib/services/act-obligations.ts, api/org/[orgProfileId]/obligations/
- Migration applied: supabase/migrations/20260806100000_act_obligations.sql
