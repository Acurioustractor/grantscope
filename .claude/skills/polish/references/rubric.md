# The value test — full rubric

Five dimensions. Each is a question you ask of a real rendered screen, plus the finding-classes it
reliably catches — every example below is a real finding from the buyer-flow audit
(`docs/buyer-flow-ux-findings.md`), so the rubric stays calibrated to Ben's actual taste, not a generic
heuristic. Rank findings by leverage: **Clarity and Value-shown beat the others** — a beautiful page
the user can't act on, or that hides the proof, is a worse miss than a hero-colour drift.

---

## 1. Clarity — "what is this, and what do I do next?"

In 3 seconds, can the user tell what the screen is *and* take the next step? The highest-signal failure
in the whole audit lives here.

**The canonical miss — dead-end disease.** The page works, then the user can't act:
- **F1** — search results were plain `<div>`s; the only link was the name styled as a heading. A buyer
  scanned the list and assumed the page was static. *"i search beds and this comes up but i cant do
  anything."* (Ben). The single biggest funnel leak.
- **F5** — the enterprise profile was 608 lines of read-only dossier with **zero buyer CTA**. *"but
  what am I supposed to do on this page thinking about the user journey??"* (Ben). Dead-end disease one
  level deeper.

**Always check:**
- Can the user *act* on this screen? Is there a CTA, and does it point the right way (F6: the only CTAs
  pointed at the *supplier*, not the buyer)?
- Does the journey *continue*, or does it sever the thread to the next step / the paid artifact (F8:
  discovery and the tender pack were two disconnected funnels — the buyer's vetting was discarded)?
- Would a first-time, logged-out user know what to do without being told?

---

## 2. Value-shown — "is the thing we built front-and-centre, or buried?"

We spend most of the effort on evidence (delivery proof, contract counts, triple-proof tiers). The
test: does the user *see* it first, or is it buried where only we know it's there?

- **P2-2** — the directory (`/social-enterprises`) showed category + source badges but **none** of the
  delivery evidence `/suppliers` surfaces, and had no evidence sort (defaulted to Name A-Z, so
  "Koolyangarra…" led). Same supply base, browsed instead of searched, lost everything that
  differentiates the product. Fix led the list with "Amnesium · 341 govt contracts · $63.0M".
- **P2-1** — the "beds" search match was *correct* (Arnhem's contracts are literally bed-dwelling
  construction) but the card never *showed why* it matched. Fix surfaced "Matched in a won contract:
  …Construct 4x2 **Bed** Dwellings…" so the relevance is self-evident — and the garden-beds false
  positive becomes visible too.
- **P2-7** — the `/suppliers` landing was all promise, no proof pre-search. Fix added a live registry
  stats strip (enterprises · proven deliverers · contracts · $ tracked).

**Always check:** is the proof the *first* thing, or below the fold / behind a click / absent? Two
list UIs of the same data should share one evidence language.

---

## 3. Meaning — "trustworthy and consequential, or a data dump?"

Does it make the user *care* and *trust*? Two sub-tests:

**Honesty — copy must not contradict the evidence beside it.** The most embarrassing class:
- **F3 / F7** — an AI-hedge blurb ("specific activities… not well-documented… further information is
  needed") sat directly above **$7.8M "Construction of 5×4 and 4×6 Bed Dwellings"** and 36 contracts.
  The strongest evidence badge sat over copy saying we don't know what they do. Fix: lead with an
  evidence-derived sentence ("Delivered $15.5M+ across 36 government contracts for 5+ buyers"),
  suppress the hedge. A shared `isHedgeDescription()` now flags these.
- If a screen asserts a **figure or status** (dollars, counts, DGR/ABN, "first/only/largest"), run it
  through `/ground` before calling it done — fabricated-or-unverifiable-stated-as-fact is a HOLD.

**Jargon needs a why.** A term that reads badly without context:
- **P2-3** — "black cladding risk scoring" dropped unexplained on a buyer surface. It's a *pro*-Indigenous
  integrity capability, but raw it can read wrong. Fix: a one-line explainer of what it is and why
  flagging it protects genuine Indigenous-owned suppliers.

---

## 4. Aesthetic — "does it match DESIGN.md, or has it drifted?"

Read `DESIGN.md` first. Bauhaus Industrial: Satoshi (display) / DM Sans (body) / JetBrains Mono (code),
`border-4 border-bauhaus-black`, `font-black uppercase tracking-widest`, **zero border-radius**, signal
red `#D02020`. **Blue (`#1040C0`) is for links / info / accents — never a hero fill.**

- **P2-6** — three hero treatments across four pages: canvas+black text, black fill, full blue fill.
  Fix: one system — black fill + blue hard-shadow (blue demoted to accent), `/suppliers` keeps its
  distinct search-landing hero by design.
- **F4** — ragged cards: some showed a description line, some didn't. Pick a consistent rule so the
  list reads as one designed unit.

Drift is usually inconsistency *across* the flow, not one ugly page. Audit the surface as a set.

---

## 5. Friction — "what makes them bounce?"

Anything between intent and action:
- **P2-8** — empty states that hide the intended path: the tender-pack with an empty shortlist showed
  *only* the cold footprint form, so a cold visitor never learned the shortlist-driven spine exists.
  Fix: a "No shortlist yet — find suppliers →" nudge.
- **F9** — high-friction inputs: LGAs/postcodes as free-text "one per line", no picker/autocomplete;
  the real need field ("keywords") optional and disconnected from the search the buyer already did.
- **P2-7** — example needs ("Beds", "Catering") quoted but **not clickable**; one-click chips cut
  friction to first search.
- **P2-5** — missing per-page `<title>`/metadata: profile/directory/procurement rendered the generic
  root title; the profile had no `generateMetadata` at all. Breaks tabs, **link previews when a buyer
  pastes a profile into a procurement email**, and SEO. Cheap, high-leverage. Fix: `generateMetadata`
  on dynamic routes (title = entity name, description = evidence line) + static metadata elsewhere.
- **P2-4** — selling the paid artifact blind: both generate-forms gated all value behind a form with
  no preview of the output. Fix: a "What's in the pack" panel before generate.

---

## Sizing (effort key, used in the findings doc)

- **S** — quick edit: copy, a class, a CTA, an explainer line, metadata.
- **M** — component work: a new component, reordering a page, a sort control, an empty state.
- **L** — data/logic: an RPC/view, a ranking change, a new DB-backed signal, an architectural spine.

When ranking the pass for Ben: lead with **Clarity + Value-shown** findings (first impression), then
the **cheap high-leverage** wins (S-sized Friction/metadata), then flag the ones needing **his
decision** separately (wording, architecture) — never batch-apply a taste call.
