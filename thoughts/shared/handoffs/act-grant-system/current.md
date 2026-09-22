---
date: 2026-09-14T08:38:06Z
session_name: act-grant-system
branch: fix/stop-smartygrants-crawl
status: active
---

# Work Stream: act-grant-system

## Ledger
**Updated:** 2026-09-15T05:15:00Z
**Goal:** The best grant system A Curious Tractor has: one private ACT grants desk showing every live grant each ACT project can actually apply for, with eligibility checked, fit scored per project, and deadline alerts that send.
**Branch:** main (PR #462 merged + live); fix/sidebar-label-truncation open as PR #463 (VISIBLE, awaiting Ben's preview check + "merge")
**Test:** `scripts/precheck.sh` · `node --test scripts/lib/project-relevance.test.mjs` · `node --env-file=.env scripts/check-migration-parity.mjs`

### Now
[->] Waiting on Ben to eyeball the Vercel preview for PR #463 (sidebar label fix) and say "merge". Nothing else blocking.

### Waiting (not blocking the UX work above)
Our Community's reply to the permission email (sent 2026-09-14 by Ben). Their answer decides the `sync-act-private-grant-rounds` schedule: yes → re-enable it, documented as licensed; no → leave it disabled permanently and lean on a Funding Centre membership instead.

### Done 2026-09-14 (steps 1-4 of the desk build, later session)
- [x] #456, #457, #458 all merged. Step 1 (desk at /org/act/grants), step 2 (eligibility per project) live.
- [x] Step 3: fit scorers for justicehub/empathy-ledger/harvest/farm/contained (scripts/lib/project-relevance.mjs), tested, measured against live data, PR #459 merged.
- [x] Step 4: widened the One Desk off Goods-only. Migration + rescorer run for real (249 tags added, 114 noisy tags removed across 26,785 rows). act-project-grants-triage.ts reads all six projects. PR #460 merged.
- [x] Found and fixed the desk-digest cron's silent 500: Resend sandbox rejects the default recipient. DESK_DIGEST_TO=hi@act.place set in prod, code fallback fixed, PR #461 merged. Confirmed a real send worked (digest_log's first-ever row, 19:32:47 UTC).
- [x] Our Community permission email sent (2026-09-14, Ben). Draft: thoughts/shared/drafts/2026-09-14-our-community-permission-ask.md.

