# Goods x QBE — Power-Mapped Capital Strategy

**Prepared 19 June 2026 · Operating document, not an essay.**
*Credit line required on all investor-facing materials: "Catalysing Impact, powered by Social Impact Hub, in partnership with QBE Foundation."*

---

## Executive summary

The keystone is one signature. By 31 August 2026, Goods on Country must close roughly AUD 400,000 in signed, match-eligible catalytic capital. That commitment is the match the QBE Foundation Stage 2 grant (up to AUD 400K, AUD 150K floor, submitted September 2026) is judged on, through the Catalysing Impact program powered by Social Impact Hub. Repayable and recoverable structures carry the highest match value, so the raise leads with instruments built to lend, not only to give.

The approach is power-mapping. CivicGraph now resolves, for any of Australia's ~11,000 foundations, the actual people who run it and who in Goods' existing network sits one or two links from a decision-maker. That turns a stack of funder names into a sequenced, evidenced approach. The top three moves: (1) reopen SEFA — already named as Goods' lead loan partner in the QBE application, and an Aboriginal-controlled lender, so the cultural and structural fit is the cleanest in the field; (2) convert the warm Snow Foundation relationship from grant into a recoverable instrument, the highest-probability first signature; (3) use Snow as the one-hop bridge to the Paul Ramsay Foundation impact team. Land any one first mover and every later conversation gets easier.

---

## The thesis: legibility as leverage

### The platform makes Australian money and power legible

Most capital in this country moves through relationships that only one side can see. A foundation knows its board, its other grantees, its giving history and its decision-makers. The community-led enterprise that needs its money knows almost none of that. It walks into the room blind, pitches into a fog, and waits to be chosen. That asymmetry is not an accident of philanthropy. It is the operating condition of it.

CivicGraph exists to remove that fog. The platform maps how money and power actually move in Australia: who funds whom, who sits on which boards, which people pull the levers behind the institutions that hold the capital. It is built on 11,075 foundations, 10,159 of them with giving figures, 10,329 with named board members, and 241,260 disambiguated person identities, joined across donations, contracts, lobbying and grants. The board-interlock, revolving-door and power-index layers turn that into a picture of who is connected to whom. A single verified join path closes the last gap: a foundation's ABN links to the responsible persons who run it, so the question stops being "which foundation might fund us" and becomes "who decides, what have they funded before, and who do we already know who can open the door."

This is not muck-raking. It is the opposite. Muck-raking treats power as something to expose and embarrass. Legibility treats power as something to navigate deliberately, so that a partnership can be built on equal footing. The data is public. What has been missing is the connective tissue that lets a small First Nations enterprise read it as fluently as a wealth manager reads a cap table.

### Legibility flips the asymmetry

The disruption is mechanical, not rhetorical. When Goods on Country approaches a funder, it can now know, before the first conversation: who chairs the board and what else they chair; the foundation's real average grant size and giving range, not the figure in the brochure; the themes and geographies it actually funds, drawn from its grant history; whether it holds DGR and how it prefers to give; and whether anyone in Goods' existing network sits one or two links away from a decision-maker. The warm path is found before the cold ask is sent.

That changes the shape of the encounter. A funder is used to controlling the terms of a relationship it can see and the grantee cannot. When the grantee arrives already understanding the funder's portfolio, its constraints and its people, the conversation moves from supplication to fit. The ask is precise. It speaks to what this funder demonstrably backs, structured the way this funder can actually move money. The same intelligence tells Goods which doors not to knock on, which saves the scarcest resource a small team has, which is time and the credibility you spend on every approach.

None of this is adversarial. A funder is better served by a grantee who understands them. Legibility makes both sides legible to each other faster, and that is what lets a partnership form on equal terms rather than on the funder's terms alone.

### Why this matters for Goods

Goods on Country presses recycled-plastic beds and remote-grade washing machines on Country, so that community owns the production, not just consumes the output. 496 beds across nine communities, 16 washers, 2,660kg of plastic kept out of landfill, AUD 741,111 received to date. The next move is the one that locks ownership in: by 31 August 2026, close the first roughly AUD 400,000 in signed, match-eligible catalytic capital. That commitment is the match QBE Foundation's Stage 2 grant is judged on, through the Catalysing Impact program powered by Social Impact Hub. Repayable and recoverable structures carry the highest match value, which is why the warmest first-movers are the ones built to lend, not only to give: SEFA, Snow Foundation, Centrecorp, and a PAF pathway where a below-market loan to The Butterfly Movement, the DGR home, can satisfy a fund's own distribution obligation while it backs Goods.

Power-mapping is how a nine-person enterprise marshals that raise without a development office. It tells Goods which of its already-warm relationships sit closest to a catalytic structure, who on each funder's board has backed community-owned or First Nations work before, and where the second-order introductions live. The playbook says we drive the raise; mentors and SIH introduce but cannot raise for us. Legibility is what lets us drive it. It turns a stack of names into a sequenced, evidenced approach, so the first signature lands on time and every conversation after it starts from a position of knowing, rather than hoping to be known.

---

## What the data work unlocked

The person-disambiguation and graph-clearing work turned CivicGraph from "a name is a node" into "a name resolves to a distinct real person." That is the difference between a poisoned leaderboard and a usable power map. Concretely, the cleared data makes the following queryable end-to-end:

- **Who runs a foundation.** For any of the ~11,000 foundations, name the actual humans who run it by joining `foundations.acnc_abn` to `person_roles.company_abn`, returning person name and role (chair / director / trustee / secretary). Verified live: World Vision Australia resolves to chair Peter Trent plus board members including Andrew Scipione and Kate Harrison Brennan.
- **Rank real people by cross-system influence.** `mv_person_identity_influence` holds 241,260 identities with the 142 trustee-nominee blocks flagged and excluded, so the people surfaced are genuine serial directors, not name-collision megamerges. Filter `WHERE NOT is_nominee_block`.
- **Who sits on multiple boards, and what money runs through those orgs.** `mv_board_interlocks` gives each person's organisations, role types, an interlock score, and per-person procurement / justice / donation rollups. Verified live: Allan James Myers bridges Minderoo Foundation to the Ian Potter Foundation, George Alexander Foundation and Ian Potter Cultural Trust.
- **Per-name disambiguation for intro targeting.** `mv_person_identity_network` backs the `/person/[name]` picker, so Goods opens the right "David Smith" rather than a 63-way merge.
- **Map a warm funder to its people and their other boards.** Take a warm funder's ABN (Snow, Centrecorp, Just Reinvest's network), join `person_roles` for its directors, then run `mv_board_interlocks` to find who else those directors sit with. Those other orgs are the warm doorways.

The one load-bearing caveat: person-level dollar columns over-attribute each org's whole money to every board member, so read them as "scale of orgs this person governs," never "money this person personally controls." (Full caveat list in Verification & gaps.)

---

## The clearest view of Australia's foundations

The clearest view is built from one base table joined out to people and interlocks. All four steps run from repo root with `node --env-file=.env scripts/gsql.mjs "SELECT ... LIMIT n"`, one heavy query at a time on the shared pooler.

**1. Enumerate the universe.** The `foundations` table has 11,075 rows with rich, populated columns: name, acnc_abn (11,054 populated), type, total_giving_annual (10,159), thematic_focus[] (10,957), geographic_focus[] (10,954), board_members (10,329), has_dgr (only 551 true), avg_grant_size, grant_range_min/max, wealth_source, giving_philosophy, application_tips, notable_grants, gs_entity_id, and an embedding vector for semantic search. Arrays must be filtered with `array_to_string(thematic_focus,' ') ILIKE '%term%'`, never a bare ILIKE on the array.

**2. Segment in one pass** with FILTER aggregates; vehicle split via `GROUP BY type`; geography via `GROUP BY array_to_string(geographic_focus,'|')`.

**3. Resolve who runs them** via the verified join: `foundations f JOIN person_roles pr ON pr.company_abn = f.acnc_abn`, giving person name plus role_type. This resolves named people for roughly 10,750 of the ~11,054 ABN-bearing foundations (about 97 percent). The `board_members` text column is a fallback; `person_roles` is the structured source.

**4. Connect** via the repeatable warm-path method below.

### Top givers (verified against the live `foundations` table)

| Foundation | Annual giving | DGR | Type | Focus (excerpt) |
|---|---|---|---|---|
| World Vision Australia | $514.1M | yes | service_delivery | education, health, community, indigenous |
| The University of Sydney | $340.7M | yes | university | education, research, community, indigenous |
| Catholic Education Centre | $281.5M | no | religious_organisation | education, indigenous |
| Monash University | $273.7M | yes | university | education, research, health, indigenous |
| Australian Red Cross Society | $265.7M | yes | service_delivery | human_rights, community, emergency, aged_care |
| Geoffrey Cumming Foundation | $250.0M | no | private_ancillary_fund | health, education, community |
| Ecumenical Schools Australia | $245.4M | no | religious_organisation | education |
| Lutheran Education SA/NT/WA | $211.4M | yes | religious_organisation | education |
| Minderoo Pictures Limited | $210.0M | no | grantmaker | arts, indigenous, health, education, environment |
| Headspace National Youth Mental Health Foundation | $209.2M | no | corporate_foundation | health, indigenous, youth |
| BHP Foundation | $195.1M | no | corporate_foundation | indigenous, community, environment, education |
| Latter-day Saint Charities Australia | $185.2M | no | religious_organisation | community, health, education |
| Rio Tinto Foundation | $153.7M | no | corporate_foundation | indigenous, community, cultural_heritage |
| The Smith Family | $144.6M | no | service_delivery | education, youth, employment, poverty_reduction |
| Coles Group Foundation | $132.7M | no | corporate_foundation | community |
| Australian National University | $124.0M | yes | university | education, research, environment, indigenous |
| Royal Flying Doctor Service | $111.0M | no | service_delivery | health, community, research |

### Who runs them (verified via person_roles)

- **World Vision Australia** (ABN 28004778081): Peter Trent (chair), Jonathan Seeley, Andrew Scipione, Kate Harrison Brennan, Charles Badenoch, Darryl Gardiner.
- **Minderoo Foundation**: Andrew Forrest AO, Allan James Myers, Nicola Forrest, Anthony Grist, Prof Fiona Stanley AC (trustee), Suzanne Montandon (secretary).
- **The Smith Family** (ABN 28000030179): Nicholas Moore (chair), Doug Taylor, Lisa Paul, Mark Ryan, Caroline Fishpool, Peter Radoll, Rosheen Garnon.
- **Royal Flying Doctor Service** (ABN 74438059643): Tracey Hayes / John O'Donnell (chairs), Peter de Cure, Saranne Cooke, Kieran Chilcott, Robert Slocombe.
- **The Ian Potter Foundation**: Allan James Myers (chair) — the same person chairs Minderoo Foundation, George Alexander Foundation and Ian Potter Cultural Trust (7 boards). This interlock is the canonical warm-path example.

### Segmentation that matters for Goods (verified)

