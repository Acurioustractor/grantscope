# What already exists: data maps, catalogs, schema docs and visualisation surfaces

Survey date 2026-08-14. Two repos, one database (`tednluwflfhxyucgwigh`, 812 public
tables+matviews, 52.3M rows).

Method note up front, because it changes how you read everything below: I read files and ran
`git log`, and I ran three cheap DB queries. **I did not load a single page in a browser.** No
claim here about how a surface *renders* is verified. Every "works / is current" judgement is
inferred from code and commit dates.

---

## The headline

**The single most important fact for this task: `/clarity` already existed and was deliberately
deleted.**

| | |
|---|---|
| Built | 2026-03-25, commit `833ca96` — *"feat: /clarity page — full platform data model, coverage heatmaps, schema health watcher"* |
| Size | `apps/web/src/app/clarity/page.tsx` 714 lines + `clarity/schema-graph.tsx` 368 lines |
| Killed | 2026-04-24, commit `bd20a8c` — *"refactor: scope cut to portfolio mode — kill SaaS-shaped surfaces"* |
| Its API | **still live and still deployed**: `/Users/benknight/Code/grantscope/apps/web/src/app/api/data/schema-graph/route.ts` (280 lines) |
| Consumers of that API today | **zero** |

The route file's own header still says: *"Powers the interactive Obsidian-style schema
visualization on `/clarity`."* `/clarity` does not exist. This is a working, orphaned backend
for exactly the thing Ben is asking for.

What the API does (verified by reading it): three `exec_sql` queries — `pg_stat_user_tables`
row counts, `pg_constraint` foreign keys (LIMIT 500), and `information_schema.columns` filtered
to ABN-shaped columns. It emits `{nodes, edges}` where edges are typed `fk | abn | entity_id |
postcode`. **It hard-filters to a 70-entry `TABLE_DOMAIN` map and silently drops every
unclassified table** (`if (!domain) continue;`). So it renders ~70 of 812 objects and gives no
signal that the other 742 exist.

The deleted client was a hand-rolled `<canvas>` radial layout (gs_entities pinned centre,
domains clockwise) — **no charting library at all**, 368 lines of manual 2D context drawing.

---

## Part 1 — Catalog / schema documentation that exists

### 1a. `data_catalog` table + snapshot pipeline (grantscope) — LIVE, CURRENT, TINY

The only *machine-maintained* catalog in the system.

- `data_catalog` — **25 rows** (verified by query). Columns: `table_name, domain, owner_team,
  description, source_of_truth, pii_level, sla_hours, freshness_key, provenance_field,
  confidence_field, active, public_export, licence, source_url, source_owner,
  collection_method, update_cadence, public_caveat`.
- `data_catalog_snapshots` — 1,419 rows; **latest snapshot 2026-08-13 14:31 UTC** covering all
  25 tables. This job is running.
- `v_data_catalog_latest` — the joined view the app reads.
- Populated by `scripts/snapshot-data-catalog.mjs` → `snapshot_data_catalog()` RPC, logged to
  `agent_runs`.
- Read by `apps/web/src/app/api/data/catalog/route.ts` (computes
  fresh/warning/stale/unknown/no_snapshot against `sla_hours`) and by
  `apps/web/src/app/giving/quality/page.tsx`.

The 25 tables, by domain: crm(3), entity_graph(3), funding(4), goods(3), influence(1),
place(1), procurement(4), registries(2), supply_base(1), youth-justice(2).

**Strengths:** it is real infrastructure — governance fields, SLAs, snapshot history,
freshness computed not asserted, and a working nightly job. It has the *right shape*.
**Weakness:** 25 of 812 objects = **3% coverage**, and every row was hand-inserted. Nothing
detects a new table.

### 1b. `data_catalogue` (261 rows) — a different thing entirely

Note the spelling. `data_catalogue` is JusticeHub's harvest of **external open-data portal
datasets** (`jurisdiction, title, publisher, licence, landing_page, formats, resource_count,
source_portal, indigenous_breakdown, youth_focused`). It catalogs *other people's* datasets,
not ours. Populated via `src/lib/data-sources/ckan.ts`. Do not confuse the two — a unified
surface will have to name them distinctly or one will shadow the other.

### 1c. `data/schema-cache.md` (grantscope) — STALE

`/Users/benknight/Code/grantscope/data/schema-cache.md`. Generated **2026-03-20** (5 months
old). Full column lists for **8 tables**. Row counts wrong on every one that matters
(`gs_entities` "159K" vs actual 609,448; `gs_relationships` "1.08M" vs 3,429,184). Refresh
command documented: `node --env-file=.env scripts/preflight.mjs --refresh`. It has evidently
not been run since March.

### 1d. `COMPENDIUM.md` (grantscope) — STALE, WIDER

19KB, dated **2026-03-10**. Documents ~35 tables + 7 MVs grouped into 8 domains, 48 agents,
76 API routes, frontend pages, design system, decision log. Its ASCII architecture diagram
claims "100K entities · 199K relationships · 672K contracts". Actual: 609K / 3.43M / 824K.
Every headline number is wrong by 3-17x. Structurally the best *human* map that exists; its
numbers are unusable.

