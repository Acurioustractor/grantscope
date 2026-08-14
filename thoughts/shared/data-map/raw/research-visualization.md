# Maps, network visualisation and multi-level drill-down for CivicGraph + JusticeHub

Research brief. Written 2026-08-14. Sources cited inline; full list at the end.

Verification key used throughout:
- **[V]** verified — I read the file, ran the command, or read the source text directly
- **[I]** inferred — derived from verified facts, not directly confirmed
- **[U]** unverified — taken on faith from a single secondary source

---

## 0. The short version

Ben's ask — "the full map of data, then click down through several levels to see how it's
connected" — is a **degree-of-interest problem, not a rendering problem**. The instinct is to
draw all 609,448 entities and 3,429,184 relationships and let people zoom. That produces a
hairball, and every serious link-analysis tool in the world has already abandoned that approach.

The single most useful source I found is van Ham & Perer's 2009 IEEE VIS paper *"Search, Show
Context, Expand on Demand"* [S1]. Their evaluation dataset was **300K nodes / 3.3M citations** —
almost exactly the shape of `gs_entities` + `gs_relationships` (609K / 3.43M). They state
explicitly that a two-hop neighbourhood from a single focus node in that graph contained
**2,345 nodes and 2,847 edges** and was "impractical to visualize using a node link diagram."
Two hops. From one node. That is the honest ceiling, and it is much lower than anyone expects.

So the answer has three layers, and they are three *different visual forms*, not the same form
at three zoom levels:

| Level | Question it answers | Form | Node budget |
|---|---|---|---|
| L0 — the map of the map | "what data do we even hold?" | schema/domain graph + catalogue | ~120 table-nodes |
| L1 — the shape of the field | "where is the money concentrated?" | **aggregated meta-graph** (communities, sectors, places as nodes) + choropleth/hex map | 200–2,000 |
| L2 — the neighbourhood | "who is connected to this org?" | **DOI ego-network, expand-on-demand** | 30–150 on screen |
| L3 — the path | "how did money get from A to D?" | **Sankey / path trace** | 4–5 stages, ≤10 nodes per stage |
| L4 — the record | "what exactly is this row?" | entity dossier, table, provenance | 1 |

The "whole graph at once" view still has a place — but as **art with a search box**, an
orientation device, not an analysis tool. Cosmograph-class GPU rendering makes it technically
possible [S2][S3]; the vis literature is unanimous that it is analytically near-useless [S4][S5].
Build it third, not first.

---

## 1. What is already installed (verified against both repos)

**[V]** Read from `package.json` in both repos on 2026-08-14.

### `grantscope/apps/web`
| Package | Version | Notes |
|---|---|---|
| `react-force-graph-2d` / `-3d` | ^1.29.1 | canvas/WebGL force layout |
| `leaflet` + `react-leaflet` | 1.9.4 / ^5.0.0 | raster/vector-lite maps |
| `recharts` | ^3.7.0 | SVG charting, 8 files use it |
| `@phosphor-icons/react` | ^2.1.10 | |
| Next 15 / React 19 / Tailwind 4 | | |

**Not installed:** d3, d3-sankey, cytoscape, maplibre-gl, deck.gl, sigma/graphology, cosmograph.

### `JusticeHub`
| Package | Version | Notes |
|---|---|---|
| `cytoscape` | ^3.33.1 | used by `components/intelligence/NetworkGraph.tsx` |
| `d3` | ^7.9.0 | |
| `d3-sankey` | ^0.12.3 | used by `components/intelligence/SankeyDiagram.tsx` (428 lines) |
| `maplibre-gl` | ^4.7.1 | used in 13 files inc. `components/atlas/AtlasLayeredMapClient.tsx` |
| `leaflet` + `react-leaflet` | 1.9.4 / ^4.2.1 | |
| `react-force-graph-2d` | ^1.29.0 | `components/intelligence/KnowledgeGraph.tsx` |
| `recharts` | ^3.6.0 | |
| `react-scrollama` | ^2.4.2 | scrollytelling |
| `@tanstack/react-query` | ^5.17.0 | |
| Next **14.2.35** / React 18 / Tailwind 3 | | version skew vs grantscope |

**Not installed:** deck.gl, sigma/graphology, cosmograph, PMTiles.

### Existing surfaces worth knowing about
**[V]** From directory listing and grep:

- `grantscope`: `/graph` (**2,149 lines**, single page), `/map`, `/atlas`, `/power`,
  `/places`, `/procurement/gap-map`, `/reports/{money-flow,power-map,power-network,influence-network,reallocation-atlas}`,
  8 Leaflet map components.
- `grantscope` `/api/data/graph/route.ts` already implements a **10-mode lens architecture** —
  `power`, `interlocks`, `ndis`, `dollar`, `justice`, `foundations`, `diary`, `alma`, `hubs`,
  plus a default. Per-mode `LIMIT`s range from 200 to 3,000; the outer cap is
  `Math.min(parseInt(limit ?? 5000), 60000)`. **This is already the right architecture.**
  It should be extended, not replaced.
- `grantscope` `/api/data/schema-graph/route.ts` — returns "the full data model as a graph:
  tables as nodes, foreign keys + ABN joins as edges. Powers the interactive Obsidian-style
  schema visualization on `/clarity`." **[V] `/clarity` does not exist** — `ls app/clarity`
  returns "No such file or directory", and grep finds no consumer of `schema-graph` outside
  its own file. **The L0 "map of the data" API is already built and orphaned.** That is the
  cheapest win available.
- `grantscope` `src/lib/atlas/layers.ts` — a typed layer registry whose header comment states
  "A layer is not a dataset; it is a claim about places, and the registry forces every claim to
  carry its qualifications: what the number contains (the caveat), the geography it is honest at,
  and who is allowed to see it (the consent tier)." Layers are `live` or `declared`; consent
  tiers are `public` / `org` / `withheld`. **This is the best piece of visualisation
  architecture in either repo** and should be generalised beyond places (see §4.7, §6.4).
- `JusticeHub`: `/atlas`, `/network`, `/justice-network`, `/sector-map`, `/community-map`,
  `/intelligence/{power-map,network,funding-flows,map,funding-map}`, `/centre-of-excellence/system-map`,
  `/justice-matrix/{explore,map}` and ~10 more map routes. **[I] There is significant view
  duplication across the two repos** — at least 5 things called some variant of "power map" or
  "network" exist.

### Geographic data reality
**[V]** Grepped `columns.csv` (14,310 rows) for PostGIS types:

> **There is no PostGIS geometry anywhere in the database.** Two columns match
> `geography`, and both are text/array attribute columns (`alma_interventions.geography` ARRAY,
> `grant_opportunities.geography` text), not spatial types. Zero `geometry` columns. Zero
> columns matching `geojson|boundary|geom`.

Geography is held as **point lat/lon** (`acara_schools`, `alma_locations`, `jr_sites`,
`goods_communities`, `events`, ~10 more) plus **area codes** (`gs_entities.postcode`,
`.sa2_code`, `.lga_code`, `.lga_name`, `.remoteness`, `.seifa_irsd_decile`).

Area-level aggregates already exist **[V]** from `census.csv`:
`mv_funding_by_postcode` (7,224), `sa2_reference` (2,473), `mv_sa2_map_data` (2,473),
`mv_funding_by_lga` (1,729), `mv_lga_place_profile` (1,145), `lga_cross_system_stats` (361),
`postcode_geo` (12,299), `abs_poa_lga_ratio` (3,968), `abs_sal_lga_ratio` (16,372),
`postcode_sa2_concordance` (7,261), `crime_stats_lga` (58,125), `ndis_participants_lga` (8,329).

`sa3_regions` has **14 rows**. **[U]** general knowledge puts the ASGS SA3 count around 350; either
way 14 is scaffolding, not data. **[I]**

Also worth a second look: **`mv_funding_by_lga` has 1,729 rows** but **[U]** Australia has roughly
550–570 official LGAs, and `CLAUDE.md` claims 492. **[I] Either the MV is keyed by
LGA × something (year? dataset?), or it contains non-official/duplicate LGA codes.** Confirm the
grain before any LGA choropleth is built on it — a choropleth over a mis-grained MV will
silently double-count.

**Consequence:** boundary polygons must come from static assets (TopoJSON / GeoJSON / PMTiles),
never from the DB. Every choropleth is a client-side or build-time join of `code → value`
onto a shipped boundary file. This is actually the *right* architecture — see §4.6.

---

## 2. Network / graph visualisation at scale

### 2.1 The arithmetic of this specific graph

**[V]** From GROUND_TRUTH: 609,448 nodes, 3,429,184 edges.
**[I]** Derived: 5.63 edges per node; mean undirected degree ≈ **11.3**.

That mean is deceptive and it is worth saying why. The *Trimming the Hairball* paper [S6] took a
4,000-node / 200,000-link graph (50 links per node, modularity Q = 0.26 — a total hairball) and
cut it down to **5.0 edges per node**, then refilled within-community edges, reaching Q = 0.77.
Our graph is *already* at 5.63 edges/node globally. **[I] So the problem here is not global
density — it is hub degree concentration.** Australian funding data is dominated by a handful of
super-connected nodes: Commonwealth departments, the big state agencies, the ~20 foundations
that give to everyone. Cambridge Intelligence calls this the **"starburst"** failure mode,
distinct from the hairball: "a single node dominates with excessive connections," fixed by
"redesigning the data model, limiting expansion, grouping less important nodes, or removing the
central node" [S7].

That distinction drives the whole design: **the fix for this graph is hub handling, not global
edge cutting.** Concretely — never auto-expand a node with degree > ~50; show it as
"Dept. of Social Services · 4,182 connections" with a *filtered* expand (by year, by
relationship type, by amount band).

### 2.2 Where things actually break — concrete thresholds

