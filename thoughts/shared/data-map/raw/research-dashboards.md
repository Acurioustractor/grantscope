# Deep research: the right dashboard genre for "see absolutely everything we have"

Research date: 2026-08-14. Target: CivicGraph (grantscope) + JusticeHub, one shared Supabase
project, **812 public-schema objects (714 tables + 98 matviews), 724 populated, 88 empty,
52,349,579 rows, 14,310 columns, 636 declared FKs, 26.3 GB**.

Every claim below is tagged **[verified]** (I read the primary source or computed it from the
census files), **[secondary]** (reputable third-party summary, not the primary), or
**[vendor]** (marketing copy from a competitor — treat as directional only).

---

## 0. The short answer

**What Ben is asking for is not a dashboard.** It is an *exploratory faceted catalog with an
operational health strip on top*. Building it as a dashboard in the Stephen Few sense would
actively defeat the goal, because the defining move of a dashboard is *throwing information
away* — and the request is "see absolutely everything".

The correct theoretical frame is **Shneiderman's task-by-data-type taxonomy** (1996), not the
strategic/analytical/operational dashboard taxonomy. The correct product frame is the
**data catalog / data discovery platform** genre (Amundsen, DataHub, Select Star, dbt Explorer),
with the **coverage-matrix** pattern from data observability (Monte Carlo, Bigeye) bolted on
because Ben's stated goal is *finding gaps*, and gaps are the one thing catalogs render as blank
space.

The archetype I recommend and defend in §5 is: **Inventory + Health Ledger** — a three-tier
overview → ledger → detail structure, search-first, sorted by derived importance, where every
cell is machine-derived and absence has its own glyph.

---

## 1. The dashboard taxonomy, and why an inventory does not fit it

### 1.1 Few's definition rules the request out

From the primary source, verbatim **[verified — I read the PDF]**:

> "A dashboard is a visual display of the most important information needed to achieve one or
> more objectives; consolidated and arranged on a single screen so the information can be
> monitored at a glance."
> — Stephen Few, *Dashboard Confusion*, Perceptual Edge, 20 March 2004, p.3
> <https://www.perceptualedge.com/articles/ie/dashboard_confusion.pdf>

Three clauses each break against this project:

| Clause | Why 724 datasets break it |
|---|---|
| "the **most important** information" | The request is explicitly *everything*, including the 199 objects with 1–9 rows and the 88 empty ones. Selecting "most important" is the opposite of the brief. |
| "a **single screen**" | 724 rows at a scannable 32px row height is ~23,000px of content. |
| "monitored **at a glance**" | Glance-ability is a monitoring property. Ben's task is *discovery of unknowns*, which is measured in minutes, not glances. |

Few reinforces this in the follow-up whitepaper **[verified — I read the PDF's TOC and
introduction]**: Pitfall #1 of his 13 is literally *"Exceeding the Boundaries of a Single
Screen"* (*Common Pitfalls in Dashboard Design*, Perceptual Edge, Feb 2006, p.4;
<https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf>). The full 13:
(1) exceeding a single screen, (2) inadequate context, (3) excessive detail or precision,
(4) expressing measures indirectly, (5) inappropriate media of display, (6) meaningless variety,
(7) poorly designed display media, (8) encoding quantitative data inaccurately, (9) arranging the
data poorly, (10) ineffectively highlighting what's important, (11) useless decoration,
(12) misusing or overusing colour, (13) an unappealing visual display.

But Few also gives the escape hatch, in the same whitepaper **[verified, p.2]**:

> "This single-screen display need not be comprehensive in and of itself, but it must provide the
> overview that is needed to know when action is required, and ideally should provide an easy
> gateway to any additional information that is needed to determine the precise action that is
> appropriate."

That sentence is the design spec for the *top 15% of the page*, and nothing more. The dashboard
is the **entry band**, not the artifact.

### 1.2 Few's three roles — none of them is a match

