# Grant-Finder Overhaul — Fix Plan + AU Competitive Teardown

**Status:** Proposed · **Owner:** engineering · **Date:** 2026-07-03
**Strategy fit:** Free open registry for everyone; paid evidence + tender tools for buyers (`docs/strategy/buyer-wedge.md`). This plan *deepens* grant discovery and matching — it does **not** widen the data estate. Data widening is paused.

---

## 0. TL;DR

We built a broad grant-ingest pipeline (~40 source plugins, LLM enrichment, dedup, URL verification, nightly orchestration). It works, but it leans on brittle HTML scraping, ships an unverified LLM-knowledge source into user alerts, runs two divergent dedup strategies, and — the biggest miss — **matches grants to users with keyword heuristics while the semantic-vector infrastructure we already built sits unused on the two highest-traffic paths.**

The AU market teardown says the same thing from the outside: every incumbent (GrantConnect, The Grants Hub, GrantGuru, Funding Centre, Strategic Grants) is a **keyword directory**. None joins opportunities to award history to a recipient profile. None publishes a verification/freshness methodology. That is exactly the ground our entity graph is built to own.

Two moves define this plan:

1. **Ingest the mandated/official feeds instead of scraping HTML** — GA notices and QLD/NSW/VIC opportunities are published as free, structured CKAN datasets. Scraping council HTML by hand is a cost we don't need to carry.
2. **Reason, don't list** — unify matching on the vector path that already works, adopt the CLASSIE taxonomy for interoperability, and join live opportunities to award history so we can tell an org *"grants you're likely to win, and who won them before."* No competitor does this.

---

## 1. What we found in the codebase (grounding)

| # | Problem | Evidence | Sharpened finding |
|---|---------|----------|-------------------|
| 1 | Matching ignores the embeddings we built | `apps/web/src/app/api/grants/match/route.ts` scores from a base 50 with keyword/category/amount heuristics — **its own docstring falsely claims "vector similarity."** `scripts/scout-grants-for-profiles.mjs` does the same. Yet `apps/web/src/app/api/profile/matches/route.ts` already calls the `match_grants_for_org(vector,...)` RPC (`supabase/migrations/20260311_grant_learning.sql`, `20260503000019_fix_match_grants_search_path.sql`) with real embeddings + learning signals. | The semantic path **exists and works**. This is a *consolidation* job, not a build. |
| 2 | ~40 bespoke Cheerio/regex scrapers = maintenance treadmill | `packages/grant-engine/src/sources/*.ts` (per-state + dozens of councils). Amount/deadline extraction is regex-only (`vic-grants.ts:extractAmounts/extractDeadline`). Only **3** contract tests exist (`nsw-grants`, `cityofsydney-grants`, `repository-source-identity`) for ~40 sources. | Silent breakage risk. Replace scrapers with official feeds where they exist; add a per-source health signal for the rest. |
| 3 | `llm_knowledge` grants have no verified URL | `packages/grant-engine/src/sources/llm-knowledge.ts` emits grants with `confidence: 'llm_knowledge'`; the `confidence` enum already exists in `types.ts` (`'verified' \| 'llm_knowledge' \| 'scraped'`) but is **not** gating user-facing alerts. | Quarantine unverified grants from alerts until URL-verified. Cheap, high trust payoff. |
| 4 | Two dedup strategies that can disagree | In-pipeline `deduplicator.ts` merges on `dedupKey = lower(provider):lower(name)`; separate `scripts/dedup-grants.mjs` does a semantic/embedding pass. | Same grant can survive twice across two states/councils. Consolidate on one canonical key + one semantic backstop. |
| 5 | Stale-closing is purely time-based | `scripts/close-stale-grants.mjs`. `verify-alma-opportunities.mjs` already checks URL liveness but the two signals aren't combined. | Combine liveness + deadline to close expired listings faster. |
| 6 | GrantConnect already half-official | `sources/grantconnect.ts` uses the RSS feed + Playwright fallback; `scripts/ingest-grantconnect.mjs` ingests the weekly GA CSV (manual download). | Good base. Automate the GA export and add the CKAN mirror; keep GO capture via RSS/keyword-email. |