Every number below is cited, not guessed.

| Technique / library | Comfortable | Degrades | Source |
|---|---|---|---|
| SVG node-link (d3 default, Recharts) | < 1,000 elements | fails at thousands | [S2] "SVG fails with thousands of objects" |
| Canvas node-link (cytoscape.js, vis-network) | ~1,000 | **3,000–5,000 nodes** then frame rate drops | [S8] |
| cytoscape.js reported failure | — | ~1,000 nodes / 5,000 edges "takes a very long time to render and becomes impossible to interact with" | [S8] |
| Ogma (commercial, WebGL) | — | disable overlap prevention at **1,000+ nodes**; GPU layout caps at **7,000 nodes**, switch to CPU above | [S9] |
| `react-force-graph` (canvas + d3-force-3d) | ~4k "medium" example; **~75k "large" example** | d3-force charge is O(n²); Barnes-Hut mitigates; **wall ~100,000 nodes** | [S10] |
| sigma.js + graphology (WebGL) | "thousands smoothly"; the recommended pick when scale beats built-in algorithms | — | [S8] |
| Cosmograph / `@cosmograph/cosmos` (GPU force sim, regl) | **1M nodes + several M edges real-time** | grid artefacts when many nodes share one grid square | [S2][S3] |
| CPU force layout generally | — | "chokes around 100,000 nodes"; Cosmograph docs say traditional CPU walls hit at **50,000** | [S2][S3] |
| Graphistry (server GPU layout, browser WebGL) | "hundreds of thousands of nodes+edges"; group-in-a-box on millions of edges in seconds | requires a GPU server | [S11] |
| **Human legibility** | **20 nodes** — matrix beats node-link on most tasks above this | node-link only wins on *path-finding*, and even that degrades on large/dense graphs | [S12] Ghoniem et al. |

That last row is the one people ignore. Ghoniem, Fekete & Castagliola's controlled experiment
(20/50/100 nodes × density 0.2/0.4/0.6) found **matrix representations outperform node-link on
most tasks above ~20 vertices**, with node-link winning only on `findPath` [S12]. Density hurts
node-link readability badly "even with few (e.g. 20) nodes."

**[I] Practical read for CivicGraph:** an on-screen node-link view should target **30–150 nodes**.
Beyond ~300 it is decoration. Anything the user needs to *count*, *compare* or *rank* should be a
table, a bar chart or a matrix, not a graph.

### 2.3 The three honest strategies (pick per view, not globally)

**(a) Ego-network with degree-of-interest — the primary drill-down engine.**

van Ham & Perer [S1] formalise it. Their DOI function for graphs:

```
DOI(x | y,z) = α·API_diff(x) + β·UI_diff(x,z) + γ·D(x,y)
```

where `API` = a priori interest (intrinsic node importance — for us: total dollars, system count,
power score), `UI` = user interest (search-term relevance / facet match), `D` = graph distance
from focus node `y`, and

```
API_diff(x) = max( API(x),  δ · max over n∈N(x) of [ (1/EI(e,x,n)) · API_diff(n) ] )
```

i.e. interest **diffuses** across the network with decay `δ` (0 ≤ δ < 1), so a boring node
adjacent to an important one still surfaces. `EI` is an edge-disinterest function — higher
values mean "less interesting to follow this link." **[I] For us `EI` is the natural home for
provenance quality**: a `confidence='low'` or name-matched relationship gets high `EI` and is
followed last.

Subgraph extraction is a **greedy algorithm producing a connected subgraph F of size at most S
with maximal total interest, in O(S log S)** — start from focus, repeatedly take the highest-DOI
candidate, add its neighbours to the candidate heap [S1]. `S` is a UI slider ("Network size" in
their Fig. 3).

Their expand-on-demand rules, all directly applicable:
- clicking a node adds only the **top N most interesting** neighbours, not all of them; click
  again for N more
- **n should be small (n < 5)** for the highlighted "interesting direction" markers, "to avoid
  overloading the user with choices"
- **fading edges** emanate from nodes to indicate more connections exist, with the **exact
  number of hidden neighbours printed on the node**, and the number of fading edges per node
  **capped**
- layout by **stress majorization**, not gradient descent, because gradient descent is "prone to
  local minima and oscillations" — stress majorization gives "far better layout stability"
- nodes matching the original search get a **blue halo**; node size = normalised DOI

Their client-server split: server holds the full graph in RAM with precomputed API values;
per-session state holds search terms, UI values and the current subgraph; the client gets a
small subgraph plus meta-data. Measured on a 2009 dual-core 2.4GHz / 4GB laptop over 300K
docs / 3.3M citations: ~5 min startup, 1.2GB RAM, **~15s per search + UI recomputation, up to
3s for subgraph computation** [S1]. On 2026 hardware with Postgres doing the work, [I] the
subgraph step should be sub-second for S ≤ 200 if the DOI inputs are precomputed as materialised
columns.

**(b) Aggregated meta-graph — the "shape of the field" view.**

Run community detection once, offline, and make **communities the nodes**. Use **Leiden, not
Louvain**: Traag, Waltman & van Eck showed Louvain "may yield arbitrarily badly connected
communities... in the worst case, communities may even be disconnected," with **up to 25% of
communities badly connected and up to 16% disconnected** in their experiments; Leiden guarantees
connected communities, converges to locally-optimal assignment, **and runs faster** [S13].

Target modularity: *Trimming the Hairball* reports **Q ∈ [0.65, 0.85]** as the empirical band
where "a single connected component generally provide[s] well-defined communities with clear,
uncluttered relations to one another" [S6]. Q = 0.26 is what a hairball looks like.

If you must run community detection in the browser, `graphology-communities-louvain` exists in
the graphology ecosystem [S8] — but **[I] for 3.4M edges this belongs in a nightly job writing a
`community_id` column, not in the browser.**

**(c) GPU whole-graph — orientation and beauty, not analysis.**

Cosmograph runs the **entire force simulation on the GPU** with WebGL rendering and zero-copy
data flow, handling 1M nodes / several M edges in real time, fully client-side, no server [S2][S3].
Its stack is Apache Arrow + DuckDB-Wasm + Mosaic + regl. Published examples include
475,448 nodes / 1,014,134 edges. Known limitation: "when you have multiple nodes trying to fit
inside one square, there will be computational artifacts making the layout more noisy" — the
algorithm runs on a square grid with a configurable space size, and very large graphs may not
fit even at maximum [S2].

Graphistry solves the same problem differently — layout on a **server GPU**, render in browser
WebGL, cuGraph ECG for communities + ForceAtlas2 for layout, Apache Arrow between services [S11].
**[I] That is a heavier operational commitment (GPU server) than this project should take on.**

### 2.4 Hairball avoidance — the specific toolkit

**Edge cutting.** *Trimming the Hairball* [S6] compares four deterministic strategies, ranking
edges into a priority queue and removing sequentially while the degree of each linked node stays
above one:
1. **Decreasing edge betweenness** — removes the bridges first, so communities separate cleanly
2. **Increasing edge frequency/weight** — the classic "drop low-weight links" threshold
3. **Increasing edge information** — rank by pointwise mutual information
   `I(X;Y) = Σ p(x,y)·log[ p(x,y) / (p(x)p(y)) ]`; this is the one that specifically targets
   **high-degree nodes as "the primary causes of the hairball effect"** — an entity that connects
   to everything carries almost no information about any one partner
4. **Random** — the control

Their two-stage method: cut to a **skeletal** graph, then **refill within-community edges** to
give communities shape and mass. Result on the case study: Q 0.26 → 0.77, at 5.0 edges/node.
They also warn that cutting from low-degree nodes can fragment the graph, so they iteratively
reconnect components in decreasing order of edge-removal priority.

**[I] The mutual-information strategy is the right default for CivicGraph.** "Everyone
contracts with Services Australia" is exactly a zero-information edge. "This tiny Aboriginal
corporation and this specific philanthropic trust both appear only with each other" is a
high-information edge — and it is the kind of edge Ben is actually hunting.

**Motif simplification.** Replace recurring structures with compact glyphs — **fans** (nodes with
a single neighbour), **connectors** (nodes linking anchor nodes), **cliques** (fully connected
sets). "Well-designed glyphs require less screen space and layout effort, are easier to
understand, can reveal hidden relationships, and preserve underlying information" [S14].
**[I] The fan glyph is worth building for this data specifically** — a department with 3,000
one-off grant recipients should render as one fan glyph labelled "3,000 single-grant recipients,"
not 3,000 dots.

**Map-like qualities.** [S6] cites empirical work that "the negative impact of link crossing
diminishes with increasing graph size," that map-like node-link-group diagrams **increase
memorability** and improve group-level task performance with no cost to node-level tasks, and
that "adding map-like substrates and visual landmarks to node-link diagrams supports orientation
and revisitation." Their conclusion: "the more they look like actual maps, the more useful and
usable they will be." **[I] This validates giving the L1 meta-graph territory shading, named
regions and stable positions across sessions** — the "constellation" reading is not decoration,
it is measurable usability.

Their four target insight types are a good spec for what an exploration UI must make findable:
**unexpected community**, **unexpected membership**, **unexpected connection**, **unexpected
degree** [S6].

**Alternative encodings.** eagereyes' critique [S5] is blunt: node-link "excels for small
networks" and "once networks grow beyond a few dozen nodes... deteriorate into visual clutter."
The recommended alternatives are **adjacency matrices** (no crossings; but "seeing structures
requires some training" and row/column ordering matters enormously), **node quilts** (folded
matrices for hierarchical directed graphs), and **PivotGraph** — aggregate the graph along
*categorical dimensions*, turning individual nodes into groups, answering specific questions like
"communication between departments." **[I] PivotGraph is an under-rated fit here**: a 6×6 grid of
`funder_type × recipient_type` with edge thickness = dollars answers "how does money move between
kinds of organisation in Australia" in one screen, at zero hairball risk.

