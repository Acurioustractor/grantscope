# Place data — regions, councils, and the need layer

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-08T18:00:00Z
**Goal:** Make public money legible per place across remote Australia, and say plainly where the records fail. **Shipped, unreviewed.**
**Branch:** `feat/place-central-australia` — worktree `/Users/benknight/Code/grantscope-place`, **19 commits, PR #176 open, all checks green, NOT merged.** PR #175 merged 8 Aug and is live on main.
**Test:** `cd /Users/benknight/Code/grantscope-place/apps/web && npx tsc --noEmit && npx vitest run` (589 passing, was 550)
**Local:** `cd apps/web && npx next dev --turbopack -p 3013` → http://localhost:3013/place/council

### Now
[->] Nothing running except possibly a dev server on 3013 (`pkill -f "next dev.*3013"`). **The only open task is Ben reviewing the pages and merging #176.**

---

## What exists now

**Nav → Platform → "Remote Communities"** → `/place/council`. Nothing linked to any of this until the final commit; it was reachable only by typing URLs.

| Route | What it is |
|---|---|
| `/place/council` | Index of all **117 remote councils** holding 1,769 community-controlled orgs |
| `/place/council/[slug]` | Generated per-council page — unplaced orgs, gazetteer gaps, schools, overcrowding, SEIFA, org types, explicit gaps, correction invite |
| `/place/central-australia` | Fullest hand-done region. Everything |
| `/place/kimberley` | Hand-done |
| `/place/cape-york` | Hand-done |
| `/place/far-west-coast` | The original Ceduna page. **Deliberately NOT converged** — it is richer than `RegionReport` |

`/places` (plural) is a **different, older route** — postcode funding-gap analysis. Do not confuse them.

---

## The five misattribution mechanisms

The intellectual core. Each region revealed a different one; none was predictable from the last.

1. **Hub inside the region.** Alice Springs carries **$93.6M** of Utopia money (Urapuntja Health Service $49.6M, Urapuntja Aboriginal Corp $41.4M, Artists of Ampilatwatja, Arlparra, Utopia Farms). Broome carries **$17.1M** of Dampier Peninsula money. Ceduna carries Oak Valley, Yalata, Koonibba.
2. **Hub outside the region.** Cape York: **$661.1M** recorded against **Cairns**, which is not on Cape York. Includes **Kowanyama Aboriginal Council — a local government — at $26.1M**. Forced the `hubIsOutsideRegion` flag.
3. **Absent from the gazetteer.** URAPUNTJA, MULGA BORE, AHERRENGE, ARDYALOON, DJARINDJIN, LOMBADINA, BEAGLE BAY, BIDYADANGA have no ABS SAL_2021 entry. The localities above them (SANDOVER, DAMPIER PENINSULA) each straddle two councils, so resolving to them still names no council.
4. **Confidently wrong.** Cape York has **zero** gazetteer gaps — reference data is fine, addresses are not. Worse than absence: nothing signals doubt.
5. **Wrong state.** **13 APY Lands organisations recorded as NT / Alice Springs**, carrying ~$6.4M. The APY Lands are South Australian. Breaks the coarsest geography there is.

---

## Data layers added, with licences

| Layer | Source | Licence | Grain |
|---|---|---|---|
| **Schools** — ICSEA, enrolments, Indigenous % | `acara_schools` (already in DB, 9,755, 2025) | — | council + real lat/lng |
| **Overcrowding** | AIHW HPF measure 2.01, table D2.01.10 | **CC BY 4.0** | remoteness class |
| **RHD** | AIHW HPF measure 1.06, table D1.06.12 | **CC BY 4.0** | NT regions only |
| **IRSEO** — 401 Indigenous Areas | Biddle & Markham 2023, CAEPR ANU | **Authors retain copyright**, used with attribution on Ben's call | Indigenous Area |
| SEIFA IRSD / **IEO** / **IER** | already in DB | — | postcode |

Data file: `apps/web/src/data/irseo-2021.json` (401 areas, 53KB). Modules: `school-need-signal.ts`, `overcrowding-signal.ts`, `rhd-signal.ts`, `irseo-signal.ts` — all typed with guards, no DB tables added.

**Headline figures:** Very remote Australia — **31.3%** of First Nations households overcrowded vs 2.7% of others (**11.6×**), 933 need 4+ extra bedrooms. Central Australia RHD — **625 First Nations people, 2.9 in every 100, rate ratio 31**. Central Desert schools — ICSEA **612**, 3.9 SD below the mean, 96.3% Indigenous. **Urapuntja is Indigenous Area 709012, 99th percentile of disadvantage** — the only geography in the codebase that names Utopia.

**The renewal cliff:** 58–64% of committed federal money ends within 24 months in every region. Central Australia $1,829.1M committed, $1,170.6M ending.

---

## Bugs found and fixed this session

