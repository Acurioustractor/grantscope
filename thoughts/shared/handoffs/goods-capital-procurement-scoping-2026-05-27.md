# GrantScope architecture map — CAPITAL + PROCUREMENT pipeline scoping

**Date:** 2026-05-27
**Scope:** ARCHITECTURE MAPPING ONLY. Documents what exists. No design, no recommendations.
**Repo:** `/Users/benknight/Code/grantscope`
**Supabase project:** `tednluwflfhxyucgwigh`

All citations are `file:line`. "Verified" = read the code. "Inferred" = derived, not directly confirmed. "NOT FOUND" = searched and absent.

---

## Q1 — CRAWLER / SOURCE PATTERN

### How `nightly-grant-pipeline.mjs` orchestrates (Verified)
- It is a **process orchestrator**, not a crawler. It spawns child processes per step (`scripts/nightly-grant-pipeline.mjs:73-90`).
- 9 steps, declared in a `STEPS` array (`:61-71`): step 1 `scrape-state-grants`, 2 promote `grant_opportunities → alma`, 3 promote `foundation_programs → alma`, 4 `auto-classify-llm`, 5 `backfill-alma-fields`, 6 `verify-alma-opportunities`, 7 `refresh-funder-context`, 8 internal MV refresh, 9 internal blocklist re-eval.
- Phaseable: `--phase=ingest|enrich|finalize|all` via `PHASE_KEYS` (`:46-52`); each phase scheduled separately to fit cron timeouts.
- Each step logs to `agent_runs` via the child's own `lib/log-agent-run.mjs`; the wrapper just summarizes (`:27`, header `:13-15`).
- **Only step 1 (`scrape-state-grants`) writes net-new `grant_opportunities` rows.** Steps 2-9 promote/enrich/verify existing rows. So a new SOURCE crawler is fundamentally a new step-1-style scraper.

### The actual source-crawler pattern (Verified)
`scripts/scrape-state-grants.mjs` is the canonical crawler-runner. The crawlers themselves are **TypeScript "source plugins"** under `packages/grant-engine/src/sources/`, NOT in `scripts/`:
- `scrape-state-grants.mjs:17-24` imports 8 plugin factories (`createNTGrantsPlugin`, etc.) directly from `../packages/grant-engine/src/sources/*.ts`, instantiates them into a `statePlugins` array (`:41-50`).
- It runs each plugin's async generator (`:100` `for await (const grant of plugin.discover(...))`) and upserts the collected `RawGrant`s into `grant_opportunities` (`:124-181`).

**Plugin interface** (`packages/grant-engine/src/types.ts`):
- `interface SourcePlugin` (`:85`) has `id`, `name`, and `discover(query): AsyncGenerator<RawGrant>` (`:90`).
- `interface RawGrant` (`:39`): fields include `provider` (`:41`), `sourceUrl?` (`:42`), `sourceId: string` ("which plugin found this", `:50`), `discoveryMethod: string` (`:70`), `dedupKey` ("lowercase(provider):lowercase(name)", `:71`).
- A `SourceRegistry` class exists (`packages/grant-engine/src/sources/registry.ts:10`) with `register()`, `configure()`, `getEnabled()`, `discoverAll()`. **HOWEVER**, `scrape-state-grants.mjs` does NOT use the registry — it hand-lists plugins in an array (`:41-50`). The registry is a separate path (used by `grantscope-discovery.mjs` per the agent-registry entry — unverified which exactly).

**How plugins fetch:** each source plugin fetches its own pages. NT plugin (`packages/grant-engine/src/sources/nt-grants.ts`) uses raw `fetch()` + `cheerio.load()` for static pages (`:14, :78, :101`), with a **Firecrawl fallback** for JS-heavy pages (`:166-171`, dynamic `import('@mendable/firecrawl-js')` gated on `FIRECRAWL_API_KEY`). 29 of the source plugins call `fetch(`; 19 use `cheerio` (counted via grep).

### How rows are written to `grant_opportunities` (Verified)
`scrape-state-grants.mjs:127-146` maps each `RawGrant` to a row and upserts:
```
name, provider, url(=sourceUrl), description, amount_min, amount_max,
deadline, categories, source_id(=sourceId), geography(=geography[0]||'AU'),
status:'open', grant_type:'open_opportunity',
source: g.provider || 'state-grants',
upsert onConflict: 'name,source_id'
```
Note: this scraper sets `source` from the provider name, NOT a fixed crawler id. It does **not** set `discovery_method` (left null for the LLM-classify step / the matcher to handle).