### 2.5 Sampling is a trap

If you are tempted to "just show a random 5,000 nodes": don't, without saying so loudly.

- **Induced subgraph sampling is heavily biased even for simple statistics** — a random node set
  with induced edges "does not retain a power-law degree distribution" [S15]
- **Degrees are underestimated in every sampled subgraph**, because only a fraction of each
  node's neighbours are included — a downward bias present regardless of algorithm [S15]
- **Incident-subgraph sampling biases towards high-degree nodes**, an upward bias on the degree
  distribution [S15]
- Worst for us: "standard network sampling, especially those biased to degree, can **dramatically
  inflate apparent community modularity, overlap, or density — creating structural artifacts not
  present in the original network**" [S15]
- At real-world sampling rates of 10–20% with large max degree, the recovery operator is
  "effectively not invertible" [S15]

**[I] Rule for this project: never sample randomly for a view that carries an analytical claim.**
Use *deterministic, stated* filters — "top 500 by total funding in 2024–25", "all edges above
$100K" — so the caption can say exactly what was excluded. This is the same discipline as the
Atlas layer registry's `caveat` field.

### 2.6 How the serious tools do it

| Tool | Core move | Transferable lesson |
|---|---|---|
| **ICIJ Offshore Leaks** [S16][S17] | Neo4j behind a **search-first** interface over 810K+ entities, 200+ countries; graph shown only around a resolved entity; new reconciliation API to match your own names/addresses against theirs | Search is the front door, graph is the second screen. Also: **an entity-reconciliation API is a product**, and CivicGraph's `entity_xref` (1.2M rows) is the same asset. |
| **ICIJ Datashare** [S16] | Neo4j graph plug-in bolted onto a **document** platform, led by a Neo4j fellow | Documents and graph in one tool. JusticeHub's media/story data is the analogue. |
| **Linkurious / Ogma** [S18][S9] | Explicit hairball doctrine: "usually comes from trying to show too much data at once"; fix with filtering + SNA centrality; **filter on the backend**, render only necessary nodes, load dynamically | Never ship the whole graph to the client. Ever. |
| **Cambridge Intelligence (KeyLines/ReGraph)** [S7] | Names three failure modes — **hairball**, **snowstorm** (too sparse/disconnected: fix by grouping or link inference), **starburst** (one dominant node) — plus **combos** (collapsible node groups) as the primary declutter tool | Combos/collapsible groups are the single highest-value interaction to build. Snowstorm matters too: an isolated org with no edges is a data-coverage bug worth surfacing. |
| **Neo4j Bloom** [S19] | Selective expansion — "be selective about which relationship types to expand, or which neighbor types to explore" | Expansion must be **typed**, not "expand everything." |
| **Maltego** [S19] | Seed entity + **transforms** that enrich a node from external sources | The "enrich this node" verb (pull ABR, ASIC, ACNC, AusTender on demand) is a natural CivicGraph action. |
| **Kumu** [S20] | Stakeholder/systems maps with built-in closeness, betweenness, eigenvector centrality, automated community detection colouring, **bridge identification between communities**, tags/attributes surfaced through switchable **"perspectives"**, and a **focus** feature that "start[s] with a single person or connection and unveil[s] the network step by step" | "Perspectives" = saved lens presets. CivicGraph's 10 graph modes are already this; give them names, URLs and descriptions and they become a product feature. |
| **OpenOwnership BOVS** [S21][S22] | A published **visualisation standard** for ownership diagrams: 7 principles — Intuitive, Simple ("add complexity in layers"), Prioritised, **Accurate** ("design can accidentally mislead... BOVS explicitly incorporates rules for cases where knowledge is missing"), Powerful, **Sketchable** ("must be easy to produce using just pen and paper"), Open | The closest philosophical match to Ben's honesty requirements. **Adopt "Accurate" and "Sketchable" as hard constraints.** A CivicGraph diagram that can't be redrawn on a whiteboard in a community meeting has failed. |
| **Graphistry** [S11] | Server-GPU layout, browser WebGL render, Arrow transport, cuGraph ECG communities | The architecture to copy *if* scale ever demands it; the ops cost to avoid until then. |

---

## 3. Money-flow visualisation

### 3.1 The specific question: funder → intermediary → delivery org → place

That is a **4-stage directed acyclic flow**. Sankey is the correct primitive — and it lands
almost exactly on the published legibility limits:

- "Keep the number of nodes per stage to **10 or fewer** when possible. If you have more
  categories, aggregate them into broader groups." [S23]
- "**Limit stages to 4–5 levels.**" [S23]
- "A Sankey starts to lose legibility past about **30–40 nodes**, depending on link density...
  Below 8–10 nodes it's overkill — a bar chart or stacked bar conveys the same information
  faster. The useful range is roughly **10 to 30 nodes** with at least one and a half times that
  number of links." [S23]
- **Hard limitation:** "Sankey diagrams are designed for **unidirectional, acyclic** flows. If
  your data includes loops, recycling processes, product returns, and re-allocations, you cannot
  represent them natively without distorting the structure." [S23]
- If all bands are nearly the same width, the proportional advantage disappears and **a table is
  better** [S23].

**[I] The cycle warning is a live risk for CivicGraph.** Australian funding genuinely contains
loops: a peak body that receives Commonwealth funding *and* sub-grants to members *and* has
members who contract back to the Commonwealth. `mv_revolving_door` exists precisely because
these cycles exist. **A Sankey will silently lie about these.** Mitigation: run cycle detection
on the flow subgraph and either (a) break the cycle at the lowest-value edge and annotate it, or
(b) refuse to render and show the chord/matrix view instead, with a message saying why. Refusing
to render, with a reason, is the BOVS "Accurate" principle in code.

**[I] Recommended construction for CivicGraph:**

```
Stage 1  Funder        — top 8 by $ + "47 others"     (gs_relationships.source, funder types)
Stage 2  Instrument    — grant / contract / donation  (relationship_type — a fixed 4–6 set)
Stage 3  Intermediary  — only rendered when it exists; otherwise a pass-through band
Stage 4  Delivery org  — top 8 + "N others"
Stage 5  Place         — LGA / remoteness band / SEIFA decile band
```

Five stages is at the stated limit. **[I] Ship 4 by default** (fold Instrument into edge colour)
and let stage 3 appear only on the intermediary lens. Every stage caps at 8 real + 1 "others"
node = 9, inside the ≤10 rule. Total ~36–45 nodes — slightly over the 30–40 legibility band, so
the "others" nodes must be visually recessive.

Precedent: USAFacts renders the entire US federal budget as a Sankey — revenue blocks left
($4.9T FY2024), spending blocks right ($6.8T), deficit in the centre [S24]. OpenSpending is the
global open-fiscal-data platform in this space [S24]. A known critique worth heeding: Sankeys
"are not so good at providing a visual distinction between **stocks and flows**" [S24] —
**[I] for us that means a foundation's *corpus* and its *annual giving* must never appear as
comparable bands.**

### 3.2 When each money-flow form beats a node-link diagram

| Form | Use when | Avoid when | Source |
|---|---|---|---|
| **Sankey / alluvial** | staged, acyclic, "how is the total subdivided at each step"; relative flow size matters as much as direction | cycles, re-entrancy, >5 stages, >10 nodes/stage, uniform band widths | [S23] |
| **Alluvial specifically** | categorical change **over time** — how orgs move between funding states across years | one-shot flows | [S23] |
| **Chord** | **symmetric** relationships — state↔state, sector↔sector co-funding | directed asymmetric flows; more than ~20 groups | [S23] |
| **Arc diagram** | one ordered axis (time, alphabet, rank) with links above/below; good for spotting a single entity's reach | dense graphs — becomes its own hairball | [I] |
| **Adjacency matrix** | **>20 nodes and dense**; counting, comparing, finding blocks | path-finding; untrained audiences | [S12][S5] |
| **PivotGraph** | aggregate along 2 categorical dimensions — `funder_type × recipient_type` | when the individual entity is the point | [S5] |
| **OD map** (Wood/Dykes/Slingsby) | origin→destination *with geography preserved on both sides* | audiences who've never seen one | [S25] |
| **Node-link** | ≤ ~150 nodes, path-finding, "who is connected to whom" | counting, comparing, ranking, anything dense | [S12] |

### 3.3 The geography-of-flow problem, and the best answer

"Money moved from funder → ... → place" has a spatial component that Sankey drops entirely.
Drawing flow lines on a map instead is worse: "flow maps easily become too crowded to be
useful" [S26]. Edge bundling helps but introduces a serious honesty bug: **"bundled edges may be
perceived as actual routes of flows, which makes it difficult for the map reader to follow the
connections between origins and destinations"** [S26]. Money did not travel along that curve.

The strongest answer in the literature is **OD maps** — Wood, Dykes & Slingsby (2010),
*The Cartographic Journal* 47:117–129 [S25]. The move: **map OD vectors as cells rather than
lines**, in a gridded two-level spatial representation. It is comparable to constructing an OD
matrix, but "unlike the OD matrix they **preserve the spatial layout of all origin and
destination locations**." Concretely: a small map of Australia, where each cell is itself a small
map of Australia, showing where money from that origin lands. Prior approaches "suffered from
problems of occlusion usually requiring some form of generalisation... which can lead to loss of
detail or the introduction of **arbitrary artefacts**" [S25].

**[I] For CivicGraph the natural OD map is `funder state/LGA → recipient LGA`**, using the
hex-tile layout from §4.4 as the grid so both levels stay legible. This is genuinely a
"cross-section no one else does" — I found no Australian philanthropy/procurement OD map in the
search results. It is also the hardest of the recommended views and should come last.