### 1e. `thoughts/shared/handoffs/frontend-data-audit/` — THE BEST PRIOR ARTEFACT, 4.5 MONTHS STALE

Two files, both dated **2026-04-02** (commit `b49bea3`):

- **`db-inventory.md`** (572 lines) — 63 tables with row counts, key columns and breakdowns
  (entity_type distribution, relationship_type distribution, dataset distribution), plus ~50
  materialized views grouped into 8 families (Power & Influence, Person/Director Networks,
  Funding & Finance, Charity & Foundation, Geographic, Sector-Specific, ALMA, non-prefixed
  views), plus a CRM/operational section and a named list of empty scaffold tables, plus a
  footprint rollup table.
- **`frontend-inventory.md`** (849 lines) — every `page.tsx` and `route.ts`, each annotated
  with **the tables it queries**, server-vs-client, and load profile. Ends with a "Key
  Observations" section naming route duplication (`/entity/[gsId]` vs `/entities/[gsId]`,
  `/foundation/[abn]` vs `/foundations/[id]`), the 5 heaviest pages, the 10 most-queried
  tables, subscription gating, and 12 pages that exist but aren't in nav.

**This is the closest anything has come to Ben's ask.** It is also the clearest demonstration
of why markdown was the wrong container: `gs_relationships` has gone 1.53M → 3.43M,
`political_donations` 302K → 2.55M, and `justice_funding` has gone **down** 218K → 157K (a
dedup, presumably) — and nothing failed, nothing warned, nobody noticed.

### 1f. JusticeHub `docs/provenance/DATA-MODEL.md` — CURRENT AND GOOD

Canonical as at 2026-07-30, last touched 2026-08-09. 160 lines. Explicitly supersedes five
other docs in that folder. Opens with a correction of its own author's measurement error
(a filtered-on-a-nonexistent-column zero reported as a finding, three times in one day) and
states the rule: *"Never report a zero without confirming the column you filtered on exists."*
Then gives the layer model PLACE → ORGANISATION → SERVICE → MONEY, with MEASURES held
deliberately outside it, mapped to open standards (HSDS, OCDS, 360Giving).

This is the right *epistemics* for the map Ben wants. Reuse the posture, not the scope.

### 1g. JusticeHub `docs/DATA_GOVERNANCE_MASTER_PLAN.md` — ABANDONED

794 lines, dated **2026-02-15**, emoji-headed. Claims `organizations` = 471 records (actual
JusticeHub `organizations` is ~108K per the April audit). Six months stale, superseded in
substance by 1f. Treat as archaeology.

### 1h. JusticeHub `.agents/skills/justicehub-data-semantic-layer/` — NEW, UNCOMMITTED, TODAY

**Untracked in git as of this survey.** A skill with three references:
`semantic-layer.md`, `source-inventory.md`, `evidence.md`, plus
`docs/data/justicehub-data-context.md` (98 lines) and a typed registry at
`src/lib/knowledge/data-context.ts`.

The source-inventory reference is unusually honest about its own limits:

> Missing high-value lanes: centrally recorded last successful pipeline runs, expected row
> universes, pipeline owners, destination-table completeness, canonical crosswalk coverage and
> source-level licensing/terms checks.

And its operating rule: *"Script presence is not execution evidence."*

There is also an uncommitted migration `supabase/migrations/20260814083000_data_observatory_run_receipts.sql`
— **dated today**. Someone (a prior session) is mid-flight on the pipeline-provenance half of
this problem right now. Coordinate before building over it.

### 1i. Other grantscope docs (read, lower value for this task)

`CONTEXT.md` (2026-08-06) — domain *language*, not data: glossary of Ask/Signal/Person/Role/
Obligation/Org/Community, screen ownership, "Data trust" section, a banned-vocabulary list.
`docs/adr/` — 4 ADRs, all about *where a record lives* (GHL vs Supabase). Relevant as
precedent for the "which system owns this" column of any catalog. `docs/specs/` — 8 UX specs,
none about data maps.

---

## Part 2 — In-app surfaces that are already data maps

### GRANTSCOPE (`/Users/benknight/Code/grantscope/apps/web/src/app/`)

267 `page.tsx`, 220 `route.ts`. Nav (`src/app/components/nav.tsx`) links 42 routes.

