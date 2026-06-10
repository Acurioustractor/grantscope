# Goods on Country — Engagement Engine Review & QBE Rhetoric Pack
**Date:** 2026-06-10 · **Author:** Claude session (review + GHL pull + Gmail sweep + costing-model synthesis)
**Provenance:** Xero-verified figures from `goods-cost-evidence.ts` / `goods-canonical-numbers.ts` / bed-cost-model-v3 CSVs (2026-05-28); GHL figures pulled live 2026-06-10 (pipelines API); email facts from Gmail threads read 2026-06-10; QBE rules from `data/goods-qbe-diagnostic.json` (Notion sync 2026-06-10). Anything marked *(unverified)* is exactly that.

---

## 0. The one-paragraph answer

The command center already serves philanthropy discovery and proof well, but the **highest-leverage action this week is off-platform**: SIH/QBE asked for our financial model on 1 June (Jay Boolkin → send to Matt Allen, Malcolm Aikman QA) and **we have not sent it — 9 days and counting, with the cohort check-in on 18 June and Stage 2 application due September**. The cost model v3 (2026-05-28) is exactly what they asked for. Everything else — LOI conversion (Snow, Centrecorp 26 Jun board, Bryan 6–7 Jul visit), buyer pipeline activation (WHSAC $1.7M signal), and the app gaps below — sequences behind that send.

---

## 1. This week's action stack (ranked)

