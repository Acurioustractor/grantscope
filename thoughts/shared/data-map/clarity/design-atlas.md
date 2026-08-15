# /clarity — THE ATLAS

**A design for one continuous space you travel through, not four screens you switch between.**

Written 2026-08-14. Direction: THE ATLAS. Built against `GROUND_TRUTH.md`,
`GROUND_TRUTH_SUPPLEMENT.md`, `VERIFICATION.md`, `COMPLETENESS.md`, `CANONICAL-DATA-MAP.md`,
`clarity-data-layer.md`, `act-extraction-plan.md`, the two research briefs, `existing-surfaces.md`,
`DESIGN.md` and `installed-viz-libs.md`.

Verification key: **[V]** measured by me in this session · **[R]** relayed from a document that
marks it verified · **[I]** inferred · **[U]** unverified.

---

## 0. THE ONE-PARAGRAPH ANSWER

`/clarity` is a single space with six depths. The frame never changes — a breadcrumb sentence
across the top, a filter rail down the left, a minimap of the whole estate bottom-left, a gap
gutter down the right. Only the **viewport** changes, and at each depth it changes **form**, not
scale: a mosaic of all 1,433 objects → a domain constellation → a dataset's column and join ledger
→ a cross-section matrix → an entity's ego network → a record with its provenance. Filters set at
the top survive every descent, so the space is *brushed* rather than navigated. The colour
alphabet is the same at all six depths, so a gap looks like a gap whether you are looking at the
whole database or at one column. And absence has six distinct glyphs, of which the load-bearing
pair is `+` (we never measured this) versus `×` (we measured it and it is zero) — a distinction no
data catalog product on the market makes, and the one that separates this from a competent
inventory.

---

## 1. THE ARGUMENT — why the Atlas, and why BUILD-SPEC's four screens are the floor

### 1.1 Four screens is a menu. Ben asked for a map.

BUILD-SPEC proposes overview → ledger → detail → graph as four routes. That structure has a
specific, fatal property: **the ledger is where you land and the ledger is where you stay.** The
other three screens are places you *leave to*, and leaving costs you your filters, your scroll
position, and your sense of where you were. Every data catalog on the market works this way and
every one of them is described in the literature the same way — Grover's "Catalog Ghost Town", the
"passive repository", the "digital graveyard within 18 months" [R, research-dashboards §2.4].

Ben's words were "see the full map, then click down through levels to see how it connects". That
is not four screens. That is **one space with depth**, and the difference is not cosmetic:

- In four screens, "where am I" is answered by a page title. In a space, it is answered by a
  breadcrumb sentence, a highlighted cell in a persistent minimap, and a filter rail that still
  holds what you set two levels ago.
- In four screens, a gap is a row in a table. In a space, a gap is a **stripe** — a vertical run
  of `+` in a matrix, or a pale band in the estate mosaic, visible from two metres.
- In four screens, "how does it connect" is a graph page. In a space, connection is the *thing you
  travel along*: you descend from a dataset **through** a join, and the join's measured match rate
  is printed on the door you walk through.

### 1.2 Semantic zoom is only real if the form changes

The research is explicit that the failure mode is "showing the same thing smaller", and that the
diagnosis is precise: it happens when zoom is bound to *geometry* instead of to *representation*
[R, research-visualization §5.1]. The test given there is the one I have applied to every level
below: **write the sentence a user can finish at that level and nowhere else. If two levels finish
the same sentence, delete one.**

Six levels, six sentences, six forms:

| L | The sentence only this level finishes | Form | Cardinality on screen |
|---|---|---|---|
| **L0** | "We hold 1,433 objects, and 621 of them are undescribed." | equal-area mosaic | 1,433 tiles |
| **L1** | "Inside *Government money out* there are 37 objects and they join like *this*." | node-link constellation + coverage matrix | 18–104 nodes |
| **L2** | "`justice_funding` has 157,116 rows, 4 measured joins, and one of them is 0.0%." | column profile + join ledger | 1 object, ~20–60 columns |
| **L3** | "Companies fund charities 699,387 times; foundations fund companies almost never." | adjacency / PivotGraph matrix | 11×11 and 14×14 |
| **L4** | "This organisation is connected to 23 others, and to *these two* through a board seat." | DOI ego network | 30–150 nodes |
| **L5** | "This row came from grants.gov.au on 12 June and nothing supersedes it." | record + provenance | 1 |

Each of those uses a form the one above cannot use, for a reason that is measured, not asserted
(§2). That is the discipline the direction asks for, and it is why the Atlas is not a list with
extra steps.

### 1.3 The specific thing that makes it better than a list

**Every object in the database is on the first screen, simultaneously, above the fold.**

1,433 tiles at a 12px pitch is 91 per row and 16 rows — roughly 1,100 × 200 pixels. The whole
estate. Not the top 25, not paginated, not "scroll for 807 more rows". A list can never do this,
because a list spends 32 pixels of height on each row and 724 rows is 23,000 pixels
[R, research-dashboards §1.1]. A mosaic spends 12.

And once every object is simultaneously visible in a **stable** position, three things become true
that are false in a list:

1. **Gaps read as shape.** 621 undescribed objects are not a number in a footer; they are 43% of
   the mosaic sitting in a block labelled UNFILED.
