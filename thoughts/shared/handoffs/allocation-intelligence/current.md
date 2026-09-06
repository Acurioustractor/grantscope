---
date: 2026-09-06T19:30:00+10:00
session_name: allocation-intelligence
branch: main
status: active
---

# Work Stream: allocation-intelligence

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-09-06T19:50:00+10:00
**Goal:** Two surfaces that read the whole register: disadvantage versus dollars per council (`/allocation`) and seven-year charity trajectories (`/charities/trajectories`), plus three grounded posts for the Philanthropy Australia conference (Brisbane, 8 to 10 Sept 2026). Done when both pages are live and verified, and the posts have no unverified claim.
**Branch:** main
**Test:** `bash scripts/precheck.sh` · `node --env-file=.env scripts/check-migration-parity.mjs` · `node --env-file=.env scripts/check-private-exposure.mjs`

### Now
[->] Confirm #433 is live: `civicgraph.app/allocation/30250` (Aurukun) should render the low-sure warning inside the shell (Playwright, not curl).

### This Session
- [x] Migrations applied + committed: `20260906120000_abs_lga_population` (ABS ERP 2023, 546 councils, inlined), `20260906120100_mv_lga_allocation` (council-keyed, lga_code, how-sure column), `20260906120200_mv_charity_trajectory` (63,565 ABNs, 2017-2023). Both matviews nightly in mv_refresh_registry. Types regenerated.
- [x] PR #430 merged `458bd4b2`: `/allocation`, `/charities/trajectories`, trajectory block on `/charities/[abn]`, sitemap, pointer from the old funding-deserts report. Live and checked in a browser.
- [x] PR #429 (other session, `ecosystem_sites` public read) merged `611c405f` after allowlisting the table in `check-private-exposure.mjs` on Ben's "allowlist ecosystem sites". Parity + exposure green on main.
- [x] PR #431 merged `5aab8758`: `/allocation` links a council only where a council page exists (~117 remote councils), prefix-tolerant slug match.
- [x] Posts drafted and grounded: `thoughts/shared/drafts/pa-conference-2026-09/posts.md` + `.provenance.md`. Verdict PASS with one inline flag.
- [x] Three merged branches deleted on origin. #431 verified live (NSW view: 18 links, new copy present).
- [x] PR #433 merged `375c7809`: `/allocation/[lga_code]`, a page for all 546 councils (tiles, low-sure warning, charities largest first with direction, neighbours by need); index links every council; `/allocation/*` chromeless. Dev server stopped.

### Next
- [ ] Ben: confirm "nothing is signed for the next round" (Goods CRM snapshot is 25 July) and clear the inline flag in post 3.
- [ ] `mv_lga_allocation` attributes money to the recipient's council; a delivery-postcode lane from `grantconnect_awards.delivery_postcode` would show the hub-versus-community gap directly.
- [ ] `/charities/trajectories` lists are national top-25s; per-council rollups (shrinking charities by LGA) are one query away on `mv_charity_trajectory.lga_code`.

### Decisions
- **New matview, not a fix to mv_funding_deserts.** The old one is name-keyed off postcode_geo, which the LGA rebuild found wrong; the new one stands on `gs_entities.lga_code` and ABS population.
- **Money follows the recipient's address, and the page says so.** Remote councils at $0/head are a statement about the record; the how-sure column (placed share) is on every row.
- **Cohort counts are exact head-counts.** Selecting rows and counting in JS hit PostgREST's 1,000-row cap and printed "1,000 charities".
- **$0-revenue charities are dormant, not shrinking**; excluded from the shrinking list.
- **`ecosystem_sites` is public by decision** (site names, URLs, Vercel ids; no write policy).
- **Push every fix and confirm the PR tip BEFORE arming `--auto`.** Main is unprotected, so auto-merge fired on #430 before the parity-fix push landed (memory: automerge-races-followup-push).

### Open Questions
- UNCONFIRMED: #433 live on production (Vercel build running at 19:50 AEST).
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
