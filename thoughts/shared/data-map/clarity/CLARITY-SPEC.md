# THE /clarity SPEC

**The single buildable document.** Synthesised 2026-08-14 from three judged designs
(`design-interrogator.md`, `design-atlas.md`, `design-instrument.md`), three independent panels
(`judge-ben.md`, `judge-build.md`, `judge-insight.md`), the measured data layer
(`clarity-data-layer.md`), the exclusion decision (`act-extraction-plan.md`), and the surface
survey (`existing-surfaces.md`).

Target: `/Users/benknight/Code/grantscope`, app at `apps/web`.
Binding: `DESIGN.md` (Civic Bauhaus, `.ws` workspace variant), `CLAUDE.md` (Server Components by
default, in-app not CLI, bulk SQL not API loops), `getDirectServiceSupabase()` not
`getServiceSupabase()`.

**Verification key.** **[V]** I ran the query or read the file myself in this session ·
**[R]** relayed from a document in this exercise that marks it verified · **[I]** my inference ·
**[U]** not checked by anyone.

**Verified by me this session, and load-bearing for what follows:**
`apps/web/src/app/clarity` does not exist [V]. `clarity_object`, `catalog_object_scope` and
`mv_refresh_registry` do **not** exist in the database; `data_catalog`, `data_catalog_snapshots`
and `mv_refresh_log` do [V, `to_regclass`]. `data_catalog_snapshots` holds **1,419 rows over 25
tables from 2026-04-09 to 2026-08-13**, with columns `snapshot_at, table_name, row_count,
freshness_hours, provenance_coverage_pct, confidence_coverage_pct, notes` [V]. `mv_refresh_log`
holds 2,260 rows over **44 distinct matviews**, last finish 2026-08-13 17:30 UTC [V].
`/api/data/schema-graph/route.ts` is 280 lines with **zero consumers** anywhere in `apps/web/src`
or `scripts/`, filters `WHERE ... n_live_tup > 0` at **line 109** and drops unclassified tables
with `if (!domain) continue;` at **line 151** [V]. Installed viz libraries in `apps/web`:
`recharts ^3.7.0`, `react-force-graph-2d ^1.29.1`, `react-force-graph-3d ^1.29.1`,
`leaflet ^1.9.4`, `react-leaflet ^5.0.0` — **no d3, no @tanstack/react-virtual, no topojson** [V].
`requireAdminPage(pathname, fallback='/home')` exists at `apps/web/src/lib/admin-auth.ts:40`; the
whole of `apps/web/src/app/ops/layout.tsx` is seven lines that call it [V]. The `.ws` workspace
theme begins at `apps/web/src/app/globals.css:116` [V]. The three drafted `clarity_*` migrations
exist unapplied at `supabase/migrations/202608150000{00,100,200}_*.sql`, and the parallel
session's five migrations exist unapplied at `migrations/2026-08-14-*.sql` [V].

I read the full DDL of `20260815000000_clarity_catalog_schema.sql` [V]. Every column name in
every query in this document was checked against it. The traps: `clarity_column.null_pct` (not
`fill_rate`), `clarity_column.distinct_est` (not `distinct_count`), **there is no `fk_target`
column**, `clarity_object_history.snapshot_at` (not `captured_at`), `clarity_object` has **no
`scope` column** (only `act_business` + `act_business_source`), and `has_purpose / has_owner /
has_join / has_use / is_fresh / exposure_conflict / pii_level` live on **`v_clarity_ledger`**,
not on `clarity_object`.

---

## 1. THE DECISION AND ITS ARGUMENT

### 1.1 The winner

**THE INTERROGATOR — question-first — is the direction.** `/clarity` opens as a board of
everything this database can answer, nearly answer, and cannot yet answer. The full 1,433-object
ledger is built in full and ships **first**, one click from the board, and gains two columns no
inventory-first design can have: **FEEDS** (how many registered questions this object serves) and
**BLOCKS** (how many its defect prevents).

Panel scores:

| Panel | Lens | 1st | 2nd | 3rd |
|---|---|---|---|---|
| `judge-ben` | would he use it daily, does any screen dead-end | **Interrogator 8** | Instrument 7 | Atlas 6 |
| `judge-build` | could an engineer build it, and is it honest | Atlas 9 | **Interrogator 8** | Instrument 7 |
| `judge-insight` | does it deliver the vision | **Interrogator 8** | Atlas 6 | Instrument 5 |
| | **aggregate** | **Interrogator 24** | Atlas 21 | Instrument 19 |

Two of three panels rank it first. The third ranks it second by one point.

### 1.2 Resolving the disagreement, because one panel dissented

`judge-build` picked the Atlas. Its case is three specific facts, and none of them is an argument
about direction:

1. **"Its flagship query compiles verbatim; the Interrogator's migration will not apply."** The
   defect is real and precise: `PRIMARY KEY (question_slug, object_key, coalesce(join_key,''))`
   is not legal PostgreSQL — table constraints take a column list, expressions are permitted only
   in `CREATE UNIQUE INDEX` [R, marked `[G]` grammar-certain, not executed]. **Fixed in §4.3** as
   `join_key text NOT NULL DEFAULT ''` plus a plain PK. One line.
2. **"Zero curation debt vs 23 unwritten SQL statements."** Real, and named by the Interrogator
   itself as the strongest argument against it. **Fixed twice over:** slice 1 is the fully-derived
   ledger, so the surface is never a wall of empty cards; and the Atlas's flow matrix is grafted
   as slice 4, which makes cross-sections **generative** — up to 1,210 automatically computed
   cells against 26 hand-written questions.
3. **"Its node caps are measured, not asserted."** True, and the measurements are transplanted
   wholesale (§5).

The panel also argued the transplant direction is one-way: *"a question registry hangs off a
catalog naturally; you cannot graft a six-level spatial frame onto a card board."* That is correct
about the **frame** and irrelevant to the **catalog**. Both designs read the same `clarity_object`
/ `v_clarity_ledger` data layer; the catalog is common ground, already drafted, and this spec
carries it unchanged. What is genuinely one-way is the Atlas's L0–L5 persistent spatial shell,
and we are deliberately not building it — `judge-ben` scored it worst on felt experience (29% of
a 1440px screen spent on chrome, `L0`–`L5` and `/d/ /o/ /x/ /e/ /r/` as a public vocabulary, and
a front door of 1,433 unlabelled grey tiles), and the Atlas's own §21.5 says *"a design that needs
its two most distinctive elements collapsed to read comfortably has a real problem."*

So: **the panels agree on the data layer and disagree only on the front door.** Both panels that
judged the front door on its own terms chose questions. The dissenting panel judged the whole
document including a migration typo, and every objection it raised has a named one-line fix.

### 1.3 Why question-first is right for this database, in one paragraph

Nothing here is valuable table by table. ACNC publishes `acnc_charities`; AusTender publishes
`austender_contracts`; the ABS publishes SEIFA. The only thing that exists nowhere else is the
**join** — `acnc_ais × austender_contracts` answers *can this bidder survive the contract*, which
no Australian source can answer, and which was run in **196 ms** [R] and independently reproduced
by a second agent [R]. Every headline this project has got wrong was wrong at the **claim** level,
not the table level: the youth-justice topic total inflated **45.3×** by `measure_kind` mixing;
**85.3% of political-donation dollars** are `other receipt`, not donations; 13 AusTender rows carry
**29.4%** of all recorded Commonwealth contract value, the largest being **Hays Specialist
Recruitment at $123.00bn to Treasury**; `mv_entity_total_funding.grants_total` is **exactly zero
across all 94,088 rows** [all R, VERIFICATION.md V17/V21/V22/V23/V30]. A table ledger can carry
`row_count` and `last_write_at` for every one of those and be entirely truthful while the derived
claim is catastrophically false. Attaching provenance to the claim is the only place it does any
work.

### 1.4 What is grafted, and from where

Twenty grafts. Ordered by what it costs if it is missing. Every one is traceable to a named panel
recommendation.

**Structural — the winner is incomplete without these**

| # | Graft | From | Why | Where it lands |
|---|---|---|---|---|
| G1 | **The persistent left rail owns every filter.** Kill the header chip row. Filters live in the URL and are carried across board → answer → rows → ledger → seams → wants; a filter that cannot apply at the current screen is shown **carried-but-inactive**, never silently dropped | Atlas §4②, §15.2 | `judge-ben` T1: the winner's single named rage-trigger, against the recorded taste rule *"filter chips that read as tabs"*. An afternoon of work | `clarity/layout.tsx` |
| G2 | **WHAT CHANGED — `clarity_event` + `clarity_delta` + the anomaly rule.** `\|Δ\|/prev > 10%`, a zero crossing, `missing_since` set, or a state change writes a `severity='critical'` event that stays **NO REASON RECORDED**, in red, until a human writes one | Instrument §8.3, §10.3 | All three panels. `justice_funding` went 218,022 → 157,116, minus 28%, and nothing fired [R]. Extended per `judge-insight` I1 to fire on **`clarity_answer.headline` moving >10% with no ingredient row-count change** — semantic drift, the exact failure the winner fears | `/clarity/changes`, slice 3 |
| G3 | **The flow matrix + `mv_clarity_flow`.** 11 entity types × 11 × 10 relationship types, ≤1,210 cells, one nightly matview | Atlas §10.3 | `judge-insight` A1, *the essential transplant*: it cures the winner's only structural ceiling. A curated registry surfaces the opportunities Ben already wrote down; a matrix surfaces ones nobody wrote down. Cardinality verified independently by two agents [R] | `/clarity/cross`, slice 4 |
| G4 | **SEAMS as a ranked table**, sorted by `rows_at_stake × (1 − match_rate)` — by how much data the connection is losing right now. Graph behind a RENDER button | Instrument §7 | All three panels. The four defects that matter are the top four rows and are invisible in a force-directed graph | `/clarity/seams`, slice 5 |
| G5 | **The ledger moves to slice 1**, ahead of the question board | `judge-ben` structural amendment | Ben literally asked for the list. It is also 100% derived, so it cannot be half-done | slice 1 |
| G6 | **A HOUSE subject** — the 23 gap metrics registered as questions about ourselves, with targets | `judge-ben` structural amendment | Ben's decision 2 (reconcile the matview registries) is operational work with no home on a question board or a want list. As a HOUSE card, *"71 of 98 matviews are in no refresh registry"* becomes a contested card with an adjudication CTA | slice 6 |

**High-value — each removes a specific dead-end or a specific lie**