2. **The lens becomes free.** Recolour the same 1,433 tiles by freshness, by size, by exposure —
   one layout, eight encodings, zero relayout [R, dbt Explorer's Lenses, research-dashboards §2.2].
   The reader's mental map survives every switch, which is exactly the property NN/g says treemaps
   destroy.
3. **The minimap becomes possible.** Shrink the same mosaic to 200 × 96px and it is a legitimate
   "you are here" frame at every deeper level. The research warns that converting a large graph
   into a drill-through hierarchy "loses the benefits of a single flat layout that exposes
   membership and provides a navigable and memorable frame of reference"
   [R, research-visualization §5.2]. The persistent mosaic is the answer to that warning.

### 1.4 Why equal-area tiles and not a treemap

Row counts in this database span `abr_registry` at 20,006,350 down to objects with one row —
**seven orders of magnitude** [R]. A treemap of that renders as one rectangle covering ~38% of the
canvas and ~700 invisible slivers, and area is Cleveland–McGill rank 6
[R, research-dashboards §3.3]. So the mosaic gives every object **the same area** and encodes
magnitude in colour band and in the sortable ledger below. An object being small is not the same
as an object being unimportant — `public_profiles` has 218 rows and 66 referencing app files and
ranks #14 [R, clarity-data-layer §4.4]. Equal area is the honest choice and it is also the choice
that makes the mosaic readable.

### 1.5 The Atlas is not a meta-tool bolted next to the product

L3, L4 and L5 are the *actual civic data* — the cross-sections, the organisations, the records.
That is deliberate. A catalog that only describes tables is the thing that rots, because nobody
opens it during real work. This one is opened during real work, because the path from "what do we
hold about youth justice" to "which 47 organisations received that money" runs straight through
it, without changing product.

---

## 2. THE MEASURED CONSTRAINTS THIS DESIGN IS BUILT ON

Everything in this section is a number, and every number has a provenance tag. The design is
downstream of these; where I had to choose a cap or a threshold, it comes from here.

### 2.1 The universe

| Fact | Value | Source |
|---|---|---|
| Catalogued objects | **1,433** = 714 tables + 98 matviews + 212 views + 409 functions | [R] clarity-data-layer §1 |
| Objects with a domain / written purpose | **812 / 1,433 = 56.7%** | [R] gap metric 1 |
| ⟶ therefore **UNFILED** | **621 objects (43.3%)** — every view and every function | [I] from the above |
| ACT private-business objects, excluded per Ben's decision 1 | **238** (221 canonical + 17 name-rule) | [R] clarity-data-layer §4.4 |
| ⟶ therefore the **civic domained estate** | **575 objects** across D1–D13 | [I] 812 − 237 |
| Total rows | 52,349,579 | [R] GROUND_TRUTH |
| Governance rows (`data_catalog`) | **25 / 1,433 = 1.7%** | [R] gap metric 2 |
| Anon-readable relations | **451 / 1,024 = 44.0%** | [R] gap metric 17 |
| Matviews in no scheduled refresh | **71 / 98 = 72.4%** | [R] gap metric 5 |
| Dark objects (populated, nothing reads them) | **184 objects / 5,087,126 rows** — *not* the 290/14.9M in the map | [R] gap metric 8 |

**The design consequence.** The front page cannot open with "812 objects, 724 populated" — that is
a 43%-wrong claim on the first screen [R, clarity-data-layer §0, defect B1]. It opens with 1,433,
and the largest single block on it is UNFILED. The map of the map is itself the biggest gap, and
saying so first is the whole posture.

### 2.2 The graph — measured this session

I ran the degree distribution because every node-link cap in this design depends on it.

```
[V] WITH d AS (SELECT source_entity_id AS id FROM gs_relationships
               UNION ALL SELECT target_entity_id FROM gs_relationships),
         g AS (SELECT id, count(*) deg FROM d GROUP BY 1)
    SELECT count(*), max(deg), p50, p95, p99, count(*) FILTER (WHERE deg > 150) FROM g;

    nodes_with_edges | max_deg | p50 | p95 | p99 | over_150
              400276 |  330460 |   2 |  23 |  84 |     2594
```

Five design facts fall straight out:

1. **609,448 − 400,276 = 209,172 entities (34.3%) have no edge at all.** [V/I] That is the
   "snowstorm" failure mode [R, S7], and it is not a rendering problem — it is the single most
   common state an entity is in. L4 must have a designed empty state, and that state must say
   *"no relationship rows are linked to this entity in `gs_relationships`"*, which is a fact about
   the database, never *"this organisation has no connections"*.
2. **p99 degree is 84.** [V] So for 99% of connected entities, the whole one-hop ego network fits
   inside the 30–150 node budget with room to spare. Node-link is the *right* form at L4 —
   verified, not assumed.
3. **Only 2,594 nodes (0.65% of connected nodes) exceed degree 150.** [V] The hub problem is
   real but rare, so the fix is a designed exception (§10.4, the Hub Sheet), not a global
   degradation of the view.
4. **Max degree is 330,460 — one node holds 9.6% of all 3.43M edges.** [V] Auto-expansion is
   fatal. Any node above the cap must be rendered as a *sheet*, never as a starburst.
5. **The top hubs are a data-quality finding, not a data fact.** [V]

```
[V] Specialised Supplies and Services            program          330,460
    Specialised Support Services                 program          274,675
    Department of Defence                        government_body  270,864
    Australian Labor Party (ALP)                 political_party   102,594
    Australian Labor Party (State of Queensland)  political_party   98,465
    Safe Places Community Services Limited       charity            81,994
```

The top two are **AusTender procurement *categories* materialised as `entity_type='program'`
nodes**. They are not organisations. They hold 605,135 edges between them — 17.6% of the entire
graph — and any centrality, power score or "most connected" ranking that includes them is wrong.
[V for the numbers and types; [I] for the reading that they are UNSPSC-style categories.] This is
exactly the class of finding /clarity exists to surface, and §11.5 gives it a permanent home.

### 2.3 The cross-section axes — measured this session

```
[V] SELECT entity_type, count(*) FROM gs_entities GROUP BY 1 ORDER BY 2 DESC;
    company 272,535 · person 240,842 · charity 57,295 · foundation 10,544 · program 9,584
    · indigenous_corp 7,228 · social_enterprise 5,803 · government_body 3,250
    · political_party 2,365 · trust 1 · unknown 1                    → 11 values

[V] SELECT relationship_type, count(*), count(DISTINCT dataset) FROM gs_relationships GROUP BY 1;
    donation 1,073,308 (1) · grant 895,054 (46) · contract 699,387 (1)
    · directorship 440,128 (6) · member_of 221,563 (1) · shared_director 95,476 (1)
    · lobbies_for 2,452 (5) · subsidiary_of 1,267 (2) · affiliated_with 505 (1)
    · partners_with 44 (2)                                            → 10 values
```

**11 × 11 = 121 cells, filterable by 10 relationship types.** [V] That is a perfect adjacency
matrix: above Ghoniem's ~20-node threshold where matrices beat node-link, and far below the point
where a matrix becomes unreadable [R, S12]. L3 is not a compromise — it is the *best* form
available for this exact cardinality, and the cardinality is verified rather than hoped for.

Two of the eleven types are junk (`trust` 1 row, `unknown` 1 row) — they render as a hairline
row/column and are labelled, not dropped. Dropping them would be the first small lie.

### 2.4 What already exists and must be reused, not rebuilt

| Asset | State | How the Atlas uses it |
|---|---|---|
| `mv_gs_entity_stats` — 400,276 rows, columns `total_relationships`, `distinct_counterparties`, `top_counterparty_share`, `total_inbound_amount`, `total_outbound_amount`, `type_breakdown`, `year_distribution` | **[V] live, exists today** | L4's entire pre-flight: degree for the hub test, and `total_*_amount` as the DOI a-priori-interest term. **No new matview needed for L4.** And because it covers exactly the 400,276 connected nodes, *absence from this MV is the isolate test* [V/I] |
| `/api/data/schema-graph/route.ts` — 280 lines, live, deployed, **zero consumers** | [R] existing-surfaces | L1's constellation. Its `TABLE_DOMAIN` hard-filter (`if (!domain) continue;`) drops 742 of 812 objects and must be removed; after that it is the L1 payload |
| `src/lib/atlas/layers.ts` — mandatory `caveat`, `honestAt`, `consent`, `live\|declared` | [R] existing-surfaces | The type discipline for the `ClarityView` registry (§13). A declared-but-empty level still appears and says so out loud |
| `src/config/surface.ts` + `surface-coverage.test.ts` (JusticeHub) | [R] existing-surfaces | The governance model: a CI guard that fails when the registry and reality diverge. The only artefact in either repo that demonstrably has not rotted |
| `clarity_object` / `clarity_edge` / `clarity_gap_metric` / `v_clarity_ledger` | **unapplied migrations**, `supabase/migrations/202608150000*.sql` | The entire L0–L2 data layer. This design assumes they are applied; nothing here re-specifies them |
| `data_catalog` + `data_catalog_snapshots` (1,419 rows of real history) | [R] live, nightly | The governance columns on L2. Widen membership; do not build a third catalog |
| recharts ^3.7.0 · react-force-graph-2d ^1.29.1 · leaflet ^1.9.4 | [R] installed in `apps/web` | Everything. **This design adds zero dependencies** — §16.4 |

---

## 3. ROUTE MAP AND INFORMATION ARCHITECTURE

```
/clarity                                   L0  THE ESTATE          every object, one screen
/clarity/d/[domain]                        L1  THE DOMAIN          e.g. /clarity/d/money-out
/clarity/o/[objectKey]                     L2  THE DATASET         e.g. /clarity/o/justice_funding
/clarity/o/[objectKey]/c/[column]          L2b THE COLUMN          a column's fill + its joins
/clarity/x                                 L3  THE CROSS-SECTIONS  index of matrices
/clarity/x/[matrix]                        L3  ONE MATRIX          flow | join | topic | place
/clarity/e/[gsId]                          L4  THE ENTITY          DOI ego network
/clarity/r/[objectKey]/[pk]                L5  THE RECORD          provenance floor

/api/clarity/estate            GET   L0 payload, cached 1h        (1,433 rows, ~260 KB)
/api/clarity/domain/[d]        GET   L1 constellation + matrix
/api/clarity/object/[k]        GET   L2 columns, edges, refs, history
/api/clarity/matrix/[m]        GET   L3 cells
/api/clarity/ego/[gsId]        GET   L4 hop-by-hop, capped
/api/clarity/verdict           POST  write KEEP | SUSPECT | CRUFT + mandatory reason
/api/clarity/rescore           POST  admin re-rank: SELECT clarity_score() — sub-second
```

**Deliberate non-routes.** There is no `/clarity/place`. Place is a *dimension* of the data (48.3%
of entities carry an LGA), not a level of it, and `/atlas` already owns it with a nine-layer
registry that is the best-engineered surface in either repo [R]. L1–L4 each carry a **"open in
Atlas"** hand-off that passes the current filter set through as `/atlas?...`. Building a fifth map
here would be the fragmentation failure the research names twice.

**Access.** `/clarity` is admin-gated with `requireAdminPage()` (the pattern `/mission-control`
already uses), because it renders `refs_*`, `anon_readable`, `pii_level` and verdicts. The public
data-commons surface remains `/giving/sources` and `/giving/quality`.

**Viewport stance.** `/clarity` is a desktop instrument. Below 1280px it renders the ledger and
the gap gutter only, with a printed line: *"The Atlas needs 1280px. This is the ledger view."*
Stating the degradation beats silently reflowing a spatial design into a column.

---

## 4. THE PERSISTENT FRAME — what makes six routes one space

Every level renders inside the same shell. This is the whole design; the viewport is the variable.

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ ①  CLARITY  ›  AUSTRALIA  ›  GOVERNMENT MONEY OUT  ›  austender_contracts  ›  supplier_abn   │ 40px
├──────────────┬────────────────────────────────────────────────────────┬───────────────────────┤
│ ②            │ ④                                                       │ ⑤                     │
│ RAIL         │ VIEWPORT — the only thing that changes between levels   │ GAP GUTTER            │
│ 220px        │                                                        │ 220px                 │
│ filters      │  L0 mosaic · L1 constellation+matrix · L2 profile       │ absence readout for   │
│ survive      │  L3 matrix · L4 ego network · L5 record                 │ exactly what is on    │
│ every        │                                                        │ screen, + the         │
│ descent      │                                                        │ Frontier              │
│              │                                                        │                       │
│              ├────────────────────────────────────────────────────────┤                       │
│ ③ MINIMAP    │ ⑥ LENS  [STATE ▾] state·fresh·size·bytes·degree·use·   │                       │
│ 200×96       │          known·exposure          ⑦ [EXTRACT ▾]         │                       │
└──────────────┴────────────────────────────────────────────────────────┴───────────────────────┘
```

**① The Ribbon — the breadcrumb is a sentence, not a path.**
Each segment is clickable, each is a URL, and each carries the count of what it contains:
`AUSTRALIA (1,433) › GOVERNMENT MONEY OUT (37) › austender_contracts (823,620) › supplier_abn (92.9% filled)`.
The research asks for a breadcrumb of *operations*, not of *pages* [R, §5.2], so filters appear as
segments too: `… › filtered: stale >180d (141)`. Satoshi 700, 11px, uppercase, `tracking-widest`,
segments separated by `›` in muted, the current segment in black with a 4px red bottom-border.

**② The Rail — owns every filter, at every level.**
This is the mechanism that makes descent feel continuous. Filters are stored in the URL and are
**level-independent**: setting `state=empty` at L0 and then descending to L1 leaves the domain
constellation showing only its empty objects, with the constellation's dropped nodes rendered as
hollow outlines rather than removed, so you can see what your filter cost you. Sections:

```
SCOPE      ● civic (1,195)  ○ + ACT private (238)  ○ everything (1,433)
KIND       ☐ table 714  ☐ matview 98  ☐ view 212  ☐ function 409
DOMAIN     ☐ D1 Entity spine 18  ☐ D2 Registries 30 … ☐ UNFILED 621
TIER       ☐ T0 spine 5  ☐ T1 core 177  ☐ T2 derived 141  ☐ T3 crosswalk 43
           ☐ T4 operational 301  ☐ T5 staging/backup 57
STATE      ☐ live  ☐ tiny <10  ☐ empty 88  ☐ staging  ☐ backup  ☐ superseded
GAPS       ☐ no purpose 621  ☐ no owner 1,408  ☐ never measured  ☐ join <50%
           ☐ unscheduled matview 71  ☐ read by nothing 184
FRESH      ├──●──────┤  ≤7d · ≤30d · ≤180d · older · unknowable
EXPOSURE   ☐ anon-readable 451  ☐ definer-rights view 103  ☐ RLS on, 0 policies 215
```

Every facet prints its count and greys to zero-result rather than disappearing
[R, research-dashboards §3.7]. Counts recompute client-side from the 1,433-row payload —
sub-100ms, no round trip, which is Shneiderman's dynamic-query threshold met by architecture
rather than by optimisation [R, §3.1].

**③ The Minimap — the estate mosaic, always.**
The same 1,433 tiles at a 4px pitch in 200 × 96px, with the current position in `bauhaus-red` and
the current filter's surviving set at full opacity, everything else at 25%. At L4, standing on an
entity, it highlights the *objects that entity has rows in* — so an org page tells you which
corner of the database knows about it. This is the answer to the documented risk that
drill-through hierarchies destroy the memorable flat frame [R, §5.2].

**④ The Viewport.** §6–§11.

**⑤ The Gap Gutter — absence gets its own column, at every level.**
Never blank. At L0 it holds the ranked gap metrics with movement arrows from
`clarity_gap_measurement`'s time series. At L1 it holds that domain's share of each metric. At L2
it holds this object's specific absences. At L4 it holds *what we do not know about this
organisation*, phrased as facts about the database. Below the metrics sits **the Frontier**
(§12) — what becomes possible if a named gap closes.

**⑥ The Lens.** One layout, eight recolourings, applied simultaneously to the mosaic, the
constellation node fill, the matrix cells and the ledger row rule. §14.

**⑦ Extract.** Shneiderman's seventh task. Copy as CSV · copy as a SQL `IN` list · copy the current
URL · open the same filter in `/atlas` · open in `/graph`. Present at every level, always operating
on exactly what is on screen and printing the count it will copy.

---

## 5. THE ABSENCE ALPHABET — six glyphs, one meaning each

This is the part the direction brief calls out ("absence must be visible; gaps need their own
glyph") and it is where most of the leverage is. Monte Carlo's coverage matrix uses one glyph, `+`
for "no monitor deployed" [R, research-dashboards §4.1]. One glyph is not enough for this
database, because it conflates the two states that matter most.

| Glyph | Colour | Means | Example on this data |
|---|---|---|---|
| `█` | black `#121212` | **measured, present** | `justice_funding.gs_entity_id` → 93.6% |
| `~` | yellow `#F0C020` | **measured, degraded** — an estimate, a timeout, a stale value | the 18 views that time out at 3s; the 6 row counts that are `reltuples` |
| `×` | red `#D02020` | **measured, and it failed** — we ran the test and the answer is zero or broken | `gs_relationships.source_record_id` → `justice_funding`: **0 of 49,426 = 0.0%**, a dead key namespace |
| `+` | blue `#1040C0` | **never measured / not recorded** — a gap in *our* metadata, and clicking it is the affordance to fill it | 621 objects with no purpose; 1,408 with no owner |
| `·` | muted `#777777` | **not applicable** — the dimension does not exist for this kind of object | `bytes` on a view; `freshness_column` on a function |
| `▚` | muted, hatched | **out of scope / withheld** — present, deliberately not shown here | the 238 ACT private-business objects |

Two rules make this work:

**Rule 1 — `+` and `×` are never merged.** "We have not checked" and "we checked and it is zero"
are different problems with different owners and different fixes. Merging them is how a catalog
becomes an accusation nobody acts on. The justice drill-through is `×`: it is not missing
documentation, it is a broken key, and the difference determines whether the fix is an afternoon
or a rebuild [R, VERIFICATION.md].

**Rule 2 — red is the data, blue is us.** Red says the data is wrong. Blue says our knowledge of
it is missing. `#D02020` is the signature colour and it must not be spent on "no description
written yet". The split is what stops the page reading as a wall of blame.

Because the glyphs are JetBrains Mono at a fixed pitch, a column of `+` in a coverage matrix
renders as a solid blue stripe. **That stripe is the product.**

**Never rendered anywhere, at any level:** "has no evidence", "no connections", "no board", "not
funded". The permitted forms are "no evidence record linked", "no rows in `gs_relationships`
reference this entity", "no `person_roles` rows carry this entity id". This is enforced as a lint
rule in the copy deck (§16.5), not left to authorial discipline.

---

## 6. L0 · THE ESTATE — `/clarity`

**The sentence:** *"We hold 1,433 objects, 52.3 million rows, and 621 of them are undescribed."*
**Form:** equal-area mosaic + coverage scalars + ranked ledger.
**Why this form:** every object simultaneously visible; area encoding refused because row counts
span seven orders of magnitude (§1.4).

### 6.1 Wireframe

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CLARITY › AUSTRALIA                                                    ⌕ search 1,433 objects…    │
│ 1,433 OBJECTS · 714 TABLES · 98 MATVIEWS · 212 VIEWS · 409 FUNCTIONS · 52,349,579 ROWS · 28 GB    │
│ SWEPT 14 AUG 04:12 UTC · 4m38s · 2 objects deferred · 18 views timed out                          │
├──────────────┬──────────────────────────────────────────────────────────────┬─────────────────────┤
│ SCOPE        │ WHAT WE KNOW ABOUT WHAT WE HOLD                              │ THE GAPS            │
│ ● civic 1,195│                                                              │ ranked by what they │
│ ○ +ACT 1,433 │ DESCRIBED   GOVERNED    LAST-WRITE   SCHEDULED   READ BY CODE│ block               │
│              │ 56.7%       1.7%        74.9%        27.6%       ██ 63.2%    │                     │
│ KIND         │ ███████▏░░  ▎░░░░░░░░░  ███████▍░░   ███░░░░░░░  ██████▎░░░  │ 1 youth detention   │
│ ☐ table  714 │ 812/1,433   25/1,433    608/812      27/98       906/1,433   │   13 rows      L    │
│ ☐ matview 98 │                                                              │ 2 no Indigenous     │
│ ☐ view   212 │ JOINED      MEASURED    ANON-OPEN ⚠  DEFINER ⚠               │   denominator  S ★  │
│ ☐ function409│ 41.1%       98.2%       44.0%        103 views               │ 3 donations 25.1%   │
│              │ ████▏░░░░░  █████████▊  ████▍░░░░░   ██▌░░░░░░░              │   attributable M    │
│ DOMAIN       │ 589/1,433   1,006/1,024 451/1,024    of 212                  │ 4 six LGA rollups   │
│ ☐ D1 spine 18├──────────────────────────────────────────────────────────────┤   six counts   M    │
│ ☐ D2 reg   30│ THE ESTATE — every object, one tile, equal area. LENS: STATE │ 5 justice edge→     │
│ ☐ D3 money 37│                                                              │   grant  0.0%  M ×  │
│ ☐ D4 phil  36│ D1 SPINE      ████████████████ 18                            │ …25 in the register │
│ ☐ D5 opps  37│ D2 REGISTRY   ██████████████████████████████ 30              │ [ open register → ] │
│ ☐ D6 people24│ D3 MONEY OUT  ██████████████████████████████████░░░ 37       ├─────────────────────┤
│ ☐ D7 pol   28│ D4 PHILANTHR  ███████████████████████████████░░░░░ 36        │ THE FRONTIER        │
│ ☐ D8 just  54│ D5 OPPORTUN   ██████████████████████░░░░░░░░░░░░░░ 37        │ one join from real  │
│ ☐ D9 evid  54│ D6 PEOPLE     ████████████████████████ 24                    │                     │
│ ☐ D10 place46│ D7 POLITICAL  ██████████████████████████░░ 28                │ ▸ 1,728 diary rows  │
│ ☐ D11 svc  30│ D8 JUSTICE    ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░ 54 │   carry an ABN.     │
│ ☐ D12 media77│ D9 EVIDENCE   ████████████████████████████░░░░░░░░░░░░░░░ 54 │   Resolve it and    │
│ ☐ D13 plat104│ D10 PLACE     ███████████████████████████░░░░░░░░░ 46        │   access→money      │
│ ☐ UNFILED 621│ D11 SERVICES  ████████████████████░░░░░░░░░░ 30              │   becomes a view.   │
│              │ D12 MEDIA     ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░… 77 │   Effort: S         │
│ TIER         │ D13 PLATFORM  ██████████████████████░░░░░░░░░░░░░░░░░░░… 104 │                     │
│ ☐ T0 spine  5│                                                              │ ▸ 68,172 GrantConn- │
│ ☐ T1 core 177│ ⚠ UNFILED — 621 objects with no domain and no written purpose│   ect ABNs resolve  │
│ ☐ T2 deriv141│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   in abr_registry   │
│ ☐ T3 xwalk 43│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   and are absent    │
│ ☐ T4 ops  301│   ░░░░░░░░░░░░░░░░░░░░░ 212 views · 409 functions            │   from gs_entities. │
│ ☐ T5 junk  57│   Nobody has ever described these. 206 of the views are      │   One insert.  S ★  │
│              │   anon-readable and 99 run with owner rights.                │                     │
│ STATE        │   [ triage the 621 → ]                                       │ ▸ 53,223 donor↔     │
│ ☐ live       │                                                              │   contractor find-  │
│ ☐ tiny <10   │ ▚▚▚ ACT PRIVATE BUSINESS — 238 objects, excluded from the    │   ings, never       │
│ ☐ empty   88 │     civic map by decision, leaving this database. [ why? ]   │   delivered.   S ★  │
│ ☐ backup  14 │                                                              │                     │
│              │ █ live  ~ degraded  × broken  + never measured  · n/a  ▚ oos │                     │
│ GAPS         ├──────────────────────────────────────────────────────────────┤                     │
│ ☐ no purpose │ THE LEDGER   1,433 · filtered 1,433 · sort IMPORTANCE ▾      │                     │
│      621     │  rows ▾ · bytes ▾ · degree ▾ · fresh ▾ · name ▾              │                     │
│ ☐ no owner   │ ┌──────────────────────┬────────┬──────┬────┬───┬───┬───┬───┐│                     │
│      1,408   │ │ OBJECT               │   ROWS │ SIZE │FRSH│PUR│OWN│JOI│USE││                     │
│ ☐ never meas.│ ├──────────────────────┼────────┼──────┼────┼───┼───┼───┼───┤│                     │
│ ☐ join <50%  │ │ austender_contracts  │823,620 │2.1GB │ 7d │ █ │ █ │ █ │ █ ││                     │
│ ☐ unsched 71 │ │ justice_funding      │157,116 │ 84MB │ 0d │ █ │ █ │ █ │ █ ││                     │
│ ☐ dark   184 │ │ organizations        │104,427 │ 61MB │ 0d │ █ │ + │ █ │ █ ││                     │
│              │ │ gs_relationships     │3.43M   │2.1GB │ 5d │ █ │ █ │ × │ █ ││ ← × = source_record │
│ FRESHNESS    │ │ gs_entities          │609,448 │4.9GB │ 0d │ █ │ █ │ █ │ █ ││   _id, 0.0% of      │
│ ├─●────────┤ │ │ political_donations  │2.55M   │1.1GB │ 7d │ █ │ + │ ~ │ █ ││   49,426 resolve    │
│ ≤7 30 180 old│ │ abr_registry         │20.0M   │6.9GB │ ~  │ █ │ + │ + │ + ││                     │
│              │ │ ⛔gs_entities_lga_    │609,416 │ 41MB │ 5d │ + │ + │ + │ + ││                     │
│ EXPOSURE     │ │   backup_20260808    │  CRUFT · superseded · 1 of 14 · 1,541,951 rows recoverable│
│ ☐ anon 451   │ │ v_org_funding_profile│609,448 │  ·   │ ·  │ + │ + │ █ │ █ ││                     │
│ ☐ definer103 │ │ v_entity_360         │   ~    │  ·   │ ·  │ + │ + │ + │ █ ││ ← ~ = 3s timeout    │
│ ☐ rls-0-pol  │ │ … 1,424 more · sticky header · frozen OBJECT · no paging   ││                     │
│      215     │ └──────────────────────┴────────┴──────┴────┴───┴───┴───┴───┘│                     │
│              │ [ EXTRACT ▾ ] CSV · SQL IN-list · this URL · open in /atlas  │                     │
└──────────────┴──────────────────────────────────────────────────────────────┴─────────────────────┘
                 ┌─── MINIMAP ────────┐
                 │ ▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪ │  the same mosaic at 4px,
                 │ ▪▪▪▪▪▪▪▪▪▪▪▪░░░░░░ │  you are here = whole estate
                 └────────────────────┘
```

### 6.2 Panels, components and queries

| Panel | Component | Type | Query |
|---|---|---|---|
| Header counts + sweep receipt | `<EstateHeader>` | Server | `SELECT count(*) FILTER (WHERE object_kind='table') …, sum(row_count), max(refreshed_at) FROM clarity_object WHERE missing_since IS NULL` — 1 row |
| 9 coverage scalars | `<CoverageBar>` ×9 | Server | `SELECT DISTINCT ON (metric_key) metric_key, title, question, numerator, denominator, value, unit, direction, target, measured_at, status FROM clarity_gap_measurement JOIN clarity_gap_metric USING (metric_key) WHERE enabled ORDER BY metric_key, measured_at DESC` — 23 rows |
| The mosaic | `<EstateMosaic>` | **Client** | none — receives the estate payload as a prop |
| The ledger | `<Ledger>` | **Client** | none — same payload, filtered in memory |
| Rail facets | `<Rail>` | **Client** | none — counts computed from the payload |
| Gap gutter | `<GapGutter>` | Server | the same 23-metric query, plus `clarity_gap_measurement` prior value for the arrow |
| Frontier | `<Frontier>` | Server | `SELECT * FROM clarity_frontier WHERE scope='estate' ORDER BY leverage DESC LIMIT 3` (§12) |
| Minimap | `<Minimap>` | **Client** | none — same payload |

**The one query that matters** — the estate payload, served by `/api/clarity/estate` and cached
for one hour:

```sql
SELECT object_key, object_name, object_kind, domain, lifecycle, state,
       row_count, row_count_is_estimate, row_count_probe, bytes, degree,
       last_write_at, freshness_probe,
       refs_app, refs_script, refs_db_function, owner_app,
       has_purpose, has_owner, has_domain, has_join, has_use, is_fresh,
       anon_readable, security_invoker, pii_level, exposure_conflict,
       importance, verdict, act_business
FROM v_clarity_ledger
WHERE missing_since IS NULL
ORDER BY coalesce(domain,'ZZ_UNFILED'), importance DESC;
```

1,433 rows × ~30 fields ≈ **260 KB of JSON** [I, from field widths]. That is small enough to ship
whole to the client in the RSC payload, which is what buys the sub-100ms facet counts. It is also
small enough that gzip makes it ~45 KB over the wire. This is the architecture decision the
research explicitly licenses: 724 objects is small, ship it all [R, research-dashboards §2.3].

### 6.3 The mosaic, specified

- **Tile** 10 × 10px, 2px gutter → 12px pitch. 1,100px content width → **91 tiles per row**.
- **Bands** one per domain, in the fixed order D1…D13, then UNFILED, then the ACT strip. Domain
  label in the 140px left gutter, Satoshi 700 11px uppercase, with its object count.
- **Order within a band:** `importance DESC`, then `object_name`. **Frozen between refreshes** —
  the client renders from a `position` integer written by the nightly sweep, not from a live sort,
  so a tile does not move because a row count changed. Objects whose position moved by more than
  10 since the last sweep get a 1px red top-edge for one day. This is the mitigation for the
  design's biggest weakness (§21.3).
- **Fill** = the active lens. **Corner notch** (3px black triangle, top-right) = a human verdict
  exists. **Hairline red border** = `verdict='cruft'`.
- **Hover** → a peek card at the pointer (OpenMetadata's quick preview [R]): name, kind, domain,
  rows, size, last write, degree, the four glyph states, and the first line of `purpose`. 120ms
  delay in, 0ms out.
- **Click a tile** → L2. **Click a band label** → L1. **Shift-drag across tiles** → adds them to
  the extract selection (Shneiderman's task 7).
- **Empty state:** impossible — if `clarity_object` is empty the sweep has never run, and the
  mosaic is replaced by a single card: *"The catalog has never been swept. Run
  `scripts/snapshot-clarity.mjs`. Nothing on this page is inferred from a stale file."*
- **Loading:** the mosaic is server-rendered from the payload, so it has no loading state. The
  page's Suspense boundary shows the header and the rail with the tile field as a 1,433-tile grid
  of `#E8E8E8` — the right shape, no content. Never a spinner: the shape *is* the information.
- **Error:** if `/api/clarity/estate` 500s, the page renders the header from a `data_catalog`
  fallback and prints *"The estate payload failed: <message>. The 25 governed tables are shown
  below."* Degrade to the smaller true thing; never to a blank.

### 6.4 What L0 must never do

- Never open with 812. The universe is 1,433 and the difference is the point.
- Never render a treemap or a sunburst (§1.4).
- Never default-sort alphabetically. Default is `importance DESC`, and **`rows` and `bytes` are
  first-class sorts in the same control**, because `abr_registry` — the largest object in the
  database — ranks 56th on importance and would otherwise be below the fold forever
  [R, clarity-data-layer §4.2].
- Never hide the ACT strip. Ben's decision removes it from the *civic map*; the Atlas still shows
  the block, dimmed and hatched, with a link to the extraction plan. An object that disappears
  without a written reason is how the boundary re-blurs [R, act-extraction-plan §5].

---

## 7. L1 · THE DOMAIN — `/clarity/d/[domain]`

**The sentence:** *"Inside Government money out there are 37 objects, they join like this, and
four of them are read by nothing."*
**Form:** node-link constellation (left) + coverage matrix (right), side by side, linked.
**Why node-link is honest here and nowhere else:** the largest civic domain is D13 at 104 objects;
the median is ~36. That sits inside the 30–150 readable band [R, S12/S1]. At L0 (1,433) it would
hairball; at L2 (one object) there is nothing to draw. **L1 is the only level where the schema
graph is legitimate, and that is why it lives here and not on the front page.**

### 7.1 Wireframe

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CLARITY › AUSTRALIA › GOVERNMENT MONEY OUT                              37 objects · 1,587,901 rows│
│ "The strongest evidence base in the database. Federal is excellent; states are one table at best." │
├──────────────┬──────────────────────────────────────┬──────────────────┬─────────────────────────┤
│ RAIL         │ THE CONSTELLATION  37 nodes · 61 edges│ COVERAGE MATRIX  │ WHAT THIS DOMAIN LACKS  │
│ (unchanged,  │                                      │ 37 × 8           │                         │
│  filters     │                ┌──────────────┐      │                  │ PURPOSE    32/37  ████▊ │
│  carried     │        ┌───────│ austender_   │      │ OBJ    R F P O J U E S│ OWNER       4/37  ▌     │
│  down)       │        │  abn  │ contracts    │      │ ─────  ─ ─ ─ ─ ─ ─ ─ ─│ FRESH ≤30d 29/37  ███▊  │
│              │        │       │   823,620    │      │ austen █ █ █ █ █ █ ~ █│ SCHEDULED   2/9   ▉     │
│ + this level │        ▼       └──────┬───────┘      │ grantc █ █ █ + █ █ █ █│   matviews              │
│   adds:      │  ┌──────────┐         │ abn          │ state_ █ ~ █ + █ █ █ █│                         │
│              │  │gs_entities│◀───────┘              │ rogs_j █ ~ █ + + █ █ ~│ ⚠ 4 objects in this     │
│ MECHANISM    │  │ 609,448  │◀──────┐                │ vic_gr █ ~ █ + + + █ █│   domain are read by    │
│ ☑ fk    24   │  │ ⬤ spine  │       │ gs_entity_id   │ dss_pa █ █ + + + █ █ █│   nothing at all:       │
│ ☑ lineage 19 │  └────┬─────┘       │                │ ndis_p █ █ + + × + █ █│   · procurement_alerts  │
│ ☑ abn   14   │       │ uuid   ┌────┴──────┐         │ …31 more             │     53,223 rows         │
│ ☐ name   4   │       ▼        │justice_   │         │                      │   · mv_grant_contract_  │
│              │  ┌──────────┐  │funding    │         │ R rows  F fresh      │     overlap             │
│ SHOW         │  │grantconn-│  │ 157,116   │         │ P purpose  O owner   │   · 2 more              │
│ ☑ within  37 │  │ect_awards│  │ ⚠ 2 defs  │         │ J joined   U used    │   [ show them ]         │
│ ☑ to spine 9 │  │ 291,264  │  └───────────┘         │ E exposure S sched   │                         │
│ ☐ empty   3  │  │ 72.4%    │                        │                      │ ⚠ CONFLICT              │
│ ☐ cruft   1  │  │ ⚠ 68,172 │   ○ ○ ○ ○ ○  ← 6 nodes │ a column of + is a   │ "justice funding,       │
│              │  │  orphans │     ○         hidden by│ gap you can see from │ cleaned" has TWO live   │
│ NODE SIZE    │  └──────────┘               your     │ two metres.          │ definitions:            │
│ ● log(rows)  │                             filter   │                      │ view 151,866 rows       │
│ ○ degree     │  ⬤ spine  ● table  ◆ matview         │ [ sort by gaps ▾ ]   │ vs measure_kind='grant' │
│ ○ importance │  ▣ view   ▷ function  ○ filtered out │                      │ 126,673 rows / $46.1bn  │
│              │  ─── fk   ┄┄┄ abn/name   ═══ lineage │                      │ [ resolve → ]           │
└──────────────┴──────────────────────────────────────┴──────────────────┴─────────────────────────┘
```

### 7.2 Panels, components, queries

| Panel | Component | Type | Query |
|---|---|---|---|
| Standfirst (the one-line truth) | `<DomainHeader>` | Server | static: the 14 lines from `CANONICAL-DATA-MAP` §2.1, held in `src/lib/clarity/domains.ts` as typed constants with a CI test asserting all 14 exist |
| Constellation | `<DomainConstellation>` | **Client**, `react-force-graph-2d` | see below |
| Coverage matrix | `<CoverageMatrix>` | **Client** (sort) | filtered from the estate payload — no extra query |
| Lacks panel | `<DomainGaps>` | Server | `SELECT metric_key, numerator, denominator FROM …` scoped by `domain=$1` |
| Definition conflicts | `<MetricConflicts>` | Server | `SELECT * FROM clarity_metric_definition WHERE concept IN (…) AND domain=$1` |

**Constellation query** (`/api/clarity/domain/[d]`):

```sql
WITH members AS (
  SELECT object_key, object_name, object_kind, row_count, degree, importance, state,
         has_purpose, has_use, verdict
  FROM clarity_object
  WHERE domain = $1 AND missing_since IS NULL AND NOT act_business
),
edges AS (
  SELECT e.src_object, e.tgt_object, e.mechanism, e.declared,
         e.match_rate, e.match_numerator, e.match_denominator, e.match_measured_at
  FROM clarity_edge e
  WHERE (e.src_object IN (SELECT object_key FROM members)
      OR e.tgt_object IN (SELECT object_key FROM members))
),
-- one hop out to the spine, so the domain is never drawn as an island
spokes AS (
  SELECT object_key, object_name, object_kind, row_count, degree, importance, state
  FROM clarity_object
  WHERE object_key IN (SELECT tgt_object FROM edges UNION SELECT src_object FROM edges)
    AND domain IS DISTINCT FROM $1
    AND lifecycle IN ('core_source','crosswalk')      -- spine + registries only
)
SELECT json_build_object('members', …, 'spokes', …, 'edges', …);
```

Node budget: members (≤104) + spokes (≤~15, capped) = **≤119**. Inside the band. If a future
domain exceeds 150 the view **refuses the graph** and prints: *"This domain holds N objects. Above
150 a node-link diagram stops being readable, so the matrix is shown instead."* — the refusal
contract (§13) doing its job rather than a hairball being shipped.

**UNFILED is the one domain that always refuses.** 621 objects. Its L1 shows the coverage matrix,
a triage queue sorted by `refs_app DESC` (the views the app actually reads, first), and a
lineage graph **seeded from a chosen base table and capped at 60 nodes** — which is L4's
expand-on-demand pattern applied to schema instead of entities. Semantic zoom degrading correctly
under load, on purpose.

### 7.3 States

- **Loading:** constellation renders the node ring in `#E8E8E8` at final positions (positions come
  from the server, not from a client force run — see §15.3), then fills. Matrix renders rows
  immediately from the already-shipped estate payload, so the right half is never empty.
