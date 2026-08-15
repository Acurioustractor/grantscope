# BAR CHECK — does CLARITY-SPEC.md clear "way way better"?

Judged 2026-08-14 against `thoughts/shared/data-map/BUILD-SPEC.md`.
Verification key: **[V]** I ran the query myself in this session · **[R]** relayed from a document
in this exercise · **[I]** my inference · **[U]** nobody checked.

---

## VERDICT

# CLEARS — on structure. DOES NOT CLEAR on the vision half.

The "same four screens with nicer words" charge is **false**, and I looked for it specifically.
The organising axis changed from a noun to a claim. Six of nine screens have no BUILD-SPEC
counterpart. Eleven new database objects encode, as constraints, discipline the old spec left to
human memory. That is a category change, not a rewrite.

But three of the pillars Ben named out loud — **media**, **the 212 views that already answer his
questions**, and **JusticeHub / Empathy Ledger** — are either absent or present only as a name.
One of them (media) is 881 live rows updated yesterday and is used **once, as an empty cell**.

**It clears the bar as an instrument. It does not yet clear it as the thing nobody else has.**
Five additions below close that, and four of the five are cheap.

---

## 1. THE DIFF — new versus reorganised, quantitatively

### 1.1 Counts

| | BUILD-SPEC | CLARITY-SPEC | |
|---|---|---|---|
| Page routes | 5 | **9** | +4 |
| Screens with a BUILD-SPEC counterpart | — | **2** (ledger, object) | |
| Screens *partially* carried | — | **2** (gaps→wants; map→a button on seams) | |
| **Screens genuinely new** | — | **6** — BOARD · WORKED ANSWER · ROWS · SEAMS · CROSS · WHAT CHANGED | |
| API routes | 3 | 6 | +3 |
| Migration files | 1 | 7 (3 carried + 4 new) | +6 |
| New DB objects beyond the shared catalog | 0 | **11** + 4 columns | |
| CI guards / DB constraints encoding a rule | 1 constraint + `guards.ts` | 5 constraints + 3 test files | |
| New npm dependencies | 0 | **0** | held |
| Estimated days | 9.5 | 18.5 | +95% |
| Object universe | 812 | **1,433** | corrected |

### 1.2 The one thing that actually changed

BUILD-SPEC L0 sentence: *"We hold 812 objects, 52.3M rows, and N% of them are documented."*
CLARITY-SPEC S1 sentence: *"What can we say today that nobody else can, what is one fix away, and
what is currently lying?"*

Those are different products. The first is a catalog. The second is a newsroom that happens to keep
a catalog. Everything else in the diff follows from that.

The tell that it is real and not rhetorical: `FEEDS` / `BLOCKS`. Those two columns on the ledger are
only computable *because* a question registry exists, they are 100% derived with zero curation, and
`FEEDS 0` sorted ascending filtered to `rows > 1,000,000` is a two-click answer to "what enormous
thing am I not using". An inventory-first design cannot produce that column at any price.

### 1.3 Twelve things with no BUILD-SPEC analogue at all

Not "improved" — **absent** from BUILD-SPEC:

1. A question registry as the organising axis (`clarity_question` + ingredients + answers).
2. `caveat`, `exclusions`, `claim_phrasing`, `forbidden_phrasing` as **NOT NULL schema fields** with
   a `length(btrim(caveat)) > 20` CHECK. BUILD-SPEC has a caveat per *object*; a caveat per *claim*
   is the one that stops the 45.3× error.
3. `[ COPY THE CLAIM ]` — the number cannot leave the building without its coverage, its exclusions
   and its caveat. Nothing in BUILD-SPEC touches what happens after you screenshot it.
4. `clarity_one_binding` — a partial unique index guaranteeing exactly one binding join per
   question. Without it a question with a 94% join and a 12.9% join renders the 94%.
5. Sentinels with `block`/`warn` severity, armed against three already-confirmed lies
   (85.3% `other receipt`; the $123.00bn Hays row; the two 605,135-edge category nodes).
6. **WHAT CHANGED** + the anomaly rule + `NO REASON RECORDED` staying red until a human types one.
   BUILD-SPEC has a row-count sparkline on the dossier. It has no event log, no unexplained-change
   state, and no obligation on anyone.
7. `headline_num` and **answer drift** — a headline moving >10% with no ingredient row-count change.
   That failure mode does not exist in an inventory, which is the point.