| # | Action | Why now | Owner |
|---|--------|---------|-------|
| 1 | **Send cost model v3 + assumptions to Matt Allen (SIH)**, propose workshop dates before 18 Jun check-in | Gates QBE Stage 2; requested 1 Jun, unanswered | Ben/Nic |
| 2 | **Email Randle Walker**: confirm 130-bed proposal ($106,150, GHL) is on Centrecorp's **26 June board agenda**; ask what the board pack needs. Note: last *email* was 13 Feb — the order lives in phone/GHL only | Largest near-term sale + matched-capital LOI candidate | Nic |
| 3 | **Ask Snow to convert the won grant into a signed matched-capital LOI** for QBE (and send airport-display wrap-up). Email contacts: Sally Grimsley-Ballard, Georgie Byron, Maree Meredith — *not* Carolyn Ludovici (zero email history despite being the GHL contact) | Snow is the ONLY near-signed LOI; QBE needs 3+ by 31 Aug | Ben |
| 4 | **Send Katie Norman (TFFF) 2–3 concrete June dates** ("see you in June" — it's 10 June, nothing locked); reply to Richard Brooking re Witta visit | Warm window closing | Ben |
| 5 | **Open SEFA thread with Chelsea Baker** re debt/blended capital as LOI candidate — no capital conversation exists in email at all | Stack lists SEFA but there's no substrate | Ben |
| 6 | **Prepare Bryan Foundation site-visit agenda (6–7 Jul) with a specific matched-capital ask**; confirm Matthew Cox accepted the invite | Live warm path #3 to an LOI | Nic |
| 7 | Chase Pene Curtis (Rotary Global Grant, silent ~2 months) + Tony Miles (Anyinginyi washing-machine quote from 9 Feb) | Both stale, both real money | Nic |
| 8 | Re-engage Paul Ramsay (Will Frazer/Jonas) with REAL Fund Stage 2 + Snow as momentum proof — 7 months dormant after a strong Oct–Nov run | Big-end dormancy is expensive | Ben |

**Park:** Minderoo — Lucy Stronach explicitly paused (14 May, internal reasons). No pitch; light Contained-in-Perth touchpoint in July. The campaign stack should mark Minderoo `parked`, not `in_conversation`.
**Verify:** "PFI" — no email substrate anywhere. Confirm what it refers to before keeping it in the capital stack.
**Fix:** ALIVE in the Buyer Pipeline ($60K) is the ALIVE National Centre (UniMelb research network — booklet photo thread, 1 Jun). It is **not a bed buyer** — reclassify. (This also resolves the ledger's open `mrff-uom-palmer` framing-match question.)

---

## 2. Command center review — does it do the five jobs?

### Job A: Find critical investment (QBE match campaign) — **7/10**
Served by Campaign, Governance (12-area diagnostic board), Money, Insight. Gaps:
- Campaign shows **$0 evidence-backed** because all 6 sources have `writtenEvidence: null` + `TODO(ben-verify)` (`goods-campaign-data.ts:86-168`). There is no in-app action to attach evidence/LOI links — the one number QBE counts can't be moved without a code edit.
- No use-of-funds / gross-vs-net ask breakdown (Diagnostic Area 04's named gap).
- Stage 1 target (**3+ signed LOIs by 31 Aug**) isn't surfaced as the campaign's headline metric — the page counts commitments, not LOIs.

### Job B: Find specific philanthropy — **8/10** (strongest job)
Foundations (DGR-gated TAM, warm bridges), Intros (board interlocks), Insight (GHL temperature + synced framing). Gaps: no min-giving/geography filters, no "already approached" guard, no outreach-status field — founders must round-trip through GHL.

### Job C: Community procurement / sell more product — **3/10** (weakest job)
- **Communities/buyers surface isn't in the command-center sub-nav at all** (`goods-sub-nav.tsx` — 11 tabs, no Communities); it lives under the wiki path.
- Money headline excludes buyers (`MONEY_TYPES` = funder/investor/finance only, `goods-money.ts:90`) — **procurement revenue is invisible** in the one place founders look at money.
- Funder Insight explicitly excludes buyer type (`goods-funder-insight.ts:18`) — no buyer next-move intelligence anywhere.
- GHL truth confirms the cost: the Buyer Pipeline holds **~$1.84M of signal (WHSAC Groote $1.7M, NLC Gapuwiyak $70.7K, ALIVE $60K mislabelled)** with *nothing* past "Qualified", while the actual live sale (Centrecorp 130 beds) sits in the **Supporter Journey** instead. Three of the four highest-value buyer signals (WHSAC, NLC, NPY, Hewitt) have **zero email history** — outreach queued but never sent.

### Job D: Key partners + advisory board — **5/10**
Governance board roster works; belonging ladder works. Gaps: **no advisory data model at all** (and QBE Area 07 warns "don't call advisory relationships a board" — we need a surface that holds them *as advisors*); board fields `appointedAt`/`termEndsAt`/`identifiesIndigenous` are NULL (columns exist post-PR #67 — this is founder data entry, not a migration); production partners share generic warmth cards with no capacity/geography metadata.

### Job E: Right finance for scaling (DGR / impact investment / loans) — **5/10**
Tracks exist (`REL_TRACK`, CapitalKind, Butterfly DGR chips) but there's **no instrument comparison**: nothing shows "SEFA debt needs X security, IBA needs Y, grants must route via Butterfly ABN 22 155 132 684, and *this mix* closes the QBE match fastest." `CapitalSource` has no repayment/rate/security/entity-required fields. No funding-mix scenario view.

---

## 3. GHL alignment — registry ↔ pipelines ↔ app

Pipelines pulled live 2026-06-10. The Goods estate in GHL:

| Pipeline | Opps | Live $ | State |
|---|---|---|---|
| Goods Supporter Journey (10 stages) | 49 | ~$5.4M face value* | Healthy shape; ~20 prospects parked at "Identified" with $0 |
| Goods — Buyer Pipeline (12 stages) | 14 | ~$1.84M | Everything ≤ Qualified; 5 federal MMR re-tender targets queued |
| Goods — Demand Register | (not pulled) | — | — |
| Grants (shared) | (not pulled) | — | — |

\* Face value includes QBE $2M and REAL/DEWR $2M opportunity records at "Ask made" — these are **pipeline, not committed** (QBE's own rule). The app's strict evidence-backed/pipeline split is correct; GHL's monetaryValue is where the registry's $244K "pipeline-as-committed" delta comes from.

**Misalignments to fix (all Tier 2 — your call):**
1. Centrecorp 130-bed order ($106,150) is in the *Supporter* journey at "Ask made" — it's a product sale; it should exist (or be mirrored) in the Buyer Pipeline so revenue forecasting sees it.
2. ALIVE $60K → reclassify (research partner, not buyer).
3. Snow's GHL contact (Carolyn Ludovici) doesn't match the real email relationships (Grimsley-Ballard / Byron / Meredith).
4. Julalikari sent an **inbound washing-machine RFQ** (Delaicee Power; Nic quoted 7 Jun incl. washable beds) — no Buyer Pipeline opportunity exists for it.
5. WHSAC/NLC/NPY/Hewitt: opportunities exist, email channel doesn't. Either log the real channel (phone) or send first emails — otherwise the warmth function reads them colder than they are.
6. The 5 unlinked tranche buyers (Julalikari, Mala'la, Our Community Shed, QIC, Red Dust) still need registry rows (carried from ledger).

---

## 4. Relationship next-steps register (from email, 2026-06-10)

| Relationship | Last contact | Court | State | Next step |
|---|---|---|---|---|
| SIH/QBE (Boolkin, Allen, Aikman) | 2 Jun | **Ours** | Model requested 1 Jun, not sent; check-in 18 Jun; Stage 2 due Sept | Send cost model v3 + propose workshop |
| Snow Foundation | 27 May | Ours | **Grant WON** (agreement sent 19 May); airport display just ended | LOI conversion ask + wrap-up |
| Centrecorp (Randle) | 13 Feb (email) | Ours | Board won't retro-fund or fund V.1; 130 × V.2 beds pitched; board 26 Jun | Confirm agenda + board pack needs |
| TFFF (Katie Norman) | 28 May | Ours | "See you in June", nothing locked; bonus intro: Richard Brooking | Send dates today |
| Bryan Fdn (Matthew Cox) | 9 Jun | Theirs | Site visit + brainstorm 6–7 Jul invited | Agenda with explicit matched-capital ask |
| Ian Potter (Alberto Furlan) | 1 May | Ours | "Early June" meeting proposed, never confirmed — window passed | Re-send invite + update pack |
| Brian M Davis (Bartak/Hopkins) | 28 May | Theirs | Warm but **ask-less**; Contained pitch to Sandy unanswered 13 days | Direct proposal to Sarah/Anita |
| Paul Ramsay (Frazer/Tashkandi) | 14 Nov 2025 | Ours | 7 months dormant after strong run | Re-engage with REAL Stage 2 + Snow proof |
| Rotary (Pene Curtis) | 13 Apr | Theirs, stale | Global Grant "in the system", partner-funding gaps | Chase + offer club-partner help |
| REAL Fund / DEWR | 2 Jun | Theirs | Stage 2 submitted on deadline (Oonchiumpa, Tanya Turner) | Diarise outcome check-in |
| SEFA | 16 Feb | — | **No capital thread exists** | Fresh thread to Chelsea Baker |
| IBA | — | — | **No email relationship** | Source intro via SIH/Snow networks |
| Minderoo (Stronach) | 15 May | Paused | Justice convos paused by Lucy | July non-ask touchpoint only |
| PFI | — | — | **Nothing in email — verify what PFI is** | Founder confirm |
| Miwatj (Madelyn Hay) | 11 Mar | Theirs, stale | Inbound interest Nov '25; $350 basket kits / ~$600 Jape bed quoted | Re-follow-up + Amy Elson intro to "Regina" |
| Anyinginyi (Tony Miles) | 13 Mar | Theirs | 4-washer quote sent 9 Feb, unanswered; also Rotary grant partner | Chase quote |
| Julalikari (Delaicee Power) | 7 Jun | Theirs | **Inbound RFQ — washers + washable beds, quotes sent** | Track; add GHL opportunity |
| WHSAC / NLC / NPY / Hewitt | — | — | GHL opportunities with no email substrate | Start threads or log real channel |

Also spotted: Adapt Homes (SIH-brokered, meeting needs rescheduling); FRRR climate application alive (entity confusion clarified 2 Jun, awaiting FRRR); CBF NT round opens 1 Jul–31 Aug (via Our Community Shed); Snow×Oonchiumpa $100K "Test, Learn, Scale" draft (20 Mar) — a second Snow channel; **Wilya Janta cc-list carries Alberto Furlan + Georgie Byron + Katie Norman — three of our targets in one warm-intro fabric**.

---

## 5. The rhetoric pack — QBE-grade proposition

Built strictly from the QBE diagnostic rules (claim taxonomy: verified | modelled | target | future) and the bed-cost-model v3. **QBE's stated hard requirement: "Do NOT show up without the actual delivered unit cost report (last 50 beds)"** — investor language, not charity.

### 5.1 The spine (use everywhere)

> Goods on Country builds the bed that doesn't break — recycled-HDPE Stretch Beds designed for remote conditions, **496 bed units deployed across 9 communities** *(verified)*, **2,660 kg of HDPE diverted** *(verified, Stretch-only)*, **$650,910.79 of receivables paid** through A Curious Tractor *(verified, Xero, ties to the cent)*. We know our delivered cost to the invoice line, we know the margin band that makes scale honest, and we are raising matched capital to move production from supplier-fabricated to community-operated.

### 5.2 The cost story (the part QBE will not move without)

| Claim | Number | Label | Source |
|---|---|---|---|
| Fabricated bed, current supplier | **$600/bed** | verified | Defy INV-1507, Nov 2025, 25 beds |
| Bed kit (cut+finished) | $344.05 | verified | INV-1602 (92 + 50 kits) |
| Delivered cost by route | $602–702 road / $715–815 barge / $1,005–1,105 charter | modelled (freight verified per-pallet $808–1,480 Botany→Alice) | cost-evidence + Defy freight lines |
| Buyer price band | $850–1,200/bed | planning | cost-evidence |
| Production planning band | $550–650/bed | modelled | canonical-numbers |
| In-house at State 4 (raw shred, all in-house) | **$310/bed direct**, $160K new capex ($200K cumulative) | modelled | build-states CSV |
| State 5 (community plastic) | $320/bed direct, +$30K capex | modelled | build-states CSV |
| Fully-loaded today (100/yr) | $1,707/bed | modelled | volume-scenarios CSV |
| Fully-loaded at 500/yr State 4 | **$599/bed** | modelled | volume-scenarios CSV |
| Fully-loaded at 1,000/yr State 4 | $485/bed | modelled | volume-scenarios CSV |
| Scale vision | 5,000+/yr at ~$350/unit, 50–55% gross margin | **target** | goods.md |

**Decision band (state it — it's investor language):** ≥25% margin → scale aggressively; 15–24% workable; 5–14% red flag; <5% stop. At the $850–1,200 price band, State 1 today is margin-thin on remote routes; State 4 at 500/yr clears the 25% line on every route. *That sentence is the whole investment case.*

**Capex honesty rule (Area 11):** bed-level BOM is mostly verified; container/On-Country facility capex (~$100K) is **modelled pending vendor quotes** — never present it as quoted.

### 5.3 The capital architecture (which money does which job)

This is the "right type of finance" story, and it's also the DGR story:

1. **Philanthropy (via The Butterfly Movement Ltd — Item 1 DGR + PBI since 2012, ABN 22 155 132 684)** buys the *community side*: deployment subsidy (currently ~$2,500/bed at 100/yr, falling to ~$500/bed at 500/yr — fundraising-offset CSV), story/consent work, handover-of-ownership process. Tax-deductible, receiptable now. **Never say "Goods is DGR"** — DGR runs only through Butterfly (Area 09 rule).
2. **Catalytic/matched grants (QBE pool: $150K–$400K Stage 2 grants; cap for us UNCONFIRMED — never quote $400K)** buy the *transition*: the $200–230K States 4–5 capex that moves direct cost $600 → $310.
3. **Repayable capital (SEFA debt, IBA, Snow R4)** is serviced by the *margin the transition creates*: receivables track record ($650,910.79 paid, 17 Xero tranches, tied to the cent) + buyer pipeline are the repayment evidence.
4. **Procurement revenue ($850–1,200/bed)** is what makes 1–3 finite, not perpetual.

The QBE match multiplies every dollar in (1)–(3) that is **evidence-backed by 31 Aug** — pipeline is not committed capital, and the primary Stage 2 criterion is the amount of external capital secured. **Stage 1 deliverable: 3+ signed LOIs.** Current honest count: 0 signed; Snow is nearest; Centrecorp (26 Jun) and Bryan (6–7 Jul) are the live paths.

### 5.4 Pitch shapes per audience

- **Philanthropy (TFFF, Ian Potter, Bryan, Brian M Davis):** lead with verified deployment + the falling-subsidy curve ("your dollars per bed halve as volume grows — you're funding a machine that needs you less every year"). Route via Butterfly DGR. Separate verified asset metrics from modelled outcomes; **no clinical-outcome claims without partner evidence** (Area 02).
- **Impact investors (QBE, Snow R4):** delivered cost report first, decision band second, States 1→4 transition third, LOI ask fourth. Only Stretch Bed is a direct-sale product — washers are prototype/register-interest, Basket Bed archived, no Weave Bed references (Area 03).
- **Lenders (SEFA, IBA):** receivables history + buyer pipeline + margin-after-transition. Entity clarity: ACT Pty Ltd (t/a Goods on Country) is the trading/borrowing entity from 1 July; don't blur sole-trader/company/charity roles (Area 09).
- **Buyers (Centrecorp, WHSAC, councils, health services):** delivered price by route, proof pack (496 beds / 9 communities), local-jobs trajectory (States 4–5 = community fabrication wages, $38.83–$67.17/bed labour across wage scenarios), Indigenous-led governance trajectory (Butterfly handover 26 Jun).
- **Never, to anyone:** community-owned manufacturing as already transferred; pipeline as committed; QBE match as unlocked; advisory relationships as "a board"; management reports as audited; household/story data without consent.

### 5.5 Where this should live in the app

- **Proof Pack** already carries the reviewer-safe claims — add the §5.2 cost table as a "Unit economics" panel (claims pre-labelled, sources cited).
- **Campaign** — reframe headline to "LOIs signed: 0 of 3+ (due 31 Aug)" and add per-source evidence-attach action.
- **A `/goods/pitch` page** (or Proof Pack section) holding §5.1–5.4 as the canonical pitch source, claim-chipped, so every deck/email derives from one governed surface.

---

## 6. Build backlog (proposed slices, in order)

1. **Buyer side becomes first-class** — Communities into the sub-nav; buyers into `MONEY_TYPES`; a Buyer Pipeline tab mirroring Funder Insight (GHL stage, est. spend, next move). *Directly serves "sell more product".*
2. **LOI tracker on Campaign** — headline "N of 3+ signed LOIs, X days to 31 Aug"; per-source evidence attach (flips `writtenEvidence`); park Minderoo; resolve PFI.
3. **Unit-economics panel on Proof Pack** + `/goods/pitch` canonical rhetoric surface (content from §5).
4. **Instrument comparison on Campaign** — add repayment/security/entity-required metadata to `CapitalSource`; DGR-routing validator (grant-kind asks must route via Butterfly).
5. **Advisory surface on Governance** — `advisory` contact type, expertise tags, last-contacted, engagement ask (QBE Area 07-safe naming).
6. **GHL hygiene batch** (Tier 2, needs your go): Centrecorp order → Buyer Pipeline; ALIVE reclass; Snow contact fix; Julalikari RFQ opportunity; channel-log for WHSAC/NLC/NPY/Hewitt.

Founder data entry (unchanged from ledger, still the unlock): verify campaign rungs, reconcile 496/520, allocate 17 tranches, size open asks, board member fields.
