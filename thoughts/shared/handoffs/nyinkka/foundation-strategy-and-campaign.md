# Nyinkka Nyunyu — Foundation Strategy & "Voices from Country" Campaign

**Date:** 2026-04-15
**Context:** Reopening 28 April 2026. $10M NTG capital rebuild complete, no operational funding. Seeking 10× $100K Foundational Members + Friends of Nyinkka annual giving tiers. Warumungu-led, Tennant Creek.
**Sources:** CivicGraph `foundations` (10.8K rows), deep-research-report (marketing opportunity), Foundational Membership + Friends brochures.

---

## 1. Foundation Target Tiers (from CivicGraph)

Strategy: tiered outreach matched to each foundation's thematic fit × geographic focus × grant-size bands, plus the Nyinkka ask that actually matches their giving behaviour.

### Tier A — Anchor targets for $100K Foundational Membership (1–3 hits unlocks the ask)

These eight have all three signals: **arts/culture + Indigenous/First Nations + track record of 6–7 figure gifts to remote/NT arts institutions**.

| Foundation | Annual giving | Max grant | Why they fit | Specific Nyinkka ask |
|---|---:|---:|---|---|
| **Tim Fairfax Family Foundation** | $7.7M | $5M | Explicit geo: "queensland, northern-territory, rural, regional, remote" × arts + indigenous. Highest-fit single record in the DB. | Lead Foundational Member ($100K); multi-year operational + programming |
| **The Ian Potter Foundation** | $28.9M | $1M | Arts + indigenous + rural_remote, national. Known backer of regional cultural institutions. | Foundational Membership + 3yr "Truth-telling interpretation" grant |
| **The Myer Foundation / Sidney Myer Fund** | $12M / $9.9M | $5M | Arts + indigenous + social-justice. Legacy backer of First Nations arts. | Foundational Membership + ongoing Platinum ($50K+) |
| **Minderoo Foundation** | $210M | $5M | Indigenous + arts + rural. Heavy WA bias but NT aligns with Forrest family interest. | Foundational Membership (one slot) |
| **BHP Foundation** | $195M | — | Indigenous + arts + rural_remote; NT operational presence (McArthur River / Olympic Dam supply chain). | Corporate Foundational Member ($100K) tied to regional workforce story |
| **Balnaves Foundation** | $500K–$5M | $5M | Arts + indigenous, well-known for First Nations arts backing. | Foundational Member + annual Gold/Platinum |
| **Pratt Foundation** | $500K–$5M | $5M | Arts + indigenous + human rights. | Foundational Member pitch via Pratt family office |
| **Neilson Foundation / Judith Neilson Foundation** | $500K–$5M | $5M | Arts + indigenous + community. Judith Neilson personally backs cultural preservation. | Foundational Member + Living Culture Gallery naming |

### Tier B — Corporate & national foundations for Gold/Platinum annual tier ($20K–$99K)

| Foundation | Fit | Ask |
|---|---|---|
| **Rio Tinto Foundation** ($153M, cultural_heritage + indigenous) | NT/remote operational history, cultural-heritage explicit in brief. Post-Juukan, actively rebuilding cultural credibility. | Platinum ($50K) tied to truth-telling/cultural safety work |
| **Fortescue Foundation** ($54.9M) | Indigenous + community focus. | Gold ($20–49K) annual |
| **Macquarie Group Foundation** ($37.5M) | Arts + community + employment. | Gold; pair with staff volunteering |
| **CBA Foundation** ($56.7M) | Indigenous + community. | Gold; pair with Indigenous business banking narrative |
| **Woolworths Group Foundation** ($146.5M) | Indigenous + community + retail. | Gold; pair with café/retail supply chain |
| **Australian Communities Foundation** ($39.6M) | Indigenous + arts + community, national DGR host. | Use as a conduit for sub-funds / named donors |

### Tier C — NT-local and remote-specialist supporters ($1K–$20K Bronze/Silver)