- **Far West registry described the inverse of the data.** The postcode_geo rebuild moved all 23 orgs from Maralinga Tjarutja to Ceduna; the entry still claimed the opposite. Dead config, not user-visible.
- **Unplaced list never filtered on `lga_name`** — printed every org in the postcode under a heading saying none could be placed.
- **Five councils vanished from their own pages**, four of them Aboriginal shires (Maralinga Tjarutja, Hope Vale, Mapoon, Napranum, Lockhart River). Councils were built from returned MV rows; a council whose orgs were all nulled produces no row. Cape York showed 9 of 13.
- **Grants read on delivery location** — a 7% slice presented as a total. Central Desert $2.8M vs $212.8M actually held.
- **SEIFA read the postcodes the council's organisations are registered in**, not the postcodes ABS assigns to the council. Put the registered-address distortion inside a need measure. Central Desert reported 3/4.5/2; correct is 1/1/1.
- **Social enterprises joined on postcode** — credited Central Desert with 150, all in 0872. ABN join gives 8.
- **Nothing linked to any of it.** Found only when Ben asked where the pages were.

---

## Corrections to my own claims (so they are not repeated)

- **`/map` does not show duplicate councils** — `/api/data/map` already wraps `mv_funding_deserts` in `DISTINCT ON`. I diagnosed the table and reported it as the screen.
- **Converging Far West into `RegionReport` would be a downgrade.** It already has a hub section and `getPostcodeFundingPicture`, plus crime suppression and per-community distances. And `Maralinga Tjarutja` has no MV row, so `RegionReport` cannot render its card at all.
- **#175 had no user-visible bug** — `getPlaceIntelligence` has no consumer outside its own module.
- **IRSEO does not carry overcrowding as a column.** It is an input to the composite, not a field. Community-level crowding remains unsolved.
- **An `ILIKE '%APY %'` matched "therAPY "** and produced a confident wrong answer. Beware short acronyms.

---

## Next

- [ ] **Review the preview and merge #176.** 19 commits, nothing live until it lands
- [ ] **`/map` shows stale attribution.** `mv_entity_power_index` holds 161,689 placed entities vs 235,818 live — one refresh behind, so Ceduna reads as 1 org instead of 23. Fix: `node --env-file=.env scripts/refresh-views-v2.mjs --view mv_entity_power_index` then `--view mv_funding_deserts`. **Production refresh, needs Ben's go-ahead**
- [ ] **`/map` dedup rule biases the map.** `ORDER BY desert_score DESC` picks the most-severe row for councils spanning remoteness classes. Should order by modal remoteness
- [ ] `mv_funding_deserts` is genuinely duplicated (2,019 rows / 1,133 councils). Corrected definition written and dry-run — yields exactly 1,133 — but **two MVs depend on it** (`mv_disability_landscape`, `mv_foundation_need_alignment`) so it cannot be replaced without dropping all three. Not worth the blast radius for the map
- [ ] Confidence overlay on `/map`: "share of organisations we cannot place" as a selectable measure. All data now exists
- [ ] Corrections currently go to a **mailto**, which does not accumulate. A `place_corrections` table + moderation queue is the real version — DDL, needs Ben
- [ ] IRSEO joined by **name**, not point-in-polygon. A true join needs the ABS Indigenous Structure boundary file
- [ ] Kimberley unplaced list capped at 300 of 721; the other 421 are named nowhere
- [ ] Crime coverage is wildly uneven — NSW 99 councils, NT 6. Shown as an explicit gap
- [ ] `Top End` RHD figures loaded but unused; appear if a Top End region is added

## Decisions
- **State it, don't move it.** Utopia orgs keep their Alice Springs attribution. Nulling would make Utopia *less* visible and ABS offers nothing to re-place them with. Editorial and reversible; **the database is unchanged**
- **No Goods data on any surface.** All three Notion rows are `Publish to site = NO`; Utopia consent `Not checked`
- **Credited-org lists are hand-checked names, never heuristics.** No rule separates a homeland org from a town one
- **Both grant figures shown**, delivered and held — neither replaced
- **Empty councils render as "nothing in our records", not zeros.** Zeros claim nothing happens there
- **Only signals with honest geography go on the page.** Broken ones render as named gaps
- **IRSEO used with scholarly attribution**, Ben's call, not under an open licence

## Open questions
- Does it read as respectful or as a deficit inventory? Every page describes communities by disadvantage
- Is Central Australia now too dense — nine or ten sections?
- Have the caveats passed honest into exhausting?
- **UNVERIFIED by a human: whether someone from Utopia or Hope Vale would recognise themselves in it.** That was always the actual test

## Goods contrast — still not on any surface
| Place | CivicGraph (money) | Goods ledger (delivery) |
|---|---|---|
| Alice Springs | 823 orgs, $2,441M held | **16 beds** — the build base |
| Tennant Creek | 108 orgs, $402M held | **160 beds**, 9 washing machines |
| Utopia / Urapuntja | **no council area** | **147 beds** (60 Basket + 87 Stretch, confirmed) |

Notion bed-count prose corrected 8 Aug to 147 across three fields.
