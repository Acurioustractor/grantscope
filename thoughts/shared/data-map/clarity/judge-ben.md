# JUDGE — BEN'S TASTE AND HOW HE ACTUALLY WORKS

One lens only: would Ben use this daily, and does it ever leave him staring at a screen wondering
what to do next?

Read in full: `design-instrument.md` (1,289 lines), `design-atlas.md` (1,621), `design-interrogator.md`
(1,286), `thoughts/shared/data-map/README.md`, `BUILD-SPEC.md` §§0–4 and §7 (the floor).

**The rubric, sourced not invented.** Every criterion below comes from a recorded artefact, not my
taste:

| Criterion | Source |
|---|---|
| Rail owns the filters; filters nest under the rail entry they scope; chip rows read as competing tabs | auto-memory `ben-ux-taste-one-desk` (live review 2026-08-05, PRs #133–#137) |
| Plain words, no database vocabulary in UI | same |
| One heading + one contract line; stacked meta-labels enrage him | same |
| The primary verb goes on top; evidence links demoted below the decision | same |
| Never "say the word" — one line per action, the exact phrase → what happens | auto-memory `explicit-action-menus` (2026-08-09) |
| Verification gates BEFORE scoring; maths on bad data dresses noise as signal | auto-memory `feedback-data-quality-before-scoring` (the `act_grant_recommendations` incident: 67 "strong fits", ~7 real) |
| **Dead-end disease** — "the page works but offers no way to act… the single biggest funnel leak" | `.claude/skills/polish/SKILL.md`, criterion 1 |
| Every dollar figure needs a source; `.provenance.md` sidecars | `~/.claude/rules/verification.md` |
| Don't add a surface a second one duplicates — fold it in | `ben-ux-taste-one-desk` |

**Verified this session [V]:** `.ws` workspace theme exists at `apps/web/src/app/globals.css:116`
and collapses `border-4` to 1px at line 181; `requireAdminPage` exists at
`apps/web/src/lib/admin-auth.ts:40`; `apps/web/src/app/clarity` does not exist. All three designs
rest on that same foundation and it is real.

**Not verified [U]:** every database claim inside the three designs. I read them; I did not re-run
their queries. Where I cite a number below I am relaying their marker, not confirming it.

---

## THE SCORES

| | Design | Score | One-line verdict |
|---|---|---|---|
| 🥇 | **THE INTERROGATOR** | **8 / 10** | Speaks his language, ends every screen with a verb, and structurally prevents the exact failure he caught in May. One named rage-trigger on the front screen, fixable in an afternoon. |
| 🥈 | **THE INSTRUMENT** | **7 / 10** | The strongest *argument* of the three and the best action wiring — undone by a day-two wall of yellow question marks and six invented nouns to learn. |
| 🥉 | **THE ATLAS** | **6 / 10** | Best rail discipline, best individual findings, worst felt experience: 29% chrome, cryptic routes, and a six-rung ladder whose bottom rung is missing. Its **ideas** score 9; its **shape** scores 5. |

---

## 1. THE INTERROGATOR — 8/10

### Where it wins on his taste

**Plain words, and structurally enforced.** This is the decisive margin. Every card is an English
sentence: *"Can the charity delivering this government service survive the contract?"* ·
*"Who says they serve people leaving prison, and does any money reach them?"* It is the only one of
the three that noticed Bauhaus display type destroys prose past six words, and the only one that
fixed it with a mechanism rather than a promise: `stub` and `question` are **separate columns** in
`clarity_question` so the split is enforced by schema, plus a lint on stub length ≤ 4 words (§2.4).
Compare: the Instrument asks Ben to learn BOARD / LEDGER / SEAMS / DEFECTS / BENCH / TAPE; the Atlas
asks him to learn L0–L5 and route segments `/d/`, `/o/`, `/x/`, `/e/`, `/r/`.

`FORBIDDEN_PHRASINGS` (§3.3) goes further than the other two: each entry carries not just the
replacement but the *reason* — *"'Has no evidence' is a claim about the organisation; 'no evidence
record linked' is a fact about this database."* That is Ben's own register, and a vitest walks
`app/clarity/**/*.tsx` plus every seeded `caveat` and `claim_phrasing` and fails the build.

**Zero dead-ends. This is the criterion the brief said to weight, and the Interrogator is the only
one that clears it everywhere.** Four states, four next moves:

- ANSWERED → `[ SEE THE 662 ROWS → ]`, `[ COPY THE CLAIM ]`, `[ RE-RUN ]`
- CONTESTED → number struck through, `NOT SHOWN`, the tripped sentinels with counts and shares,
  and `[ ADJUDICATE THE 13 ROWS → ]`
- CANNOT ANSWER YET → `BLOCKED BY` the named object, `EFFORT S · one CC-BY-4.0 ABS download`,
  `UNLOCKS 4 questions + every per-capita Indigenous rate below state`
- REFUSED → *no chart at all*, then `WHAT WE CAN HONESTLY SHOW INSTEAD` and
  `WHAT WOULD MAKE THIS ANSWERABLE` (§6.9)

That last one is the anti-dead-end pattern in its purest form: a refusal that **continues the
journey**. The Atlas's refusal panels say no and stop.

**`/clarity/wants` (§10) is Ben's action-menu rule rendered as a screen.** Ranked by
`questions unlocked × dollars made legible ÷ effort`, every row naming the exact fix, the exact
licence, and the payoff. Row 1: *"`abs_indigenous_population_by_lga` is EMPTY. One download.
UNLOCKS OVER-REPRESENTATION + 3 more. WITHOUT IT no Indigenous-focused map in either app is
honest."* That is one line per action, the exact thing to do → what happens. No "say the word"
anywhere in this document.

**Verification before scoring, as database constraints rather than convention.** The strongest
encoding in the three:

```sql
caveat text NOT NULL CHECK (length(btrim(caveat)) > 20)
CONSTRAINT executable_or_blocked CHECK (…)     -- a question that neither runs nor says why cannot exist
CONSTRAINT blocked_has_a_price   CHECK (…)     -- a blocked question must state what unblocking costs
CREATE UNIQUE INDEX clarity_one_binding ON clarity_question_ingredient (question_slug) WHERE is_binding;
```

`clarity_one_binding` is the one I would point at. Its own note: *"Without it, a question with a 94%
join and a 12.9% join renders the 94%."* That is precisely the `act_grant_recommendations`
incident — 67 "strong fits" of which ~7 were real — made structurally impossible. **This design
learned from Ben's worst day with this codebase.** Neither of the others has a mechanism at that
level; they have discipline.

**`[COPY THE CLAIM]` (§6.5) maps 1:1 onto a documented standing rule of his.** His global
`verification.md` says *"Every dollar figure needs a source. Create `.provenance.md` sidecars."*
This turns that rule into a button: you cannot copy 85.1% without the binding join, the measured
coverage, the deterministic exclusions, the caveat and the timestamp. And it is the only one of the
three that produces **an artefact that leaves the building** — which is how Ben actually works
(funder emails, op-eds, board papers, `/make-the-ask`, `/ground`).

**It measured things and corrected its own sources.** Ran three questions end to end (279 ms /
196 ms / 3,076 ms) and corrected OPPORTUNITY-MAP's mean-based fragility figure to a median: 773
fragile charities at **median 0.9 months of reserves**, tighter than the 1.1 reported. That is the
register Ben respects — a number, a method, and a correction.

**It clears BUILD-SPEC's floor the hardest.** BUILD-SPEC §7 says verbatim: *"SLICE 7+ — THE
ANALYTICS HALF — separate spec, do not scope here."* The Interrogator makes the analytics half the
front door **and still ships the full 1,433-row ledger in slice 2**, with two columns BUILD-SPEC
cannot have (§7): `FEEDS` and `BLOCKS`. `FEEDS 0` sorted ascending, filtered to `rows > 1,000,000`,
is a two-click answer to *"what enormous thing am I not using"* — today `abr_registry` (20.0M),
`asic_name_lookup` (2.1M), `privacy_audit_log` (1.28M). Derived, zero curation, and it answers the
one thing a catalog row can never answer on its own: **what is this FOR.**

### Where it loses marks

**The front screen violates a named rage-trigger.** §5.1's board carries a header chip row:
`[ ALL 26 ] [ JUSTICE 8 ] [ MONEY 6 ] [ CHARITY 5 ] [ POWER 4 ] [ PLACE 4 ] [ EVIDENCE 3 ]` plus a
separate `SORT ▾` row. Ben's taste memory names this exactly: *"filter chips that read as tabs
(filters nest under their rail entry or get an explicit 'only show' label)."* The ledger screen has
a proper rail; the board does not. **This is the single most concrete taste failure in any of the
three documents, and it is an afternoon's work to fix.**

**It refuses half the literal request, and says so (§11.1).** Ben asked for *"an overview page that
lists absolutely every piece of data, in dashboard format."* Screen one is 26 question cards plus
one summary line. The design's defence — the first clause is a means, the second (*"see it all, see
the gaps, find opportunities"*) is the end — is a good argument, and the estate strip does carry
`1,433 OBJECTS · 68 FEED A REGISTERED QUESTION · 1,365 DO NOT` with `[ THE LEDGER → ]` one click
away. But this is a man who reviews by feel and whose recorded complaint is *"I can't find
anything."* The risk is one bad first reaction.

**Card density.** Each card stacks kicker → stub → question → answer → denominator → sparkline →
coverage bar → binding-join line → ingredients line → sentinel line. Ten elements. Every one earns
its place, but against *"one heading + one contract line"* this is a stack, and 14 of them on screen
one is a lot of ink.

**Curation debt is its own strongest self-criticism (§11.2)** and I agree with the framing. 26
hand-written questions with caveats, claim phrasings and hand-authored SQL is exactly the artefact
class that has already rotted three times in this repo (`COMPENDIUM.md`, `db-inventory.md`,
`data/schema-cache.md`). Two things pull it back from the brink: the constraints make a half-written
question **fail to insert** rather than rot silently, and Ben demonstrably *does* maintain typed
registries — `atlas/layers.ts` and `surface.ts` are cited across all three docs as the only
artefacts in either repo that have not rotted.

**Confident wrongness (§11.3).** If someone changes `justice_funding.measure_kind` semantics, the
`answer_sql` keeps returning a healthy-looking number. `row_count = 157,116` cannot lie that way.
Sentinels, answer history and a delta alarm mitigate; the failure mode is still net-new.

**Ben's decision 2 has no home.** He just decided *"reconcile the matview refresh registries — yes,
do it."* That is operational work. Neither the question board nor the want list has a natural slot
for it; the Instrument's DEFECTS board does. See §5 for the fix.

---

## 2. THE INSTRUMENT — 7/10

### Where it wins

**It has the best single argument in the three documents, and it is a measurement, not an
aesthetic.** §1.2: `justice_funding` went from 218,022 rows to 157,116 — **−60,906, −28%** — and
**nothing fired**. Three markdown maps went stale in four months and nothing failed. An atlas
renders 157,116 perfectly and is blind to the moment 60,906 rows left. An instrument shows
`157,116 ▼60,906 since 02 APR` in red, on the front board, forever, until a human writes the reason
down. For a project whose whole positioning is *accountability infrastructure*, a database that
loses 28% of a table silently is the thing to fix. This argument is why THE TAPE is the top
transplant in §4.

**Explicit action menus, everywhere, wired to the glyph.** The alphabet (§3) makes `+` mean *"we
have not done this yet — clickable; it is the affordance to fix it"*. Then: `[ RECORD THE REASON → ]`
on an unexplained row-drop, `[ WRITE IT → ]` on a missing purpose, `[ SEE THE 55 → ]` on the
unregistered matviews, and an object-panel action bar `[ COPY SELECT ] [ /ops/health → ]
[ /graph justice mode → ] [ VERDICT ▾ ] [ p PIN TO WATCH ]`. That is Ben's rule honoured better
than anywhere else in the three.

**Rail owns the filters on four of six boards** — LEDGER, SEAMS, TAPE, DEFECTS all have a proper
left facet rail with counts. The six board tabs are genuinely six *boards*, not filters, so they do
not trip the chip-row rule.

**The burn-down clause is the best small idea in the document.** `PURPOSED 812/1433 56.7% ▲ +0 in
30d · 621 to go · at 0/wk: never`. Its own §1.6: *"'44% documented' is inert — it will read 44% next
month and nobody will feel anything."* A coverage number with a velocity and an ETA is a decision.
That is exactly the difference between a chore and an action menu.

**Sentinels that block the render.** `onFire: 'block'` means rows are **not returned at all** and
the card shows the refusal with its evidence. Plus `bench-registry.test.ts` failing CI on an empty
caveat, zero sentinels, an unknown `reads` object, or a `coverageFloor` above the measured rate.
Verification gates before scoring, made structural.

**It clears the floor decisively on two axes:** time (deltas, anomalies, thresholds, the tape) and
the analytics half (BOARD 5 THE BENCH, which BUILD-SPEC explicitly deferred).

### Where it loses marks

**The cold start is the exact failure the brief told me to penalise, and the document confesses it
(§12.1):** *"If Ben opens this on day two and sees a wall of yellow question marks, the design has
to survive that impression on the strength of the LEDGER alone."* Every delta, sparkline, burn-down
and anomaly is `?` on night one. 1,408 of 1,433 objects stay `?` for thirty nights. The mitigations
are honest and clever — backfill 25 spine objects from `data_catalog_snapshots` (1,419 rows of real
history), seed the three known events with reconstructed provenance — but this is a man who forms
his verdict in the first ten seconds. **The design's entire thesis is weakest exactly when he first
opens it.**

**Six invented nouns is a vocabulary to learn.** BOARD / LEDGER / SEAMS / DEFECTS / BENCH / TAPE.
SEAMS is genuinely good and plain. DEFECTS is fine. BENCH (for cross-sections) and TAPE (ticker
tape) are Bloomberg-terminal metaphors that assume a reference Ben may not carry. Against *"plain
words, no internal vocabulary"* this is a real hit — and it is six, on the top nav, permanently.

**The watch strip is the densest chrome of the three** — eight cells × four rows (label / value /
glyph / sparkline) in 108px, using abbreviations (`▼ 74%`, `⛔ 70 stl`, `▰ 2 FIRED`). It is
information, not restated labels, so it is not strictly a label stack — but it is the thing most
likely to produce *"I can't find anything"* on first contact.

**Nothing here is shareable (§12.4).** *"Nobody screenshots a terminal for a funder deck, an op-ed
or a board paper."* Its answer is to *track* the gap (`+ 9 unlanded` cross-sections with no public
surface). Tracking the absence of the artefact is not the artefact. Given how Ben actually works —
`/make-the-ask`, `/ground`, funder emails, `/lighthouse` outreach packs — this is a material cost.

