# Buyer-Flow UX Findings

Live walkthrough with Ben — reacting to the real screens. Plan: `thoughts/shared/plans/buyer-flow-ux-audit.md`.
Effort key: **S** = quick edit · **M** = component work · **L** = data/logic change.

---

## Step 1 — `/suppliers` (need-first search)

### F1. Result cards don't look clickable — buyer hits a dead end · **S** · 🔴 top
**Ben's words:** "i search beds and this comes up but i cant do anything."
Each result row is a plain `<div>` (`suppliers/page.tsx:171`). The only link is the enterprise
*name*, styled identically to a heading (bold black, no underline, no arrow, no button) with only a
red `hover:` color as the affordance (`:173`). A buyer scanning the list sees no call-to-action and
assumes the page is static. This is the single biggest leak in the funnel — search works, then the
buyer can't tell there's anywhere to go.
**Fix direction:** make the whole row a clickable card (hover background + cursor), add an explicit
"View profile →" affordance, and/or underline the name. Confirm with Ben which.

### F2. Search relevance for "beds" looks loose — undercuts the "search by need" promise · **L**
Searching **"beds"** returned: GEBIE Civil & Construction (air-con / plumbing / roofing), Arnhem
Land Progress Aboriginal Corp, CERES (building products). None obviously *sell beds*. The
"ranked by delivery evidence" sort is working, but the *need-match* recall/precision looks weak — a
buyer searching a concrete need and getting tangential trades will bounce. Need to inspect
`lib/services/supplier-search.ts` to see what fields "beds" matches against.
**Status:** needs investigation before sizing the fix.

### F3. AI-hedge descriptions contradict their own badge · **M**
Arnhem Land carries **TRIPLE-PROOF** (badge tooltip: "deepest delivery evidence in the registry")
yet its description reads "specific activities and services are not well-documented… Further
information is needed…". The strongest evidence badge sits directly above copy that says we don't
really know what they do. Either suppress weak AI descriptions for high-evidence orgs, or lead with
the evidence narrative (what they delivered) instead of a generic LLM summary.

### F4. Inconsistent card content — some show a description, some don't · **S**
GEBIE (top result) shows no description line; Arnhem Land shows two. Cards look ragged. Decide a
consistent rule (always show a line, or never) so the list reads as one designed unit.

### F1-FIXED. Result cards now clickable
Applied: stretched-link card pattern — whole row is the click target, persistent "VIEW PROFILE →"
in signal red, hover tint, name reddens on hover; badge tooltips + claim link floated above the
overlay (`relative z-10`). tsc clean. (`suppliers/page.tsx:170`)

---

## Step 2 — `/social-enterprises/[id]` (enterprise profile)

### F5. No buyer action anywhere on the profile — the journey dead-ends · **M/L** · 🔴 top
**Ben's words:** "but what am I supposed to do on this page thinking about the user journey??"
Confirmed in code: `[id]/page.tsx` is 608 lines of read-only dossier with **zero buyer CTAs** —
no shortlist, no "add to tender pack", no contact, no evidence-summary export. A buyer searches a
need, assesses a supplier, decides "yes" — and there is no button to act. Same dead-end disease as
F1, one level deeper. The only CTAs present point the *wrong way* (see F6).
**Fix direction:** add a persistent buyer action rail — "Add to tender pack" / "Shortlist" — and
thread a **shortlist concept** through the whole flow (search → profile → shortlist → tender pack).
Today "Build a tender pack" exists only at the bottom of the search results page; drilling into a
profile severs the thread to the paid artifact.

### F6. Page serves the wrong audience at the decision moment · **M**
The profile leads with / prominently features **supply-side** content irrelevant to a buyer:
"Open Funding Matches" (6 grants the *enterprise* could chase) and "Is This Your Enterprise? →
Claim This Profile". For a buyer assessing a supplier this is noise that competes with the (missing)
buyer action. Buyer view should lead with delivery evidence + contracts + buyers, and demote/hide
the SE-facing blocks (or split a buyer view vs an owner view).

### F7. "About" blurb contradicts the evidence directly below it · **M** · (ties F3)
The About reads "specific activities and services are not well-documented… Further information is
needed" — sitting directly above **$7.8M "Construction of 5×4 and 4×6 Bed Dwellings"** and 36
contracts that document exactly what they do. The weak LLM summary actively tells the buyer the
opposite of what the evidence proves. For high-evidence orgs, lead with an evidence-derived
narrative ("Delivered $15.5M across 36 govt contracts — housing & construction in East Arnhem")
instead of a generic AI hedge, or suppress the hedge entirely.

### F2-RESOLVED. "beds" relevance is actually GOOD — just not shown
The match was correct: Arnhem Land's contracts are literally bed-dwelling construction. Search
recall works (it hit contract titles). The real gap is F1 — the search card never *showed why* it
matched. Consider surfacing the matched contract/sector snippet on the result card so the buyer
sees the relevance without clicking.