- **Empty domain:** impossible for D1–D13. If a filter empties it: *"Your filter leaves 0 of 37
  objects. The 37 are still drawn, hollow."* Never a blank canvas.
- **Error:** constellation fails → matrix stays, with *"The join graph could not be loaded. The
  coverage matrix below is complete."*

---

## 8. L2 · THE DATASET — `/clarity/o/[objectKey]`

**The sentence:** *"`justice_funding` has 157,116 rows, 45 declared joins, and its edge back to
`gs_relationships` resolves 0.0% of the time."*
**Form:** identity header + column profile with a nullity strip + **the join ledger** + lineage +
code references + history sparkline.
**The star panel is the join ledger,** because a join with a *measured* match rate is the single
most useful cell in the whole catalog and nothing else in either repo has one.

### 8.1 Wireframe

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CLARITY › AUSTRALIA › JUSTICE & DETENTION › justice_funding                                       │
├──────────────┬──────────────────────────────────────────────────────────────┬─────────────────────┤
│ RAIL         │ justice_funding                       [KEEP] [SUSPECT] [CRUFT]│ WHAT WE DO NOT KNOW │
│              │ table · D8 Justice & detention · T1 core source                │ ABOUT THIS OBJECT   │
│ (carried)    │ 157,116 rows (exact, 340ms) · 84 MB · 23 columns · degree 45   │                     │
│              │ last write 2026-08-14 via created_at (indexed) · importance .930│ + no owner_team     │
│ + this level │ read by 133 app files · 138 scripts · 6 db functions           │ + no licence        │
│   adds:      │ RLS on · 3 policies · not anon-readable · pii_level: low        │ + no sla_hours      │
│              │                                                                │ + no public_caveat  │
│ COLUMN       │ ⚠ SHRANK: 218,022 → 157,116 rows on 2026-06-11. No alarm fired.│   [ fill these → ]  │
│  FILTER      │   ▁▁▁▁▁▁███████▇▇▇▇▂▂▂▂▂▂▂▂▂▂▂▂▂  90-day row count             │                     │
│ ☐ nullable   ├────────────────────────────────────────────────────────────────┤ ⚠ ONE OF TWO        │
│ ☐ <50% full  │ COLUMNS  23                          nullity ▁▁█▁▁▁▁▂▁▁▁▁▁▁▁▁▁ │   DEFINITIONS       │
│ ☐ is a key   │ ┌────────────────────┬─────────┬──────┬───────────────────────┐│ "justice funding,   │
│ ☐ is vector  │ │ COLUMN             │ TYPE    │ FILL │ JOINS TO              ││  cleaned"           │
│              │ ├────────────────────┼─────────┼──────┼───────────────────────┤│ this table's        │
│ TAB          │ │ id                 │ uuid    │ 100% │ pk                    ││ measure_kind='grant'│
│ ▸ columns    │ │ recipient_name     │ text    │ 100% │ ┄ name → gs_entities  ││ = 126,673 rows      │
│   joins   4  │ │ recipient_abn      │ text    │  95% │ ┄ abn  → gs_entities  ││   $46.097bn         │
│   lineage 7  │ │ gs_entity_id       │ uuid    │ 93.6%│ → gs_entities.id  █   ││ view justice_       │
│   code   277 │ │ amount_dollars     │ numeric │  99% │ ·                     ││ funding_clean       │
│   history    │ │ measure_kind       │ text    │ 100% │ ⚠ 4 values, see right ││ = 151,866 rows      │
│   sample     │ │ state              │ text    │  88% │ ┄ → gs_entities.state ││ Gap: 25,193 rows    │
│   governance │ │ financial_year     │ text    │  97% │ ·                     ││ [ pick canonical → ]│
│              │ │ topics             │ text[]  │  61% │ ⚑ GIN, use @>         │├─────────────────────┤
│ SIMILAR      │ │ …15 more, virtualised past 50                             ││ THE FRONTIER        │
│ (structural, │ └────────────────────┴─────────┴──────┴───────────────────────┘│                     │
│  not vector) │                                                                │ ▸ 6,363 rows here   │
│ ▸ alma_      │ THE JOIN LEDGER — every edge, with its MEASURED fill rate      │   have no gs_entity_│
│   inter-     │ ┌────────────────────────────┬──────────┬──────────┬──────────┐│   id and a valid    │
│   ventions   │ │ FROM → TO                  │ MECHANISM│  MEASURED│  WHEN    ││   ABN. One insert   │
│   (129)      │ ├────────────────────────────┼──────────┼──────────┼──────────┤│   from abr_registry │
│ ▸ gs_entities│ │ .gs_entity_id → gs_entities│ fk uuid  │ █ 93.6%  │ 14 Aug   ││   closes it.   S ★  │
│   (97)       │ │                            │          │ ████████▉│ 147,113/ ││                     │
│ ▸ organiza-  │ │                            │          │          │ 157,116  ││ ▸ 85% of orgs given │
│   tions (87) │ │ .recipient_abn → gs_ent.abn│ ┄ abn    │ █ 95.0%  │ 14 Aug   ││   money here have   │
│ ▸ austender_ │ │ .state → gs_entities.state │ ┄ text   │ ~ 88.0%  │ 14 Aug   ││   no ALMA evidence  │
│   contracts  │ │ gs_relationships.source_   │ uuid     │ × 0.0%   │ 14 Aug   ││   record linked.    │
│   (46)       │ │  record_id → .id           │ stamp    │ ░░░░░░░░░│ 0/49,426 ││   That is a         │
│              │ │ ⛔ DEAD KEY NAMESPACE. The uuids in source_record_id match   ││   publishable       │
│ "used        │ │    neither .id nor .source_statement_id. Drill-through from  ││   finding, not a    │
│  together in │ │    an edge to its grant is UNBUILDABLE until this is rebuilt.││   data defect. M ★  │
│  report-     │ │    [ open the diagnosis ]                                   ││                     │
│  service.ts" │ └────────────────────────────┴──────────┴──────────┴──────────┘│                     │
│              │ [ EXTRACT ▾ ]  copy SELECT · copy join SQL · open in /graph    │                     │
└──────────────┴──────────────────────────────────────────────────────────────┴─────────────────────┘
```

### 8.2 Panels, components, queries

| Panel | Component | Type | Query |
|---|---|---|---|
| Identity header | `<ObjectHeader>` | Server | `SELECT * FROM v_clarity_ledger WHERE object_key=$1` — 1 row |
| Verdict control | `<VerdictControl>` | **Client** | POST `/api/clarity/verdict`; CRUFT opens a required-reason field. Server rejects a cruft verdict while `refs_app+refs_script+refs_db_function+lineage_in > 0` — the DB CHECK already enforces it, the UI explains it: *"3 app files still read this. A cruft verdict is refused while anything reads it."* |
| History sparkline | `<HistorySpark>` | Server, recharts `<LineChart>` | `SELECT snapshot_at, row_count, bytes FROM clarity_object_history WHERE object_key=$1 ORDER BY 1` |
| Column profile | `<ColumnProfile>` | **Client** (virtualised past 50) | `SELECT ordinal, column_name, data_type, is_nullable, fill_rate, is_vector, vector_dim FROM clarity_column WHERE object_key=$1 ORDER BY ordinal` |
| Nullity strip | `<NullityStrip>` | Server, inline SVG | same rows — one 4px bar per column, height ∝ fill (missingno's nullity matrix, per-object [R]) |
| **Join ledger** | `<JoinLedger>` | Server | below |
| Lineage | `<LineagePanel>` | Server | `SELECT … FROM clarity_edge WHERE mechanism='view_lineage' AND (src_object=$1 OR tgt_object=$1)` |
| Code references | `<CodeRefs>` | Server | `SELECT ref_class, file_path, count(*) FROM clarity_code_ref WHERE object_key=$1 GROUP BY 1,2 ORDER BY 1, 3 DESC` — grouped app / script / migration / db_function / trigger, **migration in its own group** because DDL-only is not use |
| Similar objects | `<StructuralNeighbours>` | Server | the structural-relatedness query from clarity-data-layer §6.4(a) — lineage siblings + co-referencing files + declared joins. **Not embeddings**: measured at 11.3s for a single `gs_entities` ANN search, and the neighbours are lexical anyway [R] |
| Governance | `<GovernanceRow>` | Server | the `data_catalog` LEFT JOIN already in `v_clarity_ledger`; unset fields render `+` and are inline-editable |

**The join ledger query:**

```sql
SELECT e.src_object, e.src_column, e.tgt_object, e.tgt_column,
       e.mechanism, e.declared,
       e.match_rate, e.match_numerator, e.match_denominator,
       e.match_method, e.match_measured_at, e.note