### How `source` and `discovery_method` get set (Verified)
- `source` is set per-row by each ingestor (e.g. `scrape-state-grants` uses provider; the manual seed uses `'manual-research-2026-05-27'`, `seed-goods-source-vector-programs-2026-05-27.mjs:25,174`).
- `discovery_method` is a free-text column. Writers found: `import-gov-grants.mjs:242,303,361` (`'scraper'`, `'data.gov.au'`, `'open-data-api'`); `import-public-discovered-grant-pages.mjs:312`; and the **new capital/procurement seed** `seed-goods-source-vector-programs-2026-05-27.mjs` which sets `discovery_method: 'indigenous-finance'` (`:38,62,70`), `'procurement'` (`:46`), or `'grant'` (`:54+`).
- The scorer `scripts/lib/goods-relevance.mjs:74-77` has `BOOSTED_DISCOVERY_METHODS = new Set(['indigenous-finance','procurement'])` and applies a +25 boost (`:89,167-169`) so capital/procurement rows aren't squashed by the grant-tuned scorer.

### Is there a source registry/config? (Verified)
Two distinct registries:
1. **`scripts/lib/agent-registry.mjs`** — the operational registry. Every runnable agent/crawler is an entry in `AGENTS` (`:9`) with `{command, displayName, category, defaultPriority, timeoutMs, dependencies}`. A new crawler script gets registered here to be schedulable (categories include `discovery`, `import`, `goods`, `scraping`). Relevant existing entries: `sync-austender-contracts` (`:35`), `ingest-supply-nation` (via `import-social-traders`? no — `ingest-supply-nation.mjs` is NOT in the registry, unverified if scheduled), `import-nt-contracts` (`:1169`), `ingest-state-procurement` (`:1217`), `goods-*` agents (`:986-1042`).
2. **`packages/grant-engine/src/sources/registry.ts`** — the in-code `SourceRegistry` for grant source plugins.

### Exact mechanism to add a new source crawler (e.g. iba.gov.au) (Verified pattern)
Two viable shapes exist in the codebase:
- **(A) TS source plugin** under `packages/grant-engine/src/sources/iba-finance.ts` implementing `SourcePlugin` (`discover()` async generator yielding `RawGrant`), then either add to the `statePlugins` array in a runner like `scrape-state-grants.mjs:41-50` OR register in `SourceRegistry`. Fetch via `fetch`+`cheerio` (static) or Firecrawl fallback (JS).
- **(B) Standalone `.mjs` ingestor** in `scripts/` (the more common pattern for non-portal sources — e.g. `import-gov-grants.mjs`, `seed-goods-source-vector-programs-2026-05-27.mjs`): create Supabase client, fetch/parse, build row objects with `name/provider/url/description/amount_*/status/source/discovery_method/...`, `supabase.from('grant_opportunities').upsert(...)`. Register in `agent-registry.mjs` AGENTS to schedule it. Set `discovery_method:'indigenous-finance'` for IBA/NAIF/Many Rivers so the scorer boost applies.

### GAPS / ABSENT (Q1)
- NOT FOUND: any iba.gov.au / NAIF / Many Rivers crawler. Those programs exist ONLY as the 10 manual-seed rows in `seed-goods-source-vector-programs-2026-05-27.mjs` (curated, `source='manual-research-2026-05-27'`), not as automated crawlers. Searched `scripts/`, `packages/grant-engine/src/sources/`.
- The state scraper does not set `discovery_method`; only specific ingestors and the manual seed do.

---

## Q2 — PROCUREMENT DATA MODEL

### `goods-procurement-matcher.mjs` (Verified)
- It is a **MATCHER, not an ingestor**. For each `goods_procurement_signal` (status new/reviewing), it: assigns a buyer entity from `goods_procurement_entities` (`:205-215`), matches top-3 open grants from `grant_opportunities` where `goods_relevance_score >= 30` (`loadGoodsGrantPool :86-100`), matches top-3 `foundations` (`:102-113`), sets `funding_confidence` (`:80-84`), and generates `demand_unmet` signals for unserved priority communities (`:251-281`).
- It does NOT write to `grant_opportunities` or create buyer entities. It reads `goods_procurement_entities`, `goods_communities`, `grant_opportunities`, `foundations`; writes `goods_procurement_signals`.