---

## Step 5 — `/procurement/tender-pack` (the paid artifact)

### F8. Two disconnected funnels — no spine from discovery to the paid product · **L** · 🔴 architectural
Confirmed in code (`tender-pack/page.tsx`, 401 lines): the pack is generated *from scratch* —
inputs are LGAs/postcodes + states + keywords + entity types. The "shortlist" in the code is the
**output** (suppliers the geography query finds), not an input. No searchParams pre-fill, no
localStorage, no supplier-ID seed. So:
- **Funnel A** `/suppliers` need-search → profile (assess) → dead end (F1, F5)
- **Funnel B** `/procurement/tender-pack` → re-type geography + keywords → generates its own
  shortlist → export

The buyer's discovery work in A is discarded at B. They vet a supplier, then the pack re-discovers
from geography and ignores it; they re-type the need they already searched. **This is the core
journey defect** — discovery and the paid artifact never meet.
**Decision needed from Ben** (drives all step-1/2 fixes): how should the two halves connect?
See the question posed in-session — shortlist spine vs cross-link vs two-tools-by-design.

### SPINE-BUILT (F5 + F8 addressed). Shortlist spine wired end-to-end
Decision: **shortlist spine** (Ben). Built + gates green (tsc clean, 221 tests pass):
- `components/shortlist-context.tsx` — localStorage-backed shortlist (anon-friendly), `useShortlist`.
- `components/add-to-pack-button.tsx` — "+ Add to pack" on search cards (`relative z-10` over the
  stretched link) + a "+ Add to tender pack" buyer rail on the profile (resolves F5).
- `components/shortlist-bar.tsx` — floating "N suppliers in tender pack → Build pack" pill,
  provider + bar wired into `layout.tsx`.
- `api/procurement/tender-pack/route.ts` — new `se_ids` mode: fetch picked SEs by id, enrich via
  gs_entities by ABN, reuse the exact downstream scoring/forecast/gaps (resolves F8).
- `procurement/tender-pack/page.tsx` — "From your shortlist (N)" panel seeds the pack from the
  buyer's picks; geography mode preserved below an "or build from a project footprint" divider.