FROM clarity_edge e
WHERE (e.src_object = $1 OR e.tgt_object = $1)
  AND e.mechanism <> 'view_lineage'
ORDER BY (e.match_rate IS NULL),                -- unmeasured last
         (e.match_rate < 0.5) DESC,             -- broken FIRST
         e.match_rate DESC;
```

**Broken joins sort to the top.** That inversion is deliberate: a catalog that sorts by quality
descending buries its own worst finding on page two.

### 8.3 States

- **Never measured** (`match_rate IS NULL`) → `+` and the row reads *"Not measured. This join is
  declared but its fill rate has never been computed."* with a `[ measure now ]` action that
  enqueues it rather than running it inline (the 8-second RPC ceiling makes an inline measure
  impossible on anything large [R]).
- **Timed out** → `~` with the method printed (`LIMIT n=50000`, `3s cap`).
- **Zero** → `×` plus a full-width explanation row, as drawn.
- **Object is a function** → columns/nullity/joins are `·` and the viewport switches to: signature,
  language, volatility, `SECURITY DEFINER`, `anon_execute`, trigger attachments, `prosrc` length,
  and call sites. Same frame, different content — 409 objects that no prior artefact has ever
  rendered.
- **Object is missing** (`missing_since IS NOT NULL`) → the page still renders, in muted, with
  *"This object disappeared from the schema on 12 Aug. Its history is kept."* The row is never
  deleted [R, clarity-data-layer §3.2].

---

## 9. L2b · THE COLUMN — `/clarity/o/[objectKey]/c/[column]`

A shallow but load-bearing level: it is where a *join* is diagnosed, and joins are the thing Ben
means by "how it connects".

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CLARITY › … › justice_funding › gs_entity_id                                                      │
├──────────────┬──────────────────────────────────────────────────────────────┬─────────────────────┤
│ RAIL         │ gs_entity_id     uuid · nullable · 93.65% filled              │ IF THIS WERE 100%   │
│              │ ████████████████████████████████████████████▉░░░  147,113     │                     │
│              │ ░ 10,003 null                                                 │ 6,363 of the 10,003 │
│              │                                                               │ nulls have a valid  │
│              │ WHERE IT POINTS      gs_entities.id                           │ recipient_abn that  │
│              │ ┌───────────────────────────────────────────────────────────┐ │ resolves in         │
│              │ │ resolves     █ 147,113  93.65%  ████████████████████████▉ │ │ abr_registry.       │
│              │ │ null         + 10,003    6.37%  ▊                         │ │                     │
│              │ │ orphaned     × 0         0.00%                            │ │ 3,640 have no ABN   │
│              │ │ measured 2026-08-14 · full scan · 340ms                    │ │ at all — these are  │
│              │ └───────────────────────────────────────────────────────────┘ │ genuinely           │
│              │                                                               │ unplaceable, not    │
│              │ THE 10,003 NULLS, BY REASON  ← reason codes, not a blank      │ merely unresolved.  │
│              │ ┌───────────────────────────────────────────────────────────┐ │                     │
│              │ │ has ABN, entity never created   6,363  ████████████▌   S★ │ │ [ open the 6,363 ]  │
│              │ │ no ABN in the source row        3,640  ███████            │ │ [ open the 3,640 ]  │
│              │ └───────────────────────────────────────────────────────────┘ │                     │
│              │ [ copy the 6,363 ABNs ]  [ copy the backfill SQL ]            │                     │
└──────────────┴──────────────────────────────────────────────────────────────┴─────────────────────┘
```

