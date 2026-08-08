# Central Australia place data

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-08T14:15:00Z
**Goal:** Apply the Ceduna treatment across remote Australia. **Four regions done:** Central Australia, Far West Coast, the Kimberley, Cape York.
**Branch:** `feat/place-central-australia` — worktree `/Users/benknight/Code/grantscope-place`, 1 commit, **stacked on `feat/place-funding-far-west` (PR #175, still unmerged)**
**Test:** `cd /Users/benknight/Code/grantscope-place/apps/web && npx tsc --noEmit && npx vitest run` (559 passing, was 550)

### Now
[->] Nothing running. Dev server stopped.

### This Session
- [x] **Central Australia survived the migrations.** `mv_lga_place_profile` matches live `gs_entities` counts exactly for all five councils. This was the thing worth re-checking rather than assuming, and it held
- [x] **The Far West Coast did not survive.** The postcode_geo rebuild moved all 23 organisations from Maralinga Tjarutja to Ceduna. Maralinga Tjarutja now holds **zero**. The registry entry claimed the opposite — fixed
- [x] **Hub administration is now a typed registry field** (`HubAdministration`), declared for both regions, with the credited total computed per request
- [x] **$93.6M of Utopia money is credited to Alice Springs**, verified org by org
- [x] **Utopia is not in the national gazetteer** — recorded as `GazetteerGap`
- [x] **Grants now read on registered address** beside the delivered figure. Delivery-keyed alone understated Central Desert by 76x
- [x] Verified by render: `/place/central-australia` HTTP 200 with $93.6M, $401.8M, $212.8M matching the register

### The two figures, side by side

| Council | Delivered here (old, delivery-keyed) | Held by orgs based here (new) |
|---|---|---|
| Alice Springs | $207.3M | **$2,441.1M** |
| Barkly (Tennant Creek) | $18.4M | **$401.8M** |
| MacDonnell | $7.0M | **$285.1M** |
| Central Desert | $2.8M | **$212.8M** |
| APY Lands | $0 | **$5.3M** |

93% of awards in this region publish no delivery location. The old figure was a 7% slice presented as a total.

### The $93.6M, org by org

All five carry `lga_name = 'Alice Springs'`. All five work in the Utopia homelands, roughly 250km north-east.

| Organisation | Postcode | Grants | Contracts |
|---|---|---|---|
| Urapuntja Health Service Aboriginal Corporation | 0871 | $49.6M / 27 | — |
| Urapuntja Aboriginal Corporation | 0872 | $41.4M / 21 | $427,174 |
| The Artists of Ampilatwatja Aboriginal Corporation | 0871 | $1.6M / 5 | — |
| Arlparra Aboriginal Corporation | 0872 | $558,030 / 3 | — |
| Utopia Farms Aboriginal Corporation | 0870 | — | — |

`Ampilatwatja Health Centre Aboriginal Corporation` ($34.1M) correctly resolves to Barkly — the same community, a different filed address, a different council. `Alyawarr Ingkerr-wenh Aboriginal Corporation` is in no council area at all.

### The Goods contrast — deliberately not on any surface

Ben's call this session: **nowhere yet.** All three Notion community rows are `Publish to site = NO`, and Utopia's consent status is `Not checked` with storyteller permissions still to be packaged. So this lives here and nowhere else until consent is packaged.

It is the whole argument for the evidence layer, so it should not be lost:

| Place | CivicGraph says (money) | Goods ledger says (delivery) |
|---|---|---|
| Alice Springs | 823 orgs, $2,441M held, $688M contracts | **16 beds**, 1 washing machine — the build base |
| Tennant Creek | 108 orgs, $402M held, $35M contracts | **160 beds**, 9 washing machines, deepest co-design history |
| Utopia / Urapuntja | **no council area at all** | **147 beds** (60 Basket + 87 Stretch) |

The money map and the delivery map point opposite ways. The place with the most money on paper has the least delivered; the place with the second-most delivered is geographically nowhere.

**Ben had already hand-corrected this pattern inside Goods' own data.** The Alice Springs row carries the note *"Do not double-count Utopia/Urapuntja basket beds here — those sit on the Utopia row."* The hub-administration distortion is not only in government registers. It reaches into Goods' own delivery ledger, and a human caught it there manually.

**Utopia bed count, confirmed by Ben 2026-08-08: 60 Basket + 87 Stretch = 147.** The properties are right. The **prose is stale** in three places in Notion, all claiming a 107-Stretch May figure that was later revised:

- Utopia row, `Next action`: *"Split held as 60 Basket + 109 Stretch (107 May + 2 latest)"*
- Utopia row, `What this place proves or tests`: *"107 Stretch from May field-note trip; +2 Stretch on latest trip. Total 169 (60 Basket + 109 Stretch)"*
- Alice Springs row, `Next action`: *"those sit on the Utopia row (60 Basket + 107 May Stretch)"*

Not yet corrected — Notion edits are Tier 2 and need Ben's go-ahead.

### The Kimberley (added same session)

Same shape as Utopia, verified the same way. **ARDYALOON, DJARINDJIN, LOMBADINA, BEAGLE BAY, BIDYADANGA are all absent from ABS SAL_2021.** DAMPIER PENINSULA, the locality above four of them, spans **Broome and Derby-West Kimberley** — so resolving to it still names no council. Bidyadanga is the largest remote Aboriginal community in WA and has no gazetteer entry at all.

**$17.1M credited to Broome**, four organisations, each checked individually:

| Organisation | Counted under | Grants | Contracts |
|---|---|---|---|
| Djarindjin Aboriginal Corporation | Broome · 6725 | $10.1M / 14 | $635,659 |
| Ardyaloon Incorporated | Broome · 6725 | $4.0M / 15 | $644,184 |
| Bardi and Jawi Niimidiman Aboriginal Corporation RNTBC | Broome · 6725 | $1.5M / 3 | — |
| Ardyaloon Art & Culture Aboriginal Corporation | Broome · 6725 | $231,000 / 2 | — |

**The wall is worse here than anywhere yet measured.** Halls Creek: 5 organisations with a council area, 100 in postcode 6770 without, 75 of them community-controlled. Region-wide, **391 of 721 unplaced organisations are community-controlled**, spread across five postcodes (6725, 6743, 6770, 6765, 6740).

`unplaced` now takes a list of postcodes. Naming only the largest would have reported a fraction as the whole.

### Cape York — the region that broke the model

Verified the same way, and the org-by-org step earned its keep: it caught a shape the type could not express.

**The hub is outside the region.** Every earlier region had a hub inside it. On Cape York each community has its own shire council, so there is no in-region hub, and the distortion is *worse* rather than absent. **$661.1M** ($645.2M grants + $15.9M contracts) is recorded against **Cairns**, which is not on Cape York:

| Organisation | Counted under | Grants |
|---|---|---|
| Apunipima Cape York Health Council | Cairns · 4870 | $273.8M |
| Cape York Solutions | Cairns · 4870 | $113.9M |
| Cape York Land Council | Cairns · 4870 | $112.2M |
| Cape York Employment | Cairns · 4870 | $56.7M |
| AFL Cape York | Cairns · 4870 | $29.2M |
| **Kowanyama Aboriginal Council** | Cairns · 4870 | $26.1M |
| Cape York Institute | Cairns · 4870 | $14.9M |
| Lockhart River Aboriginal Shire Council Youth Support | Cairns · 4870 | $13.2M |

Kowanyama Aboriginal Council is a **local government**, recorded as a Cairns organisation. Kowanyama shire holds one organisation.

**Three things this region taught us:**

1. **`hubIsOutsideRegion` was needed.** The guard required `hubLga ∈ lgaNames`. That held twice and would have forced Cape York to either mislabel Cairns as a Cape York council or drop the finding. Adding Cairns to `lgaNames` was the wrong fix — thousands of unrelated orgs would bury the peninsula in its own page.
2. **A confident wrong answer is worse than a null.** Utopia and the Dampier Peninsula fall out of the gazetteer and land unplaced, which a page can say. Kowanyama Aboriginal Council is placed, wrongly, with nothing signalling doubt. **Cape York has zero gazetteer gaps** — the reference data is fine and the addresses are not.
3. **A community can scatter across four councils.** Kowanyama appears under Cairns, Carpentaria, Kowanyama and Tablelands. Carpentaria and Tablelands are not on Cape York.

Four shires — **Hope Vale, Mapoon, Napranum, Lockhart River** — hold **zero** organisations in our records.

### Bug found and fixed while reading

**The unplaced list never filtered on `lga_name`.** It printed every organisation in the postcode under a heading saying none of them could be placed. Urapuntja Aboriginal Corporation appeared as unplaceable on the same page that showed it counted under Alice Springs. Central Australia's list is now 87 genuinely unplaced organisations.

### Correction to two claims I made about the next steps

1. **"Converging Far West into RegionReport is the obvious next refactor" — wrong, it would be a downgrade.** I said Far West showed "neither the hub section nor the registered-address grant figure". It has both: a hub section at line 113 and `getPostcodeFundingPicture` for 5690 *and* 5680. It also has crime suppression, per-community distances and the corrections narrative, none of which `RegionReport` had. And **Maralinga Tjarutja has no `mv_lga_place_profile` row**, so `RegionReport` cannot render its card at all — the line "holds no organisations, not because none work there" would silently vanish, which is the erasure that page exists to stop. The arrow points the other way, and the communities table has now been lifted *up* into `RegionReport`.
2. **"Cape York may not fit the pattern" — right instinct, wrong reason.** The shires do each have a council. That is precisely *why* the distortion is worse: the councils exist and are still credited elsewhere.

### Correction to an earlier claim in this handoff

I told Ben #175 shipped a user-visible bug (a page claiming Maralinga Tjarutja carries the Ceduna township). **That was wrong.** `getPlaceIntelligence` has no consumer outside its own module; the Far West Coast page runs its own hardcoded query and its own prose, which is accurate. The stale registry entry was dead config, fixed on this branch. No cherry-pick was needed.

### Next
- [ ] **Merge PR #175 first.** This branch is stacked on it and cannot land before it
- [ ] Correct the stale 107/109-Stretch prose in three Notion fields (147 is confirmed correct)
- [ ] Utopia consent is `Not checked` — that gates any public Goods surface, not just storyteller names
- [ ] `mv_lga_place_profile` is delivery-keyed. Any other page reading it understates the same way. Worth an audit of consumers
- [ ] **Do NOT converge Far West into `RegionReport`.** It is the richer page. What is left to lift *up* from it: `getPostcodeFundingPicture` (per-postcode registered-address funding with ending-soon awards) and crime suppression. Both are genuinely useful to every region
- [ ] **`RegionReport` cannot show a council with no `mv_lga_place_profile` row.** Maralinga Tjarutja is the known case. Any council whose organisations all get nulled disappears from its own region page rather than showing zero. Worth a left-join against `lgaNames` so a council can render as an explicit zero
- [ ] Kimberley unplaced list is capped at 300 of 721 for display. The cap is reported, but the other 421 organisations are named nowhere. Cape York shows 109 of 345, Central Australia 87 of 143 — both under the cap
- [ ] The "Showing N of M" caption compares two populations: N is community-controlled and currently-registered, M is every unplaced organisation in the postcodes. Honest but not obvious
- [ ] Next region: APY Lands. It is currently a single council row inside `central-australia` with 5 orgs and $0 delivered, which almost certainly understates it the way Ceduna was understated

### Decisions
- **State it, don't move it.** The Utopia orgs keep their Alice Springs attribution. Nulling them would have been consistent with the Ceduna precedent but would make Utopia *less* visible, and ABS offers nothing to re-place them with. The correction is editorial and reversible; the database is unchanged
- **No Goods data on any surface**, public or internal, until consent is packaged
- **Credited orgs are a name list, not a heuristic.** No rule separates a homeland organisation from a town one. Each name was checked against `lga_name` individually
- **Both grant figures shown, neither replaced.** Delivered says where money is spent; held says which organisations hold it. Neither is the whole answer
- **Only orgs sitting inside the hub's own figure count toward the credited total.** An org placed elsewhere, or nowhere, is not inflating the hub, and including it would overstate the problem

### Open Questions
- UNCONFIRMED: whether Urapuntja people would accept "Sandover" as the name for the place, given ABS has no entry for Urapuntja. Question for the room
- ~~UNCONFIRMED: the 147/169 bed discrepancy~~ **RESOLVED 2026-08-08: 147 is correct. The prose was stale, not the properties**
- The 64,801 wall is unmoved. Postcode 0872 holds **139 unplaced organisations, 137 of them community-controlled** (98.6%), only 65 with an ABN. Compare postcode 0820, Darwin's suburbs: 657 orgs, 49 community-controlled. The wall falls almost entirely on community-controlled organisations

### Workflow State
pattern: diagnose-then-fix
phase: 5
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "apply the Ceduna treatment to Central Australia" — DONE
- utopia_attribution: state it, don't move it — applied, DB unchanged
- goods_surface: nowhere yet, handoff only — applied
- hub_pattern: generalised to a typed registry field for both regions

#### Resolved (continued)
- utopia_bed_count: **147 (60 Basket + 87 Stretch)**, confirmed by Ben 2026-08-08. Stale prose in three Notion fields still to correct

#### Unknowns
- next_region: UNKNOWN — Ben's pick (APY / Kimberley / Cape York)