**Eleven glyphs.** `· ▲▼ ⊕ ⊖ + ? ≈ ⛔ ▮ ▰ ○`. The Atlas's six is closer to his instinct. The
Instrument's are richer and each is justified, but eleven symbols with strict non-overlapping
semantics is a legend to memorise on a surface whose whole pitch is speed of reading.

---

## 3. THE ATLAS — 6/10

**Its ideas would score 9. Its shape scores 5.** I want that on the record, because §4 lifts more
from this document than from the winner.

### Where it wins

**The best rail discipline of the three, and structurally so.** A persistent rail at every level,
filters stored in the URL and **level-independent**, surviving every descent, with the beautiful
detail that a filter which cannot apply at the current level is shown **carried-but-inactive, never
silently dropped** (§15.2), and dropped nodes render as **hollow outlines rather than removed, so
you can see what your filter cost you** (§2 rail spec). That is Ben's One Desk pattern generalised
to a whole surface. It is the single best structural idea in the three documents for how he
navigates.

**The `+` vs `×` split (§5).** Six glyphs, and the load-bearing pair is *"we never measured this"*
(blue, ours to fix) versus *"we measured it and the answer is zero"* (red, the data is broken).
*"Merging them is how a catalog becomes an accusation nobody acts on."* Six glyphs is the right
number — closer to *kill label stacks* than the Instrument's eleven.