The pattern shown here — **nulls broken down by reason code, never as one number** — is lifted
directly from the LGA attribution work, where every unplaced row is reason-coded and a NULL LGA is
"a deliberate refusal, not missing data" [R, memory / CANONICAL-DATA-MAP L3]. It generalises: any
column with a `*_source` or `*_reason` sibling gets this breakdown automatically; any column
without one gets a `+` and *"Nulls here are not reason-coded. We cannot tell you why."*

**Query.** Column fill comes from `clarity_column.fill_rate` (nightly). The reason breakdown is
per-object and cannot be generic, so it is registered: `clarity_null_reason(object_key, column_name,
reason_sql)` — a seeded table, one row per reason-coded column, ~12 rows to start. Unregistered
columns show the honest `+`.

---

## 10. L3 · THE CROSS-SECTION — `/clarity/x/[matrix]`

**The sentence:** *"Companies hold 699,387 contract edges; foundations hold almost none — and the
two biggest nodes in the whole graph are procurement categories, not organisations."*
**Form:** adjacency matrix / PivotGraph.
**Why:** 11 × 11 = 121 cells [V]. Above Ghoniem's ~20-node threshold, matrices beat node-link on
every task except path-finding [R, S12]. And a matrix has **zero hairball risk by construction**:
it cannot degrade, only get denser.

This is the level BUILD-SPEC has no equivalent for, and it is the level closest to Ben's actual
vision — "cross-sectioned in a way no one else does".

### 10.1 The four matrices

| Key | Rows × Cols | Cell | Cardinality | Source |
|---|---|---|---|---|
| `flow` | entity_type × entity_type | edges, $ | **11 × 11** [V] | `mv_clarity_flow` (§10.3) |
| `join` | domain × domain | best measured match rate | **14 × 14** | `clarity_edge` |
| `topic` | ALMA topic × funding measure_kind | orgs, $, evidence coverage | ~18 × 4 | `justice_funding` × `alma_interventions` |
| `place` | state × system | coverage % | 8 × 7 | `mv_entity_power_index` + friends |

### 10.2 Wireframe — the flow matrix

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CLARITY › AUSTRALIA › CROSS-SECTIONS › HOW KINDS OF ORGANISATION FUND KINDS OF ORGANISATION       │
│ 3,429,184 edges · 11 entity types · relationship: [ ALL ▾ ] grant contract donation directorship… │
├──────────────┬──────────────────────────────────────────────────────────────┬─────────────────────┤
│ RAIL         │              ── TARGET ──▶                                    │ WHAT THIS MATRIX    │
│              │        comp  pers  char  fdn  prog  ic   se   gov  pol  tr  ?│ CANNOT SAY          │
│ MEASURE      │  comp  ▓▓▓▓  ░░░░  ████  ░░   ████  ░░   ░░   ██   ▓▓   ·   ·│                     │
│ ● edges      │  pers  ████  ░░░░  ████  ▓▓   ░░    ▓▓   ░░   ░░   ▓▓   ·   ·│ Edge counts are     │
│ ○ dollars    │  char  ▓▓░░  ░░░░  ▓▓░░  ░░   ░░    ░░   ░░   ░░   ░    ·   ·│ complete. Dollars   │
│ ○ orgs       │  fdn   ░░    ░░    ░░    ░    ░     ░    ░    ·    ·    ·   ·│ are not: `amount`   │
│ ○ $ / edge   │  prog  ████  ░░    ▓▓    ░    ░     ░    ░    ▓▓   ·    ·   ·│ is 77.43% populated │
│              │  ic    ░░    ░░    ░░    ░    ░     ░    ░    ░    ·    ·   ·│ (2,655,257 of       │
│ SCALE        │  se    ░░    ░░    ░░    ░    ░     ░    ░    ░    ·    ·   ·│ 3,429,184) [V], so  │
│ ● log        │  gov   ████  ░░    ████  ░    ████  ▓▓   ░░   ▓▓   ░    ·   ·│ a $ cell is a floor,│
│ ○ linear     │  pol   ░░    ▓▓    ░░    ░    ░     ·    ·    ░    ▓▓   ·   ·│ never a total.      │
│              │  tr    ·     ·     ·     ·    ·     ·    ·    ·    ·    ·   ·│                     │
│ ORDER        │  ?     ·     ·     ·     ·    ·     ·    ·    ·    ·    ·   ·│ ⚠ THE YEAR SLIDER   │
│ ● by volume  │                                                              │ DROPS 30%. `year` is│
│ ○ by name    │  SELECTED  company ──contract──▶ charity                     │ 69.66% populated    │
│ ○ by cluster │  ┌─────────────────────────────────────────────────────────┐ │ (2,388,813) [V]. Any│
│              │  │ 41,882 edges · $2.1bn recorded (amount present on 71%)   │ │ year filter silently│
│ RELATIONSHIP │  │ top counterparties, both sides:                          │ │ excludes 1,040,371  │
│ ☑ contract   │  │   Dept of Defence      → 270,864 edges  ⚠ HUB            │ ├─────────────────────┤
│ ☑ grant      │  │   Services Australia   →  18,220 edges                   │ │ THE FINDING         │
│ ☑ donation   │  │   NDIA                 →  11,905 edges                   │ │                     │
│ ☑ directorship│ │ [ open these 41,882 as a list ]  [ open in /graph ]      │ │ The two largest     │
│ ☐ member_of  │  └─────────────────────────────────────────────────────────┘ │ nodes in the entire │
│ ☐ shared_dir │                                                              │ graph are           │
│ ☐ lobbies_for│  · <100   ░ <10k   ▓ <100k   █ ≥100k        log scale        │ entity_type=        │
│ ☐ subsidiary │                                                              │ 'program':          │
│ ☐ affiliated │  ⚑ THE DIAGONAL IS NOT SELF-FUNDING. company→company is      │ "Specialised        │
│ ☐ partners   │    real inter-corporate flow; person→person is board co-     │  Supplies and       │
│              │    membership. Read each diagonal cell's definition on hover.│  Services" 330,460  │
│              │                                                              │ "Specialised        │
│              │                                                              │  Support Services"  │
│              │                                                              │ 274,675.            │
│              │                                                              │ Together 17.6% of   │
│              │                                                              │ all edges. These    │
│              │                                                              │ are AusTender       │
│              │                                                              │ CATEGORIES, not     │
│              │                                                              │ organisations.      │
│              │                                                              │ Every centrality    │
│              │                                                              │ measure in the      │
│              │                                                              │ product is wrong    │
│              │                                                              │ until they are      │
│              │                                                              │ reclassified. M ★★  │
└──────────────┴──────────────────────────────────────────────────────────────┴─────────────────────┘
```

### 10.3 The one new matview this design needs

Everything else reuses what exists. L3's flow matrix cannot be computed live — a `GROUP BY` over
3.43M edges took ~40s in my session [V] — so it needs a nightly aggregate. It is tiny.

```sql
-- DELIVERABLE, UNAPPLIED. Apply with:
--   cd /Users/benknight/Code/grantscope && source .env && \
--   PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000300_clarity_flow_matrix.sql
-- Then register in mv_refresh_registry (tier='nightly') — do NOT hardcode a new list.
-- Max size: 11 source types × 11 target types × 10 relationship types = 1,210 rows.
CREATE MATERIALIZED VIEW mv_clarity_flow AS
SELECT s.entity_type                              AS source_type,
       t.entity_type                              AS target_type,
       r.relationship_type,
       count(*)                                   AS edges,
       count(*) FILTER (WHERE r.amount IS NOT NULL) AS edges_with_amount,
       sum(r.amount)                              AS amount_recorded,
       count(DISTINCT r.source_entity_id)         AS distinct_sources,
       count(DISTINCT r.target_entity_id)         AS distinct_targets,
       min(r.year) AS year_min, max(r.year) AS year_max
FROM gs_relationships r
JOIN gs_entities s ON s.id = r.source_entity_id
JOIN gs_entities t ON t.id = r.target_entity_id
GROUP BY 1,2,3;
CREATE UNIQUE INDEX ON mv_clarity_flow (source_type, target_type, relationship_type);
```

`edges_with_amount` is not decoration: it is what lets the cell print *"$2.1bn recorded, amount
present on 71% of edges"* instead of a total that reads as complete. A dollar figure without its
denominator is the exact failure the `clarity_metric_definition` registry exists to prevent.

### 10.4 The join matrix — §4.1's mermaid diagram made quantitative

14 × 14 domains, cell = the best measured match rate on any edge between them, glyph-coded.
This turns the canonical map's static diagram into something you can interrogate: click
`D8 → D1` and get the four edges that connect justice to the spine with their measured rates
(93.6%, 95.0%, 0.0%, …). Click `D12 → D1` and get `+` with *"Media mentions are arrays of names,
not ids. No join exists to measure."*

**Query:** pure `clarity_edge` + `clarity_object.domain`, ~200 rows. Server Component, inline SVG,
no client JS at all except the tooltip.

### 10.5 Saved cross-sections

Below the matrix, the nine questions from `OPPORTUNITY-MAP.md` §1A that **actually ran**, each as
a card with its tables, its binding join and its measured coverage, and a `[ run it ]` that
descends to a result list. These are Kumu's "perspectives" [R, S20]: named, URL-addressable,
described. The registry lives in `src/lib/clarity/cross-sections.ts` with the same CI guard as
`surface.ts` — a cross-section whose binding join drops below its stated floor **fails the build**.

---

## 11. L4 · THE ENTITY — `/clarity/e/[gsId]`

**The sentence:** *"NPY Women's Council is connected to 23 organisations, two of them through a
shared board seat, and 6 of the 8 systems we track hold nothing about it."*
**Form:** DOI ego network (van Ham & Perer) + a system-coverage strip.
**Caps, from §2.2, all verified:** expand freely at degree ≤150 (99%+ of connected nodes); force
the Hub Sheet above it (2,594 nodes); render the Isolate state when the entity is absent from
`mv_gs_entity_stats` (209,172 entities).

### 11.1 Wireframe — the normal case

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CLARITY › … › justice_funding › GS-41822  NPY WOMEN'S COUNCIL      ABN 89 006 ··· · charity       │
├──────────────┬──────────────────────────────────────────────────────────────┬─────────────────────┤
│ RAIL         │ WHICH SYSTEMS HOLD THIS ORGANISATION   6 of 12               │ WHAT WE DO NOT HOLD │
│              │ ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐            │                     │
│ EXPAND BY    │ │ABR│ASC│ACN│ORC│AUS│GRC│JUS│DON│NDI│ALM│BRD│MED│            │ + no ASIC record    │
│ ☑ funding 14 │ │ █ │ + │ █ │ █ │ + │ █ │ █ │ + │ + │ █ │ █ │ + │            │   linked (it is a   │
│ ☑ board    6 │ └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘            │   charity, so this  │
│ ☐ contract 0 │  █ has rows   + no rows linked   × join broken               │   is expected)      │
│ ☐ shared     │                                                              │ + no AusTender      │
│   address    │ THE NEIGHBOURHOOD   23 of 23 shown · 1 hop                   │   contract rows     │
│              │                                                              │   reference this    │
│ NETWORK SIZE │                     ╭──────────────────╮                     │   ABN               │
│ ├──●───────┤ │        ┌────────────┤ ((( NPY W.C. ))) ├──────────┐          │ + no political      │
│  30  120 400 │        │            ╰────────┬─────────╯          │          │   donation rows     │
│              │        │                     │                    │          │ + no NDIS provider  │
│ INTEREST     │   ┌────▼────┐          ┌─────▼─────┐        ┌─────▼─────┐    │   registration      │
│ money  ├─●──┤ │   │  NIAA   │          │    NTG    │        │ Board × 6 │    │ + no media article  │
│ search ├───●┤ │   │ $4.2M   │          │  $1.8M    │        │  ○ ○ ○    │    │   linked            │
│ hops   ├─●──┤ │   │ ⚠ 4,182 │          │ ⚠ 891     │        │  ○ ○ ○    │    │                     │
│              │   │  conns  │          │  conns    │        └───────────┘    │ Each line above is  │
│ EDGE QUALITY │   └─────────┘          └───────────┘                         │ a statement about   │
│ ☑ high  19   │      hub — collapsed      hub — collapsed                    │ THIS DATABASE, not  │
│ ☑ medium 4   │      [ open sheet ]       [ open sheet ]                     │ about this          │
│ ☐ low    0   │                                                              │ organisation.       │
│ ☐ name-      │   ○ person  ● org  ▣ program  ⬡ place   ((( ))) = focus      ├─────────────────────┤
│   matched    │   ┈┈ hidden neighbours, count printed on node                │ THE FRONTIER        │
│   only       │                                                              │ ▸ This org appears  │
│              │ ⚠ 2 HOPS FROM HERE IS ~5,400 NODES. NOT DRAWABLE.            │   in ALMA with 3    │
│ YEARS        │   The 2-hop view is available as a ranked table instead.     │   interventions and │
│ ├──●──●───┤  │   [ open 2-hop as a table (5,400 rows) ]                     │   in justice_funding│
│ 2019   2025  │   ⚑ 4 of this entity's 23 edges carry no year and are        │   with 11 grants,   │
│ ⚑ excl. 4    │     excluded by the slider. Never dropped silently.          │   and the two are   │
│              │                                                              │   NOT linked to     │
│              │ EDGE ▸ NIAA → NPY Women's Council · grant · $4,200,000 ·     │   each other.       │
│              │ FY2024 · dataset grantconnect · confidence high ·            │   Effort M          │
│              │ source grants.gov.au/Go/Show?GoUuid=… [ open record L5 → ]   │                     │
└──────────────┴──────────────────────────────────────────────────────────────┴─────────────────────┘
```