- **DGR is the receipting gate.** Only 551 of 11,075 foundations have `has_dgr=true`. Within First Nations-themed foundations, 130 hold DGR.
- **By theme** (array ILIKE counts): First Nations / Indigenous / Aboriginal = 2,060; Health = 1,834; Children/Youth = 262; Housing/Homeless = 49; Remote/Rural/Regional = 56.
- **By geography:** AU-National 4,236; NSW 1,810; VIC 1,749; QLD 812; WA 567; SA 483; TAS 149; **NT 77** (the thinnest single-state pool, and the most relevant to Goods' remote footprint); ACT 71.
- **By vehicle:** corporate_foundation 6,537; trust 3,194; grantmaker 288; service_delivery 131; **PAF 54; PuAF 40** (the catalytic-loan lane); religious_organisation 94; indigenous_organisation 14.
- **The priority slice:** First-Nations-themed AND DGR = 130 foundations (highest-fit for the Butterfly receipting pathway). First-Nations-themed AND (NT geo or remote) = 166. Cross-reference these against the 94 PAF/PuAF vehicles to find the catalytic-loan-capable, on-Country-aligned subset.

### The repeatable warm-path method

1. **Resolve the target's people:** `SELECT pr.person_name, pr.role_type FROM foundations f JOIN person_roles pr ON pr.company_abn = f.acnc_abn WHERE f.name ILIKE '%<target>%'`.
2. **Find the bridge people:** query `mv_board_interlocks` for anyone on the target's board who also sits on other boards. Those other orgs are warm doorways. (Verified: an Ian Potter or George Alexander relationship is a one-hop path to Minderoo via Allan James Myers.)
3. **Score the bridge person** with `mv_person_identity_network` / `mv_person_influence` — keep `WHERE is_nominee_block = false`.
4. **Shared-grantee path:** find funders that already back the same recipients Goods touches, joining on grantee with a tight WHERE (never an unfiltered scan).
5. **Anchor to existing warm relationships:** run step 2 on each current funder (Snow, Centrecorp, Just Reinvest, Regional Arts) to surface bridge people on a target funder's board. **Fallback:** if no interlock row exists, report "no board-interlock path found; nearest is shared-geography/shared-theme cohort" rather than inventing a connection.

---

## The $400K QBE match plan

**What counts as match-eligible:** the QBE eligibility test is "actively seeking investment or repayable finance in 2026." The Stage 2 grant is unlocked by matching funds, and a signed repayable / co-investment commitment is the highest-value form. Grants count, but rank below repayable instruments. The match is what triggers QBE's money.

**The DGR mechanic for foundation lenders:** a below-market or recoverable loan from a PAF/PuAF to a DGR (The Butterfly Movement, ABN 22 155 132 684, Item 1 DGR + PBI since 2012) counts toward that fund's required annual distribution. So a PAF can lend to Goods-via-Butterfly and satisfy its own distribution obligation at the same time. (Tax/trust-deed-dependent — confirm against the specific fund's vehicle; see Verification & gaps.)

**Clauses to clear before any signature:** cl 7.3 (IP — license Goods' own cost model back at own cost) and cl 5.3 (SIH 3-year co-invest right). Surface both early so they are not a surprise at term-sheet stage.

### Ranked candidates by lane

| # | Candidate | Lane | Vehicle | Match | Warmth | Lead ask |
|---|---|---|---|---|---|---|
| 1 | **SEFA** | Repayable / catalytic lender | repayable | high | high | Signed term-sheet, growth impact loan to ACT Pty |
| 2 | **Snow Foundation** | Warm PAF / recoverable | PAF loan to Butterfly DGR | high | high | Convert pending ~$200K into a recoverable instrument |
| 3 | **Paul Ramsay Foundation** | PAF / evergreen impact fund | sub-commercial loan to Butterfly | high | medium | Sub-commercial recoverable tranche, co-invest with SEFA |
| 4 | **Lord Mayor's Charitable Foundation (Naarm)** | PAF / impact-investing book | below-market loan to Butterfly | high | medium | SEFA-co-structured recoverable tranche |
| 5 | **First Australians Capital — Catalytic Impact Fund** | First Nations capital | patient/recoverable debt | high | medium | $100K–$400K patient debt to ACT Pty |
| 6 | **Centrecorp Foundation** | Warm, deepen | grant (to Butterfly DGR) | medium | high | Deployment-tied grant; convert the ~$84.7K draft |
| 7 | **Indigenous Business Australia (NAB-IBA guarantee)** | Repayable / statutory | guaranteed bank facility | high | low | NAB-IBA-guaranteed term facility to ACT Pty |
| 8 | **Many Rivers Microfinance** | Repayable | recoverable loan | high | low | Secondary working-capital tranche |
| 9 | **Bank Australia — Impact Finance** | Repayable | term facility | high | low | For-purpose facility; best fit for Harvest works |
| 10 | **Foresters Community Finance** | Repayable (fallback) | recoverable loan | high | low | Fallback CDFI if SEFA/FAC stall |
| 11 | **Minderoo Foundation** | PAF / Indigenous | PAF loan to Butterfly | high | low | Below-market recoverable loan, advice-first |
| 12 | **Suncorp / FRRR Rebuilding Futures** | Corporate / QBE-adjacent | grant (to Butterfly DGR) | medium | medium | Disaster-resilience washer grant, via Snow→FRRR |
| 13 | **NAB Foundation** | Corporate / QBE-adjacent | grant (to Butterfly DGR) | medium | medium | Community-resilience grant via NAB banker |
| 14 | **QBE Foundation Local Grants** | Corporate / QBE-adjacent | grant | low | high | $50K Local Grant as parallel traction, not self-match |

**Sequencing logic:** lead with repayable/catalytic and warmest (1–3). Land any one first mover early; one committed backer de-risks every later conversation. Run the slower, higher-value catalytic targets (FAC, PRF, IBA) in parallel as anchors, never as the gate on the deadline, since their investment-committee cycles may not close by 31 August. The playbook in every conversation: ask for advice not money, keep the pack send-ready so it goes the same day, and remember we drive the raise — SIH and mentors introduce, they cannot raise for us.

---

### Brief 1 — SEFA (Social Enterprise Finance Australia) · repayable · match HIGH · warmth HIGH

**Who they are.** Australia's longest-running impact lender (since 2011). NSW Aboriginal Land Council became its majority shareholder in November 2021. The giving arm, SEFA Partnerships Ltd, runs roughly $1.08M annual giving. (See Verification: the "Aboriginal-controlled and governed" framing and the named loan streams are the brief's own inference, not a confirmed SEFA-site fact — lead with the verified NSWALC-majority-shareholder fact, not the stronger characterisation.)