Design menu for clutter reduction on flow data, per [S26]: "edge bundling, overlap avoidance,
filtering and brushing, density kernels, and data aggregation." **Filtering and brushing are the
cheapest and the most honest** — they don't change the geometry, so they can't imply false routes.

---

## 4. Geographic visualisation — Australia specifically

### 4.1 A live boundary risk: ASGS Edition 4 shipped three weeks ago

**[V]** From the ABS: **ASGS Edition 4 covers July 2026 – June 2031 and was released
2026-07-22** [S27]. Changes from Edition 3: Mesh Blocks, SA1s, SA2s and SA3s **updated to
reflect population growth and infrastructure**; UCLs now built from Mesh Blocks rather than SA1s;
Australian Drainage Divisions and Tourism Regions removed; digital boundary files use **GDA2020**.
Non-ABS structures — LGAs, State/Commonwealth Electoral Divisions, **Postal Areas**, **Suburbs
and Localities (SAL)**, Destination Zones — are all *Mesh Block approximations of official
boundaries*. The ABS explicitly warns: "Some ABS collections continue using Edition 3, with data
transitioning progressively... **check which version of the ASGS has been used in data releases
for accurate data linkage.**"

**[I] This is a real hazard for the LGA attribution work.** `abs_poa_lga_ratio`,
`abs_sal_lga_ratio`, `postcode_sa2_concordance` and every `lga_source` stamp were built against
Edition 3 (2021). Any Edition 4 boundary file dropped in as a basemap will silently mismatch
some codes. **Recommendation: pin the boundary vintage as an explicit field on the map layer
("ASGS Ed. 3, 2021") and render it in the caption**, exactly as the Atlas registry already does
for caveats. Do not upgrade to Edition 4 boundaries until the concordance tables are rebuilt.

Reference geography sizes, for choosing the honest unit [S27][S28]: SA1 ≈ 200–800 people;
**SA2 ≈ 3,000–25,000 people** and is explicitly designed to "represent communities that interact
together socially and economically"; SA3 ≈ 30,000–130,000; SA4 > 100,000. Boundary files are
distributed by the ABS and via the **Digital Atlas of Australia** [S28].

### 4.2 Choropleth honesty — the three ways this data will lie

**(1) Raw counts on a choropleth.** "Mapping raw counts on a choropleth is the number-one
error — larger regions naturally accumulate more of almost anything" [S29]. Choropleths "require
that data are standardized (rates, ratios)"; dot density and proportional symbols can take raw
counts, choropleths cannot [S30].

**[I] Concretely: a choropleth of `mv_funding_by_lga.total_funding` is a broken chart.** It will
paint the Pilbara and Central Australia dark because they are enormous, and paint the entire
funding concentration of Sydney invisible. Every dollar layer must be **per capita**, **per
young person**, or **per unit of need**, or must switch form.

**(2) MAUP.** The Modifiable Areal Unit Problem: "the choice of spatial units and aggregation
schemes can dramatically alter the appearance of spatial patterns... especially crucial in
choropleth mapping" [S29]. **[I] For CivicGraph this is not theoretical** — the same funding
data at postcode (12,299 units), SA2 (2,473) and LGA (~565) will tell three different stories,
and the LGA rebuild memory notes that postcodes straddle LGAs with ratio-based attribution.
**Mitigation: make the geography unit an explicit, visible, switchable control, never a hidden
default**, and show the same measure at two units side by side when the claim is important.

**(3) Small-population instability.** Rates over small denominators swing wildly. The literature
recommends "normalizing data, **smoothing unstable rates**, and framing interpretations
appropriately" [S29]. **[I] For remote Australian LGAs with populations in the hundreds, a
per-capita funding figure can move by 300% on one grant.** Mitigations, in order of preference:
(a) suppress and label below a population floor; (b) empirical-Bayes shrink toward the state
mean; (c) widen the class interval; (d) show a confidence indicator. Do at least one.

### 4.3 Why a raw Australian LGA choropleth misleads — the specific mechanism

The R Journal hexagon-tile-map paper [S31] states it precisely for Australia: "choropleth map
displays can misrepresent the spatial distributions of human related statistics due to
**area-size bias**." Their worked example: thyroid cancer incidence in densely-populated Sydney,
Brisbane and Perth **becomes invisible**, "while vast rural regions with fewer residents command
visual attention." ABS SA2s "vary enormously in both size and population" by design.

The `sugarbag` README puts the same point in funding-map terms [S32]: an Australian choropleth
"draw[s] attention to the expanse of dark and light blue areas across rural communities in all
states... this display neglects the vast amount of Australian residents living in the densely
populated capital cities."

**[I] For a philanthropy/funding map this is the worst possible failure**, because it inverts the
actual editorial claim. The interesting story is usually "remote communities are underfunded per
head" — and a raw choropleth makes remote Australia *visually dominant*, which reads as the
opposite.

### 4.4 Why cartograms don't rescue it, and hex tiles do

Contiguous cartograms "distort geographic shapes... creating unfamiliar topology";
non-contiguous ones "maintain shapes but lose neighbor connections and can leave small
populations invisible"; Dorling cartograms "use circles scaled to population, emphasizing
density but losing geographic structure" [S31]. And specifically: "**a population cartogram of
Australia distorts the map into an unrecognizable shape**" [S32].

Hexagon tile maps win here because they "retain neighbor connectivity, provide equal visual
weight, and maintain approximate spatial orientation — advantages for Australian geography
specifically" [S31]. The `sugarbag` algorithm [S31][S32]:
1. tessellate hex positions across the map, with a **buffer** extending past the coastline
   (so coastal cities get room), then filter out unnecessary ocean cells
2. allocate area centroids to hexes **in order of proximity to focal points** (capital cities)
3. **distance filtering** — only hexes within a radius of a centroid are candidates
4. **angular filtering** — a default **30-degree wedge** centred on the focal-point→centroid
   bearing preserves the spatial relationship; the wedge widens if there aren't enough hexes
5. a `width` parameter controls positioning flexibility

**[I] Recommendation: precompute the hex layout ONCE, offline, and ship it as a static
TopoJSON/JSON of hex centroids keyed by LGA/SA2 code.** It is a fixed geometry — it never needs
recomputing, and it turns a heavy R algorithm into a 200KB static file. Then the hex map is just
a choropleth over a different set of polygons, using the exact same data join. This is a
one-afternoon asset that unlocks every "per capita" view in both apps.

Pair the two: **geographic choropleth for "where", hex tile for "how much per person"**, toggled,
with the toggle labelled in plain words ("Real shape" / "Equal weight").

### 4.5 Bivariate maps — funding vs disadvantage

This is exactly Ben's cross-section (`seifa_irsd_decile` × funding). It works, with caveats.

- Early research "questioned the viability of the bivariate choropleth map and found it to be
  acceptable" [S33]
- They are "**more difficult to read than univariate choropleth maps because they simply contain
  more colors**"; "often not initially intuitive and sometimes require looking back-and-forth
  with the legend, and **even with a 3×3 legend, it can take time to read and understand specific
  values, especially for middle values**" [S33]
- Wainer & Francolini (1980) flagged legend difficulty with **16 (4×4) classes** [S33]
- Retchless & Brewer evaluated eight designs and found **adding a patterned overlay to a colour
  choropleth was the most preferred** [S33]
- The "corners model" legend "may require map readers to consult the legend more often... due to
  the lack of colour gradation" [S33]

**[I] Recommendation: 3×3 maximum, never 4×4.** Label the two axes in plain English on the
legend itself ("more disadvantaged →" / "more funding ↑") and **name the four corners as
findings**: "high need, low funding" is the cell Ben actually wants, so give that cell a name and
make it clickable to a list. Consider the patterned-overlay variant (disadvantage as colour,
funding as hatch density) since it tested best. And **always offer the two univariate maps as a
fallback toggle** — the bivariate map is the headline, the univariates are the proof.

### 4.6 Dot density and proportional symbols — the underused options

Dot density advantages over choropleth [S30]: (1) can map **raw counts** as well as rates,
(2) data "need not be tied to enumeration units, avoiding some choropleth concerns" — i.e. it
sidesteps MAUP, (3) works in black and white. Proportional symbols: "the size of the enumeration
unit doesn't matter... on a choropleth map, **smaller places are easily overlooked — even if they
have large data values**"; and readers extract numbers more easily from symbol size than by
counting dots [S30].

