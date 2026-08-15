# JUDGE — THE INSIGHT LENS

**One question only: does it deliver the vision?** Ben wants to see it all, see the gaps, find
opportunities, and understand how money and power move in Australia — cross-sectioned in a way no
one else does. So the test applied here is: *would a person using this on day two LEARN something
about Australia and know what to do next, or would they admire an inventory?*

Gap-making-visible is weighted heaviest, per the brief. Designs that never surface a fact about
Australia are penalised regardless of craft.

Verification key: **[V]** I ran it this session · **[R]** relayed from a doc marked verified ·
**[I]** inference.

---

## THE SCORES

| | Design | Score | One-line verdict |
|---|---|---|---|
| 1 | **THE INTERROGATOR** | **8 / 10** | The only front door that teaches you about Australia. Its ceiling is 26 curated questions. |
| 2 | THE ATLAS | 6 / 10 | Produced the only genuinely *new* civic finding of the three, and buried it under six levels of metadata. |
| 3 | THE INSTRUMENT | 5 / 10 | The best argument in the set, aimed at the wrong target. Teaches you about your plumbing. |

These are scores **on this lens only**. On a different lens — "will this still be true in six
months" — the order inverts completely, and §5 says so.

---

## 1. THE INTERROGATOR — 8/10

### What it gets right

**It is the only design whose first screen contains facts about Australia.** I counted: roughly
twenty, each with a number, a denominator, a coverage fraction and a caveat. 85.1% of youth-justice
grant orgs with no evidence record linked ($663.9m of $1,142.1m). 773 charities delivering
government services at a **median 0.9 months of reserves**. 41,614 organisations governed by
someone who sits on another board. $11.83bn of Commonwealth grant money going to organisations the
graph never created. 4,629 charities say they serve people leaving prison and 862 have any funding
rollup.

Compare the other two first screens. The Atlas opens with a mosaic of 1,433 database objects whose
largest single block is `UNFILED 621`. The Instrument opens with eight health cells and a domain
grid. **Neither first screen contains a single fact about Australia.** The brief says to penalise
exactly that, and I have.

**Its gap treatment is the best of the three, and gap treatment was weighted heaviest.** §1.3 is
the sharpest paragraph in all three documents:

> Inventory-first: `abs_indigenous_population_by_lga` — 0 rows — EMPTY — 31% CONNECTED
> Question-first: CANNOT ANSWER YET — *"Is this LGA's Indigenous youth over-representation above or
> below the state rate?"* — blocked by one empty table; the fix is a CC-BY-4.0 download; effort S;
> unlocks 4 other questions.

Identical information, opposite affect. A coverage bar is a chore. An unanswerable question is a
want-list with a payoff. That single reframe does more for "see the gaps, find opportunities" than
every glyph alphabet in the other two documents combined — because it makes the gap *want* to be
closed rather than merely be visible.

**Every card ends in a verb.** The WANT LIST is ranked by `questions unlocked × dollars made legible
÷ effort` and its top row is "one CC-BY-4.0 ABS download." That is "know what to do next" rendered
literally.

**It did original work and corrected its own sources.** It re-ran the charity fragility question
with a median instead of a mean and found 773 fragile charities at 0.9 months rather than the
document's 1.1 [R, its §3.4]. It is the only one of the three that used its design pass to *fix* a
number rather than relay one. It also correctly carries VERIFICATION's V23 correction (Hays
$123.00bn, not Gilbert and Tobin) — the Instrument does not; see §3.

**`COPY THE CLAIM`** is the answer to a problem the Instrument concedes it cannot solve. You cannot
copy the number without the coverage fraction, the exclusions and the caveat. Findings leave the
building with their qualifications attached. That is the mechanism by which this database becomes
influence rather than an internal tool.

**The `refused` form is a first-class route.** `detention-by-lga` gets a full card and a full page
and renders no chart at all, naming the 13-row PDF-headline source and the missing Northern
Territory. A refusal, stated in public, is a finding. Neither of the other designs gives refusal its
own URL.

**The sample-size track** — a hairline `n` bar under every time series — is a structural fix for the
exact error class that got past two review passes (every watchhouse headline anchored on n=2). One
extra `<rect>` row, generalises to both apps.

### What costs it points

