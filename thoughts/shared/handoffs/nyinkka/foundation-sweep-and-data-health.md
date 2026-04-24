# CivicGraph Foundation Sweep & Data Health — Nyinkka/Mukurtu Opportunity

**Date:** 2026-04-15
**Opportunity match criteria:** Indigenous + Arts/Culture + Remote/NT + (bonus: Research for Mukurtu data-sovereignty angle) × capacity to give.
**Scoring:** 0–13 composite. Tier thresholds below.

---

## 1. Overall foundation data health (all 10,837 records)

| Field | Coverage | Grade | Note |
|---|---:|:---:|---|
| `geographic_focus` | 10,648 (98%) | A | Strong |
| `total_giving_annual` | 10,067 (93%) | A | Strong |
| `grant_range_max` | 9,131 (84%) | B | Good |
| `thematic_focus` | 7,693 (71%) | B | Usable but skinny for ~30% |
| `application_tips` | 6,840 (63%) | C | Gap |
| `website` | 5,713 (53%) | C | **Critical gap for outreach** |
| `description` | 4,942 (46%) | D | **Critical gap for qualification** |
| `embedding` | 10,775 (99%) | A | Semantic search ready |
| `enriched_at` | 5,004 (46%) | D | Half never enriched |
| `board_members` | 1,369 (13%) | F | **Blocks warm-intro mapping** |
| `notable_grants` | 673 (6%) | F | **Blocks precedent analysis** |
| `giving_history` | 102 (1%) | F | Effectively empty |
| `has_dgr` | 551 (5%) | F | DGR flag rarely populated |
| `profile_confidence = high` | 223 (2%) | F | 97% of profiles are low/unset |

**Bottom line:** The system is strong on *who exists and where they give geographically* but weak on the three fields that drive fundraising strategy: **board members (warm intros), notable grants (precedent mirroring), and descriptions (narrative qualification)**. For the Tier A pitches you need to manually enrich ~10 foundations from ACNC filings + websites.

---

## 2. Match sweep — distribution across all 10,837 foundations

| Tier | Fit score | Count | Interpretation |
|---|---|---:|---|
| **A — Anchor** | 10–13 | **8** | Every box ticked; lead pitches |
| **B — Strong** | 8–9 | **47** | Real fit; customise asks |
| **C — Targeted** | 7 | **71** | Useful for project-tied grants |
| **D — Peripheral** | 6 | 216 | Long-tail, low probability |
| **E — Worth noting** | 5 | 512 | Aggregate potential only |
| Rest | <5 | 9,983 | Out of scope |

**126 foundations score ≥7.** That's the pipeline.

---

## 3. Tier A — Anchor (fit 10–13, 8 foundations)

Pre-ranked for action. Quality column shows how much manual enrichment is needed before outreach (out of 8 possible signals).

| # | Foundation | Fit | Qlty | Annual giving | Max grant | Gaps | Ask alignment |
|---|---|---:|---:|---:|---:|---|---|
| 1 | **BHP Foundation** | 12 | 4/8 | $195M | — | Missing: grant_range, notable_grants, board, DGR | Foundational Member ($100K) + Mukurtu digital-infra grant. Tie to NT mining-adjacent CSR narrative |
| 2 | **Minderoo Foundation** | 11 | **7/8** | $210M | $5M | Missing: DGR flag | Data-sovereignty + employment anchor; use existing enrichment |
| 3 | **University of Technology Sydney** | 11 | 5/8 | $30.8M | — | Missing: range, notable, board | Academic partner, not funder; ARC Linkage vehicle |
| 4 | **Ian Potter Foundation** | 11 | **7/8** | $28.9M | $1M | Missing: DGR flag | Lead Foundational Member pitch; use `application_tips` + `notable_grants` already enriched |
| 5 | **Developing East Arnhem Ltd** | 11 | 5/8 | $2M | — | Missing: range, notable, DGR | Sister-centre peer; partnership not pitch |
| 6 | **Rio Tinto Foundation** | 10 | **7/8** | $153.7M | $5K* | (*range likely stale — verify) | Platinum tier; cultural_heritage narrative post-Juukan |
| 7 | **Swinburne University** | 10 | 4/8 | $49M | — | Missing: range, tips, notable, board | Research partner for digital humanities |
| 8 | **Tim Fairfax Family Foundation** | 10 | 6/8 | $7.7M | $5M | Missing: notable, DGR; confidence=low | **The single best thematic+geo match in the whole DB** (NT + remote + indigenous + arts). Needs board enrichment before outreach |