---

## 2. AU competitive teardown (what to copy / what to beat)

Full player-by-player notes with citations live in the appendix. The synthesis:

### Comparison

| Player | Sourcing | Freshness | Matching | Access |
|---|---|---|---|---|
| **GrantConnect** (grants.gov.au) | Mandated legal publication (GO + GA notices) | GA ≤21 days post-award; authoritative | Keyword+location email profile; no profile/semantic match | Free; bulk GA via data.gov.au; **no confirmed public GO API** |
| **business.gov.au** | Manual curation (~550 gov programs) | Curated | **Guided finder + editable filters + shortlist-to-email** | Free; no API; business-only |
| **SmartyGrants** (Our Community) | Funder-entered admin platform | Live | N/A (admin); **CLASSIE taxonomy + CLASSIEfier** auto-classifier | Paid SaaS; per-funder OData; data private |
| **The Grants Hub** | Manual curation (7,000+) | Changelog + deadline-change alerts | Saved-search alerts, calendar | Paid membership |
| **GrantGuru** | Aggregation (9,000+ sources) | "Daily" (claim) | Filter/browse, favourites, alerts | Freemium; **council white-label** |
| **Strategic Grants (GEMS)** | Human research (90 hrs/wk) | Manual, high-touch | Project-matched 12-mo calendar; **app + reporting-deadline alerts**; CRM sync | Paid; NFP >$1M |
| **Funding Centre** | Curation (5,500, CLASSIE) | Daily | Custom alerts + "Drafter" writing tool | Paid |
| **State portals** | VIC crowdsourced; QLD/NSW open data | Varies | Basic filters | Free; **CKAN APIs** |

### The pattern

- **Awards** data is well-covered by free open data (CKAN). Live **opportunities** are fragmented — but QLD Grants Finder and VIC's crowdsourced submissions are machine-readable.
- Everyone matches by **keyword + filter**. Only business.gov.au does profile-based discovery, and it's business-only.
- **No one** publishes a freshness/verification methodology.
- **No one** joins opportunity ↔ award history ↔ recipient profile.

### Top 8 process ideas (ranked)