**Curation debt is the real threat and its own §11.2 names it correctly.** Twenty-six hand-written
questions, each with hand-authored SQL, a caveat, a claim phrasing and a uniqueness basis. That is
Grover's Catalog Ghost Town failure mode aimed squarely at this design. The mitigations are genuine
— `caveat NOT NULL` with a length floor, `executable_or_blocked`, exactly one binding join enforced
by a partial unique index — but they stop a half-written question from *inserting*, not from
*ageing*.

**The 26-question ceiling is the deeper problem, and it is a vision problem, not a maintenance
problem.** Ben asked to see it *all*, cross-sectioned. Twenty-six questions is a curated best-of,
and all twenty-six came from a document Ben's team already wrote. **It surfaces the opportunities
Ben already thought of. It cannot discover one he did not.** That is the single thing it must steal
from the Atlas, and §4 says how.

**A question can go confidently wrong in a way a row count cannot** (its own §11.3). If someone
changes `measure_kind` semantics, `answer_sql` keeps returning a healthy-looking number. It has
answer history and sentinels; it has no estate-wide anomaly detection. The Instrument's tape is the
missing half.

---

## 2. THE ATLAS — 6/10

### What it gets right, and it is more than the score suggests

**It produced the only genuinely new civic finding generated during any of the three design passes.**
Its §2.2 ran the degree distribution and found that the two largest nodes in the entire 3.43M-edge
graph are `entity_type='program'` — AusTender procurement *categories* materialised as
organisations, holding 605,135 edges between them, **17.6% of the whole graph**. Every centrality
measure, power score and "most connected" ranking in the product that includes them is wrong.

I verified the structural half of this today: **[V]** `Specialised Supplies and Services` and
`Specialised Support Services` are both `entity_type='program'`. I also noticed something none of
the three designs caught: **`Department of Defence` appears twice in `gs_entities`** [V] — a
duplicate-entity defect sitting on the third-largest hub in the graph.

That is what "learn something about Australia" looks like, and the Atlas is the only design that
produced it. It also gave it a permanent home (§11.5, a banner that fires on
`entity_type='program' AND degree > 10,000`).

**Its L3 flow matrix is the most valuable single artefact proposed in any of the three documents**,
and it is the one thing that answers "cross-sectioned in a way no one else does" *generatively*
rather than editorially. Verified today **[V]**: exactly **11 entity types × 11 × 10 relationship
types**. That is up to 1,210 automatically computed cross-sections of how kinds of Australian
organisation move money to each other — companies fund charities 699,387 times, foundations fund
companies almost never — every cell clickable, zero curation, zero hairball risk by construction.

