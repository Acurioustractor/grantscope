---
name: polish
description: Surface-quality loop — judge a user-facing screen the way Ben does (Clarity / Value-shown / Meaning / Aesthetic / Friction), collect ranked findings without fixing mid-audit, then fix the top ones with Ben in the loop and ship them. Seeded from the buyer-flow UX audit. Self-paced loop; exit is Ben's taste-check, not "when done". Use on /polish, "polish this", "audit the UX", "does this surface read as value", or before declaring a buyer-facing screen good.
---

# /polish — surface-quality loop

The data is only worth something at the surface. A buyer who can't tell *at a glance* that a supplier
is proven gets zero value from the MV underneath. This loop judges how **helpful, good-looking,
value-added and meaningful** a user-facing screen actually is — fixes the worst gaps — then turns the
judging into something repeatable so Ben stops being the one who notices.

`/wedge` judges whether to *build* a thing. `/polish` judges whether a thing already built is *good*.
It is the taste loop: Ben's reaction to a real screen is the signal, encoded as a rubric the loop runs
before the work reaches him.

## The exit condition (read this first)

The loop is **not** done when every page has been looked at. It is done when **Ben's taste-check
passes** — "yes, a buyer hitting this would get it and want to act." Uncertainty resolves to *flag it*,
never to *probably fine*. You are running his eye over the surface for him; a screen you can't honestly
say is clear-and-valuable is a finding, not a pass. (Same pattern as `/ground`'s fabrication-catch and
`/ship`'s gate.)

## The value test (the core — full calibration in `references/rubric.md`)

For every screen a real user hits, ask five questions. Each maps to a finding-class the buyer-flow
audit actually caught:

1. **Clarity** — in 3 seconds, can they tell *what this is* and *what to do next*? → the canonical
   miss is **dead-end disease**: the page works but offers no way to act (F1 non-clickable cards,
   F5 a 608-line dossier with zero buyer CTA). The single biggest funnel leak. Always check: *can the
   user act here, and does the journey continue?*
2. **Value-shown** — is the proof/evidence we built *front-and-centre*, or buried? → the directory
   stripping delivery evidence (P2-2); the "beds" match that was right but never *shown* why (P2-1).
   The thing we spent the most building must be the thing the user sees first.
3. **Meaning** — does it feel trustworthy + consequential, or like a data dump? Includes **honesty**:
   copy must not contradict the evidence beside it → the AI-hedge "activities not well-documented"
   sitting above $7.8M of contracts (F3, F7), and raw jargon with no explainer ("black cladding", P2-3).
   Run copy claims through `/ground` if a figure or status is asserted.
4. **Aesthetic** — does it match its visual family? **Two families exist (decided 2026-08-05):**
   public-facing CivicGraph surfaces = `DESIGN.md` Bauhaus Industrial (Satoshi / DM Sans / JetBrains
   Mono, `border-4` black, zero radius, signal red; **blue is link/accent, never a hero fill**);
   the ACT workspace (`/org/act/*`) = **Quiet Ledger** (ql-* tokens in globals.css, Newsreader +
   IBM Plex Mono, warm paper). Judge each screen against ITS family; a Bauhaus class on a new ACT
   surface is a finding, and vice versa.
5. **Friction** — anything that makes a user bounce? Empty states that hide the intended path (P2-8),
   free-text where a picker belongs (F9), quoted-but-unclickable example chips (P2-7), missing
   per-page metadata that breaks link previews when a buyer pastes a profile into an email (P2-5).

Ben's confirmed rage-triggers on ACT-workspace surfaces (live review 2026-08-05, PRs #133–#137 —
hunt these first): **stacked meta-labels** (eyebrow + section title + inner title all restating one
sentence); **filter chips that read as tabs** (filters nest under their rail entry or get an explicit
"only show" label); **database vocabulary in UI copy** (bare "commitment"/"money"/"opportunity" —
use Money owed to us / Committed work / Grant rounds, and CONTEXT.md words: Signal, Ask,
pursue/pass); **the primary verb buried** below evidence links; **explanation captions in nav**.
Full taste record: auto-memory `ben-ux-taste-one-desk`.

## Loop discipline (self-paced, like `/leverage`)

Two phases. **Never fix mid-audit** — collect the whole pass first, then fix top findings with Ben.

### Phase 1 — Audit (Tier 1, collect-only)
1. **Scope the surface.** Default target = the **buyer flow** (revenue surface, per the buyer-wedge):
   `/suppliers` → `/social-enterprises/[id]` → `/social-enterprises` → `/procurement` →
   `/procurement/tender-pack`. If Ben names a different surface, audit that. One screen per iteration.
2. **See the real screen.** Server is fragile — `npx next dev --turbopack -p 3013`, warm each route
   with `curl` (60s timeout; cold compile + DB ≈ 18s) *before* screenshotting. Capture the **logged-out
   buyer view** at 1280×900 → `docs/ux-audit/shots/`. Don't trust the code's intent — look at what
   renders. (Full method: `references/method.md`.)
3. **Judge against the five questions** + `DESIGN.md` (read it before any visual call).
4. **Record** to the findings doc (`docs/<surface>-ux-findings.md`): what's confusing / ugly /
   low-value / missing-the-"so what", **ranked S / M / L** effort, **quoting Ben's words** when he
   reacts (his phrasing is the highest-signal finding). Append; don't rewrite prior passes.
5. **Self-pace** to the next screen (`ScheduleWakeup ~270s` while the pass is warm). When the pass is
   complete, summarise the ranked findings to Ben in ≤3 lines and surface the **decisions only he can
   make** (e.g. P2-3 wording, F8 spine-vs-cross-link) — then stop and wait.

### Phase 2 — Fix (Ben-in-loop, then `/ship`)
6. **Fix top findings with Ben in the loop** — first impression first (Clarity + Value-shown beat
   polish), then cheap high-leverage wins (metadata, empty-states). Decide each fix *with* him; don't
   batch-apply taste calls.
7. **Ship via `/ship`** (gates + Tier-2 push pause + Tier-3 PR stop). **Verify the fix is live** —
   re-screenshot, don't claim "verified" from a clean tsc. Append the before/after to the findings doc.
8. **Loop back** to any re-opened or newly-uncovered finding. Exit when Ben's taste-check passes on the
   surface — not when the checklist is empty.

## Guardrails

- **Read `DESIGN.md` before any visual change.** Bauhaus Industrial; don't deviate without Ben's OK.
- **Tier discipline.** Audit is Tier 1 (read + screenshot). Fixes are normal edits shipped via `/ship`
  — which owns the Tier-2 push and Tier-3 PR. This loop runs reversible work + verification; Ben keeps
  the irreversible action *and* the taste judgment.
- **Server Components by default**; `"use client"` only for real interactivity (CLAUDE.md Rule #6).
- **Don't fix mid-audit.** Collecting first is what lets the top-3 ranking be honest.
- **Never claim "verified live" without a re-screenshot.** A clean type-check is not proof the buyer
  sees the fix (`~/.claude/rules/verification.md`).

## References (load when needed)

- `references/rubric.md` — the five dimensions in full, each with the sharp diagnostic questions and
  the real finding-classes it catches (calibrated from the buyer-flow audit, F1–F9 + P2-1…P2-8).
- `references/method.md` — server warmup, screenshot protocol, the findings-doc format, S/M/L sizing.
