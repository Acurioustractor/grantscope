# Central Australia place data

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-08T14:15:00Z
**Goal:** Apply the Ceduna treatment to Central Australia, focused on Alice Springs, the Utopia homelands and Tennant Creek. **Done and committed.**
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

### Next
- [ ] **Merge PR #175 first.** This branch is stacked on it and cannot land before it
- [ ] **The Far West Coast label bug is in #175 as written.** It is fixed on this branch, not on #175. If #175 merges alone it ships a page saying Maralinga Tjarutja carries the township when it holds nothing
- [ ] Correct the stale 107/109-Stretch prose in three Notion fields (147 is confirmed correct)
- [ ] Utopia consent is `Not checked` — that gates any public Goods surface, not just storyteller names
- [ ] `mv_lga_place_profile` is delivery-keyed. Any other page reading it understates the same way. Worth an audit of consumers
- [ ] The Far West Coast page runs its own hardcoded LGA query rather than `getPlaceIntelligence`, so it does not benefit from `hubAdministration` or the registered-address figure. Converging them would remove a whole class of drift
- [ ] Next region: APY Lands, Kimberley or Cape York. `HubAdministration` and `GazetteerGap` are ready; each needs its credited-org list verified org by org before it goes on a page

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