**It produced the most valuable single finding in the whole exercise.** §2.2, measured by direct
psql: the two largest nodes in the entire graph are `Specialised Supplies and Services` (330,460
edges) and `Specialised Support Services` (274,675) — **AusTender procurement categories
materialised as `entity_type='program'` nodes**, holding 605,135 edges = **17.6% of the entire
graph**. *"Any centrality, power score or 'most connected' ranking that includes them is wrong."*
Ben has an active project — power-holder leverage map — sitting directly downstream of that. This is
a live data-quality defect that nothing else in either repo surfaces.

**The null-reason-code breakdown (§9, L2b) speaks Ben's own language back to him.** Nulls broken
down by reason code, never as one number; *"34,223 entities hold a postcode and no LGA BECAUSE the
rebuild refused to be confidently wrong. Yellow, not red."* That is lifted straight from the LGA
attribution work Ben himself drove, where every unplaced row is reason-coded and a NULL LGA is a
deliberate refusal. Enormous taste credit.

**The Isolate state (§11.3)** — 209,172 entities (34.3%) have no edge, and the panel *names the
systems, states what each holds, and offers the name search as the next move*. This is the designed
**alternative** to "has no evidence" rather than a prohibition list. Better than either competitor's
approach, which is to ban the phrase.

**The Frontier's placement argument (§12):** *"There is no `/clarity/gaps` route. A separate gaps
page is a page nobody opens; a gutter that is present at every depth is a thing you cannot avoid
reading."* Correct, and it is an argument against the Interrogator's `/clarity/wants` being the
*only* home for the want list.