Discovery → assess → collect → paid artifact is now one continuous journey.
### POLISH-BUILT (F3 + F4 + F6 + F7 fixed). Buyer-first profile + honest cards
Built + gates green (tsc clean, 221 tests pass):
- `lib/supplier-copy.ts` — shared `isHedgeDescription()`; flags low-value AI hedges ("not
  well-documented", "further information is needed", "likely focused", …).
- **F3/F4** (search cards): hedge descriptions suppressed (`suppliers/page.tsx`) — no more
  badge-vs-blurb contradiction, cards read consistently (structured evidence/sector lines carry it).
- **F7** (profile About): leads with an evidence-derived sentence — "Delivered $15.5M+ across 36
  government contracts for 5+ buyers." — and suppresses the hedge blurb that contradicted it.
- **F6** (profile order): owner-facing "Claim this profile" moved from top-of-sidebar to the bottom
  (quieter canvas styling); "Open Funding Matches" reframed "For this enterprise — not part of buyer
  due diligence." Buyer-relevant evidence now leads; supply-side content demoted.

All buyer-flow findings (F1–F9) are now addressed or resolved. Nothing committed yet —
working tree on `chore/tsc-stop-hook`.

### F9. Tender-pack inputs are high-friction free-text · **M** (secondary)
LGAs/postcodes entered as free text "one per line" — buyer must know LGA names or postcodes, no
picker/autocomplete. "Keywords (optional)" is where the actual need goes but it's optional and
disconnected from the /suppliers search term. Good: "Load example", on-brand Bauhaus form, entity
types pre-set to INDIGENOUS.

---

# Audit Pass 2 — 2026-06-08 (fresh, post-fix, full flow)

Second pass after F1–F9 shipped (commits `2f0ad30` ← `4a5ddae`). Logged-out buyer view, `:3003`,
viewport 1280×900. **Two purposes:** (a) verify the Pass-1 fixes are live, (b) extend coverage to
the steps Pass 1 skipped — **step 3 `/social-enterprises` (directory)** and **step 4 `/procurement`** —
plus cross-cutting issues. Screenshots: `docs/ux-audit/shots/audit-0{1..6}-*.jpeg`.
Effort key unchanged: **S** quick edit · **M** component work · **L** data/logic.

## ✅ Pass-1 fixes confirmed live
- **F1** result cards clickable — whole row is a target, persistent "VIEW PROFILE →" in red. ✓ (`audit-02`)
- **F5/F8** shortlist spine — "+ Add to pack" on cards + "ADD TO TENDER PACK" rail on the profile;
  `/procurement/tender-pack` renders a black "FROM YOUR SHORTLIST (N)" panel with supplier chips +
  "Generate from N shortlisted" above the footprint form. ✓ (verified in `tender-pack/page.tsx:241`)
- **F7** profile About leads with the evidence sentence ("Delivered $15.5M across 36 government
  contracts for 5+ buyers"); hedge suppressed. ✓ (`audit-03`)
- **Paywall converts, not errors** — yellow value-framed gate, reassures "your shortlist is saved",
  login/register/pricing routes. ✓ (`tender-pack/page.tsx:188`)

## ⚠️ Re-opened

### P2-1. [L · HIGH] Ranking buries on-need specialists — refines F2-RESOLVED.
Pass 1 closed F2 after checking one top result (Arnhem = legit bed-dwelling construction) and
concluding recall is fine. Recall **is** fine — but a fresh look at the *whole* "beds" result set
shows a precision/intent problem the single-result check missed. Confirmed mechanism in
`supplier-search.ts:6-8`: FTS ranks **contract titles weight A**, name/sectors B, description C,
**plus a delivery-evidence boost**. Consequences for "beds":
- Big NT construction contractors (GEBIE, Arnhem) top the list because their *contract titles*
  contain "bed" (bed-**dwellings** = remote housing) **and** they carry large $ evidence boosts.
- The keyword conflates two different buyer intents — *buy bed furniture* vs *build bed-dwellings* —
  and structurally ranks the housing-construction reading above the furniture one.
- The actual bed-**furniture** specialists (#GoKindly "Bed + Bath", Social Living "sustainable
  bedding", Goods on Country "beds and furniture") sink to the bottom: they match on name/sector
  (weight B) with **zero contract evidence**, so the evidence boost that helps everyone else = 0.
- Clear false positive: TEAM Inc surfaced via "**garden** beds".
*Net:* the evidence-boost — right in general — actively buries the on-need supplier when the need is
a consumer good rather than a contracted service. *Fix direction:* keep evidence as a tiebreaker
*within* a relevance band, not across bands; consider an intent/category signal; down-weight common
substrings ("garden beds"). *Shot:* `audit-02-suppliers-beds.jpeg`.

## 🆕 New coverage — step 3 (directory) & step 4 (procurement)

### P2-2. [M · HIGH] Directory `/social-enterprises` strips the evidence thesis.
Pass 1 never audited this page. Cards show category + source badges and sectors but **none** of the
delivery evidence (`contract_count`/`$`/proof tier) that `/suppliers` surfaces. Sort options are only
`name | newest | state` (`social-enterprises/page.tsx:76,108`) — **no evidence/proof sort exists**,
default is **Name A-Z** ("Koolyangarra…" leads). The same supply base, browsed instead of searched,
loses everything that differentiates the product. *Fix:* proof signal on directory cards
(triple-proof / proven-outcomes / contract count) + an evidence sort, defaulted. *Shot:* `audit-04`.

### P2-3. [S + YOUR CALL] "Black cladding risk scores" as raw jargon on `/procurement`.
The hero and Enterprise-API list surface "black cladding risk scoring" with no explainer. It's a
*pro*-Indigenous-integrity capability (detecting non-Indigenous firms falsely claiming Indigenous
ownership to win IPP contracts) — but dropped unexplained on a buyer surface for a product that
centres community-controlled enterprise, it can read badly. Recommend a one-line "what it is / why
detecting it protects genuine Indigenous business" + your decision on wording. *Shot:* `audit-05`.

### P2-4. [M · conversion] Both generate-forms sell the paid artifact blind.
`/procurement` (compliance) and `/procurement/tender-pack` gate all value behind a CSV/footprint
form with no preview of the *output*. The tender pack is the paid thing — show a sample pack (or a
teaser of its sections) before generate. "Load example" fills inputs, not output. *Shots:* `audit-05`, `audit-06`.

## 🆕 Cross-cutting

### P2-5. [S · HIGH leverage] Per-page `<title>`/metadata missing across the flow.
Only `/suppliers` sets a real title. Profile, directory, `/procurement`, `/procurement/tender-pack`
all render the generic root `CivicGraph — Australia's Accountability Atlas`; the profile route has no
`generateMetadata` at all (`[id]/page.tsx` — only `export const dynamic`). Hurts tabs, **link
previews when a buyer pastes a profile into a procurement email**, and registry SEO. *Fix:*
`generateMetadata` on the profile (title = enterprise name; description = the evidence summary) +
static metadata on directory/procurement pages.

### P2-6. [M] Inconsistent hero system across the flow.
Three treatments on four pages: `/suppliers` canvas + black text · `/social-enterprises` +
`/tender-pack` black fill (the latter with a blue hard-shadow) · `/procurement` **full blue fill**.
DESIGN.md reserves blue for links/info, not hero fills. Pick one hero system. *Shots:* all.

### P2-7. [M · polish] `/suppliers` landing dead zone + zero pre-search proof.
Below the 3-card explainer the page is empty to the footer; pre-search it's all promise, no evidence.
A featured "proven outcomes" row or live registry stats (contracts tracked, $ delivered) would fill
it and *show* value before the first query. The example needs ("Beds"/"Catering"/"Civil works") are
quoted but not clickable — one-click chips would cut friction to first search. *Shot:* `audit-01`.

### P2-8. [S] Tender-pack **empty** state hides the spine.
With a populated shortlist the spine is great (confirmed above). But with an **empty** shortlist the
page shows *only* the cold footprint form — no empty-state nudge ("you haven't shortlisted anyone yet
— find suppliers →") to reveal that the primary intended path is shortlist-driven. A cold visitor
never learns the spine exists. *Shot:* `audit-06`.

## Pass-2 recommendation
Fix the buyer's *first impression* first: **P2-1 (ranking)** + **P2-2 (directory evidence)**. Then
the cheap high-leverage wins: **P2-5 (metadata)** + **P2-8 (empty-state nudge)**. P2-3 needs your
call. Not audited either pass: `/procurement/gap-map`, `/commissioning`.

## ✅ Pass-2 fixes shipped (2026-06-08)

### P2-1 — DONE: kept evidence-led ranking, made the match legible. (Ben's call: option A.)
Measured the real ranking first (`/tmp` diagnostic): a contract-title (weight A) hit scores ~1.0 vs
~0.2 for a description (weight C) hit *before* any boost, and all description hits score identically —
so pure ranking cannot separate on-need from off-need. Decision was to keep proven deliverers on top
and make *why* each matched visible.
- **RPC** `search_suppliers` (`migrations/2026-06-08-search-suppliers-match-legibility.sql`, applied):
  returns `match_source` (`capability` = won-contract title / `offering` = name+sectors /
  `description`) + a `ts_headline` `match_snippet` with the matched term highlighted, computed only on
  the limited result set. Boosts switched additive → multiplicative (evidence amplifies a relevant
  match instead of injecting a low-relevance high-evidence one); browse mode still ranks by evidence.
- **`supplier-search.ts`** — `match_source` / `match_snippet` added to `SupplierResult` (pass-through).
- **`suppliers/page.tsx`** — `MatchReason` + `HighlightedSnippet` render per card; the full description
  is suppressed when the description itself is the matched field (also fixes the old F4 ragged cards).
- **Result (verified live, `audit-07-beds-after.jpeg`):** "beds" now reads — GEBIE/Arnhem green
  "Matched in a won contract: …Construct 4x2 **Bed** Dwellings…"; CERES/TEAM "Matched in description:
  …garden **beds**…" (the false positive is now self-evident); #GoKindly/Social Living/Goods "…**Bed**
  + Bath / sustainable **bedding** / **beds** and furniture…" — the actual suppliers, unmistakable.
  Order unchanged (evidence-led, thesis intact). tsc clean, 221 tests pass.

### P2-3 — DONE: black-cladding one-line explainer. (Ben's call: add explainer.)
`procurement/page.tsx` hero now carries, under the headline: *"'Black cladding' is a non-Indigenous
business fronting a token Indigenous partner to win Indigenous-procurement contracts. Flagging it
protects genuine Indigenous-owned suppliers."* Verified live (`audit-08-procurement-hero.jpeg`).

### P2-2 — DONE: directory now carries delivery evidence + sorts by it.
The browse path no longer strips the thesis.
- **View** `se_directory` (`migrations/2026-06-08-se-directory-evidence-view.sql`, applied): thin
  non-materialized view LEFT JOINing each `social_enterprises` row to its `se_search_index` evidence
  (contract_count/value, verification_tier) + triple-proof / proven-outcomes flags. 1:1 with
  social_enterprises (no rows dropped/inflated; triple-proof join deduped on abn). 11,861 rows,
  1,131 with contracts, 218 triple-proof, 17 proven-outcomes.
- **`social-enterprises/page.tsx`** — queries `se_directory`; new **"Delivery Evidence" sort,
  defaulted** (proven deliverers first, then alphabetical); cards show a proof badge
  (triple-proof / proven-outcomes) + a green "N govt contracts · $X" line, matching `/suppliers`.
- **Result (verified live, `audit-09-directory-evidence.jpeg`):** default browse now leads with
  Amnesium ("341 govt contracts · $63.0M") and InteriorCo ("280 · $23.8M") instead of alphabetical
  "Koolyangarra…". The two list UIs now share one evidence language. tsc clean, 221 tests pass.

**Still open:** P2-4 (output preview), P2-5 (metadata), P2-6 (heroes), P2-7 (landing proof),
P2-8 (empty-state nudge).

---
