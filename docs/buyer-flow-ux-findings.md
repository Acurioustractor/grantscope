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