8. The six-glyph alphabet where `+` (never measured, ours), `?` (unmeasurable) and `×` (measured and
   zero, theirs) **never collapse**, plus `glyph-coverage.test.ts` failing the build on an empty
   cell. BUILD-SPEC's `✓ / + / ⚠ / ⛔` conflates "we haven't looked" with "it's broken".
9. `phrasing.ts` + `phrasing.test.ts` — a build-failing lint on "has no evidence", "unfunded", "$0"
   for an unplaced area, "unused". This is the LGA-attribution discipline generalised into CI.
10. **SEAMS ranked by `rows_at_stake × (1 − match_rate)`.** BUILD-SPEC draws joins as a graph. This
    sorts them by what they are losing, which puts all four defects that matter in the top five rows.
11. The flow matrix + `[ MINT THIS AS A QUESTION → ]` — a path from a computed cell to a registered
    claim.
12. `refused` as a first-class route that renders no chart and continues the journey.

### 1.4 What is reorganised, honestly

- The ledger and the object dossier are **the same screens, upgraded**. Ranked strips instead of one
  flat list, `Δ` promoted to column three, sub-rows carrying reasons in place instead of tooltips,
  `FEEDS`/`BLOCKS` added. Better, not new.
- The opportunity queue → the want list. Same idea; the improvement is structural (derived from
  blocked questions rather than 11 hand-typed entries in `opportunities.ts`).
- The join map → a button. Correctly demoted.
- `.ws` theme, admin gate, zero dependencies, "no new markdown inventory", `n_live_tup` is broken,
  read `pg_attribute` not `information_schema` — all carried verbatim. Correctly.

### 1.5 Regressions from BUILD-SPEC, none of them argued

§1.5 "What is deliberately rejected" lists nine rejections, and **not one of these four is on it**
[V, grepped]:

| Lost | Why it mattered |
|---|---|
| **The nullity co-occurrence matrix** (6×6, missingno pattern) | *"Do our blind spots cluster?"* A dark block is a whole abandoned region of the schema shown as one shape instead of 300 rows. It is the only thing in either document that answers a question about the shape of our ignorance. 36 cells, inline SVG, zero cost. |
| **The `OWNER APP` facet** (civicgraph / justicehub / both / **neither**) | See §5. `owner_app` survives in the SELECT at line 727 and `repo` survives in `clarity_code_ref`; the affordance that made them usable is gone. |
| **The islands panel** ("how many islands is this database, what makes it one graph") | Partly replaced by the Isolate panel — but that is about *entities*, not the schema. |
| The 16 domain tiles with log10 sparklines | Arguably right to cut. Should still have been said. |

Things that vanish without an argument are the ones that come back as *"why did we lose that."*

---

## 2. WOULD BEN SAY "YES, THAT IS IT"?

**On day 13, yes. On day 4, no — and day 4 is what he sees first.**

### What is distinctively his, and could not be bought

1. **The phrasing table.** `"has no evidence"` → `"no evidence record linked in ALMA · 1,277 of
   2,136 interventions carry one"`, enforced by a test that walks every `.tsx` and every seeded
   caveat. No commercial catalog ships that because no commercial catalog has a reason to care
   whether a null reads as an accusation. This repo earned that rule the hard way on LGA
   attribution and the spec generalises it correctly.
2. **`+` blue is ours, `×` red is theirs.** Spending `#D02020` on "no description written yet" is
   exactly what makes a catalog read as an accusation nobody acts on. That single colour rule is a
   taste judgement no vendor makes.
3. **Refusal with a URL.** `/clarity/q/detention-by-place` renders no chart, names the 13-row
   PDF_HEADLINE source, says NT is missing entirely, and hands you the two things it *can* honestly
   show. This is the `/atlas` consent-tier discipline and the "refused rather than confidently
   wrong" LGA decision, made into a route.
4. **`NO REASON RECORDED`, in red, until a human writes one.** `justice_funding` went
   218,022 → 157,116 and nothing fired. One boolean column and a text box makes that impossible.
5. **The rail owns every filter**, carried-but-inactive rather than silently dropped. That is his
   recorded rage-trigger, fixed.
6. **Plain words.** No `L0`–`L5`, no `/d/ /o/ /x/ /e/ /r/`.

### What would make him see a catalog he could buy

**Slice 1 is a data catalog.** 3.5 days, and what ships is a ledger, an object page and an estate
strip — the most catalog-shaped screens in the document, and the two that BUILD-SPEC already had.
The distinctive half arrives day 11 (cross-sections) and day 9 (what changed).

The spec knows this. §6 contains the single most important sentence in the document:

> *"If slice 2 has not shipped within 10 working days of slice 1, the surface has become an
> inventory and the direction has failed."*

That sentence is buried in a build-sequence subsection. It should be a gate at the top of the
document, because it is the entire difference between the two outcomes.

### The deeper gap

Every screen answers a question about **our estate**: what we hold, what broke, what is missing,
what changed *in the database*. Nothing answers a question about **the world today**. The board's
three flagship cards are findings, and findings go stale as findings — you read "85.1%" once.

There is no reason to open this on a Tuesday when nothing is broken. Addition #1 below fixes that
with data that already exists.

---

## 3. THE SINGLE MOST IMPRESSIVE THING — and is it real?

**The worked answer page (S2) as a unit**: the number, the binding join that caps it, the
`⚠ SAY IT THIS WAY` panel at equal visual weight, the deterministic exclusions, the armed
sentinels, and `[ COPY THE CLAIM ]` — in one eyeful, with `measure_kind` as a *required control*
so the 45.3× error is structurally impossible rather than merely documented.

### It is real. I ran it. [V]

```
778 organisations · 663 with no evidence record linked · 85.2% · $1,142.1m total · $670.9m no-ev
```
against the spec's drawn card of `85.1% · 662 of 778 · $663.9m of $1,142.1m`. Total dollars match to
the cent-rounded million. The 1-org / $7m difference is a slightly different "evidence linked"
predicate, not a fabrication. **Query time ~1 second** on `justice_funding` × `alma_interventions` ×
`alma_intervention_evidence`, today, with no new objects. [V]

Two more spot-checks, both real:
- Top seam row: `political_donations` — **653,261 of 2,549,483 rows carry any `donor_abn` (25.62%)**,
  measured in 2.6 s. The spec's "only 653,261 of 2,549,483" is exact. [V]
- Bidder fragility is structurally supported: `acnc_ais` carries `abn`, `ais_year`,
  `total_current_assets`, `total_current_liabilities`, `total_expenses` — runway is computable and
  joins to `austender_contracts.supplier_abn`. The specific figures (773 of 5,898, median 0.9
  months) I did not re-run. [V shape / R figures]

### The one thing dressed as real that is not

**The flow matrix (graft G3) is over-claimed by 8.4×, and it is the load-bearing rebuttal to the
dissenting panel.** §1.2 defends the winner against `judge-build` with: *"up to 1,210 automatically
computed cells against 26 hand-written questions."*

Measured today [V]:

```
144 populated cells · 3,429,184 edges · 2,655,257 with amount · 91,257 ms
```

- **144 cells, not 1,210.** 1,210 is the theoretical product of the three axes; the graph is sparse.
  The generative argument survives (144 > 26) but at **5.5×, not 46×** — and an unknown fraction of
  the 144 are single-digit-edge junk.
- **91 seconds, not the relayed ~40 s.** The spec correctly says it must be a matview, so this is a
  nightly-window fact, not a page-load fact — but the number in the document is 2.3× low and marked
  `[R]`, and §8 admits the matview refresh cost was never measured. It has been now.

Neither breaks the design. Both should be corrected before an engineer plans around them.

---

## 4. WHAT ALL THREE DESIGNS MISSED — the shared blind spot

They were briefed from the same corpus, and the corpus itself had a hole: **`COMPLETENESS.md` §5a
says the 212 regular views were the single biggest omission of the whole map, and the synthesis
inherited that omission wholesale.**

Mention counts across `CLARITY-SPEC` / `design-atlas` / `design-instrument` / `design-interrogator`
[V, grepped all four]:

| Object | Mentions | What it actually is [V, queried today] |
|---|---|---|
| `alma_media_articles` | **0 / 0 / 0 / 0** | **881 rows, 253 distinct sources, 2012-10-08 → 2026-08-13 (yesterday).** 578 carry `sentiment_score` and `topics`; 268 carry `organizations_mentioned`; `government_mentions`, `intervention_mentions`, `key_claims`, `key_quotes`, `full_text`. 76 quarantined; **805 publishable through `alma_media_articles_publishable`, which is the consent gate on the entire media pillar.** |
| `v_data_health` | **0 / 0 / 0 / 0** | An already-built, already-drifting version of the exact estate-strip coverage band `/clarity` proposes — 12+ subselects, with a hardcoded `2473 AS sa2_regions_total`. Building the estate strip without reconciling it creates the fifth artefact. |
| `v_indigenous_youth_overrepresentation` | **0 / 0 / 0 / 0** | **50 rows**, `financial_year × indigenous_status × service_type × metric`, states as columns. The board's flagship **CANNOT ANSWER YET** card is drawn as `BLOCKED BY + abs_indigenous_population_by_lga 0 rows`. That understates what we hold: the honest render is *"we have this at STATE level, wide-format, 50 rows — LGA is what's missing"*, which is precisely what `honest_at` exists for. |
| `v_youth_justice_state_dashboard` | **0 / 0 / 0 / 0** | **288 rows** with `total_expenditure_m`, `cost_per_detention`, `recidivism_pct`, `completion_pct`, `indigenous_rate_ratio`, `facility_count`, `total_beds`. An outcomes layer nobody mapped. |
| `v_youth_justice_cost_comparison` (160) · `v_ndis_youth_justice_overlay` (181) · `v_ctg_youth_justice_progress` (64) · `v_qld_watchhouse_latest` | **0 across all four docs** | All populated, all directly on the vision. |
| `v_announced_money_by_kind` | **0 / 0 / 0 / 0** | **7 rows** — a regex classifier splitting `budget_total` / `detention_facility` / `service_line`. A *more sophisticated* version of the 45.3× fix the spec proposes. |
| Empathy Ledger / `yvnuayzslukamizrlhwb` | **0 / 0 / 0 / 0** | The second Supabase project. JusticeHub holds a service key and **writes** to it. `COMPLETENESS.md` §4 is titled *"accounted for in wave 1, LOST in synthesis."* It was lost again. |
| Storage buckets · non-`public` schemas · 219 triggers | **0 across all four** | 18 buckets, 4,283 objects; 8 schemas, 48 tables. "Absolutely every piece of data" was the literal ask. |

### On the six things the brief asked me to check specifically

- **The ~199K embeddings** — real. Measured today [V]: `gs_entities` 125,912 populated (22.5%),
  `grant_opportunities` **25,883 of 25,894 = 99.96%**, `knowledge_chunks` 19,413 (100%),
  `foundations` 10,775 (96.6%), `civic_intelligence_chunks` 7,022 (100%). ~195,600 total.
  The spec rejects embeddings in §7.14 on one measurement — 11.3 s ANN on `gs_entities`, a
  2,846 MB index over a 22%-populated column. **That rejection is correct for catalog relatedness
  and wrong as a blanket.** It generalises from the worst index in the database to the whole asset
  class, and never looks at the two small, fully-populated ones. `grant_opportunities` at 99.96%
  and `foundations` at 96.6% are a funder-matching asset, not a relatedness gimmick, and they are
  a different animal entirely.
- **The 212 views** — the biggest miss. Covered above.
- **The QLD watchhouse series** — this one they *did* use. 8,488 snapshot rows over 201 snapshots
  [V, census]; it is a board card and it correctly carries the n=2 rebaselining warning. Credit.
- **The money-flow Sankey** — cut in §1.5 for needing `d3-sankey`. Defensible for `/clarity`. But it
  is the one form that draws Ben's stated ask (*"the way everything moves in Australia"*), and it is
  now cut from `/clarity` and deferred out of BUILD-SPEC's slice 7+ with no owner. It is homeless.
- **Cross-repo JusticeHub** — see §5.
- **Media as a pillar** — the sharpest miss in the exercise. It is 881 live rows and it is used
  once, as an empty cell in the join matrix: *"Media mentions are arrays of names, not ids. No join
  exists to measure."* That sentence is true and it is the wrong conclusion. `organizations_mentioned`
  is a `text[]` on 268 articles; `gs_entities` has a trigram index on `upper(trim(canonical_name))`.
  A name-match seam is measurable, its match rate is exactly the kind of number this surface
  exists to print, and the result is the only genuinely *daily* thing in the whole design.

---

## 5. IS JUSTICEHUB REPRESENTED?

**Named, not represented. It drifted single-repo — in evidence, not in intent.**

What is there [V]: five mentions. `data-observatory` correctly marked COORDINATE BEFORE SLICE 0.
`surface.ts` correctly praised as the only artefact in either repo that has not rotted, and copied
as the CI-guard pattern. `clarity_code_ref` carries a `repo` column and S5's query groups by it.
`owner_app` survives in the ledger SELECT.

What is missing:

1. **No `OWNER APP` facet on the ledger rail.** BUILD-SPEC had one with four values including
   `neither`. CLARITY-SPEC keeps the column and drops the control [V, grepped: zero hits for
   `OWNER APP` in the spec]. You cannot ask "what does JusticeHub own", "what do both write", or
   "what does neither app touch".
