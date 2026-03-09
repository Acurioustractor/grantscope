# GrantScope — Mission & Focus Compendium

## Mission

Build the most comprehensive searchable map of Australian organisations, money, ownership, grants, contracts, place, and community-defined impact — then use that visibility to help communities negotiate for a fairer share of power and capital.

**An always-on Australian ledger of money, power, place, and community voice.**

## North Star Metrics

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Entities resolved | 92,991 | 150K+ | ASIC companies (2.1M raw → ~50K high-value) |
| Relationships mapped | 66,053 | 200K+ | Need ASIC directors, Supply Nation, grant recipients |
| Entity match F1 | 76.9% | 90%+ | Precision low (68.3%) — too many false positives |
| Geographic coverage | 79% remoteness, 78% LGA | 97%+ | ABN Lookup GUID pending (16,742 entities) |
| Community-controlled tagged | 7,822 | 10K+ | Supply Nation + self-declared still missing |
| Foundation descriptions | ~3K enriched | 9.8K | Batch enrichment ready, needs quality benchmark |
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
| 2. Data coverage expansion | **IN PROGRESS** | ABN enrichment, ASIC, Supply Nation, LGA mapping (done), remoteness (79%) |
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

1. **Get to 97% geographic coverage** — ABN Lookup GUID is the blocker
2. **Improve entity match precision** — F1 76.9% → 90%+ (false positives hurt trust)
3. **Foundation description enrichment** — 3,304 foundations with websites need descriptions
4. **Launch to first users** — the product exists, no one is using it yet
5. **ASIC selective enrichment** — directors + subsidiaries for high-value entities
6. **Supply Nation integration** — verified Indigenous businesses complete the picture

## Ecosystem Integration (GS + JH + EL)

Three systems share one Supabase (GS + JH) with EL syncing in:

| System | Purpose | Key Metric |
|--------|---------|------------|
| **GrantScope** | Funding intelligence | 93K entities, 66K relationships |
| **JusticeHub** | Justice evidence | 556 orgs, 1.1K interventions, 570 evidence |
| **Empathy Ledger** | Community voice | 226 storytellers, 9 stories |

**Bridge:** ABN is the universal join key. 266 JH orgs linked to GS entities (48%). 49 more linkable.

**Ownership:** GS owns entity resolution + geographic enrichment. JH owns justice evidence + interventions. EL owns community voice + consent.

**Check health:** `node --env-file=.env scripts/health-check.mjs` (includes `--ecosystem` section)

**Full alignment doc:** `thoughts/shared/cross-system-alignment.md`

## What Does NOT Matter Now

- Community governance (Phase 5)
- Decentralised compute (Phase 4)
- Perfect data coverage (80% is useful, 100% is a trap)
- More data sources before validating with real users