1. **Ingest mandated/official feeds, don't scrape HTML** — GA via [data.gov.au Grants Awarded Data](https://data.gov.au/data/dataset/grants-awarded-data); QLD/NSW/VIC opportunities via CKAN. Only GrantConnect *GO* needs RSS/keyword capture.
2. **Adopt CLASSIE as our taxonomy** — the de-facto AU social-sector standard (ACNC, Our Community, SmartyGrants all use it). Interoperability + better classification.
3. **Auto-classify with an LLM (our "CLASSIEfier")** — kills Strategic Grants' 90-hrs/week manual-research cost. We already run LLM classification (`auto-classify-llm.mjs`); point it at CLASSIE.
4. **Profile/entity-based matching, not keyword** — we hold `gs_entities` (159K, with sector/remoteness/SEIFA/community-controlled). This is fix #1.
5. **Copy business.gov.au's guided-finder + editable-filters + shortlist-to-email** UX — cleanest consumer flow in the market, directly transplantable.
6. **Track reporting deadlines, not just application deadlines** + auto 12-month calendar (Strategic Grants' sticky feature).
7. **Council/LGA white-label distribution** (GrantGuru's moat) — aligns with `mv_funding_by_lga`. Product/GTM, out of scope for this eng plan but noted.
8. **Join award history to open opportunities** — "who won similar grants before + your realistic odds." Our graph (`gs_relationships` 1.08M, `austender_contracts`, `justice_funding`) makes this uniquely possible. **This is the differentiator none of them have.**

### Market gaps we can own

- **Opportunity ↔ award-history ↔ profile join.** Directories list; they don't reason.
- **A trust layer** — explicit "verified 3 days ago · source: [gov feed]" beats everyone's unproven freshness.
- **Predicted foundation giving** from ACNC AIS (`acnc_charities` 66K, `foundations` 10.8K) — foundation opportunities are opaque to every live directory.
- **Free-great-UX + paid-depth** — GrantConnect is free-but-bad; everyone with good UX charges. Our wedge flips this.

---

## 3. Engineering plan (phased)

Each phase is independently shippable and ordered by value-per-effort. Estimates are engineering-days for one dev.

### Phase 1 — Unify matching on the vector path *(highest value, ~2–3 d)* — ✅ DONE

**Problem:** #1. Two heuristic matchers running while the working semantic RPC is used on only one route.

- [x] Extracted a single `scoreGrantsForOrg(db, input)` helper in `packages/grant-engine/src/grant-matching.ts` that wraps the `match_grants_for_org` RPC and layers the existing learning signals (`get_user_feedback_signals`). The pure `applyLearningBoosts` and `scoreGrantsByKeyword` (fallback) live here too.
- [x] Rewrote `apps/web/src/app/api/grants/match/route.ts` to call it (deleted the base-50 keyword block; fixed the docstring). Keyword/category overlap now feeds `match_signals` (explainability) only, not the score.
- [x] Rewrote `apps/web/src/app/api/profile/matches/route.ts` to call the same helper — it's now the single source of truth (−181 lines of inline scoring).
- [x] Rewrote `scripts/scout-grants-for-profiles.mjs` to use the same helper (runs under `tsx` now; both agent registries updated). Enriches vector matches with the fields the RPC doesn't return (source, amount_min, deadline) for alert matching + notifications.
- [x] Guard rail: falls back to keyword scoring when an org has no embedding; logs the fallback rate (`Semantic matching: N/M` in the scout summary; `used_fallback` in the API response).
- [ ] Backfill any grants missing embeddings via `embeddings.ts:backfillEmbeddings` — **deferred to a DB-connected run** (needs `.env` creds; not runnable in the sandbox).
- **Verified:** typecheck clean (`npx tsc --noEmit`); scout import chain resolves under `tsx`; pure boost logic unit-checked (arts/VIC grant boosts 82→90, stale penalized-provider sinks 80→27, signals correct). Behavioural parity with `/api/profile/matches` is guaranteed by construction. **Live `--dry-run` against a real org still needs a DB-connected environment.**

### Phase 2 — Trust layer: quarantine unverified grants *(fast win, ~1 d)*

**Problem:** #3, #5.

- [ ] Add a `verification_status` + `verified_at` surface on grants (derive from existing `confidence` + `verify-alma-opportunities` liveness; migration only if not already stored).
- [ ] Alert/scout paths **exclude** `confidence = 'llm_knowledge'` and unverified URLs; badge them "unconfirmed" in the UI rather than emailing them.
- [ ] Combine URL-liveness + deadline in `close-stale-grants.mjs` (a grant past deadline **or** dead URL → closed).
- [ ] Surface "verified N days ago · source: <feed>" in the grant detail UI (`apps/web/src/app/grants/[id]/page.tsx`) — the trust differentiator.
- **Verify:** confirm a seeded `llm_knowledge` grant never appears in a scout digest and shows the "unconfirmed" badge in the detail view.

### Phase 3 — Official-feed ingestion *(robustness, ~3–5 d)*

**Problem:** #2, #6. Replace fragile scrapers with structured CKAN/CSV where a feed exists.

- [ ] New `api`-type source plugins (they satisfy the existing `SourcePlugin` interface, so the registry/normalizer/dedup pipeline is unchanged):
  - [ ] `data-gov-au-grants-awarded` — [Grants Awarded Data](https://data.gov.au/data/dataset/grants-awarded-data) (CKAN/CSV) → award-history layer.
  - [ ] `qld-grants-finder` — [QLD Grants Finder dataset](https://www.data.qld.gov.au/dataset/grants-finder) (CKAN) → **replaces** the QLD HTML scraper.
  - [ ] `data-nsw` — [Data.NSW grants tag](https://data.nsw.gov.au/data/dataset/?tags=grants) + OpenGov NSW API.
  - [ ] `datavic` — [DataVic CKAN v2.1](https://discover.data.vic.gov.au/dataset/datavic-open-data-api-version-2-1-0) + [vic.gov.au submitted grants](https://www.vic.gov.au/submit-your-grant).
- [ ] Automate the GrantConnect GA weekly export in `ingest-grantconnect.mjs` (fetch instead of manual download); keep GO capture via RSS.
- [ ] Demote the now-redundant HTML scrapers to fallback-only (disabled in `SourceRegistry` config unless the feed is down).
- **Note:** `*.gov.au` blocks automated fetch from some IPs (403). Feed fetchers must use the browser UA already in the plugins and run from an allowlisted egress; log per-source yield so a 403 surfaces immediately.
- **Verify:** run each new plugin standalone, assert non-zero structured rows with populated amount/deadline fields (no regex extraction needed).

### Phase 4 — CLASSIE taxonomy + LLM auto-classification *(interoperability, ~3 d)*

**Problem:** #2 (weak categories), plus the strategic interoperability play.

- [ ] Add a CLASSIE reference table (subjects / populations / SDGs) — small seed dataset, not a data-widening exercise.
- [ ] Extend `auto-classify-llm.mjs` to emit CLASSIE codes alongside our existing categories; store on grants.
- [ ] Map our internal category vocabulary → CLASSIE so existing filters keep working.
- **Verify:** classify a sample of 50 grants, spot-check CLASSIE assignment against ACNC's published usage.

### Phase 5 — Dedup consolidation + source health *(hygiene, ~2 d)*

**Problem:** #4, #2.

- [ ] Make `deduplicator.ts` the single canonical merge; demote `dedup-grants.mjs` to a periodic **semantic backstop** that only merges records the key-based pass missed (cosine over existing embeddings), never a competing strategy.
- [ ] Harden the `dedupKey` (normalize provider aliases across state/council duplicates).
- [ ] Add a per-source "last successful yield" health signal to `agent_runs`; surface in the `/health` dashboard so a silently-zeroed scraper alarms.
- [ ] Add contract tests for the top ~10 sources by volume (mirror `nsw-grants.contract.test.ts`).
- **Verify:** run dedup over a known-duplicated pair; confirm single merged record. Confirm `/health` flags a source forced to return zero.

### Phase 6 — The differentiator: award-history join *(new capability, ~4–5 d)*

**Problem:** the market gap. Depends on Phase 3's award data.

- [ ] Build a view joining live `grant_opportunities` → historical awards (`gs_relationships` where `relationship_type` is grant/funding, `austender_contracts`, `justice_funding`) by category/funder/sector.
- [ ] On the grant detail page: "N similar grants awarded · typical recipient profile · past winners" (respecting premium gating per the buyer wedge).
- [ ] Feed "realistic odds" as an extra signal into the Phase 1 scorer.
- **Verify:** for a known repeat-funder grant, confirm past winners surface and match the underlying relationships.

### Explicitly out of scope (noted, not built here)

Guided-finder UX rebuild (idea #5), reporting-deadline calendar (#6), council white-label GTM (#7). These are product/UX tracks — flag to Ben for prioritisation after Phase 1–3 land.

---

## 4. Access & feasibility — can we actually get these grants?

Short answer: **the sources this plan depends on are open and machine-readable; the paywalled sources are the ones we deliberately don't touch.** The friction is egress policy, not locked data.

### Access model per source

| Source | Access | Auth | Notes |
|---|---|---|---|
| GrantConnect **RSS** (`grants.gov.au/public_data/rss/rss.xml`) | Public feed | None | Already used by `sources/grantconnect.ts` **in production today** |
| GrantConnect **GA weekly export** (CSV) | Public download | None | Already pulled by `scripts/ingest-grantconnect.mjs` |
| GrantConnect GO **document packs** (guideline PDFs) | Free registration | Login | Listing/metadata is open; only the full doc pack needs an account |
| data.gov.au / QLD / NSW / VIC **CKAN APIs** | Open data API | None | Built for machine access |
| The Grants Hub · GrantGuru · Funding Centre · GEMS | Commercial | Paywall/ToS | **Not scraped by this plan** — we ingest primary feeds, not competitors |

The strongest evidence it works: the GrantConnect RSS plugin **already runs on a schedule in the production pipeline**, and the GA CSV ingester already exists. Phase 3 automates and extends proven access — it does not bet on unproven access.

### Two real frictions (and how the plan handles them)

1. **`*.gov.au` bot-blocking.** Some government *HTML pages* return 403 to automated fetchers. This only affects *scraping* — exactly what Phase 3 moves away from. The RSS/CSV/CKAN *data* endpoints are designed for machine access, and the plugins already send a browser UA. Feed fetchers must log per-source yield so a 403 surfaces immediately (Phase 5 health signal).
2. **Egress allowlist.** The Claude-Code web environment runs a restrictive network policy: only a few hosts (GitHub, npm, Anthropic) are reachable; `data.gov.au`, `data.qld.gov.au`, etc. are denied at the proxy (`403 CONNECT`, an org-policy denial — *not* the sites blocking us). This is a sandbox setting, not a source lock.

### What production needs

- The ingesters' natural home is the **production data pipeline** (its own infra + `.env` creds), where the network isn't sandbox-restricted and where GrantConnect RSS already runs.
- To live-validate feeds **from a Claude-Code web session**, the environment's network policy must allowlist: `www.grants.gov.au`, `data.gov.au`, `www.data.qld.gov.au`, `data.nsw.gov.au`, `discover.data.vic.gov.au`. Until then, feed validation runs on prod infra, not in-session.

**Bottom line:** no grant data in this plan is locked behind a paywall. The only thing "locked" is this sandbox's outbound network, which is a config choice, not a blocker to the product.

---

## 5. Sequencing & rationale

```
Phase 1 (matching)     ██████            ship first — biggest UX win, pure consolidation, no new data
Phase 2 (trust)        ░░██              fast, high trust payoff, unblocks honest alerts
Phase 3 (feeds)        ░░░░██████        robustness; feeds award data for Phase 6
Phase 4 (CLASSIE)      ░░░░░░████        interoperability; better than regex categories
Phase 5 (dedup/health) ░░░░░░░░████      hygiene; safe anytime after 3
Phase 6 (award join)   ░░░░░░░░░░██████  the moat; needs Phase 3 award data
```

Phase 1 first because it converts infrastructure we already paid for into user-visible quality with zero new data and no scraping risk — and it directly serves the "evidence depth + buyer UX" priority in the buyer wedge. Phase 6 last because it's the durable differentiator and depends on official award data from Phase 3.

---

## Appendix — sources

Federal: GrantConnect [finance.gov.au](https://www.finance.gov.au/individuals/find-grant-grantconnect), [Go/List](https://www.grants.gov.au/Go/List), [help.grants.gov.au](https://help.grants.gov.au/getting-started-with-grantconnect/); [data.gov.au Grants Awarded](https://data.gov.au/data/dataset/grants-awarded-data); [business.gov.au](https://business.gov.au/grants-and-programs).
Taxonomy/admin: [CLASSIE](https://www.ourcommunity.com.au/classie), [CLASSIEfier](https://www.ourcommunity.com.au/classiefier), [SmartyGrants](https://www.smartygrants.com.au/), [Grants in Australia research](https://www.smartygrants.com.au/research).
Commercial seeker DBs: [The Grants Hub](https://www.thegrantshub.com.au/), [GrantGuru](https://www.grantguru.com/au/browse), [Strategic Grants GEMS](https://www.strategicgrants.com.au/gems/), [GrantHelper](https://granthelper.com.au/), [Funding Centre](https://www.fundingcentre.com.au/).
State open data: [data.qld Grants Finder](https://www.data.qld.gov.au/dataset/grants-finder), [Data.NSW grants](https://data.nsw.gov.au/data/dataset/?tags=grants) + [OpenGov NSW API](https://data.nsw.gov.au/data/dataset/opengov-nsw-api), [DataVic CKAN](https://discover.data.vic.gov.au/dataset/datavic-open-data-api-version-2-1-0), [vic.gov.au submit-your-grant](https://www.vic.gov.au/submit-your-grant), [ACNC](https://www.acnc.gov.au/).

**Uncertainty flagged:** no confirmed public REST/ATOM API for GrantConnect *GO* notices — capture via RSS/keyword-email/HTML list until verified.