2. **No dual-write detection.** BUILD-SPEC's dossier flagged `⚠ DUAL-WRITE` on
   `justice_funding` from JusticeHub's ALMA cron. Gone.
3. **Not one JusticeHub-sourced question on the board.** All 26 registered questions come from the
   GrantScope-side corpus. The proof this matters:

   | View / table | JusticeHub files | GrantScope files |
   |---|---|---|
   | `alma_media_articles` | **53** | 2 |
   | `v_indigenous_youth_overrepresentation` | 1 | **0** |
   | `justice_funding_clean` | 1 | **0** |

   [V, `grep -rl` over `JusticeHub/src` and `grantscope/apps/web/src` + `scripts`]

   The media pillar is a **JusticeHub-owned asset**. The contested `justice_funding` definition the
   spec surfaces on S5 lives in **JusticeHub**. A spec written entirely from the GrantScope tree
   could not see either — and §8 says so plainly: *"JusticeHub's working tree was not opened this
   session"* **[U, the spec's own admission].**
4. **Empathy Ledger: zero mentions, in all four documents.** The consent lineage that crosses a
   database boundary with no shared audit object is the single highest-risk seam in the estate, and
   it is not on the seams screen, the want list, or anywhere else.

---

## 6. ADDITIONS NEEDED TO CLEAR THE BAR

Ranked by what it costs if it is missing. Four of five are cheap.

### A1 — THE MEDIA CARD. The one addition that makes it daily. `~1 day`

Register **`WHO IS IN THE NEWS`** as a board question:

> *Which organisations in our graph were named in the news this week, what was the coverage, and
> does the money match the story?*

Ingredients that exist today [V]: `alma_media_articles` (881 rows · 253 sources · through
2026-08-13 · 578 with sentiment + topics · 268 with `organizations_mentioned`), gated through
`alma_media_articles_publishable` (805 rows, `quarantined_at IS NULL` — the consent gate is already
built and is exactly the caveat this surface is designed to print).

Add `clarity_edge`: `alma_media_articles.organizations_mentioned → gs_entities.canonical_name`,
mechanism `name_match`, and **print the measured match rate on the seams screen**. Whatever it is,
it is a real number about a real pillar Ben named, and "76 of 881 articles are quarantined" belongs
on the front strip.

This is the only screen element in the whole design that would be different on Tuesday than it was
on Monday. Everything else is an estate audit.

### A2 — INVENTORY THE 212 VIEWS **AS ANSWERS**, not just as rows. `~0.5 day`

The ledger already lists them (`LENSES 212`). That is not the fix. The fix is one pass over the 13
vision-pillar views before slice 2 seeds the registry, asking of each: *does this already answer a
registered question?* Named, with today's counts [V]:

`v_indigenous_youth_overrepresentation` 50 · `v_youth_justice_state_dashboard` 288 ·
`v_youth_justice_cost_comparison` 160 · `v_ndis_youth_justice_overlay` 181 ·
`v_ctg_youth_justice_progress` 64 · `v_qld_watchhouse_latest` 1 · `v_announced_money_by_kind` 7 ·
`alma_media_articles_publishable` 805 · plus `v_data_health`, `org_governance`,
`justice_funding_clean`, `v_entity_360`, `canonical_organizations`.

Two immediate consequences:
- **The OVER-REPRESENTATION card is mis-drawn.** It says *cannot answer, blocked on an empty table*.
  The honest render is `honest_at = 'state'`, 50 rows, wide-format, **and** the want for LGA. The
  spec's own machinery does this correctly; it just never looked.
- **`v_data_health` must be reconciled before the estate strip is built**, or `/clarity` becomes
  the second drifting coverage band in the same database. It carries a hardcoded
  `2473 AS sa2_regions_total` that cannot self-update — put it on the seams screen as a contested
  definition, exactly like `justice_funding_clean`.

### A3 — RESTORE THE CROSS-REPO DIMENSION. `~0.5 day`

- Put the **`OWNER APP` facet** back on the ledger rail: `civicgraph · justicehub · both · neither`.
  The data is already selected at line 727; only the control is missing.
- Restore **`⚠ DUAL-WRITE`** on the object page where both repos write.
- **Open JusticeHub's tree before slice 2 seeds the registry.** Three of the sharpest available
  questions live only there: media (53 files), the contested justice definition (1 file, 0 in
  GrantScope), Indigenous over-representation (1 file, 0 in GrantScope).