### 11.2 Queries — hop-by-hop, never `WITH RECURSIVE`

Pre-flight (one indexed lookup, decides everything):

```sql
SELECT gs_id, canonical_name, entity_type, abn,
       total_relationships, distinct_counterparties, top_counterparty_share,
       total_inbound_amount, total_outbound_amount, type_breakdown, year_distribution
FROM mv_gs_entity_stats WHERE gs_id = $1;
-- No row  → the ISOLATE state (§11.3). 209,172 entities land here. [V/I]
-- total_relationships > 150 → the HUB SHEET (§11.4). 2,594 entities. [V]
-- otherwise → draw it.
```

Hop 1, capped, both directions, one indexed query each:

```sql
SELECT r.id, r.relationship_type, r.amount, r.year, r.dataset, r.confidence,
       e.gs_id, e.canonical_name, e.entity_type,
       s.total_relationships AS neighbour_degree
FROM gs_relationships r
JOIN gs_entities e ON e.id = r.target_entity_id
LEFT JOIN mv_gs_entity_stats s ON s.id = e.id
WHERE r.source_entity_id = $1
  AND ($2::text[] IS NULL OR r.relationship_type = ANY($2))
ORDER BY r.amount DESC NULLS LAST, r.year DESC
LIMIT 200;
-- mirrored on target_entity_id, then merged and deduped in the API layer.
```

Plus, always, a separate true count so the UI can print `4,182 connections (showing top 200)` —
van Ham & Perer's exact pattern [R, S1]:

```sql
SELECT count(*) FROM gs_relationships
WHERE source_entity_id = $1 OR target_entity_id = $1;
```

**Never** a recursive CTE on an unbounded frontier: the cited worst case is 47 seconds on a
335K-node tree where an in-memory BFS took 227ms [R, S41], and the RPC ceiling here is 8 seconds
[R]. Hop 2, when requested, queries only the ≤200 ids returned by hop 1.

### 11.3 The Isolate state — 34.3% of all entities land here

```
┌────────────────────────────────────────────────────────────────────────┐
│ THE NEIGHBOURHOOD                                                      │
│                                                                        │
│  No rows in gs_relationships reference this entity.                    │
│                                                                        │
│  209,172 of 609,448 entities (34.3%) are in this state. It is the      │
│  most common state an entity is in, and it is a fact about the         │
│  database, not about the organisation.                                 │
│                                                                        │
│  This entity was created from: ACNC charity register (2026-08-07)      │
│  Systems that would create an edge, and what they hold:                │
│    AusTender   + no rows carry this ABN                                │
│    GrantConnect + no rows carry this ABN                               │
│    justice_funding + no rows carry this ABN                            │
│    person_roles  + no rows carry this entity id                        │
│                                                                        │
│  [ search the money tables for this name instead ]                     │
└────────────────────────────────────────────────────────────────────────┘
```

This screen is why the "never render 'has no evidence'" rule needs a designed alternative rather
than a prohibition. The alternative is: name the systems, state what each holds, offer the name
search as the next move.

### 11.4 The Hub Sheet — 2,594 entities

Above degree 150 the ego network is refused and replaced with a **sheet**: a ranked, faceted table
of the hub's counterparties, with the facets that make it tractable — year, relationship type,
amount band, counterparty type, dataset. The header states the refusal:

```
⚠ Department of Defence holds 270,864 connections — 7.9% of every edge in the graph.
  A node-link diagram of this is not a picture, it is a solid disc. Showing the sheet.
  [ draw it anyway (will render ~200 of 270,864) ]
```

The escape hatch exists because refusing without an override is paternalistic; it prints exactly
what it will show and what it will drop.

### 11.5 The category-node warning

Any entity whose `entity_type='program'` and whose degree exceeds 10,000 gets a permanent banner:

```
⚠ THIS MAY NOT BE AN ORGANISATION. "Specialised Supplies and Services" is an AusTender
  procurement category materialised as an entity. It holds 330,460 edges — 9.6% of the graph.
  Centrality, power scores and "most connected" rankings that include it are wrong. [ triage → ]
```

Currently that rule fires on 2 entities [V, from the top-6 degree query] holding 605,135 edges
between them. This is not a hypothetical: it is a live data-quality defect that /clarity surfaces
on first render and that nothing else in either repo does.

---

## 12. THE FRONTIER — the opportunity object

"See the gaps" and "find opportunities" are two halves of one mechanism. A gap is a measured
absence; a **frontier item** is a gap plus what closing it unlocks plus its effort. The gap
register's 25 rows and the opportunity map's Q-list are the same list read from two ends, and
today they live in markdown that will rot.

```sql
-- DELIVERABLE, UNAPPLIED: supabase/migrations/20260815000400_clarity_frontier.sql
CREATE TABLE clarity_frontier (
  frontier_key   text PRIMARY KEY,
  title          text NOT NULL,
  gap_metric_key text REFERENCES clarity_gap_metric(metric_key),  -- the number that moves
  blocked_objects text[] NOT NULL,      -- where it surfaces: L2 pages for these objects
  blocked_domains text[],               -- and L1 pages for these domains
  unlocks        text NOT NULL,         -- the sentence: what becomes possible
  cross_section_key text,               -- the L3 view it makes buildable
  effort         text NOT NULL CHECK (effort IN ('S','M','L')),
  leverage       smallint NOT NULL CHECK (leverage BETWEEN 1 AND 5),
  evidence       text NOT NULL,         -- the measured fact, with its number
  status         text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','in_progress','done','declined')),
  decided_reason text,                  -- 'declined' requires one
  CONSTRAINT frontier_decline_needs_reason
    CHECK (status <> 'declined' OR (decided_reason IS NOT NULL AND btrim(decided_reason) <> ''))
);
```

Seeded with the 25 gap-register rows. It renders **contextually**: standing on
`civic_ministerial_diaries` at L2, the gutter shows *"1,728 diary rows carry `organisation_abn`,
unresolved to `gs_entities`. Resolve it and the access→money cross-section becomes buildable.
Effort: S. Leverage: 5."* Standing at L0 it shows the top three by leverage. Standing on D8 it
shows the four that touch justice.

The `[ open register → ]` link goes to a filtered L0, not to a separate page. **There is no
`/clarity/gaps` route.** A separate gaps page is a page nobody opens; a gutter that is present at
every depth is a thing you cannot avoid reading.

---

## 13. THE VIEW REGISTRY AND THE REFUSAL CONTRACT

Generalising `src/lib/atlas/layers.ts`, which already forces every place-claim to carry a caveat,
an honest geography and a consent tier [R].

```ts
// src/lib/clarity/views.ts — every panel in /clarity is registered here or it does not ship.
export interface ClarityView {
  key: string;
  level: 'L0'|'L1'|'L2'|'L2b'|'L3'|'L4'|'L5';
  title: string;
  /** The sentence this view lets a reader finish, and no other view does. */
  sentence: string;
  form: 'mosaic'|'matrix'|'node-link'|'ledger'|'profile'|'record'|'sheet';
  /** Mandatory. A view with no caveat cannot be registered; the test rejects empty. */
  caveat: string;
  /** What is deterministically excluded, printed in the caption. Never a silent sample. */
  excluded: string[];
  /** Machine-checkable conditions under which this view declines to render, each with
   *  the replacement form and the sentence shown instead. */
  refusesWhen: Array<{ test: (ctx: ViewContext) => boolean; because: string; insteadShow: ClarityView['form'] }>;
  status: 'live'|'declared';       // declared views appear and say "we cannot show you this yet"
  consent: 'public'|'admin';
}
```

The refusals that ship in v1, each traceable to a measured fact:

| View | Refuses when | Because | Instead |
|---|---|---|---|
| L1 constellation | `nodes > 150` | node-link stops being readable [R, S12/S1] | matrix |
| L4 ego network | `degree > 150` | 2,594 nodes exceed it; max is 330,460 [V] | sheet |
| L4 ego network | absent from `mv_gs_entity_stats` | 209,172 entities have no edge [V] | isolate panel |
| L5 drill-through | the edge's `match_rate = 0` | `source_record_id` is a dead key namespace, 0 of 49,426 [R] | refusal panel naming the key |
| any dollar cell | `edges_with_amount / edges < 1` | `amount` is **77.43%** populated — 2,655,257 of 3,429,184 [V] | prints "recorded, floor" + the denominator |
| any year filter | *always* | `year` is **69.66%** populated — 2,388,813 of 3,429,184 [V]; a year range silently drops 1,040,371 edges | prints "excludes 1,040,371 edges with no year" beside the slider |
| any rate | denominator below its floor | small-population instability [R, §4.2] | suppressed with a printed floor |
| L0 mosaic | *always* refuses area encoding | 7 orders of magnitude in row count [R] | equal-area tiles |
| L1 UNFILED | *always* refuses the full graph | 621 nodes | seeded lineage, cap 60 |

A CI test walks the registry and asserts: every view has a non-empty `caveat` and `sentence`; no
two live views share a `sentence`; every `refusesWhen.because` is non-empty. That is the
`surface-coverage.test.ts` discipline — the only artefact in either repo that demonstrably has not
rotted [R] — applied to this surface.

---

## 14. LENSES — one layout, eight encodings

Applied simultaneously to the mosaic, the constellation node fill, the matrix cell fill and the
ledger row rule. Switching a lens **never** relayouts anything.

| Lens | Encodes | Bands | The `+` case |
|---|---|---|---|
| **STATE** (default) | live · tiny · empty · staging · backup · superseded | black · yellow · red · yellow-hatch · red-hatch · muted | — |
| **FRESHNESS** | days since last write | ≤7 black · ≤30 black-70 · ≤180 yellow · older red · unknowable `+` blue | 204 objects with no freshness column, and **97 of 98 matviews** [R] |
| **SIZE** | log₁₀(rows) | 6 bands, black ramp | empty = red, not pale |
| **FOOTPRINT** | log₁₀(bytes) | 6 bands | views and functions = `·` |
| **CONNECTION** | degree | 0 `+` · 1–4 · 5–14 · 15–40 · 41+ | degree 0 is a gap, not a low value |
| **USE** | distinct files reading it (app + script + db_function), migrations excluded | 0 `+` blue · 1–5 · 6–25 · 26+ | 184 dark objects [R] |
| **KNOWN** | purpose + owner + domain, 0–3 | 3 black · 2 · 1 · 0 blue | the 621 UNFILED go solid blue |
| **EXPOSURE** | anon_readable × pii_level | safe black · anon-readable yellow · anon + PII red · definer-rights view red-hatch | 451 anon-readable, 103 definer views [R] |

Each lens prints its definition sentence beside the legend — *"FRESHNESS: days since the newest
value in this object's chosen timestamp column. 97 of 98 materialized views have no such column;
their freshness comes from `mv_refresh_log`, which knows only 44 of them."* A legend without a
definition is how a lens becomes a decoration.

---

## 15. INTERACTION MODEL

### 15.1 URL state — the whole position is one copy-pasteable string

```
/clarity/d/money-out
  ?lens=freshness
  &scope=civic
  &kind=table,matview
  &tier=T1,T2
  &state=live
  &gap=no-owner
  &fresh=180
  &q=grant
  &sort=rows.desc
  &sel=austender_contracts,grantconnect_awards
  &rel=contract,grant          (L3/L4)
  &s=120&hops=1                (L4 DOI)
  &yr=2019-2025
```