| Surface | Lines | Last touched | What it shows | Backed by | Assessment |
|---|---|---|---|---|---|
| **`/mission-control`** | 16 + 1,915 client | 2026-03-10 | Its own metadata says *"Unified data inventory, power concentration analysis, agent status, and live SQL playground."* Data Inventory section: table, live count, freshness (`timeAgo`), STATIC/FRESH/STALE badge, proportional bar, grouped into 7 categories, sortable by count/freshness/name, collapsible. Plus agent runs, tasks, schedules, discoveries, recharts power chart, and an admin SQL console. | `/api/mission-control` with a **hardcoded 33-entry `TABLES` array** (`countMode: exact\|estimated`, `freshnessCol`) | **The best existing in-app inventory.** Admin-gated (`requireAdminPage`). 33/812 = 4%. The UI pattern (category → count → freshness → status → bar) is directly reusable. |
| **`/ops/health` + `/ops/health/[dataset]`** | 1,189 + 879 | 2026-03-02 | Per-dataset drill-down for **20 tables**, each with a prose description, named source, browsable/filterable/sortable/paginated columns, a **`connections` array naming related datasets and the join** ("Funder profiles linked via foundation_id"), a `refreshCmd`, and a `freshnessCol`. Parent page adds grant semantics checks, source-identity duplicate detection, entity-graph type breakdowns, coverage percentages. | `/api/ops/health` — `exec_sql` ×6 plus RPCs `get_table_freshness`, `get_entity_type_breakdown`, `get_relationship_type_breakdown`, `get_grant_source_breakdown`, `get_foundation_confidence_breakdown` | **The closest existing thing to "drill down through several levels".** The `connections` field is already a hand-authored edge list. 20/812 = 2.5%. Config is a literal `Record<string, DatasetConfig>` in the page file. |
| **`/architecture`** | 461 | 2026-08-13 | Layered platform diagram: 7-stat bar, page/API route cards, four horizontal pipeline flows (Grants, Foundations, Social Enterprises, Matching) as node→arrow→node, 10 `DbCard`s with counts, engine module list, 30+ scripts, 9-provider LLM rotation with ok/warn/down status, legend. | **14 live counts**; everything else hardcoded string literals | Committed 2026-08-13 (release prep), but the *content* is rotten: it lists `/corporate`, `/simulator` and `/for/*` as public pages — **verified: all three directories do not exist.** LLM provider health ("DeepSeek: Quota exceeded", "Perplexity: 401 Auth") is a frozen snapshot presented as status. **Not in nav** — orphaned. Good visual vocabulary for pipelines, worthless as truth. |
| **`/insights`** | 367 | 2026-08-13 | Platform-wide stat rollup — entity/relationship/SE counts, entity-by-type, contract/justice/donation aggregates, community-controlled, remote, disadvantaged, top LGAs. | 5 `.from()` + **12 `exec_sql` calls** | Live and recent. Read-only narrative stats, no drill-down, no schema awareness. |
| **`/dashboard`** | 202 + 244 charts | 2026-08-13 | Recharts sector/geo distribution, top foundations, closing grants, coverage map + funding-gap map. | 4 `dashboard_*` RPCs + 4 tables | Live. **Not in nav.** Funder-facing, not data-map-facing. |
| **`/graph`** | 2,149 (all client) | 2026-04-02 | Force-directed entity network with **9 modes**: hubs, justice, power, interlocks, ndis, dollar, foundations, diary, alma — plus a typed "Story" system (title, narrative, highlights) that drives guided tours through the graph. | `/api/data/graph` (1,507 lines) reading `gs_entities`, `gs_relationships`, `justice_funding`, `alma_interventions`, `civic_ministerial_diaries`, `mv_entity_power_index`, `mv_board_interlocks`, `mv_disability_landscape`, `mv_foundation_scores`, `mv_foundation_regranting`, `mv_foundation_grantees` | **The most sophisticated viz in either repo.** `react-force-graph-2d` via `next/dynamic`. The 9-mode + story pattern is exactly the "drill down several levels" idiom Ben wants — but it maps *entities*, never *the data model*. 4 months since last touch. |
| **`/atlas`** + `src/lib/atlas/` | 47 + 1,134 + 302; lib 1,862 incl. tests | 2026-08-10 | Full-viewport Leaflet council choropleth. **9 layers** in 4 groups (Money / Need / Delivery / "How sure are we"): funding-deserts, money-recorded, justice-funding, grants-awarded, seifa-disadvantage, unplaced-orgs, whats-working, goods-delivered (live) + renewal-cliff (declared). | `/api/data/map`, `getRemoteCouncils`, `getGoodsDeliveredPoints` | **The single best-engineered thing in either codebase, and the model to copy.** See below. |
| **`/power`** | 10 + 774 client + 250/323/220/291 | 2026-03-14 | capital-map (Leaflet), network-graph, money-flow, place-detail. | 5 `/api/power/*` endpoints | 5 months untouched. Working but drifting. |
| **`/giving`** (+ `/sources`, `/standard`, `/quality`, `/api`, `/downloads`, `/corrections`) | 1,026 total | 2026-08-04 | The **public** Australian Giving Data Commons. `/giving/sources` renders a provenance table: dataset → source owner → collection method → cadence → licence → caveats. `/giving/quality` renders live freshness against SLA from `v_data_catalog_latest`. | `src/lib/giving-commons.ts` (362 lines) — a **typed `PUBLIC_DATASETS` registry of 6 datasets** (entities, relationships, foundations, grants, places, contracts) each with `table, domain, description, select, licence, source, sourceUrl, sourceOwner, collectionMethod, updateCadence, caveats[], piiLevel` | **The best-designed catalog *type* in grantscope**, and it's already public-facing with a corrections form. 6 datasets. Extend this type rather than inventing a new one. |
| `/places`, `/place/*` | 89 + 97; council/region pages | 2026-04-25 / 2026-08 | Postcode search + funding-gap Leaflet map; per-council prose reports. | `mv_funding_by_postcode`, council-place-report service | Place work is live and active (the LGA attribution rebuild). |
| `/entities`, `/entity/[gsId]` | 460 / tabbed | 2026-07-01 | Entity search + tabbed detail (overview/money/network/evidence). | ~16 tables per the April audit | Active. Two parallel entity routes still exist (`/entity` and `/entities`) — the April audit flagged this and it is unfixed. |
| `/rankings`, `/discover`, `/evidence`, `/map` | 408 / 118 / — / 9 | Apr / May / Mar / Aug | Charity rankings; featured-report landing (hardcoded `FEATURED` array); evidence browser; `/map` is now a **307 redirect to `/atlas`**. | | `/rankings` and `/discover` are not in nav. `/map`→`/atlas` is a clean, documented consolidation. |