| Foundation | Why |
|---|---|
| **Larrakia Development Trust** (NT, indigenous+arts) | Intra-NT solidarity ask; cross-Centre partnership framing |
| **Developing East Arnhem Ltd** (NT, indigenous+arts) | Sister art-centre model; potential cultural exchange |
| **Tiwi Land Council** (NT) | Peer-to-peer cultural centre relationship |
| **Walk a While Foundation** (NT, indigenous+arts+youth) | Schools program / youth education tie-in |
| **Somerville Community Services** (NT) | Community programming partnership |
| **Charles Darwin University** ($9.1M, NT, indigenous+research) | Research fellowship / student placement programs |
| **Rock Art Australia** (AU-NT, arts+indigenous+research) | Interpretation content partnership |
| **Humanitix Foundation** ($5.9M, arts+indigenous) | Ticketing partnership — get them to provide booking engine at zero cost AND donate processing margin |
| **Documentary Australia** ($5.6M, indigenous+arts) | Co-produce the storyteller film series (Empathy Ledger output) |
| **Support Act** ($31M, arts+indigenous) | Artist welfare / emergency relief for Warumungu artists |

### Tier D — Cultural-specific small grants (project-tied, not membership)

- **Ian Potter Cultural Trust** ($100K max, arts-only, national inc. NT) — exhibition fellowship
- **Gordon Darling Foundation** ($100K max, arts-only, national) — publication / catalogue grants
- **Copland Foundation** ($100K max, arts) — collection / conservation
- **Indigenous Capital Ltd** (indigenous+arts+social-enterprise) — retail / social-enterprise capital

### Tier E — Government-linked pipelines to run in parallel

- **Creative Australia** — First Nations Arts Business: Development Fund; Organisation Investment
- **IVAIS** (Indigenous Visual Arts Industry Support) — operational funding for art centres
- **Indigenous Languages and Arts** program — language-led interpretation
- **NT Arts Grants Program** + **NXT Gen ARTS** — staffing pipeline
- **ACF Boost 2026** — matched giving for a campaign (pair with EL storytelling below)

---

## 2. Relationship-Building Strategy (Humans, Not Applications)

Foundations fund people they trust, not forms they receive. The strategy is a **12-week warm-intro campaign** before any formal application.

### Week 1–3: Mapping & Warm Intros
1. **Run CivicGraph board-interlocks query on Tier A foundations** to identify shared directors between the eight target foundations and any existing Nyinkka / Julalikari / Barkly Regional Council / NT Govt relationships. Use `mv_board_interlocks` + `mv_person_influence` to surface the shortest path.
2. **Activate Warumungu cultural authority as the asker, not just the subject** — Elders and board members lead the meetings, flanked by operational lead. Foundations will fund community-led asks at 10× the rate of staff-led ones.
3. **Use Tourism NT / Barkly Regional Council networks** to get "permission to contact" from NT Govt officials who sit on or advise these boards (the $10M capital commitment is a trust signal — use it).

### Week 4–7: Curated Site Visits
4. **"Come to Country" weekend** — invite 2–3 program officers from Tier A foundations to a pre-reopening soft-launch (early April 2026). This is the single highest-leverage fundraising act available: program officers who visit remote art centres fund them at 3× the base rate. Fly them in on the TC schedule (Mon/Wed/Fri flights from Alice/Darwin).
5. **Pair site visits with other accountable stops** (Barkly Regional Council, Julalikari, local schools) so the foundations see an ecosystem, not a single org asking.

### Week 8–12: The Ask, With Specific Numbers
6. **Each Foundational Member pitch is customised to their giving history.** Pull their last 3 grants from CivicGraph `notable_grants` / `giving_history` JSONB and mirror structure/scale in the ask.
7. **Offer matched-giving framing** — "Your $100K + another member's $100K = we open the doors for 12 months with local staff employed." Concrete, time-bound, reversible-if-not-hit.
8. **Bequest pathway** for Tier A/B donors who won't do $100K now — Friends brochure already frames this; make sure the Elders' Circle benefits are real and culturally meaningful (not just transactional).

### Ongoing: Annual Rhythm
- Quarterly impact notes to all Friends tiers, culturally reviewed, with real storyteller consent (see EL integration below).
- Annual "Partners' Day on Country" at Nyinkka — single best retention lever.
- Digital donor board on the website (Donate page is the most mature asset — make it the conversion backbone).

---

## 3. "Voices from Country" — Human-Led Marketing Campaign

**Core insight from the deep research:** the demand is there (3.0M First Nations-activity trips/yr, 15% of NT domestic trips include First Nations experiences, international visitors specifically seek art/craft + cultural displays). The gap is **website conversion + authentic voice**, not awareness.