| # | Graft | From | Why |
|---|---|---|---|
| G7 | **Global baseline selector** `LAST · 7d · 30d · 90d`, one searchParam, applies to every delta on every screen at once; unavailable options greyed **with their reason** (`30d — history begins 15 AUG, 3 nights`) and deltas render `?`, never `0` | Instrument §4, §9.4 | `judge-ben` T3, `judge-insight` I2 |
| G8 | **The burn-down clause** — `1,365 do not feed a question · +0/wk · never` | Instrument §1.6 | All three panels. The cheapest upgrade on the list; it converts inert numbers into decisions |
| G9 | **The four-glyph absence alphabet** — `+` never measured (blue, ours) · `?` unmeasurable (yellow) · `×` measured and zero (red, the data's) · `·` not applicable · `▚` out of scope | Atlas §5 + Instrument §3 | `judge-build` #6, `judge-insight` A3+I6. Three states, not one `┼` |
| G10 | **`glyph-coverage.test.ts`** — the build fails if any cell renderer has a code path returning empty | Instrument §2 | `judge-build` #5. Two hours, permanent |
| G11 | **The cold-start backfill** — seed `clarity_object_history` from `data_catalog_snapshots` (**1,419 rows, 25 tables, 2026-04-09 → 2026-08-13** [V]) and insert the three known 2026-04-02 row-moves into `clarity_event` with `reason IS NULL` | Instrument §9.4 | `judge-build` #3, `judge-insight` I5 (a slice-1 prerequisite). Four months of real history for the spine on night one |
| G12 | **The category-node sentinel** — `entity_type='program' AND degree > 10,000` fires a permanent block, plus a duplicate-canonical-name probe | Atlas §2.2, §11.5 | `judge-ben` T6, `judge-insight` A2. Two entities hold **605,135 edges = 17.6% of the whole graph** and are AusTender procurement categories, not organisations. It poisons the power-holder leverage map, which is live. `judge-insight` also found **`Department of Defence` appears twice in `gs_entities`** [R], which no design caught |
| G13 | **The Isolate panel + system-coverage strip** — for the 209,172 entities (34.3%) with no edge, name each system and state what it holds | Atlas §11.3, §11.1 | `judge-ben` T8, `judge-insight` A4. A ban on "has no evidence" needs a designed replacement, and this is it |
| G14 | **Null-reason breakdowns** — nulls by reason code, never as one number; unregistered columns get `+` and *"nulls here are not reason-coded, we cannot tell you why"* | Atlas §9 | `judge-ben` T7. Generalises the LGA-attribution discipline this repo already earned |
| G15 | **Contextual want rendering** — a want appears on every object and every question it blocks, as well as on `/clarity/wants`. *"A separate gaps page is a page nobody opens"* | Atlas §12 | `judge-ben` T9 |
| G16 | **Show-the-SQL on every number, everywhere** — not only on the question page | Instrument §8.1 | `judge-ben` T10. A metric whose SQL silently stopped meaning what its label says can only be found if the SQL sits next to the number |
| G17 | **Refusals with an escape hatch** — `[ draw it anyway (will render ~200 of 270,864) ]`. Refusing without an override is paternalistic | Atlas §11.4 | `judge-ben` T13 |
| G18 | **Server-computed frozen graph layout** — positions written by the nightly sweep, zero simulation ticks on load, movers marked for one day | Atlas §15.3 | `judge-ben` T14 |
| G19 | **Three freshness badges** — FRESH / STALE / **UNMONITORED**. 54 matviews have never appeared in `mv_refresh_log` [R; I verified 44 of 98 are logged, V]. Rendering them "stale" is a guess | Interrogator §7, `judge-build` #14 |
| G20 | **Verbs in the ask bar** — a fourth namespace beside questions, objects and columns (`extract all objects matching "justice" as a SQL IN-list`) | Instrument §4 | `judge-ben` T12. An action menu that costs no screen space |

**What the winner already owns and a grafted build must not lose:** the `stub`/`question`
typographic split enforced by schema plus a lint; `[COPY THE CLAIM]`; the **sample-size track**
under every time series; `FEEDS`/`BLOCKS`; the `refused` form with its own route; the
`ANSWERS n / BLOCKS n` band on the object page; `clarity_one_binding`; `UNVERIFIED` and `PILOT`
as registry fields; the want-list ranking formula; `live_rerun_ok` derived from measured duration.

### 1.5 What is deliberately rejected

| Rejected | From | Why |
|---|---|---|
| **The six-level L0–L5 spatial shell** with minimap and permanent gap gutter | Atlas | 29% of a 1440px screen spent on chrome at every level, by its own §21.5; database vocabulary worn on the outside; and a ladder whose bottom rung is 0.0%. Keep the rail, drop the ladder |
| **The equal-area mosaic of 1,433 tiles as the front door** | Atlas | Elegant reasoning (seven orders of magnitude in row count rules out a treemap), wrong first screen. `judge-ben`: *"this is the 'I can't find anything' screen"* |
| **L5 record-level provenance drill** (`/clarity/r/[object]/[pk]`) | Atlas | The flagship path — edge → grant — is **0 of 49,426 = 0.0%**, a dead key namespace [R]. Do not build a ladder to a missing rung. It is named, priced and refused instead (§3.2, §3.7) |
| **Six invented board nouns** BOARD / LEDGER / SEAMS / DEFECTS / BENCH / TAPE | Instrument | Against *"plain words, no internal vocabulary"*. SEAMS survives because it is plain. TAPE becomes **WHAT CHANGED**; DEFECTS becomes the **HOUSE** subject; BENCH is replaced by the question board itself |
| **Eleven glyphs** | Instrument | Four absence states plus present plus n/a. Movement is carried by the delta column, severity by colour |
| **A flat 14,310-row column list** | Instrument §6.1 | It is the only thing in any design that needs virtualisation. Columns are shown per object (≤60) and searched through `/api/clarity/search`. **This is what keeps the dependency count at zero** |
| `d3-sankey`, `topojson-client`, `@tanstack/react-virtual`, `nuqs`, `maplibre-gl`, `deck.gl`, `cosmograph`, `cytoscape` | all three | None is installed [V]. None is needed by anything in this spec |
| **The `hexmap` and `sankey` question forms** | Interrogator §6.3 | Both need an uninstalled dependency for a payoff that belongs on `/atlas` or in a report. Cut from v1 entirely rather than parked as a slice 6 that quietly never ships |
| **An ego network inside `/clarity`** | Atlas §11 | `/graph` already has nine modes of it and `/entity/[gsId]` has a network tab. A seventh network view belongs in nobody's roadmap. `/clarity` hands off |
| **Any map** | all | `/atlas` owns place, with a nine-layer registry that is the best-engineered surface in either repo [R] |
| **A public surface** | — | `/clarity` was killed on 2026-04-24 for being a *"SaaS-shaped surface"* [R]. Admin-gated honours that decision rather than reversing it |

---

## 2. INFORMATION ARCHITECTURE, ROUTES, GATING

### 2.1 Routes

```
apps/web/src/app/clarity/
├── layout.tsx                    requireAdminPage('/clarity') · .ws theme · ESTATE STRIP · RAIL
├── page.tsx                      S1  THE BOARD              every question, its state, its number
├── board-grid.tsx                    "use client" — filter/sort island over ~26 server-rendered cards
├── q/[slug]/page.tsx             S2  THE WORKED ANSWER      one claim with its provenance
├── q/[slug]/rows/page.tsx        S3  THE ROWS               the organisations behind the number
├── q/[slug]/forms/               scalar · ranked_bar · stacked_three · matrix · timeseries · refused
├── data/page.tsx                 S4  THE LEDGER             all 1,433 objects
├── data/ledger.tsx                   "use client" — the one in-memory filter island
├── data/[object]/page.tsx        S5  THE OBJECT             one object, everything known about it
├── seams/page.tsx                S6  THE SEAMS              every join, ranked by what it is losing
├── seams/seam-graph.tsx              "use client" — dynamic(react-force-graph-2d, {ssr:false}) HERE
├── cross/page.tsx                S7  THE CROSS-SECTIONS     flow matrix + join matrix
├── changes/page.tsx              S8  WHAT CHANGED           the estate's derivative
├── wants/page.tsx                S9  THE WANT LIST          every gap with a price and a payoff
├── loading.tsx  error.tsx  not-found.tsx

apps/web/src/app/api/clarity/
├── search/route.ts               column-level search across 14,310 columns (too many to ship)
├── question/[slug]/rerun/route.ts  admin re-run; refuses when live_rerun_ok = false
├── verdict/route.ts              keep | suspect | cruft + mandatory reason
├── reason/route.ts               write the reason on an unexplained change event
├── rescore/route.ts              SELECT clarity_score() — sub-second, safely inside the 8s ceiling
└── graph/route.ts                {nodes, edges} for the seam graph, from clarity_object/_edge

apps/web/src/lib/clarity/
├── types.ts        Question · Ingredient · Answer · Sentinel · ClarityObject · Seam · Want
├── glyphs.ts       the alphabet, one source of truth            (+ glyph-coverage.test.ts)
├── phrasing.ts     FORBIDDEN + PERMITTED                        (+ phrasing.test.ts)
├── questions.ts    getBoard() getQuestion() getRows()           (+ questions.test.ts)
├── inventory.ts    getLedger() getObject() getSeams() getChanges()
├── forms.ts        the five form kinds, which are client, which refuse
├── params.ts       useClarityParams() — URL state, no new dependency
└── reach.ts        the board ranking
```

**Naming.** Every route segment is a plain English word. No `L0`–`L5`, no `/d/ /o/ /x/ /e/ /r/`.

### 2.2 Admin gating — decided

`apps/web/src/app/clarity/layout.tsx` calls `await requireAdminPage('/clarity')`, exactly the
`apps/web/src/app/ops/layout.tsx` pattern — seven lines, verified [V]. Not added to
`components/nav.tsx` (the 42-link public nav). An admin strip entry beside `/ops` and
`/mission-control` only.

Two reasons, both recorded rather than invented. `/clarity` was deleted on 2026-04-24 in commit
`bd20a8c` *"kill SaaS-shaped surfaces"* [R] — an admin instrument honours that decision instead of
quietly reversing it. And the surface renders `refs_*`, `anon_readable`, `security_definer`,
`pii_level` and human verdicts; the public data-commons face of the same rows is already
`/giving/sources` and `/giving/quality`, and stays there.

The `.ws` workspace theme (globals.css:116 [V]) carries the whole surface: borders 4px → 1px,
hard shadow → subtle drop shadow, Satoshi 700 not 900, reduced tracking. `DESIGN.md` defines it
for exactly this case. **One exception:** the question cards on the board keep the full
`border-4` + `8px 8px 0 0` hard shadow, because they are the one thing on the surface that is a
*claim* rather than a control, and a claim should look like an object. That is the one judgement
call worth Ben's eye before slice 2 is written.

### 2.3 Every existing surface, stated

| Surface | Verdict | What happens |
|---|---|---|
| **`/api/data/schema-graph`** (280 lines, **zero consumers** [V]) | **RETIRE** | See §2.4 |
| `/mission-control` — 33 hardcoded tables, admin-gated | **LEAVE ALONE in v1; SUPERSEDED** | Its Data Inventory section is a 4% subset of `/clarity/data`. Slice 6 *optionally* replaces its hardcoded `TABLES` array with a read of `v_clarity_ledger`; the agent-runs and SQL-console halves stay. Do not touch it in slices 1–5 |
| `/ops/health` + `/ops/health/[dataset]` — 20 curated datasets | **LEAVE ALONE; link to it** | Different job: browsing actual rows with prose. `/clarity/data/[object]` deep-links to it. Its hand-authored `connections` array is superseded by `clarity_edge` — flag it in the object page, do not rewrite it |
| `/atlas` + `src/lib/atlas/layers.ts` | **LEAVE ALONE; hand off to it** | `/clarity` renders no maps. Every place-shaped question carries an `open in /atlas` action. `layers.ts`'s mandatory-caveat type discipline is the model `questions.ts` copies |
| `/graph` — 9 entity-graph modes | **LEAVE ALONE; hand off to it** | The entity network is its job. `/clarity` links out, never duplicates |
| `/giving/sources`, `/giving/quality`, `giving-commons.PUBLIC_DATASETS` | **LEAVE ALONE; improved for free** | The public face of `data_catalog`. `clarity_refresh()` becomes the single writer of `data_catalog_snapshots`, so `/giving/quality` gets fresher without a code change |
| `data_catalog` + `data_catalog_snapshots` + `snapshot_data_catalog()` | **EXTEND, do not replace** | 25 rows with the right 21 governance columns, and 1,419 rows of real history [V]. `v_clarity_ledger` LEFT JOINs it; the object page edits it in place. **Do not build a third governance table** |
| `/insights`, `/dashboard`, `/power`, `/places`, `/entities`, `/rankings`, `/discover` | **LEAVE ALONE** | Product surfaces. `/clarity` is a mirror, never a replacement |
| `/architecture` | **LEAVE ALONE; do not link** | Content provably false (three listed public pages do not exist), status is a frozen snapshot, not in nav [R]. Its cull is a separate decision, out of scope here |
| `data/schema-cache.md`, `COMPENDIUM.md`, `thoughts/.../db-inventory.md` | **SUPERSEDE** | Add one header line pointing at `/clarity`. Do not rewrite. Archive per the move-not-delete rule when Ben says so |
| JusticeHub `/admin/data-observatory` + `src/lib/data-observatory/` (uncommitted) | **COORDINATE BEFORE SLICE 0** | It catalogs **pipelines and sources**; `/clarity` catalogs **the database**. Explicitly non-overlapping. Another session was mid-flight on it as of 2026-08-14 [R] |
| JusticeHub `src/config/surface.ts` + `surface-coverage.test.ts` | **COPY THE PATTERN** | The only artefact in either repo that demonstrably has not rotted [R]. Its CI-guard discipline is what `glyph-coverage.test.ts` and `phrasing.test.ts` are |

### 2.4 The orphaned `/api/data/schema-graph` — retire, do not fix

**Verdict: RETIRE in slice 5, replaced by `/api/clarity/graph`.**

What I verified [V]: 280 lines, zero consumers anywhere in `apps/web/src` or `scripts/`. Its own
header comment still reads *"Powers the interactive Obsidian-style schema visualization on
/clarity."* It has two defects:

- **Line 109** — `WHERE schemaname = 'public' AND n_live_tup > 0`. `pg_stat_user_tables.n_live_tup`
  is broken on this instance: it reports **0** for `political_donations`, which holds **2,549,483**
  rows, and **0** for `data_catalog`, which holds 25 [R, sampled five tables]. So the route
  silently drops the second-largest table in the database.
- **Line 151** — `if (!domain) continue;` against a 70-entry `TABLE_DOMAIN` literal. It renders
  ~70 of 812 objects and gives no signal that the other 742 exist.

**Why not fix it in place.** The fix for line 109 is "get row counts from somewhere that is not
`n_live_tup`", and the fix for line 151 is "get domains from somewhere that is not a hardcoded
literal". Both of those places are `clarity_object`. Repairing the route means building a second,
competing catalog inside an API route — the fragmentation failure this whole exercise exists to
end.

**Mechanics.** Slice 1 adds a three-line header comment marking it superseded and naming its
successor (Tier 1, just do it). Slice 5 ships `/api/clarity/graph`, reading `clarity_object` +
`clarity_edge` with no `n_live_tup` and no hardcoded domain map. Deleting the route file is a
`git rm` of a tracked file — **Tier 3, requires Ben's explicit verb**. Until he says it, the file
stays with its superseded header. Nothing reads it, so nothing breaks either way.

### 2.5 URL state

Plain Next 15 `searchParams` on the server plus `router.replace(url, {scroll:false})` in the one
client island per screen. `nuqs` is the better tool and is **not installed**; a ~60-line
`useClarityParams()` hook is cheaper than a dependency at this param count.

```
global (carried across every screen)   ?base=30d          &scope=civic|all
S1 board                               ?subject=justice   &state=contested &sort=reach &q=
S2 answer                              ?topic=youth-justice &measure_kind=grant
S3 rows                                ?linked=false      &sort=amount     &page=2
S4 ledger      ?kind=table &domain=D8 &gap=no_purpose &sort=feeds &dir=asc &q= &o=justice_funding
S6 seams                               ?mech=fk           &state=broken    &min=1000
S7 cross                               ?m=flow &rel=contract &measure=edges &scale=log
S8 changes                             ?type=row_moved    &sev=critical    &window=90d &obj=
S9 wants                               ?effort=S
```

Rules. Every param is read server-side, so a pasted URL renders correctly on first paint with no
hydration flash. `base` and `scope` are global and survive every screen change. A param that
cannot apply on the current screen is **kept in the URL and shown greyed in the rail**, never
dropped (G1).

### 2.6 The alphabet, and the phrasing guard

Six states. Rendered in JetBrains Mono at a fixed pitch, so a column of `+` reads as a solid blue
stripe from two metres.

| Glyph | Colour | Means | Never means |
|---|---|---|---|
| `█` | black `#121212` | measured, present | — |
| `+` | blue `#1040C0` | **never measured / not recorded.** Ours to fix. Clickable: it is the affordance | the data is bad |
| `?` | yellow `#F0C020` | **unmeasurable** — probe timed out, no candidate column, history shorter than the baseline | zero |
| `×` | red `#D02020` | **measured, and the answer is zero or broken.** The data's failure | not yet checked |
| `·` | muted `#777777` | not applicable to this kind of object | zero |
| `▚` | muted hatch | out of scope, present, deliberately not shown here | hidden |

Three hard rules. **`+`, `?` and `×` never collapse** — "we have not checked", "we could not
tell" and "we checked and it is zero" have different owners and different fixes. **Red is the
data, blue is us** — spending `#D02020` on "no description written yet" is what makes a catalog
read as an accusation nobody acts on. **No green as a state** — `DESIGN.md`'s `#059669` stays
confined to positive financial values; red/green is the classic deuteranopia failure and on this
surface every cell is a state cell.

`glyph-coverage.test.ts` fails the build if any cell renderer has a code path that can return an
empty string (G10).

`phrasing.ts` exports the forbidden patterns with their replacement **and the reason**, and
`phrasing.test.ts` walks `app/clarity/**/*.tsx` plus every seeded `caveat`, `claim_phrasing` and
`stub`, and fails the build on a match:

| Never render | Always render |
|---|---|
| "has no evidence" | "no evidence record linked in ALMA · 1,277 of 2,136 interventions carry one" |
| "receives no funding" / "unfunded" | "no funding recorded in this database · the rollup reaches 15.4% of the spine" |
| "$0" for an unplaced area | "not visible in this data · remote NT/WA/SA communities are funded through regional and land councils whose registered address credits the hub" |
| "no directors" / "no board" | "no `person_roles` rows carry this entity id · board data exists for 64,139 of ~368,606 non-person entities" |
| "unused" | "no reference found in app code, scripts, database functions, triggers or view lineage" |
| "0" for a failed probe | `?` plus the recorded probe reason |
| an empty cell | one of the six glyphs above |

---

## 3. SCREEN BY SCREEN

Every panel below names the object it reads. Objects marked **(deliverable)** are specified in §4
and do not exist yet [V]; everything else exists today.

### 3.1 S1 · THE BOARD — `/clarity`

**Purpose.** The daily visit. What this database can say about Australia, what it nearly can, and
what it cannot.
**The question only this screen answers:** *"What can we say today that nobody else can, what is
one fix away, and what is currently lying?"*

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CLARITY                                                              ADMIN · WORKSPACE           │
│ 1,433 OBJECTS · 52,349,579 ROWS · 28 GB · 714 TABLE · 98 MATVIEW · 212 VIEW · 409 ROUTINE        │
│ 68 FEED A QUESTION · 1,365 DO NOT · +0/wk · never          SWEPT 03:14 (4m38s)  [ THE LEDGER → ] │
│ 28 OF 98 MATVIEWS CURRENT · 3 OBJECTS MOVED >10% · 1 WITH NO REASON RECORDED  [ WHAT CHANGED → ] │
│ 238 ACT PRIVATE-BUSINESS OBJECTS EXCLUDED ▚  ▸ scope register           BASELINE  ◀ 30 DAYS ▶    │
├────────────┬─────────────────────────────────────────────────────────────────────────────────────┤
│ RAIL       │ ⌕  Ask the database…                                                                │
│            │ 26 QUESTIONS · 14 ANSWERED · 5 CONTESTED · 7 CANNOT ANSWER YET · 3 MOVED SINCE 14 AUG│
│ SUBJECT    │                                                                                     │
│ ▢ justice 8│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━━━━━━━━━━━┓│
│ ▢ money   6│ ┃▌JUSTICE · EVIDENCE  ENTITY┃ ┃▌JUSTICE      FACILITY   ┃ ┃▌CHARITY        ENTITY  ┃│
│ ▢ charity 5│ ┃▌                          ┃ ┃▌                        ┃ ┃▌                       ┃│
│ ▢ power   4│ ┃▌THE EVIDENCE GAP          ┃ ┃▌WATCHHOUSE CHILDREN     ┃ ┃▌BIDDER FRAGILITY       ┃│
│ ▢ place   4│ ┃▌How much youth-justice    ┃ ┃▌How many children are   ┃ ┃▌Can the charity        ┃│
│ ▢ house  23│ ┃▌grant money goes to orgs  ┃ ┃▌held in QLD police      ┃ ┃▌delivering this        ┃│
│            │ ┃▌with no evidence record   ┃ ┃▌watchhouses, where, for ┃ ┃▌government service     ┃│
│ STATE      │ ┃▌linked?                   ┃ ┃▌how long, and is that   ┃ ┃▌survive the contract?  ┃│
│ ▢ answered │ ┃▌                          ┃ ┃▌changing?               ┃ ┃▌                       ┃│
│ ▢ contested│ ┃▌  85.1%          · 0.0pp  ┃ ┃▌  2.7×        ▲ +0.3    ┃ ┃▌  773        ▲ +11     ┃│
│ ▢ cannot   │ ┃▌  662 of 778 organisations┃ ┃▌  14.2 → 38.8 per snap  ┃ ┃▌  fragile of 5,898     ┃│
│ ▢ refused  │ ┃▌  $663.9m of $1,142.1m    ┃ ┃▌  May → Aug 2026        ┃ ┃▌  median 0.9 months    ┃│
│            │ ┃▌ ▁▂▃▅▆█                   ┃ ┃▌ ▁▂▄▆█                  ┃ ┃▌ ▃▃▃▄▄▄                ┃│
│ SORT       │ ┃▌ ████████████████████▒▒   ┃ ┃▌ ██████████████████████ ┃ ┃▌ ███████████████▒▒     ┃│
│ ● reach    │ ┃▌ 93.65% binding           ┃ ┃▌ 100% self-contained    ┃ ┃▌ 94.08% binding        ┃│
│ ○ newest   │ ┃▌ justice_funding          ┃ ┃▌ qld_watchhouse_*       ┃ ┃▌ acnc_ais.abn →        ┃│
│ ○ biggest  │ ┃▌  .gs_entity_id →         ┃ ┃▌                        ┃ ┃▌   gs_entities.abn     ┃│
│   move     │ ┃▌   gs_entities.id         ┃ ┃▌ ⚠ rebaselined off MAY  ┃ ┃▌                       ┃│
│ ○ shakiest │ ┃▌ 4 ingredients · fresh 14h┃ ┃▌   (n=59), not APR (n=2)┃ ┃▌ 3 ingr · fresh 2d     ┃│
│   coverage │ ┃▌ ✓ sentinels clear        ┃ ┃▌ ✓ sentinels clear      ┃ ┃▌ ✓ sentinels clear     ┃│
│ ○ most     │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━┛│
│   blocked  │                        … 11 more ANSWERED, 3 across, ranked by REACH …              │
│            │─ CONTESTED · 5 ─ answerable, but a named defect would make the claim wrong ──────────│
│ COVERAGE   │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━━━━━━━━━━━━┓  ▌ = 8px RED left border  │
│ ├──●─────┤ │ ┃▌MONEY · POWER  ⚑ 2 FIRED  ┃ ┃▌HOUSE          ⚑ TARGET ┃                          │
│  50%   95% │ ┃▌GIVES AND TAKES           ┃ ┃▌MATVIEWS NOBODY REFRESHES┃                          │
│            │ ┃▌  ~~$713,456m~~ NOT SHOWN ┃ ┃▌  71 of 98    target ≤10 ┃                          │
│ SCOPE      │ ┃▌ ⚑ 85.3% of the dollars   ┃ ┃▌  2,871,838 rows        ┃                          │
│ ● civic    │ ┃▌   are 'other receipt'    ┃ ┃▌  55 in NEITHER registry┃                          │
│ ○ +ACT ▚   │ ┃▌ ⚑ 13 rows = 29.4% of all ┃ ┃▌ [ RECONCILE THEM → ]   ┃                          │
│            │ ┃▌   value; max Hays $123bn ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━━━┛                          │
│            │ ┃▌ [ ADJUDICATE THE 13 → ]  ┃                                                       │
│            │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛                                                       │
│            │─ CANNOT ANSWER YET · 7 ─ the want list ──────────────────────────────────────────────│
│            │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━━━━━━━━━━━━┓  ▌ = 8px BLUE left border │
│            │ ┃▌PLACE · JUSTICE       + GAP┃ ┃▌POWER            + GAP  ┃                          │
│            │ ┃▌OVER-REPRESENTATION       ┃ ┃▌DIRECTORS AND CONTRACTS ┃                          │
│            │ ┃▌Is this LGA's Indigenous  ┃ ┃▌Which directors sit on  ┃                          │
│            │ ┃▌youth over-representation ┃ ┃▌the board of an org that┃                          │
│            │ ┃▌above or below the state  ┃ ┃▌holds a govt contract?  ┃                          │
│            │ ┃▌rate?                     ┃ ┃▌                        ┃                          │
│            │ ┃▌ BLOCKED BY               ┃ ┃▌ BLOCKED BY             ┃                          │
│            │ ┃▌  + abs_indigenous_       ┃ ┃▌  + mv_board_contractor_┃                          │
│            │ ┃▌    population_by_lga     ┃ ┃▌    links  4 rows       ┃                          │
│            │ ┃▌    0 rows                ┃ ┃▌  + mv_board_donor_links┃                          │
│            │ ┃▌ EFFORT S · one CC-BY-4.0 ┃ ┃▌    2 rows              ┃                          │
│            │ ┃▌   ABS download           ┃ ┃▌ EFFORT S · predicate   ┃                          │
│            │ ┃▌ UNLOCKS 4 questions and  ┃ ┃▌   bug, one day         ┃                          │
│            │ ┃▌   every per-capita       ┃ ┃▌ UNLOCKS 2 flagship     ┃                          │
│            │ ┃▌   Indigenous rate below  ┃ ┃▌   cross-sections       ┃                          │
│            │ ┃▌   state       + 0/wk     ┃ ┃▌ [ THE WANT LIST → ]    ┃                          │
│            │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━━┛                          │
└────────────┴─────────────────────────────────────────────────────────────────────────────────────┘
```

**Components.** `<EstateStrip>` Server · `<Rail>` Client (facet counts from the payload) ·
`<AskBar>` Client (debounced 150 ms over questions, objects, columns, verbs) ·
`<QuestionCard>` Server (the whole card is server HTML; only the grid is a client island) ·
`<Sparkline>` Server inline SVG over the last six `clarity_answer` rows · `<CoverageBar>` Server
inline SVG, **always prints the fraction, never a bare percent**, with the binding join named
underneath · `<SentinelRow>` Server · `<GapGlyph>` Server, 16px, 2px blue border, clickable.

**Query A — the estate strip** (`clarity_object`, **deliverable**):

```sql
SELECT count(*)                       FILTER (WHERE NOT act_business)                        AS objects,
       count(*)                       FILTER (WHERE NOT act_business AND object_kind='table')   AS tables,
       count(*)                       FILTER (WHERE NOT act_business AND object_kind='matview') AS matviews,
       count(*)                       FILTER (WHERE NOT act_business AND object_kind='view')    AS views,
       count(*)                       FILTER (WHERE NOT act_business AND object_kind='function') AS routines,
       sum(row_count)                 FILTER (WHERE NOT act_business
                                          AND object_kind IN ('table','matview'))            AS rows_held,
       sum(bytes)                     FILTER (WHERE NOT act_business)                        AS bytes_held,
       count(*)                       FILTER (WHERE act_business)                            AS act_excluded,
       max(refreshed_at)                                                                     AS swept_at
  FROM clarity_object
 WHERE missing_since IS NULL;
```

The `68 FEED A QUESTION / 1,365 DO NOT` clause needs `clarity_question_ingredient`, which does not
exist until slice 2. **In slice 1 that clause renders `+ NOT YET MEASURED` in blue** — the
alphabet doing its job on the spec's own front line, rather than a zero.

**Query B — the board** (`v_clarity_board`, **deliverable**):

```sql
SELECT b.*,
       (SELECT count(*) FROM clarity_question_ingredient i WHERE i.question_slug = b.slug) AS ingredients,
       (SELECT min(o.last_write_at)
          FROM clarity_question_ingredient i
          JOIN clarity_object o ON o.object_key = i.object_key
         WHERE i.question_slug = b.slug)                                     AS oldest_ingredient_write,
       (SELECT jsonb_agg(jsonb_build_object('at', x.computed_at, 'h', x.headline)
                         ORDER BY x.computed_at)
          FROM (SELECT * FROM clarity_answer y
                 WHERE y.question_slug = b.slug AND y.ok
                 ORDER BY y.computed_at DESC LIMIT 6) x)                     AS spark,
       base.headline AS base_headline, base.computed_at AS base_at
  FROM v_clarity_board b
  LEFT JOIN LATERAL (SELECT * FROM clarity_answer x
                      WHERE x.question_slug = b.slug AND x.ok
                        AND x.computed_at <= $1::timestamptz     -- the global baseline
                      ORDER BY x.computed_at DESC LIMIT 1) base ON true
 ORDER BY b.state, b.reach_score DESC NULLS LAST;
```

~26 rows, one round trip, reads only registry tables — no source data touched. Sub-50 ms [I].

**Ranking — REACH**, the default sort (carried from Interrogator §5.4, computed in `reach.ts` and
stored on `clarity_question.reach_score` by the nightly runner):

```
reach = 0.30 · ln(1+dollars_made_legible) / ln(1+max_dollars)
      + 0.25 · binding_coverage            -- the honest cap on the claim
      + 0.15 · uniqueness                  -- 1.0 = no public Australian source does this
      + 0.15 · recency_band(oldest ingredient write)  -- 1.0 ≤7d · 0.7 ≤30d · 0.4 ≤180d · 0.1 older
      + 0.15 · publishable_weight          -- public 1.0 · shareable 0.7 · internal 0.4
      × state_multiplier                   -- answered 1.0 · contested 0.6 · cannot_answer 0.5
```

`uniqueness` is the **only** hand-set input in the whole surface, and it carries
`uniqueness_basis`, the written reason we believe no public source does this. That is declared
curation debt, not hidden (§7).

**States.**

| State | Render |
|---|---|
| Loading | Card skeletons **with the stub, question and ingredient chips already present** — they come from the registry, not the answer. Only the number and bar are skeletons. Never a spinner over a blank card |
| Never run | `NEVER RUN` in blue mono where the number goes, plus the registration date. **Never a zero** |
| Last run errored | Red band across the card top with `error_text`; the last good answer beneath it, greyed, stamped `AS AT <date>`. Never a stale number presented as current |
| Sentinel tripped | Number struck through, `NOT SHOWN` beside it, every tripped sentinel listed with its count and share, and the adjudication CTA |
| Baseline thinner than history | Every delta renders `?` with the reason in the baseline control (`30d — history begins 15 AUG, 3 nights`) |
| Registry unseeded | The estate strip alone, plus one card: *"No questions registered. Seed with `node scripts/seed-clarity-questions.mjs`."* An instrument that says what to do |
| DB unreachable | One red-bordered panel with the error. **Never a partial board** — JusticeHub's `/what-we-hold` returns `null` on any failure rather than partial numbers, which is the right posture [R] |

**Drill targets.** Card → S2. `[ THE LEDGER → ]` → S4. `[ WHAT CHANGED → ]` → S8.
`[ THE WANT LIST → ]` → S9. Object chip anywhere → S5. `▸ scope register` → S4 filtered to
`scope=all` with the ACT block shown hatched.

### 3.2 S2 · THE WORKED ANSWER — `/clarity/q/[slug]`

**Purpose.** One claim, with everything that qualifies it, in the same eyeful.
**The question only this screen answers:** *"How was this number made, what caps it, and what am
I allowed to say about it?"*

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ CLARITY   JUSTICE · EVIDENCE          ANSWERED   HONEST AT ENTITY   PUBLISHABLE: SHAREABLE     ║
║ THE EVIDENCE GAP                                                                                 ║
║ How much youth-justice grant money goes to organisations with no evidence record linked?         ║
║ COMPUTED 15 AUG 03:19 · 279 ms · run #7    [ RE-RUN ] [ COPY THE CLAIM ] [ SEE THE 662 ROWS → ]  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
┌──────────────────────────────────────────────────────────┬───────────────────────────────────────┐
│  85.1%                                    · 0.0pp / 30d  │ PROVENANCE                            │
│  of organisations receiving youth-justice grant money     │                                       │
│  have no evidence record linked in ALMA                  │ ▣ justice_funding            SPINE    │
│                                                          │   157,116 rows · written 14 AUG       │
│  TOPIC [ youth-justice ▾ ]   MEASURE_KIND [ grant ▾ ]    │   gs_entity_id → gs_entities.id       │
│                              ↑ REQUIRED, see caveat      │   ████████████████████▒▒  93.65%      │
│                                                          │   ◀ BINDING JOIN — caps this claim    │
│         ORGANISATIONS              GRANT DOLLARS         │                                       │
│  no ev. ████████████████████ 662   ██████████ $663.9m    │ ▣ alma_interventions          FACT    │
│  linked ███ 116                    ███████ $478.2m       │   2,136 rows · written 14 AUG         │
│         └──────────────────┘       └────────────────┘    │   gs_entity_id 70.27% stamped         │
│         0            400    800    0        400m   800m  │   ██████████████▒▒▒▒▒▒  70.27%        │
│                                                          │                                       │
│  RUN HISTORY   85.4 ─ 85.3 ─ 85.1 ─ 85.1 ─ 85.1 ─ 85.1   │ ▣ gs_entities            REFERENCE    │
│                10AUG          12AUG          15AUG       │ ▣ alma_intervention_evidence  FILTER  │
├──────────────────────────────────────────────────────────┼───────────────────────────────────────┤
│ ⚠ SAY IT THIS WAY                                        │ SENTINELS                             │
│   SAY: "no evidence record linked in ALMA"               │ ✓ measure_kind filter applied         │
│   NOT: "has no evidence"                                 │   without it this number is 45.3×     │
│   ALMA holds 2,136 interventions — a curated register,   │   wrong ($69.44bn vs $1.534bn)        │
│   not a census of practice. The first is a fact about    │ ✓ topics array uses HYPHENS           │
│   this database. The second is a claim about the         │   'youth-justice', not 'youth_justice'│
│   organisation.                                          │   (underscore silently returns 0)     │
├──────────────────────────────────────────────────────────┤ ✓ no plausibility ceiling breached    │
│ WHAT WOULD MAKE THIS BETTER                              ├───────────────────────────────────────┤
│  + alma_interventions.gs_entity_id is 70.27% stamped.    │ EXCLUSIONS (deterministic, not a      │
│    Stamping the remaining 635 moves the denominator,     │ sample)                               │
│    not the numerator.                    EFFORT S        │  · measure_kind <> 'grant'            │
│  × mv_entity_total_funding.grants_total is exactly 0     │    848 rows / $66.126bn of RoGS and    │
│    across all 94,088 rows, so this cannot yet be a       │    AIHW state budget aggregates       │
│    share of ALL money an org receives.   EFFORT M        │  · gs_entity_id IS NULL — 6.35%       │
│                                        [ WANT LIST → ]   │  · topics NOT && ['youth-justice']     │
└──────────────────────────────────────────────────────────┴───────────────────────────────────────┘
  ▸ THE SQL                                                                              [ COPY ]
```

**Why the layout is this way.** The caveat is not a footnote: `⚠ SAY IT THIS WAY` sits at the same
visual weight as the answer, directly under the chart. The provenance ledger is a **permanent
right rail, not a tab** — you cannot read the number without seeing what caps it. Exclusions are
printed as the deterministic filter, never as "a sample". And **`measure_kind` is a required
control, not a default**: the chart will not render until one is selected, which makes the 45.3×
error structurally impossible rather than merely documented.

**Queries.** Header and payload: `SELECT * FROM v_clarity_board WHERE slug = $1` (1 row).
Ingredients: `SELECT i.*, o.row_count, o.last_write_at, o.object_kind FROM
clarity_question_ingredient i JOIN clarity_object o USING (object_key) WHERE i.question_slug = $1
ORDER BY i.is_binding DESC, i.role` (≤6 rows). Run history:
`SELECT computed_at, headline, coverage_num, coverage_den, ok, error_text, duration_ms FROM
clarity_answer WHERE question_slug = $1 ORDER BY computed_at DESC LIMIT 30`. Wants:
`SELECT * FROM clarity_question WHERE $1 = ANY(unlocks_questions)` plus the blocked-object join
(G15). The chart itself reads **`clarity_answer.payload`** — never a source table.

**`[ COPY THE CLAIM ]`** puts this on the clipboard:

```
85.1% of organisations receiving youth-justice grant money have no evidence record linked in ALMA.
662 of 778 organisations, holding $663.9m of $1,142.1m.

Coverage: binding join justice_funding.gs_entity_id -> gs_entities.id, measured 93.65%.
Honest at: ENTITY.
Excludes: measure_kind <> 'grant' (848 rows / $66.126bn of state budget aggregates);
          gs_entity_id IS NULL (6.35%); topics not containing 'youth-justice'.
Caveat:   ALMA holds 2,136 interventions, a curated register, not a census of practice.
          This measures evidence RECORDED IN ALMA, not evidence that exists.
Computed: 2026-08-15 03:19 UTC.   https://…/clarity/q/evidence-gap
```

You cannot copy the number without its coverage and its caveat. That is the answer to *"a striking
finding with 4% join coverage is a liability"*: the liability is not the finding, it is the finding
travelling naked, and this makes nakedness take deliberate effort.

**The five forms.** `scalar` · `ranked_bar` · `stacked_three` (resolved / refused / missing) ·
`matrix` · `timeseries` — plus `refused`, which renders no chart at all (§3.7). `hexmap` and
`sankey` are cut (§1.5).

**The sample-size track.** Every `timeseries` renders a second track under the x-axis showing `n`
per bucket as a hairline bar. `VERIFICATION.md §4` found every headline watchhouse figure anchored
on a first bucket of **n = 2**, and nobody caught it for a day because a line chart draws its first
point exactly as confidently as its hundredth. An n=2 bucket is a 2px sliver against a 59px bar
and cannot be missed. One extra `<rect>` row, and it generalises to every time series in both apps.

```
  40 ┤                                        ●
  20 ┤        ●       ●               ●
   0 ┼────────┬───────┬───────┬───────┬───────┬──
     APR     MAY     JUN     JUL     AUG
 n   ▌       █████   █████   █████   ███
     2       59      52      62      26     ← baseline refused at n=2; series rebased on MAY
```

**States.** Never run → `NEVER RUN`, not a zero. Errored → the error, with the last good answer
greyed and dated. Sentinel with `severity='block'` tripped → **rows are not returned at all** and
the page renders the refusal with its evidence. Live re-run → refused when `live_rerun_ok = false`,
printing the measured duration as the reason (the 8-second PostgREST ceiling is inescapable, proven
empirically [R]).

**Drill targets.** `[ SEE THE ROWS → ]` → S3. Any ingredient chip → S5. Binding-join coverage bar
→ S6 filtered to that seam. `[ WANT LIST → ]` → S9. Related questions → S2.

### 3.3 S3 · THE ROWS — `/clarity/q/[slug]/rows`

**Purpose.** The organisations behind the number, each with its source row.
**The question only this screen answers:** *"Which ones, by name, and how much each?"*

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ THE EVIDENCE GAP     662 ORGANISATIONS · NO EVIDENCE RECORD LINKED · $663.9m                   ║
║ [ evidence linked: NO ▾ ] [ topic: youth-justice ▾ ] [ sort: $ ▾ ]      [ CSV ] [ SQL IN-LIST ]  ║
╠═══════════════════════════════════╤═════════╤════════════╤═══════════╤═══════════════════════════╣
║ ORGANISATION                      │ GRANTS  │ TOTAL      │ LGA       │ ALMA                      ║
╟───────────────────────────────────┼─────────┼────────────┼───────────┼───────────────────────────╢
║ ▸ Example Youth Service Inc       │      14 │ $12,480,00 │ Cairns QLD│ + no record linked        ║
║   GS-41822 · ABN 89 006 ···       │         │            │           │                           ║
║ ▸ Another Service Ltd             │       3 │  $1,205,00 │ ? refused │ + no record linked        ║
╚═══════════════════════════════════╧═════════╧════════════╧═══════════╧═══════════════════════════╝
  Showing 1–50 of 662.  Every row links to /entities/[gsId].
  ? 34,223 entities hold a postcode and no LGA BECAUSE the rebuild refused to be confidently wrong.
    Yellow, not red.  [ what "refused" means → ]
```

**Query.** `clarity_question.rows_sql` is stored on the question and **must** accept `LIMIT` /
`OFFSET`; the page appends them. It runs through `exec_sql`, whose read-only guard admits any
statement starting `select` or `with` [R, verified in `supabase.ts` by a second agent], under the
8-second ceiling. Export writes the same deterministic exclusion string into the CSV header, so an
exported file carries its exclusions.

**States.** Zero rows → *"This question's row query returned nothing. The headline says 662. That
is a contradiction, and it means `rows_sql` and `answer_sql` have drifted."* — a diagnosis, not an
empty state. Timeout → the exact psql command to run it outside the app.

**Drill targets.** Row → `/entities/[gsId]` (the existing product surface). Never a new entity page.

### 3.4 S4 · THE LEDGER — `/clarity/data`

**Purpose.** The literal ask: absolutely every piece of data, listed.
**The question only this screen answers:** *"What do we hold, what is it for, and where are the
holes?"*

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ CLARITY ▸ THE LEDGER      1,433 OBJECTS · 68 FEED A QUESTION · 1,365 DO NOT · +0/wk · never    ║
║ ⌕ search names, purposes, 14,310 columns…       LENS ▾ feeds · rows · bytes · fresh · gaps · exp ║
╠════════════╤═════════════════════════════════════════════════════════════════════════════════════╣
║ RAIL       │ SOURCES 714 │ DERIVED 98 │ LENSES 212 │ ROUTINES 409 │ ALL 1,433   sort FEEDS ▾      ║
║            │ ┌────────────────────┬───────┬──────┬─────┬─────┬───┬───┬───┬───┬───┬───┬─────────┐ ║
║ KIND       │ │ OBJECT             │  ROWS │ Δ30d │ SIZE│FRESH│FDS│PUR│OWN│JOI│USE│EXP│  BLOCKS │ ║
║ ▢ table 714│ ├────────────────────┼───────┼──────┼─────┼─────┼───┼───┼───┼───┼───┼───┼─────────┤ ║
║ ▢ matvw 98 │ │ austender_contracts│823,620│▲2,481│2.1GB│  7d │ 4 │ █ │ █ │ █ │ █ │ █ │    1    │ ║
║ ▢ view 212 │ │ justice_funding    │157,116│  ·   │1.2GB│  0d │ 6 │ █ │ █ │ █ │ █ │ █ │    1    │ ║
║ ▢ func 409 │ │ organizations      │104,427│▲  118│210MB│  0d │ 2 │ █ │ + │ █ │ █ │ █ │    0    │ ║
║            │ │ gs_relationships   │  3.43M│▲5,263│2.1GB│  5d │ 1 │ █ │ + │ × │ █ │ █ │    1 ⚑  │ ║
║ DOMAIN     │ │   × source_record_id → justice_funding.id: 0 of 49,426. Dead key namespace.      │ ║
║ ▢ D1  18   │ │ gs_entities        │609,448│▲  892│4.9GB│  0d │ 9 │ █ │ █ │ █ │ █ │ █ │    0    │ ║
║ ▢ D2  30   │ │ political_donations│  2.55M│  ·   │1.1GB│  7d │ 1 │ █ │ + │ ? │ █ │ █ │    1 ⚑  │ ║
║ …          │ │ abr_registry       │ 20.0M │  ?   │6.9GB│  ?  │ 0 │ █ │ + │ + │ + │ █ │    0    │ ║
║ ▢ UNFILED  │ │   ? freshness deferred_too_large · 20M rows, zero app references, feeds nothing   │ ║
║     621    │ │ acnc_ais           │360,488│  ?   │1.4GB│  ?  │ 3 │ █ │ + │ █ │ █ │ █ │    0    │ ║
║            │ │ person_roles       │339,698│  ·   │120MB│ 57d │ 0 │ █ │ + │ █ │ █ │ █ │    0    │ ║
║ STATE      │ │   ? 57 days stale · this is the entire director-links pillar                     │ ║
║ ▢ live     │ │ ⛔ gs_entities_lga_backup_20260808  609,416 rows · BACKUP · superseded            │ ║
║ ▢ empty 88 │ │ v_org_funding_prof.│609,448│  ?   │  ·  │  ·  │ 0 │ + │ + │ █ │ █ │ █ │    0    │ ║
║ ▢ tiny     │ │ v_entity_360       │   ?   │  ?   │  ·  │  ·  │ 0 │ + │ + │ + │ █ │ █ │    0    │ ║
║ ▢ backup 14│ │   ? row count timed out at 3s · re-probed weekly at 30s · never stored as 0      │ ║
║ ▢ staging  │ │ rebuild_funder_intelligence()  ROUTINE · × SECURITY DEFINER, anon-executable, writes│
║            │ │ … 1,424 more · sticky header · frozen first column · no pagination, ever          │ ║
║ GAPS       │ └────────────────────┴───────┴──────┴─────┴─────┴───┴───┴───┴───┴───┴───┴─────────┘ ║
║ ▢ feeds 0  │ DERIVED · 98 matviews     ⚑ 71 in NO refresh registry · 2,871,838 rows              ║
║   1,365    │ LENSES  · 212 views       ⚑ 132 referenced nowhere · 26 return zero rows            ║
║ ▢ no purp. │ ROUTINES · 409 functions  ⚑ 3 SECURITY DEFINER are anon-executable, all three write ║
║   621      │                                                                                     ║
║ ▢ no owner │ █ present  + never measured  ? unmeasurable  × measured, zero  · n/a  ▚ out of scope║
║   1,408    │                                                                                     ║
║ ▢ no refr. │ ▚ 238 ACT PRIVATE-BUSINESS OBJECTS EXCLUDED. Not hidden, scoped. ▸ scope register   ║
║ ▢ unmonit. │                                                                                     ║
║   54       │ [ EXTRACT ▾ ]  CSV · SQL IN-list · copy this URL · open in the seam graph            ║
║ ▢ anon 451 │                                                                                     ║
╚════════════╧═════════════════════════════════════════════════════════════════════════════════════╝
```

**Five decisions in this screen.**

1. **Four ranked strips, not one flat list.** Measured, not taste: views carry zero bytes and low
   degree, so a single `importance`-sorted list is 100% tables and matviews for its first 182 rows,
   and **the highest-ranked view is #183** [R]. A flat list silently buries 206 anon-readable API
   surfaces including `v_entity_360` and `org_governance`. `ALL 1,433` is one click and is the
   literal complete list.
2. **`FEEDS` and `BLOCKS` are the difference.** Fully derived from the registry, zero curation.
   `FEEDS 0` sorted ascending, filtered to `rows > 1,000,000`, is a two-click answer to *"what
   enormous thing am I not using"*: today that returns `abr_registry` (20.0M), `asic_name_lookup`
   (2.1M), `privacy_audit_log` (1.28M), the three objects VERIFICATION confirmed have zero
   references of any kind [R]. It also fixes the ranking's one admitted weakness —
   `abr_registry` sits at rank 56 on importance and would otherwise stay below the fold forever.
3. **`Δ` is column three,** beside ROWS, not buried in a detail view. Sorting by drift is the
   morning move and it is one click.
4. **Sub-rows carry the reason, in place.** No tooltips for load-bearing information: tooltips are
   unprintable, unsearchable and unscreenshottable, which is disqualifying here.
5. **`rows` and `bytes` are first-class sorts,** because `importance` is a usage-weighted score and
   the largest object in the database is read by no product surface.

**Query** — one round trip, ~1,433 rows × ~30 fields ≈ 260 KB of JSON (≈45 KB gzipped) [I],
shipped whole in the RSC payload so every facet count and filter is in-memory and sub-100 ms:

```sql
SELECT l.object_key, l.object_name, l.object_kind, l.domain, l.lifecycle, l.state,
       l.row_count, l.row_count_is_estimate, l.row_count_probe, l.bytes, l.degree,
       l.last_write_at, l.freshness_probe, l.freshness_source,
       l.refs_app, l.refs_script, l.refs_db_function, l.refs_migration, l.owner_app,
       l.has_purpose, l.has_owner, l.has_domain, l.has_join, l.has_use, l.is_fresh,
       l.anon_readable, l.security_invoker, l.security_definer, l.anon_execute,
       l.pii_level, l.exposure_conflict, l.act_business, l.importance, l.verdict,
       d.row_delta, d.row_delta_pct, d.is_new, d.is_missing,
       f.feeds, b.blocks
  FROM v_clarity_ledger l
  LEFT JOIN clarity_delta d
         ON d.object_key = l.object_key AND d.baseline = $1
  LEFT JOIN LATERAL (SELECT count(*) AS feeds FROM clarity_question_ingredient i
                      WHERE i.object_key = l.object_key)                        f ON true
  LEFT JOIN LATERAL (SELECT count(*) AS blocks FROM clarity_question q
                      WHERE l.object_key = ANY(q.blocked_by))                   b ON true
 WHERE l.missing_since IS NULL
 ORDER BY l.importance DESC;
```

Every column verified present on `v_clarity_ledger` or named as a deliverable (`clarity_delta`,
`clarity_question*`) [V].

**States.** Never swept → the whole table is replaced by one black card: *"The catalog has never
been swept. Run `node scripts/snapshot-clarity.mjs` (~4.5 min). Nothing on this page is inferred
from a stale file."* Swept >26h ago → a 2px yellow top border and the strip reads `43h ?`; numbers
still show, dated, never presented as current. A filter that empties the list → *"Your filter
leaves 0 of 1,433. Here are the three facets closest to a match."* — never a blank.

**Drill targets.** Row → S5. `FEEDS n` → S1 filtered to those questions. `BLOCKS n` → S9. A join
glyph → S6. A `+` in any gap column → the inline editor for that field (purpose, owner) which
writes through `/api/clarity/verdict` and re-renders server-side.

### 3.5 S5 · THE OBJECT — `/clarity/data/[object]`

**Purpose.** Everything known about one object, including what it is **for**.
**The question only this screen answers:** *"What is this, who reads it, what does it join to, and
what breaks if it is wrong?"*

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ THE LEDGER   justice_funding                              TABLE · D8 JUSTICE · CORE_SOURCE     ║
║ 157,116 rows · exact · written 14 AUG 09:22 · 1.2 GB · degree 45 · importance 0.930 · rank #2    ║
║ RLS on · 3 policies · not anon-readable · pii low          [ KEEP ] [ SUSPECT ] [ CRUFT — reason ]║
╠══════════════════════════════════════════════════════════════════════════════════════════════════╣
║ ANSWERS 6 QUESTIONS                                  BLOCKS 1                                    ║
║  ▸ THE EVIDENCE GAP     binding join, 93.65%          ▸ YOUTH JUSTICE MONEY   ⚑ contested        ║
║  ▸ AFTER RELEASE   ▸ WHOSE MONEY, WHOSE PLACE           measure_kind mixing inflates the topic    ║
║  ▸ EVERY DOLLAR    ▸ DISADVANTAGE, NO MONEY ⚑           total 45.3×                               ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════╣
║ ROWS, 120 DAYS                                                                                   ║
║ 218,022 ┤███████▔▔▔╲                                                                             ║
║         │          ╲______________________________________________________ 157,116               ║
║         └──┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────  APR 09 → AUG 14                   ║
║  × −60,906 on or before 02 APR · NO REASON RECORDED       [ RECORD THE REASON → ]                ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════╣
║ ⚑ CONTESTED DEFINITION — this object has two live definitions of one concept                     ║
║   "justice funding, cleaned":  view justice_funding_clean (sector <> 'procurement') = 151,866     ║
║                                measure_kind = 'grant'                = 126,673 / $46.097bn        ║
║   Gap 25,193 rows. Canonical: measure_kind='grant'. Registered in clarity_metric_definition.      ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════╣
║ SEAMS (12)                                        measured    at stake     losing                ║
║  → gs_entities.id       via gs_entity_id          █ 93.65%    157,116      9,976                 ║
║  → gs_entities.abn      via recipient_abn         █ 95.00%    157,116      7,909                 ║
║  ← gs_relationships     via source_record_id      × 0.00%      49,426     49,426  ⛔              ║
║     × DEAD KEY NAMESPACE. uuid-shaped, matches neither .id nor .source_statement_id.              ║
║       "Click an edge to see the grant" is unbuildable until this is rebuilt.  [ SEAMS → ]         ║
║  … 9 more                                                                                        ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════╣
║ COLUMNS (34)     nullity ▁▁█▁▁▁▂▁▁▁▁▃▁▁▁▁▁█▁▁▁▁▁▁▁▂▁▁▁▁▁▁▁                                       ║
║  gs_entity_id   uuid    nullable  ███████████░ 93.65% filled  → gs_entities.id  BINDING          ║
║      NULLS BY REASON   has ABN, entity never created 6,363 · no ABN in the source row 3,640      ║
║  recipient_abn  text    nullable  ███████████░ 95.00%                                            ║
║  measure_kind   text    NOT NULL  4 distinct  ⚑ grant 126,673 · contract_value 29,519 ·          ║
║                                     expenditure_aggregate 848 ($66.126bn) · budget_announcem. 76 ║
║  topics         text[]  GIN       + nulls here are not reason-coded. We cannot tell you why.     ║
║  … 30 more                                                                                       ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════╣
║ READ BY    133 app files · 138 scripts · 4 db functions · 2 triggers · 3 views · 41 migrations    ║
║            migrations counted separately: DDL is not use                                         ║
║ GOVERNANCE owner + · licence + · sla_hours + · public_caveat +      [ fill these → ]              ║
║ RELATED    alma_interventions(129) · gs_entities(97) · organizations(87) · austender(46)          ║
║            structural, not embeddings — "used together in report-service.ts"                      ║
║ ALSO IN    [ /ops/health/justice-funding → ]  [ /graph justice mode → ]  [ COPY SELECT ]          ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
```

**Queries** — six small reads, none touching a big table:

```sql
-- 1 header
SELECT * FROM v_clarity_ledger WHERE object_key = $1;
-- 2 history (NOTE: snapshot_at, not captured_at)
SELECT snapshot_at, row_count, row_count_is_estimate, bytes, degree, importance, last_write_at
  FROM clarity_object_history
 WHERE object_key = $1 AND snapshot_at > now() - interval '120 days'
 ORDER BY snapshot_at;
-- 3 seams, both directions, BROKEN FIRST
SELECT e.*, CASE WHEN e.src_object = $1 THEN 'out' ELSE 'in' END AS dir,
       round(coalesce(e.rows_at_stake, e.match_denominator, 0)
             * (1 - coalesce(e.match_rate, 0)))                    AS rows_losing
  FROM clarity_edge e
 WHERE (e.src_object = $1 OR e.tgt_object = $1) AND e.mechanism <> 'view_lineage'
 ORDER BY (e.match_rate IS NULL), (e.match_rate < 0.5) DESC, rows_losing DESC;
-- 4 readers, distinct FILES, migration in its own class
SELECT ref_class, repo, count(DISTINCT file_path) AS files,
       array_agg(DISTINCT file_path ORDER BY file_path)
         FILTER (WHERE ref_class IN ('db_function','trigger')) AS names
  FROM clarity_code_ref WHERE object_key = $1 GROUP BY ref_class, repo;
-- 5 columns (NOTE: null_pct and distinct_est; there is NO fk_target — derive from clarity_edge)
SELECT c.ordinal, c.column_name, c.data_type, c.is_nullable, c.is_pk, c.is_indexed,
       c.is_vector, c.vector_dim, c.null_pct, c.distinct_est, c.profiled_at,
       e.tgt_object, e.tgt_column, e.match_rate
  FROM clarity_column c
  LEFT JOIN clarity_edge e ON e.src_object = c.object_key AND e.src_column = c.column_name
 WHERE c.object_key = $1 ORDER BY c.ordinal;
-- 6 answers / blocks / definitions / events
SELECT q.slug, q.stub, q.state, i.is_binding, i.role, i.measured_pct
  FROM clarity_question_ingredient i JOIN clarity_question q ON q.slug = i.question_slug
 WHERE i.object_key = $1 ORDER BY i.is_binding DESC;
SELECT slug, stub, state, unlock_effort FROM clarity_question WHERE $1 = ANY(blocked_by);
SELECT * FROM clarity_metric_definition WHERE source_object = $1 ORDER BY is_canonical DESC;
SELECT * FROM clarity_event WHERE object_key = $1 ORDER BY at DESC LIMIT 20;
```

**Null reasons (G14).** Per-object and not derivable generically, so they are registered:
`clarity_null_reason(object_key, column_name, reason_label, reason_sql)`, ~12 seeded rows.
A column with no registration renders `+ nulls here are not reason-coded. We cannot tell you why.`

**States.** Object is a **function** → columns, nullity and seams become `·` and the body switches
to signature, language, volatility, `SECURITY DEFINER`, `anon_execute`, trigger attachments,
`routine_src_bytes` and call sites. 409 objects no prior artefact has ever rendered. Object is
**missing** (`missing_since` set) → the page still renders, muted, red top rule: *"This object
disappeared from the schema on 12 Aug. Its history is kept."* The row is never deleted. `CRUFT`
verdict while anything reads it → **the database refuses it** (`clarity_object_no_cruft_while_
referenced`, verified in the DDL [V]) and the UI explains: *"3 app files still read this."*

### 3.6 S6 · THE SEAMS — `/clarity/seams`

**Purpose.** Every connection in the database, ranked by how much data it is losing right now.
**The question only this screen answers:** *"What is the most expensive broken connection here,
and what is it costing?"*

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ CLARITY ▸ THE SEAMS    636 declared FK · 695 lineage · 84 curated    ranked by ROWS LOSING     ║
║ MECHANISM ▢ fk ▢ abn ▢ uuid_stamp ▢ postcode ▢ lga     STATE ▢ × dead ▢ ⚠ <50% ▢ █ ≥90% ▢ + unmeas║
╠═══════════════════════════════════╤═══════════════════════════╤═══════╤═════════╤════════════════╣
║ FROM                              │ TO                        │ MATCH │ LOSING  │ TREND          ║
╟───────────────────────────────────┼───────────────────────────┼───────┼─────────┼────────────────╢
║ political_donations.donor_abn     │ gs_entities.abn           │25.10% │1,910,053│ ▼ 0.4pp        ║
║   × Only 653,261 of 2,549,483 rows carry any donor_abn. The loss is at COLLECTION, not matching. ║
║     Three times worse than any other money table.                                                ║
║ grantconnect_awards.recipient_abn │ gs_entities.abn           │72.40% │  80,500 │ ▲ 1.2pp        ║
║   ⚠ 68,172 well-formed ABNs absent from gs_entities · 99.97% of them exist in abr_registry.      ║
║     FIXABLE BY ONE BULK INSERT.  [ WANT #3 → ]                                                   ║
║ austender_contracts.supplier_abn  │ gs_entities.abn           │92.90% │  58,189 │ ▲ 0.1pp        ║
║ gs_relationships.source_record_id │ justice_funding.id        │ 0.00% │  49,426 │ × dead         ║
║   × DEAD KEY NAMESPACE. uuid-shaped, matches neither .id nor .source_statement_id.                ║
║     "Click an edge to see the grant" is unbuildable until this is rebuilt.  [ WANT #5 → ]        ║
║ nz_charities.gs_entity_id         │ gs_entities.id            │ 0.00% │  45,192 │ × never        ║
║   × DECLARED BRIDGE, NEVER POPULATED. 0 of 45,192.                                               ║
║ ndis_participants_lga.lga_code    │ postcode_geo.lga_code     │ 0.00% │   8,329 │ × never        ║
║   × 100% NULL. 362,313 NDIS rows stranded at state level. NDIS CONCENTRATION refuses an LGA map. ║
║ justice_funding.gs_entity_id      │ gs_entities.id            │93.65% │   9,976 │ ·              ║
║ funding.postcode                  │ postcode_geo.postcode     │41.70% │   3,894 │ ·              ║
║   × GRAIN DEFECT: the reference table holds 2,909 distinct postcodes; the fact table has 6,684.  ║
║     The reference, not the data, is the problem.                                                 ║
║ mv_funding_by_lga.lga_code        │ (self, grain)             │  ·    │   1,729 │ × 3.16/key     ║
║   × 1,729 rows for 548 LGA codes = 3.16 rows per key. A choropleth on this silently triple-counts.║
║ acnc_charities.abn                │ gs_entities.abn           │100.0% │       0 │ ·              ║
║ … 1,406 more · sorted by rows losing · sticky header                                             ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════╣
║ [ RENDER THE GRAPH ]  14 domain nodes + the top 126 objects by degree = 140 nodes, 318 edges     ║
║   ⛔ REFUSES above 200 nodes. A 2-hop neighbourhood in the ENTITY graph is ~2,345 nodes and is    ║
║      not drawable as node-link. This is the SCHEMA graph, which is small enough to be honest.    ║
║      [ draw it anyway (will render the top 200 of N and print what it dropped) ]                 ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
```

**Why a table and not a map.** A map answers *"is it connected?"* — which, with 636 declared FKs,
is almost always yes and almost never interesting. This answers *"is the connection carrying the
data?"*, which is where all four of the defects that matter live: the 0% justice drill-through, the
25.1% donation attribution, the 0% NDIS LGA bridge, and the 3.16-rows-per-key grain defect that
would make a choropleth lie. **Not one of those is visible in a force-directed graph. All four are
the top rows here.**

**Query** (`clarity_edge` plus the §4.4 amendments):

```sql
SELECT e.mechanism, e.src_object, e.src_column, e.tgt_object, e.tgt_column, e.declared,
       e.match_rate, e.match_numerator, e.match_denominator, e.match_method, e.match_measured_at,
       e.rows_at_stake, e.grain, e.note,
       round(coalesce(e.rows_at_stake, e.match_denominator, 0)
             * (1 - coalesce(e.match_rate, 0)))                        AS rows_losing,
       e.match_rate - h.match_rate                                     AS match_delta
  FROM clarity_edge e
  LEFT JOIN LATERAL (SELECT match_rate FROM clarity_edge_history x
                      WHERE x.edge_id = e.id AND x.captured_at <= $1::timestamptz
                      ORDER BY x.captured_at DESC LIMIT 1) h ON true
 WHERE e.mechanism <> 'view_lineage'
 ORDER BY (e.match_rate IS NULL), rows_losing DESC NULLS LAST;
```

**Broken sorts to the top and unmeasured sorts to the bottom.** A catalog that sorts by quality
descending buries its own worst finding on page two.

**States.** `match_rate IS NULL` → `+ not yet measured`, never `0`, with `[ measure it ]` that
enqueues rather than running inline (the 8-second ceiling makes an inline measure impossible on
anything large). Timeout → `?` with the method printed. `match_rate = 0` → `×` plus the full-width
explanation row, as drawn.

**Drill targets.** Row → S5 for either endpoint. `[ WANT #n → ]` → S9. `[ RENDER THE GRAPH ]` →
the client island (§5).

### 3.7 S7 · THE CROSS-SECTIONS — `/clarity/cross`

**Purpose.** The generative half. Cross-sections nobody wrote down.
**The question only this screen answers:** *"How do kinds of Australian organisation move money to
each other, and which of those flows has nobody looked at?"*

This is graft G3, and it is the answer to the winning direction's only structural ceiling: a
curated registry can only surface the opportunities someone already thought of.

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ CLARITY ▸ CROSS-SECTIONS       [ FLOW: how kinds fund kinds ]  [ JOIN: how domains connect ]   ║
║ 3,429,184 edges · 11 entity types · 10 relationship types · RELATIONSHIP [ ALL ▾ ]               ║
╠══════════════════════════════════════════════════════╤═══════════════════════════════════════════╣
║              ── TARGET ──▶                            │ WHAT THIS MATRIX CANNOT SAY               ║
║        comp  pers  char  fdn  prog  ic   se   gov  pol│                                           ║
║  comp  ▓▓▓▓  ░░░░  ████  ░░   ████  ░░   ░░   ██   ▓▓ │ Edge counts are complete.                 ║
║  pers  ████  ░░░░  ████  ▓▓   ░░    ▓▓   ░░   ░░   ▓▓ │ Dollars are not: `amount` is 77.43%       ║
║  char  ▓▓░░  ░░░░  ▓▓░░  ░░   ░░    ░░   ░░   ░░   ░  │ populated (2,655,257 of 3,429,184), so    ║
║  fdn   ░░    ░░    ░░    ░    ░     ░    ░    ·    ·  │ a $ cell is a FLOOR, never a total.       ║
║  prog  ████  ░░    ▓▓    ░    ░     ░    ░    ▓▓   ·  │                                           ║
║  gov   ████  ░░    ████  ░    ████  ▓▓   ░░   ▓▓   ░  │ ⚠ THE YEAR FILTER DROPS 30%. `year` is    ║
║  pol   ░░    ▓▓    ░░    ░    ░     ·    ·    ░    ▓▓ │ 69.66% populated; any year range silently ║
║  tr    ·     ·     ·     ·    ·     ·    ·    ·    ·  │ excludes 1,040,371 edges. The count is    ║
║  ?     ·     ·     ·     ·    ·     ·    ·    ·    ·  │ printed beside the slider.                ║
║                                                       │                                           ║
║  SELECTED   company ──contract──▶ charity             ├───────────────────────────────────────────╢
║  ┌──────────────────────────────────────────────────┐ │ ⚑ SENTINEL FIRED — CATEGORY NODES         ║
║  │ 41,882 edges · $2.1bn recorded, amount present   │ │ The two largest nodes in the entire graph ║
║  │ on 71% of edges                                  │ │ are entity_type='program':                ║
║  │ [ MINT THIS AS A QUESTION → ]                    │ │  "Specialised Supplies and Services"      ║
║  │ [ open these 41,882 in /graph ]                  │ │      330,460 edges                        ║
║  └──────────────────────────────────────────────────┘ │  "Specialised Support Services" 274,675   ║
║                                                       │ Together 605,135 edges = 17.6% of the     ║
║  · <100   ░ <10k   ▓ <100k   █ ≥100k    log scale     │ graph. These are AusTender CATEGORIES,    ║
║                                                       │ not organisations. Every centrality, power║
║  ⚑ THE DIAGONAL IS NOT SELF-FUNDING. company→company  │ score and "most connected" ranking that   ║
║    is inter-corporate flow; person→person is board    │ includes them is wrong.       [ TRIAGE → ]║
║    co-membership. Each diagonal cell prints its own   │ ⚑ "Department of Defence" appears TWICE   ║
║    definition.                                        │   in gs_entities. Duplicate hub.          ║
╚═══════════════════════════════════════════════════════╧═══════════════════════════════════════════╝
```

**Why a matrix.** 11 entity types × 11, filterable by 10 relationship types [R, measured
independently by two agents]. That is above Ghoniem's ~20-node threshold where matrices beat
node-link on every task except path-finding, and far below where a matrix becomes unreadable. It
has **zero hairball risk by construction** — it cannot degrade, only get denser. Two of the eleven
types are junk (`trust` 1 row, `unknown` 1 row); they render as a hairline row and column and are
labelled, not dropped. Dropping them would be the first small lie.

**`[ MINT THIS AS A QUESTION → ]` is the mechanism that breaks the ceiling.** Clicking a cell
pre-fills a `clarity_question` draft with its ingredients, its binding join, its measured coverage
and a required caveat, and drops it into the board as `state='draft'`. The registry stops being the
only source of cross-sections; the matrix becomes the machine and the registry becomes the
magazine.

**Query.** `SELECT * FROM mv_clarity_flow` (**deliverable**, §4.5), ≤1,210 rows, plus the join
matrix from `clarity_edge` × `clarity_object.domain` (≤196 cells). Both are server-rendered inline
SVG with no client JavaScript except the cell tooltip.

**The flow matrix must be a matview.** A live `GROUP BY` over 3.43M edges was measured at ~40
seconds [R], which is 5× the RPC ceiling.

**Second tab — the join matrix.** 14 × 14 domains, cell = the best measured match rate on any edge
between them, glyph-coded. Click `D8 → D1` and get the four edges connecting justice to the spine
with their measured rates. Click `D12 → D1` and get `+` with *"Media mentions are arrays of names,
not ids. No join exists to measure."*

**States.** Matview never refreshed → `?` on every cell and the exact refresh command. A dollar
measure selected while `edges_with_amount / edges < 1` → the cell prints "recorded, floor" with
the denominator, never a bare total.

### 3.8 S8 · WHAT CHANGED — `/clarity/changes`

**Purpose.** The estate's derivative. The screen that makes a silent loss impossible.
**The question only this screen answers:** *"What moved since I last looked, and is any of it
unexplained?"*

This is graft G2, and it is the one all three panels called non-negotiable.

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ CLARITY ▸ WHAT CHANGED     baseline ◀ 30 DAYS ▶     1,284 events in window · 1 with no reason  ║
╠════════════╤═════════════════════════════════════════════════════════════════════════════════════╣
║ TYPE       │ UNEXPLAINED · |Δ| > 10%, a zero crossing, a disappearance, or a state change        ║
║ ▢ row move │ × 02 APR  justice_funding    218,022 → 157,116   −27.9%   NO REASON RECORDED        ║
║ ▢ new      │           suspected dedup, unconfirmed              [ RECORD THE REASON → ]         ║
║ ▢ gone     │ · 09 AUG  gs_entities lga    253,648 → 294,214   +16.0%   LGA attribution rebuild   ║
║ ▢ state    │ · 09 AUG  stg_ratio_winners   15,353 →       0  −100.0%   staging truncate, normal  ║
║ ▢ refresh  │ × 13 AUG  mv_person_network   stale 5d → 6d               in NEITHER registry       ║
║ ▢ sentinel │                                                                                     ║
║ ▢ answer   │ ANSWER DRIFT · a headline moved >10% with no ingredient row-count change            ║
║   drift    │ · none in this window                                                               ║
║            │                                                                                     ║
║ SEVERITY   │ DRIFT · 90 days · objects (left) vs total rows (right)                              ║
║ ▢ critical │  1440┤                                       ╭──────────  1,433 objects             ║
║ ▢ warn     │  1200┤         ╭─────────────────────────────╯               52.3M rows ┈┈┈┈┈┈┈┈    ║
║ ▢ info     │   960┤─────────╯   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈                        ║
║            │      └──┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────  MAY → AUG                 ║
║ OBJECT     │      history begins 09 APR for 25 objects, 15 AUG for the other 1,408                ║
║ [ ⌕      ] ├─────────────────────────────────────────────────────────────────────────────────────╢
║            │ EVERYTHING · newest first                                                            ║
║            │ 15 AUG 03:14  NEW   stg_lga_probe          0 rows · scope unclassified               ║
║            │ 15 AUG 03:14  ▲     austender_contracts    821,139 → 823,620  +2,481  +0.30%         ║
║            │ 15 AUG 03:13  ?     acnc_ais               freshness probe deferred_too_large        ║
║            │ 15 AUG 03:12  ×     mv_person_network      refresh not attempted · no registry entry ║
║            │ 14 AUG 17:30  ·     44 matviews refreshed  4 fell back from CONCURRENTLY · 12m04s    ║
╚════════════╧═════════════════════════════════════════════════════════════════════════════════════╝
```

**The anomaly rule**, written by the nightly job into `clarity_event` with `severity='critical'`:
`|row_delta| / greatest(prev_row_count,1) > 0.10`, **or** the row count crosses zero in either
direction, **or** `missing_since` is set, **or** `state` changes, **or** a matview refresh is
skipped, **or** — the extension all three panels asked for — **`clarity_answer.headline` moves
more than 10% with no ingredient row-count change**, which is semantic drift and is the exact
failure mode a question board adds over an inventory.

An event stays `NO REASON RECORDED`, in red, on the front strip, until a human writes one. That is
the whole mechanism: one boolean column and a text box.

**Query:**

```sql
SELECT e.at, e.event_type, e.object_key, e.question_slug, e.metric_key,
       e.before_value, e.after_value, e.delta_pct, e.severity, e.note,
       e.reason, e.reason_by, e.reason_at,
       o.domain, o.row_count, o.object_kind
  FROM clarity_event e
  LEFT JOIN clarity_object o ON o.object_key = e.object_key
 WHERE e.at > $1::timestamptz
   AND coalesce(o.act_business, false) = false
 ORDER BY (e.severity = 'critical' AND e.reason IS NULL) DESC, e.at DESC
 LIMIT 300;
```

**The cold start, handled honestly (G11).** `clarity_object_history` has zero rows on the day the
migration is applied. Three mitigations, in order of honesty:

1. **`?` is the day-one default for every delta.** Not `0`, not a flat line. The baseline selector
   greys unavailable options with the reason.
2. **Backfill from real history.** `data_catalog_snapshots` holds **1,419 rows over 25 tables from
   2026-04-09 to 2026-08-13** [V] with `snapshot_at`, `row_count` and `freshness_hours`. One
   `INSERT … SELECT` gives the 25 spine objects — `gs_entities`, `justice_funding`,
   `austender_contracts`, `foundations` and friends — a genuine **four-month** chart on night one.
   The other 1,408 render `?` until the job has run. Real history where real history exists, an
   honest glyph everywhere else.
3. **Seed the three known events.** The documented 2026-04-02 row-moves (`justice_funding`
   −60,906, `gs_relationships` +124%, `political_donations` +744%) go into `clarity_event` with
   `note = 'reconstructed from thoughts/shared/handoffs/frontend-data-audit/db-inventory.md,
   2026-04-02'`, `severity='critical'`, `reason IS NULL`. They appear as unexplained anomalies on
   the first render, which is exactly what they are.

### 3.9 S9 · THE WANT LIST — `/clarity/wants`

**Purpose.** Every gap with a price and a payoff. The coverage bar, inverted.
**The question only this screen answers:** *"What is the cheapest thing we could do next, and what
does it unlock?"*

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ CLARITY ▸ THE WANT LIST     7 BLOCKED QUESTIONS · 4 fixes of effort S · none moved in 30d      ║
║ ranked by  questions unlocked × dollars made legible ÷ effort            FILTER ▾ effort · licence║
╠═══╤══════════════════════════════════╤═════════╤════════╤═══════════════════════════════════════╣
║ 1 │ ABS Indigenous population by LGA │ EFFORT S│ CC-BY  │ + abs_indigenous_population_by_lga     ║
║   │                                  │  +0/wk  │  4.0   │   is EMPTY. One download.              ║
║   │ UNLOCKS  OVER-REPRESENTATION and 3 more, and every per-capita Indigenous rate below state.   ║
║   │ WITHOUT IT  no Indigenous-focused map in either app is honest.                               ║
╟───┼──────────────────────────────────┼─────────┼────────┼───────────────────────────────────────╢
║ 2 │ Repair 3 board matviews          │ EFFORT S│  none  │ + mv_board_contractor_links   4 rows   ║
║   │                                  │  +0/wk  │        │ + mv_board_donor_links        2 rows   ║
║   │ …against mv_board_interlocks at 39,757 rows with the same columns. A predicate bug.          ║
║   │ UNLOCKS  DIRECTORS AND CONTRACTS + DIRECTORS AND DONORS — two flagship cross-sections.       ║
╟───┼──────────────────────────────────┼─────────┼────────┼───────────────────────────────────────╢
║ 3 │ Backfill 30,129 GrantConnect ABNs│ EFFORT S│ public │ MAKES LEGIBLE  $11.83bn / 68,175 awards║
║   │ from abr_registry                │         │        │ 99.97% of these ABNs exist in the ABR. ║
╟───┼──────────────────────────────────┼─────────┼────────┼───────────────────────────────────────╢
║ 4 │ Two data-integrity sentinels     │ EFFORT S│  none  │ MAKES PUBLISHABLE  GIVES AND TAKES     ║
║ 5 │ Rebuild gs_relationships         │ EFFORT M│  none  │ × source_record_id 0 of 49,426         ║
║   │   .source_record_id              │         │        │ UNLOCKS "click an edge, see the grant" ║
║ 6 │ BOCSAR + WA + TAS crime data     │ EFFORT M│ mostly │ + crime_stats_lga: WA 0, TAS 0 rows    ║
║ 7 │ ABS SA2 boundaries               │ EFFORT M│  open  │ + sa2_code on 14.4% of gs_entities     ║
╚═══╧══════════════════════════════════╧═════════╧════════╧═══════════════════════════════════════╝
```

**Every row is derived from a blocked question. Nothing here is hand-typed** beyond what the
question registry already required. The burn-down clause (`+0/wk`) is on every row: a want that
has not moved in 30 days becomes loud rather than quiet.

**Query:**

```sql
SELECT q.slug, q.stub, q.question, q.unlock_effort, q.unlock_note, q.unlock_dollars,
       q.blocked_by, q.licence_note,
       (SELECT count(*) FROM clarity_question x WHERE x.blocked_by && q.blocked_by) AS also_blocks,
       array_agg(jsonb_build_object('object', o.object_name, 'rows', o.row_count,
                                    'state', o.state) ORDER BY o.object_name)       AS blockers,
       w.value AS blocker_metric_now, w.prev_value AS blocker_metric_baseline
  FROM clarity_question q
  LEFT JOIN clarity_object o ON o.object_key = ANY(q.blocked_by)
  LEFT JOIN v_clarity_metric_latest w ON w.metric_key = q.blocked_by_metric
 WHERE q.state IN ('unanswerable','refused')
 GROUP BY q.slug, q.stub, q.question, q.unlock_effort, q.unlock_note, q.unlock_dollars,
          q.blocked_by, q.licence_note, w.value, w.prev_value
 ORDER BY (coalesce(q.unlock_dollars,0) + 1)
          * (SELECT count(*) FROM clarity_question x WHERE x.blocked_by && q.blocked_by)
          / CASE q.unlock_effort WHEN 'S' THEN 1 WHEN 'M' THEN 3 ELSE 9 END DESC;
```

**Contextual rendering (G15).** The same rows render wherever they block: on the object page for
every object in `blocked_by`, and on the question page for every question they block. *"A separate
gaps page is a page nobody opens; a want you cannot avoid reading is one you eventually close."*

### 3.10 The `refused` form — the most important state in the set

A refused question gets a full card **and** a full page and renders **no chart at all**.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◀ CLARITY   PLACE · JUSTICE                                    REFUSED     HONEST AT: STATE      │
│ DETENTION BY PLACE                                                                               │
│ What is the youth detention rate in this LGA?                                                    │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│   THIS VIEW REFUSES TO RENDER.                                                                   │
│                                                                                                  │
│   An LGA choropleth of youth detention would be a fabrication. The source                        │
│   ▣ aihw_youth_justice_stats holds 13 rows, one year, source_table = 'PDF_HEADLINE',             │
│   and the Northern Territory is missing entirely. AIHW publishes state-level,                    │
│   quarterly, roughly two quarters lagged, by design.                                             │
│                                                                                                  │
│   WHAT WE CAN HONESTLY SHOW INSTEAD                                                              │
│     ▸ state ÷ LGA framing, labelled as such                                                      │
│     ▸ WATCHHOUSE CHILDREN — facility-level, near-daily, ~1 day lagged. Police custody, not       │
│       detention. Not comparable to AIHW figures without saying so.                               │
│                                                                                                  │
│   WHAT WOULD MAKE THIS ANSWERABLE                                                                │
│     + per-LGA detention counts. EFFORT L. Nothing cheap exists.        [ WANT LIST → ]           │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

A refusal that **continues the journey** is the anti-dead-end pattern in its purest form, and it is
the only place in either repo where a refusal has its own URL. Making it a first-class rendered
object is how the discipline becomes a product feature instead of a rule someone has to remember.

---

## 4. THE DATA LAYER

### 4.1 Carried unchanged from `clarity-data-layer.md`

Three migration files exist, unapplied, and this spec does not re-specify or modify them [V]:

| File | Contents |
|---|---|
| `supabase/migrations/20260815000000_clarity_catalog_schema.sql` | 5 enums, 9 tables (`clarity_object`, `clarity_freshness_candidate`, `clarity_column`, `clarity_edge`, `clarity_code_ref`, `clarity_object_history`, `clarity_gap_metric`, `clarity_gap_measurement`, `clarity_metric_definition`), `v_clarity_ledger` |
| `supabase/migrations/20260815000100_clarity_refresh_function.sql` | `clarity_refresh()`, `clarity_score()`, `clarity_set_probe()`, `clarity_measure_gaps()` |
| `supabase/migrations/20260815000200_clarity_gap_metrics_seed.sql` | 23 gap metrics with executable SQL, the metric-conflict registry, the 221-name D14 exclusion seed |

**The ranking formula** (`clarity_score()`) is carried verbatim:

```
importance =
  ( 0.20 · ln(rows)/ln(max_rows)        + 0.10 · ln(bytes+1)/ln(max_bytes+1)
  + 0.26 · ln(1+degree)/ln(41)          + 0.18 · ln(1+refs_app)/ln(26)
  + 0.12 · ln(1+refs_script+refs_db_function+lineage_in)/ln(26)
  + 0.14 · recency_band )
  × state_penalty     -- backup .05 · staging .10 · superseded .15 · empty .25 · tiny .60 · live 1.0
  × lifecycle_weight  -- core_source 1.0 · derived/crosswalk .95 · lens .85 · app_operational .60
                      --   scaffold_empty .30 · staging .25 · superseded .20 · backup .10 · routine .50
  × (act_business ? 0.50 : 1.0)
```

Two honest weaknesses it declares, both of which the UI answers rather than the maths: `abr_registry`
sits at **rank 56** because no product surface reads it (fixed by `FEEDS 0` sorting and first-class
sort-by-rows), and **the highest-ranked view is #183** (fixed by the four ranked strips).

**The 23 gap metrics** are carried with their measured values. The eight that drive the HOUSE
subject and the estate strip:

| # | Metric | Today | Target |
|---|---|---|---|
| 1 | objects with a written purpose | 812 / 1,433 = 56.7% | ≥95% |
| 2 | objects with a governance row | 25 / 1,433 = 1.7% | ≥50% |
| 5 | matviews in no scheduled refresh | 71 / 98 = 72.4% (2,871,838 rows) | ≤10 |
| 6 | matviews stale > 48h | 70 / 98 = 71.4% | ≤10 |
| 8 | dark objects (populated, nothing reads them) | **184 objects / 5,087,126 rows** — corrects "290 / 14.9M" | ≤100 |
| 10 | justice edge → grant drill-through | **0 of 49,426 = 0.0%** | ≥50% |
| 13 | ABN attribution, donations | 25.1% | ≥60% |
| 17 | relations readable with the public anon key | 451 / 1,024 = 44.0% | ≤50 |

**One flip that must happen in lockstep.** Metric 5 measures "unscheduled" by parsing matview names
out of `refresh_civicgraph_mvs().prosrc`. The parallel session's `2026-08-14-mv-refresh-cron.sql`
rewrites that function to read `mv_refresh_plan()`, after which its body contains **no matview
names at all** and metric 5 would report a confident, wrong **98 of 98**. The successor,
`matviews_unregistered`, ships `enabled = false` because `mv_refresh_registry` does not exist yet
[V]. **Flip the pair in the same change that applies their migration.**

### 4.2 Apply order and the cross-session collision

Five unapplied migrations from a parallel session exist at `migrations/2026-08-14-*.sql` [V]. Three
intersect this work and **theirs wins**:

- `mv-refresh-registry.sql` + `mv-refresh-cron.sql` implement Ben's decision 2 better than the
  data-layer document proposed: a `mv_refresh_registry` table with tiers, plus `mv_refresh_plan()`
  deriving refresh order from `pg_depend` **through plain views**, which catches ordering
  constraints that direct matview→matview edges miss. `/clarity` **watches** this; it does not
  rewrite it.
- `catalog-object-scope.sql` implements Ben's decision 1 better than a boolean: four values
  (`civic`, `act_private`, `act_private_review`, `platform`), 326 seeded rows (the 237 census
  candidates plus the 89 pure-ACT views the census never saw), and the rule that an unclassified
  object is **visible and flagged, never hidden**. `clarity_object.act_business` is **derived from
  it** by a three-line `UPDATE … FROM`, with the name rule kept only as a fallback so a `xero_*`
  table created next month cannot reach a civic surface by default.

**Apply order** (all Tier 3; Ben applies, this spec only authors):

```
their registry → their cron → their scope table → their revokes → their policy fix
  → 20260815000000 clarity_catalog_schema
  → 20260815000100 clarity_refresh_function
  → 20260815000200 clarity_gap_metrics_seed        (with the metric 5 → 5b flip)
  → 20260815000300 clarity_question_registry       (§4.3, new)
  → 20260815000400 clarity_change_log              (§4.4, new)
  → 20260815000500 clarity_edge_amendments         (§4.5, new)
  → 20260815000600 clarity_flow_matrix             (§4.6, new)
```

Apply command, identical in shape for every file (`gsql.mjs -c` mangles `$$` dollar-quoting, so
`psql -f` only):

```bash
cd /Users/benknight/Code/grantscope && source .env && \
PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
  -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
  -f supabase/migrations/<file>.sql
```

### 4.3 New — `20260815000300_clarity_question_registry.sql`

The Interrogator's registry, **with the primary-key bug fixed** and `draft` added as a state so the
matrix can mint questions (G3).

```sql
CREATE TYPE clarity_question_state AS ENUM
  ('draft','answered','contested','unanswerable','refused','retired');
CREATE TYPE clarity_form_kind AS ENUM
  ('scalar','ranked_bar','stacked_three','matrix','timeseries','refused');
CREATE TYPE clarity_publishable AS ENUM ('public','shareable','internal');
CREATE TYPE clarity_honest_at   AS ENUM
  ('national','state','lga','postcode','facility','entity','person_block','abn','none');
CREATE TYPE clarity_effort      AS ENUM ('S','M','L');

CREATE TABLE clarity_question (
  slug                text PRIMARY KEY,
  stub                text NOT NULL,       -- 2-4 words, uppercase in the UI
  question            text NOT NULL,       -- the sentence, sentence case, DM Sans
  subject             text NOT NULL,       -- JUSTICE MONEY CHARITY POWER PLACE EVIDENCE HOUSE
  state               clarity_question_state NOT NULL,
  form                clarity_form_kind      NOT NULL,
  honest_at           clarity_honest_at      NOT NULL,
  publishable         clarity_publishable    NOT NULL DEFAULT 'internal',
  defamation_sensitive boolean NOT NULL DEFAULT false,
  verification_stamp  text CHECK (verification_stamp IN ('verified','unverified','pilot')),

  -- the four things a claim may never ship without
  caveat              text NOT NULL CHECK (length(btrim(caveat)) > 20),
  exclusions          text NOT NULL,       -- the DETERMINISTIC filter, printed in the caption
  claim_phrasing      text NOT NULL,       -- the sentence the UI is allowed to render
  forbidden_phrasing  text[] NOT NULL DEFAULT '{}',

  -- the executable half
  answer_sql          text,                -- returns ONE jsonb payload row
  rows_sql            text,                -- must accept LIMIT/OFFSET
  coverage_sql        text,                -- returns (numerator, denominator, label)
  refuses_when        text,
  live_rerun_ok       boolean NOT NULL DEFAULT false,   -- set by the runner from measured ms
  measured_ms         integer,

  -- blocked questions
  blocked_by          text[] NOT NULL DEFAULT '{}',     -- clarity_object.object_key
  blocked_by_metric   text REFERENCES clarity_gap_metric(metric_key),
  unlocks_questions   text[] NOT NULL DEFAULT '{}',
  unlock_effort       clarity_effort,
  unlock_note         text,
  unlock_dollars      numeric,
  licence_note        text,
  uniqueness          numeric NOT NULL DEFAULT 0.5 CHECK (uniqueness BETWEEN 0 AND 1),
  uniqueness_basis    text,                -- WHY we believe no public source does this

  surface             text,                -- '/atlas', '/graph', or null = unlanded
  reach_score         numeric,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- a question is either executable or explicitly blocked. Never silently neither.
  CONSTRAINT executable_or_blocked CHECK (
    (state IN ('answered','contested') AND answer_sql IS NOT NULL)
    OR (state IN ('unanswerable','refused') AND array_length(blocked_by,1) >= 1)
    OR state IN ('draft','retired')
  ),
  -- a blocked question must state what unblocking costs
  CONSTRAINT blocked_has_a_price CHECK (
    state NOT IN ('unanswerable','refused')
    OR (unlock_effort IS NOT NULL AND unlock_note IS NOT NULL)
  )
);

CREATE TABLE clarity_question_ingredient (
  question_slug   text NOT NULL REFERENCES clarity_question(slug) ON DELETE CASCADE,
  object_key      text NOT NULL,
  -- FIX (judge-build): a table PRIMARY KEY takes a COLUMN LIST, never an expression.
  -- The original `PRIMARY KEY (question_slug, object_key, coalesce(join_key,''))`
  -- fails at parse and would have blocked the whole first slice.
  join_key        text NOT NULL DEFAULT '',
  role            text NOT NULL CHECK (role IN ('spine','fact','reference','filter','denominator')),
  is_binding      boolean NOT NULL DEFAULT false,
  measured_pct    numeric,
  measured_at     timestamptz,
  PRIMARY KEY (question_slug, object_key, join_key)
);
-- exactly one binding ingredient per question. Without this, a question with a 94% join
-- and a 12.9% join renders the 94%.
CREATE UNIQUE INDEX clarity_one_binding
  ON clarity_question_ingredient (question_slug) WHERE is_binding;

CREATE TABLE clarity_answer (
  id             bigserial PRIMARY KEY,
  question_slug  text NOT NULL REFERENCES clarity_question(slug) ON DELETE CASCADE,
  computed_at    timestamptz NOT NULL DEFAULT now(),
  ok             boolean NOT NULL,
  error_text     text,
  payload        jsonb,          -- the form's data; shape declared per form kind
  headline       text,           -- '85.1%'
  headline_sub   text,           -- '662 of 778 organisations'
  headline_num   numeric,        -- the machine-comparable value, for drift detection
  coverage_num   numeric,
  coverage_den   numeric,
  coverage_label text,
  sentinel_flags jsonb NOT NULL DEFAULT '{}',
  row_count      bigint,
  duration_ms    integer
);
CREATE INDEX clarity_answer_latest ON clarity_answer (question_slug, computed_at DESC);

CREATE TABLE clarity_sentinel (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  description text NOT NULL,
  probe_sql   text NOT NULL,     -- returns (tripped bool, n bigint, share numeric, detail jsonb)
  severity    text NOT NULL CHECK (severity IN ('block','warn')),
  applies_to  text[] NOT NULL DEFAULT '{}'   -- question slugs; empty = global
);

CREATE VIEW v_clarity_board WITH (security_invoker = true) AS
SELECT q.*, a.headline, a.headline_sub, a.headline_num, a.coverage_num, a.coverage_den,
       a.coverage_label, a.computed_at, a.ok, a.error_text, a.sentinel_flags, a.duration_ms
  FROM clarity_question q
  LEFT JOIN LATERAL (SELECT * FROM clarity_answer x
                      WHERE x.question_slug = q.slug ORDER BY x.computed_at DESC LIMIT 1) a ON true
 WHERE q.state <> 'retired';
GRANT SELECT ON v_clarity_board TO service_role;
```

`headline_num` is new and load-bearing: it is what the answer-drift anomaly rule (G2) compares
between nightly runs. A text headline cannot be diffed numerically.

**The three sentinels that ship armed in slice 2**, each traceable to a confirmed finding:

| key | fires when | severity | why |
|---|---|---|---|
| `receipt_type_contamination` | `share of political_donations.amount where receipt_type <> 'donation received'` > 0.5 | **block** | 85.3% of the dollars are `other receipt` [R, V21] |
| `contract_value_ceiling` | any `austender_contracts.contract_value` > $5bn | **block** | 13 rows carry 29.4% of all recorded value; max is Hays Specialist Recruitment, Treasury, **$123.00bn** [R, V22/V23] |
| `category_node_hub` | any `gs_entities` row with `entity_type='program'` and degree > 10,000 | **block** on any question reading centrality | 2 entities, 605,135 edges, 17.6% of the graph [R, verified structurally by two agents] |

### 4.4 New — `20260815000400_clarity_change_log.sql`

```sql
CREATE TYPE clarity_event_kind AS ENUM
  ('row_moved','object_new','object_missing','state_change','scope_change',
   'refresh_skipped','sentinel_fired','metric_crossed','probe_degraded','answer_drift');

CREATE TABLE clarity_delta (
  object_key    text NOT NULL,
  baseline      text NOT NULL CHECK (baseline IN ('last','7d','30d','90d')),
  row_delta     bigint,
  row_delta_pct numeric(8,3),
  bytes_delta   bigint,
  degree_delta  integer,
  importance_delta numeric(8,4),
  freshness_delta_hours numeric,
  state_change  text,
  is_new        boolean NOT NULL DEFAULT false,
  is_missing    boolean NOT NULL DEFAULT false,
  baseline_at   timestamptz,          -- null => history is thinner than the baseline => render '?'
  computed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (object_key, baseline)
);

CREATE TABLE clarity_event (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  event_type    clarity_event_kind NOT NULL,
  object_key    text,
  question_slug text,
  metric_key    text,
  before_value  numeric,
  after_value   numeric,
  delta_pct     numeric(8,3),
  severity      text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','critical')),
  note          text,                 -- machine-written provenance
  reason        text,                 -- human-written. NULL on a critical event is the alarm.
  reason_by     text,
  reason_at     timestamptz
);
CREATE INDEX clarity_event_at        ON clarity_event (at DESC);
CREATE INDEX clarity_event_unexplain ON clarity_event (at DESC)
  WHERE severity = 'critical' AND reason IS NULL;

-- the latest measurement per gap metric, with `breached` computed once
CREATE VIEW v_clarity_metric_latest WITH (security_invoker = true) AS
SELECT DISTINCT ON (g.metric_key)
       g.metric_key, g.title, g.question, g.family, g.unit, g.direction, g.target,
       g.enabled, g.note, m.measured_at, m.numerator, m.denominator, m.value,
       m.status, m.duration_ms,
       CASE WHEN g.target IS NULL THEN NULL
            WHEN g.direction = 'higher_better' THEN m.value < g.target
            ELSE m.value > g.target END AS breached
  FROM clarity_gap_metric g
  JOIN clarity_gap_measurement m USING (metric_key)
 ORDER BY g.metric_key, m.measured_at DESC;
GRANT SELECT ON v_clarity_metric_latest TO service_role;

-- gap metrics need two columns the original seed did not have
ALTER TABLE clarity_gap_metric
  ADD COLUMN IF NOT EXISTS names_objects text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS board_slot    text CHECK (board_slot IN ('estate','house','hidden'));

CREATE TABLE clarity_null_reason (
  object_key   text NOT NULL,
  column_name  text NOT NULL,
  reason_label text NOT NULL,
  reason_sql   text NOT NULL,       -- returns one bigint; capped at 3s, '?' on timeout
  PRIMARY KEY (object_key, column_name, reason_label)
);
```

`clarity_delta` is written nightly for all four baselines, so every delta on every screen is one
indexed read instead of a join to history. `baseline_at IS NULL` is the signal to render `?`.

### 4.5 New — `20260815000500_clarity_edge_amendments.sql`

```sql
ALTER TABLE clarity_edge
  ADD COLUMN IF NOT EXISTS rows_at_stake bigint,   -- the fact-side row count this seam should carry
  ADD COLUMN IF NOT EXISTS grain         text;     -- '1:1' | 'n:1' | 'frayed 3.16 rows/key'

CREATE TABLE clarity_edge_history (
  id          bigserial PRIMARY KEY,
  edge_id     bigint NOT NULL REFERENCES clarity_edge(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  match_rate  numeric(6,3),
  match_numerator bigint,
  match_denominator bigint,
  rows_at_stake bigint
);
CREATE INDEX clarity_edge_hist ON clarity_edge_history (edge_id, captured_at DESC);
```

Note the join key is `edge_id` against `clarity_edge.id` (a `bigserial` that already exists [V]),
not an invented `edge_key`.

### 4.6 New — `20260815000600_clarity_flow_matrix.sql`

```sql
-- Max size: 11 source types × 11 target types × 10 relationship types = 1,210 rows.
-- Must be a matview: the live GROUP BY over 3,429,184 edges was measured at ~40s,
-- which is 5x the 8-second PostgREST ceiling.
CREATE MATERIALIZED VIEW mv_clarity_flow AS
SELECT s.entity_type                                AS source_type,
       t.entity_type                                AS target_type,
       r.relationship_type,
       count(*)                                     AS edges,
       count(*) FILTER (WHERE r.amount IS NOT NULL) AS edges_with_amount,
       sum(r.amount)                                AS amount_recorded,
       count(*) FILTER (WHERE r.year IS NOT NULL)   AS edges_with_year,
       count(DISTINCT r.source_entity_id)           AS distinct_sources,
       count(DISTINCT r.target_entity_id)           AS distinct_targets,
       min(r.year) AS year_min, max(r.year) AS year_max
  FROM gs_relationships r
  JOIN gs_entities s ON s.id = r.source_entity_id
  JOIN gs_entities t ON t.id = r.target_entity_id
 GROUP BY 1,2,3;
CREATE UNIQUE INDEX ON mv_clarity_flow (source_type, target_type, relationship_type);
-- Register in mv_refresh_registry (tier='nightly') once that table exists.
-- Do NOT hardcode it into any list.
```

`edges_with_amount` and `edges_with_year` are not decoration: they are what let a cell print
*"$2.1bn recorded, amount present on 71% of edges"* instead of a total that reads as complete, and
*"a year filter silently excludes 1,040,371 edges"* beside the slider. `amount` is **77.43%**
populated and `year` is **69.66%** [R, measured].

### 4.7 The runner

`scripts/snapshot-clarity.mjs`, nightly, on the same lane as `refresh-views-v2.mjs`. **Never a
Vercel cron** — those are HTTP requests, and a 4.5-minute plpgsql call under a shared pooler is not
a safe serverless request.

```
1. psql -c "SELECT * FROM clarity_refresh();"                          ~2.5 min
2. per-object re-probe where row_count_probe='deferred_too_large'      ~2 min
     one statement each, SET statement_timeout='3s', then clarity_set_probe(...)
     (the ONLY place a per-object timeout can actually fire — SET LOCAL inside
      plpgsql provably cannot cancel a running query)
3. node scripts/scan-code-references.mjs → clarity_code_ref
     MUST exclude node_modules, .next, dist, _archive, *.disabled, database.types.ts
     MUST count DISTINCT FILES, never hits
4. psql -c "SELECT clarity_score();"                                   seconds
5. psql -c "SELECT * FROM clarity_measure_gaps('cheap');"              seconds
     weekly: clarity_measure_gaps(NULL), including the two expensive ABN metrics (~5 min)
6. compute clarity_delta for all four baselines; emit clarity_event per the anomaly rule
7. node scripts/run-clarity-answers.mjs                                <1 min
     per question: one statement with SET statement_timeout='30s'
     → clarity_answer; set measured_ms and live_rerun_ok = (measured_ms < 5000)
     per ingredient: coverage_sql → measured_pct
     per sentinel: probe_sql → fan into every applicable answer's sentinel_flags
     recompute reach_score; emit answer_drift events
8. refresh mv_clarity_flow; write clarity_edge_history
9. log to agent_runs via scripts/lib/log-agent-run.mjs
```

Measured budget: **≈4.5 minutes** for the catalog sweep [R], plus <1 minute for ~26 answers
extrapolated from three real measurements spanning 196 ms to 3,076 ms [R]. Register with
`INSERT INTO agent_schedules (agent_id, interval_hours, enabled, freshness_threshold_hours, …)
VALUES ('snapshot-clarity', 24, true, 26, …)`.

`/api/clarity/rescore` exists only as an admin-triggered `SELECT clarity_score()` — sub-second,
safely inside the ceiling. **It must never call `clarity_refresh()`.**

---

## 5. VISUALISATION CHOICES, LIBRARY BY LIBRARY, WITH THE HONEST LIMIT

**Dependencies added: zero.** Verified against `apps/web/package.json` [V].

| View | Form | Library | Honest limit |
|---|---|---|---|
| Card sparklines, coverage bars, nullity strips, burn-down bars | inline SVG, ~25 lines per component, Server | none | Mounting 1,433 recharts instances is not an option; this is why it is inline SVG |
| `scalar`, `ranked_bar`, `stacked_three` answer forms | inline SVG, Server | none | ~40 bars before it needs its own scroll container [I] |
| `timeseries` answer form + the sample-size track | **recharts ^3.7.0** (installed) | recharts | ~2,000 points per series before SVG rendering degrades [I, not measured]. All current series are far below |
| Flow matrix (11×11×10) and join matrix (14×14) | inline SVG `<rect>` grid, Server | none | ≤1,210 and ≤196 cells, both bounded by construction. ~2,500 rects before the SSR payload hurts [I]. **Zero hairball risk: a matrix cannot degrade, only get denser** |
| The ledger (1,433 rows × ~30 fields) | plain DOM table, one client island filtering in memory | none | Plain DOM is comfortable to ~2,000 rows at 22px [I]. We are under it, which is why **no virtualisation dependency is needed** |
| The seams table (~1,415 rows) | plain DOM table, Server | none | Same bound |
| Column profiles | plain DOM, ≤60 rows per object | none | Bounded per object. The 14,310-row flat list is **cut** (§1.5), which is what keeps this dependency-free |
| The seam graph, behind `[ RENDER ]` | **react-force-graph-2d ^1.29.1** (installed) | force graph | **Hard cap 150 nodes; refuses above 200** with the reason printed and an escape hatch that states what it will drop. Measured basis: a 2-hop entity neighbourhood is ~2,345 nodes and is not drawable [R]; the schema graph is 140 nodes and 318 edges |
| Maps | **none in `/clarity`** | — | Place hands off to `/atlas`, which owns leaflet and a nine-layer registry |
| Entity networks | **none in `/clarity`** | — | `/graph` has nine modes of it already |

**Two mandatory implementation rules**, both from mistakes already made in this repo:

1. **`dynamic(() => import('react-force-graph-2d'), { ssr: false })` goes INSIDE the `'use client'`
   file**, and the Server page imports that client wrapper normally. Client Components are still
   server-rendered for the initial HTML, and the library touches `window` at module scope. Both
   existing usages in this repo do it correctly [R, verified by a second agent]; one of the three
   designs asserted the opposite and would have crashed on first render.
2. **`getDirectServiceSupabase()`, never `getServiceSupabase()`.** The latter sniffs the call stack
   for `/app/reports/` and returns a snapshot stub that resolves to null — a silent `[]`
   [R, memory]. Every export in `lib/clarity/*` takes a client parameter; the pages pass the direct
   client.

**Layout stability (G18).** The nightly sweep runs the force simulation once, offline, and writes
`layout_x` / `layout_y`. The graph receives `fx`/`fy` pre-set and runs zero simulation ticks on
load. Dragging is local and discarded on navigation. There is a `[ re-run layout ]` admin action
and it is not automatic. Nothing moves unless the data moved, and when it moves it is marked for
one day. (This needs two `real` columns added to `clarity_object` — a three-line follow-up
migration, listed as a slice-5 deliverable.)

**Performance budget.** No screen query touches `gs_entities`, `gs_relationships`,
`austender_contracts`, `abr_registry`, `political_donations` or `asic_companies`. All expensive
measurement happens in the nightly job. `revalidate = 300` on every screen (the underlying snapshot
changes once a night); the answer re-run and the rows page are uncached.

| Screen | Queries | Largest row set | Payload | TTFB target [I] |
|---|---|---|---|---|
| Estate strip | 1 | 1,433 → 9 scalars | 1 KB | 80 ms |
| S1 board | 1 | ~26 | ~20 KB | 200 ms |
| S2 answer | 4 small | ~30 | ~25 KB | 200 ms |
| S3 rows | 1, stored SQL | ≤50 per page | ~30 KB | 400 ms |
| S4 ledger | 1 | 1,433 × ~34 | **~300 KB inline in the RSC payload** | 400 ms |
| S5 object | 6 small | ~300 | ~40 KB | 150 ms |
| S6 seams | 1 | ~1,415 | ~180 KB | 300 ms |
| S7 cross | 2 | ≤1,210 + ≤196 | ~90 KB | 200 ms |
| S8 changes | 2 | ≤300 events | ~60 KB | 250 ms |
| S9 wants | 1 | ≤25 | ~10 KB | 120 ms |

---

## 6. THE BUILD SEQUENCE

Seven vertical slices. Each ships something usable on its own and none depends on a later one.

### Slice 1 — THE LEDGER · ~3.5 days · **the right first thing**

Ships `/clarity` (redirecting to `/clarity/data` until slice 2), `/clarity/data`,
`/clarity/data/[object]`, the estate strip, the rail, the admin gate, the glyph alphabet and
`glyph-coverage.test.ts`. Backed by: applying the three existing migrations plus §4.4's change log,
writing `scripts/snapshot-clarity.mjs`, the `data_catalog_snapshots` backfill and the three seeded
events, and three nights of burn-in before any UI is written.

**Defence — why the ledger and not the question board.**

1. **It is the literal request.** Ben asked for an overview page that lists absolutely every piece
   of data. Screen one delivers it on day one, not in slice 2.
2. **It is 100% derived, so it cannot be half-done.** Zero curation debt, zero hand-written SQL,
   zero empty cards. Every column comes from the nightly sweep. The dominant failure mode of the
   winning direction is *"three weeks in we have 3 questions and 23 empty cards"*, and leading with
   the derived half removes it entirely.
3. **History cannot be backfilled later.** Every delta, sparkline, anomaly and burn-down in slices
   3 onwards depends on `clarity_object_history` having rows, and the only rows that can ever be
   recovered are the 25 spine tables in `data_catalog_snapshots` (four months, verified [V]). Every
   night this does not run is a night of history the whole design cannot get back.
4. **It de-risks everything else.** `clarity_refresh()` **has never been executed by anyone**, and
   `clarity_object` does not exist [V]. If the 4.5-minute job is fragile under the shared pooler, we
   find that out in slice 1 with one screen at stake, not in slice 4 with four.
5. **It answers a question Ben has today.** 71 of 98 matviews in no refresh registry. 184 dark
   objects holding 5,087,126 rows. 14 backup tables holding ~1.54M rows. 451 of 1,024 relations
   readable with the public anon key. None of that is visible anywhere in either app right now.

**The trade, stated.** This inverts the winning design's own slice order and delays the vision half
by about four days. `judge-insight` penalised the Instrument precisely for putting the vision last,
so the guard is explicit: **if slice 2 has not shipped within 10 working days of slice 1, the
surface has become an inventory and the direction has failed.** Slice 2 is not optional and it is
not "later".

### Slice 2 — THE BOARD · ~4 days

The question registry migration (§4.3, with the PK fix), `scripts/run-clarity-answers.mjs`,
**three questions end to end** — `evidence-gap`, `bidder-fragility`, `watchhouse-children`, all
three measured under 300 ms and one of them independently reproduced exactly [R] — the board,
the worked answer page with `scalar` + `ranked_bar`, the rows page, `[ COPY THE CLAIM ]`, the
phrasing CI guard, and `FEEDS`/`BLOCKS` lighting up on the slice-1 ledger for free.

**Not 26 questions.** Three end to end beats twenty-six half-written, and the board's own state
model makes the remainder visible as `draft` rather than absent.

### Slice 3 — WHAT CHANGED · ~2 days

`/clarity/changes`, `clarity_delta` populated for all four baselines, the anomaly rule including
answer drift, the global baseline selector, the burn-down clause on every coverage number, and the
`[ RECORD THE REASON → ]` write path. The day this ships, the `justice_funding` class of silent
loss becomes impossible.

### Slice 4 — THE CROSS-SECTIONS · ~2 days

`mv_clarity_flow`, `/clarity/cross` with the flow matrix and the join matrix, cell → `[ MINT THIS
AS A QUESTION → ]`, and the category-node sentinel firing on the front board. This is the slice
that breaks the 26-question ceiling and surfaces a live defect that invalidates every centrality
score in the product.

### Slice 5 — THE SEAMS · ~2 days

The `clarity_edge` amendments, `/clarity/seams` as a ranked table, the graph behind `[ RENDER ]`
with its refusal and escape hatch, `/api/clarity/graph`, `layout_x`/`layout_y`, and marking
`/api/data/schema-graph` superseded (§2.4).

### Slice 6 — THE WANT LIST AND THE HOUSE · ~2 days

`/clarity/wants` derived entirely from blocked questions, contextual want rendering on objects and
questions, and the **HOUSE** subject: the 23 gap metrics registered as questions about ourselves
with their targets, so *"71 of 98 matviews are in no refresh registry"* becomes a contested card
with an adjudication CTA. This is where Ben's decision 2 finally has a home on a screen.

### Slice 7 — FILL THE REGISTRY · ~3 days, and ongoing

The remaining 23 questions with their sentinels, the `refused` form, the `stacked_three` and
`matrix` forms, `UNVERIFIED` and `PILOT` stamps, the isolate panel and system-coverage strip, and
the null-reason registrations.

**Total ≈ 18.5 days.** Slices 1–2 are the minimum that satisfies both halves of the literal
request. Slice 3 is what stops it becoming the fourth artefact in this repo to look authoritative
while going quietly stale. Slice 4 is what makes it Ben's project rather than a good internal tool.

---

## 7. WHAT THIS DELIBERATELY DOES NOT DO

1. **No maps.** `/atlas` owns place with a nine-layer registry that is the best-engineered surface
   in either repo. Every place-shaped question hands off to it.
2. **No entity network.** `/graph` has nine modes of it and `/entity/[gsId]` has a network tab. By
   this exercise's own count, at least five things called some variant of "power map" already
   exist across the two repos. A sixth belongs in nobody's roadmap.
3. **No record-level provenance drill.** The flagship path — click an edge, see the grant — is
   **0 of 49,426 = 0.0%**, a dead key namespace. Building a ladder to a missing rung is worse than
   not building the ladder. It is named on the seams screen, priced on the want list at effort M,
   and refused where it would be clicked.
4. **No flat list of 14,310 columns.** Columns are shown per object and searched through an API.
   This is the single decision that keeps the dependency count at zero.
5. **No new dependency.** Not `d3-sankey`, not `topojson-client`, not `@tanstack/react-virtual`,
   not `nuqs`. All four are absent from `apps/web/package.json` [V] and none is needed by anything
   above.
6. **No public surface, and not in the nav.** `/clarity` was killed for being SaaS-shaped; this
   ships admin-gated, which honours that decision instead of reversing it.
7. **No mobile.** 1280px minimum, stated on the screen below that width, which degrades to the
   ledger and the rail. A stated degradation beats silently reflowing a dense grid into a column.
8. **It does not apply a single migration.** Every migration in §4 is a deliverable, left unapplied,
   with the apply command in its header. Applying them, and deleting the orphaned route, are Tier 3
   and need Ben's explicit verb.
9. **It does not touch the matview refresh cron.** Decision 2 is implemented by the parallel
   session's migrations, better than the data-layer document proposed. `/clarity` watches it and
   reports on it; it does not rewrite a running production job.
10. **It does not rebuild `source_record_id`, backfill 30,129 GrantConnect ABNs, or repair the
    three board matviews.** Those are the top of the want list. The surface's job is to make them
    unavoidable, not to do them.
11. **It does not delete anything, ever.** No verdict means drop. A disappeared object gets
    `missing_since` set and keeps its history, because deleting the row deletes the evidence that
    it vanished. A `cruft` verdict is refused by a database CHECK while anything still reads the
    object — the constraint that encodes the 19-live-objects error so it cannot recur.
12. **It does not print a dollar figure without its denominator**, a rate below its population
    floor, or a year filter without the count of rows that filter silently excludes.
13. **It does not catalogue JusticeHub's 480 routes or its pipelines.** The uncommitted
    `data-observatory` owns sources and pipelines; `/clarity` owns the database. Coordinate before
    slice 0; do not build over it.
14. **It does not use embeddings for relatedness.** Measured: 11.3 s for a single `gs_entities` ANN
    search at `probes=1`, on a 2,846 MB index over a column that is 22% populated, and the
    neighbours are lexical anyway [R]. Relatedness is structural: shared downstream views,
    co-reference in the same source file, declared joins. Free, exact, and every result carries a
    citable reason.
15. **It does not promise a number it has not measured.** Everything on every screen comes from a
    snapshot table written by a job whose cost is recorded, and every screen can show the SQL that
    produced it.

---

## 8. VERIFICATION REGISTER

**Verified by me this session [V].** That `apps/web/src/app/clarity` does not exist; that
`clarity_object`, `catalog_object_scope` and `mv_refresh_registry` do not exist in the database and
`data_catalog`, `data_catalog_snapshots` and `mv_refresh_log` do (`to_regclass`); that
`data_catalog_snapshots` holds 1,419 rows over 25 tables from 2026-04-09 to 2026-08-13 with the
seven columns listed; that `mv_refresh_log` holds 2,260 rows over 44 distinct matviews with a last
finish of 2026-08-13 17:30 UTC; the full DDL of `20260815000000_clarity_catalog_schema.sql`
including every column name used in every query above; that `/api/data/schema-graph/route.ts` is
280 lines with zero consumers in `apps/web/src` or `scripts/`, filters `n_live_tup > 0` at line 109
and drops unclassified tables at line 151; the installed viz libraries and the absence of d3,
`@tanstack/react-virtual` and topojson; `requireAdminPage` at `admin-auth.ts:40` and the
seven-line `ops/layout.tsx`; the `.ws` theme at `globals.css:116`; the presence of the three
unapplied `clarity_*` migrations and the five unapplied `migrations/2026-08-14-*` files.

**Relayed from documents in this exercise that mark them verified [R].** The 1,433-object universe
and its 714/98/212/409 split; 52,349,579 rows and 28 GB; all 23 gap-metric values; the 0.0% justice
drill-through on 49,426 edges; the 25.1% donation ABN attribution; the 0% NDIS and NZ bridges; the
3.16-rows-per-key grain defect; the `measure_kind` breakdown and the 45.3× topic inflation; the
85.3% `other receipt` dollar share; the Hays Specialist Recruitment $123.00bn row and the 13-row
29.4% concentration; `grants_total` exactly zero across 94,088 rows; the 11 entity types × 10
relationship types and the ~40 s live aggregate; the degree distribution (p50 2, p95 23, p99 84,
max 330,460, 2,594 nodes over 150) and the two category nodes holding 605,135 edges; the duplicate
`Department of Defence`; `mv_gs_entity_stats` at 400,276 rows and indexed on `gs_id`; the 209,172
isolate entities; `amount` 77.43% and `year` 69.66% populated; the 8-second PostgREST ceiling and
the proof that `SET LOCAL statement_timeout` inside plpgsql cannot cancel a running query; the
4.5-minute sweep budget and its component costs; the three question timings (279 ms / 196 ms /
3,076 ms) and the independent exact reproduction of the evidence gap; the median-0.9-months
fragility correction; the `PRIMARY KEY (…, coalesce(…))` grammar failure; the `n_live_tup`
breakage samples; the 1,419-row `data_catalog_snapshots` history (which I also confirmed myself);
the three historical row-moves; the ACT verdicts (162 IN / 46 BORDERLINE / 29 OUT, plus 89 pure-ACT
views the census never saw).

**Inferred, marked as such [I].** Every TTFB target and payload size in §5; the row-count ceilings
at which plain DOM and inline SVG stop being comfortable; the ~300 KB ledger payload from field
widths; that ~26 answers total under a minute, extrapolated from three measurements; the slice-day
estimates in §6; the judgement that the panel disagreement resolves in favour of the Interrogator
rather than the Atlas — that is an argument (§1.2), not a measurement.

**Not checked by anyone [U].** No migration in this spec or in the three carried files has been
applied; `clarity_refresh()` has never been executed; **nothing in this document has ever
rendered**, and no page was loaded in a browser. The `recharts` point ceiling was not measured.
Whether `mv_clarity_flow`'s refresh fits inside the nightly window was not measured (its underlying
aggregate was, at ~40 s). Whether the parallel session's five migrations apply cleanly in the stated
order was not tested. JusticeHub's working tree was not opened this session, and another session was
mid-flight on `src/lib/data-observatory/` as of 2026-08-14 — **coordinate before slice 1**.