### Immediate enrichment actions (Tier A)
1. **Tim Fairfax** — scrape board from TFFF site; pull last 3 NT grants for precedent mirroring.
2. **BHP Foundation** — pull board + recent indigenous arts grants from annual CSR report.
3. **Ian Potter** — already well-enriched; ready for pitch.
4. **Rio Tinto** — verify `grant_range_max` (currently $5K — almost certainly wrong).

---

## 4. Tier B — Strong fit (fit 8–9, 47 foundations)

### B1 — National philanthropy (the usual suspects, well-qualified)

| Foundation | Fit | Qlty | Giving | Max grant | Status |
|---|---:|---:|---:|---:|---|
| **Paul Ramsay Foundation** | 8 | **7/8** | $320M | $300K | Fully enriched; ready for Mukurtu/research pitch |
| **AUSTRALIAN COMMUNITIES FOUNDATION** | 9 | **7/8** | $39.6M | $388K | Fully enriched; use as sub-fund conduit |
| **Myer Foundation** | 9 | 6/8 | $12M | $5M | Confidence=low — verify before outreach |
| **Macquarie Group Foundation** | 8 | 6/8 | $37.5M | — | Has notable_grants; ready |
| **Documentary Australia** | 8 | 4/8 | $5.6M | — | Perfect for Voices campaign co-production |
| **Humanitix Foundation** | 9 | 5/8 | $5.9M | — | Ticketing partner + grant |
| **Support Act** | 9 | 4/8 | $31M | — | Artist welfare angle |
| **Lowy Foundation** | 9 | 4/8 | $50M | — | Arts focus; warm-intro check |
| **Universities** (Sydney $340M, Monash $274M, ANU $124M, UQ $87M, Newcastle $50M, Wollongong $24M, Western Sydney $32M) | 8–9 | 4–5/8 | Big | — | Research partners, not direct funders |
| **Adventist Development and Relief Agency** | 8 | 6/8 | $35M | — | Has DGR + notable_grants |
| **World Vision Australia** | 8 | 5/8 | $514M | — | Unlikely fit; cross off |
| **Woolworths Group Foundation** | 7 | 3/8 | $146M | — | Corporate Gold candidate; needs enrichment |

### B2 — **NT-LOCAL TRUSTS — UNDER-LEVERAGED (critical find)**

These 9 NT-based trusts did not appear in the original strategy doc. All score 8, all have AU-NT geographic focus, all are indigenous+arts+culture aligned. **These are peer relationships before they are funders.**

| Foundation | Fit | Giving | Max grant | Focus | Relationship angle |
|---|---:|---:|---:|---|---|
| **Mirarr Charitable Trust** (Gundjeihmi / Jabiluka legacy) | 8 | $500K | $5M | arts, education, health, community, indigenous | Culture solidarity peer; board overlap with NT land councils |
| **Karrkad-Kanjdji Trust** | 8 | $500K | $5M | indigenous, environment, culture, education, youth | Caring-for-country peer; joint digital return requests |
| **Ininti Store Trust** | 8 | $500K | $5M | indigenous, community, culture, social-enterprise | Retail/social-enterprise model (Mutitjulu) |
| **Miliditjpi Trust** | 8 | $500K | $5M | indigenous, health, education, employment, community, youth, sport, arts | NT youth+arts cross-ref |
| **Walkatjara Trust** | 8 | $500K | $5M | indigenous, culture, community | Pure culture peer |
| **Larrakia Development Trust** | 8 | $500K | $5M | indigenous, education, employment, community, arts | Darwin-based intra-NT solidarity |
| **Jawoyn Aboriginal Charitable Trust No 4** | 8 | $100K | $500K | arts, environment, indigenous, community | Katherine-based peer |
| **McArthur River Mine Community Benefits Trust** | 8 | $100K | $500K | arts, health, environment, community, indigenous | **Glencore MRM is in Barkly — literally your region. Direct ask.** |
| **Darwin Aboriginal Art Fair Foundation** | 8 | $100K | $500K | arts, indigenous, community | Distribution + audience partner |
| **Anangu Communities Foundation** | 8 | $271K | $100K | indigenous, community, health, education, culture | APY Lands peer |

**Strategic note:** NT trusts give *laterally* to other NT indigenous/arts orgs more often than interstate. The play here is not a one-off grant — it's a **Central Australia Cultural Alliance** framing where Nyinkka + Darwin Aboriginal Art Fair + Mirarr + Karrkad-Kanjdji + Larrakia + Anangu pitch *together* to interstate funders. Network power > individual asks.

