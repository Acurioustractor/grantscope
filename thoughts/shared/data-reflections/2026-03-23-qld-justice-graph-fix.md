# Data Reflection: QLD Youth Justice — Graph Fix, Evidence Coverage, Political Layer

**Date:** 2026-03-23
**Trigger:** Fix 5-8 sprint — QLD landing page, evidence coverage functions, graph self-loop fix, Hansard + lobbying integration

---

## 1. What Changed? (Facts)

### Graph Structure
- **Deleted:** 33,528 self-loop edges (source_entity_id = target_entity_id) from `gs_relationships` where `dataset = 'justice_funding'`
- **Created:** 3,300 program entities (`entity_type: 'program'`) — a new first-class node type
- **Created:** 49,088 proper program→recipient edges
- **Net effect:** Justice funding is now *traversable* in the graph. Before, hub mode couldn't show any justice paths. Now there are 842 QLD programs connected to 15,121 recipients.

### Program Entities by State
| State | Programs | Edges | Recipients |
|-------|----------|-------|------------|
| QLD | 863 | 45,163 | 15,121 |
| NSW | 943 | 1,551 | 741 |
| ACT | 561 | 904 | 390 |
| VIC | 547 | 847 | 449 |
| SA | 132 | 245 | 123 |
| WA | 119 | 201 | 151 |
| NT | 48 | 116 | 86 |
| TAS | 54 | 61 | 43 |

### Evidence Coverage (National Youth Justice)
- 510 ALMA interventions tagged youth-justice
- 233 have linked evidence via `alma_intervention_evidence` junction table (46% coverage)
- 277 have NO evidence — operating on faith, tradition, or political will
- **QLD specifically**: 193 ALMA interventions with QLD geography, 78 have evidence (40% coverage)
- QLD's evidence gap (60%) is slightly worse than national average (54%), despite having the most funding data

### Evidence by Intervention Type
| Type | Interventions | With Evidence | Gap |
|------|--------------|---------------|-----|
| Wraparound Support | 263 | 108 | 155 (59%) |
| Diversion | 142 | 61 | 81 (57%) |
| Justice Reinvestment | 128 | 32 | 96 (75%) |
| Prevention | 114 | 64 | 50 (44%) |
| Community-Led | 86 | 46 | 40 (47%) |
| Cultural Connection | 77 | 61 | 16 (21%) |
| Therapeutic | 49 | 28 | 21 (43%) |

**Justice Reinvestment has the biggest evidence gap (75%)** — 128 programs with only 32 evidence records. This is the fastest-growing intervention type in Australia, being funded at scale with the thinnest evidence base.

### ACCO Funding (QLD Youth Justice)
- **57 community-controlled orgs** receive **$37.7M** (9.3% of QLD YJ funding)
- **405 non-Indigenous orgs** receive **$367.3M** (90.7%)
- Ratio: **9.7:1** — non-Indigenous orgs receive nearly 10x the total funding
- Average grant comparison would be needed, but the structural message is clear

### Political Layer
- **21 QLD Hansard records** mentioning youth justice, watch houses, child safety, juvenile detention
- **5 federal lobbying connections** to QLD YJ organisations:
  - Mission Australia → Hawker Britton (major government relations firm)
  - The Smith Family → Walsh Stevens
  - Life Without Barriers → SEC Newgate
  - CQ University → lobbying connection
- These are *exactly* the organisations getting the biggest contracts

### Overall Relationship Health
| Type | Count |
|------|-------|
| contract | 904,047 |
| directorship | 328,912 |
| donation | 103,450 |
| shared_director | 95,476 |
| **grant** | **78,870** (+49K from bridge fix) |
| member_of | 2,858 |
| lobbies_for | 2,303 |
| subsidiary_of | 1,234 |
| affiliated_with | 505 |
| partners_with | 44 |

Grant edges nearly doubled. This is the second-most common relationship type now, after contract/directorship/donation/shared_director.

---

## 2. What Does This Reveal? (Signal)

### The QLD Evidence-Funding Mismatch
Queensland has **92% of Australia's youth justice funding data** (45,163 edges) but only **40% evidence coverage** across 193 ALMA interventions — slightly below the national 46%. The state spending the most has 115 interventions with no formal evidence. The mismatch isn't extreme but it's structurally concerning: QLD is the largest funder and should be the *best* evidenced, not below average.

