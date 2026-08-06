# Handoff — One Desk domain model → Engagement layer

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-06T17:00:00+10:00
**Goal:** MAP #158 CLOSED — all 4 grilling tickets resolved+specced (#159 communities/ADR 0004, #160 digest, #161 GHL tasks bridge, #162 Notion handoff; docs/specs/*). Build phase: PRs #164 (widened desk) + #165 (communities screens + digest preview) open for Ben's Vercel-preview review; act_communities tables + 3 seeded communities LIVE in prod. Next build: people surface + act_people mirror (#154).
**Branch:** main == origin (92b8377); PR branches feat/desk-widening + feat/engagement-screens pushed; feat/newsletter-tag-alignment pushed (no PR, Ben's call)
**Test:** cd apps/web && npx tsc --noEmit (repo has no vitest test files)

### Now
[->] NEXT SESSION: build the People surface + act_people mirror per docs/specs/people-surface-ux-spec.md (#154) — GHL→Supabase mirror table act_people (desk feed act-desk-people.ts already reads it: org_profile_id, name, next_action, review_by, warm_via, warmth, ghl_contact_id, last_synced_at), reconcile agent, /org/act/people list + person detail, Person minting flow. This also lights up desk person rows (PR #164) + digest watch items. Branch off main.
Then: digest+bridge edge function (one daily 07:00 Brisbane pass, two channels; specs locked), community↔obligation tagging UI, artefact_url on /make-the-ask.
Ben's queue: review PRs #164 (does desk feel empty without commitment rows?) + #165 previews · terms for 11 Wons · 10 harvest newsletter contacts (GHL workflow check).
#159–#162 + map #158 ALL CLOSED 2026-08-06; act_communities live in prod (barkly, utopia, palm-island minted).

### Newsletter sprint state (2026-08-06 midday session — PARKED)
- [x] GHL tag audit re-run (3,365 contacts): newsletter segments = comms:act-newsletter 140 / goods 128 / justicehub 34 / harvest 222 + strays
- [x] DECIDED (Ben): comms:* un-deprecated — it IS the newsletter membership family (act-site-form-alignment.md §4a wins over old registry direction); consent = newsletter_consent field only (newsletter-consent-policy.md); first sends consented-only + re-permission email to ~350 tagged-unconsented
- [x] Registry updated: scripts/lib/ghl-tag-registry.mjs COMMS_TAGS (4 newsletters + do-not-contact)
- [x] scripts/cleanup-newsletter-tags.mjs: dry-run default, --apply/--max/--skip-harvest staged rollout, harvest-context routing for bare `newsletter` (8 of 9 were Harvest). 117 contacts change total. Reports in data/newsletter-tag-*.txt
- [x] CANARY APPLIED to GHL (5 contacts incl. benjamin@act.place, verified by re-fetch, 0 failures)
- [x] Risk audit: ALL newsletter workflows in GHL are drafts (can't fire); only unverifiable exposure = published Harvest workflows × the 10 contacts gaining comms:harvest-newsletter (hence --skip-harvest)
- [x] Per-repo email authoring scaffolds COMMITTED in 3 repos: act-regenerative-studio/emails (f5ba684, + README = the process doc), JusticeHub/emails (fb60446e), "Goods Asset Register/v2"/emails (3685da9). Brand-true email-safe masters + build.mjs; test render act-regenerative-studio/emails/issues/2026-08-test/dist.html
- [x] All 3 site opt-in forms verified already canonical (comms tag + newsletter_consent atomic) — no rewiring needed

### Newsletter resume checklist
- [x] Soak clean (Ben confirmed 2026-08-06 pm) → bulk --apply --skip-harvest RUN: 111 contacts, 0 failures (74 goods-newsletter→comms:, 53 stale newsletter-stream:* removed). Report committed on branch (4043bf8)
- [ ] Ben (GHL UI): check Harvest workflow triggers → final --apply for the 10 harvest contacts
- [ ] Ben (GHL UI): dedicated sending domain check + 3 smart lists (comms:<x>-newsletter AND newsletter_consent=Yes AND not DND)
- [ ] Draft first issues (/act-voice + /ground) + re-permission email — day shift
- [ ] Decide push/PR for feat/newsletter-tag-alignment (local only right now)

### This Session (2026-08-06 afternoon, earlier)
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
