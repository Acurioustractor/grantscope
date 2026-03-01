# GrantScope Phase 2 PRD — The Matching Engine

**Date:** 1 March 2026
**Status:** Draft
**Depends on:** Phase 1 complete (14,119 grants, 9,874 foundations, 100% embedded, semantic search live)

---

## Mission

Level the playing field so community-based organisations — especially First Nations groups, grassroots collectives, and culturally-grounded social enterprises — get matched with the funding they deserve, without needing a grant writer, a Sydney network, or a six-figure fundraising budget.

Australia's $8.86B in annual charitable giving flows through relationship networks that favour established, metro-based organisations. GrantScope makes the flow visible and the matching automatic.

---

## What Phase 1 Delivered

| Asset | Count | Coverage |
|-------|------:|----------|
| Grant opportunities | 14,119 | 10+ government sources, 100% embedded |
| Foundations | 9,874 | ACNC-derived, 1,627 enriched with LLM profiling |
| Foundation programs | 866 | Linked to 361 foundations |
| ACNC annual statements | 359,678 | 7 years (2017-2023), 53k+ charities |
| Community orgs | 500 | Youth justice domain only |
| Semantic search | Live | Hybrid keyword/vector on grants page |
| Web UI | Live | Grants search, foundations directory, corporate giving, reports |

### What's Missing

1. **Grant descriptions are thin** — 44% have no description, 43% have stubs under 200 chars. Semantic search quality suffers.
2. **Foundation programs are invisible** — 866 programs exist but don't appear in grant search results.
3. **No org self-registration** — Community orgs can't create a profile and get matched.
4. **No matching engine** — The two sides (seekers + givers) can't find each other automatically.
5. **Corporate layer is absent** — No way to trace money from BHP's $13B profit to community outcomes.
6. **3,304 foundations with websites haven't been enriched** — The profiler exists and works, just needs to run.

---

## Phase 2 Scope

### Track A: Data Quality (Weeks 1-2)

Make the existing data dramatically more useful before adding new features.

#### A1. Foundation Enrichment at Scale

**What:** Run the existing multi-provider LLM profiler on 3,304 foundations that have websites but haven't been enriched.

**Why:** Rich foundation profiles (giving philosophy, application tips, board members, focus areas) are the #1 value-add for seekers. Going from 16.5% → 50%+ enriched transforms the foundation directory from a list into intelligence.

**How:**
- The profiler already exists: `packages/grant-engine/src/foundations/foundation-profiler.ts`
- Round-robins 8 providers (Gemini grounded, DeepSeek, Kimi, Groq, Minimax, OpenAI, Perplexity, Anthropic)
- Run via `scripts/build-foundation-profiles.mjs`
- Priority order: top 500 by `total_giving_annual` DESC, then those with `open_programs` JSONB, then remainder

**Acceptance criteria:**
- [ ] 3,000+ additional foundations enriched (bringing total to 4,600+)
- [ ] Foundation directory pages show descriptions, focus areas, giving philosophy for enriched foundations
- [ ] Enrichment errors logged to `enrichment_errors` or stdout for debugging

**Cost:** $0 (free LLM tiers) — just API quota patience over 3-5 days of batched runs.

#### A2. Grant Description Enrichment

**What:** Build a Cheerio + Groq pipeline to crawl grant URLs and extract rich descriptions, eligibility, and deadlines.

**Why:** 6,244 grants (44%) have no description. Another 6,041 have stubs. Only 13 have 500+ char descriptions. This kills semantic search quality — embedding "Community Grant" with no description produces garbage vectors.

**How:**
1. Fetch grant URL with Cheerio (static HTML) — 99% of government grant pages are server-rendered
2. If Cheerio gets empty content, queue for Playwright (already in deps)
3. Send extracted text to Groq (Llama 3.3 70B, 14,400 free requests/day):
   - Extract: description (200-500 chars), eligibility criteria, target recipients, deadline, funding amount
4. Update `grant_opportunities` row
5. Re-embed the grant (updated description = better vector)

**New file:** `packages/grant-engine/src/enrichment-free.ts` (Groq-based, alongside existing Anthropic-based `enrichment.ts`)

