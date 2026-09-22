---
date: 2026-09-23T06:40:00Z
session_name: community-money-finder
branch: main
status: active
---

# Work Stream: community-money-finder

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-09-23T06:40:00Z
**Goal:** Community and small organisations can see who funds work like theirs and who holds the money for their region, free, from public records. The power-and-philanthropy story is the argument; the finder is the tool.
**Branch:** `main` @ `1b1c9d33` (PR #506 merged, migration 20260923060000 applied and loaded, parity green)
**Test:** `bash scripts/precheck.sh` · `bash scripts/charity-story-figures.sh` · page on local dev at `/charities/<abn>/funders`

### Now
[->] Ben is still building, NOT deploying. Do not chase Vercel. Next build step: step 2 of the plan, "who is holding money in my name" (region match for mainstream charities, which report head office, not where they work).

### This Session (2026-09-22/23)
- [x] **Found the ACNC sync wiping foundation profiles.** `sync-acnc-register` wrote the importer's null/'low' over every enrichment column on every run; 10,166 profiles cleared on 2026-09-22, sawtooth in the foundations edge count since July. Fixed: existing rows get register fields only (name, acnc_data). The 44 "extra" foundation edges were never wrong; their `parent_company` had been cleared.
- [x] **Lobbying zero-ABN guard.** `asic_companies` stores ABN '0'; 5 lobbyists' clients landed on AU-ABN-0. Importer fixed. **The 5 existing edges still need a cleanup migration.**
- [x] **`scripts/check-stale-edges.mjs`** written: sorts every existing edge into match / repoint / unbuilt / orphan. Ran clean on `foundations` only. **Never re-run on aec_donations / austender / grantconnect / justice after the prelude-semicolon and trailing-comment fixes.**
- [x] **Jev classified all 53,879 charities** (`scripts/jev-charity-classify.mjs`): main sector, Aboriginal community control, education type, each with confidence. Loaded into `gs_charity_classification` (migration 20260923060000, Ben applied). 39,742 confident sectors, 209 confident community-controlled, 537 school funds.
- [x] **The story:** `thoughts/shared/drafts/2026-09-22-who-holds-the-giving.md`. Fact-checked twice, argument paragraph cut.
- [x] **The finder:** `/charities/[abn]/funders` + `apps/web/src/lib/community-funders.ts`. Peers by sector + state + size, programs that funded them, and "who holds the money for your region". Verified against the table with the local jsonl moved aside.
- [x] PR #506 merged as `1b1c9d33`, nine commits, `seen-by-ben`, all six checks green.

### Next
- [ ] Plan step 2: who holds money in my name, per region.
- [ ] The 5 lobbying edges on AU-ABN-0: cleanup migration (Tier 3, Ben applies).
- [ ] Re-run `check-stale-edges.mjs` on austender, grantconnect_awards, justice_funding, aec_donations. Donations had $8.7bn wrong; the others have never been checked.
- [ ] Carried from jev-system-alignment: 4,819 donation edges that no longer resolve; step 4 repointing ~38K donation edges; Panasonic / Dept of Health donor re-resolutions; 1,710 below-threshold donor pairs; entity_type on renamed nodes.
- [ ] Foundation grants are absent from the finder (only a few hundred grantee edges exist).

### Decisions
- **Jev judges organisations, never people, and never sees a dollar figure.** Every total is summed in SQL afterwards.
- **0.9 confidence floor everywhere**, and the uncertain rows are reported, not hidden or spread across the others.
- **The community-controlled share is a RANGE, 1.5 to 6.4 cents**, not a point. Jev cannot see board composition, so it is unsure about real ACCOs (VACCA 0.73, IUIH 0.21). The old `is_community_controlled` flag is mostly right: wrong on 4 small orgs.
- **`foundations.total_giving_annual` is a size-band estimate from the importer, not reported giving.** Never use it for "gives $Nm a year"; use `acnc_ais.grants_donations_au`.
- **Classifications live in their own table**, not columns on `acnc_charities`: they are judgements with confidence, re-run when the rubric changes.
- **Finder is the free community half of the strategy**; buyers stay the revenue (Ben, grill 2026-09-22).
- **Peers = same Jev sector + state + size band**; unknown size excludes large orgs, so a remote clinic is not compared with a PHN.
- **"No grants" is not an answer.** Name who does hold the regional money (the intermediaries section), because remote money goes via PHNs and land councils that subcontract.

### Open Questions
- UNCONFIRMED: the finder has never been seen live on civicgraph.app. Merged and deployed, but the production check was abandoned at Ben's request while the build was still running. Nothing links to the page.
- UNCONFIRMED: what cleared `parent_company` historically is now fixed going forward, but the 10,166 profiles cleared on 2026-09-22 are not restored; they refill only as the profiling agents re-run.
- NOTE: `scripts/classify-changes.sh` reads the working tree; untracked `Grantscope.pen` makes every PR look VISIBLE. Use `git diff --name-only origin/main...HEAD`.
- NOTE: local dev bound to **3003**, not 3013 (3013 was taken).
- NOTE: `gh pr edit` dies on this repo's Projects-classic; use `gh api -X PATCH repos/.../pulls/<n>`.

### Workflow State
pattern: build-measure-ground
phase: 2
total_phases: 6
retries: 0
max_retries: 3

#### Resolved
- goal: "tell the story of power and philanthropy, and give community organisations a way into the money"
- resource_allocation: balanced

#### Unknowns
- (none)

#### Last Failure
(none open)

---

## Context

Ben's frame, in his words: pull all the data and tell the story about power, philanthropy and giving, what private schools and their connections do to the world, and how communities are let down by strategic and impact reporting rather than community-led work. Then: what would community and small organisations search for to grow, and how do they tap into the money Australia already has.

The session started on graph-edge correctness (carried from `jev-system-alignment`) and Ben stopped it: months of churn with no usable result. The pivot was deliberate. Graph cleanup is now backlog; the story and the finder are the work.

**What the story says.** 53,879 charities, $192.8bn revenue, $95.3bn of it government. 12,574 charities tick "serves Aboriginal and Torres Strait Islander people" and take $81.5bn; between 1.5 and 6.4 cents in each dollar reaches organisations those communities control. 1,311 non-government schools hold $44.61bn in net assets and run 537 of their own tax-deductible funds holding $2.55bn; those funds took $149.5M in donations in a year, six times what the 209 confirmed community-controlled organisations received and fifty times what ORIC corporations reporting to the ACNC received.

**Why Jev.** Every weak point in the first draft was a classification judged by name pattern or an unaudited flag. Jev judges organisations from their own ACNC descriptions at a stated confidence, cheaply, and the maths stays in SQL where it belongs. Two fact-check passes killed a fabricated grantmaker figure and an unevidenced paragraph.

**Where the finder goes next**, from `thoughts/shared/plans/2026-09-22-community-money-finder.md`: (2) who holds money in my name, (3) foundations sitting on assets, (4) who is connected to that funder, (5) grants I am actually eligible for (Jev reads criteria against the org's description), (6) ALMA evidence for applications.

**Test organisations:** Ampilatwatja Health Centre Aboriginal Corporation (61426053586, NT, not on the ACNC register, so it picks its own sector) and Maningrida Progress Association (69037382574, NT, Large).
