---
date: 2026-08-16T01:00:00Z
session_name: clarity-catalog
branch: main
status: active
---

# Work Stream: clarity-catalog → clarity-console

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-08-16T01:00:00Z
**Goal:** The `/clarity` **console rebuild**. Issue #190 (the 26-question registry) is DONE and merged. The work stream turned over this session: two design grillings produced two plans, and three slices shipped against them.
**Branch:** `main` at `75521d7`. PRs #215, #216, #217 all merged; board clear.
**Test:** `cd apps/web && npx tsc --noEmit` · `npx vitest run src/app/clarity src/lib/visibility.test.ts` (50 tests, 7 files)
**Local:** dev server on 3013 (`--turbopack`). `/clarity` needs no login locally — `admin-auth-bypass.ts` covers it. **Vercel preview does NOT bypass**, and Ben's sign-in on preview failed with "Invalid login credentials" (unresolved, see Open Questions).

### Now
[->] **Slice B — theme pages at `/reports/[section]`.** In progress. Slice E merged (#217).

### This Session
- [x] **Merged PR #215**, closing issue #190. Registry complete at 26 questions.
- [x] **Grilling 1 → `thoughts/shared/plans/clarity-console.md`.** 12 slices. Diagnosis: `clarity_object` carries ~60 curated fields per object and there was **no page for an object** — an encyclopedia shipped as a spreadsheet.
- [x] **Slice 1 — `/clarity/o/[key]`, a page for every object.** Columns, link graph with seam rates, what-uses-it, questions built on it, shape, freshness, access, provenance. Renders curated markdown (467 caveats, 84 purposes contain it).
- [x] **Slice 3 — the index becomes the front door.** All 1,479 objects on one page, terse links, six nouns. **15,052px, down from 70,614, showing 257 MORE objects.** Old ledger demoted to `/clarity/catalogue`. **Merged as PR #216 (`3c784a5`).**
- [x] **Grilling 2 → `thoughts/shared/plans/clarity-console-part-2.md`.** Slices A–K. Triggered by Ben: *"very code tech speak… wanna see real data and how it all connects."*
- [x] **Slice E — one visibility vocabulary.** `public → org → operator → withheld`, generalising `/atlas`. PR #217, pushed, unmerged.

### The reframe from grilling 2 — the single most important thing in this ledger
Three times I went looking for something to build and found it already built:

| Looked for | Found |
|---|---|
| A real-data surface | **54 report dirs in 13 themes** — `qld-youth-justice`, `child-protection`, `donor-contractors`, `who-runs-australia` |
| A way to show connection | **`/entity/[gsId]`, 958 lines, 16 parallel cross-system queries** |
| A search | **`unified-search.tsx`, 495 lines**, already grouped by kind |
| An ACT workspace | **62 pages under `/org/[slug]`** |

**276 page routes exist. `/clarity` indexes 1,479 DB objects and zero of them.** This is a navigation and coherence problem, not a build problem. Part 2 is mostly connection and deletion.

### Next
- [ ] **Merge #217**, or say why not.
- [ ] **Slice B — theme pages at `/reports/[section]`.** Biggest legibility win, no new data.
- [ ] **Slice C — real money on sector theme pages.** Topic tags already exist (`child-protection` 16,418, `youth-justice` 5,580). Aggregates + top recipients linking to entity pages. **`measure_kind = 'grant'` MANDATORY** or $46.1bn reads as $66.1bn. This is where the tech-speak ends.
- [ ] Then D (`/search`), F (report status at links), G (themes above the noun index), H–K.
- [ ] **From part 1, still open:** slice 2 (inline edit for the 667 stubs), slice 4 (nouns propose/confirm), slice 5 (row viewer + consent), 6b (code scanner).
- [ ] `/insights` (323 lines) still unread, still unjudged.

### Decisions
- **Completeness at the index layer, refusal at the claim layer.** Reconciles "see it all" with the refusal ethos. Settles every hard case.
- **A screen may be stricter than its data, never looser.** The asymmetry is the safety property. Data declares a floor; `mostRestrictive()` makes a page inherit the worst of what it reads.
- **Absence is always stated, never silent.** Now a rule, not three coincidences. Exception: a count of 1 in a small community is a name (`SMALL_COUNT_THRESHOLD = 5`).
- **Findings first, plumbing last**, on every surface.
- **Unfiled is rendered, never guessed.** 747 of 1,479. Two causes kept visibly apart (667 no-domain; ~80 sector-filed) — a tooltip is the same collapse in a costume.
- **Key numbers on public theme pages come ONLY from registered questions.** No lifting figures from report prose; 20 reports are flagged as needing figure review.
- **Accountability & Power review-status reports are counted, not linked.** 10 of the 20 live there and they name individuals and board seats. Same reasoning that refused ministerial-diaries.
- **Stories link to projects, never to data.** Project-mediation is the only version that cannot re-identify.
- **No free-text querying.** Saved parameterised queries + the row viewer. The difference is that these carry their caveats with them.
- **ACT extends `/org/act` (62 pages).** Not a fourth front door. Admin auth until a second person needs in.
- **The visibility vocabulary is NOT the commercial `Tier` ladder.** Paid-for vs allowed-to-see. Different axes.

### Traps confirmed by query this session
- `clarity_object.object_key` and `clarity_edge.src/tgt_object` are **bare**; `clarity_question_ingredient.object_key` is **`public.`-prefixed** and CHECK-constrained. Wrong form returns nothing rather than erroring.
- **`refs_app`/`refs_script`/`refs_migration` are 0 on all 1,479** — scanner never ran. The orphan detector would report **1,151 false orphans**. Blocked on slice 6b.
- `owner_app` = `'neither'` on all 1,479. `verdict` null on all 1,479. `null_pct` null on all 16,124 columns.
- `importance` is tied at `0.0225` for **424 objects** — it cannot rank, which is why the old "RANKED" sort felt arbitrary.
- **`history` contains `story`.** A `/story/` pattern withholds five history tables and still misses `quotes`. Consent floors are an explicit list, not a pattern.
- **A domain-only consent rule leaks**: `story_analysis`, `transcript_analysis` (`ai_agents_pipeline`), `tour_stories` (`media_narrative`), `partner_storytellers_v` (no domain).
- Public home `app/page.tsx` has **5 broken HTML entities inside JS string literals** (lines 175, 183, 213, 244, 246) rendering as literal `&rsquo;`. Pre-existing on main, unfixed, visible on the live home page.

### Open Questions
- **UNRESOLVED: Ben cannot sign in to the Vercel preview.** "Invalid login credentials" for `benjamin@act.place`, which IS in `ADMIN_EMAILS` and DOES exist in `auth.users` on `tednluwflfhxyucgwigh` (confirmed, has signed in before). Either the password, or **preview env vars point at a different Supabase project**. Vercel SSO blocked me from checking. Check Vercel → Settings → Environment Variables, Preview vs Production `NEXT_PUBLIC_SUPABASE_URL`.
- **Consent on `transcripts` is FIVE independent flags**, not one boolean: `consent_for_ai_analysis`, `_quote_extraction`, `_theme_analysis`, `_story_creation`. `floorFor()` is binary — safe direction, but **slice 5's row viewer must read them per row, not call `floorFor()`**.
- Whether the Accountability & Power count-only rule survives Ben seeing it applied.
- Which of the 276 routes are genuinely dead. B–D will reveal more than guessing.
- The commercial `Tier` ladder has not been reconciled with the visibility vocabulary. Must be before anything is sold.
- **Six `/clarity` rendering defects remain unfixed by design** (duplicate React key on the catalogue, "1 objects moved", triplicated refusal paragraph, a leaked `▸ none + finer framing` placeholder, `NEVER RUN · RUN #0` on a refusal). Slices B–G delete most of the surfaces they live on. Fix only what survives.
- Still open from before: `person_roles` aggregate exposure is Ben's call; the `/foundations/backlog` caller was never identified; three unexplained criticals on the change board (2026-04-02); 9,607 duplicate canonical names (sentinel now warns).

### Workflow State
pattern: console rebuild, two plans
phase: part 1 slices 1+3 merged; part 2 slice E in review
retries: 0

#### Resolved
- issue #190 / the 26-question registry — **DONE**, PR #215 merged
- "does /clarity look right" — **ANSWERED, and the answer was no.** It read as tech-speak. That feedback produced grilling 2 and part 2.

#### Unknowns
- **preview_login: BLOCKED** — see Open Questions. Ben has not yet seen any of this on a deployed URL.
- **theme_pages: NOT STARTED** — slice B, the next thing.
- clarity_visual_result: partially resolved. Ben saw `/clarity` locally and judged it interesting but too technical. The object page and the index have been eyeballed by me; the withheld state has been eyeballed by me.
- http_write_paths: still UNKNOWN — the three `/api/clarity` routes have still never served a request.
