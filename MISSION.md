# GrantScope — Mission & Focus Compendium

## Mission

Build the most comprehensive searchable map of Australian organisations, money, ownership, grants, contracts, place, and community-defined impact — then use that visibility to help communities negotiate for a fairer share of power and capital.

**An always-on Australian ledger of money, power, place, and community voice.**

## North Star Metrics

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Entities resolved | 93,037 | 150K+ | ASIC companies (2.1M raw → ~50K high-value) |
| Relationships mapped | 66,053 | 200K+ | Need ASIC directors, Supply Nation, grant recipients |
| Entity match F1 | **94.1%** | 90%+ | **TARGET MET** — evaluator fix + name normalization (was 76.9%) |
| Geographic coverage | **96% postcode, 96% remoteness, 95% LGA, 94% SEIFA** | 97%+ | ABR bulk extract filled 16K entities; ~3K remain (no postcode) |
| Community-controlled tagged | 7,822 | 10K+ | Supply Nation + self-declared still missing |
| Entity descriptions | **83,367 (89.6%)** | 80%+ | **TARGET MET** — All types 100% except foundations (11%, LLM enriching 9.6K remaining) |
| JH↔GS linkage | 315/556 (57%) | 90%+ | 241 orgs without ABN — need manual or fuzzy match |
| Revenue (MRR) | $0 | $5K | Product exists but no launch, no users yet |

## The 7 Core Objects

1. **Entity** — businesses, charities, Indigenous corps, social enterprises, government
2. **Person** — directors, responsible people, key personnel
3. **Transaction** — grants, contracts, donations, procurements, sponsorships
4. **Program** — grant programs, procurement categories, service types
5. **Place** — nation → state → LGA → postcode → suburb → electorate
6. **Document** — PDFs, reports, statements, evidence
7. **Story** — community voice, lived experience, priorities, outcomes

## The 4 Truth Layers

1. **Raw record** — exactly what the source published
2. **Resolved entity** — best canonical representation (gs_entities)
3. **Relationship** — donated to, contracted by, funded by, directs, operates in
4. **Community** — local voice, priorities, lived experience, community-defined outcomes

## Phase Status

| Phase | Status | What |
|-------|--------|------|
| 1. Central auditable core | **DONE** | Entity graph, search, place pages, entity dossiers, gap packs, premium gating |
| 1b. Cross-system integration | **DONE** | JH↔GS entity bridge (57%), ALMA evidence on dossiers, EL stories on place pages, LGA enrichment |
| 2. Data coverage expansion | **IN PROGRESS** | ABN enrichment (GUID pending), ASIC, Supply Nation, LGA (78%), remoteness (79%) |
| 3. Open contribution layer | PENDING | User corrections, community stories, local context |
| 4. Benchmarked intelligence | PENDING | Open tasks, competitions, decentralised compute |
| 5. Community governance | PENDING | Cooperative governance, community treasury |

## Data Sources

| Source | Status | Records | Freshness |
|--------|--------|---------|-----------|
| ACNC Charities | Live | 66K | Daily sync |
| ORIC Corporations | Live | 7.3K | Daily sync |
| AusTender Contracts | Live | 670K | Daily sync |
| AEC Political Donations | Live | 313K | On-demand |
| ATO Tax Transparency | Live | 24K | Annual |
| ASX Companies | Live | ~2K | Daily sync |
| Justice Funding (QGIP) | Live | 52K | Manual import |
| Foundations | Live | 10.8K | Enrichment pipeline |
| Grant Opportunities | Live | 18K | Discovery pipeline |
| SEIFA 2021 | Static | 11K postcodes | ABS release cycle |
| Postcode Geo + LGA | Static | 12K postcodes | ABS release cycle |
| ABR/ABN Lookup | **WAITING** | — | GUID pending (ref ABNL26131) |
| ASIC Company Extracts | PLANNED | 2.1M raw | $10-23/extract |
| Supply Nation | PLANNED | ~3K | Scrape or API TBD |

## Revenue Model

- **Free public layer** — search, place pages, entity pages, core evidence
- **Paid professional layer** — alerts, API, bulk exports, due diligence, benchmarking
- **5 tiers** — Community (free), Professional ($79), Organisation ($249), Funder ($499), Enterprise ($1999)
- **Cross-subsidy** — institutions pay, communities get free access

## First Killer Chain

QLD justice funding → all recipients → all orgs → all places → all linked charities/businesses/ORIC corps → all community stories → all visible gaps

Then expand: housing, youth, family violence, community services, Indigenous procurement, philanthropy, local government.

## What Matters Now (Priority Stack)

1. **Launch to first users** — the product exists, no one is using it yet. This is the #1 priority.
2. ~~**Get to 97% geographic coverage**~~ — **DONE (96%)** via ABR bulk extract. 89,709/93,037 entities have postcodes. Remaining ~3K have no ABN or invalid data.
3. ~~**Entity description enrichment**~~ — **DONE (88.2%)** via ACNC templates (52K charities), ABR templates (21K companies), ORIC templates (7.3K indigenous corps), AEC (66 parties), gov (91 bodies). Remaining: foundations 11% (LLM enriching).
4. ~~**Improve entity match precision**~~ — **DONE (F1 94.1%)** via evaluator fix. Precision 99.9%, recall 89.0%. Was 76.9%.
5. **ASIC selective enrichment** — directors + subsidiaries for high-value entities ($10-23/extract)
6. **Supply Nation integration** — verified Indigenous businesses complete the community-controlled picture (7,822 → 10K+)

## Ecosystem Integration (GS + JH + EL)

Three systems share one Supabase (GS + JH) with EL syncing in:

| System | Purpose | Key Metric |
|--------|---------|------------|
| **GrantScope** | Funding intelligence | 93K entities, 66K relationships |
| **JusticeHub** | Justice evidence | 556 orgs, 1.1K interventions, 570 evidence |
| **Empathy Ledger** | Community voice | 226 storytellers, 9 stories |

**Bridge:** ABN is the universal join key. 315 JH orgs linked to GS entities (57%). 0 linkable by ABN remain — remaining 241 need fuzzy/manual match.

**Cross-system features (LIVE):**
- GS entity dossier shows JusticeHub link + ALMA interventions/evidence
- GS place pages show Empathy Ledger community voices
- JH org pages show GS enrichment (SEIFA, remoteness, LGA, revenue)
- `build-entity-graph.mjs` auto-ingests JH orgs and links back

**Ownership:** GS owns entity resolution + geographic enrichment. JH owns justice evidence + interventions. EL owns community voice + consent.

**Check health:** `node --env-file=.env scripts/health-check.mjs` (includes `--ecosystem` section)

**Full alignment doc:** `thoughts/shared/cross-system-alignment.md`

## What Does NOT Matter Now

- Community governance (Phase 5)
- Decentralised compute (Phase 4)
- Perfect data coverage (80% is useful, 100% is a trap)
- More data sources before validating with real users