**Layout stability (§15.3):** positions computed by the nightly sweep and frozen; *"nothing in the
Atlas moves unless the data moved, and when it moves it is marked."* Anyone who has lost a mental
map to a re-running force simulation will recognise this as load-bearing.

### Where it loses marks — and why it is third

**Dead-end disease, structurally, and the document knows (§21.7):** *"L5's whole promise is
provenance, and the flagship drill path — edge → grant — is 0.0%… the Atlas repeatedly invites the
user down a ladder whose bottom rung is missing, and it has to spend design effort apologising for
it."* Six levels of descent that terminate in a refusal panel. The intellectual defence — making the
missing rung visible is the point — is one I believe. The **felt** experience is: I clicked four
times and got told no. Against the brief's stated penalty, this is the worst offender of the three.

**29% of a 1440px screen spent on chrome, at every level (§21.5).** Rail 220px + gutter 220px, and
the design's own note: *"a design that needs its two most distinctive elements collapsed to read
comfortably has a real problem."* That is a rage-trigger being described in advance by its own
author.

**The most database vocabulary of the three.** L0–L5 as a public taxonomy. Route segments `/d/`,
`/o/`, `/x/`, `/e/`, `/r/`. "PivotGraph", "DOI ego network", "adjacency matrix", "equal-area
mosaic", "semantic zoom". Ben's rule is plain words in the UI; this is a research vocabulary worn on
the outside.