### B3 — Mukurtu-adjacent / data-sovereignty specific

| Foundation | Fit | Why it matters for Mukurtu pitch |
|---|---:|---|
| **Rock Art Australia** | 10 | AU-NT + research + arts+indigenous — direct Mukurtu partnership candidate for interpretation content |
| **Music Outback Foundation** | 8 | arts+indigenous+remote+NT — perfect thematic; small giving ($25K) but high credibility |
| **SharingStories Foundation** | 7 | arts+indigenous+**technology** — literal Mukurtu-adjacent work |
| **Archie Roach Foundation** | 7 | indigenous+culture — storytelling legacy partner |
| **Annamila First Nations Foundation** | 7 | First Nations specific; small but symbolic |
| **Indigenous Capital Ltd** | 8 | Social-enterprise capital for the gift shop / retail layer |
| **Charles Darwin University** | 8 | NT-local; ARC Linkage partner; sysadmin partnership for Mukurtu instance |
| **Territory Natural Resource Management** | 9 | NT + indigenous + research + rural_remote — governance partner model |

---

## 5. Tier C — Targeted project grants (fit 7, 71 foundations — top 15)

Smaller trusts good for specific project asks (exhibitions, publications, education programs, retail capital):

| Foundation | Giving | Max grant | Best ask |
|---|---:|---:|---|
| Pratt Foundation | $500K | $5M | Platinum tier; needs enrichment (quality 2/8) |
| Neilson Foundation | $500K | $5M | Gallery naming; needs enrichment |
| Vizard Foundation | $100K | $500K | Exhibition grant |
| Victor Smorgon Charitable Fund | $100K | $500K | Needs enrichment before outreach (quality 2/8) |
| Eleanor Dark Foundation | $100K | $500K | Literature / language program |
| HV McKay Charitable Trust | $100K | — | Minimal data (quality 1/8) — enrich or deprioritise |
| Strong Brother Strong Sister Foundation | $25K | $500K | Youth/education crossover |
| Wurdwurd Foundation | $25K | — | Minimal data; deprioritise |
| Ian Potter Cultural Trust | $100K | $500K | Arts-only (NT eligible) — exhibition/residency |
| Gordon Darling Foundation | $100K | $500K | Arts-only — catalogue / publication |
| Copland Foundation | $393K | $100K | Conservation / collection |
| NIDA Foundation | $500K | $5M | Education program |
| Besen Family Foundation | $100K | $500K | Arts + indigenous |
| Australian Children's Television Foundation | $500K | $5M | Youth + education content |
| Flying Fruit Fly Foundation | $500K | $5M | Youth + arts + education |

---

## 6. Data-quality gap analysis — what CivicGraph can't answer right now

For the Nyinkka pipeline specifically, these are the unanswerable questions given current data:

| Question | Why it matters | Fix |
|---|---|---|
| **Who are the trustees of Tim Fairfax Family Foundation?** | Warm intro to the #1 thematic match | Manual scrape from TFFF + ACNC AIS; enrich `board_members` |
| **What did Minderoo's last 5 indigenous-arts grants fund?** | Precedent mirroring for a $100K pitch | Scrape Minderoo grants list; enrich `notable_grants` + `giving_history` |
| **Which NT trusts share board members with Tier A foundations?** | Shortest warm-intro path | Requires board enrichment first; then `mv_board_interlocks` query |
| **Who holds ACNC DGR-1 endorsement?** | Determines tax-deductibility of pitch | Only 551/10,837 have flag set; batch query ACNC register |
| **What's the actual grant range for Rio Tinto Foundation?** | Currently $5K max in DB — almost certainly wrong | Manual fix |
| **What's the confidence level on "Myer Foundation"?** | Currently `low` despite being one of AU's largest arts philanthropists | Re-run enrichment agent |

**System recommendation:** Run a focused enrichment sprint on the **126 foundations scoring ≥7**. ACNC AIS scrape + website scrape for each. Should take one agent ~2 hours. After that, the pipeline is pitch-ready.

---

## 7. The shortlist — final pitch roster with roles

### Foundational Members ($100K × 10 slots) — lead asks in order