#### The Atlas layer registry — read this before designing anything

`/Users/benknight/Code/grantscope/apps/web/src/lib/atlas/layers.ts`, 557 lines + 261 lines of
tests, plus `reasons.ts`, `share.ts`, `stamps.ts`, `story.ts` (all test-covered).

Its opening comment is the design spec for the whole data-map problem:

> A layer is not a dataset; it is a claim about places, and the registry forces every claim to
> carry its qualifications: what the number contains (the caveat), the geography it is honest
> at, and who is allowed to see it (the consent tier). **A layer with no caveat cannot be
> registered — the type requires one, and the tests reject empty ones.**

Three ideas worth stealing wholesale:

1. **`status: 'live' | 'declared'`.** A declared layer is in the contract but has no data yet,
   and it *still appears in the picker* so the surface can say "we cannot show you this yet"
   out loud. This is how you represent the 88 empty objects and the 305 unreferenced ones
   without hiding them.
2. **`honestAt: 'national' | 'state' | 'council' | 'postcode' | 'community'`** — "not the finest
   grain the data could be sliced to, but the coarsest one at which the claim survives its own
   caveat."
3. **`consent: 'public' | 'org' | 'withheld'`**, with an explicit note that the tier gates
   rendering but the *data* must also be stripped server-side — never sent and hidden
   client-side. (Cross-check: memory records an RSC-payload leak bug from exactly this
   mistake on the grant-award-history work.)

The `data-quality` group is placed **last** on purpose — Ben's call, 2026-08-09 — because
"uncertainty qualifies the other layers, it does not compete with them."

### JUSTICEHUB (`/Users/benknight/Code/JusticeHub/src/app/`)

Branch `living-atlas`. **112 modified + 111 untracked files in the working tree.** Anything
described here as new may not survive to `main` in this form.