**The mosaic is the front door, and it is 1,433 unlabelled grey squares.** As an *idea* — every
object simultaneously visible, above the fold, stable position, recolourable by eight lenses — it is
elegant and the equal-area-not-treemap reasoning (seven orders of magnitude in row count) is
correct. As the *first thing Ben sees*, it is a field of identical tiles identifiable only by hover.
Combined with 9 coverage scalars + 14 domain bars + a 9-group rail + a 25-item gap gutter + the
Frontier on the same screen, L0 is the densest single screen in the three documents. This is the
"I can't find anything" screen.

**Most code, slowest to value, admits both.** §21.1: ~3× time to first value, roughly two weeks
before coherent. §21.4: *"perhaps three times the component count of the ledger direction."* For a
one-to-two-person team in a repo that already carries 267 `page.tsx` routes and, by the exercise's
own count, five things called some variant of "power map". Ben's standing rule is to **fold surfaces
in**, not add them.

**Weakest on "what do I do next".** The Frontier is excellent but lives in a 220px right gutter; the
verdict and governance writes are buried in an L2 panel. There is no explicit action menu on any
primary surface.

---

## 4. THE TRANSPLANT LIST — what to graft, and from where

Ordered by what it costs Ben if it is missing. **Host = THE INTERROGATOR** throughout.