### How `goods_procurement_entities` is populated (Verified)
Multiple writers (grep `from('goods_procurement_entities')` + insert/upsert):
- **`scripts/import-agil-communities.mjs:421`** — bulk insert. Source = AGIL dataset (Australian Government Indigenous Programs & Policy Locations, 1,546 locations) cross-referenced with BushTel NT, CivicGraph `postcode_geo`, and CivicGraph `gs_entities` (header `:3-16`). This is the primary census-style populator (registered as `goods-community-census` → `import-agil-communities.mjs`, `agent-registry.mjs:987-993`).
- **`scripts/add-goods-anchor-buyers.mjs:66`** and **`scripts/backfill-goods-anchor-councils-acchos-2026-05-27.mjs:65`** — curated anchor-buyer inserts (councils, ACCHOs) matched by ABN.
- **`scripts/seed-goods-communities.mjs`**, `fix-alpa-overmatch.mjs`, `drop-goods-noise-localities.mjs`, `push-goods-top25-to-demand-register.mjs`, `sync-ghl-goods-buyers.mjs` — seed/cleanup/sync helpers.
- **Spend columns hydrated from contracts:** `scripts/hydrate-goods-procurement.mjs` fills `estimated_annual_spend`, `govt_contract_value`, `govt_contract_count` on `goods_procurement_entities` FROM the `austender_contracts` table (header `:3-14`; notes austender table is **~672K rows**). Uses goods keyword boost list (furniture/bed/mattress/housing/appliance/washing/etc., `:43+`).

