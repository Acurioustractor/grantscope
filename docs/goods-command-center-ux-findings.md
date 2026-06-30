# Goods Command Center — UX findings (`/polish`)

**Surface:** `/org/act/goods/*` (ACT org Goods workspace) · **Started:** 2026-06-22 · **Mode:** audit-first
**Method:** dev server :3003 (running, reused); ACT slug renders without login via the `shouldUseFastLocalOrg()` bypass in `org/[slug]/layout.tsx` → screenshots feasible. Rubric: Clarity / Value-shown / Meaning / Aesthetic / Friction (see `.claude/skills/polish/references/rubric.md`).

> ## ▶ RESUME HERE (after `/clear`) — updated 2026-06-22, end of session
> **DONE this session (PR #100, branch `feat/goods-registry-entity-resolution`, commits `5cb1819` + `be58841`, pushed + verified live):**
> - Batch-1 visual pass = 5 tabs audited (buyers · funnel · pitch · proof · money). See "Phase 1b" below.
> - **B1 fixed** — buyers no longer leads with `$0·$0·$0` (conditional hero). **Fn1 fixed** — name unified to "Goods".
> - **G1 done** — new hub front door `/org/act/goods` (`page.tsx`), reachable from all 15 crumbs. **G2 answered** (spine = the two nav rows).
>
> **QUEUE (pick one to resume):**
> 1. **Apply the GRANT (Tier 3, fastest win):** power/funding chips on buyer cards are silently empty — `GRANT SELECT ON v_goods_relationship_power, v_goods_relationship_funding TO anon, authenticated, service_role;` then re-screenshot `/org/act/goods/buyers` to confirm chips populate. (See B3-UPGRADED below.)
> 2. **Confirm P2/P3/Pr1** (design-intent items held, not changed — see the reclassified block below).
> 3. **Batch-2 audit:** the other 9 tabs (foundations · intros · signals · timeline · governance · insight · engagement · campaign · communities) — re-invoke `/polish goods command center`, screenshot each (dev server :3003, ACT slug renders logged-out), append findings, fix top ones.
>
> Dev server: `npx next dev --turbopack -p 3003` (was pid 52483, not ours — check `lsof -i:3003` first).

## The surface is bigger than remembered — 14 tabs (memory said 9)
Routes under `apps/web/src/app/org/[slug]/goods/`:
`buyers` · `campaign` · `communities` (+ `community/[communityId]`) · `engagement` · `foundations` · `funnel` · `governance` · `insight` · `intros` · `money` · `pitch` · `proof` · `signals` · `timeline`

## Visual-audit plan (outside-in: revenue/buyer-first per the wedge)
One screen per iteration; screenshot logged-in ACT view at 1280×900 → `docs/ux-audit/shots/`. Priority order:
1. `buyers` (Buyer Pipeline — the revenue surface) · 2. `funnel` · 3. `pitch` · 4. `proof` (evidence = value-shown core) · 5. `money` · 6. `foundations` · 7. `intros` · 8. `signals` · 9. `timeline` · 10. `governance` · 11. `insight` · 12. `engagement` · 13. `campaign` · 14. `communities`

---

## Phase 1 — Findings (append only; never rewrite prior passes)

### Structural (caught pre-screenshot, from routes + rendered HTML)

**G1 — No Goods hub / front-door** · *Clarity* · **M**
There is no `/org/[slug]/goods/page.tsx`. `/org/act/goods` has no landing page — a user must deep-link straight into a tab (e.g. `/goods/buyers`). No orientation, no "start here", no summary of the 9–14 areas. The workspace has no front door. → Decide: add a hub/overview page, or designate one tab as the canonical landing + redirect.

**G2 — 14-tab sprawl, no obvious spine** · *Clarity / Friction* · **M–L** *(confirm visually)*
14 tabs is heavy cognitive load for a command center. Unclear which is the primary action / daily driver vs. reference. Outside-in question to answer at screenshot time: *does a first-time user know what to do first, or is it a wall of equally-weighted tabs?*

**G3 — Nav likely duplicated, not shared** · *Aesthetic / consistency* · **M**
38 `href=.../goods/<tab>` link sites across `.tsx` files, with tab links appearing inside individual page files (`intros`, `signals`, `pitch`, `timeline`…). Suggests the tab nav is repeated per-page rather than one shared `<GoodsNav>` — the same drift risk as the rubric's "three different hero systems" class. → Confirm whether a single nav component exists; if not, that's a consolidation fix.

### Per-tab visual findings

## Phase 1b — Visual pass (2026-06-22)
Logged-in ACT view, 1280×900, shots in `docs/ux-audit/shots/` (also repo-root `audit-NN-*.jpeg`). One tab per iteration, outside-in.

---

### TAB 1 — `buyers` (Buyer Pipeline) · shot: `audit-01-buyers-top.jpeg`
Confirms G3 is largely resolved: the page uses the shared `goods-sub-nav` with a smart two-row split — **WORK THE PIPELINE** (Warmth Map · Funder Insight · Signals · Timeline · Money · Buyer Pipeline · Match Campaign · Funnel) and **SHOW THE EVIDENCE** (Proof Pack · Pitch · Warm Intros · Foundations · Governance). That split is a real spine — it answers part of G2 (pipeline-work vs evidence are the two jobs).

**B1. The revenue surface leads with `$0 · $0 · $0` · M · 🔴 top**
The hero band (largest element on the page) reads **`$0 RECEIVED (LIFETIME)` · `$0 OPEN ASKS` · `Expected (stage-weighted) $0`**, and a stat card repeats **`REVENUE RECEIVED $0`**. Verified in DB (not a broken rollup, so honest — no `/ground` HOLD): all 117 `buyer` rows in `goods_relationships` have `ask_amount_aud = 0` and `total_received_aud = 0`. (Funders DO carry amounts: $3.51M ask / $895K received — so the money model works, buyers just have no amounts entered.) Result: the most-built surface's first impression is three giant zeros = looks empty/broken. *Value-shown + Meaning miss.*
**Fix direction:** make the money hero conditional. When received & asks are both 0, drop the three-zero hero and lead with the signal that DOES exist — **117 buyers · 117 open conversations · 114/117 GHL-linked · warmth scores** — with a quiet "no $ amounts recorded yet → add asks" empty-state line, not a definitive `$0 RECEIVED (LIFETIME)`. (Same class as P2-8 empty-state-hides-the-path.)

**B2. Hero band is a blue fill · S · aesthetic**
The summary band uses a blue border + light-blue fill (`bauhaus-blue` family) as the page's hero element, and `$0 OPEN ASKS` is rendered in hero blue. DESIGN.md/rubric: **blue is link/accent, never a hero fill** (P2-6 class). Black fill + blue hard-shadow is the house hero. Low priority; fold into the B1 rework.

**B3. 2 console errors on the revenue surface · S · friction (unchecked)**
Playwright reported 2 console errors + a floating "2 Issues" chip on load. Not yet diagnosed — flag to check they aren't a failing buyer-data query (would turn B1 from "honest empty" into "broken"). Cheap to verify.

---

### TAB 2 — `funnel` (Goods Funnel) · shot: `audit-02-funnel-top.jpeg`
**Strongest surface in the workspace so far.** Clear thesis ("one need, two funding routes, one delivery"), a COCKPIT strip (NEED 12,504 beds → ORDERED → FUNDED → DELIVERED 520 → GAP 11,984), and a 3-column pipeline (Need / Procurement / Support) all collapsed to one consistent 5-stage spine (IDENTIFIED→QUALIFIED→COMMITTED→DELIVERING→CLOSED→DEAD). High clarity, strong value-shown (the gap is the meaningful number and it's front-and-centre).

**Fn0. The funnel cockpit already IS the G1 hub — DECISION for Ben · architecture**
This page does exactly what the proposed `/org/act/goods` front-door should do: one-glance summary + links into the spine. Options: (a) build the new hub by reusing this cockpit component; (b) promote `funnel` toward the front door and make the hub a thin wrapper; (c) keep them separate (hub = workspace index, funnel = need→delivery model). → Ben's call; folds into G1.

**Fn1. Breadcrumb / workspace name drifts: "Goods OS" vs "Goods" · S · aesthetic/consistency**
Funnel breadcrumb = "A Curious Tractor / **Goods OS** / Funnel"; buyers breadcrumb = "A Curious Tractor / **Goods** / Buyers & Procurement". Same workspace, two names one click apart. Pick one (Goods / Goods OS / Goods on Country) and use it in every breadcrumb + nav label.

**Fn2. "Delivered is a cited constant — Goods v2 assets sync" jargon · S · meaning**
The DELIVERED provenance note uses internal jargon ("cited constant", "v2 assets sync"). Honest but opaque to anyone but us. Reframe plainly ("520 beds delivered to date · last synced 27 May 2026") or move to a tooltip.

---

### TAB 3 — `pitch` (Pitch / source-of-truth) · shot: `audit-03-pitch-top.jpeg`
Most DESIGN.md-aligned surface so far. The **CLAIM TAXONOMY** legend (VERIFIED blue / MODELLED yellow / TARGET / FUTURE) surfaces the provenance system as a first-class element — strong Meaning/honesty, exactly the "value-shown" the rubric rewards. THE SPINE is a single quotable proposition paragraph. Breadcrumb here = "Goods" (matches buyers, not funnel → confirms Fn1).

**P1. The spine is built to be quoted but likely has no copy affordance · M · friction**
Copy says "Every deck, email and one-pager should derive from this" / "Quote it whole." If there's no one-click **Copy the spine** button (and per-stat copy), the thing explicitly designed to be pasted into decks/emails isn't one-click — the P2-7 friction class. Confirm in `pitch/page.tsx`; if absent, add copy-to-clipboard on the spine paragraph.

**P2. `$650,910.79` cent-precision inside the quotable spine · S · meaning/aesthetic**
Receivables shown to the cent in a proposition meant to be quoted whole reads like a raw DB figure, not a crafted pitch line. Round in the spine ("$650K+ of receivables") while keeping the exact figure in the governed claim detail. House-style call → Ben.

**P3. "QBE" never expanded · S · meaning**
"QBE-grade", "QBE DIAGNOSTIC AREA 01/04" — acronym unexplained on a surface whose whole point is rigor. Expand once or drop the label. (Recurs on `proof` — same shared CLAIM TAXONOMY component, so a one-place fix.)

---

### TAB 4 — `proof` (Proof Pack / evidence core) · shot: `audit-04-proof-top.jpeg`
Second-strongest surface. Evidence-first done right: 4 VERIFIED stat cards (496 deployed beds · 9 communities · 2,660 kg HDPE diverted · 4% of demand met / 11,984 unmet), every figure dated "as of", a **PRINT / SAVE AS PDF** export top-right, and copy that earns trust ("Every figure is sourced… Nothing here is invented", links to the live Asset Register). Reuses the same CLAIM TAXONOMY component as pitch (good consolidation).

**Pr1. Stat-card border colours don't follow DESIGN.md semantics · S · aesthetic**
Cards use red / black / red / yellow borders seemingly decoratively. In the system red = danger/alert, yellow = caution. So "496 DEPLOYED BED UNITS" (a win) sits in a **red** alert-border, while the genuine caution ("4% met · 11,984 unmet") is yellow — only the last is semantically right. Map border colour to meaning (neutral/black for wins, yellow for the gap) or make them uniform.

**Pr2. Two close bed counts: 496 "deployed bed units" vs 520 "internal assets sync" · S · meaning (verify intentional)**
Proof shows 496 (VERIFIED, as of 2026-06-01) and 520 (assets sync, as of 2026-05-28); funnel's DELIVERED also = 520. Honest (different labels + dates) but invites "which is the real number?" Confirm the labels disambiguate clearly enough, or add a one-line tie ("520 in the asset register; 496 confirmed deployed to homes").

---

### TAB 5 — `money` (Money: Received & Available) · shot: `audit-05-money-top.jpeg`
**Model financial surface.** Three clean buckets (received / in play / available to pursue), real figures ($3.3M ask · $2.0M stage-weighted expected · $895K received · $651K Xero-paid), procurement kept explicitly separate, and a reconciliation row — **XERO PAID [VERIFIED] $651K vs REGISTRY RECEIVED [MODELLED] $895,611, DELTA $244,611** (red) — that names its own discrepancy. Strong Value-shown + Meaning.

**M1. Money tab is the reference implementation for the B1 fix · (cross-ref, not a defect)**
Here the $0 procurement is handled exactly right: a quiet "SEPARATE TRACK · Procurement $0 received · $0 open ask · 117 buyers · **Buyer pipeline →**" footnote, NOT a hero. The buyers tab (B1) should adopt this same move — relegate the $0, lead with the count + a cross-link. Copy this pattern rather than inventing a new empty-state.

**M2. CORRECTION to B2 — the light-blue band is a consistent convention, not drift · (downgrade)**
The light-blue fill band marks "pipeline / in-play / stage-weighted expected" money consistently across `buyers`, `funnel`, and `money`. That's a deliberate convention reading as "blue = information/in-play," defensible under DESIGN.md, **not** the P2-6 saturated-blue-hero violation. So B2 is downgraded: keep the convention, just (a) never let it become a *saturated* blue fill, and (b) on `buyers` the band currently fills with $0 — once B1 makes that band conditional, the blue-band issue resolves itself. No standalone fix needed.

---

## Visual pass — batch 1 complete (5 of 14 tabs: buyers · funnel · pitch · proof · money)
The revenue + evidence core is audited. Headline: the surface is **mostly strong** — funnel/proof/pitch/money are well-built, honest, on-brand. The one real leak is **B1** (buyers leads with $0×3), and `money` already shows the fix. Remaining 9 tabs (foundations · intros · signals · timeline · governance · insight · engagement · campaign · communities) are batch 2 — lower priority per the outside-in order.

---

## Phase 2 — Fixes applied (2026-06-22) · `cd apps/web && npx tsc --noEmit` = clean (exit 0)

### B1-FIXED · before `audit-01-buyers-top.jpeg` → after `audit-06-buyers-after.jpeg`
Buyer hero band is now conditional on `hasMoney = totalReceived>0 || openAskTotal>0` (`buyers/page.tsx`). With no amounts entered (current real state) it leads with **`117 BUYERS IN THE PIPELINE · 117 OPEN CONVERSATIONS · 114/117 linked to GHL`** and an honest footnote ("No revenue or ask amounts recorded yet — enter asks and lifetime revenue in the warmth registry to size the pipeline. Cash received reconciles against Xero…"), instead of three giant `$0`s. When amounts exist later, it reverts to the money hero automatically. Secondary "Revenue received" stat caption now reads "None recorded yet" when 0. **Verified live** in `audit-06`.

### Fn1-FIXED · before `audit-02-funnel-top.jpeg` → after `audit-07-funnel-after.jpeg`
Workspace name unified to **"Goods"** (Ben's call) across the three drifted breadcrumbs (`funnel`, `communities`, `community/[id]`). Also re-pointed those crumbs from `/wiki/goods-operating-system` → `/org/${slug}/goods/funnel` so the "Goods" crumb means one destination everywhere (matches buyers/pitch/proof/money). When the G1 hub ships, flip all "Goods" crumbs `/goods/funnel` → `/goods`. **Verified live** in `audit-07` (crumb now "A Curious Tractor / Goods / Funnel").

### B3-UPGRADED → real bug: power + funding chips silently absent on Buyer Pipeline · L (DB GRANT) · 🔴 · BEN'S CALL (Tier 3)
The 2–3 console errors were not noise. Confirmed: `permission denied for view v_goods_relationship_power` and `…_funding`. Both views grant SELECT only to `postgres` + `agent_readonly`; the app connects as `anon`/`authenticated`/`service_role` (which the base `goods_relationships` table DOES grant). Result: the **PowerChip + FundingChip** shipped on buyer cards (commits `19b4966`/`f26ac59`) render empty — a built feature invisible on the revenue surface (value-shown miss). The page degrades gracefully (services return empty maps), so it's silent.
**Fix (Tier 3 — Ben applies in dashboard/psql, not me):**
```sql
GRANT SELECT ON v_goods_relationship_power, v_goods_relationship_funding TO anon, authenticated, service_role;
```
After granting, the chips should populate (re-screenshot to confirm). Worth auditing whether other recent goods views shipped without the `anon/authenticated/service_role` GRANT.

### P2 / P3 / Pr1 — RECLASSIFIED as design intent, NOT drift (held, not auto-changed)
Reading the code (not just the render) showed these three "small wins" are deliberate, so per the skill they're routed to Ben rather than batch-applied:
- **P2 (cent precision `$650,910.79`)** — intentional. `goods-pitch-content.ts:217` literally frames it as "$650,910.79 paid across 17 Xero tranches, **tied to the cent**" — the cents are a rigor/trust signal, not sloppiness. Rounding the spine could weaken it. → Ben: keep, or round only in the prose spine while keeping the exact FACT card?
- **P3 ("QBE")** — intentional framework term used 5+ times (`QBE-grade`, `QBE Diagnostic Area 01/04`, "the part QBE will not move without", "QBE diagnostic guardrails"). `pitch`/`proof` read as internal governance surfaces, where the framework language is fine. → Ben: is `pitch` ever shown externally? If yes, gloss QBE once; if internal-only, leave it.
- **Pr1 (proof card border colours)** — intentional dual-audience scheme: red = impact/Country track (DESIGN.md's signature colour), blue = commercial/lender track, yellow = the gap (genuine caution). Coherent with the page's "two audiences" framing. The only subtlety: red also = alert banners on the same page (red does double duty). → Ben: accept the double-duty, or pick a non-red impact accent?

---

### G1-DONE · the hub front door is built · shot `audit-08-hub.jpeg`
New `apps/web/src/app/org/[slug]/goods/page.tsx` — "Goods Command Center". Reuses the funnel/money/buyers services (Ben's call: reuse the funnel cockpit) behind `Promise.allSettled` so a saturated query shows a dash, never 500s the front door. Renders a live **STATE OF GOODS** strip (520 beds delivered · 11,984 bed gap · $895,611 received · $3.3M in play · 117 buyers — all matching the tabs) and two "start here" card groups (Work the pipeline / Show the evidence) with live per-destination stats. `GoodsSubNav.active` made optional so the hub highlights no tab. **Reachability:** all 15 "Goods" breadcrumb crumbs re-pointed `/goods/funnel` → `/goods` (the hub now has a handle from every tab). **Verified live** in `audit-08`. Resolves G1 + answers G2 (the hub IS the daily driver / orientation; the two nav rows are the spine).

---

## Decisions only Ben can make
- **G1 — DONE (2026-06-22):** hub built (see G1-DONE above).
- **G2 — ANSWERED:** the workspace spine is the two-row split (Work the pipeline / Show the evidence) surfaced in `goods-sub-nav`; the new hub is the orientation/daily-driver front door. No tab needs demoting.
- **B3 GRANT (Tier 3):** apply `GRANT SELECT ON v_goods_relationship_power, v_goods_relationship_funding TO anon, authenticated, service_role;` to light up the power/funding chips on buyer cards.
- **P2 / P3 / Pr1:** held as design intent (cent precision, "QBE", proof card colours) — confirm or adjust at leisure.
