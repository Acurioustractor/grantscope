---
date: 2026-09-06T19:30:00+10:00
session_name: allocation-intelligence
branch: main
status: active
---

# Work Stream: allocation-intelligence

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-09-07T09:50:00+10:00
**Goal:** Two surfaces that read the whole register: disadvantage versus dollars per council (`/allocation`) and seven-year charity trajectories (`/charities/trajectories`), plus three grounded posts for the Philanthropy Australia conference (Brisbane, 8 to 10 Sept 2026). Done when both pages are live and verified, and the posts have no unverified claim.
**Branch:** main
**Test:** `bash scripts/precheck.sh` · `node --env-file=.env scripts/check-migration-parity.mjs` · `node --env-file=.env scripts/check-private-exposure.mjs`

### Now
[->] Nothing in progress. Everything from 2026-09-07 is merged and live (#437 #441 #444 #446 #447; migrations 20260907090000 to 20260907140000 applied; #440 #442 closed). Ben cleared at 09:50. Pick from Next.

### This Session
- [x] #446 merged `c609a725`: foundations.total_giving_annual placeholders (9,242 rows, $731m of guesses) replaced by latest AIS grants made ($3.33bn); 843 NULL where no return; old value in metadata.placeholder_giving. Root cause: refresh-acnc-ais.mjs enriches via exec_sql (SELECT-only), never wrote.
- [x] #442 closed: the 'fragments' were the NSW FaCS 2018-19 report's table of contents loaded as 10 grants (page numbers as dollars, $470); deleted by migration 20260907140000 on Ben's "delete". Trap: program_name carried a trailing space, equality on the visible string matched nothing.
- [x] #444 merged `dd7ec00e` and live: filters on six browse tables (sector/remoteness, sector, FY range, supplier state, donor party + until-year, foundation state), junk names out, foundations $0 vs 'no return filed', foundation type chips fixed (linked to the redirecting old path). Migration 20260907120000 applied.
- [x] ACNC AIS 2024 loaded: 53,939 rows. The data.gov.au file changed shape (lowercase headers, no year column, y/n, dd/mm/yyyy, one duplicate ABN); refresh-acnc-ais.mjs fixed. Foundations with no return 2,224 -> 1,864 (1,341 registered after Jun 2023).
- [x] #441 merged `f576e801` and live: two-way sort on all nine browse tables + /allocation, allocation search + sure chip, sidebar links, table width. Migration 20260907110000 applied.
- [x] #439 merged `d79c8445`: grounded NIAA paragraph in post 1 (NIAA: delivery state on all, postcode on none, 79 'Multiple'; Health 2%).
- [x] #440 filed (browse sort + filters), sort half built in #441; #442 filed (junk names at the bottom of rankings).
- [x] #435 and #436 confirmed merged, branches gone.
- [x] PR #437 merged `1fa759ba` and verified live. Migration 20260907090000 applied, parity green, types regenerated.
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
- [ ] **Widen the AIS year now that 2024 is loaded (53,939 rows).** mv_charity_trajectory is pinned 2017-2023 and mv_lga_allocation's acnc block to ais_year=2023; /allocation and the posts say "2023". Moving to 2024 is one migration (recreate both) plus copy on three pages and a re-ground of posts.provenance.md. mv_acnc_latest and foundation_browse already read 2024 automatically.
- [ ] **refresh-acnc-ais.mjs enrich step is dead code.** enrichFoundations() writes through exec_sql (SELECT-only): never updated total_giving_annual, never added new grant-making charities to foundations. Rewrite as Supabase JS updates or drop it and say so in the header; otherwise the next AIS year re-creates the placeholder problem for new rows.
- [ ] **$20.4m of qgip justice_funding rows have an empty recipient_name (500 rows).** Filtered out of browse lists but attributed to nobody; check the source spreadsheet for a recipient column offset.
- [ ] **Delete the two .bak files** (apps/web/.env.local.bak-20260905, .claude/settings.local.json.bak-20260905) on Ben's "delete": untracked, but they make classify-changes.sh call every PR VISIBLE.
- [ ] Filter chips are now hand-rolled four times (OrgBrowser, GrantBrowser, ContractSideBrowser, FoundationsBrowser). A shared ChipRow in browse-ui.tsx when the next filter is added, not before.
- [ ] ACNC side, no action here: 523 charities registered before mid-2023 with no statement in 2023 or 2024; 955 scraped Giving figures that mix program spend (World Vision $514m).
- [ ] The NIAA delivery-postcode finding is grounded and in post 1; if it becomes a talk line, the register table has no ACNC revocation status, so "no return" cannot be split into late vs revoked.

### Decisions
- **Zero is a figure, null is a gap.** A dash for $0 on the foundations table read as missing data; $0 prints as $0 and 'no return filed' names the gap (2026-09-07).
- **Filters are IN (subquery), never correlated EXISTS, in the browse RPCs.** 75s vs 1.6s on suppliers, measured in the dry run.
- **Two-way sort lives in the RPC (p_dir), not the client.** The RPCs return the top 200 of a ranking; reversing that client-side shows the smallest of the largest.
- **Delete junk rows, do not filter them, when the ingest was a one-off** (the NSW FaCS table of contents). Filters are for things that come back.
- **New matview, not a fix to mv_funding_deserts.** The old one is name-keyed off postcode_geo, which the LGA rebuild found wrong; the new one stands on `gs_entities.lga_code` and ABS population.
- **Money follows the recipient's address, and the page says so.** Remote councils at $0/head are a statement about the record; the how-sure column (placed share) is on every row.
- **Cohort counts are exact head-counts.** Selecting rows and counting in JS hit PostgREST's 1,000-row cap and printed "1,000 charities".
- **$0-revenue charities are dormant, not shrinking**; excluded from the shrinking list.
- **`ecosystem_sites` is public by decision** (site names, URLs, Vercel ids; no write policy).
- **Push every fix and confirm the PR tip BEFORE arming `--auto`.** Main is unprotected, so auto-merge fired on #430 before the parity-fix push landed (memory: automerge-races-followup-push).

### Open Questions
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