**Its absence alphabet is the sharpest gap primitive produced.** The `+` vs `×` split — *never
measured* (blue, our omission) versus *measured, and the answer is zero* (red, the data's failure) —
is a distinction no data catalog product on the market makes, and it determines whether the fix is
an afternoon or a rebuild. The Interrogator collapses both into one `┼`.

**Three more first-class gap objects:** the L4 system-coverage strip (*which of 12 systems hold this
organisation — 6 of 12*, with `+ no rows carry this ABN` per system); the Isolate panel for the
209,172 entities (34.3%) with no edge at all, which names the systems and states what each holds
rather than saying "no connections"; and the L2b null-reason breakdown (nulls by reason code, never
as one number) generalised from the LGA-attribution discipline.

**It also honoured the "never say" rule best**, with `copy.ts` exporting both a `FORBIDDEN` array
and the `PERMITTED` phrasings as functions, greped by CI.

### What costs it points, heavily

**The first six of its ten build steps are metadata.** The vision arrives at step 7. Steps 0–6 build
a mosaic, a glyph alphabet, a join ledger, a domain constellation, a minimap and eight lenses — all
of it about the shape of the database. A person opening this in week three learns that 621 objects
are undescribed and 71 matviews are unscheduled. Those are facts about the catalog.

**Its structural choice puts the civic data at the bottom of a schema ladder.** Reaching an
organisation means descending `estate → domain → dataset → column → entity`. That is an odd path to
"which 47 organisations received that money", and it inverts the priority the vision states. The
Interrogator's §11.7 lands this punch cleanly: *"it makes the finding a property of the schema
rather than the schema a property of the finding."*

**Its own §21.7 is the most damaging concession in the set:** the deepest level is where the data is
weakest, so the Atlas *"repeatedly invites the user down a ladder whose bottom rung is missing"* and
must spend design effort apologising for it. A design whose entire payoff is depth cannot afford
that.

**Cost.** Six levels × four forms × eight lenses × a refusal registry, for a one-to-two-person team.
It concedes this at §21.4.

---

## 3. THE INSTRUMENT — 5/10

### The strongest argument in the set, and it is true

Its §1.2 is the best-argued page anyone wrote:

> `justice_funding`: 218,022 → **157,116**. Minus 60,906 rows, minus 28%. **Nothing fired.**
> Three markdown data maps — `db-inventory.md`, `COMPENDIUM.md`, `schema-cache.md` — all went stale
> in four months and nothing failed.

And the killer line: *"An atlas built today would render `justice_funding = 157,116` perfectly and
correctly, and would have been just as blind to the moment 60,906 rows left."* That is true of the
Interrogator too. The exercise the parent agent is running right now — rebuilding a data map because
the last three rotted — is itself the evidence for this thesis.

**Three of its mechanisms are must-steals and §4 lists them.** THE TAPE with the anomaly rule; delta
as a first-class column with a global selectable baseline; and the burn-down clause
`621 to go · at 0/wk: never`, which is the only rendering in any of the three documents that turns a
static hole into an *urgent* one.

**THE SEAMS board is genuinely excellent and beats both rivals' join treatments.** A join is a row,
not an edge, ranked by `rows_at_stake × (1 − match_rate)` — *how much data this seam is losing right
now*. That single sort produces four civic consequences the other two designs only half-surface:
1.9M political-donation rows that cannot be attributed to any entity; 362,313 NDIS rows stranded at
state level because `lga_code` is 100% NULL; 68,172 well-formed GrantConnect ABNs absent from the
spine but present in the ABR; and a grain defect (3.16 rows per LGA key) that would make a
choropleth silently triple-count. None of those four is visible in a force-directed graph.

### Why it still comes third on this lens

**Five of six boards are about the health of the machine.** BOARD, LEDGER, SEAMS, DEFECTS and TAPE
are plumbing. THE BENCH is where Australia lives, and it is **built last** — slice 7 of 7, two days,
at the end. On this lens that is close to disqualifying: the vision is the last thing to arrive and
the first thing to be cut.

**Its own three concessions are fatal here, and it makes them honestly:**
- §12.2: *"THE BOARD is a wall of numbers with no narrative. A newcomer gets no story, no sense of
  what the database is about."*
- §12.4: *"Nothing here is shareable outside the operator's head. Nobody screenshots a terminal for a
  funder deck, an op-ed or a board paper."*
- §12.1: every delta, sparkline and anomaly is `?` on night one, and *"the other 1,408 objects render
  `?` for thirty nights."*

A design that, on day two, shows Ben a wall of yellow question marks and, on day thirty, tells him
that 74% of agent runs succeeded, has not delivered "understand how money and power move in
Australia."

**One rigour slip worth naming.** Its BENCH wireframe carries `$121,149.1m Gilbert and Tobin /
Treasury` as the phantom-contract exemplar. `VERIFICATION.md` V23 **[R, confirmed by grep this
session]** corrects that: the row exists exactly, but it is **#2**; #1 is **Hays Specialist
Recruitment, Treasury, $123.00bn**. The Interrogator carries the correction; the Instrument does
not. On a surface whose entire pitch is *"the number on screen and the number in the doc are the
same number by construction"*, shipping a superseded exemplar in the flagship wireframe is the wrong
error to make. It is small. It is also exactly the failure mode the design exists to prevent.

---

## 4. THE TRANSPLANT LIST — what to graft, and onto what

**Host: THE INTERROGATOR.** Everything below is named as a specific, extractable idea.

### From THE ATLAS → the Interrogator (five transplants, one of them essential)

| # | Idea | Why it must move | Where it lands |
|---|---|---|---|
| **A1** | **The L3 flow matrix + `mv_clarity_flow`** — 11 entity types × 11 × 10 relationship types, ≤1,210 cells, one nightly matview over a ~40s aggregate | **This is the essential transplant.** It is the cure for the Interrogator's only fatal weakness — its 26-question ceiling. A curated registry surfaces opportunities Ben already wrote down; a matrix surfaces ones nobody wrote down. Cardinality verified today **[V]** | Register it as question #27 whose `form` is `matrix` and whose *answer is a surface*: every cell click mints a question stub with its own ingredients, coverage and caveat. The registry stops being the only source of cross-sections |
| **A2** | **The category-node sentinel** — `entity_type='program' AND degree > 10,000` fires a permanent banner | A live defect invalidating every centrality and power score in the product. 2 entities, 605,135 edges, 17.6% of the graph. Structural half verified **[V]** | `clarity_sentinel` with `applies_to` = every question touching centrality. Add a sibling probe for duplicate canonical names — **`Department of Defence` appears twice** [V], and no design caught it |
| **A3** | **The `+` / `×` glyph split** — never-measured (blue, ours) vs measured-and-zero (red, the data's) | The Interrogator has one `┼` for both. The distinction decides whether the fix is an afternoon or a rebuild | `phrasing.ts` becomes `glyphs.ts`. Combine with the Instrument's `?` (see I6) for a four-state alphabet |
| **A4** | **The L4 system-coverage strip + the Isolate panel** — *"6 of 12 systems hold this organisation"*, and for the 209,172 edgeless entities (34.3%), name each system and state what it holds | The best entity-level gap object produced. It is also the *designed alternative* that makes the "never say no connections" rule survivable rather than merely prohibited | The Q2 rows page, and `/entities/[gsId]` in the main product |
| **A5** | **Null-reason breakdown** — nulls by reason code, never as one number, with `+ "nulls here are not reason-coded, we cannot tell you why"` when unregistered | Generalises the LGA-attribution discipline the repo already earned | The dossier's column profile |

### From THE INSTRUMENT → the Interrogator (six transplants, two of them essential)

| # | Idea | Why it must move | Where it lands |
|---|---|---|---|
| **I1** | **THE TAPE + the anomaly rule** — `\|Δ\| / prev > 10%` OR a zero-crossing OR `missing_since` set → a `severity='critical'` event that stays **NO REASON RECORDED**, in red, until a human writes one | **Essential.** The Interrogator concedes (§11.3) that a question can go confidently wrong and offers no estate-wide detector. This is the only mechanism proposed anywhere that would have caught the 60,906-row loss | New `clarity_event` table. **Extend it beyond row counts: fire on `clarity_answer.headline` moving >10% between nightly runs with no ingredient row-count change** — that is semantic drift, the exact failure the Interrogator fears |
| **I2** | **Delta as a first-class column + a global baseline selector** (`[` `]` cycling LAST / 7d / 30d / 90d, one `searchParam`, applies to every screen at once) | The Interrogator has a 6-run sparkline and "3 MOVED SINCE 14 AUG". That is not the same as every number carrying its own delta against a baseline you chose | Board cards, ledger, want list |
| **I3** | **The burn-down clause** — `621 to go · at 0/wk: never` | The best gap rendering in the set. It is what converts a metric into a decision | **The WANT LIST.** Every want gets a velocity and an ETA, so a want that has not moved in 30 days becomes loud rather than quiet |
| **I4** | **SEAMS ranked by rows-losing** = `rows_at_stake × (1 − match_rate)` | The Interrogator's `/clarity/joins` is a force graph. The Instrument's is a ranked table of what each broken join costs. **The table is the one that produces a finding** | Make the ranked table the default at `/clarity/joins`; put the graph behind the existing `RENDER` button |
| **I5** | **The honest cold-start protocol** — backfill from `data_catalog_snapshots` (1,419 rows over 25 spine tables), seed the three known historical row-moves as unexplained anomalies dated 2026-04-02, and render `?` rather than `0` when history is thinner than the baseline | Makes I1 and I2 useful on night one instead of night thirty | Slice 1 of the build, before anything renders |
| **I6** | **`?` as a glyph distinct from `+`**, plus the CI test that **fails the build if any cell renderer can return empty** | Probe-timed-out is not the same as not-yet-documented. And the build-time guarantee is a stronger mechanism than any of the three designs' prose rules | With A3 → `+` ours-missing (blue) · `?` unmeasurable (yellow) · `×` measured-zero (red) · `▚` out-of-scope (hatched) |
| **I7** | **The persistent estate/health strip** — one line above the board answering *"can I trust today's numbers"* before you read one | The Interrogator's `EstateStrip` carries counts but not health. Add scan age, matview staleness, and last-run status | The existing black band |

### What the Interrogator keeps that neither rival has

`COPY THE CLAIM` · the sample-size track · the `refused` form as its own route · **`FEEDS` / `BLOCKS`
on the ledger** · claim-level provenance with exactly one DB-enforced binding join · the phrasing CI
guard · the `UNVERIFIED` and `PILOT` stamps as schema fields rather than memory.

### The single best individual idea across all three documents

**`FEEDS n` / `BLOCKS n` on the object ledger** (Interrogator §7). It gives every inventory row the
one thing a catalog row can never say on its own — *what is this FOR* — it is derived entirely from
the registry with zero curation, and **`FEEDS 0` sorted ascending, filtered to `rows > 1,000,000`,
is a two-click answer to "what enormous thing am I not using"**: today that returns `abr_registry`
(20.0M), `asic_name_lookup` (2.1M), `privacy_audit_log` (1.28M).

That is "find opportunities" implemented as a sort order. It makes the inventory half of Ben's
request *better* than either inventory-first design does, which is why the question-first design
should host the inventory rather than the other way round.

---

## 5. THE VERDICT, AND THE HONEST CAVEAT

**Winner: THE INTERROGATOR**, and it is not close on this lens. It is the only one of the three whose
front door contains Australia. It is the only one that converts a gap into a priced opportunity. It
is the only one whose findings can leave the building intact. And it is the only one that used its
own design pass to correct a number rather than relay one.

**To be complete it must steal exactly two things, and both are essential rather than nice:**

1. **The Atlas's L3 flow matrix (A1)** — without it the Interrogator's ceiling is twenty-six
   questions Ben already thought of, and "see it all, cross-sectioned" is not twenty-six of anything.
   The matrix is the machine; the registry is the magazine. It needs both.
2. **The Instrument's tape and anomaly rule (I1)** — without it, the Interrogator ages into exactly
   the artefact this whole exercise exists to replace: a confident, well-designed surface displaying
   numbers that quietly stopped being true. Extend it to `clarity_answer.headline`, not just row
   counts.

Then take A2, A3, A4, I2, I3, I4 and I6 as high-value, low-cost grafts, and I5 as a slice-1
prerequisite.

**The honest caveat, stated because the brief asked for rigour rather than a clean answer.** The
Instrument scores 5 here and would score 9 on the lens *"will this still be true in six months."*
Its argument is correct: three markdown maps rotted in four months and nothing failed. The winning
design is the one that most needs the loser's discipline, which is why I1 is non-negotiable rather
than optional. If the build drops I1 to save two days, the Interrogator becomes the fourth artefact
in this repo to look authoritative while going quietly stale — and it will be worse than its
predecessors, because a wrong *claim* travels further than a wrong row count.

---

## VERIFICATION

**Verified by me this session [V]:** `gs_relationships.relationship_type` — exactly 10 values
(donation 1,073,308 · grant 895,054 · contract 699,387 · directorship 440,128 · member_of 221,563 ·
shared_director 95,476 · lobbies_for 2,452 · subsidiary_of 1,267 · affiliated_with 505 ·
partners_with 44), confirming the Atlas's L3 axis; `gs_entities.entity_type` — exactly 11 values
(company 272,535 … trust 1, unknown 1), confirming the other axis; that
`Specialised Supplies and Services` and `Specialised Support Services` are both
`entity_type='program'`, confirming the structural half of the Atlas's category-node finding; that
**`Department of Defence` appears twice in `gs_entities`**, which no design names; and that
`VERIFICATION.md` V23 corrects the phantom-contract exemplar to Hays Specialist Recruitment
($123.00bn, Treasury), making the Instrument's Gilbert-and-Tobin wireframe figure superseded.

**Relayed [R]:** every figure quoted from the three designs and from GROUND_TRUTH / VERIFICATION,
carrying its original marker. I did not re-measure the degree distribution (330,460 max, p99 84,
2,594 over 150), the three live question timings (279 ms / 196 ms / 3,076 ms), the 23 gap-metric
values, or the 60,906-row `justice_funding` drop.

**Not checked:** nothing in any of the three designs has ever rendered; the three `clarity_*`
migrations remain unapplied and `clarity_refresh()` has never been executed, so every performance
figure in all three documents is an estimate. I loaded no page in a browser and applied no
migration.
