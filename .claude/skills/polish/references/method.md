# Method — running an audit pass

How to actually see the screen, where to put what you find. The audit is only as good as the *real
render* you judge — never audit from the code's intent.

## Server warmup (the dev server is fragile)

```bash
lsof -i:3003                                   # kill anything hung first
npx next dev --turbopack -p 3003               # NOT vanilla webpack — it hangs on compile
```

- Port is **3003**. Use `--turbopack`.
- Cold compile + DB queries ≈ **18s** on first load of a route. Don't set curl/screenshot timeouts
  under 30s.
- **Warm each route with `curl` (60s timeout) before screenshotting** — otherwise you screenshot a
  compile spinner:
  ```bash
  curl -s -m 60 http://localhost:3003/suppliers > /dev/null && echo warm
  ```

## Screenshot protocol

- Capture the **logged-out buyer view** — that's the real first impression and where the funnel leaks.
  (Log-in state hides the dead-ends; the audit found most leaks logged-out.)
- Viewport **1280×900**.
- Save to `docs/ux-audit/shots/` with a descriptive name: `audit-NN-<screen>-<state>.jpeg`
  (e.g. `audit-02-suppliers-beds.jpeg`, `audit-07-beds-after.jpeg` for before/after).
- For a search surface, screenshot a **real query** a buyer would type ("beds", "catering", "civil
  works") — the loose-relevance and buried-match findings only show under a real term, not the empty
  state.
- Test the **empty state** too (P2-8 was an empty-shortlist finding — the cold path is where the spine
  hides).

## The findings doc

One doc per surface: `docs/<surface>-ux-findings.md` (the buyer flow's is `docs/buyer-flow-ux-findings.md`).

**Format per finding:**
```
### F<n>. <one-line problem> · <S|M|L> · <🔴 top | optional priority>
**Ben's words:** "<verbatim quote when he reacts>"
<what's wrong, confirmed in code with file:line, why a user bounces>
**Fix direction:** <the move; ask Ben where it's a taste/architecture call>
```

Rules:
- **Quote Ben verbatim** when he reacts to a screen — his phrasing ("i cant do anything", "what am I
  supposed to do on this page") is the sharpest finding and the calibration for next time.
- **Confirm in code** — cite `file.tsx:line`. "Looks read-only" → open the file and prove it (F5 was
  confirmed as 608 lines, zero CTA).
- **Rank S / M / L** (sizing in `rubric.md`).
- **Append, never rewrite.** Each pass is a dated section ("# Audit Pass 2 — YYYY-MM-DD"). A re-opened
  finding refines the prior one (P2-1 refined F2-RESOLVED — the single-result check had missed the
  precision problem). Mark resolved ones `### F1-FIXED.` / `### P2-1 — DONE:` with the before/after and
  the shot name.

## After fixing — verify live

- Re-run the gates (`/ship` does this): `cd apps/web && npx tsc --noEmit && npx vitest run`.
- **Re-screenshot the fixed screen** and append before/after to the doc. A clean type-check is not
  proof the buyer sees the change — `verification.md` forbids claiming "verified live" without the
  render. (Every P2 "DONE" entry cites the after-shot for this reason.)

## Decisions to route to Ben (don't decide these yourself)

Some findings are taste or architecture calls — surface them, don't batch-apply:
- **Wording** of anything user-facing with judgment in it (P2-3 black-cladding explainer).
- **Architecture** that changes the journey (F8 shortlist-spine vs cross-link vs two-tools-by-design —
  this one decision drove every step-1/2 fix).
- **Which affordance** when several work (F1: whole-card click vs underline vs button).

Present these as the "your call" block when you summarise the pass.