**Acceptance criteria:**
- [ ] Pipeline processes 1,000+ grants/day (Groq free tier = 14,400 req/day)
- [ ] Grants with enriched descriptions show improvement in semantic search relevance
- [ ] `enriched_at` timestamp set on all processed grants
- [ ] Fallback: if Cheerio fails, Playwright attempt; if both fail, skip (don't block pipeline)

**Cost:** $0 (Groq free tier + Cheerio/Playwright already in deps)

#### A3. Unify Foundation Programs into Grant Search

**What:** Make the 866 foundation programs appear in grant search results alongside the 14,119 government/other grants.

**Why:** Users searching for "indigenous arts funding" should see both government grants AND foundation programs. Currently they only see government grants.

**Approach:** Sync foundation_programs → grant_opportunities (denormalize). This is simpler than a unified search endpoint because:
- Semantic search already works on grant_opportunities
- UI already renders grant_opportunities
- No new query logic needed

**How:**
1. Add `foundation_id` FK column to `grant_opportunities` (nullable)
2. Write sync function: for each foundation_program, upsert into grant_opportunities with:
   - `source: 'foundation_program'`
   - `provider: foundation.name`
   - `grant_type: 'foundation'`
   - `foundation_id: foundation.id`
3. Embed the synced programs (they'll get picked up by `backfillEmbeddings`)
4. Run sync on a schedule (daily) to catch new programs

**Migration:**
```sql
ALTER TABLE grant_opportunities
  ADD COLUMN IF NOT EXISTS foundation_id UUID REFERENCES foundations(id);
```

**Acceptance criteria:**
- [ ] 866 foundation programs appear in grant search
- [ ] Searching "arts funding melbourne" returns both government grants and foundation programs
- [ ] Foundation programs link back to their foundation detail page
- [ ] Deduplication: foundation programs don't create duplicate entries on re-sync

---

### Track B: Org Profiles + Matching (Weeks 2-4)

The core feature that makes GrantScope two-sided.

#### B1. Org Profiles Table

**What:** Create `org_profiles` table so any organisation can register and get matched.

**Why:** This is the leveling mechanism. A community org in Arnhem Land with 2 staff and no grant writer creates a profile → the system matches them with every relevant grant and foundation program automatically.

**Schema:** (full SQL in `thoughts/plans/data-model.md`)

Key fields:
- `acnc_abn` — auto-populates from ACNC data if they have an ABN
- `focus_areas`, `geographic_scope`, `beneficiaries` — arrays for matching
- `org_size`, `annual_revenue`, `staff_count` — for size-appropriate matching
- `grant_size_min/max` — what size grants they want
- `abn_registered`, `dfv_check`, `acnc_registered`, `insurance_current`, `audited_financials` — grant readiness checklist
- `embedding vector(1536)` — for semantic matching
- `claimed_by` — auth (future: Supabase Auth or social login)

**Auto-population flow:**
1. Org enters ABN
2. System looks up `acnc_ais` for latest financial data
3. Pre-fills: name, revenue, staff count, ACNC registration status, DGR status
4. Org fills in mission, focus areas, geographic scope, beneficiaries
5. Profile gets embedded for matching

**Acceptance criteria:**
- [ ] Table created with RLS policies
- [ ] API: `POST /api/org-profiles` (create), `GET /api/org-profiles/:id` (read), `PATCH /api/org-profiles/:id` (update)
- [ ] ABN lookup auto-populates from ACNC data
- [ ] Profile embedding generated on create/update

#### B2. Matching Engine

**What:** Automated grant ↔ org matching that runs daily.

**Why:** This is the product. Without matching, GrantScope is just a search engine. With matching, it's a platform that works for you while you sleep.

**Schema:** `matches` table (full SQL in `thoughts/plans/data-model.md`)

**Matching algorithm:**
1. For each org profile, run vector similarity against all grant_opportunities + foundation_programs
2. Score on 4 dimensions:
   - **Semantic fit** (40%) — embedding cosine similarity between org profile and grant
   - **Geographic match** (20%) — org location overlaps with grant geography
   - **Size appropriateness** (20%) — org revenue vs grant amount range
   - **Eligibility match** (20%) — org capabilities vs grant requirements (when enriched)
3. Composite `fit_score` (0-100) with `match_reasons` array explaining why
4. Store top 50 matches per org, refresh daily

**Match lifecycle:**
```
suggested → saved → applying → submitted → won/lost → (feedback loop)
```

**Acceptance criteria:**
- [ ] Matching runs nightly via cron script
- [ ] Each org profile gets 10-50 ranked matches
- [ ] Match results show on org profile page with fit score + reasons
- [ ] Orgs can save, dismiss, or mark matches as "applying"
- [ ] Foundations can search org_profiles that match their program criteria (reverse matching)

#### B3. Org Registration UI

**What:** Simple multi-step registration flow for community orgs.

**Pages:**
1. `/register` — Enter ABN or start without one
2. `/register/profile` — Mission, focus areas, beneficiaries, geographic scope
3. `/register/capacity` — Org size, staff, grant readiness checklist
4. `/register/preferences` — Grant size range, partnership preferences
5. `/dashboard` — Your matches, saved grants, application status

**Design principles:**
- Mobile-first (many community org workers are phone-primary)
- Plain language (no jargon, no "DGR status" — say "Can donors claim tax deductions for gifts to your org?")
- Supportive (pre-fill from ACNC, show progress, celebrate completion)
- Fast (4 steps, under 5 minutes)

**Acceptance criteria:**
- [ ] Registration flow works end-to-end
- [ ] ABN lookup auto-fills ACNC data
- [ ] Profile page shows matched grants within 24h of registration
- [ ] Dashboard shows match status, saved grants, deadlines

---

### Track C: Corporate Transparency Layer (Weeks 3-5)

Trace the money. This is what makes GrantScope different from every other grants database.

#### C1. Corporate Entities Table

**What:** Track the businesses behind the foundations — ASX200, major private companies, mining companies operating on traditional lands.

**Schema:** (full SQL in `thoughts/plans/data-model.md`)

**Initial data load:**
1. ASX200 companies (public data: market cap, revenue, profit, industry)
2. Link to existing foundations via ABN/name matching
3. AFR Philanthropy 50 list (already profiled as VIP foundations)
4. Forbes Top 50 Corporate Givers (already profiled)

**Acceptance criteria:**
- [ ] 200+ corporate entities loaded (ASX200)
- [ ] Each linked to their foundation entity where one exists
- [ ] Corporate detail page shows: revenue, profit, giving amount, giving as % of profit
- [ ] Foundation pages show their corporate parent where applicable

#### C2. Wealth Flows (Evolution of money_flows)

**What:** Complete picture of how money moves: extraction → corporate profit → foundation → community.

**Schema:** (full SQL in `thoughts/plans/data-model.md`)

**Why this matters:**
- "BHP makes $13B profit from mining on Yawuru country → gives $195M through BHP Foundation → how much reaches Yawuru community?"
- "What % of Fortescue's profit flows back to Pilbara communities vs offshore shareholders?"
- "Show me every dollar flowing from mining in the NT to community programs"

**Data sources:**
- ACNC AIS: `grants_donations_au` + `grants_donations_intl` for charitable giving
- ASX annual reports: revenue, profit, community investment
- Foundation annual reports: grants made (from enrichment)
- Government budget papers: appropriations by program

**Acceptance criteria:**
- [ ] `wealth_flows` table created
- [ ] Migration of existing 406 `money_flows` rows into new schema
- [ ] 500+ flows loaded (corporate → foundation → community chain for top 20 foundations)
- [ ] Visualization: Sankey diagram showing money flow from source to community
- [ ] API: `/api/wealth-flows?source=BHP` returns the full chain

---

### Track D: Missing Government Sources (Weeks 2-4)

#### D1. South Australia
- **Source:** grants.sa.gov.au
- **Method:** Cheerio scrape or CKAN API if available
- **Expected:** 50-100 grants

#### D2. Western Australia
- **Source:** wa.gov.au/grants + Lotterywest (huge — $100M+/year)
- **Method:** Cheerio + possible Firecrawl for Lotterywest SPA
- **Expected:** 100-200 grants

#### D3. Fix VIC + NT
- VIC currently has 3 grants (CKAN data may be stale — try Firecrawl for vic.gov.au/grants)
- NT has 0 despite GrantsNT portal existing
- **Method:** Playwright/Firecrawl for JS-rendered SPAs

**Acceptance criteria:**
- [ ] SA plugin: 30+ grants imported
- [ ] WA plugin: 50+ grants imported (including Lotterywest)
- [ ] VIC: 20+ grants (up from 3)
- [ ] NT: 15+ grants (up from 0)
- [ ] Total open grants: 500+ (up from ~130 GrantConnect)

---

## Non-Goals (Phase 2)

- **User authentication** — Org profiles use `claimed_by` text field. Full Supabase Auth in Phase 3.
- **Payment/subscription** — Free. Monetization is Phase 4+.
- **Email notifications** — "3 new grants match your org" digest is Phase 3.
- **360Giving open data standard** — Publishing API is Phase 4.
- **International funders** — Gates, UNESCO, GEF are Phase 3.
- **Full government spending mapping** — Budget appropriations are Phase 4.
- **Mobile app** — Responsive web only. Native app is Phase 5+.

---

## Technical Architecture

### Database Changes

```sql
-- Track A3: Link grants to foundations
ALTER TABLE grant_opportunities
  ADD COLUMN IF NOT EXISTS foundation_id UUID REFERENCES foundations(id);

-- Track B1: Org profiles
CREATE TABLE org_profiles ( ... );  -- See data-model.md

-- Track B2: Matching
CREATE TABLE matches ( ... );  -- See data-model.md

-- Track C1: Corporate entities
CREATE TABLE corporate_entities ( ... );  -- See data-model.md

-- Track C2: Wealth flows
CREATE TABLE wealth_flows ( ... );  -- See data-model.md
```

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/org-profiles` | POST | Create org profile |
| `/api/org-profiles/[id]` | GET, PATCH | Read/update profile |
| `/api/org-profiles/[id]/matches` | GET | Get matches for an org |
| `/api/org-profiles/lookup-abn` | GET | ACNC auto-populate |
| `/api/matching/run` | POST | Trigger matching (cron or manual) |
| `/api/wealth-flows` | GET | Query wealth flows |
| `/api/corporate/[id]` | GET | Corporate entity detail |

### New Pages

| Page | Purpose |
|------|---------|
| `/register` | Org registration start |
| `/register/profile` | Mission, focus areas |
| `/register/capacity` | Org size, readiness |
| `/register/preferences` | Grant preferences |
| `/dashboard` | Org dashboard with matches |
| `/corporate/[id]` | Corporate entity detail (exists as directory, needs detail page) |
| `/flows` | Wealth flow visualization (Sankey) |

### New Scripts

| Script | Purpose | Schedule |
|--------|---------|----------|
| `scripts/enrich-grants-free.mjs` | Cheerio + Groq enrichment | Daily (14k/day limit) |
| `scripts/sync-foundation-programs.mjs` | Foundation programs → grants | Daily |
| `scripts/run-matching.mjs` | Nightly matching engine | Daily 2am AEST |
| `scripts/import-asx200.mjs` | Load ASX200 corporate data | Weekly |
| `scripts/build-wealth-flows.mjs` | Build flow chains | Weekly |

### New Grant Engine Modules

| Module | Purpose |
|--------|---------|
| `src/enrichment-free.ts` | Groq-based enrichment (free tier) |
| `src/matching/engine.ts` | Core matching algorithm |
| `src/matching/scorer.ts` | Multi-factor scoring (semantic + geo + size + eligibility) |
| `src/corporate/importer.ts` | ASX200 data import |
| `src/corporate/flow-builder.ts` | Wealth flow chain construction |

---

## Success Metrics

### Data coverage (end of Phase 2)
- Open grants: 500+ (from ~130 GrantConnect)
- Foundation enrichment: 50%+ (from 16.5%)
- Grant descriptions: 80%+ have 200+ chars (from 53%)
- States covered: 8/8 (from 5-6)

### Matching (end of Phase 2)
- Org profiles created: 50+ (seed with community_orgs data)
- Average matches per org: 15+
- Foundation programs in search: 866 (from 0)

### Transparency (end of Phase 2)
- Corporate entities: 200+
- Wealth flows: 500+ (from 406)
- Corporate → Foundation links: 50+

---

## Execution Order

**Week 1:** A1 (foundation enrichment — just run the existing profiler) + A2 (build Groq enrichment pipeline)
**Week 2:** A3 (unify foundation programs) + D1-D3 (new government sources) + B1 (org_profiles table + API)
**Week 3:** B2 (matching engine) + C1 (corporate entities) + A2 continues (enriching 14k grants takes days)
**Week 4:** B3 (registration UI) + C2 (wealth flows) + B2 testing
**Week 5:** Polish, flows visualization, dashboard, end-to-end testing

Tracks A and D are parallelizable with B and C. A1 can literally start right now — it's just running an existing script.

---

## References

- **Data model:** `thoughts/plans/data-model.md`
- **360Giving vision:** `thoughts/plans/360giving-australia.md`
- **Foundation profiler:** `packages/grant-engine/src/foundations/foundation-profiler.ts`
- **Enrichment (Anthropic):** `packages/grant-engine/src/enrichment.ts`
- **Embeddings:** `packages/grant-engine/src/embeddings.ts`
- **Grant engine:** `packages/grant-engine/src/engine.ts`