**Who runs it.** CEO Hanna Ebeling (since 2019) is the term-sheet conversation. SEFA Partnerships chair David Rickards and director Vedran Drakulic are independently corroborated. The remaining roster names and the specific NSWALC-nominated SEFA Ltd directors are unverified — confirm at sefa.com.au/board before naming anyone in the room.

**Why Goods fits.** A First Nations on-Country producer borrowing from a First-Nations-majority-owned lender is the cleanest cultural-and-structural match in the field. Bed unit economics are loan-serviceable: price $750, marginal cost ~$421–426, break-even ~338 beds/yr. That is a real cash-flow line a lender can size against.

**The warm path.** This is a re-engagement, not a cold start: SEFA is already named as Goods' lead loan partner in the QBE application. Second route: Goods' live Just Reinvest NSW relationship sits inside the same NSW Aboriginal land/justice network as SEFA's majority owner — use it as cultural-credibility framing, but confirm the named person-to-person bridge before claiming it in writing. Fallback intro: SIH / QBE.

**The ask.** Signed term sheet, SEFA growth impact loan into ACT Pty (ABN 36 697 347 676) for production-facility plus working capital, sized to a tranche toward the ~$400K match, first drawdown timed to the production ramp. Lead with the commercial loan to ACT Pty — do not mis-frame a SEFA loan as a DGR grant; hold the Butterfly-DGR recoverable structure for the PAF conversations.

**The opening move.** Advice-first note to Hanna Ebeling: "We named SEFA as our lead loan partner in our QBE Catalysing Impact submission. We've a production-ramp decision to make and would value 20 minutes of your read on how to structure growth capital against it, before we firm anything up." Send-same-day pack: one-page impact + unit-economics sheet, the QBE one-pager with the credit line, a one-page term-sheet skeleton flagging cl 7.3 / cl 5.3, and the entity/ownership note.

**Timing.** Advice call by ~30 Jun; indicative term sheet mid-Jul; entity/ownership confirmed past the 1 Jul Supply Nation threshold; signed mid-Aug; counted by 31 Aug. Landing SEFA first makes every later conversation easier.

---

### Brief 2 — Snow Foundation · PAF recoverable loan to Butterfly · match HIGH · warmth HIGH (warmest)

**Who they are.** A corporate/family foundation (ABN 49 411 415 493). Wealth source: the Snow family (Capital Airports Group / Canberra Airport). Four pillars — Our Place, Our Country, Our Sector, Our Family. Themes health, community, Indigenous; geography ACT and NSW. Crucially, Snow runs a live social-impact-investment portfolio using repayable capital: $26.2M across 38 investments as at December 2025, 12 percent of corpus, target 20 percent, catalytic capital 32 percent of active commitments (web-verified, snowfoundation.org.au). They can write the repayable instrument the match needs, not just a grant.

**Who runs it.** Georgina Byron AM, CEO since 2006 (web-confirmed), is the decision-maker. Craig Betts is Chief Investment Officer (not "Executive Director" — see Verification) and the technical counterpart for a debt instrument. Adjunct Professor Maree Meredith is a First Nations advisor and a useful internal-champion angle. (The per-theme First Nations and Homelessness dollar figures circulating in the raise docs are not stated allocations on the live page — see Verification; do not quote them.)

**Why Goods fits.** Snow's notable grants already cover scabies and rheumatic-heart-disease elimination in remote Aboriginal communities, and a Good360 "matching goods to communities" partnership. Goods is the production-side answer: beds and washers on Country cut the overcrowding and hygiene drivers behind those diseases, and Goods is the upstream community-owned manufacturer of exactly the goods Good360 distributes.

**The warm path.** Warm, not cold — Snow already funds ACT/Goods and has floated a social-impact-loan path. Go direct to Georgina Byron; loop in Craig Betts for instrument mechanics; name-check Maree Meredith for internal advocacy. No intro broker needed.

**The ask.** Convert the pending Snow proposal (or a tranche) into a recoverable grant / below-market loan to The Butterfly Movement, 3-year, converting into community equity. Amount band $150K–$400K. The catalytic mechanic does double duty on Snow's side: a PAF/PuAF below-market loan to a DGR counts toward the fund's required annual distribution, so Snow gets distribution-credit and principal recovery.

**The opening move.** Advice-first to Georgina Byron, referencing the loan path she floated. Send-same-day pack: traction one-pager, recoverable-loan term outline with the distribution-credit note, the QBE credit line, and Butterfly DGR/PBI evidence so their finance team can confirm distribution-eligibility same day.

**Timing.** Highest-probability first signature. Advice call this fortnight; term sheet within days; counter-sign by mid-Aug for buffer. Confirm Butterfly's signing authority is settled through the ~end-Jul stewardship handover before papering, so a board-in-transition doesn't stall the signature.

---

### Brief 3 — Paul Ramsay Foundation · sub-commercial loan to Butterfly · match HIGH · warmth MEDIUM

**Who they are.** Australia's largest philanthropic foundation (ABN 32 623 132 472). Scale figures ($1.513B distributed, $180M impact investments, 253 partners) are web-confirmed against the PRF About page. The piece that matters: PRF has committed $60M to an evergreen impact-investing fund that accepts concessionary returns, plus a separate commitment of 10 percent of liquid corpus to impact investing. (Note: "sub-commercial / recycled back into the fund / unprecedented" framing and a Kristy Muir quote in earlier drafts are not supported by the cited sources — see Verification. Use "concessionary returns" and the verified $60M figure.)