### Tender / contract ingestion that DOES exist (Verified)
- **`scripts/sync-austender-contracts.mjs`** — the real tender/contract ingestor. Source: **AusTender OCDS 1.1 API at `https://api.tenders.gov.au/ocds`, no auth** (`:18, :6`). Syncs by month chunks, `contractPublished`/`contractLastModified` endpoints (`:22-23`). Extracts supplier ABN (`:48-66`), buyer/procuring entity (`:68-80`), contract value (`:82+`). Upserts into **`austender_contracts`** table `onConflict:'ocid'` (`:225`, also `:124,262,272`).
- State-level awarded-contracts importers exist: `import-nsw-contracts.mjs`, `import-qld-contracts.mjs`, `import-nt-contracts.mjs`, `import-act-contracts.mjs`, `scrape-tas-contracts.mjs`, `ingest-state-procurement.mjs` (NSW+QLD) — all registered in `agent-registry.mjs:1152-1224`. (Did not verify each one's target table individually; `austender_contracts` confirmed for the federal sync.)
- `scripts/ingest-supply-nation.mjs` — ingests Supply Nation IBD directory FROM a local CSV (`data/supply-nation/supply_nation_businesses.csv`, header `:6`), target = `social_enterprises` + `gs_entities` cross-ref (header `:7`). NOT a live scraper; CSV-fed. NOT in agent-registry (unverified if scheduled).

### NT $4B remote-housing program ingestion (Verified absent)
- NOT FOUND: any dedicated NT remote-housing / "$4B" / "Room to Breathe" / "HomeBuild" program ingestion. Grep for `remote.housing|$4B|4 billion|room to breathe` returned only generic keyword matches in unrelated scripts (seed/demand/scrape scripts), no dedicated program ingestor. Remote-housing demand is represented indirectly via `goods_communities.demand_beds/demand_washers` and the keyword boost in `hydrate-goods-procurement.mjs`, not as a tracked tender/program.

### What demand-side ingestion exists today vs absent (Verified)
- **Exists:** AusTender federal contracts (live OCDS API → `austender_contracts`, 672K rows); state awarded-contracts importers; AGIL community census → `goods_procurement_entities`; Supply Nation directory (CSV → `social_enterprises`/`gs_entities`); spend-column hydration of buyer entities from austender.
- **Absent / NOT FOUND:** live tender-OPPORTUNITY (open RFT) ingestion as buyable signals (austender sync targets awarded *contracts*, not open tenders surfaced to Goods); NT remote-housing program as a tracked entity; any pipeline turning austender contracts directly into `grant_opportunities`-style procurement opportunities (procurement currently lives in `austender_contracts` + `goods_procurement_entities`/`_signals`, separate from `grant_opportunities` except the 1 manual Supply Nation seed row).

---

## Q3 — FRONTEND SURFACES

### Where Goods grants/opportunities surface (Verified)
1. **Public `/grants` page** — `apps/web/src/app/grants/page.tsx`. Reads `grant_opportunities` (`PUBLIC_GRANTS_LIST_TABLE = 'grant_opportunities'`, `:329`; queries `:660-661, :769, :849`). Supports semantic search via `searchGrantsSemantic` (`:2, :667`) gated on `OPENAI_API_KEY`.
   - **The "pile"-equivalent here is `PROJECT_PRESETS`** (`:81-131`), keyed off the `aligned_projects` array column. There is a `goods` preset (`:82-89`) with `value:'goods'`, `orgHref:'/org/act/goods#funding-feed'`, and a `terms` keyword list (procurement/social enterprise/first nations/remote/etc.). Filtering uses `grant.aligned_projects` (`:156, :688`). **There is NO `pile` column** in this app — "pile" is an ACT-finance term elsewhere; GrantScope's grouping mechanism is `aligned_projects` (project tags like `'goods'`, `'picc'`, `'justicehub'`) + `discovery_method` + `goods_relevance_score`.
   - A fast-path `FAST_ACT_PIPELINE_GRANTS` / `isFastGrantIndex` constant exists (`:644-646`).
2. **Goods signals workbench** — `apps/web/src/lib/services/goods-signals-workbench.ts`. `getGoodsSignalsWorkbench()` (`:117`) reads `goods_procurement_signals` and joins `goods_communities`, `goods_procurement_entities` (buyers), `grant_opportunities` (matched grants, `:188`), `foundations`. Computes fit/noise/triage. Footprint filter `GOODS_FOOTPRINT_STATES = {NT,QLD,WA,SA}` (`:79`). Rendered by `apps/web/src/app/org/[slug]/wiki/goods-signals/page.tsx`.
3. **Goods community detail** — `apps/web/src/lib/services/goods-community-detail.ts`. `CommunityDetail` type carries `total_govt_contract_value`, `total_justice_funding`, `total_foundation_grants` (`:19-21`); `MappedBuyer` (`:26-45`) and `MatchedGrant` (`:72-80`) types. Rendered by `apps/web/src/app/org/[slug]/goods/community/[communityId]/page.tsx`.
4. Other goods routes: `org/[slug]/goods/communities/page.tsx`, `org/[slug]/wiki/goods-operating-system/page.tsx`, `org/_components/org-sections.tsx`, `org/[slug]/page.tsx` (funding-feed anchor).

### How a new capital/procurement pile/view would attach (Verified facts only)
- The existing per-project grouping on `/grants` is `PROJECT_PRESETS` keyed on `aligned_projects` (`page.tsx:81-131,156,1026`). The seed rows tag `aligned_projects: ['ACT-GD','goods']` for score>=50 (`seed-...-2026-05-27.mjs:26,180`). Capital/procurement rows are already in `grant_opportunities` distinguished by `discovery_method ∈ {indigenous-finance, procurement}`.
- The goods-signals workbench and community-detail services already join `grant_opportunities` by matched IDs and surface `goods_relevance_score`; neither currently filters/segments by `discovery_method` (Verified — grep showed `discovery_method` is not selected in `goods-signals-workbench.ts` or `goods-community-detail.ts`).

### GAPS / ABSENT (Q3)
- NOT FOUND: any UI component that filters or segments by `discovery_method`. The frontend grouping primitive is `aligned_projects` (project preset) + `goods_relevance_score`, not `discovery_method`. A capital/procurement "view" today has no dedicated filter chip — capital rows surface only insofar as they carry `goods` in `aligned_projects` or appear as matched grants on a signal.
- NOT FOUND: a `pile` column/concept in the GrantScope web app (it's an ACT-finance term).

---

## Q4 — INGESTION INFRA AVAILABLE

### Scraping / fetch infra (Verified)
- **Firecrawl** — `@mendable/firecrawl-js`, dynamically imported, gated on `FIRECRAWL_API_KEY`. Used in source plugins (`nt-grants.ts:166-171`, also `vic-grants.ts`, `business-gov-au.ts`) and `grant-engine/src/agents/grant-monitor.ts`, `grant-engine/src/foundations/annual-report-scraper.ts`, plus many `scripts/` (e.g. `scrape-charity-annual-reports.mjs`, `build-foundation-profiles.mjs`, `enrich-annual-reports-llm.mjs`).
- **Playwright** — used by JS-heavy scrapers (`scrape-qld-bills.mjs`, `scrape-qld-coroners.mjs`, `scrape-*-bills.mjs`, `scrape-lobbying-qld-playwright.mjs`). Template at `scripts/stubs/PLAYWRIGHT-SCRAPER-TEMPLATE.md`. `grant-engine/src/playwright.d.ts` + `sources/grantconnect.ts` use it.
- **cheerio** — static HTML parsing, used in 19 source plugins.
- **Raw `fetch()`** — 29 source plugins; the default for static + JSON APIs (e.g. austender OCDS).

### LLM-extraction helpers (Verified)
- `scripts/lib/minimax.mjs` — MiniMax M2.7 reasoning model client (`MINIMAX_API_KEY`, `MINIMAX_BASE_URL`); `stripThinkTags()` helper.
- `scripts/lib/local-llm.mjs` — local Gemma via llama-server (`LOCAL_LLM_URL`, `LOCAL_LLM_MODEL`); drop-in provider for the multi-provider round-robin pattern.
- `@anthropic-ai/sdk` — used directly by `auto-classify-llm.mjs:28,47` (`ANTHROPIC_API_KEY`) for grant-type classification. `backfill-alma-fields.mjs` (LLM field extraction) is the field-extraction step in the nightly pipeline.
- OpenAI — embeddings/semantic search (`searchGrantsSemantic`, gated on `OPENAI_API_KEY`); `grant-engine/src/embeddings.ts`.
- Gemini — `GEMINI_API_KEY` present (used for OCR/extraction elsewhere in ACT; presence verified in `.env`).

### ABN / entity resolution infra (Verified)
- `ABN_LOOKUP_GUID` env key present (ABR lookup). `scripts/ingest-abr-bulk.mjs`, `sweep-abn-entities.mjs`, `backfill-oric-abns.mjs`, `link-justice-abns.mjs` exist for ABN matching. Supply Nation / buyer entities are ABN-keyed (`add-goods-anchor-buyers.mjs`, `backfill-goods-anchor-councils-acchos-2026-05-27.mjs`). `GOODS_TRACKED_ABNS` env key exists.

### Logging / scheduling infra (Verified)
- `scripts/lib/log-agent-run.mjs` — `logStart/logComplete/logFailed` → `agent_runs` table. Every ingestor uses it.
- `scripts/lib/agent-registry.mjs` — schedulable agent registry (see Q1).
- `scripts/lib/psql.mjs` — direct psql helper (for DDL / MV refresh that `exec_sql` RPC can't do).

### Relevant env KEY NAMES (names only, no values) (Verified)
`.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `DATABASE_PASSWORD`, `FIRECRAWL_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `GEMINI_API_KEY`, `ABN_LOOKUP_GUID`, `GOODS_TRACKED_ABNS`, `GHL_*` (incl. `GHL_GOODS_PIPELINE_ID`), `NOTION_*` (incl. `NOTION_GRANT_PIPELINE_DB`, `NOTION_FOUNDATION_TARGETS_DB`).
`apps/web/.env.local` adds: `GHL_GOODS_CAPITAL_STAGE_ID`, `GHL_GOODS_BUYER_STAGE_ID`, `GHL_GOODS_PARTNER_STAGE_ID`, etc. (GHL Goods pipeline stage IDs incl. a CAPITAL stage), `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_DELEGATED_USER`.

### GAPS / ABSENT (Q4)
- NOT FOUND: any dedicated AusTender / tenders.gov.au API key — the OCDS API is **no-auth** (`sync-austender-contracts.mjs:6,18`), so no key needed.
- NOT FOUND: a single shared `fetchHtml`/`scrapeUrl` helper in `grant-engine` exported outside `sources/` — each plugin embeds its own fetch+cheerio+firecrawl-fallback logic.