Rules:
1. **Level-independent.** Changing level never drops a param. `sel` survives from L0 to L4.
2. **Additive facets are comma-lists**, ranges are `a-b`, sorts are `field.dir`.
3. **Every param is server-readable** — the Server Component that runs the query reads
   `searchParams` directly, so a pasted URL renders correctly on first paint with no client
   hydration flash.
4. **Implementation:** `useSearchParams()` + `router.replace(url, { scroll: false })`, the pattern
   JusticeHub `/explore` already ships [R]. **`nuqs` is not added.** The research recommends it and
   it would be cleaner, but the constraint is to favour what is installed; a single
   `useClarityParams()` hook wrapping the native API is ~60 lines and adds no dependency. Revisit
   if the param surface grows past ~15 keys.

### 15.2 Linked brushing — across panels *and* across depth

Within a level: selecting a mosaic tile highlights its ledger row, its matrix row, its
constellation node; hovering a matrix cell highlights the two axis labels and dims the rest.
Standard coordinated views.

Across depth is the part that is not standard, and it is the Atlas's core claim: **a filter is a
property of the space, not of a page.** Set `gap=no-owner` at L0, descend to D3, and the
constellation draws its 37 nodes with the 33 that *have* an owner hollowed out. Descend again to
`austender_contracts` and the join ledger is unchanged (the filter does not apply to columns) but
the rail still shows it, and the ribbon carries `… › filtered: no owner (1,408)`. **A filter that
cannot apply at the current level is shown as carried-but-inactive, never silently dropped.**

### 15.3 Layout stability — positions come from the server

Force layouts are non-deterministic, and a constellation that arranges itself differently on every
load destroys the memorability the research says map-like layouts buy [R, S6]. So:

- The nightly sweep runs the force simulation **once per domain**, offline, and writes
  `clarity_object.layout_x / layout_y` (two `real` columns to add to the schema).
- `react-force-graph-2d` receives `fx`/`fy` pre-set and runs zero simulation ticks on load.
- Dragging a node is local and discarded on navigation. There is a `[ re-run layout ]` admin
  action; it is not automatic.

Same for the mosaic's `position` integer (§6.3). **Nothing in the Atlas moves unless the data
moved, and when it moves it is marked.**

### 15.4 Search — teleport, but show the journey

Search is global (`⌘K`), matches object names, column names, domains, entity names and ABNs, and
ranked by `importance`. Selecting a result navigates directly — but the ribbon animates through
the intervening segments over 300ms and the minimap pulses the destination tile. Teleporting
without showing where you landed is the thing that breaks a spatial metaphor; a 300ms trace fixes
it at negligible cost. (This is a mitigation, not a cure — see §21.2.)

### 15.5 Keyboard

`⌘K` search · `1`–`8` switch lens · `[` `]` level up/down · `←→` previous/next sibling at the
current level (previous object in the ledger's current sort — this is the thing that makes an
audit pass fast) · `v` open the verdict control · `e` extract · `Esc` clear selection, then clear
filters, then go up one level.

### 15.6 Write paths — the catalog must be writable or it rots

Brehmer & Munzner's consume/produce split [R]: a read-only catalog is a ghost town. Four writes:

| Write | Where | Guard |
|---|---|---|
| Verdict KEEP / SUSPECT / CRUFT + reason | L0 ledger row, L2 header | CRUFT requires a reason (DB CHECK) and is refused while anything reads it (DB CHECK) |
| Governance fields (owner, licence, PII, SLA, caveat) | L2 governance panel, inline | writes to `data_catalog`, the existing table |
| Purpose / domain assignment | L0 mosaic right-click, L1 triage queue | the 621 UNFILED backlog; the queue is sorted by `refs_app DESC` so the views the app reads get described first |
| Frontier status | gutter | `declined` requires a reason (DB CHECK) |

Every write goes through `/api/clarity/*` with `requireAdmin`, writes an audit row, and
**re-renders server-side** — no optimistic client state that can diverge from a CHECK constraint
rejection.

---

## 16. COMPONENTS, FILES, AND THE DEPENDENCY POSITION

### 16.1 File tree

```
apps/web/src/app/clarity/
  layout.tsx                     Server — the frame: Ribbon, Rail, Minimap, GapGutter, Lens
  page.tsx                       Server — L0
  d/[domain]/page.tsx            Server — L1
  o/[objectKey]/page.tsx         Server — L2
  o/[objectKey]/c/[column]/page.tsx  Server — L2b
  x/page.tsx  x/[matrix]/page.tsx    Server — L3
  e/[gsId]/page.tsx              Server — L4
  r/[objectKey]/[pk]/page.tsx    Server — L5
  loading.tsx  error.tsx  not-found.tsx

apps/web/src/app/clarity/_components/          (client islands are marked ●)
  frame/    Ribbon.tsx ● Rail.tsx ● Minimap.tsx ● LensSwitch.tsx ● ExtractMenu.tsx ●
            GapGutter.tsx  Frontier.tsx
  l0/       EstateHeader.tsx  CoverageBar.tsx  EstateMosaic.tsx ●  Ledger.tsx ●  PeekCard.tsx ●
  l1/       DomainHeader.tsx  DomainConstellation.tsx ●  CoverageMatrix.tsx ●  DomainGaps.tsx
            MetricConflicts.tsx
  l2/       ObjectHeader.tsx  VerdictControl.tsx ●  HistorySpark.tsx  ColumnProfile.tsx ●
            NullityStrip.tsx  JoinLedger.tsx  LineagePanel.tsx  CodeRefs.tsx
            StructuralNeighbours.tsx  GovernanceRow.tsx ●  RoutineProfile.tsx
  l2b/      ColumnFill.tsx  NullReasons.tsx
  l3/       MatrixIndex.tsx  FlowMatrix.tsx  JoinMatrix.tsx  CellDetail.tsx ●
            SavedCrossSections.tsx
  l4/       SystemStrip.tsx  EgoNetwork.tsx ●  HubSheet.tsx ●  IsolatePanel.tsx  EdgeInspector.tsx
            CategoryNodeWarning.tsx
  l5/       RecordPanel.tsx  ProvenancePanel.tsx  DrillRefusal.tsx
  primitives/ Glyph.tsx  Bar.tsx  CoverageCell.tsx  StateChip.tsx  CountUp.tsx(no animation)

apps/web/src/lib/clarity/
  views.ts          the ClarityView registry + refusal contract        (+ views.test.ts)
  domains.ts        14 domain constants, the one-line truths           (+ domains.test.ts)
  lenses.ts         8 lens definitions + band functions + legends      (+ lenses.test.ts)
  glyphs.ts         the six-glyph alphabet, one source of truth        (+ glyphs.test.ts)
  cross-sections.ts the saved L3 perspectives + their join floors      (+ cross-sections.test.ts)
  params.ts         useClarityParams() — URL state, no new dependency  (+ params.test.ts)
  queries.ts        every SQL string in this document, one export each (+ queries.test.ts)
  copy.ts           the permitted-phrasing deck (§16.5)                (+ copy.test.ts)

apps/web/src/app/api/clarity/
  estate/route.ts  domain/[d]/route.ts  object/[k]/route.ts
  matrix/[m]/route.ts  ego/[gsId]/route.ts  verdict/route.ts  rescore/route.ts
```

### 16.2 Server / client split

Server Components render everything that is not a direct-manipulation surface. The client islands
are exactly nine: `Ribbon` (segment hover), `Rail` (facets), `Minimap` (hover), `LensSwitch`,
`ExtractMenu`, `EstateMosaic`, `Ledger`, `DomainConstellation`, `CoverageMatrix`, `ColumnProfile`
(virtualisation), `VerdictControl`, `GovernanceRow`, `CellDetail`, `EgoNetwork`, `HubSheet`.

Two rules from CLAUDE.md, honoured explicitly:
- **`getDirectServiceSupabase()`, never `getServiceSupabase()`.** The latter sniffs the call stack
  for `/app/reports/` and returns a snapshot stub that resolves to null — a silent `[]`
  [R, memory]. Every `queries.ts` export takes a client parameter; the pages pass
  `getDirectServiceSupabase()`.
- **No `next/dynamic` in a Server Component.** `react-force-graph-2d` cannot SSR (it touches
  `window`). So `EgoNetwork.tsx` and `DomainConstellation.tsx` are `'use client'` files that
  `next/dynamic(..., { ssr: false })` *inside themselves*, and the Server page imports the client
  wrapper normally. `/graph` already does the wrong version of this; the Atlas does not copy it.

### 16.3 Data volumes per level

| Level | Payload | Client work |
|---|---|---|
| L0 | 1,433 × ~30 fields ≈ 260 KB JSON (~45 KB gzip) [I] | facet counts + filter, in memory, <100ms |
| L1 | ≤119 nodes + ≤200 edges ≈ 25 KB | zero-tick force render |
| L2 | ≤60 columns + ≤50 edges + ≤300 code refs ≈ 40 KB | virtualise columns past 50 |
| L3 | ≤1,210 matrix cells ≈ 90 KB | none (server SVG) except tooltip |
| L4 | ≤200 nodes + ≤400 edges ≈ 60 KB | force render |
| L5 | 1 row + provenance | none |

Nothing here reads `gs_entities`, `gs_relationships`, `austender_contracts`, `abr_registry` or
`political_donations` unfiltered. L4 is the only level that touches `gs_relationships` and it does
so through an indexed equality predicate with `LIMIT 200`.

### 16.4 Dependencies: **zero added**

| Need | Uses | Why not the research's recommendation |
|---|---|---|
| mosaic, matrices, nullity strip, coverage bars, join matrix | **inline SVG / CSS grid**, server-rendered | 1,433 divs and 121 rects are trivial DOM; a library would add weight and remove SSR |
| sparklines, history, distribution bars | **recharts ^3.7.0** (installed) | already used in 8 files |
| L1 constellation, L4 ego network | **react-force-graph-2d ^1.29.1** (installed) | both are ≤150 nodes, well inside its envelope [R, S10] |
| maps | **none in /clarity** | place hands off to `/atlas`, which owns leaflet |
| URL state | **native App Router hooks** | `nuqs` is the better tool and is the first thing I would add if the param surface grows; not added now (§15.1) |
| sankey, maplibre, pmtiles, deck.gl, cosmograph, cytoscape | **not added** | no view in this design needs them. The money-flow Sankey belongs on `/reports/money-flow`, not in the catalog |

The one thing I would argue *for* adding later, and only later: `@tanstack/react-virtual` if the
column profile has to render `gs_entities`' full width plus `clarity_column` for the 926 relations
in one view. At ≤60 columns per object it is not needed.

### 16.5 The copy deck

`src/lib/clarity/copy.ts` exports the permitted phrasings and a `forbidden` array. `copy.test.ts`
greps every `.tsx` under `app/clarity/` for the forbidden strings and fails the build.

```ts
export const FORBIDDEN = [
  'has no evidence', 'no evidence', 'no connections', 'not connected',
  'has no board', 'no directors', 'unfunded', 'not funded', 'no data',
];
export const PERMITTED = {
  noEvidence: (n: string) => `No ALMA evidence record is linked to ${n}.`,
  noEdges:    (n: string) => `No rows in gs_relationships reference ${n}.`,
  noBoard:    (n: string) => `No person_roles rows carry this entity id.`,
  noRows:     (t: string) => `No rows in ${t} carry this ABN.`,
  neverMeasured: (w: string) => `${w} has never been measured.`,
  measuredZero:  (w: string, d: string) => `${w} was measured on ${d}. The answer is zero.`,
};
```

This is the hard constraint from the brief turned into something that cannot be forgotten in a
late-night edit.

---

## 17. QUERY CATALOGUE — every panel, its source, its cost

| # | Panel | Reads | Rows | Cost | Cache |
|---|---|---|---|---|---|
| Q1 | Estate payload | `v_clarity_ledger` | 1,433 | ~40ms [I] | 1h, `revalidate` |
| Q2 | Coverage scalars + gutter | `clarity_gap_measurement` ⋈ `clarity_gap_metric` | 23 | <10ms | 1h |
| Q3 | Frontier | `clarity_frontier` | ≤25 | <10ms | 1h |
| Q4 | Domain constellation | `clarity_object` + `clarity_edge` | ≤320 | <20ms | 1h |
| Q5 | Object header | `v_clarity_ledger` | 1 | <5ms | 5m |
| Q6 | Columns | `clarity_column` | ≤60 | <10ms | 1h |
| Q7 | Join ledger | `clarity_edge` | ≤50 | <10ms | 1h |
| Q8 | Lineage | `clarity_edge` (view_lineage) | ≤30 | <10ms | 1h |
| Q9 | Code refs | `clarity_code_ref` | ≤300 | <15ms | 1h |
| Q10 | History | `clarity_object_history` | ≤90 | <10ms | 1h |
| Q11 | Structural neighbours | `clarity_edge` + `clarity_code_ref` | 12 | <30ms | 1h |
| Q12 | Null reasons | registered per-column SQL | ≤6 | varies; **capped at 3s, `~` on timeout** | 24h |
| Q13 | Flow matrix | `mv_clarity_flow` | ≤1,210 | <15ms | 24h |
| Q14 | Join matrix | `clarity_edge` + `clarity_object.domain` | ≤196 | <20ms | 1h |
| Q15 | Entity pre-flight | `mv_gs_entity_stats` (indexed on gs_id) | 1 | <10ms | none |
| Q16 | Ego hop 1 | `gs_relationships` ×2, indexed, `LIMIT 200` | ≤400 | <150ms [I] | none |
| Q17 | True degree | `gs_relationships` count, indexed | 1 | <100ms [I] | 1h per entity |
| Q18 | System strip | 12 targeted `EXISTS` by ABN / entity id | 12 | <200ms [I] | 1h |
| Q19 | Record | whitelisted object, by pk | 1 | <10ms | none |