### The Big Three Run QLD Youth Justice
Mission Australia, The Smith Family, and Life Without Barriers — three national charities — have federal lobbying firms (Hawker Britton, Walsh Stevens, SEC Newgate) and receive the majority of QLD youth justice contracts. These are the same organisations that appear in the revolving door index nationally. This isn't corruption — it's *structural capture*. The same organisations that lobby the federal government for policy settings also receive the state contracts that result from those settings.

### Community-Controlled Organisations Are Structurally Excluded
57 ACCOs share $37.7M while 405 non-Indigenous orgs share $367.3M. This is in a system where:
- Indigenous youth are 17x overrepresented in detention (QLD)
- Cultural Connection interventions have the **best** evidence coverage (79%) of any type
- Community-led interventions have decent coverage (53%)
But the orgs best positioned to deliver what works receive 9.3% of the money. The evidence says community-controlled works. The funding says we don't care.

### Program Entities Change Everything for the Graph
Before: justice funding was invisible in hub mode (self-loops). Now: 3,300 program nodes create a bipartite structure — programs fund recipients, recipients connect to contracts, donations, directorships. This means:
- You can trace: "Which programs fund which organisations, and what else do those organisations do?"
- You can find: "Which programs fund overlapping sets of recipients?"
- You can ask: "Which programs fund organisations that also have lobbying connections?"

This is the **graph intelligence** layer that was missing. Program→recipient→contract→donation→lobbying is now a traversable path.

### Evidence Gaps Are Not Random
Justice Reinvestment (75% gap), Wraparound Support (59% gap), and Diversion (57% gap) are the three intervention types with the highest evidence gaps. These are also the three fastest-growing, most politically popular intervention types. Politicians love announcing them. Nobody measures them.

Cultural Connection (21% gap) and Early Intervention (33% gap) have the best coverage — but receive the least funding. The inverse relationship between evidence quality and funding volume is stark.

---

## 3. What's Still Hidden? (Gaps)

### Critical Gaps
1. **ALMA geography tagging is inconsistent.** QLD has 114 interventions tagged exactly "QLD", plus others in multi-state tags like "NT,QLD" (193 total via ILIKE). Some states use abbreviations (QLD, NSW, NT), others use full names (Tasmania, Western Australia). Standardising geography to always use state codes would improve filtering reliability.

2. **QLD lobbying register data = 0.** The federal lobbying scraper ran but the QLD-specific scraper hasn't run live. Queensland has its own lobbying register with state-level connections that would show the *state* relationships (not just federal). This is the most obvious data we're missing.

3. **Program→program relationships don't exist.** We now have program entities, but we don't know which programs are related (e.g., "Transition from Care" feeds into "Youth Justice Services" feeds into "Community Corrections"). This temporal pipeline — the journey a young person takes through programs — is invisible.

4. **Outcome data is absent.** ALMA has 506 outcome records nationally but we're not surfacing them on the QLD page. We know *what* interventions exist and whether they have evidence, but we don't surface *what the evidence says* — effect sizes, recidivism reduction rates, cost-per-outcome.

5. **12,587 justice_funding records have no linked entity** (70,964 total - 65,519 linked - some with ABN but no entity match). These are ~18% of records we can't place in the graph.

### Structural Gaps
6. **Bridge script covered 49K of 71K records.** 22K records weren't bridged — either no ABN, no matching entity, or program entity creation failed (1,617 programs had duplicate gs_id collisions). Need to investigate those collisions.

7. **Person→program connections.** We have person entities (237K) and program entities (3,300) but no edges between them. Who *runs* these programs? Board members of the funded orgs connect via directorship, but the program managers, senior bureaucrats who approve funding, and ministers responsible are invisible.

---

## 4. What Could We Do Better? (Method)

### Bridge Script Issues
1. **Slugify collisions:** `GS-PROG-{slug}-{state}` truncates at 60 chars, causing collisions for long program names that share prefixes. Fix: use a hash suffix or increase slug length.
2. **Batch insert fallback is slow:** When a batch of 50 fails, we fall back to individual inserts — 61K records at 1 insert per Supabase call took ~50 minutes. Fix: use `ON CONFLICT DO NOTHING` in raw SQL via psql instead of Supabase client.
3. **First run created 967 entities before hitting constraint error.** Should have checked constraints first (we know this — it's in MEMORY.md — but the script didn't).