**Campaign thesis:** Nyinkka's competitive advantage is not "another outback stop" — it's **the first-person Warumungu voice**. Every other cultural centre speaks *about* community. Nyinkka speaks *as* community. This is the exact product Empathy Ledger v2 is built for.

### Campaign architecture

**Name:** "Voices from Country" (or Warumungu-language equivalent chosen by Elders — e.g. invoke *punttu*, skin-relations, as narrative frame)

**Three storyteller arcs, each a 12-week content cycle:**

1. **Elders' arc** — "What this place held before it opened, what it holds now." Focus: cultural authority, the Keeping Place, return of objects, language transmission.
2. **Artists' arc** — "From paint to gallery." Focus: the Living Culture Gallery, Tennant Creek Brio, contemporary practice grounded in knowledge.
3. **Young people's arc** — "Growing up on Country, making a life in culture." Focus: employment, education, intergenerational learning, the 55% under-33 Tennant Creek demographic.

Each arc = 1 elder/artist/young person × 4 pieces over 12 weeks:
- Piece 1: long-form story (500–800 words, in their voice, co-edited)
- Piece 2: short video (60–90s), subtitled
- Piece 3: photo series + captions
- Piece 4: live event or community yarn (optional)

### Distribution

| Channel | Role | Owner |
|---|---|---|
| Nyinkka website `/voices` hub | Storyteller-owned gallery (EL-powered) | EL + Nyinkka |
| Instagram + Facebook | Reach + share | Nyinkka comms |
| ATDW distribution | Travel trade reach | Tourism NT |
| Tourism NT + Barkly partners | Earned placement | Tourism NT / RDA |
| Email (Friends of Nyinkka) | Donor retention | Nyinkka dev |
| PR (travel + arts media) | Reopening moment + ongoing | Agency/freelance |
| Schools curriculum hub | Education segment | NTG Education |

### Cultural safety guardrails (non-negotiable)