**Who runs it.** Chair Michael Traill AM (founder figure in Australian social finance); CEO Prof Kristy Muir (since Aug 2022); director Natalie Walker (First Nations leader; publicly Chair of PRF's First Nations Advisory Council). Ben Smith leads PRF's impact-investing activity and is the target — confirm his exact title (sources vary between "Head of Impact Investing" and the title used in earlier drafts).

**Why Goods fits.** PRF prioritises community-led, evidence-backed, investable work. Goods is community-owned production, not service delivery; the unit economics are built; and PRF's whole evergreen-fund thesis is concessionary capital that recycles on repayment — the rare ask their impact team can say yes to as an investment.

**The warm path.** One warm hop via Snow. Ben Smith and Georgina Byron are peers in Australia's small catalytic-capital circle, and Snow is a committed Goods backer. Ask Snow for a warm intro to Ben Smith. (The claim that Smith and Byron co-presented is unverified — do not state it as fact; lead with the verified peer-network fact.) Backup: SIH/QBE cohort framing, or Conscious Investment Management / Australian Communities Foundation, both named PRF partners.

**The ask.** A concessionary / recoverable loan from PRF's evergreen fund into The Butterfly Movement, $150K–$400K, framed as co-investment alongside SEFA — PRF takes a patient tranche that de-risks SEFA's loan.

**Timing.** Cold-ish and committee-driven; unlikely to sign by 31 Aug from a standing start. Run as the lead anchor signal (advice → soft commitment → term sheet in train) while SEFA or a Snow top-up provides the signed match by the deadline. A PRF expression of interest before 31 Aug still strengthens the Stage 2 narrative.

---

### Brief 4 — Lord Mayor's Charitable Foundation (Naarm / Melbourne) · below-market loan to Butterfly · match HIGH · warmth MEDIUM

**Who they are.** Australia's largest community foundation. Holds 1.5–2.5 percent of corpus in social-impact investing and positions itself as early risk capital. The proof point: in 2015 LMCF and SEFA jointly established an Affordable Housing Loan Fund, LMCF investing $3M. First Nations track record: $1.26M in grants to First-Nations-led organisations. (Note: the org has rebranded toward "Greater Melbourne Foundation"; check current naming before send. The "$2M Habitat loan" precedent is a conflation — do not state as fact; see Verification.)

**Who runs it.** Verify the current board against the live greatermelbournefoundation.org.au page before naming anyone — the DB roster is stale. Do NOT name "Mong Do" (the real current member is Linh Do) and do NOT build the pitch around Raphael Arndt, who is a former, not current, board member. (See Verification.)

**Why Goods fits.** LMCF's pillars are housing justice, economic justice and First Nations — Goods sits at the intersection. Beds and washers are the fit-out and dignity layer of remote housing, one rung closer to the household than LMCF's flagship housing-finance move.

**The warm path.** One warm hop via SEFA, which already co-runs LMCF's $3M housing fund. Ask SEFA to co-structure the Goods tranche and walk it into LMCF's impact-investing team as a stacked deal. Do not cold-email the chair.

**The ask.** A below-market / recoverable loan from LMCF's impact-investing allocation into The Butterfly Movement, co-structured with SEFA, $100K–$250K, anchored against their existing housing-loan precedent.

**Timing.** Likely a strong match-stacking second mover, not the first signature. Start the SEFA conversation now; let SEFA pre-qualify the deal before it reaches an LMCF committee.

---

### Brief 5 — First Australians Capital (FAC), Catalytic Impact Fund · patient debt · match HIGH · warmth MEDIUM-LOW

**Who they are.** Australia's First-Nations-led national impact fund (ABN 14 615 225 182). The Catalytic Impact Fund provides patient debt of $100K–$2M to Indigenous-led businesses; a separate Seed Capital Fund offers lower-rate or grant capital. **Key finding: QBE Foundation already funds FAC directly ($500K, April 2024) — so the SIH→QBE→FAC introduction runs along an existing relationship and is the fastest verified door in.** Co-investors include Paul Ramsay Foundation, Block ($3M), Visa Foundation ($2M). (Fund-size figures vary between a ~$20M first close and a ~$30M target — reconcile before quoting; see Verification.)

**Who runs it.** Operating contact for anything QBE-adjacent is Managing Partner Brian Wyborn (named on the QBE-FAC partnership). The Catalytic Impact Fund Investment Committee — chaired by Jahna Cedar, with Tim Barber and Dan Porter — decides loans, distinct from the FAC board (Jocelyn King, Adrian Appo OAM, Abhilash Mudaliar, Craig North). Confirm current titles before send.

**Why Goods fits.** A clean archetype: First Nations on-Country production, measurable environmental impact (2,660kg plastic diverted), and a real unit economy FAC can lend against.

**The warm path.** Best: SIH/QBE warm intro to FAC (QBE already funds them). Front door if no intro lands: the First Nations Business Acceleration Program (confirm exact current name). Connector in reserve: FAC director Abhilash Mudaliar interlocks to Myriad Australia.

**The ask.** Recoverable debt from the Catalytic Impact Fund, $100K–$400K, to ACT Pty (FAC lends to businesses, so the Pty is the counterparty, not Butterfly). The make-or-break gate: confirm Goods clears Supply Nation's 51 percent First Nations ownership before pitching.

**Timing.** Best structural fit in the lane but slowest to clear because of the ownership gate (1 Jul tightening vs ~end-Jul Butterfly board install). Run in parallel; a signed term sheet or letter of intent may carry match weight even if drawdown lands later — confirm acceptable evidence with SIH. If the gate can't be evidenced in time, FAC converts cleanly into the post-QBE follow-on round.

---

### Brief 6 — Centrecorp Foundation · grant to Butterfly DGR · match MEDIUM · warmth HIGH

**Who they are.** A corporate foundation (ABN 31 136 052 796) with DGR, stated annual giving ~$100K, themes community and indigenous, practical footprint in remote Central Australia. (DB figures could not be re-verified this session — see Verification.)

**Why Goods fits.** Near-identical activity, not thematic adjacency: Centrecorp's parent already donates washing machines to these exact Central Australian communities (figure unverified this session — do not quote to the funder until re-sourced). Goods presses the remote-grade Pakkimjalki Kari washers for the same communities. The one-line fit: you already buy these; Goods lets the community build them, on Country.

**The warm path.** Two levers. (a) The live ~$84.7K draft receivable — open from inside that thread. (b) Secretary Randle Walker's board interlock into adjacent Central Australian Aboriginal trusts — useful directional intelligence for co-funders, though the exact board count and Walker's Centrecorp role are unverified (he is CEO of the distinct Centrecorp Aboriginal Investment Corporation; see Verification).

**The ask.** A deployment-tied community grant ($40K–$100K, safe band $40–60K) routed through Butterfly DGR, anchored on converting the draft receivable into a confirmed scoped grant. Set match expectations honestly: a grant counts but ranks below repayable capital, so Centrecorp is a fast corroborating signature and funder-validation, not the catalytic cornerstone. Do not force a recoverable structure on them.

**Timing.** One of the quickest signatures available; run in parallel with the catalytic conversations.

---

### Briefs 7–14 (condensed)

- **IBA / NAB-IBA guarantee** (repayable, statutory; warmth low). The 1 Jun 2026 Indigenous Business Guarantee supports lending up to $1M per First Nations business, IBA guaranteeing up to 50 percent. Eligibility is 50 percent First Nations ownership plus active management (distinct from Supply Nation's 51 percent). Fastest door is NAB's First Nations business desk; the deal is originated bank-side. Slower than a grant — run as the larger second tranche. (Chair is Darren Godwell; Havnen is Deputy Chair, not a second chair — see Verification.)
- **Minderoo Foundation** (PAF loan to Butterfly; warmth low). One verified hop: an Ian Potter or George Alexander relationship reaches Minderoo via Allan James Myers. Advice-first to the impact-investing arm. Otherwise needs an SIH/mentor intro.
- **Suncorp / FRRR Rebuilding Futures** (grant; warmth medium). One verified hop: David Hardie sits on both the Snow board and FRRR. Apply to Rebuilding Futures and ask Snow contacts to flag Goods to Hardie/FRRR.
- **NAB Foundation** (grant; warmth medium). Start with Goods' NAB relationship manager and ask for an internal intro to the NAB Foundation, framed as NAB backing its own customer's QBE match.
- **Many Rivers Microfinance, Bank Australia Impact Finance, Foresters Community Finance** (repayable; warmth low). Secondary/fallback CDFI options to SEFA/FAC. Verify current product ceilings and that each is still actively lending before approaching.
- **QBE Foundation Local Grants** (grant; warmth high). A $50K Local Grant likely cannot self-match the same funder's Stage 2 — confirm with SIH and frame as parallel traction, not the match. Watch cl 5.3 / cl 7.3 before stacking a second QBE instrument.

---

## Existing relationships: which levers to pull

These are people who already pay or fund ACT/Goods. Pull them in this order.

1. **Snow Foundation (~$132K live).** Warmest catalytic lever. Ask: convert the pending tranche into a recoverable instrument (Brief 2). Also the bridge to PRF (via Ben Smith peer-network) and to FRRR/Suncorp (via David Hardie). Pull first.
2. **Centrecorp (~$84.7K draft).** Ask: convert the draft into a scoped deployment-tied grant (Brief 6), and mine the Randle Walker network for adjacent Central Australian trusts.
3. **Just Reinvest NSW (~$27.5K live).** Ask: advice-and-endorsement, not money. Have them co-sign the community-ownership model and introduce their First Nations justice funders. Use as the cultural-credibility framing into SEFA's NSWALC-aligned network and into the Dusseldorp/place-based circle for The Harvest.
4. **Regional Arts (~$33K live).** Ask: re-engage as a Harvest-track partner (Regional Arts Fund, via the QLD administrator) — not the QBE match. Keep cleanly separate from the $400K ledger.
5. **PICC (~$113.3K), Rotary (~$82.5K, INV-0222 a slow-recovery problem), BG Fit, Aleisha Keating, Homeland (~$5K), SMART Recovery.** PICC and Rotary are receivables-recovery, not fresh raise targets — keep them on the finance track, not the match track. **Homeland is a warm one-hop bridge to Dusseldorp Forum and Karrkad-Kanjdji via Teya Dusseldorp** — pull it for The Harvest, not the QBE match.

Rule of order: warm catalytic first (Snow), then warm grant (Centrecorp), then warm endorsement/network (Just Reinvest), then Harvest-track (Regional Arts, Homeland). Receivables recovery (PICC, Rotary) stays off the match track.

---

## The Harvest support track

The Harvest is a separate, smaller track from the $400K match. It does not need signed match-eligible catalytic capital, so match-value is mostly low here (grants are the realistic instrument) and timing is independent of the 31 Aug keystone. The fit is place-based / regional-QLD / regenerative-ag / community-ownership-transition / First Nations land partnership (Witta, Jinibara country). Because Grant Luff may sell the asset, favour funders that explicitly back community-ownership *transition* and long-horizon place commitments over capital improvements to a private asset. Where DGR receipting is needed, route through Butterfly. Most figures below are foundation scale (total giving / corpus), not commitments — treat as scale, not promises.

- **Tim Fairfax Family Foundation (TFFF)** — best geographic + thematic fit. Funds rural/regional/remote QLD and NT exclusively; prefers multi-year general operating support, ideal for a venue building toward Year-3 community ownership. The Connectedness stream is delivered through FRRR, which is the application doorway. Cold to TFFF directly; lead via FRRR. Ask: multi-year operating support framed around Connectedness/Leadership, emphasising transition-to-community-ownership and Jinibara engagement.
- **Dusseldorp Forum** — thematic bullseye (place-based, community-led systems change, lighthouse partnerships). **Warm one-hop via the live Homeland receivable: Teya Dusseldorp sits on both Dusseldorp Forum and Homeland School.** Ask: advice-first conversation positioning The Harvest as a candidate lighthouse place-based partner — multi-year relational backing of the community-governance build, not a capital grant.
- **FRRR (Foundation for Rural & Regional Renewal)** — the application-open doorway, holds DGR, funds regenerative ag and community asset-ownership. Community Led Climate Solutions Round 4 has $400K nationally, plus a First Nations-led stream. **Warm one-hop via Snow (David Hardie on both boards).** Lowest-friction cold path of the set. Also the channel for TFFF's Connectedness funding — one application surface reaches two funders.
- **Karrkad-Kanjdji Trust** — not a Harvest funder (NT geography) but the proven Indigenous-led land-trust model and a warm bridge via the same Teya Dusseldorp interlock. Use as a governance/design reference to strengthen the Jinibara community-ownership story in TFFF/FRRR/Dusseldorp applications.
- **The Bryan Foundation** (Brisbane) — co-funder of Dusseldorp's PLACE infrastructure; fits the JusticeHub vocational-training angle. Cold; nearest path is a follow-on intro if a Dusseldorp/PLACE relationship lands first.
- **Lord Mayor's Charitable Trust (Brisbane)** — small local civic grantmaker; Witta sits outside Brisbane City LGA, so a weaker geographic fit. Treat as a top-up, not a lead.
- **Just Reinvest NSW** — warm connector (live receivable). Run the warm-intro play: ask Beetson/Vumbaca for intros into the justice-reinvestment funder circle that overlaps Dusseldorp's systems-change network.

Internal rule: Harvest money funds the Harvest's arts/place program; the QBE $400K match comes from Snow / SEFA / Centrecorp / a catalytic PAF-to-Butterfly loan. Do not blur the two ledgers.

---

## Verification & gaps

Nothing below may be stated as fact in funder-facing copy until re-verified. Many DB reads failed this session (Cloudflare 522 / pooler timeouts), so DB-cited claims are last-known, not confirmed-now. Re-query before quoting.

### Data-platform caveats (capability gaps)

- **Money over-attribution (load-bearing).** Person-level dollar columns in `mv_board_interlocks` and `mv_person_entity_network` attribute each org's full money to every board member (e.g. Claire Rogers shows $7.65B "procurement" = combined revenue of three orgs). Read as "scale of orgs this person governs," never "money this person personally moves."
- **Residual nominee blocks.** 158 non-nominee identities still have board_count >10 (including a 325-board cluster). The MAX_PLAUSIBLE_BOARDS cap stays on the ranked leaderboards; do not trust the high-board-count tail as single real people until nominee detection is tuned.
- **Dead temporal signal.** `person_roles.appointment_date` is ~0 percent populated and cessation_date is 0 percent, so "is this person CURRENTLY on the board" cannot be verified from the DB. A name resolving to a foundation may be a former director — confirm current decision-makers via the funder's own site before outreach.
- **Name-keyed re-poisoning.** `mv_board_interlocks` is still name-keyed, so its head can re-poison on common names. Only the identity-keyed `mv_person_identity_influence` is clean.
- **Partial foundation→person coverage.** The join resolves people only for foundations whose acnc_abn matches a person_roles record; per-funder coverage is unverified.
- **MV staleness.** All counts are point-in-time; re-query before quoting.

### Per-target unverified claims

**SEFA:** "Aboriginal-controlled and governed" is the brief's inference, not a SEFA-site fact (only NSWALC majority-shareholder since Nov 2021 is confirmed). The three named loan streams (incl. "Aboriginal Community Enterprises") could not be confirmed on the live site. The $1.08M giving figure, the seven-name board roster, and the SEFA Partnerships ABN were not readable this session — only David Rickards (chair) and Vedran Drakulic are independently corroborated. Linda Carseldine's "secretary" title is contradicted by web (COO/CFO). "Longest-running impact lender" is an unverified superlative. The "$45M / 60 deals" stat is stale (site now says $50M+ / 75+ deals). **Earlier draft fabrication: "Ben Gales" as CEO is false — the CEO is Hanna Ebeling. The Ben Gales→PRF bridge is built on that phantom and must be dropped.**

**Snow Foundation:** Craig Betts is CIO + Director, NOT "Executive Director." The First Nations "$2.85M" and Homelessness "$2.75M" theme allocations are not stated allocations on the live page (derived/incorrect sums) — do not quote. ABN, themes, geography, philosophy, wealth source, full director roster, and the two notable_grants quotes were DB-cited but not re-verifiable this session. The ~$132K receivable and ~$193,785-received figures are internal-ledger only (and internally inconsistent with the $741,111 "to date") — do not quote externally. The $218.2M corpus is unverified. Maree Meredith's exact title and "warm champion" framing are inferences. The PAF-loan-to-DGR-counts-as-distribution mechanic is stated as fact with no source — material and trust-deed-dependent; confirm.

**Paul Ramsay Foundation:** The Kristy Muir "unprecedented in Australia" quote is fabricated — cut it. "Sub-commercial / recycled back into the fund" overstates the verified "concessionary returns" language. "Only evergreen fund of its kind" is an unsourced superlative. "10% at commercial return" overstates (the framing is risk-adjusted, not all-commercial). Ben Smith's exact title is unverified (sources say "Head of Impact Investing"). Natalie Walker is on the board / Chairs the First Nations Advisory Council ("Director" is plausible, not confirmed). The $1.513B / $180M / 253 figures are sound (web-confirmed) but should cite the PRF website, not person_roles (DB was down). The Smith–Byron co-presentation claim is unverified.

**Lord Mayor's Charitable Foundation:** Do NOT send "Mong Do" (real member is Linh Do). Do NOT build the pitch around Raphael Arndt (former, not current, board member). The org has rebranded toward "Greater Melbourne Foundation" — check current naming. The "$2M Habitat loan" precedent is a conflation; the "regional Victoria" extension is unsupported (Greater Melbourne only). The $1.26M First Nations figure, themes, application tips, and the ABN twin-record reconciliation are DB-only and unverifiable this session. Wei Sue and Mary Nega are current members per the live page despite being absent from the stale DB roster.

**Centrecorp:** All DB-cited claims (the $100K giving, has_dgr, the 10-name roster, notable_grants, themes, philosophy) could not be re-confirmed this session. The official board page lists only 7 directors — Darryl Fitz, Nicholas Williams and Randle Walker do not appear and read as stale. Randle Walker is CEO of the distinct Centrecorp Aboriginal Investment Corporation, not the Foundation's secretary. His 9-board interlock list contains a duplicate trust, so the count is inflated. The "2,500 washing machines" hook (the load-bearing fit) is unverifiable this session and conflates the parent company with the Foundation — do not quote to the funder until re-sourced. Steven Satour's Yankunytjatjara/Muṯitjulu identity is web-asserted, unconfirmed.

**First Australians Capital:** Fund size is internally inconsistent ($20M first close vs $30M target) — reconcile before quoting. The $13M Impact Enterprise Fund and the VIC state attribution (sources say NSW/Sydney-founded) are unverified. All DB director claims and the "4 of 5 names matched" note could not be re-verified (pooler down). Jocelyn King as current Chair, Adrian Appo as current MD Partnerships, and the Business Acceleration Program's current name are unverified. The QBE→FAC $500K (April 2024) and Brian Wyborn / Investment Committee facts ARE web-verified.

**Indigenous Business Australia:** Olga Havnen is Deputy Chair, not a second chair — the "chair transition in progress" is a fabricated rationalisation of a DB read-error; Godwell is Chair. Directors Leah Cameron and Claire Woodley are DB-only and unconfirmed against any 2025/26 source. The Godwell→Many Rivers/Numbulwar interlock (the warm-path route) is single-sourced to a DB view that could not be re-confirmed. The guarantee terms ($1M cap, 50 percent guarantee, 50 percent ownership gate) are web-verified; the NAB "$1B / 5,200 businesses" and IBA "$5B–$7B" figures are not.

**Regional Arts Australia:** All giving figures and director names are DB-cited but not re-verifiable this session. Ros Abercrombie's exec title and the two RAA-WA chair records are unconfirmed. The QLD Regional Program Administrator (likely Flying Arts Alliance), the "July 2026 round opens" date, and the $20K–$60K grant band are all unconfirmed.

**Cross-cutting (every brief):** Goods traction figures (496 beds, 9 communities, 16 washers, 2,660kg plastic, $741,111 to date), bed unit economics ($750 / ~$421–426 / ~338 break-even), the QBE Stage 2 parameters ($400K/$150K, Sep 2026, judged on matched funding, 31 Aug deadline), the "repayable carries highest match value" scoring claim, the clauses cl 7.3 / cl 5.3, and the Supply Nation 51 percent / 1 Jul 2026 tightening are all from internal/program inputs, not independently re-verified. Confirm against the Goods source-of-truth and the actual QBE/SIH agreement before relying on them.

---

## Next actions (sequenced)

Backwards-planned from the 31 August 2026 keystone (signed ~$400K match-eligible) → September 2026 QBE Stage 2 submission.

**This week (w/c 23 Jun) — open the two warm catalytic doors and confirm the gate**

1. **Confirm Goods clears Supply Nation 51 percent First Nations ownership before 1 Jul.** This gates SEFA, FAC and IBA. Do this first; it is the single biggest cross-target risk.
2. **SEFA — advice-first to Hanna Ebeling.** Reopen on the QBE-application mention. Opener: ask for 20 minutes on structuring growth capital against the production ramp, "not asking for a commitment yet, asking for your eye on the structure." Attach the send-same-day pack (impact + unit-economics sheet, QBE one-pager with credit line, term-sheet skeleton flagging cl 7.3/5.3, entity note).
3. **Snow — advice-first to Georgina Byron.** Reference the loan path she floated; loop Craig Betts for mechanics. Attach traction one-pager, recoverable-loan term outline with the distribution-credit note, QBE credit line, Butterfly DGR/PBI evidence.
4. **Verify before naming anyone:** SEFA board (sefa.com.au/board), Snow Craig Betts title, LMCF current board (greatermelbournefoundation.org.au), Centrecorp board, FAC current titles. Do not send any name flagged in Verification.

**By ~30 Jun — first movers in motion**

5. **Centrecorp — advice-first to Steven Satour**, from inside the draft-receivable thread. Re-source the washing-machine fit fact before using it.
6. **Request the Snow → Ben Smith intro to PRF** ("we'd value Ben's read on structuring recyclable catalytic capital").
7. **Request the SIH → QBE → FAC warm intro** (QBE already funds FAC). Target Brian Wyborn / the Investment Committee.

**July — term sheets and the entity window**

8. Clear cl 7.3 and cl 5.3 internally, in parallel not in series.
9. Confirm Butterfly signing authority is settled through the ~end-Jul stewardship handover before papering any DGR-routed instrument.
10. SEFA indicative term sheet; Snow recoverable instrument drafted. Open the LMCF conversation via SEFA. Open the IBA/NAB advice conversation so the credit case is in motion.

**August — close the keystone**

11. Counter-sign the first signature (Snow or SEFA) by **mid-Aug** for buffer. Land one first mover and cite the momentum to every later conversation.
12. Stack: bank Centrecorp's grant as corroborating signed match; carry PRF/FAC/IBA as anchor signals (LOI or term-sheet-in-train) into the Stage 2 narrative even if they ink in Sep/Oct.
13. **By 31 Aug:** ~$400K signed, match-eligible commitment closed.

**September — submit**

14. Submit the QBE Stage 2 grant application (up to $400K, $150K floor), evidenced by the signed match, carrying the credit line on every page.

**Single highest-leverage next action:** send the advice-first note to Snow Foundation's Georgina Byron this week to convert the pending tranche into a recoverable instrument — Snow is the warmest, most structurally-ready lever, the highest-probability first signature, and the bridge to both PRF and FRRR.