| Surface | Lines | State | What it shows | Backed by |
|---|---|---|---|---|
| **`/admin/data-observatory`** | 461 + 107 + 63 | **UNTRACKED — brand new, uncommitted** | Four views (`sources` / `runs` / `questions` / `agent`). Per asset: kind, domains, locator, access, health (registered/monitored/source_gated/candidate/needs_attention), **joinReadiness (ready/partial/blocked/not_applicable)**, entityTypes, coverage, freshness, sourceOfTruth, canAnswer[], overlapKeys[], nextEnrichment, caveat, destinationTables[], externalHosts[], automationEligible. Plus federated run evidence from existing domain logs. | `src/lib/data-observatory/` (1,108 lines, 8 files). `source-catalogue.ts` builds by **walking the filesystem** (`readdirSync` over `scripts/`, regex `PIPELINE_PATTERN`) and merging three typed registries: `CKAN_PORTALS`, `FUNDING_SOURCES`, `SEARCH_SOURCE_QUERY_NAMES`. |
| **`/what-we-hold`** | 176 + `src/lib/holdings/` 375 | Committed 2026-08-02 | **15 holdings** grouped by four questions (who / where / what / so_what), each with a **live DB count**, a `permission` (ours_to_show / theirs_to_release / consent_gated / **contested**), a `qualifiedBy` link to the page saying what's wrong with the number, and a `caveat`. | `loadHoldingCounts()` — 17 parallel `count(*)` against `organizations`, `person_roles`, `jr_sites`, `jr_site_metrics`, `justice_funding`, `rogs_justice_spending`, `alma_interventions`, `alma_evidence`, `alma_media_articles_publishable`, `civic_hansard`, `storytellers`. **Returns `null` on any failure rather than partial numbers.** |
| **`/explore`** | 24 + 556 | 2026-08-10 | "The whole platform inside one dashboard shell" — 11 panels in a sidebar, each swapped in place via `?panel=` (`router.replace`, shareable, back-button friendly). Panels: Search, Communities, Alternatives, Money, Justice Matrix, Map, Stories, Themes, CONTAINED, My workspace, Add your voice. | Live counts only for communities + money; the rest are doors (links). |
| **`/intelligence/*`** | 48 pages | 2026-08-10 (mass rebuild, commit `b7d8bed9` "all of /intelligence") | power-map, network, funding-flows, map, convergence, knowledge, dashboard, national, state/regional drilldowns, evidence library, `civic/data-quality`, `civic/methodology`. | Mixed. Verified no `MOCK_`/mock-data markers anywhere under `/intelligence`. |
| **`/intelligence/civic/data-quality`** | 295 | 2026-08-11 rebuild | Per-state Tier-1 org coverage, foundation-funding tracking, ACCO certification, philanthropy YJ-relevance. | `v_entity_360`, `organizations`, `foundation_grantees`. **Bug spotted:** line ~36 calls `supabase.rpc('exec_sql', { sql: '' })` — an empty query with the wrong param name (grantscope's guard reads `params.query`), swallowed by `.catch()`. Dead call. |
| **`/community-map`** | 1,467 | 2026-08-10 | Services + programs + JR geo overlay. | 3 API fetches |
| **`/analysis`** | 1,168 | 2026-07-11 | Case-for-change + inquiry-tracker reports. | `/api/analysis/*` |
| **`/journey-map`** | 558 | 2026-08-02 | NQ locations, ALMA interventions, justice funding. | direct `.from()` |
| **`/transparency`**, `/leaderboard`, `/pulse`, `/system` | 678 / 347 / 4pp / 14pp | 2026-08 | Homepage stats, state funding leaderboard, activity pulse, per-state system pages. | mixed |
| `/justice-network`, `/sector-map`, `/follow-the-money` | 10 / 11 / — | 2026-08 | **Redirects.** `/justice-network` → `/communities/justice-reinvestment` (retired 2026-08-11); `/sector-map` → `/justice-funding` (permanent). | — |

#### `src/config/surface.ts` — the pattern to copy for governance

658 lines. **348 route records.** A typed registry of every public route with `group`,
`purpose`, `reader`. Guarded by `src/__tests__/lib/surface-coverage.test.ts`, which **fails
the build when a route exists without a record, or a record without a route.**

Its header states the reason plainly:

> WHY THIS IS CODE AND NOT A DOCUMENT. The sister repo built exactly this as a model on 26
> July, applied it to none of its 117 routes, and did not notice for a week. A markdown map
> would rot the same way and nothing would fail.

And it publishes its own incompleteness rather than faking coverage: 57 routes seeded with a
group only, 48 classified by reading every page, the rest explicitly `null` — *"They are not
unknowable, they are undecided, and writing a plausible group for each would produce a map that
looks complete and answers nothing."*

**This is the single best precedent in either repo for how Ben's data map should be built:
typed code + a coverage guard that fails CI + published unknowns.**

---

## Part 3 — Visualisation libraries already installed

Do not add a fourth. There are already four-and-a-half.

### grantscope `apps/web/package.json`

| Library | Version | Used in (files) |
|---|---|---|
| `recharts` | ^3.7.0 | 8 — dashboard/charts, charities/insights, mission-control, reports ×5 |
| `react-force-graph-2d` / `-3d` | ^1.29.1 | 2 — `/graph`, `/entity/[gsId]/network-graph` (3d installed, **no import found**) |
| `leaflet` + `react-leaflet` | 1.9.4 / ^5.0.0 | 8 — atlas-map, power/capital-map, places/funding-gap-map, dashboard/coverage-map, australia-map, se-map, org explore atlas, central-australia map-canvas |
| `@phosphor-icons/react` | ^2.1.10 | icons |

**No d3, no visx, no mapbox, no deck.gl, no cytoscape, no sigma, no react-flow, no framer-motion.**
The Bauhaus system's "no decorative animation" rule is why there's no motion library.

### JusticeHub `package.json`

| Library | Version | Used in (files) |
|---|---|---|
| `recharts` | ^3.6.0 | 3 |
| `d3` + `d3-sankey` | ^7.9.0 / ^0.12.3 | 4 — SankeyDiagram, TopicBurst, SentimentTimeline, authority/FundingNetwork |
| `cytoscape` | ^3.33.1 | 1 — `components/intelligence/NetworkGraph.tsx` |
| `react-force-graph-2d` | ^1.29.0 | 1 — `components/intelligence/KnowledgeGraph.tsx` |
| `maplibre-gl` | ^4.7.1 | 13 |
| `leaflet` + `react-leaflet` | 1.9.4 / ^4.2.1 | 12 |
| `framer-motion` | ^12.23.26 | 9 |
| `react-scrollama` | ^2.4.2 | 2 — scrollytelling |
| `@radix-ui/*`, `lucide-react`, `tailwind-merge`, `cva` | | shadcn-style UI kit |

**Overlap = the safe set:** `recharts` + `react-force-graph-2d` + `leaflet/react-leaflet` are
installed in **both** apps. Anything built on those three works in either repo with no new
dependency.

**Version divergence to watch:** React 19 / Next 15 / Tailwind 4 (grantscope) vs React 18 /
Next 14.2.35 / Tailwind 3.4 (JusticeHub); `react-leaflet` 5 vs 4. A component is **not**
portable between the two repos without a compat pass.

---

## Part 4 — The two design systems, precisely

### grantscope — **Civic Bauhaus** (`/Users/benknight/Code/grantscope/DESIGN.md`, 7.6KB, 2026-04-25)

*"A Bloomberg Terminal designed by the Bauhaus school."* Authoritative, precise, serious.
Explicitly not friendly or approachable. The stated differentiator: every competitor uses
government blue + system fonts + rounded corners.

**Type** — Satoshi (Fontshare CDN, `f[]=satoshi@700,800,900`) for display: 900 hero/H1, 800 H2,
700 H3 + all card headers/nav/buttons, uppercase, `tracking-widest` at hero. DM Sans (Google,
300–700 + italic) for all body and data, with `font-variant-numeric: tabular-nums` on financial
columns. JetBrains Mono (400/500/600) for ABNs, GS-IDs, identifiers.
Scale: hero 56 / H1 48 / H2 32 / H3 20 / body 16 / small 14 / meta 13 / micro 11–12 (Satoshi 700
uppercase) / code 14.

**Colour** — restrained; colour signals state, never decorates.
`black #121212` · `red #D02020` (the signature) · `blue #1040C0` · `yellow #F0C020` ·
`canvas #F0F0F0` · `white #FFFFFF` · `muted #777777`.
Semantic pairs: success/money `#059669`/`#ecfdf5`, warning `#F0C020`/`#FFF8E0`, error
`#D02020`/`#FFE8E8`, info `#1040C0`/`#E8EEFF`.
11-step neutral ramp `#F0F0F0 → #0A0A0A`. **No dark mode, by decision.**

**Geometry** — base unit 4px; scale 2/4/8/16/24/32/48/64. 12-col grid, max width 1200px.
**`border-radius: 0 !important` globally — non-negotiable.** Borders 4px primary / 2px
secondary / 1px rows. Shadows **hard offset only**: `8px 8px 0px 0px var(--bauhaus-black)`
primary, `4px 4px 0px 0px` small. No soft shadows, no gradients, no blobs.

**Motion** — minimal-functional only. Buttons 0.15s, section fades 0.3s; micro 50–100ms.
**No spring physics, no parallax, no scroll-triggered reveals.** "Bauhaus is still, not bouncy."

**Components** — Cards: white / 4px black border / 8px hard shadow / optional 8px coloured left
border. Tables: 4px outer border, black header row with Satoshi 700 white uppercase, 1px row
dividers, hover `#E8EEFF`, financials tabular-nums green-for-positive. Badges: Satoshi 700,
10–11px, uppercase, 0.1em tracking, 2px coloured border + light fill. Sidebar: black ground,
4px red left-border active. Tabs: 4px red bottom-border active.

**`.ws` workspace theme** — a density variant for internal tools: same fonts, borders drop
4px→1px, hard shadow → subtle drop shadow, headings Satoshi 700 not 900, reduced tracking.
**A data-map admin surface should probably wear `.ws`, not the full Bauhaus.**

### JusticeHub — **Living Atlas** (`/Users/benknight/Code/JusticeHub/DESIGN.md`, 32KB, 2026-08-13)

Chosen by Ben on 2026-08-07 over a brutalist redraw. *"A research platform with Country in
it. OpenAlex crossed with Asana on the tool side, a warm serif editorial voice on the story
side."* Light, airy, precise.

**Two registers, one token set.** *Instrument* (dense, ground near-white, leads with the
control, Inter throughout, a stat is a filter) vs *Argument* (sparse, deep-green band, leads
with the sentence, Fraunces at scale, a stat is the hero). **Mode is derived from the route's
`group` in `src/config/surface.ts`, never chosen per page**, and `design-modes.test.ts` parses
the table in DESIGN.md and compares it to the code. Internal consoles are always Instrument.
**A data observatory is an Instrument.**

**Type** — Fraunces 600 (display, story sentences, quotes, big numerals in Argument bands;
tracking -0.5 to -3; **never on controls**). Inter 400/500/600 (all UI) + 900 (wordmark only).
Spline Sans Mono 400/500 (numbers, source lines, kickers, routes, citations; kickers uppercase
at 1.5–2.6px letterspacing). Tailwind: `font-atlas-serif` / `-sans` / `-mono`. `font-display`
is banned in new work.

**Colour** (`--atlas-<name>` CSS / `atlas-<name>` Tailwind; source of truth
`src/config/design-tokens.ts`, guarded by `atlas-token-bridge.test.ts`):
`ground #FCFBF8` (never pure white as a page) · `surface #FFFFFF` · `band #14211C` ·
`band-raised #1D2B25` · `ink #1A1D1B` · `ink-muted #57605B` (6.3:1) · `ink-faint #8A938D`
(placeholders only) · `border #E7E4DD` · `border-strong #C9C5BB` · `on-band #F6F4EE` ·
`on-band-muted #A8B3AC` (7.7:1).
Action: `eucalyptus #2F5D3F` (7.4:1) / `-deep #234731` / `-tint #E9F0EB` — **the only
interactive colour**.
`community #A85200` (5.24:1; darkened from #C25E00 on 2026-08-09 after it failed AA at 4.15:1
across 31 text call-sites) / `-text #A04A00` / `-tint #F7EBDD` / `-on-band #D98B3D`.
**Entity hues (the OpenAlex move) — every record type wears a quiet colour:** community =
community orange, money = `#1B4177` / `#E7EDF5`, story = plum `#7A3E6E` / `#F4E9F1`,
outcome/alternative = teal `#0F6672` / `#E3F0F2`, source/provenance = warm grey `#635C4F` /
`#EEECE7`. `held #7A5B00` / `#F6EFD9`. `signal #B42318` — critical and destructive only,
never decorative, and **nothing else is red so red always means one thing**.
Landscape-named tokens must cite an AS 2700 code (eucalyptus→G52, plum→P52, money→B22) or be
renamed for their job — which is why `ochre`→`community` and `slate`→`source`.

**Trust states (four):** SOURCE LINKED (source outline) · CONFIRMED (eucalyptus tint) ·
COMMUNITY-PUBLISHED (**solid community orange — the only solid chip**) · HELD (amber tint).
Machine-derived states must never present as human confirmation.

**Geometry** — radii 6 / 8 / 12 / pill. **Sharp corners are retired.** Borders 1px `border`;
1.5–2px eucalyptus marks selection. Elevation: `0 1px 3px #14211C14` on raised interactive
panels only; popovers `0 2px 6px`–`0 4px 16px`. Never on text. 4px spacing base; bands pad
56–92px vertical; cards 14–28; reading width 640–760; content max 1160 inside 1440.

**Rule:** one accent moment per section. Never encode a distinction as red-against-green.

**Workflow constraint:** Pencil is the sole design workspace; canonical file `JusticeHubNew.pen`
(repo root). No Figma, no Superdesign, no v0, no HTML canvas. Components are canonical as
Pencil nodes (Stat Card `Cr2X8`, Source Line `qEN73`, Trust Chip `BR4o3`, Evidence Card
`U8WiRz`, …).

**Important caveat, stated in DESIGN.md itself:** *"Live code still wears the old system until
each view is rebuilt."* Verified — `/what-we-hold` uses `var(--jh-red)`, `font-display` and
`#F5F0E8`, all retired brutalist tokens. So a JusticeHub surface built today must be Living
Atlas even though its neighbours are not.

**The two systems are irreconcilable by design** (grantscope's DESIGN.md calls Civic Bauhaus an
"intentional break" from the Editorial Warmth family). A single shared data-map component
cannot wear both. Either it lives in one repo and the other links to it, or it is built twice.

---

## Part 5 — How much of the database any of this actually covers

I measured this three ways. All are lower bounds on "referenced"; the tight one is the honest
headline.

**Method (tight):** for each of the 812 census object names, test whether it appears in
`src/**/*.{ts,tsx}` either quoted (`'name'`, `"name"`, `` `name` ``) or after SQL
`FROM`/`JOIN`. 968 grantscope files, 2,288 JusticeHub files.

| | Objects referenced | of 812 |
|---|---|---|
| grantscope `apps/web/src` | **266** | 33% |
| JusticeHub `src` | **348** | 43% |
| Union of both apps | **507** | 62% |
| Referenced by **neither** app | **305** | **38%** |
| Referenced by **both** | 107 | 13% |

(A looser bare-word-boundary match gives 292 / 761 / 785, but JusticeHub's 761 is obvious
false-positive inflation from generic names like `articles`, `stories`, `events`, `users`,
`profiles`. Ignore it. Neither method covers `scripts/` — e.g. `abr_registry` appears in 25
grantscope scripts but only twice in `apps/web/src`.)

**Coverage of every catalog artefact, side by side:**

| Artefact | Objects covered | of 812 | Auto-maintained? | Current? |
|---|---|---|---|---|
| `data_catalog` table | 25 | 3.1% | snapshot yes, membership no | ✅ 2026-08-13 |
| `/ops/health/[dataset]` | 20 | 2.5% | ❌ hardcoded | ~2026-03 |
| `/mission-control` inventory | 33 | 4.1% | ❌ hardcoded | ~2026-03 |
| `/api/data/schema-graph` | ~70 (`TABLE_DOMAIN`) | 8.6% | counts+FKs yes, membership no | orphaned |
| `giving-commons.PUBLIC_DATASETS` | 6 | 0.7% | ❌ typed literal | ✅ 2026-08-04 |
| `data/schema-cache.md` | 8 | 1.0% | script exists, unrun | ❌ 2026-03-20 |
| `COMPENDIUM.md` | ~42 | 5.2% | ❌ | ❌ 2026-03-10 |
| `db-inventory.md` | ~113 | 13.9% | ❌ | ❌ 2026-04-02 |
| JusticeHub `holdings` | 11 tables → 15 holdings | 1.4% | live counts | ✅ 2026-08-02 |
| JusticeHub `source-catalogue` | 14 assets (sources/pipelines, **not tables**) | n/a | ✅ filesystem walk | uncommitted |
| **Best single artefact** | **~113** | **13.9%** | | |
| **Union of all of them** | **< 200 (est.)** | **< 25%** | | |

**Nothing in either repo enumerates more than about one table in seven.** And ~305 objects
(38%) are touched by no application code at all — including `mv_abr_name_lookup` (9.0M rows),
`privacy_audit_log` (1.28M), `mv_charity_network` (351K), `person_identities` (230K), and
**five `gs_entities_*_backup_*` tables totalling ~1.46M rows of pure cruft**.

---

## Part 6 — Honest assessment: what to build on, what to walk away from

### Build on

1. **`src/lib/atlas/layers.ts`** — the type discipline (mandatory caveat, `honestAt`, consent
   tier, live/declared status) is the correct model for a data catalog, already shipped,
   already test-guarded. A `DataObject` type is a `AtlasLayer` with different fields.
2. **`src/config/surface.ts` + `surface-coverage.test.ts`** — the *governance* model.
   A guard that fails CI when the registry and reality diverge is the only thing in either repo
   that has demonstrably not rotted. Every markdown artefact here rotted; this did not.
3. **`giving-commons.PUBLIC_DATASETS`** — the correct *field set* for a per-dataset record
   (licence, source owner, collection method, cadence, caveats, PII level), and it already has
   a public surface and a corrections form.
4. **`data_catalog` + `data_catalog_snapshots` + `snapshot_data_catalog()`** — the freshness
   machinery is real and running. Widen its membership; do not rebuild it.
5. **`/ops/health/[dataset]`'s `connections` field** — a hand-authored edge list with join
   prose. This is the drill-down substrate; it needs to be generated from
   `foreign_keys.csv` (636 real FKs) rather than typed by hand.
6. **`/api/data/schema-graph`** — 280 lines of working pg_catalog introspection with zero
   consumers. Remove the `TABLE_DOMAIN` hard-filter and it enumerates everything.
7. **`/graph`'s 9-mode + Story pattern** — the proven idiom for "drill down through several
   levels" in this codebase.
8. **`/explore`'s `?panel=` shell** — panel-swap-in-place with shareable URLs and working back
   button. Reuse the interaction, not the content.
9. **`/what-we-hold`'s `permission` axis** — `ours_to_show` / `theirs_to_release` /
   `consent_gated` / `contested`. A national philanthropy dataset needs this column and nobody
   else has one.

### Walk away from

1. **`/architecture`** — content is provably false (three of its listed public pages don't
   exist), status is a frozen snapshot, it's not in nav. Its pipeline-flow *visual vocabulary*
   is fine; its content is not salvageable.
2. **`docs/DATA_GOVERNANCE_MASTER_PLAN.md`** (JusticeHub) — 6 months stale, counts off by two
   orders of magnitude, superseded by `docs/provenance/DATA-MODEL.md`.
3. **`COMPENDIUM.md` and `data/schema-cache.md` as sources of numbers** — keep the structure,
   trust none of the figures.
4. **Any new markdown inventory.** Three have already been written (schema-cache, COMPENDIUM,
   db-inventory). All three rotted within 5 months and nothing failed. `surface.ts`'s own
   header documents the sister-repo version of this exact failure.

### Risks and unknowns I could not settle

- **Nothing was rendered.** I read code and git history. No claim about visual correctness or
  runtime behaviour is verified.
- **JusticeHub's working tree is 112 modified + 111 untracked files on `living-atlas`.** The
  data-observatory, the semantic-layer skill and a migration dated **today** are all
  uncommitted. Another session is mid-flight on the pipeline half of this problem. **Check with
  Ben before touching `src/lib/data-observatory/`.**
- **`source-catalogue.ts` walks the filesystem at request time** (`readdirSync` over `scripts/`).
  Whether `scripts/` is present in a Vercel serverless bundle is **unverified** — I did not
  check `next.config` / `outputFileTracing`. If it isn't, the observatory renders empty in prod
  and full in dev.
- **MV refresh state unknown.** I did not check whether the 98 matviews are current; memory
  records a nightly `refresh-views-v2.mjs` at 17:00 UTC taking ~15 min, but I did not verify it
  ran.
- **Dead code found, not fixed:** `intelligence/civic/data-quality/page.tsx` calls
  `exec_sql` with `{ sql: '' }` (wrong param name — grantscope's guard reads `params.query`)
  wrapped in `.catch()`. Silent no-op.
- **`react-force-graph-3d` is installed in grantscope with no import found.** Probably
  removable.
- **`data_catalog` vs `data_catalogue`** are unrelated tables one letter apart. This will bite
  somebody.