### Must-have (the winner is incomplete without these)

**T1 · The persistent left rail that owns every filter — from ATLAS (§4②, §15.2).**
Kill the header chip row on `/clarity`. Move SUBJECT / STATE / SORT into a left rail; make it
persist across board → question → rows → ledger → wants, level-independent, with counts on every
facet, greyed-not-hidden at zero, and **carried-but-inactive rather than silently dropped** when a
filter cannot apply at the current level. This is the winner's only named rage-trigger and the
Atlas's best structural idea. Non-negotiable, and cheap.

**T2 · THE TAPE — from INSTRUMENT (§8.3, §10.3).**
`clarity_delta` + `clarity_event` + the anomaly rule (`|Δ| > 10%`, a sign flip, `missing_since` set,
a state change, a scope change) + **`NO REASON RECORDED` in red until a human writes one**. Without
it the Interrogator watches 26 questions with perfect provenance and is blind to the estate around
them — the `justice_funding −60,906` class of loss stays invisible. Ship the seeded reconstruction
of the three known 2026-04-02 events too: they render as unexplained anomalies on first paint, which
is exactly what they are.

**T3 · The global baseline selector — from INSTRUMENT (§4, §9.4).**
`[` `]` cycling LAST SCAN → 7d → 30d → 90d, applying to every delta on every screen at once, a
`searchParam`, with unavailable options **greyed and carrying their reason** (`30d — history begins
15 AUG, 3 nights`) and deltas rendering `?`, never `0`. The Interrogator's board says "3 MOVED SINCE
14 AUG" with no way to change the window.

**T4 · The burn-down clause — from INSTRUMENT (§1.6, §5 Panel 1).**
`621 to go · at 0/wk: never`. Apply to the estate strip's `1,365 DO NOT FEED A QUESTION`, to every
coverage bar, and to every want-list row. A metric with a velocity and an ETA is a decision; without
one it is wallpaper. This is the cheapest upgrade on the list and it converts three of the winner's
inert numbers into actions.

**T5 · SEAMS as a ranked table of joins — from INSTRUMENT (§7).**
Joins ranked by `rows_at_stake × (1 − match_rate)` — *by how much data the connection is currently
losing*. Its argument is correct and measured: a broken join is invisible in a node-link diagram.
The Interrogator's `/clarity/joins` should default to this **table**, with the force graph behind
the RENDER button it already proposes. The four defects Ben actually cares about — the 0% justice
drill-through, 25.1% donation ABN attribution, the 0% NDIS LGA bridge, and the 3.16-rows-per-key
grain defect that would make a choropleth lie — are the top four rows of that table and are nowhere
in a graph.

**T6 · The category-node finding, as question #27 and as a global sentinel — from ATLAS (§2.2,
§11.5).**
`Specialised Supplies and Services` 330,460 edges + `Specialised Support Services` 274,675, both
`entity_type='program'`, together 17.6% of the graph. Register as a CONTESTED question
(*"Which of our biggest 'organisations' are not organisations?"*) **and** as a `clarity_sentinel`
with `severity='block'` that trips on any question reading centrality or degree from
`gs_relationships`. It poisons Ben's power-holder leverage map, which is live.

