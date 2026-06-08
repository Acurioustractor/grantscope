# Buyer-Flow UX Audit → `/polish` skill

**Created:** 2026-06-08 · **Decided with Ben:** *audit first, then crystallize into a skill* · scope = **buyer flow**.

## Why
We've spent heavily on data + enrichment (cron fix, OP7–OP10 evidence stack, VIC link, leverage map).
But the **surface is where that data becomes worth something** — a buyer who can't tell at a glance that a
supplier is proven gets zero value from the 724-org MV underneath. This audit judges how *helpful*,
*good-looking*, *value-added* and *meaningful* the buyer-facing surface actually is, fixes the worst gaps,
then turns the method into a repeatable `/polish` loop-skill.

## Approach (agreed)
1. **Audit first** — one grounded pass over the real screens, reacting to them (Ben's taste is the signal).
2. **Then build `/polish`** — extract the rubric + Ben's intervention criteria from the audit into a
   self-paced loop-skill, the same way `/leverage`'s method preceded its loop. Exit = Ben's check, not
   "when done" (see memory `feedback_loop_design_workflow`).

## Scope — the buyer flow (revenue surface, per buyer-wedge)
The path a government/corporate buyer actually walks. Audit in this order:

| Step | Route | File(s) |
|------|-------|---------|
| 1. Need-first search | `/suppliers` | `apps/web/src/app/suppliers/page.tsx` |
| 2. Enterprise profile | `/social-enterprises/[id]` | `[id]/page.tsx` · `se-client.tsx` · `se-map.tsx` |
| 3. Directory (context) | `/social-enterprises` | `social-enterprises/page.tsx` |
| 4. Procurement hub | `/procurement` | `procurement/page.tsx` |
| 5. Tender pack (the paid artifact) | `/procurement/tender-pack` | `tender-pack/page.tsx` |
| (5b. gap-map, commissioning) | `/procurement/gap-map`, `/commissioning` | sub-pages |

Today's proof badges (OP7 triple-proof, OP10 "Proven outcomes") live on step 1 — the audit should check
they actually read as **value** to a buyer, not just decoration.

## Method (per page)
Dev server is fragile — **`npx next dev --turbopack -p 3003`**, warm each route with `curl` (60s timeout)
before screenshotting (cold compile + DB ≈ 18s). Then for each page:
1. **Screenshot** the real state (logged-out buyer view).
2. **Judge against the value test** (draft rubric below) + **DESIGN.md** (Bauhaus Industrial — read it first).
3. **Record** findings: what's confusing / ugly / low-value / missing-the-"so what", ranked S/M/L effort.
4. Don't fix mid-audit — collect first, then fix the top findings with Ben in the loop.

## Draft value rubric (refine during the audit → becomes the `/polish` core)
For every screen a buyer hits, ask:
- **Clarity** — in 3 seconds, can they tell *what this is* and *what to do next*?
- **Value-shown** — does it surface the *proof/evidence* (the thing we built) front-and-centre, or bury it?
- **Meaning** — does it feel trustworthy + consequential, or like a data dump? (the "makes-you-care" test)
- **Aesthetic** — does it match DESIGN.md (Satoshi/DM Sans/JetBrains Mono, border-4 black, zero radius,
  signal red), or has it drifted?
- **Friction** — anything that makes a buyer bounce (dead ends, empty states, jargon, no CTA)?

## Guardrails
- **Read `DESIGN.md` before any visual change.** Bauhaus Industrial; don't deviate without Ben's approval.
- Server Components by default; `"use client"` only for real interactivity (CLAUDE.md Rule #6).
- Audit is Tier-1 (read + screenshot). Fixes are normal edits; ship via `/ship` with gates.

## Deliverables
1. `docs/buyer-flow-ux-findings.md` — ranked findings with screenshots/notes.
2. Top fixes applied (Ben-in-loop).
3. `.claude/skills/polish/` — the loop-skill, seeded from the refined rubric above.

## Status
- [x] Audit step 1 `/suppliers`  - [x] step 2 profile  - [x] step 3 directory  - [x] step 4 procurement  - [x] step 5 tender-pack
- [x] Findings doc (Pass 1 F1–F9 + **Pass 2** 2026-06-08: confirmed fixes live, added directory/procurement + cross-cutting)  - [ ] Top fixes  - [ ] `/polish` skill
- Pass-2 priority: P2-1 ranking · P2-2 directory evidence · then P2-5 metadata · P2-8 empty-state nudge. P2-3 (black-cladding wording) needs Ben.