### Done 2026-09-14 (later session)
- [x] Applied 20260914170000 + 20260914180000 (Ben: "apply both"). Post-check: 0 smartygrants in grant_opportunities, 595 private, anon 401, 0 in search.
- [x] Table lacked service_role grant; 20260914190000 applied (Ben: "apply the grant"). Committed on #457 branch; 20260914180000 file lives on #456 branch (parity flags it until #456 merges).
- [x] Desk /org/act/grants (#457): page-level admin gate (middleware only checks session; signup open). Any /org/act page is readable by any signed-up account: unfixed, offered to Ben.
- [x] Eligibility (#458): Ben's entities/places in apps/web/src/lib/act-grant-eligibility.ts. Harvest + Farm = Sunshine Coast Council QLD.

### This Session
- [x] Grant'd (grantd.com.au) teardown: WordPress CPT `grant`, 9,147 records, PMPro paywall, nightly import. We lacked 6,109 of their titles.
- [x] ARC fix: 5,598 funded research projects moved out of open lane (migration 20260914100000, PR #450 merged f2a7123d). Plugin no longer emits end date as deadline.
- [x] Daily expiry: pg_cron `expire-closed-grant-opportunities` 16:30 UTC, closed 262 (20260914120000, PR #451 merged fb4f6984).
- [x] Engine now saves geography + metadata.place for every source, fill-only (PR #452 merged 6bc379dc).
- [x] Goods scorer: First Nations wording alone can't tag ACT-GD; `acco` whole-word; GOODS_FUNDER rule (NIAA/ILSC/IBA/ABA). 130 → 63 tags (PR #454 merged 2e734ada).
- [x] Rescore log: every tag change in goods_relevance_signals.tag_change (PR #455 merged ae053ee7).
- [x] SmartyGrants plugin built (149 tenants, 626 live rounds), run twice by hand → 595 rows source='smartygrants'. Scheduled (#453 merged e334880d) then STOPPED: Our Community ToU cl 1.1 + 2(i) prohibit bots/scraping on all applicant portals. Schedule disabled + queued run cancelled (20260914160000, APPLIED). Plugin unregistered from public engine.
- [x] Ben's decision: run SmartyGrants for ACT's own grant-seeking only, never public or sold, knowing cl 2(i). Built `scripts/sync-act-private-grant-rounds.mts` (writes only act_private_grant_rounds; closes vanished/past rounds; scores Goods) + registry agent `sync-act-private-grant-rounds`. On PR #456.
- [x] Four "worth a look" grants checked against guidelines: none eligible (Screen Aust narrative excludes docs; TAS waste board TAS-only; CreateSA SA-funded orgs only; Parramatta local, $2k).
- [x] Screen Australia documentary: every program needs a documentary credit. Path = partner with credited First Nations director; First Nations Documentary Development up to $30k, next close 22 Oct 2026.
- [x] JusticeHub documentary brief written, grounded (HOLD fixed: Minderoo paused 2026-05-14 so not named; Brave Ones = ideation), committed act-global-infrastructure 8ca825c on branch drafts/jh-documentary-director-brief (worktree ../act-global-infrastructure-wt-doc-brief). NOT pushed.
- [x] Permission email to Our Community drafted + grounded: thoughts/shared/drafts/2026-09-14-our-community-permission-ask.md. NOT sent. Its "moved into a private table" line is only true after 20260914170000 applies.

### Done 2026-09-15 (UX pass on /org/act/grants + /org/act/desk)
- [x] Diagnosed the gap: `/org/act/grants` sorted every live grant by close date only, ignoring the fit scores (`project_relevance`, `goods_relevance_score`) that already drive `/org/act/desk`'s grant lens.
- [x] Ben decided: sort fit-desc-then-close-date when a project is picked; hide below-threshold-fit rows by default (same "show everything" toggle as the existing ruled-out filter).
- [x] Built it: `act-grants-desk.ts` now fetches + carries `fitScore` per project (goods via `goods_relevance_score`, the rest via `project_relevance`); page sorts/filters/renders a Fit column. Threshold 20.
- [x] Verified locally (dev :3013, `SKIP_AUTH_LOCAL=1`): Goods view 3,680 → 826 shown (1,300 ruled out, 1,554 no fit signal hidden), fit column renders correctly.
- [x] Shipped as PR #462 (VISIBLE — app page), Ben previewed and said merge. Squash-merged `d8d2c642`, confirmed READY + aliased to civicgraph.app via Vercel API.
- [x] Ben flagged (screenshot) the ACT workspace sidebar rail was illegible — labels ("One Desk", "Grants" etc.) truncating to "One ...", "F...", "Gra..." because `WorkspaceModeLink` gave the trailing hint text an unconstrained `auto` column that squeezed the label.
- [x] Fixed in `act-workspace-shell.tsx`: hint now stacks under the label instead of beside it, so the label always renders in full. Verified with a Playwright screenshot at 1280×800 — all six rail labels (One Desk, Orgs, People, Curiosity, Funding, Grants) render in full.
- [x] Opened as PR #463 (VISIBLE — shared chrome component), NOT yet merged: awaiting Ben's preview + "merge".

### Next
- [ ] Ben previews PR #463 and says "merge" (or flags a problem).
- [ ] Ben sends/awaits reply on the Our Community permission email — see "Waiting" above. If they say no: disable `sync-act-private-grant-rounds` schedule.
- [ ] No other open build work on this stream; further UX passes on /org/act/desk or /org/act/grants are open-ended, not queued.

### Decisions
- SmartyGrants data is ACT-internal only: separate table, not app-level filtering. 56 non-gated app files read grant_opportunities and signup is open, so filtering would leak.
- Rows moved, not flagged: act_* private pattern = RLS on, 0 policies, no anon/authenticated grants, service role only.
- Terms of use are read BEFORE any scraper is built (memory feedback_terms_before_scraper). robots.txt is not permission.
- Grant'd sitemap/API is not to be watched as a feed; one-off gap comparison only. Grant'd terms still unread.
- Council place map keyed by tenant, not funder name (Campbelltown/Central Coast/Central Highlands/Kingston/Latrobe exist in 2+ states). LGA names only; postcode_geo LGA codes conflict (Western Downs has two).

### Open Questions
- UNCONFIRMED: Grant'd terms of use unread; scratchpad copy of their 9,147 titles is gone with the session (scratchpad is session-scoped).
- UNCONFIRMED: 130→63 Goods tags expected ~70; ~7 rows unexplained, no pre-rescore snapshot existed.
- UNCONFIRMED: sync-act-private-grant-rounds.mts never run (table doesn't exist yet). Only transpile-checked.
- UNCONFIRMED: Funding Centre membership price not checked.

### Workflow State
pattern: build
phase: 0
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "make the best fucking grant system for A Curious Tractor ever"
- resource_allocation: balanced

#### Unknowns
- which ACT entity applies per project: UNKNOWN per project (entity facts in act-core-facts.md; DGR only via Butterfly)
- where each project operates (for location-gated grants): UNKNOWN, ask Ben

#### Last Failure
(none)

---

## Context

### The build plan (ACT grants desk)
1. **One private desk** at `/org/act/grants` (behind login, `/org` is already a protected prefix in middleware.ts). Reads grant_opportunities (public sources) UNION act_private_grant_rounds, service role, open + upcoming, soonest close first.
2. **Eligibility before fit.** Per grant: which ACT entity could apply (A Curious Tractor Pty Ltd ABN 36 697 347 676; The Butterfly Movement Ltd = the only DGR; A Kind Tractor Ltd = charity, not DGR) and the location gate. Columns already exist: accepts_pty_ltd, accepts_charity, dgr_required, accepts_unincorporated, geography, metadata.place. Most are empty; fill from guidelines where cheap, mark unknown otherwise. Today every "worth a look" grant failed on eligibility, not fit.
3. **Fit per project.** Pure scorers like scripts/lib/goods-relevance.mjs for ACT-JH, ACT-EL, ACT-HV, ACT-FM, ACT-CN, with tests and the applyGoodsTag-style tag_change log. Do NOT reuse the substring keyword lenses in apps/web/src/lib/opportunity-intelligence.ts (they match "data", "land", "tour"). Measure old vs new before any rescore writes.
4. **Alerts that send.** Memory project_act_funding_radar: no funding notification has EVER sent; the daily digest is one env var + one widened function from working and is Goods-only. Widen to all projects, send to Ben.
5. **Sources, terms first.** Funding Centre membership (legit, same data as SmartyGrants); council .gov.au grants pages (read each site's terms, quote the clause in the plugin); government open data/APIs. Existing: 20 QLD council plugins, grantconnect, grantsNT.

### Key files
- packages/grant-engine/src/sources/smartygrants.ts (+ smartygrants-places.ts): parsers, 149 tenants, tenant→place map. Header: NOT FOR THE PUBLIC ENGINE.
- packages/grant-engine/src/storage/repository.ts: placeFromGeography(), fill-only geography/metadata.place.
- scripts/lib/goods-relevance.mjs: IDENTITY / GOODS_SHAPE / GOODS_FUNDER rules, applyGoodsTag().
- scripts/score-goods-relevance.mjs: rescorer; manual rows (source ^manual) untouched; prints tags added/removed.
- scripts/sync-act-private-grant-rounds.mts: the ACT-private crawler.
- supabase/migrations/2026091410..180000: this session's six migrations (100/120/140/160 applied; 170/180 NOT).

### Numbers at close (2026-09-14)
- grant_opportunities 27,380 rows; 595 source='smartygrants' (to move); future-deadline non-SmartyGrants ~375.
- ACT-GD tagged 63 (15 high-fit ≥70). Manual-source rows 31 (11 tagged).
- SmartyGrants open rounds 595: VIC 149, QLD 139, WA 135, NSW 55, SA 45, TAS 32, national 22, ACT 18; 150 close within 30 days.