### High-value (each removes a specific dead-end or a specific lie)

**T7 · Null-reason-code breakdowns — from ATLAS (§9).**
Nulls broken down by reason, never as one number, with the yellow-not-red rule for a deliberate
refusal. Generalise as the Atlas does: any column with a `*_source` or `*_reason` sibling gets the
breakdown automatically; any column without one gets `+` and *"Nulls here are not reason-coded. We
cannot tell you why."* Put it on the dossier and behind every coverage bar on a question page.

**T8 · The Isolate state — from ATLAS (§11.3).**
The designed alternative to "has no evidence": name the systems, state what each holds, offer the
name search as the next move. The Interrogator has `FORBIDDEN_PHRASINGS`; a ban needs a
replacement screen, and this is it.

**T9 · Contextual Frontier rendering — from ATLAS (§12).**
Keep `/clarity/wants` (it is the action menu and it is good), but **also** render each want where it
blocks: the `abs_indigenous_population_by_lga` item appears on that object's dossier and on every
question it blocks, not only on the wants page. *"A separate gaps page is a page nobody opens."*

**T10 · Show-the-SQL as a global affordance — from INSTRUMENT (§8.1, the `S` key).**
The Interrogator has `▸ THE SQL` on the question page. Extend it to **every number on every screen**,
including the ledger's derived columns and the estate strip. Its anti-rot argument is exactly right:
a metric whose SQL has silently stopped meaning what its label says can only be found if the SQL
sits next to the number.

**T11 · Promote a refusal to the front board — from INSTRUMENT (§5, Panel 6).**
`Q16 NDIS ⛔ REFUSES: lga_code 100% NULL` on the front board, not filed under "cannot answer yet".
*"A refusal, stated in public, is a finding."* The winner already has the best refusal *page*; it
should have a refusal *headline*.

**T12 · Verbs in the search bar — from INSTRUMENT (§4, the command bar).**
The Interrogator's AskBar covers questions + objects + columns. Add the fourth namespace: verbs
(`extract all objects matching "justice" as a SQL IN-list`). Verbs in a search field are an action
menu that costs no screen space — which is the cheapest possible answer to Ben's action-menu rule.

**T13 · The Hub Sheet with an escape hatch — from ATLAS (§11.4).**
Above degree 150, refuse the node-link and show a faceted sheet — **with a
`[ draw it anyway (will render ~200 of 270,864) ]` override**, because *"refusing without an
override is paternalistic; it prints exactly what it will show and what it will drop."* That is the
right posture for every refusal in the winner, not just this one.

**T14 · Server-computed frozen layout — from ATLAS (§15.3).**
Positions written by the nightly sweep, zero simulation ticks on load, movers marked for one day.
Apply to `/clarity/joins`. *"Nothing moves unless the data moved, and when it moves it is marked."*

### Ideas the winner already owns — name them so a grafted build does not lose them

The `stub`/`question` typographic split enforced by schema + lint · `[COPY THE CLAIM]` · the
**sample-size track** under every time series (§6.4 — an n=2 bucket rendered as a 2px sliver against
a 59px bar; the cheapest structural fix in any of the three, and it generalises to every chart in
both apps) · `FEEDS` / `BLOCKS` on the ledger · the `refused` form with its own route · the
`ANSWERS 6 / BLOCKS 1` band on the dossier · `clarity_one_binding` · UNVERIFIED and PILOT stamps as
registry fields · the WANT LIST's ranking formula.

---

## 5. THE WINNER, AND WHAT IT MUST STEAL

**Build THE INTERROGATOR.** It is the only one of the three where every screen ends in a verb, it
speaks in English by construction rather than by discipline, and it prevents at the schema level the
exact class of error Ben personally caught and wrote a memory about. It also clears BUILD-SPEC's
floor by the widest margin — BUILD-SPEC deferred the analytics half in writing, and the Interrogator
makes it the front door without giving up the ledger.