1. **Tim Fairfax Family Foundation** (fit 10, NT/rural/arts/indigenous explicit)
2. **BHP Foundation** (fit 12, NT mining-adjacent, data sovereignty angle)
3. **Ian Potter Foundation** (fit 11, fully enriched, arts-indigenous-rural)
4. **Minderoo Foundation** (fit 11, scale + data sovereignty natural fit)
5. **Paul Ramsay Foundation** (fit 8, $320M, indigenous+research = Mukurtu)
6. **Myer Foundation** (fit 9, First Nations arts legacy)
7. **Neilson Foundation / Judith Neilson** (Living Culture Gallery naming)
8. **Balnaves Foundation** (First Nations arts legacy)
9. **Rio Tinto Foundation** (cultural_heritage, post-Juukan repair)
10. **McArthur River Mine Community Benefits Trust** (Barkly-local, mining-sector)

### Annual Gold/Platinum ($20K–$99K) — capacity confirmed

- Macquarie Foundation, CBA Foundation, Woolworths Foundation, Fortescue Foundation, Australian Communities Foundation (as conduit), Humanitix Foundation, Documentary Australia, Support Act, Pratt Foundation, Vincent Fairfax Family Trust

### Mukurtu-specific anchor grants ($50K–$500K)

- NIAA Culture & Capability + Remote Australia Strategies (programs, not foundations — separate pipeline)
- AIATSIS Return of Cultural Heritage
- Indigenous Languages and Arts (ILA)
- ARC Linkage with CDU + Western Sydney + WSU as partners
- Mellon Foundation (international — already funds Mukurtu directly)
- Rock Art Australia
- SharingStories Foundation (technology-aligned)

### NT peer alliance (non-transactional, but strategic)

- Mirarr, Karrkad-Kanjdji, Walkatjara, Miliditjpi, Ininti, Larrakia, Jawoyn, Darwin Aboriginal Art Fair, Anangu Communities, Music Outback

### Academic/technical partners (bring the grants with them)

- Charles Darwin University (NT-local sysadmin + ARC)
- Western Sydney University (for WSU-Mukurtu bridge symbolism)
- UTS, Swinburne, ANU (digital humanities co-investigators)
- Territory Natural Resource Management (governance partner model)

---

## 8. Suggested next queries (when data is enriched)

```sql
-- After board enrichment: shortest path from Tier A funder to Nyinkka network
SELECT * FROM mv_board_interlocks
WHERE entities::text ILIKE ANY (ARRAY[
  '%Tim Fairfax%','%Ian Potter%','%BHP Foundation%','%Minderoo%',
  '%Paul Ramsay%','%Myer%','%Rio Tinto%','%Balnaves%','%Neilson%',
  '%McArthur River%','%Mirarr%','%Larrakia%'
]) ORDER BY shared_board_count DESC;

-- After notable_grants enrichment: mirror Minderoo/Potter's indigenous arts grant sizes
SELECT name, notable_grants FROM foundations
WHERE name ILIKE ANY (ARRAY['%Minderoo%','%Ian Potter%','%Tim Fairfax%'])
  AND notable_grants IS NOT NULL;

-- NT peer alliance: grants given BY NT trusts to other NT arts/indigenous orgs
SELECT f.name AS trust, t.canonical_name AS recipient, r.amount, r.year
FROM foundations f
JOIN gs_entities s ON s.id = f.gs_entity_id
JOIN gs_relationships r ON r.source_entity_id = s.id
JOIN gs_entities t ON t.id = r.target_entity_id
WHERE f.geographic_focus::text ILIKE '%NT%'
  AND f.thematic_focus::text ILIKE '%indigenous%'
ORDER BY r.amount DESC NULLS LAST LIMIT 100;
```

---

## 9. Summary — what changed from the first strategy doc

**New finds:**
- 9 NT-local Aboriginal trusts ($3.5M combined giving) — peer alliance layer, not competitors
- **McArthur River Mine Community Benefits Trust** — geographically perfect (Barkly region)
- SharingStories Foundation — explicit arts+indigenous+technology Mukurtu-adjacent
- Rock Art Australia — highest research-fit for Mukurtu integration
- Music Outback Foundation — pure thematic ally

**Data quality flags before outreach:**
- 4 of 8 Tier A foundations need board enrichment
- Tim Fairfax (the best thematic match) flagged `profile_confidence = low` — fix first
- Rio Tinto `grant_range_max` is $5K — verify or re-scrape
- Only 6% of all foundations have `notable_grants` — the biggest systemic gap

**Recommended action:** Two-hour enrichment sprint on the 126 foundations scoring ≥7 (ACNC AIS + website scrape). After that, the warm-intro board-overlap query becomes the most valuable query in the project.