- Add **one line to the estate strip** naming Empathy Ledger: *"a second database
  (`yvnuayzslukamizrlhwb`) holds consented narrative; JusticeHub writes to it; not catalogued
  here."* A named absence is a want. An unnamed one is the map lying about its own edges.
- Add **one seam row**: the Empathy Ledger bridge columns (`organizations.empathy_ledger_org_id`,
  `public_profiles.empathy_ledger_profile_id`, `partner_stories.empathy_ledger_story_id`) with
  their measured fill. **Nobody has ever measured them** [R, `COMPLETENESS.md` §4]. A consent
  bridge at 0% fill would be the most expensive broken seam in the estate, and the seams screen is
  the one place in either repo designed to say so.

### A4 — CORRECT THE FLOW MATRIX, AND SAY WHAT IT COST. `~0 days, edit only`

Replace "up to 1,210 automatically computed cells" with the measured figure: **144 populated cells,
measured 2026-08-14, 91.3 s over 3,429,184 edges** [V]. Keep the graft — 144 > 26 and the argument
holds — but the rebuttal to `judge-build` is a 5.5× multiple, not 46×, and the nightly refresh
budget is 91 s, not 40. Sparse cells should render `·`, not be silently absent, or the matrix
quietly becomes an 11×11 grid that is mostly empty and nobody says why.

### A5 — PROMOTE THE TEN-DAY GUARD, AND NARROW THE EMBEDDING REJECTION. `~0 days, edit only`

- Move *"if slice 2 has not shipped within 10 working days of slice 1, the direction has failed"*
  out of §6 and into §1 as a stated gate. It is the entire difference between "way way better" and
  "a competent data catalog", and right now it is a subclause.
- Narrow §7.14. It currently reads as *no embeddings, ever*, justified by one measurement on the
  worst index in the database (`gs_entities`, 22.5% populated, 2,846 MB). Restate it as: *"not for
  catalog relatedness — relatedness is structural."* Then register the honest want: **25,883
  embedded `grant_opportunities` (99.96%) and 10,775 embedded `foundations` (96.6%)** are a
  funder-matching asset with a different cost profile, and `FEEDS 0` will otherwise flag them as
  dark data forever without anyone asking why.

---

## 7. WHAT I CHECKED, AND WHAT I DID NOT

**Verified by me this session, by query or grep [V].** The evidence-gap flagship reproduced end to
end (778 / 663 / 85.2% / $1,142.1m / $670.9m, ~1 s). The flow-matrix aggregate: 144 cells,
3,429,184 edges, 2,655,257 with amount, 91,257 ms. `political_donations`: 653,261 of 2,549,483 with
`donor_abn` (25.62%), 2.6 s. Existence and row counts of the 13 vision-pillar views. The
`alma_media_articles` profile (881 / 76 quarantined / 268 org-mentions / 578 sentiment / 253
sources / 2012-10-08 → 2026-08-13) and the `alma_media_articles_publishable` definition. Embedding
population estimates from `pg_stats.null_frac` across 19 columns. `acnc_ais` financial columns.
Cross-repo `grep -rl` counts for seven objects across both `src` trees. Mention counts for every
term in §4 across all four documents. The absence of `OWNER APP`, `co-occurrence`, `missingno`,
`sample tab`, `v_data_health` and `Empathy Ledger` from CLARITY-SPEC. Full text of both specs.

**Relayed, carrying its original marker [R].** Every figure the spec cites from `VERIFICATION.md`
and the three designs: the 45.3× topic inflation, the 85.3% `other receipt` share, the $123.00bn
Hays row, `grants_total` zero across 94,088 rows, the 0-of-49,426 dead key namespace, the 3.16
rows-per-key grain defect, the 605,135-edge category nodes, the panel scores, the 4.5-minute sweep
budget, the 279 ms / 196 ms / 3,076 ms question timings.

**Inferred [I].** That 144 sparse cells contain an unknown fraction of junk — I did not enumerate
them. That the media name-match seam is measurable at a useful rate — I did not measure it. That
restoring the `OWNER APP` facet is half a day.

**Not checked by anyone [U].** No migration applied. `clarity_refresh()` never executed. **Nothing
in the spec has ever rendered.** The bidder-fragility figures (773 / 5,898 / 0.9 months) not
re-run. The Empathy Ledger project itself never queried by anybody in this exercise — no
credentials in this repo. Whether the parallel session's five migrations apply cleanly in the
stated order.