**Four things it must steal to be complete, in this order:**

1. **The Atlas's rail (T1).** Kill the header chip row. This is the one named rage-trigger in the
   winning design and it is an afternoon of work. Do it in slice 1, not later.
2. **The Instrument's TAPE + baseline + burn-down (T2, T3, T4).** Without the derivative, the
   Interrogator is a beautifully-provenanced snapshot that would have watched `justice_funding` lose
   28% of its rows and reported a healthy `279 ms` alongside. Time is the axis it is missing.
3. **The Instrument's SEAMS table (T5).** "How it connects" has to be a ranked list of what each
   connection is *losing*, or it is decoration. The four defects that matter are invisible in a
   graph and are the top four rows of a table.
4. **The Atlas's category-node finding (T6).** It is live, it is measured, and it silently poisons a
   project Ben is already running.

**Two structural amendments beyond the transplants:**

- **Move the ledger into slice 1.** The Interrogator schedules `/clarity/data` for slice 2. Ben
  literally asked for the list. Ship the three end-to-end questions **and** the 1,433-row ledger
  with `FEEDS`/`BLOCKS` in the same slice, so that on day one the answer to *"where is my list"* is
  one click away and it is real. Slice 1 becomes ~5 days instead of ~4. Worth it.
- **Give Ben's decision 2 a home.** He has just decided to reconcile the matview refresh registries.
  That is operational work and neither the question board nor the want list holds it. Graft the
  Instrument's DEFECTS board (§8.1) as a **`HOUSE` subject on the question board** — the 23 gap
  metrics registered as questions about ourselves, with thresholds, so *"71 of 98 matviews are in no
  refresh registry"* becomes a CONTESTED card with an adjudication CTA rather than a fact in a
  footer. It costs one subject chip and it makes his current decision visible on the surface that is
  meant to drive his week.

**One thing to watch after the first week.** The Interrogator's risk is curation debt on 26 questions
and confident wrongness on a stale `answer_sql`. Both are mitigated by constraints and sentinels, but
the honest test is the second month: if the board still reads true in September without anyone
touching it, the direction is proven. If three cards have quietly drifted, the Instrument's
derivative-first thesis was right and the fix is to promote the TAPE from a transplant to a
co-equal board.

---

## CONFIDENCE

**Verified [V]:** `.ws` exists at `globals.css:116` and collapses `border-4` to 1px at line 181;
`requireAdminPage` at `admin-auth.ts:40`; `apps/web/src/app/clarity` does not exist; the contents of
all three design documents, `data-map/README.md`, `BUILD-SPEC.md` §§0–4 and §7, and the four
auto-memory files that constitute the rubric (`ben-ux-taste-one-desk`, `explicit-action-menus`,
`feedback-data-quality-before-scoring`, `project-full-data-map`) plus `.claude/skills/polish/SKILL.md`.

**Relayed, not re-verified [R]:** every database figure quoted from the three designs — the degree
distribution and the two category nodes, the 279 ms / 196 ms / 3,076 ms timings, the median-0.9-months
fragility correction, the 1,433-object universe, the 0.0% drill-through, the 85.3% `other receipt`
share, the Hays $123.00bn row. Each carries a `[V]` or `[R]` marker in its own document; I did not
re-run any of them this session.

**Inferred [I]:** every score. These are judgements against a rubric assembled from recorded
feedback, not measurements. The specific prediction I am least sure of is the Interrogator's
front-screen risk: I judge that Ben will accept 26 question cards with the ledger one click away,
because his own skills and memory are organised as questions and findings rather than as tables — but
this is a prediction about a person, and the cheapest way to settle it is to put §5.1's wireframe in
front of him before slice 1 is written.

**Not checked [U]:** nothing was rendered in a browser. No migration was applied. I did not assess
build effort independently of each document's own estimates.
