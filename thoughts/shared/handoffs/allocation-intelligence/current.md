---
date: 2026-09-06T19:30:00+10:00
session_name: allocation-intelligence
branch: main
status: active
---

# Work Stream: allocation-intelligence

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-09-07T05:00:00+10:00
**Goal:** Two surfaces that read the whole register: disadvantage versus dollars per council (`/allocation`) and seven-year charity trajectories (`/charities/trajectories`), plus three grounded posts for the Philanthropy Australia conference (Brisbane, 8 to 10 Sept 2026). Done when both pages are live and verified, and the posts have no unverified claim.
**Branch:** feat/allocation-delivery-lane (PR #437, VISIBLE, open)
**Test:** `bash scripts/precheck.sh` · `node --env-file=.env scripts/check-migration-parity.mjs` · `node --env-file=.env scripts/check-private-exposure.mjs`

### Now
[->] PR #437 open, waits on two things in order: (1) Ben's `/db-apply supabase/migrations/20260907090000_mv_lga_allocation_delivery_and_trajectory.sql` (recreates mv_lga_allocation with the delivery lane + trajectory rollups; dry-run passed, ~12s); (2) regenerate `supabase/types/database.types.ts` onto the branch; then Ben eyeballs the preview and says merge. Merging before the apply breaks /allocation.

### This Session
- [x] #435 and #436 confirmed merged, branches gone.
- [x] Delivery-postcode lane + per-council trajectory rollups built (migration + /allocation, /allocation/[lga_code], /charities/trajectories), PR #437. Finding: delivery postcodes cover 11% of 24m recipient-lane money, by agency (NIAA none, Health 2%, ARC 100%); the lane shows where the record is silent.
- [x] Migrations applied + committed: `20260906120000_abs_lga_population` (ABS ERP 2023, 546 councils, inlined), `20260906120100_mv_lga_allocation` (council-keyed, lga_code, how-sure column), `20260906120200_mv_charity_trajectory` (63,565 ABNs, 2017-2023). Both matviews nightly in mv_refresh_registry. Types regenerated.
- [x] PR #430 merged `458bd4b2`: `/allocation`, `/charities/trajectories`, trajectory block on `/charities/[abn]`, sitemap, pointer from the old funding-deserts report. Live and checked in a browser.
- [x] PR #429 (other session, `ecosystem_sites` public read) merged `611c405f` after allowlisting the table in `check-private-exposure.mjs` on Ben's "allowlist ecosystem sites". Parity + exposure green on main.
- [x] PR #431 merged `5aab8758`: `/allocation` links a council only where a council page exists (~117 remote councils), prefix-tolerant slug match.
- [x] Posts drafted and grounded: `thoughts/shared/drafts/pa-conference-2026-09/posts.md` + `.provenance.md`. Verdict PASS with one inline flag.
- [x] Three merged branches deleted on origin. #431 verified live (NSW view: 18 links, new copy present).
- [x] #433 verified live (Aurukun page renders the low-sure warning inside the shell). All work branches deleted on origin.
- [x] Ben confirmed nothing signed for Goods since 25 July; the last inline flag in post 3 is cleared (PR #435). Posts are ready to use.
- [x] PR #433 merged `375c7809`: `/allocation/[lga_code]`, a page for all 546 councils (tiles, low-sure warning, charities largest first with direction, neighbours by need); index links every council; `/allocation/*` chromeless. Dev server stopped.

### Next
- [ ] After #437 lands: verify /allocation, /allocation/30150 (Alice Springs area code check), /charities/trajectories live in a browser.
- [ ] The delivery-lane finding (NIAA states no delivery postcode on $3.84bn) is a post-worthy claim; ground it before use.

### Decisions
- **New matview, not a fix to mv_funding_deserts.** The old one is name-keyed off postcode_geo, which the LGA rebuild found wrong; the new one stands on `gs_entities.lga_code` and ABS population.
- **Money follows the recipient's address, and the page says so.** Remote councils at $0/head are a statement about the record; the how-sure column (placed share) is on every row.
- **Cohort counts are exact head-counts.** Selecting rows and counting in JS hit PostgREST's 1,000-row cap and printed "1,000 charities".
- **$0-revenue charities are dormant, not shrinking**; excluded from the shrinking list.
- **`ecosystem_sites` is public by decision** (site names, URLs, Vercel ids; no write policy).
- **Push every fix and confirm the PR tip BEFORE arming `--auto`.** Main is unprotected, so auto-merge fired on #430 before the parity-fix push landed (memory: automerge-races-followup-push).

### Open Questions
- UNCONFIRMED: PR #435 merged (watcher was running at clear).
- UNCONFIRMED: whether `revenue_from_government` in ACNC AIS includes fee-for-service from government (the page says it does; ACNC guidance not re-read this session).

### Workflow State
pattern: build-verify-ship
phase: 4
total_phases: 4
retries: 0
max_retries: 3

#### Resolved
- goal: "have a go at building this properly: funding deserts per council, charity trajectories, posts for the philanthropy conference"
- resource_allocation: aggressive (3 migrations applied, 3 PRs merged in one session)

#### Unknowns
- (none)

#### Last Failure
E2E on #431 timed out on the ACT field desk page (unrelated); green on re-run. `gh pr merge --auto` is not allowed on this repo (GraphQL `enablePullRequestAutoMerge`); merge directly on green.

---

## Context
Recon findings that shaped the build: `acnc_ais` had 360K rows and every reader took one year; `lga_cross_system_stats.population` covered 359 of 547 councils by name; SEIFA is held per postcode, so council need is weighted through `abs_poa_lga_ratio`. Dry run of all three migrations in one rolled-back transaction took 25s. Live figures on 2026-09-06: $82.0bn government revenue and $10.8bn donations for charities placed in a council (whole register $107.3bn / $18.5bn); 12,114 shrinking, 6,057 lapsed, 3,919 three-year deficits, 7,431 government-dependent.