Few classifies dashboards primarily by **role**: strategic, analytical, operational, and says the
role "has the greatest impact on its visual design" **[secondary]**
(<https://www.idashboards.com/operational-analytical-and-strategic-the-three-types-of-dashboards/>,
<https://www.uxmatters.com/mt/archives/2007/04/book-review-information-dashboard-design.php>).

- **Strategic** — executive, static, high-level KPIs, long time horizon. Fails: there is no KPI
  that answers "what do we have". Row counts are not performance.
- **Operational** — real-time monitoring, immediate corrective action. Partially fits: *freshness
  and staleness* genuinely is an operational monitoring loop. This is why the health strip
  belongs, and why it should be small.
- **Analytical** — analyst-facing, filters, drilldown, multiple layers, looking for patterns and
  relationships **[secondary]**. This is the closest fit and still not exact, because analytical
  dashboards presuppose you know the measures. Ben does not yet know what is in the 724 objects.

### 1.3 Wexler et al. loosen the definition — deliberately

*The Big Book of Dashboards* (Wexler, Shaffer, Cotgreave, Wiley 2017) redefines it as
**[secondary, but the authors' rationale is documented]**:

> "A dashboard is a visual display of data used to monitor conditions and / or facilitate
> understanding."

They considered Few's definition and explicitly **rejected "single screen" and "monitored at a
glance"**, on the grounds that something printed and carried into a meeting still facilitates
understanding (<https://www.datarocks.co.nz/post/data-viz-bookshelf_the-big-book-of-dashboards-wexler-shaffer-cotgreave>,
<https://onlinelibrary.wiley.com/doi/book/10.1002/9781119283089>).

Under Wexler, an inventory *does* qualify — but only via the "facilitate understanding" limb,
which is the exploratory limb. That is a licence to call the thing a dashboard in conversation.
It is not a licence to design it like a KPI wall.

### 1.4 The frame that actually fits: Shneiderman 1996

I read the primary paper in full **[verified]**: Ben Shneiderman, *The Eyes Have It: A Task by
Data Type Taxonomy for Information Visualizations*, IEEE VL '96, pp. 336–343.
<https://www.cs.umd.edu/~ben/papers/Shneiderman1996eyes.pdf>

He opens by naming exactly the distinction that matters here (p.336, verbatim):

> "the common goals reach from finding a narrow set of items that satisfy a well-understood
> information need (known-item search) to developing an understanding of unexpected patterns
> within the collection (browse) (Marchionini, 1995)."

Ben's request is the **browse** pole, unambiguously — "see it all, see the gaps, find
opportunities". Dashboards are built for the known-item / monitoring pole.

The seven tasks, quoted verbatim (p.337):

> **Overview**: Gain an overview of the entire collection.
> **Zoom**: Zoom in on items of interest.
> **Filter**: filter out uninteresting items.
> **Details-on-demand**: Select an item or group and get details when needed.
> **Relate**: View relationships among items.
> **History**: Keep a history of actions to support undo, replay, and progressive refinement.
> **Extract**: Allow extraction of sub-collections and of the query parameters.

Task 1 *is the request*. Task 5 (**Relate**) is Ben's goal #4 ("see how it is connected"). Task 7
(**Extract**) is his goal #7 ("cross-sections"). Three of the seven tasks are in the brief
verbatim. None of Few's three roles is.

The **data type** is a hybrid of two of Shneiderman's seven: **tree** (schema hierarchy:
domain → object → column, 14,310 leaves) and **network** (636 declared FKs, plus the undeclared
join graph). On trees he notes (p.339) that interface representations "can use an outline style
of indented labels used in tables of contents… a node and link diagram, or a treemap" — and warns
in the same paragraph that "users take 10-20 minutes to accommodate complex treemaps." On
networks: "Network visualization is an old but still imperfect art because of the complexity of
relationships and user tasks."

Brehmer & Munzner's *what-why-how* multi-level typology narrows it further **[secondary]**: the
"why" here sits at the mid-level **search** category with *target unknown and location unknown* —
which is "browse"/"explore", not "lookup". Their contribution is that a task spec needs both a
verb and a target, and that the high-level split is **consume vs produce**
(<https://www.semanticscholar.org/paper/A-Multi-Level-Typology-of-Abstract-Visualization-Brehmer-Munzner/3ae8c3c0f79aa27ed491a486a16cd28cd006aed6>,
<https://www.researchgate.net/figure/Key-elements-in-Munzners-what-why-framework-a-data-abstraction-four-basic-dataset_fig5_330132882>).
Note the second-order consequence for CivicGraph: the catalog is not purely *consume*. Ben will
want to **produce** — tag an object as cruft, mark a domain, flag a duplicate matview. Design for
a write path from day one; catalogs that are read-only rot (see §2.4).

Andy Kirk's process reinforces the same point from the design side **[secondary]**: step one is
establishing the *purpose* and the "Central Curiosity" — the single question the artifact answers
— and he notes that "the design criteria for exploratory visualisations are quite different"
from explanatory ones
(<https://medium.com/@antonioneto_17307/data-visualization-design-process-a-4-step-journey-presented-by-andy-kirk-b66673642157>,
<https://books.google.com/books/about/Data_Visualisation.html?id=h06IDwAAQBAJ>).
The Central Curiosity here: **"What do we hold, how good is it, and where are the holes?"**

### 1.5 Verdict on §1

Build an **exploratory / analytical catalog** whose top band behaves like an **operational**
dashboard for freshness and coverage. Explicitly reject the strategic archetype. Judge every
design decision against Shneiderman's seven tasks, not against a KPI checklist.

---

## 2. Data catalog UX, studied properly

### 2.1 The information architecture every product converges on

Having read the docs for Amundsen, DataHub, dbt Explorer/Catalog, Atlan, Select Star,
OpenMetadata and Airbnb's Dataportal, the convergence is striking. The standard IA is:

**Search-first landing, with a browse fallback for people who don't know what to search for.**

Lyft's Amundsen post is explicit **[verified — primary, Lyft Engineering]**: the landing page is
a search box for plain-English queries, and "for users uncertain what to search for, the
interface displays a list of popular tables in the organization to browse through them"
(<https://eng.lyft.com/amundsen-lyfts-data-discovery-metadata-engine-62d27254fbb9>).
Airbnb's Dataportal calls unified search "the most important feature," spanning "logging schemas,
data tables, charts, dashboards, employees, and teams" **[verified — primary, Airbnb Engineering]**
(<https://medium.com/airbnb-engineering/democratizing-data-at-airbnb-852d76c51770>).

**Ranking is by usage/importance, never alphabetical.**

- Amundsen: "Search ranking uses an algorithm similar to Page Rank, whereby highly queried tables
  show up above" — computed by parsing query logs into a usage extractor **[verified/secondary]**.
- Airbnb Dataportal: PageRank over the graph, so "well-documented and frequently-consumed
  resources will result in a higher score" **[verified — primary]**.
- Select Star: "By default, all columns in a table, all tables in a database, all dashboards in a
  BI tool will be ordered by popularity" **[verified — docs.selectstar.com]**
  (<https://docs.selectstar.com/data-discovery/how-can-i-use-this-data>).
- Monte Carlo: an **importance score, 0.01–1**, computed from five inputs — "the number of reads,
  the number of users, the degree connectivity, the update periodicity, and the age & freshness";
  ≥ 0.6 earns a sortable **"Key Asset"** flag **[verified — docs.getmontecarlo.com]**
  (<https://docs.getmontecarlo.com/docs/using-the-table-health-dashboard>).

> **The single most transferable idea in this whole section.** Note *degree connectivity* and
> *age & freshness* in Monte Carlo's formula. CivicGraph has no query logs, so PageRank-over-usage
> is unavailable — but FK degree (636 edges), row count, byte size, last-write timestamp, and
> **count of references in the two codebases** are all available today. That is a perfectly good
> importance score, and it is 100% derived.

**A fixed metadata set on every row/card.** The intersection across products:

| Field | Amundsen | OpenMetadata card | Atlan overview | dbt Catalog |
|---|---|---|---|---|
| Name | ✓ | ✓ | ✓ (+ alias) | ✓ |
| Source / type | — | ✓ | ✓ (connections) | ✓ |
| Description | ✓ | ✓ | ✓ | ✓ |
| Owner | ✓ (+ frequent users) | ✓ (team/user) | ✓ | ✓ |
| Last updated | ✓ | — | — | ✓ (status bar) |
| Popularity / usage | ✓ (ranking) | ✓ (usage) | ✓ (popularity) | ✓ (query history) |
| Trust / tier / cert | tags | ✓ (Tier) | ✓ (verified/draft/deprecated) | ✓ (health signal) |
| Size | ✓ (row-count trend) | — | ✓ (rows, columns) | ✓ (row count, size) |

Sources: Amundsen post above **[verified]**; OpenMetadata Explore card = "Source, Name of the Data
Asset, Description, Owner (Team/User details), Tier, and Usage information" **[verified — docs]**
(<https://docs.open-metadata.org/latest/how-to-guides/data-discovery/preview>); Atlan asset profile
overview = "technical name and alias, if added; number of rows and columns; connections;
description of the asset; certification status (verified, draft, or deprecated); owner of the
asset; lineage view; related assets" **[verified — docs.atlan.com]**
(<https://docs.atlan.com/product/capabilities/discovery/concepts/what-are-asset-profiles>);
dbt Catalog model status bar = "Last run time, success status, materialization, row count, size"
**[verified — docs.getdbt.com]** (<https://docs.getdbt.com/docs/collaborate/explore-projects>).

**Detail page = tabs.** Atlan: Lineage / Related Assets / Columns / Sample Data / Linked Queries /
README, plus a right sidebar carrying Overview, Columns, Relations, Usage, Lineage, Activity
(changelog), Resources, Queries, Requests, Properties, Integrations **[verified]**.
OpenMetadata: Schema / Activity Feeds & Tasks / Sample Data / Queries / Profiler & Data Quality /
Lineage / Custom Properties **[secondary — docs summary]**. Select Star: Queries & Joins /
Related / Top Users / Join Fields, where "Related Tables are those that are frequently used
together in SELECT queries" **[verified]**.

**Hierarchy is curated, not inferred.** DataHub's model: **Domains** are "curated, top-level
folders or categories"; **Data Products** must belong to a Domain and can nest via a
`parentDataProduct` pointer; an asset can carry many tags and many data products but
**exactly one domain** **[verified — docs.datahub.com]**
(<https://docs.datahub.com/docs/dataproducts>, <https://docs.datahub.com/docs/generated/metamodel/entities/domain>).

dbt Catalog goes further and offers **three parallel browse trees** in one sidebar — *Resources*
(by type, with a Health column), *File Tree* (repo structure), *Database* (database/schema)
**[verified — docs.getdbt.com]**. Same 800 objects, three mental models, user picks.

### 2.2 The best single UI idea I found: dbt's "Lenses"

dbt Explorer's lineage DAG has **Lenses** — contextual overlays accessible from the lower right
that recolour the *same* graph by: Resource type · Materialization type · Latest status ·
Model layer · Test status · Consumption query history **[verified — docs.getdbt.com]**.

This is small multiples collapsed into time instead of space: one spatial layout the user has
already learned, N encodings swapped over it. It is dramatically cheaper to build than N views,
and it preserves the reader's mental map — which is the exact thing NN/g flags as a treemap
failure mode (rectangles move when values change; see §3.3).

For CivicGraph this maps to: colour the same 724-row ledger / same domain grid by **rows ·
bytes · staleness · FK degree · code-references · has-owner · empty/populated · repo (CivicGraph
vs JusticeHub vs shared)**. One layout, eight lenses. Build the layout once.

### 2.3 How they handle scale without overwhelming

Real scale for comparison: Airbnb had **"more than 200,000 tables in Hive spread across multiple
clusters"** **[secondary — Neo4j/Atlan writeups of the Airbnb work]**
(<https://neo4j.com/blog/graph-data-science/democratizing-data-discovery-airbnb/>).
**724 objects is small.** This matters: it means CivicGraph can afford things Airbnb could not —
notably shipping the entire inventory to the client and filtering in memory (§3.5).

The scale techniques the products use, in order of leverage:

1. **Rank, don't paginate.** Popularity-first ordering means the first screen is the right screen
   even when the corpus is 200,000 (Amundsen, Select Star, Airbnb, Monte Carlo importance).
2. **Facets with counts.** dbt Catalog's filter panel appears *after* a keyword search and offers
   resource type, model access, model layer, materialization, tags, plus advanced options
   (column name, model code) **[verified]**.
3. **Curated domains as a second axis** (DataHub Domains / Data Products).
4. **Defer the graph.** dbt: "If graph doesn't render immediately, click **Render Lineage**"; and
   "use selectors to choose a subset of nodes instead of rendering the entire DAG"; tests and
   macros are excluded from the DAG by default **[verified]**. Lineage is opt-in, degree-limited,
   and seeded from a node — never the front door.
5. **Progressive disclosure via quick preview.** OpenMetadata shows a right-side preview panel on
   click-adjacent, before committing to a full page **[verified]**.

### 2.4 What catalogs consistently get wrong

The literature is unusually unanimous. The best primary statement is Mark Grover's (Amundsen's
creator at Lyft) **[verified — I read the article]**
(<https://medium.com/data-science/top-2-reasons-why-data-catalogs-fail-615edacec1c0>):

- **Failure 1 — "Catalog Ghost Town".** Catalogs need descriptions, tags, keys, common queries,
  FAQs. Getting colleagues to write them is hard, and "even if you somehow convinced others to add
  documentation, once it's added, it quickly becomes out-of-date."
- **Failure 2 — "Catalog too broad, not deep enough".** When the catalog also tries to be a
  conversation tool, a knowledge base and a query tool, it competes with the tools people already
  use. "Fragmentation is the worst possible thing."

His three fixes, which I am adopting wholesale in §5:
1. **Automate metadata capture** from usage patterns and logs rather than manual entry.
2. **Extract documentation in-workflow** — enforce it in the dev loop / CI, not in a separate UI.
3. **Curate the top 20%** — the most-viewed data — rather than attempting comprehensive coverage.

Corroborating, from multiple independent angles **[secondary]**:
- Catalogs die when they sit "outside the daily workflow" and become "passive repositories";
  organisations that budget only for technology see "a digital graveyard within 18 months"
  (<https://towardsdatascience.com/top-2-reasons-why-data-catalogs-fail-615edacec1c0/>,
  <https://medium.com/@marcoOesterlin/the-hard-truth-about-data-catalogs-why-microsoft-purview-unified-catalog-can-be-your-strategic-62372a052c94>).
- Nobody owns the writing: "six months in… ingestion is working and human-authored descriptions
  are not appearing because nobody's job description includes writing them"
  (<https://datawarehouseinfo.com/practice/data-warehouse-metadata/>).
- Technical-metadata-only cataloguing (tables, columns, schemas) without business meaning fails
  (<https://www.ovaledge.com/blog/data-catalog-vs-metadata-management>).
- The market's own answer is "active metadata" — push metadata back into the tools where work
  happens; Gartner is cited predicting 30% adoption of active metadata by 2026 **[vendor-adjacent,
  low confidence on the stat]** (<https://atlan.com/active-metadata-101/>).

Vendor-on-vendor criticism, flagged **[vendor — Atlan marketing, discount heavily]**: Alation's
UI described as "outdated and rigid"; Collibra's UI as containing "too many functions" with users
"not finding something easily"; Alation/Collibra/Informatica search characterised as relying
"heavily on manual curation and consistent stewardship effort"
(<https://atlan.com/alation-vs-collibra-vs-openmetadata-vs-atlan/>). I would not repeat these as
fact; the structural claim underneath (manual curation does not scale) is independently supported
by Grover.

**The implication for CivicGraph is severe and specific.** Ben is a one-to-two-person operation.
A catalog for 724 objects that requires 724 hand-written descriptions will be ~15% complete
forever and will read as broken. Therefore:

> **Design rule: every column in the default ledger view must be derivable by a scheduled job with
> zero human input.** Human-authored fields (description, domain, owner, verdict) are *enrichment*,
> displayed as an explicit completeness metric, never as a blank that makes the page look empty.

### 2.5 Trust markers — the one manual thing worth demanding

Alation's **Trust Flags** are a traffic light applied at the point of use: green = endorse,
yellow = warn, red = deprecate — and critically, **warning and deprecation require a written
explanation** **[verified — Alation user guide]**
(<https://www.alation.com/docs/en/latest/sources/WorkwithCatalogData/AddEndorsementsWarningsDeprecationMessagestoData.html>,
<https://www.alation.com/docs/en/latest/welcome/BestPractices/UseTrustFlagstoProceedwithConfidence.html>).
Atlan's equivalent is the **certificate**: verified / draft / deprecated **[verified]**.
OpenMetadata's is **Tier** **[verified]**.

The mandatory-reason rule is the part to steal. It is the difference between a deprecation flag
that means something and one that becomes noise. For CivicGraph the three flags that matter are
**KEEP / SUSPECT / CRUFT**, and CRUFT must carry a one-line reason.

Grounded example of why this matters here **[verified — computed from census.csv]**: there are
**14 backup-named objects holding 1,541,951 rows and 0.11 GB** —
`gs_entities_lga_backup_20260808` (609,416), `…20260809b` (358,347), `…20260809c` (355,797),
`…20260809` (98,660), `gs_entities_reason_backup_20260809b` (39,450),
`_backup_entity_contacts_20260606` (16,664), five `postcode_geo_*_backup_*` at 12,299 each, and
three smaller. Those are unambiguous CRUFT and the catalog should say so, with a reason, on
first render.

---

## 3. Density and scale: getting 724 items onto one page

### 3.1 What Shneiderman actually prescribes for overview

Verbatim, p.339 **[verified]**:

> "Overview strategies include zoomed out views of each data type to see the entire collection
> plus an adjoining detail view. The overview contains a movable field-of-view box to control the
> contents of the detail view, allowing zoom factors of 3 to 30. Replication of this strategy with
> intermediate views enables users to reach larger zoom factors. Another popular approach is the
> fisheye strategy (Furnas, 1986)… but zoom factors in prototypes are limited to about 5."

So: **overview+detail beats fisheye** at anything past 5×. 724 → 25 visible rows is a ~29× zoom
factor, squarely inside overview+detail's 3–30 band and far outside fisheye's ~5. This is a
principled reason to use a **domain overview grid + a filtered ledger**, and not a distortion
lens.

And on filtering, p.340 **[verified]**:

> "Dynamic queries applied to the items in the collection is one of the key ideas in information
> visualization… update (less than 100 milliseconds) is the goal, even when there are tens of
> thousands of displayed items."

At 724 rows, sub-100ms filtering is trivially achievable **client-side**. This is an architecture
decision, not an aspiration (see §3.5).

He also documents the **filter-flow** model for Boolean queries (water flowing through pipes;
ANDs in series, ORs in parallel), noting a study of 20 subjects where it beat a textual interface
and "was preferred by all 20 subjects" **[verified, p.341]**. Relevant only if Ben later wants
complex cross-sections; a facet panel with AND-across / OR-within is the standard cheap
approximation.

### 3.2 Table vs cards: table wins, and the reason is perceptual

Cleveland & McGill's ranking of encoding accuracy, most to least accurate: **position, length,
direction, angle, slope, area, volume, shading, saturation** **[secondary, but this is the
canonical result]** (<https://idl.cs.washington.edu/files/2010-Treemaps-InfoVis.pdf>,
<http://rstudio-pubs-static.s3.amazonaws.com/342939_d79a0160031d464f8a4cad3e20bbdbc4.html>).

A dense table with right-aligned numeric columns and inline horizontal bars gives you **position
along a common scale** (the column edge) *and* **length** (the bar) — encodings #1 and #2. A card
grid gives you neither: cards break the common baseline, so the eye cannot run down a column, and
they cost roughly 4–6× the vertical space per item. For an inventory whose primary comparisons are
"which is bigger / staler / better connected", cards are strictly worse.

Cards earn their place only in **search results** (where the comparison is relevance, not
magnitude) — which is precisely where OpenMetadata and Airbnb use them **[verified]**.

### 3.3 Treemap: seductive, wrong as the front door

NN/g's guidance is direct **[verified — I read the article]**
(<https://www.nngroup.com/articles/treemaps/>):

> "Area is not one of these preattentive attributes. Treemaps rely on area (and possibly color) to
> encode the value of a variable, and therefore… they are not suited for tasks involving precise
> comparisons."

Their listed failure modes: difficult comparisons; visual overwhelm when "hundreds of tiny
rectangles become confusing"; **rectangles move position when values change over time**; and
colour that doesn't indicate numeric hierarchy. Their recommended alternatives are bar charts and
sorted bar charts. Shneiderman's own 1996 caveat: "users take 10-20 minutes to accommodate complex
treemaps" **[verified]**.

There is also a hard arithmetic problem specific to this database **[verified — census.csv]**:
row counts span `abr_registry` at 20,006,350 down to objects with 1 row. That is **7 orders of
magnitude**. A row-count treemap of 724 objects renders as one rectangle covering ~38% of the
canvas and ~700 invisible slivers. Even on bytes (26.3 GB total, `abr_registry` alone 6.9 GB) it
is a bad ratio.

**Verdict: no treemap on the front door.** It is admissible as a *secondary lens* on a log scale,
or scoped to a single domain where the range is 2–3 orders of magnitude.

### 3.4 Circle packing / sunburst: also no

**[secondary]** Circle packing "doesn't use the screen space as effectively as sunburst or treemap
charts, so it's more suitable for smaller-size datasets" though the wasted space "more prominently
reveals the hierarchical structure"; sunburst uses space well but carries "higher visual
complexity" and is "somewhat harder to read for first-time users"
(<https://flourish.studio/blog/hierarchy-diagrams-sunburst-packed-circle/>, <https://d3js.org/d3-hierarchy>).

The hierarchy here is only **two levels deep** (domain → object). Space-filling hierarchy charts
earn their keep at 4+ levels. At two levels they are strictly worse than a grid of grouped bars.

### 3.5 The overview that does work: small multiples

Tufte's formulation **[secondary — the canonical statement]**: small multiples are "the best
design solution for a wide range of problems in data display"; "data slices are positioned within
the eye-span, so that viewers make comparisons at a glance — uninterrupted visual reasoning"; and
"constancy of design puts the emphasis on changes in data rather than changes in data frames"
(<https://en.wikipedia.org/wiki/Small_multiple>, <https://www.uxmatters.com/mt/archives/2005/12/small-multiples-within-a-user-interface.php>).

That last clause is the whole argument. A grid of ~12–18 identically-structured **domain tiles**
lets the eye compare domains without re-learning a frame per tile. It fits in one screen band,
scales to any number of underlying objects, and it is the natural "movable field-of-view box"
Shneiderman describes — clicking a tile filters the ledger below.

**Critical grounded finding on how to form the domains [verified — computed from census.csv]:**
there are **258 distinct `_`-delimited name prefixes across 812 objects, and the top 20 prefixes
cover only 355 objects (44%)**. Top prefixes: `mv_` (84), `alma_` (33), `project_` (26), `org_`
(21), `act_` (17), `goods_` (16), `civic_` (15), `procurement_` (14), `funding_` (14), `jr_` (13),
`ndis_` (11), `gs_` (11), `grant_` (11), `xero_` (10), `justice_` (10), `funder_` (10),
`foundation_` (10), `contact_` (10), `notion_` (9), `jm_` (9).

Conclusion: **auto-grouping by prefix will not work** — it leaves 56% of objects in a long tail of
238 near-singleton prefixes, and `mv_` (the single largest bucket at 84) is a *storage kind*, not a
domain. This directly validates DataHub's design choice that domains are **curated, not inferred**
**[verified]**. The build therefore needs a hand-written domain map — but it is a ~40-line seed
file of prefix→domain rules plus explicit overrides, written once, not 724 descriptions.

### 3.6 Table mechanics

**[secondary, but consistent across sources]** (<https://www.setproduct.com/blog/data-table-ui-design>,
<https://www.nngroup.com/videos/designing-tables-desktop-apps/>,
<https://github.com/TanStack/virtual/discussions/872>):

- **Sticky header** is mandatory for any table taller than roughly one screen.
- **Freeze the identifier column** so far-right values never lose their row.
- **Virtualise past the low thousands.** At 724 rows this is *not* required — plain DOM is fine
  and simpler. It **becomes** required at column level: 14,310 columns will need
  `@tanstack/react-virtual` or `react-window`.
- Watch z-index at the frozen-column/sticky-header intersection; "a sticky header that jitters or
  frozen column that misaligns is worse than none."
- On too many columns: "the fix to too many columns is rarely 'delete columns' and more often
  prioritization: pin the columns people decide with, offer hidable columns for the rest, and
  consider a detail view for attributes that matter occasionally." → this is exactly the Lens
  pattern from §2.2.

### 3.7 Facet design

**[secondary — A List Apart / Google Search Central / practitioner guides]**
(<https://alistapart.com/article/design-patterns-faceted-navigation/>,
<https://developers.google.com/search/blog/2014/02/faceted-navigation-best-and-5-of-worst>):

- The core principle is **minimising zero-result dead ends** — show only facet values that apply
  in the current context; grey out values that would yield zero.
- **Always show counts** next to each facet value.
- Pre-compute or cache facet counts. At 724 rows this is one `GROUP BY` per facet, computed once
  in the same server render — no search engine needed.

---

## 4. Quality, freshness and the visual grammar of *missing*

This is the section that matters most, because Ben's stated goal is to "see the gaps", and the
default failure mode of every catalog is that **a gap renders as blank space, and blank space is
invisible**.

### 4.1 The best pattern found anywhere: Monte Carlo's coverage matrix

**[verified — docs.getmontecarlo.com]**
(<https://docs.getmontecarlo.com/docs/using-the-table-health-dashboard>)

The Table Health Dashboard is a **matrix**: rows are tables, and there are **seven monitor-type
columns** — SQL rule, Freshness, Volume, Field Quality, Field Health, Dimension, Schema. Cell
states:

| Glyph | Meaning |
|---|---|
| Green **checkmark** | monitor active, no incidents |
| Green **circle + number** | incidents, resolved / expected / no action needed |
| Yellow circle | incidents under investigation |
| Orange circle | unresolved, "No Status" — most severe |
| **Plus symbol `+`** | **no monitor deployed — the gap** |

Plus a left-hand **Summary** column colour-coded to the most severe incident on that row, and
filters for search, time range (today → 4 weeks, "2 weeks recommended"), alert status, and
monitor priority (P1–P5 plus No Priority).

**The `+` is the whole idea.** Absence is not blank; it is a distinct affirmative glyph, and it is
simultaneously the affordance to fix the gap. A screen built this way answers "where are the
holes?" by *pattern* — a column of `+` down one region of the matrix is a coverage gap you can see
from two metres away.

CivicGraph's seven columns are different but the structure is identical: **Rows · Freshness ·
Owner · Description · Domain · FK-linked · Used-in-code · Documented**. Every object × every
dimension = a cell that is either satisfied or `+`.

### 4.2 Coverage as a first-class number: Bigeye

**[verified — docs.bigeye.com]** (<https://docs.bigeye.com/docs/dashboard>)

Bigeye's Dashboard has five panels: **Monitoring Coverage · Pipeline Reliability · Data Quality ·
Issue Response · Collections**. The Monitoring Coverage panel surfaces a **Coverage Score** —
"the total percentage of tables with one or more metrics deployed" — displayed as a **horizontal
bar chart by metric category**, explicitly framed as a way to "track Bigeye usage over time and
find potential gaps in coverage."

Two things to steal: (a) coverage is a **scalar with a definition you can print**, and
(b) it is decomposed by category as **bars** — length judgments, Cleveland-McGill rank 2, not a
donut.

Soda states the formula plainly **[secondary]**: percentage of production datasets with at least
one automated check = (datasets with ≥1 active check ÷ total production datasets)
(<https://soda.io/blog/data-quality-metrics-12-examples>).

For CivicGraph the equivalent scalars, all computable today:
- **Documented**: objects with a non-empty description ÷ 812
- **Domained**: objects assigned to a curated domain ÷ 812
- **Connected**: objects touched by ≥1 of the 636 FKs ÷ 812
- **Used**: objects referenced in either codebase ÷ 812
- **Fresh**: objects with a write in the last N days ÷ 812
- **Live**: populated ÷ total = **724 ÷ 812 = 89.2%** **[verified]**

### 4.3 The missingness grammar: missingno

**[verified — the library's own README and the Turing Way]**
(<https://github.com/ResidentMario/missingno>,
<https://book.the-turing-way.org/project-design/missing-data/missing-data-visualising-missingness/>)

Three plots, all directly transferable:

1. **Nullity matrix** — "a data-dense display which lets you quickly visually pick out patterns in
   data completion. Data entries with missing data are indicated by white, while all complete
   entries are shaded a dark grey." A **sparkline on the right** summarises completeness per row
   and marks the max- and min-nullity rows.
2. **Nullity correlation heatmap** — "how strongly the presence or absence of one variable affects
   the presence of another", ranging −1 (mutually exclusive) to 0 to +1.
3. **Dendrogram** — hierarchical clustering that "groups together columns that have strong
   correlations in nullity."

Applied here at two levels: **object level** (812 objects × ~8 metadata dimensions → which
metadata is systematically absent) and **column level** (14,310 columns; `columns.csv` already
carries `is_nullable`, so a nullity matrix per table is free). The nullity *correlation* view is
the interesting one for Ben's goal #8 — if "no owner" and "no FK" and "stale" co-occur, that is a
whole abandoned region of the schema, and correlation surfaces it as a block.

### 4.4 Great Expectations: the artifact should be generated

**[secondary — GE docs]** (<https://docs.greatexpectations.io/docs/0.18/reference/learn/terms/data_docs/>)
Data Docs generate "a human-readable static HTML page of the validation results", compiled
automatically when a Checkpoint finishes, with a Validation Results tab where clicking a result
shows "a detailed list of all the Expectations that ran, as well as which Expectations passed or
failed."

The lesson is not the HTML. It is that **the quality view is compiled from a run, never typed by a
human** — the same principle as §2.4, applied to quality rather than description.

### 4.5 Colour: what to encode with, given the Bauhaus palette

DESIGN.md fixes the palette: black `#121212`, red `#D02020`, blue `#1040C0`, yellow `#F0C020`,
canvas `#F0F0F0`. There is **no green**. This is fortunate: Few's Pitfall #12 is "Misusing or
Overusing Color" **[verified]**, and the standard health palette (red/amber/green) is the classic
deuteranopia failure. A red/yellow/blue system is inherently safer and it is already the house
style.

Proposed semantics — one meaning per colour, no exceptions:

| Colour | Meaning | Applies to |
|---|---|---|
| Black | present, fine, nothing to do | default row state |
| **Red** `#D02020` | broken or cruft — empty object, backup table, superseded matview | the 88 empty + 14 backup objects |
| **Yellow** `#F0C020` | stale or thin — no write in N days, 1–9 rows, no FK | the 199 tiny objects |
| **Blue** `#1040C0` | gap in *our* metadata — no owner, no description, no domain | the `+` glyph state |
| Canvas | structural, non-semantic | rules, grid |

Note the deliberate split: **red = the data is wrong; blue = our documentation is missing.** Those
are different problems with different fixes, and conflating them is what makes catalogs feel
accusatory and get ignored.

---

## 5. Concrete recommendation

### 5.1 The archetype

**"Inventory + Health Ledger"** — a search-first, faceted, three-tier exploratory catalog with an
operational health band, built directly on Shneiderman's mantra.

| Tier | Shneiderman task | Screen real estate | What it is |
|---|---|---|---|
| 0 | **Overview** | top ~20% | 6 coverage scalars + a small-multiples grid of domain tiles |
| 1 | **Zoom / Filter** | middle ~65% | the Ledger: one dense table, all 812 rows, faceted, lensed |
| 2 | **Details-on-demand** | right drawer / route | object detail: columns, FKs, code refs, sample, history |
| 3 | **Relate** | separate route | the map: FK network, degree-limited, seeded from a node |

Why this and not the alternatives:

- **Not a strategic/KPI dashboard** — §1.1. There is no KPI; selecting "most important" contradicts
  the brief.
- **Not a treemap or sunburst front door** — §3.3/§3.4. Seven orders of magnitude in row count,
  area is the second-worst encoding, and a two-level hierarchy doesn't need space-filling.
- **Not a force-directed graph front door** — 812 nodes and 636 edges will hairball, and
  Shneiderman's own note on networks is that the art is "still imperfect". dbt makes lineage
  opt-in behind a **Render Lineage** button for exactly this reason **[verified]**. Follow them.
- **Not cards** — §3.2. Cards break the common baseline that makes column-scanning work.
- **Not a wizard or a set of separate pages per domain** — Few's Pitfall on fragmenting data, and
  Grover's "fragmentation is the worst possible thing."

### 5.2 The main screen

Target 1440px. Bauhaus Industrial: `border-4 border-bauhaus-black`, zero radius, Satoshi display
uppercase tracking-widest for labels, JetBrains Mono for all identifiers and numbers.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ CIVICGRAPH · DATA INVENTORY                       ⌕ search 812 objects, 14,310 columns…      │
│ 812 OBJECTS · 714 TABLES · 98 MATVIEWS · 52,349,579 ROWS · 26.3 GB · SCANNED 14 AUG 09:14    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ TIER 0 — OVERVIEW                                                                            │
│                                                                                              │
│  LIVE          DOMAINED      DESCRIBED     CONNECTED     USED IN CODE   FRESH ≤30d           │
│  89.2%         44%           12%           31%           ??%            ??%                  │
│  ████████▉░    ████▍░░░░░    █▎░░░░░░░░    ███▏░░░░░░    ░░░░░░░░░░     ░░░░░░░░░░           │
│  724 / 812     357 / 812     97 / 812      251 / 812     — / 812        — / 812              │
│  ↑ each bar is a Bigeye-style coverage score; the denominator is always 812; click = filter  │
│                                                                                              │
│  DOMAIN GRID — small multiples, identical frame per tile, click to filter the ledger          │
│  ┌────────────┐┌────────────┐┌────────────┐┌────────────┐┌────────────┐┌────────────┐        │
│  │ENTITY CORE ││ FUNDING    ││ JUSTICE    ││ PHILANTHRO ││ PROCUREMENT││ PEOPLE     │        │
│  │ 41 obj     ││ 68 obj     ││ 33 obj     ││ 29 obj     ││ 26 obj     ││ 22 obj     │        │
│  │ 24.6M rows ││ 3.1M rows  ││ 388K rows  ││ 61K rows   ││ 1.0M rows  ││ 1.4M rows  │        │
│  │ ▁▃█▂▁▁▁▂▁▁ ││ ▁▂▄█▃▁▁▁▁▁ ││ ▂█▃▁▁▁▁▁▁▁ ││ █▄▂▁▁▁▁▁▁▁ ││ ▁▁█▅▂▁▁▁▁▁ ││ ▂▆█▃▁▁▁▁▁▁ │        │
│  │ ●●●●●○○○○○ ││ ●●●○○○○○○○ ││ ●●●●●●○○○○ ││ ●○○○○○○○○○ ││ ●●○○○○○○○○ ││ ●●●●○○○○○○ │        │
│  │ 2 stale    ││ 11 stale   ││ 1 empty    ││ 14 empty   ││ 3 stale    ││ 6 backup!  │        │
│  └────────────┘└────────────┘└────────────┘└────────────┘└────────────┘└────────────┘        │
│  ┌────────────┐┌────────────┐┌────────────┐┌────────────┐┌────────────┐┌────────────┐        │
│  │ ALMA       ││ PLACE/GEO  ││ ORG OPS    ││ AGENT/PIPE ││ CRM/FINANCE││ ⚠ UNFILED  │        │
│  │ 33 obj     ││ 24 obj     ││ 47 obj     ││ 19 obj     ││ 35 obj     ││ 231 obj    │        │
│  └────────────┘└────────────┘└────────────┘└────────────┘└────────────┘└────────────┘        │
│    sparkline = log10 row-count distribution across the tile's objects (identical scale)       │
│    dot row   = coverage: filled = has description+owner+domain, hollow = gap                  │
│    UNFILED is deliberately loud — it is the backlog, and it shrinks as the domain map grows   │
├────────────┬─────────────────────────────────────────────────────────────────────────────────┤
│ FACETS     │ TIER 1 — THE LEDGER                    LENS: [ROWS ▾] rows·bytes·fresh·degree·  │
│            │                                              code·gaps·repo·kind                 │
│ KIND       │ 812 objects · filtered 812 · sorted by IMPORTANCE ▾                              │
│ ☐ table 714│ ┌────────────────────────┬──────┬───────┬─────┬──────┬───┬───┬───┬───┬───┬────┐ │
│ ☐ matview98│ │ OBJECT                 │ ROWS │ SIZE  │FRESH│ DOM  │ROW│FRS│OWN│DSC│FK │USE │ │
│            │ ├────────────────────────┼──────┼───────┼─────┼──────┼───┼───┼───┼───┼───┼────┤ │
│ DOMAIN     │ │ abr_registry           │20.0M │6.9 GB │ 12d │ ENT  │ ✓ │ ✓ │ + │ + │ ✓ │ ✓  │ │
│ ☐ Entity 41│ │ ████████████████████   │      │       │     │      │   │   │   │   │   │    │ │
│ ☐ Funding68│ │ mv_abr_name_lookup     │ 9.0M │1.4 GB │ 12d │ ENT  │ ✓ │ ✓ │ + │ + │ + │ ✓  │ │
│ ☐ Justice33│ │ ██████████             │      │       │     │      │   │   │   │   │   │    │ │
│ ☐ …        │ │ gs_relationships       │ 3.4M │ 2.1GB │  2d │ ENT  │ ✓ │ ✓ │ ✓ │ ✓ │ ✓ │ ✓  │ │
│            │ │ █████                  │      │       │     │      │   │   │   │   │   │    │ │
│ STATE      │ │ political_donations    │ 2.5M │ 1.1GB │ 31d │ PHIL │ ✓ │ ⚠ │ + │ + │ ✓ │ ✓  │ │
│ ☐ live 724 │ │ ████                   │      │       │     │      │   │   │   │   │   │    │ │
│ ☐ empty 88 │ │ ⛔gs_entities_lga_backup│609K  │ 41 MB │  5d │ —    │ ✓ │ ✓ │ + │ + │ + │ +  │ │
│ ☐ tiny 199 │ │ _20260808   CRUFT      │      │       │     │      │   │   │   │   │   │    │ │
│ ☐ backup 14│ │ ▎  ⛔ backup · superseded · 1 of 14 · 1,541,951 rows recoverable              │ │
│            │ ├────────────────────────┴──────┴───────┴─────┴──────┴───┴───┴───┴───┴───┴────┤ │
│ GAPS       │ │ … 807 more rows, sticky header, frozen OBJECT column, no pagination …       │ │
│ ☐ no owner │ └────────────────────────────────────────────────────────────────────────────┘ │
│ ☐ no descr │  ✓ satisfied   ⚠ degraded   + GAP (click to fill)   ⛔ cruft                    │
│ ☐ no domain│  Coverage matrix per Monte Carlo: a vertical run of + is a visible hole.        │
│ ☐ no FK    │                                                                                 │
│ ☐ unused   │  [ EXTRACT ▾ ]  copy as CSV · copy as SQL IN-list · open in map · save view     │
│            │                                                                                 │
│ REPO       │                                                                                 │
│ ☐ CivicGr. │                                                                                 │
│ ☐ JustHub  │                                                                                 │
│ ☐ both     │                                                                                 │
│ ☐ neither  │  ← "neither" is the most valuable facet in the whole UI                          │
└────────────┴─────────────────────────────────────────────────────────────────────────────────┘
```

Tier 2, the object drawer (slides from right, does not navigate away — preserves the ledger
scroll position, per OpenMetadata's quick-preview pattern):

```
┌───────────────────────────────────────────────────────────────┐
│ gs_relationships                          [KEEP] [SUSPECT] [CRUFT]│
│ table · ENTITY CORE · 3,429,184 rows · 2.1 GB · written 2d ago │
├───────────────────────────────────────────────────────────────┤
│ COLUMNS (12)   FK NEIGHBOURS (7)   CODE (34)   SAMPLE   HISTORY│
├───────────────────────────────────────────────────────────────┤
│ COLUMNS                    nullity ▁▁█▁▁▁▁▂▁▁▁▁               │
│  source_entity_id  uuid     NOT NULL   → gs_entities.id       │
│  target_entity_id  uuid     NOT NULL   → gs_entities.id       │
│  relationship_type text     NOT NULL   14 distinct            │
│  amount            numeric  NULL  ███░░ 62% populated         │
│  year              int      NULL  ████░ 78% populated         │
│  …  virtualized past 50 columns                               │
├───────────────────────────────────────────────────────────────┤
│ CODE REFERENCES                                               │
│  grantscope  apps/web/src/lib/report-service.ts        ×9      │
│  grantscope  apps/web/src/app/graph/page.tsx           ×4      │
│  JusticeHub  src/lib/…                                 ×21     │
├───────────────────────────────────────────────────────────────┤
│ [ VIEW IN MAP → ]   [ COPY SELECT ]   [ SET DOMAIN ▾ ]         │
└───────────────────────────────────────────────────────────────┘
```

### 5.3 What to steal, from whom, in priority order

| # | Steal | From | Why it earns its place here |
|---|---|---|---|
| 1 | **`+` glyph for absence in a coverage matrix**, clickable to fix | Monte Carlo Table Health **[verified]** | The only pattern found that makes gaps *visible* rather than blank. Directly serves goal #8. |
| 2 | **Everything on the row is derived; description is optional enrichment** | Grover / Amundsen **[verified]** | A 1–2 person team cannot hand-write 724 descriptions. This is the difference between shipping and a ghost town. |
| 3 | **Coverage Score as a printed scalar, decomposed as bars** | Bigeye Dashboard **[verified]** | Turns "how complete is our knowledge" into six numbers with definitions. |
| 4 | **Lenses — one layout, swappable colour encoding** | dbt Explorer **[verified]** | 8 views for the price of 1; preserves the reader's learned layout. |
| 5 | **Default sort by derived importance, never alphabetical** | Amundsen / Airbnb / Select Star / Monte Carlo **[verified]** | Makes the first screen the right screen. Use FK degree + rows + code-refs + freshness in place of query logs. |
| 6 | **Curated domains, not inferred** — one object, one domain | DataHub **[verified]** | Verified locally: top-20 prefixes cover only 44% of objects; inference will not work here. |
| 7 | **Trust flags with a mandatory written reason on the bad ones** | Alation **[verified]** | KEEP / SUSPECT / CRUFT. Stops the 14 backup tables and the six near-duplicate `mv_person_*` views from staying ambiguous. |
| 8 | **Nullity matrix + nullity correlation** | missingno **[verified]** | The established grammar for missingness; correlation reveals whole abandoned regions. |
| 9 | **Small-multiples domain tiles as the overview** | Tufte / Shneiderman overview+detail **[verified]** | Fits a 29× zoom factor; fisheye caps at ~5×. |
| 10 | **Three parallel browse trees** (Domain / Repo-usage / Schema) | dbt Catalog sidebar **[verified]** | Same corpus, three mental models, zero extra data. |
| 11 | **Lineage behind a button, degree-limited, seeded from a node** | dbt "Render Lineage" **[verified]** | Prevents the 812-node hairball. |
| 12 | **Quick-preview drawer before full navigation** | OpenMetadata **[verified]** | Preserves scroll position; makes scanning 812 rows viable. |

### 5.4 What to explicitly NOT do

1. **No treemap front door.** 7 orders of magnitude in row count; area is Cleveland-McGill rank 6.
2. **No force-directed graph front door.** Defer, seed, degree-limit.
3. **No requirement to write descriptions before the page is useful.** Undescribed is a *metric*,
   not a blank.
4. **No separate page per domain.** Fragmentation is Grover's failure mode #2 and Few's pitfall
   about splitting what should be compared.
5. **No CLI.** CLAUDE.md is binding: in-app Next.js pages/components.
6. **No green.** Not in the palette, and red/green fails colour-blind readers anyway.
7. **No live queries against `gs_entities` / `gs_relationships` / `abr_registry` on page load.**
   The inventory must be a **materialised snapshot table** refreshed by a scheduled job, exactly
   as Great Expectations compiles Data Docs from a run. The page reads one small table.

### 5.5 The data contract this implies

One table, `data_inventory`, one row per object, refreshed nightly. Every column derivable:

| Column | Source | Cost |
|---|---|---|
| `relname`, `kind`, `exact_rows`, `bytes` | `pg_class` / census — already have it | trivial |
| `column_count`, `nullable_count` | `information_schema.columns` — already have it | trivial |
| `fk_out`, `fk_in`, `fk_degree` | `pg_constraint` — already have it (636) | trivial |
| `last_write_at` | greatest `updated_at`/`created_at` per table, or `pg_stat_user_tables` | cheap, one pass |
| `repo_refs_civicgraph`, `repo_refs_justicehub` | ripgrep the two repos for the object name | one job, offline |
| `domain` | curated seed file, ~40 prefix rules + overrides | one-off human, ~1 hour |
| `importance` | weighted blend of rows, degree, code-refs, recency (Monte Carlo's five-input shape) | derived |
| `state` | live / empty / tiny / backup / superseded — rule-derived from the above | derived |
| `verdict`, `verdict_reason` | human, optional, mandatory reason on CRUFT | Alation pattern |
| `description`, `owner` | human, optional enrichment | never blocking |

Architecture, given CLAUDE.md's constraints: **Server Component** renders the page and ships the
full ~812-row payload (a few hundred KB of JSON at most) inline; **one client island** owns the
facets, lens switch, sort and search, filtering in memory. That satisfies Shneiderman's
sub-100ms dynamic-query goal with no round trips, and satisfies "Server Components by default"
because only the interactive ledger is a client component.

### 5.6 Build order

1. `data_inventory` snapshot table + nightly job. Nothing renders until this exists.
2. Tier 1 Ledger, unlensed, sorted by rows. Ships value on day one — it already answers
   "what do we have".
3. Coverage matrix columns with the `+` glyph. This is the "see the gaps" payload.
4. Tier 0 overview band: six scalars + domain grid. Needs the curated domain map first.
5. Tier 2 drawer with columns + FK neighbours + code refs.
6. Lenses.
7. Tier 3 map (FK network), deferred behind a button.

Steps 1–3 are the minimum that satisfies the literal request. Steps 4–7 are what make it
repeatedly useful rather than a one-time audit.

---

## Sources

**Primary, read in full:**
1. Shneiderman, *The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations*, IEEE VL '96 — <https://www.cs.umd.edu/~ben/papers/Shneiderman1996eyes.pdf>
2. Few, *Dashboard Confusion*, Perceptual Edge 2004 — <https://www.perceptualedge.com/articles/ie/dashboard_confusion.pdf>
3. Few, *Common Pitfalls in Dashboard Design*, Perceptual Edge 2006 — <https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf>

**Primary product documentation:**
4. dbt Catalog / Explorer — <https://docs.getdbt.com/docs/collaborate/explore-projects>
5. Monte Carlo Table Health Dashboard — <https://docs.getmontecarlo.com/docs/using-the-table-health-dashboard>
6. Bigeye Dashboard — <https://docs.bigeye.com/docs/dashboard>
7. Atlan asset profiles — <https://docs.atlan.com/product/capabilities/discovery/concepts/what-are-asset-profiles>
8. Select Star discovery — <https://docs.selectstar.com/data-discovery/how-can-i-use-this-data>
9. OpenMetadata Explore preview — <https://docs.open-metadata.org/latest/how-to-guides/data-discovery/preview>
10. DataHub Data Products — <https://docs.datahub.com/docs/dataproducts> · Domains — <https://docs.datahub.com/docs/generated/metamodel/entities/domain> · Features — <https://docs.datahub.com/docs/features>
11. Alation trust flags — <https://www.alation.com/docs/en/latest/sources/WorkwithCatalogData/AddEndorsementsWarningsDeprecationMessagestoData.html> and <https://www.alation.com/docs/en/latest/welcome/BestPractices/UseTrustFlagstoProceedwithConfidence.html>
12. Great Expectations Data Docs — <https://docs.greatexpectations.io/docs/0.18/reference/learn/terms/data_docs/>
13. missingno — <https://github.com/ResidentMario/missingno>
14. Dataplex / Knowledge Catalog search — <https://cloud.google.com/dataplex/docs/search-assets> · AWS Glue catalog — <https://docs.aws.amazon.com/glue/latest/dg/catalog-and-crawler.html>

**Primary engineering writeups:**
15. Amundsen, Lyft Engineering — <https://eng.lyft.com/amundsen-lyfts-data-discovery-metadata-engine-62d27254fbb9>
16. Democratizing Data at Airbnb (Dataportal) — <https://medium.com/airbnb-engineering/democratizing-data-at-airbnb-852d76c51770>
17. Grover, *Top 2 Reasons Why Data Catalogs Fail* — <https://medium.com/data-science/top-2-reasons-why-data-catalogs-fail-615edacec1c0>
18. Uber Databook — <https://uber.com/blog/metadata-insights-databook>
19. Eugene Yan, *Data Discovery Platforms and Their Open Source Solutions* — <https://eugeneyan.com/writing/data-discovery-platforms/>
20. LinkedIn DataHub original post — <https://www.linkedin.com/blog/engineering/archive/data-hub>

**Design/perception references:**
21. NN/g, *Treemaps* — <https://www.nngroup.com/articles/treemaps/>
22. NN/g, *Designing Tables for Desktop Apps with Lots of Data* — <https://www.nngroup.com/videos/designing-tables-desktop-apps/>
23. Kong et al., *Perceptual Guidelines for Creating Rectangular Treemaps*, UW IDL — <https://idl.cs.washington.edu/files/2010-Treemaps-InfoVis.pdf>
24. Cleveland & McGill graphical perception summary — <http://rstudio-pubs-static.s3.amazonaws.com/342939_d79a0160031d464f8a4cad3e20bbdbc4.html>
25. Small multiples — <https://en.wikipedia.org/wiki/Small_multiple> · <https://www.uxmatters.com/mt/archives/2005/12/small-multiples-within-a-user-interface.php>
26. Brehmer & Munzner, *A Multi-Level Typology of Abstract Visualization Tasks* — <https://www.semanticscholar.org/paper/A-Multi-Level-Typology-of-Abstract-Visualization-Brehmer-Munzner/3ae8c3c0f79aa27ed491a486a16cd28cd006aed6> · what-why-how figure — <https://www.researchgate.net/figure/Key-elements-in-Munzners-what-why-framework-a-data-abstraction-four-basic-dataset_fig5_330132882>
27. A List Apart, *Design Patterns: Faceted Navigation* — <https://alistapart.com/article/design-patterns-faceted-navigation/>
28. Google Search Central, *Faceted navigation best (and 5 of the worst) practices* — <https://developers.google.com/search/blog/2014/02/faceted-navigation-best-and-5-of-worst>
29. Setproduct, *Data table UI design reference* — <https://www.setproduct.com/blog/data-table-ui-design>
30. d3-hierarchy / Flourish on hierarchy chart choice — <https://d3js.org/d3-hierarchy> · <https://flourish.studio/blog/hierarchy-diagrams-sunburst-packed-circle/>
31. Wexler/Shaffer/Cotgreave, *The Big Book of Dashboards* — <https://onlinelibrary.wiley.com/doi/book/10.1002/9781119283089> · definition discussion <https://www.datarocks.co.nz/post/data-viz-bookshelf_the-big-book-of-dashboards-wexler-shaffer-cotgreave>
32. Andy Kirk design process — <https://medium.com/@antonioneto_17307/data-visualization-design-process-a-4-step-journey-presented-by-andy-kirk-b66673642157> · <https://books.google.com/books/about/Data_Visualisation.html?id=h06IDwAAQBAJ>
33. Few's three dashboard roles (secondary) — <https://www.idashboards.com/operational-analytical-and-strategic-the-three-types-of-dashboards/> · <https://www.uxmatters.com/mt/archives/2007/04/book-review-information-dashboard-design.php>
34. Soda data quality metrics — <https://soda.io/blog/data-quality-metrics-12-examples>
35. Turing Way, *Visualising Missingness* — <https://book.the-turing-way.org/project-design/missing-data/missing-data-visualising-missingness/>
36. Catalog failure/adoption commentary — <https://towardsdatascience.com/top-2-reasons-why-data-catalogs-fail-615edacec1c0/> · <https://datawarehouseinfo.com/practice/data-warehouse-metadata/> · <https://www.ovaledge.com/blog/data-catalog-vs-metadata-management>
37. Active metadata positioning **[vendor]** — <https://atlan.com/active-metadata-101/> · catalog comparison **[vendor]** — <https://atlan.com/alation-vs-collibra-vs-openmetadata-vs-atlan/>
38. OCCRP Aleph as a cross-dataset investigative precedent — <https://gijn.org/stories/aleph-pro-tutorial-occrp-updated-investigative-data-platform/>

---

## Appendix: what I verified locally vs took on faith

**Computed by me from the census files [verified]:**
- 812 objects = 714 tables + 98 matviews; 26.3 GB total.
- 14 backup-named objects, 1,541,951 rows, 0.11 GB.
- 258 distinct `_`-delimited name prefixes; top-20 prefixes cover 355/812 objects (44%).
- Prefix histogram: `mv_` 84, `alma_` 33, `project_` 26, `org_` 21, `act_` 17, `goods_` 16,
  `civic_` 15, `procurement_` 14, `funding_` 14, `jr_` 13, `ndis_` 11, `gs_` 11, `grant_` 11,
  `xero_` 10, `justice_` 10, `funder_` 10, `foundation_` 10, `contact_` 10, `notion_` 9, `jm_` 9.
- Only one `_v2`-suffixed object: `mv_person_identity_influence_v2` (241,260 rows).

**Taken from GROUND_TRUTH.md without re-verifying:** 724 populated / 88 empty, 52,349,579 rows,
14,310 columns, 636 FKs, size-band distribution, the CLAUDE.md staleness corrections, the two
codebases' route counts.

**Numbers in the wireframe that are illustrative placeholders, not measured:** the domain tile
counts and row totals, DESCRIBED 12%, CONNECTED 31%, DOMAINED 44%, FRESH, USED IN CODE. Only
LIVE 89.2% (724/812) is real. Domain assignment does not exist yet — that is step 4 of the build
order.

**Not checked:** whether `data_inventory` or any similar catalog table already exists in the
schema; whether `pg_stat_user_tables` write timestamps are usable on this Supabase instance;
whether either codebase already has an inventory page. All three should be checked before
building.