**Every cost marked [I] is inferred from index shape and comparable measurements in
`clarity-data-layer.md`; none of Q1–Q19 was executed, because `clarity_object` does not exist
yet.** Q13's underlying aggregate I did run: ~40s over 3.43M edges [V], which is why it is a
matview and not a live query.

---

## 18. BAUHAUS — how the system applies to a surface this dense

`DESIGN.md` is binding. Two honest tensions and how they resolve.

**Tension 1 — 4px borders and 8px hard shadows on 1,433 tiles is unreadable.** Resolution: use the
`.ws` workspace theme, which `DESIGN.md` §"Workspace Theme" defines precisely for this case —
borders 1px, subtle drop shadow instead of hard offset, Satoshi 700 instead of 900, reduced
tracking. `/clarity` is an operational instrument and wears `.ws`. The full 4px/8px treatment is
kept for exactly three elements: the page container, the Frontier cards, and any refusal panel —
so the loud treatment marks the things that must not be skimmed.

**Tension 2 — there is no green in the primary palette.** That is fortunate: the standard R/A/G
health palette is the classic deuteranopia failure and Few's pitfall #12 [R]. The alphabet in §5
uses black / red / yellow / blue / muted and nothing else. `#059669` (semantic "money") appears
only on dollar figures in L3 and L4, never as a state.

Applied:

| Element | Treatment |
|---|---|
| Ribbon | Satoshi 700, 11px, uppercase, `tracking-widest`, muted `›` separators, current segment black with a 4px red bottom-border |
| Rail section labels | Satoshi 700, 11px, uppercase; facet labels DM Sans 500 13px; counts JetBrains Mono 12px right-aligned, `tabular-nums` |
| Object names, ABNs, GS-IDs, column names | **JetBrains Mono 13px** — always, everywhere |
| All numbers | DM Sans `font-variant-numeric: tabular-nums`, right-aligned |
| Glyphs | JetBrains Mono 14px, fixed pitch — this is what makes a column of `+` read as a stripe |
| Mosaic tile | 10×10px, 0 radius, 1px `#121212` grid line between bands only |
| Matrix cell | square, 0 radius, 1px gap; fill = lens band; no cell borders (they would out-weigh the data) |
| Ledger | 2px outer border (`.ws`), black header row, Satoshi 700 white uppercase, 1px row dividers, hover `#E8EEFF` |
| Refusal panel | white, 4px black border, 8px hard shadow, red 8px left border. The loudest object on the page, and there is at most one at a time |
| Frontier card | white, 4px border, 8px shadow, yellow 8px left border |
| Verdict chips | KEEP black outline · SUSPECT yellow · CRUFT red — Satoshi 700 10px uppercase, 2px border, light fill |
| Motion | ribbon trace 300ms ease-in-out; peek card 120ms in / 0 out; lens switch is an instant repaint. **No spring, no parallax, no reveal.** Bauhaus is still |
| Radius | 0 everywhere, enforced globally already |

---

## 19. BUILD ORDER

Each step ships something usable on its own, and each is gated by the one before.

| # | Ship | Depends on | Value the day it lands |
|---|---|---|---|
| 0 | Apply the three `clarity_*` migrations + `snapshot-clarity.mjs`, registered nightly at ~4.5 min on the `refresh-views-v2` lane | — | nothing renders before this; the catalog is the product |
| 1 | The frame + **L0 mosaic + ledger**, lens STATE only | 0 | "every object we hold, one screen" — the literal ask, in one screen |
| 2 | The **glyph alphabet + coverage matrix columns** on the ledger, gap gutter with the 23 metrics | 1 | "see the gaps" — the `+`/`×` distinction is live |
| 3 | **L2 dataset** incl. the join ledger with measured match rates | 1 | the drill-through that makes the mosaic worth clicking; the dead-key finding gets a permanent home |
| 4 | **L1 domain** constellation + coverage matrix; strip `TABLE_DOMAIN` from the orphaned `/api/data/schema-graph` | 3 | "how it connects", at the only cardinality where node-link is honest |
| 5 | **Minimap + carried filters + full URL state** | 1–4 | this is when it stops being four pages and becomes one space |
| 6 | **Lenses** (all 8) | 5 | eight views for the price of the layout |
| 7 | `mv_clarity_flow` + **L3 flow and join matrices** + saved cross-sections | 0 | the cross-section level — Ben's stated vision, and the category-node finding surfaces |
| 8 | **L4 ego network** + Hub Sheet + Isolate panel + system strip | 7 | the org page the whole product has been missing |
| 9 | **L2b column + null reason codes**, **L5 record + provenance + drill refusal** | 3 | the provenance floor, including its honest refusals |
| 10 | **Frontier table + contextual rendering**; write paths (verdict, governance, triage queue) | 2 | "find opportunities", and the catalog becomes writable, which is what stops it rotting |

Steps 0–3 are the minimum that answers the literal request. Step 5 is where the Atlas becomes the
Atlas. Steps 7–8 are where it becomes better than any catalog product.

---

## 20. WHAT MUST BE TRUE BEFORE ANY OF THIS RENDERS

Stated plainly because the design is worthless if these are assumed:

1. The three `clarity_*` migrations are **unapplied**. Nothing in §6–§12 renders until they are,
   and `clarity_refresh()` **has never been executed** — it is reasoned-about but unrun code
   [R, clarity-data-layer §8].
2. `catalog-object-scope.sql` (the parallel session's four-value scope taxonomy) should land
   **before** mine, and `clarity_object.act_business` should derive from it [R]. The Atlas's SCOPE
   control reads `catalog_object_scope.scope`, with `unclassified` rendering as *visible and
   flagged*, never hidden.
3. The `matviews_unscheduled` / `matviews_unregistered` metric pair must be flipped in the same
   change that applies the mv-refresh registry, or L0's SCHEDULED scalar will read a confident,
   wrong 98 of 98 [R].
4. `mv_clarity_flow` (§10.3) and `clarity_frontier` (§12) are new deliverables, unapplied, and must
   be registered in `mv_refresh_registry` rather than hardcoded into any list.
5. `clarity_object` needs two columns this design adds and the current DDL does not have:
   `layout_x real`, `layout_y real`, `position int` (§15.3, §6.3). One trivial follow-up migration.

---

## 21. WHAT THE ATLAS HANDLES WORSE THAN THE ALTERNATIVES

Written to be argued with, not to be reassuring.

**21.1 Time to first value is roughly 3× a flat ledger.**
A search-first, sortable, faceted table of 1,433 rows is two days' work and it answers "do we have
X?" and "what's stale?" completely. The Atlas needs the frame, the mosaic, the glyph alphabet and
at least L2 before it is coherent — steps 0–3 above, call it two weeks. If the real need is an
audit pass this month, the ledger direction wins outright and I would say so.

**21.2 Known-item search is genuinely worse, and the fix is a mitigation not a cure.**
Shneiderman's two poles are browse and known-item [R]. The Atlas is optimised hard for browse. When
you know you want `justice_funding`, a spatial metaphor is friction: the honest interaction is to
teleport, and teleporting is exactly what a map is bad at. §15.4's 300ms ribbon trace and minimap
pulse reduce the disorientation; they do not make it as good as a search box that returns a row.
A catalog-first design would beat it here every single time.

**21.3 The spatial metaphor makes a promise the data can only mostly keep.**
The mosaic's within-band order is `importance DESC`, and importance is a weighted blend whose
weights are my judgement calibrated against observed output, not a derived constant [R]. A user who
learns "the philanthropy stuff is the third band, left side" is relying on an ordering that *can*
shift. The frozen `position` column and the red top-edge on movers (§6.3) contain this, but they do
not eliminate it, and a design whose value compounds with familiarity is uniquely punished by
instability. A list sorted by name has no such exposure.

**21.4 It is more code and more surface to rot, for a one-to-two-person team.**
Six levels × four forms × eight lenses × the refusal registry is perhaps three times the component
count of the ledger direction. Every component is a thing that can drift from the data. I have
pushed back with CI guards (`views.test.ts`, `copy.test.ts`, `cross-sections.test.ts`) modelled on
the only artefact in either repo that has demonstrably not rotted, but guards are themselves code.
The graph-first direction, which puts most of its weight into one force-graph component, is
materially cheaper to keep alive.

**21.5 The minimap and the gutter cost ~420px of a 1440px screen at every level.**
That is 29% of the width spent on orientation and absence. On L2, where the join ledger wants to
be wide, it hurts. Both are collapsible (`[` `]`), and the collapse persists — but a design that
needs its two most distinctive elements collapsed to read comfortably has a real problem, and I
would watch this in the first week of use.

**21.6 Mobile is not merely degraded — it is absent.**
`/clarity` below 1280px is the ledger and the gutter. A catalog-first design is responsive by
nature. If Ben wants to check freshness from a phone, the Atlas does not serve him and the ledger
does.

**21.7 The deepest level is where the data is weakest, which is embarrassing for a design whose
payoff is depth.**
L5's whole promise is provenance, and the flagship drill path — edge → grant — is **0.0%**
[R, gap metric 10]. `alma_evidence` has 9 citation rows against 2,136 interventions. Donations are
~25% ABN-attributable. So the Atlas repeatedly invites the user down a ladder whose bottom rung is
missing, and it has to spend design effort (the refusal panel) apologising for it. A dashboard
direction never makes the promise and therefore never has to break it. The counter-argument — that
making the missing rung *visible and named* is the entire point — is one I believe, but it is an
argument, not a free lunch.

**21.8 Two things I deliberately did not solve.**
No time dimension beyond the 90-day row-count sparkline: "how did the estate change over the last
year" is answerable from `clarity_object_history` and I did not design a view for it. And no
cross-repo view: the Atlas catalogues one database, and JusticeHub's 480 routes and its
`data-observatory` (uncommitted, another session mid-flight) are not represented. Both are real
gaps in this design, not in the data.

---

## 22. VERIFICATION APPENDIX

**Measured by me, this session, by direct psql [V]:**
`gs_entities.entity_type` distribution (11 values, company 272,535 … unknown 1);
`gs_relationships.relationship_type` distribution (10 values, donation 1,073,308 … partners_with
44) with distinct dataset counts; the full undirected degree distribution over 3,429,184 edges
(400,276 nodes with ≥1 edge, max 330,460, p50 2, p95 23, p99 84, 2,594 nodes above 150); the top
six nodes by degree with their names and entity types; `gs_relationships` fill rates — `amount`
2,655,257 of 3,429,184 = **77.43%**, `year` 2,388,813 = **69.66%**;
`mv_gs_entity_stats`' 17 columns, confirming
it carries `total_relationships`, `distinct_counterparties`, `top_counterparty_share` and both
amount rollups; the presence and byte sizes of the three unapplied `clarity_*` migrations and the
five unapplied `migrations/2026-08-14-*` files; the `clarity_object`, `clarity_edge`,
`clarity_gap_metric` and `v_clarity_ledger` DDL as written; `getDirectServiceSupabase` /
`getServiceSupabase` and the `/app/reports/` stack sniff at `apps/web/src/lib/supabase.ts:155-172`;
the `AtlasLayer` type discipline in `src/lib/atlas/layers.ts:1-80`; the `apps/web/src/app` route
listing.

**Derived by me from measured values [I]:** 209,172 isolates (609,448 − 400,276) and that absence
from `mv_gs_entity_stats` is the isolate test; 621 UNFILED (1,433 − 812) and 575 civic domained
(812 − 237); 605,135 edges (17.6%) held by the two category nodes; the ~260 KB estate payload from
field widths; every cost estimate in §17 marked [I]; the reading that "Specialised Supplies and
Services" is a procurement category rather than an organisation — its name, `entity_type='program'`
and its degree are measured, the interpretation is not.

**Relayed from documents that mark them verified [R]:** the 1,433-object universe and its
714/98/212/409 split; every gap-metric value in §2.1; the 0.0% justice drill-through; the 2,594
figure's context (the 30–150 node budget, the 2,345-node two-hop measurement, Ghoniem's ~20-node
matrix threshold); the 8-second RPC ceiling and that `SET LOCAL statement_timeout` inside plpgsql
cannot cancel a running query; the ivfflat measurements (11.3s at probes=1, 2,846 MB index) that
rule embeddings out of the catalog; the 238-object ACT cluster; `n_live_tup` being broken; all
research citations.

**Not checked, and it matters:**
- I did not run `clarity_refresh()` or apply any migration. **Nothing in §6–§12 has ever rendered.**
- I did not verify `clarity_column.fill_rate` exists as a column — §8/§9 depend on it. If the DDL
  computes fill differently, those panels change shape.
- The per-cell figures inside the L3 wireframe (`41,882 edges · $2.1bn · amount present on 71%`)
  are **illustrative placeholders** for one cell, not measurements. Only the matrix's axes, its
  totals and the two fill rates are measured.
- I did not load a single page in a browser. No claim here about rendering, layout or performance
  is verified.
- I did not check whether `mv_gs_entity_stats` is indexed on `gs_id`; Q15's "<10ms" assumes it is.
- I did not check JusticeHub's working tree for collisions with this surface. `existing-surfaces`
  records another session mid-flight on `src/lib/data-observatory/` — coordinate before step 0.
