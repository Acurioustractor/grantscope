# Handoff — One Desk domain model → Engagement layer

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-06T21:30:00+10:00
**Goal:** Map #158 build phase DONE. 5 PRs open for Ben's review: #164 (widened desk) #165 (communities+digest preview) #166 (People surface #154) #167 (digest+bridge #160/#161) #168 (community↔obligation tagging #159). Prod DB is AHEAD of main: act_people/act_person_roles/act_ask_warmers/digest_log/ghl_task_bridge tables + service_role grants APPLIED 2026-08-06 evening (plus earlier act_communities). Merging the PRs is what makes the UI catch up.
**Branch:** main == origin (ae08505); PR branches feat/people-surface, feat/digest-bridge, feat/community-obligation-tagging, feat/desk-widening, feat/engagement-screens all pushed
**Test:** cd apps/web && npx tsc --noEmit (repo has no vitest test files)

### Now
[->] NEXT SESSION: artefact_url wiring on /make-the-ask (small), then #156 backfill prep — OR whatever Ben's PR reviews surface. All other build items are gated on Ben (below).

### This Session (2026-08-06 evening)
- [x] PR #166 People surface (#154): act_people mirror + act_person_roles (APPLIED to prod), GHL write path (warmth=goods-* tag replace, next action=contact task w/ ghl_task_id on mirror, warm_via mirror-authoritative + echoed in task body), /org/act/people Quiet Ledger split, mint modal (GHL claim vs CivicGraph create search), contacts→people redirect (ACT only), reconcile agent scripts/reconcile-act-people-ghl.mjs (GHL wins silently, --dry-run)
- [x] Ben's 3 calls on #166 deferrals: project_codes text[] set at mint (APPLIED, chips+filter built) · owner stays mirror-only (GHL assignedTo wants user ids) · act_ask_warmers link table + detail-pane picker vs ghl_opportunities mirror (APPLIED, built)
- [x] PR #167 digest+bridge (#160/#161): ONE composition (act-desk-digest.ts) → email (Resend, delta vs digest_log, Monday heartbeat) + GHL tasks bridge (act-ghl-task-bridge.ts, [desk]-prefixed, write-only, keyed in ghl_task_bridge, triage-contact fallback). Vercel cron 0 21 * * * UTC = 07:00 Brisbane. Ben's 2 mechanism calls: Vercel-cron→Next-route over pg_cron→edge-fn (import desk services, don't duplicate); Resend from day one (spec's escape hatch). Dry-run vs prod: 9 decisions, 8 due, 0 errors. Money-owed rows excluded from due section (would've spawned 11 invoice-nag tasks)
- [x] PR #168 community↔obligation tagging: community_id through service/API/we-owe UI (mint select + row chip + detail picker). No migration needed
- [x] GOTCHA FIXED + in migrations: psql-created tables don't inherit Supabase default grants — act_people set would have silently rendered empty (GRANT ALL ... TO service_role now in all 3 migration files, applied)

### Ben's queue (day shift — everything below is gated on him)
- [ ] Review PRs #164 #165 #166 #167 #168 (#164+#166 land together: desk person rows read act_people)
- [ ] RESEND_API_KEY into Vercel env before first digest send (cron runs fine without it — email step fails, bridge still syncs). Optional: DESK_DIGEST_TO/FROM, GHL_TRIAGE_CONTACT_ID
- [ ] MERGING #167 ARMS THE BRIDGE: first 07:00 run creates ~8 real [desk] GHL tasks. Preview: /api/cron/desk-digest?dry=1 (Bearer CRON_SECRET)
- [ ] Terms for 11 live Wons → mint obligations on /goods/we-owe (can community-tag at mint now)
- [ ] Newsletter leftovers: Harvest workflow check → final --apply for 10 harvest contacts · sending domain + 3 smart lists · push/PR call on feat/newsletter-tag-alignment
- [ ] Reconcile agent (reconcile-act-people-ghl.mjs) needs a daily home once #166 merges — candidate: same cron pass or pm2

### Next (build)
- [ ] artefact_url on /make-the-ask
- [ ] #156 backfill: existing GHL contacts → minted People (specs: backfill-prompt-list.md)
- [ ] Mint/link modal entry points on Ask-detail + CivicGraph person pages (spec §5 other doors)
- [ ] Desk mismatch rows ON after triage completes (backfill-prompt-list.md)

### Decisions
- Domain truth lives in CONTEXT.md + docs/adr/0001–0004 + docs/specs/* — read those, not this ledger
- Person warmth vocab: mirror stores hot|warm|steady|cooling|cold ↔ GHL goods-* tag family (registry: exactly one, replace never append)
- Person next action = GHL contact task; completed/deleted task in GHL → reconcile drops Person to dateless tail; contact deleted in GHL → flag loudly, never auto-delete mirror row
- Digest/bridge due windows: asks ≤0d (money rows excluded), obligations ≤7d, people ≤7d — computed once in composeDeskDigest, both channels consume
- GHL tasks are disposable projections, NEVER read back (ADR 0003 holds)

### Open Questions
- UNCONFIRMED: buyer next actions dominate today's due window (8 rows) — is that signal or stale buyer data? Ben will see in first digest
- 11 live Wons' real obligation terms — only Ben knows

---

## Context
Session flow 2026-08-06 evening: built #154 → Ben approved migrations applied live via psql (MCP apply_migration blocked by classifier; psql direct works, but classifier later blocked one psql -f apply — Ben ran it via `!` bash passthrough) → walked deferrals together (AskUserQuestion), built his picks same-session → digest+bridge with 2 mechanism decisions → tagging UI. Pattern that worked: build → PR → walk deferrals with Ben → follow-up commit to same PR.