- Deceased-persons warning on web and video assets (Koorie Heritage Trust model).
- Every storyteller signs a **living consent form** (EL's consent module) — revocable, with specific sub-permissions (web / print / social / tourism distribution / commercial).
- Steering Committee (Elders + staff) approves each piece before publication.
- ICIP attribution on every asset; benefit-sharing (paid storytelling, not "exposure").
- No sacred-site imagery, no restricted stories. Creative Australia + Arts Law ICIP protocols baked into the workflow.
- Honorariums, not "contributions" — pay storytellers at NAVA rates minimum.

---

## 4. Empathy Ledger v2 Integration — Supporting Storyteller Ownership

Empathy Ledger v2 (`/Users/benknight/Code/empathy-ledger-v2`) is already built for this. Relevant routes already present:

- `src/app/consent` — living consent flows
- `src/app/cultural-protocols` + `src/app/cultural-review` — steering committee workflow
- `src/app/capture` + `src/app/contribute` — storyteller submission
- `src/app/elder` — elder-specific UX (lower cognitive load, yarning-style capture)
- `src/app/galleries` — public display
- `src/lib/cultural-safety.ts` — safety checks
- `src/lib/civicgraph` — already wired to this CivicGraph DB

### Deployment pattern: Nyinkka as a tenant on EL v2 (multi-tenant already)

1. **Provision Nyinkka tenant** in EL v2 with Warumungu-specific cultural protocols (language, deceased warning, restricted content categories).
2. **Seed Elders + artists as storytellers** — onboard with in-person capture (not forms). Elder route is the default.
3. **Steering Committee UX** — route every piece through `cultural-review` with named Elders as approvers. No publish without tick.
4. **Public hub at `nyinkka.com.au/voices`** — embed EL gallery (iframe or SSR component) on the Squarespace-based main site, or migrate the whole site onto EL if Nyinkka wants full ownership.
5. **Donor/impact feedback loop** — each Friends tier email references a specific story the donor's money enabled (with storyteller consent). Closes the narrative loop; dramatically improves retention.
6. **CivicGraph link** — EL already has a `civicgraph` adapter. Each storyteller's org can be linked back to `gs_entities` so funders can see impact at entity level. This is the "Governed Proof" product tie-in.

### What this does for Nyinkka that a Squarespace site can't

- Storyteller owns the consent record (can revoke; each asset stops being served).
- Cultural review is auditable (important when a foundation asks "how do you ensure cultural safety?" — show the workflow, not a PDF policy).
- The same story can be served to web, social, tourism trade, funder reports — with *different* approved versions if the storyteller consented differently per channel.
- Funder reporting is real: "Your grant funded 14 storyteller pieces, here are the metrics, here is the consent ledger."

### What this does for the fundraising ask

Every Tier A foundation conversation now has a concrete offer: **"Your $100K underwrites 10 Warumungu storytellers with proper consent, honorariums, cultural review, and a permanent digital Keeping Place."** That is fundable in a way a generic "reopen the doors" ask is not — because it aligns with what Potter, Myer, Tim Fairfax, Balnaves, Minderoo already say they want to fund (self-determination, cultural authority, community-led).

---

## 5. 90-Day Action Plan

| Week | Action | Owner |
|---|---|---|
| 1 | Query CivicGraph for board-interlocks between Tier A foundations + existing Nyinkka/Barkly contacts | Ben |
| 1 | Culturally review this strategy with Nyinkka board + Elders; confirm storyteller arcs | Nyinkka |
| 2 | Provision Nyinkka tenant in Empathy Ledger v2; configure Warumungu cultural protocols | Dev |
| 2 | Customise Foundational Membership pitch decks per Tier A foundation from `giving_history` | Ben |
| 3 | Warm-intro outreach to first 3 Tier A foundations (Tim Fairfax, Ian Potter, Myer) via shared board members / NT Govt contacts | Nyinkka + Ben |
| 3–4 | Build `/voices` hub — either on EL tenant or embedded in Nyinkka site | Dev |
| 4–5 | Capture first Elder story (in-person, on Country) using EL elder route | Nyinkka + EL |
| 5 | Launch "Plan your visit / Book / Shop / What's on" pages (per deep-research report) | Nyinkka web |
| 6 | ATDW listing refresh with Voices hub linked | Tourism NT |
| 6–8 | "Come to Country" weekend — host 2–3 Tier A program officers | Nyinkka |
| 8 | First Foundational Membership pitch meeting | Nyinkka + board |
| 9–10 | Reopening PR moment (28 April already past — retarget as "100 days open" milestone) | Agency |
| 10 | First three Voices pieces published with full cultural review + consent | EL + Nyinkka |
| 11 | First Tier A ask submitted in writing (after two meetings + site visit) | Nyinkka |
| 12 | Friends of Nyinkka EDM #1 referencing a specific storyteller with consent | Nyinkka dev |

---

## 6. Queries to Run Next (for the warm-intro map)

```sql
-- Board overlap between Tier A foundations and NT/Barkly ecosystem
SELECT bi.person_name, bi.entities, bi.shared_board_count
FROM mv_board_interlocks bi
WHERE bi.entities::text ILIKE ANY (ARRAY[
  '%Tim Fairfax%','%Ian Potter%','%Myer%','%Minderoo%','%BHP%',
  '%Balnaves%','%Pratt%','%Neilson%','%Rio Tinto%'
])
ORDER BY bi.shared_board_count DESC LIMIT 50;

-- Cross-ref with anyone connected to NT cultural ecosystem
SELECT pi.person_name, pi.board_count, pi.financial_footprint
FROM mv_person_influence pi
WHERE pi.person_name ILIKE ANY (ARRAY[
  '%Warumungu%','%Tennant Creek%','%Barkly%','%Julalikari%','%NT Government%'
])
ORDER BY pi.financial_footprint DESC LIMIT 50;

-- Recent grants to remote NT Indigenous arts (precedent library)
SELECT r.source_entity_id, s.canonical_name AS funder, t.canonical_name AS recipient,
       r.amount, r.year, r.dataset
FROM gs_relationships r
JOIN gs_entities s ON s.id = r.source_entity_id
JOIN gs_entities t ON t.id = r.target_entity_id
WHERE r.relationship_type = 'grant'
  AND (t.state = 'NT' OR t.canonical_name ILIKE ANY (ARRAY['%art centre%','%cultural centre%']))
  AND r.year >= 2022
ORDER BY r.amount DESC NULLS LAST LIMIT 100;
```

---

## Key references

- Deep research report: `/Users/benknight/Downloads/deep-research-report (1).md`
- Foundational Membership brochure + Friends brochure (provided)
- CivicGraph foundations table (2,253 Indigenous/arts/culture matches; 2026-04-15)
- Empathy Ledger v2 repo: `/Users/benknight/Code/empathy-ledger-v2`