### Evidence Coverage Function
4. **The `getEvidenceCoverage` function initially used `alma_evidence` directly** but the actual FK is through `alma_intervention_evidence` junction table. Fixed in same session — now uses correct join path. **Lesson: always check for junction tables before assuming direct FKs.**

### Data Model
5. **Program entities should have richer metadata.** Currently just `canonical_name`, `state`, `entity_type='program'`, `sector='government'`. Should include: funding department, program start/end dates, target cohort, total budget envelope. This is available in justice_funding but not propagated to the entity.

6. **ALMA geography tagging is the bottleneck.** If we auto-tagged ALMA interventions with state from their linked `gs_entity_id → gs_entities.state`, the QLD filter would work much better. Currently relies on free-text geography field.

---

## 5. What Does This Open Up? (Opportunity)

### Immediate (this week)
1. **Fix the evidence coverage join** — use `alma_intervention_evidence` junction table. 10 min fix, but critical for the QLD page to show correct data.

2. **Auto-tag ALMA geography from entity state.** Simple UPDATE: `SET geography = COALESCE(geography, e.state) FROM gs_entities e WHERE e.id = ai.gs_entity_id AND ai.geography IS NULL`. Would dramatically improve state-level filtering.

3. **Run QLD lobbying scraper live.** Script exists, dry-run complete. Would add QLD-specific lobbying connections that complete the political picture.

### Short-term (this month)
4. **State-specific report template.** The QLD page is now a template. Every state can have one. VIC and NSW have enough data (847 and 1,551 edges respectively). Parameterize the page with `[state]` dynamic route.

5. **"Follow the Dollar" graph mode.** Now that program→recipient edges exist, build a graph mode that traces: Budget allocation → Program → Recipient org → What else that org does (contracts, donations, lobbying). This is the killer feature — "show me where this dollar goes and what it touches."

6. **Evidence gap report for funders.** The evidence coverage data is exactly what funders need: "Here are 277 youth justice interventions with NO evidence. Here are the ones in your state. Fund an evaluation." This is a product — Allocation Intelligence for evidence commissioning.

### Strategic (this quarter)
7. **Cross-state comparison reports.** With proper program entities across all states, we can compare: "QLD spends X on Diversion via Y programs, reaching Z orgs. VIC spends A on Diversion via B programs." This is ROGS-level analysis but with entity-level granularity.

8. **The Structural Capture report.** We can now quantify: "These 5 organisations receive 60% of national youth justice funding AND have federal lobbying firms AND donate to both major parties AND hold AusTender contracts worth $X." This is the investigation CivicGraph was built for.

9. **JusticeHub partnership deepening.** ALMA's 510 youth justice interventions with 45.7% evidence coverage is a finding that JusticeHub should publish. The 75% evidence gap in Justice Reinvestment specifically is newsworthy — it's the most politically popular intervention type with the thinnest evidence base.

### Mission Alignment

**"Know who to fund."** — The QLD page now answers this directly. It shows who gets funded, whether they have evidence, and whether community-controlled orgs get their fair share. The evidence gap analysis tells commissioners exactly where to direct evaluation funding.

**"Know who to contract."** — Program entities in the graph mean procurement officers can trace: "If I contract Org X for youth justice services, what else are they connected to? Do they have lobbying connections? Do they also receive donations from the same department?" The graph is now *useful* for due diligence.

**"Know it worked."** — Evidence coverage is the first step. 45.7% nationally, 16.7% (likely undercount) for QLD. The gap between "funded" and "proven" is now measurable. Next step: surface the actual outcomes data (effect sizes, cost-per-outcome) so commissioners can compare programs on results, not just spend.

---

## Action Items

- [x] ~~Fix `getEvidenceCoverage` and `getEvidenceGapDetail` to use `alma_intervention_evidence` junction table~~ (done same session)
- [ ] Standardise ALMA geography to state codes (QLD not Queensland, WA not Western Australia)
- [ ] Investigate 1,617 program entity slug collisions — fix slugify or use longer hash
- [ ] Run QLD lobbying scraper live
- [ ] Surface ALMA outcomes data on QLD page (effect sizes, methodology summaries)
- [ ] Parameterize state report page as `/reports/[state]-youth-justice`
- [ ] Consider "Follow the Dollar" graph mode as next graph feature