**[I] Given this DB has point lat/lon for ~10 tables and no polygons, proportional symbols are
the lowest-friction honest map available today.** One circle per delivery org, area ∝ dollars,
positioned at its point — no boundary file, no MAUP, no area bias, and it works at national zoom.
Build this before any choropleth. (Use **area**, not radius, for the scale, and cap the max
radius so Sydney doesn't swallow Newcastle.)

### 4.7 Showing what you don't know

The LGA attribution work produced reason-coded nulls — `unplaced_pc ≈ 28,490`, `no_postcode
274,938`, with provenance stamps like `poa_ratio_nolocality` needing a "How sure" label. The
Atlas registry already forces a `caveat` per layer. The literature backs this up:

- **Encode uncertainty geometrically, not just in a footnote**: "features with less certain
  boundaries or attributes can be depicted in **coarser resolution**"; "less certain boundaries
  may be visually encoded with **fuzzy boundaries**" [S34]
- Combine "layer transparency-based uncertainty with **texture patterns**" [S34]
- **Set-based visualisation "enables multifield missing data patterns to be discovered"** using
  bar charts for sets, heatmaps for set intersections, histograms for distributions [S34] — this
  is an UpSet plot, and **[I] it is the right chart for "which combination of fields is missing
  across `gs_entities`"**, which is a question Ben's coverage/gap goal directly needs.

**[I] Concrete pattern for CivicGraph maps: a permanent "unplaced" bar beside every map.** Not a
footnote — a visible, clickable bar showing the share of dollars that could not be placed, split
by reason code, that filters the map when clicked. It converts the honesty constraint into a
feature, and it is the single thing that would most distinguish these maps from every
government dashboard.

### 4.8 Mapping stack — the recommendation

Given **no PostGIS**, **maplibre-gl already in JusticeHub**, **leaflet in both**, and
**deck.gl in neither**:

| Need | Use | Why |
|---|---|---|
| Point maps, ≤ ~5,000 markers | **Leaflet** (already in both) | Zero new deps. Adequate for proportional symbols at national scale. |
| Vector choropleth, hex tiles, smooth zoom | **maplibre-gl** (already in JusticeHub; **add to grantscope**) | GL choropleths recolour without re-rendering geometry; needed for semantic zoom between LGA→SA2. Standardises both repos on one map engine. |
| Boundary delivery | **PMTiles on static hosting** | Single-file tile archive readable by **HTTP range requests** from S3/commodity storage, "free of a custom tile backend or third party provider" [S35]. MapLibre doesn't speak PMTiles natively — you register a protocol handler via the `pmtiles` JS library's `addProtocol` plugin [S35]. Host must send `Access-Control-Allow-Origin` and **`Access-Control-Allow-Headers: Range`** [S35]. Prefer PMTiles "when you want zero server logic (static hosting only), you have a bounded dataset... and you want simple deployment and low ops" [S35] — Australia's boundaries are exactly that. |
| Small national inset maps, hex grids, cartograms, SVG-in-report | **inline SVG + TopoJSON**, no library | Reports and OG images need SSR-able static SVG; an LGA hex grid is a few hundred polygons, trivially rendered server-side. |
| >100K points / GPU layers | **deck.gl over maplibre** — only if needed | "deck.gl is usually the better fit for dense data visualisation and custom analytical layers, MapLibre for general interactive map rendering" [S36]; deck.gl is ES-module compliant since v9 and works under Next SSR; MapView syncs to MapLibre's camera (interleaved / overlaid / reverse-controlled) [S36]. Perf tip from the same source: **dual-layer setup — a non-pickable base layer for draw speed plus a separate pickable layer for hover** [S36]. **[I] Not needed yet — 609K entities is a server-side aggregation problem, not a client rendering one.** |

**[I] Verdict: add `maplibre-gl` + `pmtiles` to grantscope; do not add deck.gl; retire Leaflet
gradually rather than in a big-bang.** Precompute the hex layout offline as static JSON.

---

## 5. Semantic zoom and drill-down mechanics

### 5.1 The principle: each level answers a different question

Semantic zoom "implements Shneiderman's mantra of *overview first, zoom and filter, then
details-on-demand* where **the representation itself changes** based on the user's level of
scrutiny" [S37]. The worked example is exactly the point: in a supply-chain visualisation, "at
country scale, bundled flows reveal arterial shipping patterns; at city scale, hexagonal heatmaps
show demand concentration; at warehouse scale, sunburst charts expose inventory composition"
[S37]. Three zoom levels, three *chart types*, three *questions*.

Semantic zoom is explicitly distinguished from aggregation/hierarchical clustering (which "may
disrupt internal connectivity and layout stability") and from filter-progressive rendering
("which does not couple level of detail to zoom operations") [S37].

**[I] The failure mode Ben is trying to avoid — "showing the same thing smaller" — has a precise
diagnosis: it happens when zoom is bound to *geometry* instead of to *representation*.** The
test for every level: write down the sentence a user could finish at that level and nowhere else.
If two levels finish the same sentence, delete one.

Proposed ladder for CivicGraph, one sentence each:

| L | Sentence only this level can finish | Form | Data source |
|---|---|---|---|
| **L0** | "The database holds ___ kinds of thing, and they connect through ___." | schema graph + catalogue table | `/api/data/schema-graph` (**already built**) |
| **L1** | "Australian funding clusters into ___ groups, and the biggest is ___." | meta-graph of Leiden communities + national hex map | nightly `community_id`; `mv_funding_by_lga` |
| **L2** | "In ___ LGA, ___ orgs receive ___ from ___ funders." | place dossier: proportional-symbol map + Sankey + ranked table | `mv_lga_place_profile`, `mv_funding_by_lga` |
| **L3** | "___ is connected to ___ through ___, worth $___." | DOI ego-network, expand-on-demand | `gs_relationships` k-hop |
| **L4** | "This specific relationship came from ___ on ___ and we are ___ sure." | record + provenance panel | row + `confidence`, `dataset`, `source_url` |

Note L1→L2 is a **map**, L2→L3 is a **graph**, L3→L4 is a **record**. Three different forms in
one drill path. That is what "several levels" should mean.

### 5.2 Drill-down state and history

Hierarchical-aggregation research gives two rules worth honouring [S38]:
- "Drill-down and drill-up patterns for clustered graph visualizations support **browser history
  and state preservation**"
- "The **ordered sequence of drill-down operations** is displayed from the root view to the
  user's current visualization" — i.e. a real breadcrumb of *operations*, not of *pages*

**[I] The breadcrumb should read like a sentence:**
`Australia › Youth justice › 2023–25 › Central Desert (NT) › NPY Women's Council › funders`.
Every segment is clickable and every segment is a URL.

The counter-warning from [S6]: converting large graphs into drill-through hierarchies "loses the
benefits of a single, flat layout that exposes community membership and provides a navigable and
memorable frame of reference," which matters "for adversarial use cases where nodes and
communities of interest could appear anywhere in the graph." **[I] Hence the L1 flat meta-map
must persist as a stable, always-available "you are here" frame** — a mini-map in the corner of
L2/L3 showing where the current focus sits in the whole field. Positions must be **stable across
sessions** (persist the layout, don't re-run force layout each load) or the memorability benefit
evaporates.

### 5.3 Linked brushing and cross-filtering

Crossfilters are "behaviors that let users subset a multivariate dataset via **direct
manipulation across multiple views**, also known as linked brushing or linked filtering" [S39].
The lineage runs Crossfilter (2012) → dc.js → every modern coordinated-view dashboard [S39].
"Interacting with one plot (e.g. selecting a range of years) will dynamically filter the data in
the other plot" [S39]; Tableau's own whitepaper frames it as "seeing related data in multiple
views can help understand issues in a more complete way" [S39].

**[I] For CivicGraph the crossfilter dimensions that matter are the ones Ben names as
cross-sections:** year, state/LGA, remoteness, SEIFA decile, sector, entity type, relationship
type, amount band, community-controlled flag. **[I] Nine dimensions is too many for one bar of
controls** — put the three primary ones (year, place, topic) in a persistent header rail and the
rest behind a "refine" drawer, per the "One Desk" taste note (rail owns filters).

**[I] Architectural constraint:** true client-side crossfilter needs the data in the browser.
With 3.4M edges that is impossible. Two options: (a) **crossfilter only the aggregate layer** —
ship 2,000 LGA rows or 500 meta-nodes to the client and crossfilter those instantly, drilling to
the server only on demand; or (b) **server round-trip per filter change**, which is honest but
laggy. Option (a) is right: the aggregate layer is small enough to be fully in-browser, and it is
where cross-filtering actually pays off. This is the same "small data on top of big data"
pattern Cosmograph uses with DuckDB-Wasm [S3].

### 5.4 URL state — shareable, bookmarkable, reloadable

Deep-linkable state is a stated need in analytics products generally [S39]. For Next.js App
Router the mature answer is **nuqs** [S40]: "a type-safe search params state manager... like
`useState`, but stored in the URL query string," with "end-to-end type safety between Server and
Client components," built-in parsers/serialisers, shallow updates by default with **opt-in
`shallow: false` to re-render RSCs** (pair with `useTransition` for loading states), and typed
`searchParams` access in nested Server Components with **no prop drilling** [S40]. Setup requires
a `NuqsAdapter` from `nuqs/adapters/next/app` in the root layout [S40].

**[I] This fits the project's "Server Components by default" constraint better than any
client-state alternative**, because the filter state can be read by the server component that
runs the query. Recommended: adopt `nuqs` in grantscope; JusticeHub is on Next 14.2 which nuqs
also supports.

**[I] URL schema to standardise across both apps** (so links are portable):
```
/explore?lens=justice&year=2023-2025&place=LGA36070&topic=youth-justice
        &focus=GS-12345&depth=2&s=120&view=graph
```
`lens` = saved preset (Kumu's "perspective"), `focus` + `depth` + `s` = the DOI parameters,
`view` = which representation. **The whole drill-down state is then one copy-pasteable string** —
which is what makes a finding shareable with a funder or a journalist.

### 5.5 Server-side mechanics for k-hop expansion

Postgres can do this, with limits. "A graph traversal of depth N becomes N joins, and for small N
this is fine. A two-hop or three-hop traversal over indexed foreign keys is fast in Postgres
because Postgres is good at indexed joins" [S41]. But: "PostgreSQL's recursive executor is
fundamentally an iterative set processor, not a traversal framework — it **cannot maintain
visited state across iterations, cannot skip already-explored nodes, and collapses duplicates
only at the end**" [S41]. The cited worst case: a recursive CTE took **47 seconds** on a
335K-node tree where an in-memory C BFS took **227ms** [S41]. Bottom line from the source:
"recursive CTEs work well for shallow, fixed-depth k-hop queries (typically **2–3 hops**) with
proper indexing" [S41].

**[I] That is fine, because §2.2 already says the UI must never show more than ~150 nodes, and
[S1] says two hops from one node already blows past that.** The correct implementation is:
1. **Bounded, non-recursive, hop-by-hop.** Hop 1: one indexed query on
   `(source_entity_id)` and `(target_entity_id)`. Rank by DOI, take top S₁. Hop 2: query only
   those S₁ ids. Never `WITH RECURSIVE` on an unbounded frontier over 3.4M edges.
2. **Precompute API (a priori interest) as a column**, not per-request — total dollars,
   `system_count` from `mv_entity_power_index`, degree. Nightly.
3. **Cap degree at query time.** `LIMIT 200 ORDER BY amount DESC` per node, and return the true
   count separately so the UI can print "4,182 connections (showing top 200)" — van Ham & Perer's
   exact pattern [S1].
4. **[U]** SQL/PGQ property-graph queries are reportedly landing in PostgreSQL 19 [S41] — worth
   watching, not worth waiting for.

---

## 6. Concrete recommendation

### 6.1 Which view for which question

| # | Question | View | Library | Where | Cap |
|---|---|---|---|---|---|
| 1 | "What data do we hold and how does it join?" | **Schema constellation** — tables as nodes, FK/ABN/postcode joins as edges, coloured by domain, sized by row count | `react-force-graph-2d` (installed) | grantscope `/clarity` | ~120 nodes — **API already exists, page missing** |
| 2 | "Where is the money concentrated?" | **National hex-tile map**, per-capita, toggle to real geography | maplibre-gl + static hex TopoJSON | both `/atlas` | ~550 LGA **[U]** / 2,473 SA2 **[V]** hexes |
| 3 | "Where is need high and funding low?" | **Bivariate 3×3 choropleth**, SEIFA × funding-per-head, corner cells named + clickable | maplibre-gl | grantscope `/places` | 3×3 only |
| 4 | "How does money move funder→place?" | **Sankey**, 4 stages, top-8 + "N others" per stage, cycle detection with refusal | `d3-sankey` (in JusticeHub; **add to grantscope**) | both | ≤10/stage, ≤5 stages |
| 5 | "Who is connected to this org?" | **DOI ego-network**, expand-on-demand, typed expansion, hidden-neighbour counts | `react-force-graph-2d` | grantscope `/entity/[gsId]` (exists, 237 lines — upgrade it) | **30–150 on screen** |
| 6 | "How do kinds of org fund kinds of org?" | **PivotGraph** — categorical grid, edge width = dollars | inline SVG | new | 6×6 |
| 7 | "Which orgs sit in more than one system?" | **Adjacency matrix / heatmap**, entity × system, ordered by community | inline SVG or Recharts | `/power` | 200×7 |
| 8 | "Where does funding from X land?" | **OD map** (Wood/Dykes/Slingsby), hex grid at both levels | inline SVG over hex JSON | new, last | state×LGA first; LGA×LGA only if it reads |
| 9 | "What's missing?" | **UpSet-style missing-field plot** + permanent "unplaced $" bar next to every map | inline SVG | everywhere | — |
| 10 | "What is the whole field?" | **GPU whole-graph**, search-first, orientation only | Cosmograph `@cosmograph/cosmos` — **new dep, optional** | `/graph` | 609K nodes — **art, not analysis** |

### 6.2 Library decisions

**Add to grantscope:** `maplibre-gl`, `pmtiles`, `d3-sankey` + `d3-scale` + `d3-shape`, `nuqs`.
**Add to neither (yet):** deck.gl, sigma.js, Graphistry.
**Consider once, for view #10 only:** `@cosmograph/cosmos`.
**Keep:** `react-force-graph-2d` for every ≤150-node graph — it is well within its envelope there
and already in both repos.
**Retire slowly:** Leaflet, in favour of maplibre-gl, so both apps share one map engine.
**Do not port:** JusticeHub's cytoscape usage into grantscope. Cytoscape degrades at
3,000–5,000 nodes [S8] and grantscope has no view in that band that isn't better served by
force-graph or a matrix.

### 6.3 Honest performance limits

| Claim | Number | Confidence |
|---|---|---|
| Node-link view remains readable | **≤150 nodes on screen** | **[I]** from [S12] (matrix beats node-link >20 nodes), [S1] (2-hop = 2,345 nodes, "impractical") |
| `react-force-graph-2d` stays smooth | ~4k comfortable, ~75k in the library's own "large" example, wall ~100k | **[U]** [S10] |
| 2-hop expansion from a hub in this DB | will exceed the UI budget | **[I]** — must be capped and typed |
| Sankey legibility | 10–30 nodes, ≤10/stage, ≤5 stages | **[V]** [S23] |
| Postgres k-hop | 2–3 hops fine with indexes; unbounded recursion is a trap | **[U]** [S41] |
| Whole-graph GPU render of 609K/3.4M | technically fine in Cosmograph | **[U]** [S2][S3] — but analytically low-value |
| Client-side crossfilter | works on the ≤2,000-row aggregate layer only | **[I]** |
| Hex-tile layout compute | one-off offline; then a static file | **[I]** from [S31] algorithm description |

**The load-bearing honest limit:** at no point should a user be shown more than a few hundred
graph nodes. The value of 609K entities is in *what you can filter down from*, never in *what you
can see at once*.

### 6.4 Extend the Atlas layer registry to cover every view

**[V]** `src/lib/atlas/layers.ts` already forces every place-layer to declare a `caveat`, an
honest geography, a consent tier (`public`/`org`/`withheld`) and a state (`live`/`declared`),
with the note that org/withheld data must be stripped server-side, never hidden client-side.

**[I] Generalise this to a `VIEWS` registry covering all ten views above**, adding three fields
the research argues for:
- `boundaryVintage` — e.g. `'ASGS Ed. 3 (2021)'` (§4.1: Edition 4 shipped 2026-07-22 [S27])
- `excluded` — the *deterministic* filter applied, printed in the caption (§2.5: never sample
  silently [S15])
- `refusesWhen` — the condition under which the view declines to render, e.g. Sankey on cyclic
  flows (§3.1 [S23]), choropleth on raw counts (§4.2 [S29][S30]), rate below population floor
  (§4.2 [S29])

That last field is the BOVS "Accurate" principle made executable: "design can accidentally
mislead, so they deliberately choose approaches that are unambiguous to avoid suggesting we know
more than we in fact do" [S21][S22].

### 6.5 Build order

1. **`/clarity`** — the schema constellation. The API exists and is orphaned. Days, not weeks.
2. **Proportional-symbol national map.** No boundary files needed; sidesteps MAUP entirely.
3. **DOI upgrade to the existing entity network graph** — typed expansion, hidden-neighbour
   counts, capped hubs, stress-majorization-stable layout, URL state via nuqs.
4. **Nightly Leiden `community_id`** → unlocks the L1 meta-graph and community colouring
   everywhere.
5. **Hex-tile static asset** → unlocks every per-capita map, plus the bivariate map.
6. **Sankey with cycle refusal** in grantscope (port JusticeHub's `SankeyDiagram.tsx`).
7. **PivotGraph + matrix views** — cheap SVG, high analytical value, zero hairball risk.
8. **OD map**, then Cosmograph overview last, as the showpiece.

---

### 6.6 Wireframes — top 3 views

**View A — `/clarity`: the map of the data (L0)**

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ CIVICGRAPH ▸ CLARITY                        52,349,579 ROWS · 724 LIVE · 88 EMPTY    │
├──────────────────────┬───────────────────────────────────────────────────────────────┤
│ DOMAINS              │                                                               │
│ ■ Entity Graph   6   │              ┌───────────┐                                    │
│ ■ Registries    12   │       ╭──── │ gs_entities│ ────╮        ● = table             │
│ ■ Procurement    9   │       │  fk  │  609,448  │ fk  │        size = log(rows)      │
│ ■ Philanthropy   7   │       │      └─────┬─────┘     │        edge = fk│abn│postcode│
│ ■ Justice        8   │       ▼            │ fk        ▼                              │
│ ■ People        11   │  ┌─────────┐  ┌────┴─────────┐  ┌──────────────┐              │
│ ■ Geography      9   │  │entity_  │  │gs_relation-  │  │ abr_registry │              │
│ ■ Media          5   │  │xref 1.2M│  │ships  3.43M  │  │  20,006,350  │              │
│                      │  └─────────┘  └────┬─────────┘  └──────────────┘              │
│ SHOW                 │                    │ abn                                      │
│ ☑ foreign keys       │        ┌───────────┴────────┬─────────────────┐               │
│ ☑ abn joins          │   ┌────▼─────┐  ┌───────────▼──┐  ┌───────────▼──┐            │
│ ☐ postcode joins     │   │austender │  │justice_      │  │political_    │            │
│ ☐ empty tables (88)  │   │  823,620 │  │funding 157K  │  │donations2.5M │            │
│ ☐ backup cruft (4)   │   └──────────┘  └──────────────┘  └──────────────┘            │
│                      │                                                               │
│ ⚠ 4 backup tables    │              [ ⌕ find a table…              ]                 │
│   1.32M rows unused  │                                                               │
├──────────────────────┴───────────────────────────────────────────────────────────────┤
│ SELECTED ▸ gs_relationships   3,429,184 rows · 17 cols · 5.63 edges/entity           │
│ joins: gs_entities(source_entity_id, target_entity_id) · used by 10 graph lenses     │
│ [ browse rows ]  [ open in graph ]  [ column profile ]  [ copy SELECT ]              │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
*Why it works:* ~120 nodes, inside every legibility limit in §2.2. Answers the one sentence no
other level can. The API already returns this payload.

---

**View B — `/explore`: money to place (L1→L2)**

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Australia › Youth justice › 2023–25                     [ real shape | EQUAL WEIGHT ]│
├────────────┬─────────────────────────────────────────────────┬───────────────────────┤
│ LENS       │            ⬡ ⬡ ⬡                                │ TOP LGAs / young      │
│ ▸ justice  │          ⬡ ⬡ ⬡ ⬡ ⬡                 ⬡ ⬡          │ person, 10–17         │
│   power    │        ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡             ⬡ ⬡ ⬡         │  1 Central Desert     │
│   giving   │      ⬡ ⬡ ▓ ▓ ⬡ ⬡ ⬡ ⬡ ⬡         ⬡ ⬡ ⬡ ⬡        │      $4,120  ▓▓▓▓▓▓   │
│   contracts│    ⬡ ⬡ ▓ █ █ ▓ ⬡ ⬡ ⬡ ⬡ ⬡     ⬡ ⬡ ⬡ ⬡ ⬡        │  2 West Daly          │
│   people   │      ⬡ ⬡ ▓ ▓ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡          │      $3,880  ▓▓▓▓▓    │
│            │        ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡            │  3 Blacktown          │
│ YEARS      │          ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡              │      $  310  ▓        │
│ ├──●───●──┤│              ⬡ ⬡ ⬡ ⬡ ⬡ ⬡                       │  …                    │
│ 2019   2025│                                                 │ ─────────────────────  │
│            │  one hex = one LGA, equal weight  · ⬡ low  █ high│ ⚠ UNPLACED            │
│ PLACE      │  ASGS Ed. 3 (2021) boundaries                    │  $84.2M (9.1%) could  │
│ [ search ] │                                                 │  not be placed        │
│            ├─────────────────────────────────────────────────┤  ├ no postcode  6.2%  │
│ ▸ refine ⌄ │  FUNDER ──▶ INSTRUMENT ──▶ DELIVERY ──▶ PLACE   │  ├ straddling   1.8%  │
│            │  ┌────┐                                          │  └ unresolved   1.1%  │
│ SEIFA  1─10│  │NIAA│═════╗                    ┌──────────┐   │  [ show these rows ]  │
│ Remoteness │  └────┘     ╠══ grant ═══▶ ┌───┐ │Central   │   │                       │
│ Amount ≥$0 │  ┌────┐     ║              │NGO│═│Desert    │   │ excluded from view:   │
│ Community  │  │NTG │═════╣              └───┘ └──────────┘   │ edges < $10,000       │
│  controlled│  └────┘     ║   contract        ┌──────────┐   │ (deterministic, not   │
│            │  ┌────┐     ╚═════════════════▶ │West Daly │   │  a sample)            │
│            │  │+47 │                          └──────────┘   │                       │
│            │  └────┘  4 stages · top 8 + others per stage    │                       │
└────────────┴─────────────────────────────────────────────────┴───────────────────────┘
```
*Why it works:* hex map removes area bias [S31][S32]; per-capita, never raw counts [S29][S30];
Sankey inside the ≤10/stage ≤5-stage rule [S23]; the unplaced panel makes uncertainty a first-
class object [S34]; the "excluded" note satisfies §2.5. Rail owns filters. All state in the URL.

---

**View C — entity trace (L3): DOI ego-network, expand on demand**

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◀ Central Desert › NPY WOMEN'S COUNCIL          ABN 89 006 ··· · GS-41822            │
├──────────────────────────────────────────────────────┬───────────────────────────────┤
│                                                      │ SEARCH                        │
│                    ╭──────────────╮                  │ [ ⌕ name, ABN, person   ]     │
│         ┈┈┈┈┈┈ ○ ──┤ ((( NPY ))) ├── ● ─────╮        │                               │
│        ┊  +312     ╰──────┬───────╯   Ngaan-│        │ NETWORK SIZE  S = 120         │
│        ┊ hidden           │           yatja-│        │ ├───────●──────────┤ 30  400  │
│        ┊                  │            rra  │        │                               │
│    ┌───┴───┐         ┌────┴────┐             │        │ INTEREST WEIGHTS              │
│    │ NIAA  │         │  NTG    │         ┌───┴───┐   │ a priori (money) ├──●───┤     │
│    │$4.2M  │         │ $1.8M   │         │Board  │   │ search match     ├────●─┤     │
│    │ ▲ 2 hops       │  ▲       │         │ x4    │   │ hop distance     ├──●───┤     │
│    └───┬───┘         └────┬────┘         └───────┘   │                               │
│        │ ⋯⋯⋯ 4,182        │ ⋯⋯ 891                   │ EXPAND BY                     │
│        │     connections  │    connections           │ ☑ funding   ☑ board           │
│        ▼  ⚠ hub — filtered│                          │ ☐ contracts ☐ shared address  │
│   ╭─────────╮             ▼                          │                               │
│   │ top 200 │        ╭─────────╮                     │ SHOWING 118 of ~5,400 in 2hops│
│   │ by $ ⌄  │        │ top 200 │                     │ ⚠ 2 hops from here would be   │
│   ╰─────────╯        ╰─────────╯                     │   ~5,400 nodes — not drawable │
│                                                      │                               │
│   ○ = person   ● = org   □ = program   ⬡ = place     │ LOW-CONFIDENCE EDGES          │
│   ┈┈ = hidden neighbours (count on node)             │ ☐ include name-matched only   │
│   ((( ))) = matched your search                      │   (adds 34 edges, conf: low)  │
├──────────────────────────────────────────────────────┴───────────────────────────────┤
│ EDGE ▸ NIAA → NPY Women's Council · grant · $4,200,000 · FY2024 · dataset: grant-    │
│ connect · confidence: high · source: grants.gov.au/Go/Show?GoUuid=… [ open record ]  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
*Why it works:* this is van Ham & Perer's interface, adapted — search box, network-size slider,
three DOI weight sliders, hidden-neighbour counts printed on nodes, fading edges, search-match
halo, top-N expansion [S1]. The hub warning implements the "starburst" fix [S7]. Typed expansion
is Bloom's [S19]. The low-confidence toggle turns the `confidence` column into the edge-interest
function `EI` [S1]. Every node stays under the 150 budget [S12].

---

## 7. Sources

- **[S1]** van Ham, F. & Perer, A. (2009). *"Search, Show Context, Expand on Demand": Supporting Large Graph Exploration with Degree-of-Interest.* IEEE TVCG 15(6):953–960. https://perer.org/papers/adamPerer-DOIGraphs-InfoVis2009.pdf — **[V] read pp. 955–958 directly.**
- **[S2]** Nightingale (DVS). *How to Visualize a Graph with a Million Nodes.* https://nightingaledvs.com/how-to-visualize-a-graph-with-a-million-nodes/
- **[S3]** Cosmograph. *The Concept of Cosmograph.* https://cosmograph.app/docs-general/concept/ and https://cosmograph.app/library/
- **[S4]** Ghoniem/eagereyes/[S6] consensus — see individual entries.
- **[S5]** Kosara, R. *Graphs Beyond the Hairball.* eagereyes. https://eagereyes.org/blog/2012/graphs-hairball
- **[S6]** Edge, D., Larson, J., Mobius, M. & White, C. (Microsoft AI & Research). *Trimming the Hairball: Edge Cutting Strategies for Making Dense Graphs Usable.* https://www.microsoft.com/en-us/research/wp-content/uploads/2018/12/TrimmingTheHairball.pdf — **[V] read pp. 1–4 directly.**
- **[S7]** Cambridge Intelligence. *Graph visualization UX: Designing intuitive data experiences.* https://cambridge-intelligence.com/blog/designing-intuitive-data-experiences-with-graph-visualizations/ ; *Fixing Data Hairballs.* https://cambridge-intelligence.com/how-to-fix-hairballs/
- **[S8]** PkgPulse. *Cytoscape.js vs vis-network vs Sigma.js 2026: Graph Visualization Decision Guide.* https://www.pkgpulse.com/guides/cytoscape-vs-vis-network-vs-sigma-graph-visualization-2026 ; cytoscape/js-graph-lib-comparison https://github.com/cytoscape/js-graph-lib-comparison ; cytoscape.js issue #292 https://github.com/cytoscape/cytoscape.js/issues/292
- **[S9]** Linkurious. *Ogma — Best practices and performance.* https://doc.linkurious.com/ogma/latest/tutorials/best-practices/
- **[S10]** vasturiano. *react-force-graph* https://github.com/vasturiano/react-force-graph ; Starlog, *Force-Graph: Why Canvas Beats the DOM for Network Visualization* https://starlog.is/articles/data-knowledge/vasturiano-force-graph/
- **[S11]** Graphistry. *Investigate at Scale* https://www.graphistry.com/gpu ; *Architecture* https://graphistry-admin-docs.readthedocs.io/en/latest/planning/architecture.html ; *Scaling group-in-a-box layout* https://www.graphistry.com/blog/gpu-group-in-a-box-layout-for-larger-social-media-investigations
- **[S12]** Ghoniem, M., Fekete, J-D. & Castagliola, P. (2004/2005). *A Comparison of the Readability of Graphs Using Node-Link and Matrix-Based Representations* / *On the Readability of Graphs…* https://www.semanticscholar.org/paper/82038c93e6e803fad5804f2c82a8e74a657c4c31 ; summary at https://vdl.sci.utah.edu/mvnv/techniques/adj-matrix/
- **[S13]** Traag, V., Waltman, L. & van Eck, N.J. (2019). *From Louvain to Leiden: guaranteeing well-connected communities.* Scientific Reports. https://www.nature.com/articles/s41598-019-41695-z / https://arxiv.org/abs/1810.08473
- **[S14]** Motif simplification — via Cambridge Intelligence + Medium summary of the hairball problem. https://cambridge-intelligence.com/blog/hairball-effect-in-graph-visualization/ ; https://medium.com/@harikrishnank497/hairball-graph-problem-a8ce62d324d5 — **[U]** secondary sources for Dunne & Shneiderman's motif simplification.
- **[S15]** Network sampling bias: CMU 36-720 Lecture 2 https://www.stat.cmu.edu/~cshalizi/networks/16-1/lectures/02/lecture-02.pdf ; *Estimating network degree distributions under sampling* https://arxiv.org/pdf/1305.4977 ; PHYS 7332 Network Science Data, Classes 20–21 https://asmithh.github.io/network-science-data-book/class_20_sampling_theory.html ; *Network Sampling: An Overview and Comparative Analysis* https://arxiv.org/html/2504.17701
- **[S16]** ICIJ. *Datashare's new plug-in helps investigative journalists connect the dots with graphs.* https://www.icij.org/inside-icij/2024/02/datashares-new-plug-in-helps-investigative-journalists-connect-the-dots-with-graphs/
- **[S17]** ICIJ. *Explore the latest tool to power up investigations via the Offshore Leaks database.* https://www.icij.org/inside-icij/2025/01/explore-the-latest-tool-to-power-up-investigations-via-the-offshore-leaks-database/ ; database at https://offshoreleaks.icij.org/ — **[V] fetched; note the article documents the API, not the UI. UI claims here are [U].**
- **[S18]** Linkurious. *Supercharging investigations with unstructured data analysis through NLP and graph technology.* https://linkurious.com/blog/investigations-unstructured-data-analysis-nlp-graph/
- **[S19]** Neo4j Bloom docs https://neo4j.com/docs/bloom-user-guide/current/about-bloom/ ; *Neo4j Is in Bloom Everywhere This Spring* https://neo4j.com/blog/neo4j-bloom-everywhere-this-spring ; Maltego Graph https://www.maltego.com/graph/
- **[S20]** Kumu. *What is Kumu?* https://docs.kumu.io/about-kumu/what-is-kumu ; *Network Mapping* https://kumu.io/markets/network-mapping ; UNDP write-up https://www.undp.org/jordan/blog/kumu-powerful-tool-mapping-and-visualizing-complex-data-0
- **[S21]** Open Ownership. *Beneficial Ownership Visualisation System — Design Principles.* https://www.openownership.org/en/publications/beneficial-ownership-visualisation-system/design-principles/ — **[V] fetched all 7 principles.**
- **[S22]** Open Ownership. *Introduction to BOVS* https://www.openownership.org/en/publications/beneficial-ownership-visualisation-system/introduction-to-bovs/ ; *What graph visualisation teaches us about beneficial ownership* https://www.openownership.org/en/blog/what-graph-visualisation-teaches-us-about-beneficial-ownership/
- **[S23]** Sankey guidance, consolidated: ChartMekko *When to Use Sankey Charts* https://www.chartmekko.com/blog/when-to-use-sankey-charts ; Plotly *Deep Dive on Sankey Diagrams* https://plotly.com/blog/sankey-diagrams/ ; Astrato *Sankey Diagram Use Cases* https://www.astrato.io/blog/sankey-use-cases ; Flourish *animated Sankey / alluvial* https://flourish.studio/blog/animating-sankey-visualisations/
- **[S24]** USAFacts *This chart tells you everything you want to know about government spending* https://usafacts.org/articles/this-chart-tells-you-everything-you-want-to-know-about-government-spending/ ; OpenSpending https://www.openspending.org/ ; GIMMS *Spending chains and Sankey diagrams* https://gimms.org.uk/2022/11/26/spending-chains-sankey-diagrams/
- **[S25]** Wood, J., Dykes, J. & Slingsby, A. (2010). *Visualisation of Origins, Destinations and Flows with OD Maps.* The Cartographic Journal 47(2):117–129. https://openaccess.city.ac.uk/537/1/wood_visualization_2010.pdf
- **[S26]** Flow-map clutter: Graser, Schmidt, Roth & Brändle (2019) *Untangling origin-destination flows in GIS* https://journals.sagepub.com/doi/abs/10.1177/1473871617738122 ; Tennekes & Chen, *Design Space of Origin-Destination Data Visualization*, Computer Graphics Forum https://onlinelibrary.wiley.com/doi/10.1111/cgf.14310 ; *Flowmapper.org* https://www.tandfonline.com/doi/full/10.1080/17445647.2021.1996479
- **[S27]** ABS. *Australian Statistical Geography Standard (ASGS), Edition 4, July 2026 – June 2031.* https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/latest-release — **[V] fetched; release date 2026-07-22 confirmed.** Ed. 3 boundary files: https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files
- **[S28]** Digital Atlas of Australia. *ABS ASGS Edition 3 – 2021 Statistical Area Level 2.* https://digital.atlas.gov.au/datasets/abs-asgs-edition-3-2021-statistical-area-level-2/about
- **[S29]** Gimond, M. *Intro to GIS and Spatial Analysis — Ch. 6 Pitfalls to avoid.* https://mgimond.github.io/Spatial/pitfalls-to-avoid.html ; MAUP overview https://en.wikipedia.org/wiki/Modifiable_areal_unit_problem and https://www.sciencedirect.com/topics/earth-and-planetary-sciences/modifiable-areal-unit-problem
- **[S30]** Axis Maps. *Dot Density Maps* https://www.axismaps.com/guide/dot-density ; *Proportional Symbols* https://www.axismaps.com/guide/proportional-symbols ; *Choropleth Maps* https://www.axismaps.com/guide/choropleth
- **[S31]** Kobakian, S., Cook, D. & Roberts, J. (2023). *A Hexagon Tile Map Algorithm for Displaying Spatial Data.* The R Journal. https://journal.r-project.org/articles/RJ-2023-021/ — **[V] fetched.**
- **[S32]** `sugarbag` R package. https://github.com/srkobakian/sugarbag ; https://cran.r-project.org/web/packages/sugarbag/readme/README.html
- **[S33]** Bivariate choropleth: Axis Maps *Bivariate Choropleth* https://www.axismaps.com/guide/bivariate-choropleth ; *Operationalizing Trumbo's Principles of Bivariate Choropleth Map Design* https://www.researchgate.net/publication/338546141 ; PSU GEOG 486 *Multivariate Choropleths* https://courses.ems.psu.edu/geog486/node/900 ; School of Cities https://schoolofcities.github.io/urban-data-storytelling/urban-data-visualization/bivariate-choropleth-maps/bivariate-choropleth-maps.html
- **[S34]** Uncertainty & missing data: *Visualization of missing data: a state-of-the-art survey* https://arxiv.org/pdf/2410.03712 ; *Evaluating the Use of Uncertainty Visualisations for Imputations* https://mucollective.northwestern.edu/files/2022-uncertainty-vis-for-imputations.pdf ; *Using set visualisation to find and explain patterns of missing values* https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9680176/ ; *The Visualization of Uncertainty* (Digital Cartography) https://wustl.pressbooks.pub/digitalcartography/chapter/the-visualization-of-uncertainty/
- **[S35]** PMTiles: Protomaps docs *PMTiles for MapLibre GL* https://docs.protomaps.com/pmtiles/maplibre ; MapLibre *PMTiles source and protocol* https://maplibre.org/maplibre-gl-js/docs/examples/pmtiles-source-and-protocol/ ; maplibre-agent-skills *maplibre-pmtiles-patterns* https://github.com/maplibre/maplibre-agent-skills/blob/main/skills/maplibre-pmtiles-patterns/SKILL.md ; Simon Willison TIL https://til.simonwillison.net/gis/pmtiles
- **[S36]** deck.gl vs MapLibre: Atlas comparison https://atlas.co/comparisons/deck-gl-vs-maplibre/ ; deck.gl *Using with MapLibre* https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre ; deck.gl *Using with React* https://deck.gl/docs/get-started/using-with-react
- **[S37]** *Semantic Zooming and Edge Bundling for Multi-Scale Supply Chain Flow Visualization* https://arxiv.org/html/2604.08823 ; Shneiderman's mantra summary https://hampdatavisualization.wordpress.com/2016/02/26/schneidermans-mantra/ ; *Semantic Zoom: A Details on Demand Visualisation Technique* https://link.springer.com/content/pdf/10.1007/978-3-642-19917-2_11.pdf
- **[S38]** *A Hierarchical Aggregation Framework for Efficient Multilevel Visual Exploration and Analysis* https://arxiv.org/pdf/1511.04750 ; Elmqvist & Fekete, *Hierarchical aggregation for information visualization: Overview, techniques and design guidelines* https://www.researchgate.net/publication/313579212
- **[S39]** Weaver, C. *Multidimensional visual analysis using cross-filtered views* https://www.researchgate.net/publication/224350090 ; Tableau *Enhancing Visual Analysis by Linking Multiple Views of Data* https://www.tableau.com/whitepapers/enhancing-visual-analysis-linking-multiple-views-data ; HoloViz Panel *Build Crossfiltering Dashboard* https://panel.holoviz.org/tutorials/basic/build_crossfilter_dashboard.html
- **[S40]** nuqs. https://nuqs.dev/ ; https://github.com/47ng/nuqs ; Scharff, A. *Managing Advanced Search Param Filtering in the Next.js App Router* https://aurorascharff.no/posts/managing-advanced-search-param-filtering-next-app-router/
- **[S41]** Postgres graph traversal: *SQL/PGQ in PostgreSQL 19: Graph Queries Without the Graph Database* https://thebuild.com/blog/sqlpgq-in-postgresql-19-graph-queries-without-the-graph-database/ ; *Your PostgreSQL Already Has a Graph Engine* https://dev.to/ineron/your-postgresql-already-has-a-graph-engine-you-just-have-to-build-it-2ng7 ; *Graph Queries with Recursive CTEs* https://medium.com/codex/graph-queries-with-recursive-ctes-you-dont-need-neo4j-3aade6fb7f85
- **[S42]** Hierarchy vis comparison: *Interactive Visualisation of Hierarchical Quantitative Data: An Evaluation* https://arxiv.org/abs/1908.01277 ; *Effective Visualization of Hierarchies* https://vis-uni-bamberg.github.io/hierarchy-vis/ (relevant if a hierarchy view is added: **icicle > sunburst > treemap** on navigation tasks; sunbursts compress to illegible slivers past 5 levels)
</content>
</invoke>
