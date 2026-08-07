# ACT money surface — audit against Phase 1

**Status:** audit · **Date:** 7 August 2026 · **Audits:** `phase-1-project-funding-operating-system.md` (3 Aug 2026)

Not a new plan. Phase 1 already decided the right thing four days ago: open ACT, pick any project,
get a small list of verified, actionable funding routes. This is the measurement of what shipped,
what didn't, and the one data defect that will make Phase 1 fail even when fully built.

Scope note: this is ACT's internal money surface, not the SE registry product. `buyer-wedge.md`
does not gate it.

Every figure below was queried directly against `tednluwflfhxyucgwigh` on 2026-08-07.

---

## The finding

Finding grants is not the problem. There are five parallel discovery engines, one project wired to
them, and a ranking built on invented money.

### The measured inversion

| Project | Funders ≥85 fit | In GHL | Ever touched | Pipeline rows | Last pipeline touch |
|---|---|---|---|---|---|
| Empathy Ledger | 99 | 0 | 1 | 4 | 2026-07-31 |
| PICC | 84 | 0 | 0 | 8 | 2026-07-31 |
| Farm | 44 | 0 | 0 | 32 | 2026-05-31 |
| JusticeHub | 43 | 0 | 2 | 6 | 2026-07-31 |
| Goods | **10** | **17** | **3** | 22 | 2026-08-01 |
| Harvest | 6 | 0 | 0 | 14 | 2026-05-22 |
| ALMA, CivicGraph, Contained, Elders Room, Station Precinct | 0 | 0 | 0 | 0 | never |

**The project with the fewest high-fit funders owns the entire apparatus.** Goods has 10 high-fit
funders and all 17 GHL contacts. Empathy Ledger and PICC have 183 between them and no surface at all.

Five of eleven projects are invisible to the money machine entirely.

### Where the Goods monopoly is written

Three places, all small:

- `apps/web/src/lib/services/act-one-desk.ts` — lines 179, 196, 212, 224 hardcode
  `project: 'Goods'` on every money kind (`money`, `funder`, `grant`, `buyer`).
- `apps/web/src/lib/services/goods-funder-scan.ts:66` — `.eq('org_projects.slug', 'goods')`.
  One line. The service is otherwise general.
- `act-workspace-shell.tsx:311` — the rail's "Money in" tree (Foundations · Funder Scan · Grants ·
  Money) exists only inside `GOODS_RAIL_SECTIONS`.

`goods_relevance_score` is a per-project column on the shared `grant_opportunities` table. It cannot
scale past one project without eleven columns.

---

## Why the queue is ignored

1,005 of 1,063 foundation matches sit at `saved`, untouched. This is not laziness. The queue is
untrustworthy, and that judgment is correct.

Of the 286 matches scoring ≥85:

- **276 carry the identical template summary** `[auto-matched] themes: … · home-state funder ·
  gives ~$500,000/yr`.
- **The giving figures are placeholders.** `foundations.total_giving_annual` behind those matches
  clusters on three round values — 500,000 (×48), 25,000 (×44), 100,000 (×23), null (×8) — with
  exactly **two** real computed figures in the set. The fit summary then reprints the placeholder
  as justification.
- **Only 10 distinct fit_score values across 286 rows.** That is a bucket, not a ranking.
- **Duplicate funders count as separate matches.** WCCT Southern / Northern / Central Sub-Regional
  Trust plus Western Cape Communities Trust — one funder, four rows, all scored 100.
- **Category errors.** Bravehearts Foundation — a program-delivering child-protection charity, not a
  grantmaker — is matched to Empathy Ledger at fit 100.
- **1,063 of 1,063 have a "why". 19 have a next step. 11 have a next touch date.**

The engine explains why it matched and never says what to do, and the money it ranks on is invented.

This is the failure mode already recorded in memory as `feedback_data_quality_before_scoring`:
math on bad data dresses up noise as signal.

---

## Phase 1: what shipped

### The two registries diverged — the plan's explicit prohibition

> "The recommendation registry must reference canonical project IDs rather than acting as a second
> project registry." — Phase 1

It is acting as a second project registry.

| | Codes |
|---|---|
| `org_projects` | ACT-EL, ACT-FM, ACT-GD, ACT-HV, ACT-JH, ACT-JH-AL, ACT-JH-CG, ACT-JH-CT, ACT-PI, ACT-PI-ER, ACT-PI-SP |
| `act_grant_recommendations_current` | ACT-EL, ACT-FM, ACT-GD, ACT-HV, ACT-JH, ACT-PI, ACT-CORE, ACT-CS, ACT-GP, ACT-CN, ACT-MY |
| **Overlap** | 6 |

Consequences:

- **90 recommendations (5 codes × 18) are recomputed daily and can never reach a project page** —
  ACT-CORE, ACT-CS, ACT-GP (Gold.Phone), ACT-CN, ACT-MY (Mounty Yarns) have no `org_projects` row.
- **5 real projects get nothing** — alma, civicgraph, contained, elders-room, station-precinct have
  no recommendations.
- **The same project has two codes.** Contained is ACT-CN and ACT-JH-CT. CivicGraph is ACT-CS and
  ACT-JH-CG.

### The per-project funding page is a stub with a structural guarantee of emptiness

`/org/act/{project}/funding` is 40 lines. Phase 1 committed five sections; two shipped
(unresolved decisions, this-week queue). Missing: Funding need, Apply now, Source health.

Worse, "this week" filters the **portfolio-wide five-place queue** by project
(`project-funding-service.ts:120,179` — `limit = 5`). Five places across eleven projects means **at
least six project funding pages permanently render "No opportunity from this project is in the
five-place portfolio queue this week."**

Phase 1 specified a per-project **Apply now: maximum ten verified candidates**. That was never
built. The page shows a filtered portfolio queue instead of its own list.

### Orphaned surfaces

- `/org/act/funding` — the portfolio desk. **Zero inbound links anywhere in the codebase.**
- `/org/act/pipeline` — 125 rows, not on the rail.
- `/ops/grant-recommendations` — the only surface for the 11-project engine. Linked from `/home`,
  global `nav.tsx` and `/reports/grant-frontier` — **the CivicGraph ops side. Zero links from the
  ACT rail.** The multi-project engine's UI lives outside the workspace Ben works in.

The rail comment at `act-workspace-shell.tsx:93-97` records the 2026-08-05 decision that Money,
Funding and Pipeline left the rail and "stay reachable by URL". In practice that means unreachable.

---

## The substrate is better than the surface

Worth stating plainly, because it changes what the work is:

- **100% embedding coverage** — 25,872 of 25,879 grants, all 4,463 open ones, refreshed today.
  Semantic matching infrastructure is built and current.
- **`act_grant_recommendations_current` is the right engine.** Eleven project codes, recomputed
  today, and a genuinely explainable model: `theme_score`, `geography_score`, `eligibility_score`,
  `timing_score`, `track_record_score`, `won_funder`, `verification_status`, `tag_density_penalised`.
  Far better than `goods_relevance_score`'s single number.
- **A real track record exists.** 89 recorded decisions: 62 passed, 26 won, 1 watching — wins
  spanning 2025-02 to 2026-05 across 9 project codes. `track_record_score` already consumes it.
- **`project_funding_profiles` has all 11 projects** and an unused `next_question` column.

What is missing is not intelligence. It is trust and routing.

### The number that should be on the wall

**348.** That is how many grants close in the next 60 days across the entire open pool of 4,463.
Across eleven projects, roughly 32 each. A human-sized queue.

Every surface currently shows 25,879 and makes Ben do the narrowing.

---

## What trycompai/crm actually gives us

The reference is unusually on-point for this specific failure. Four moves to take, one to refuse.

**1. "Nothing about a person is guessed." Tools report observations, never confidence scores.**
> "No tool accepts a confidence score, because a model asked to grade its own certainty will, and
> it will be wrong."

`fit_score` is a model grading its own certainty, and it is wrong — 286 rows at ≥85 with two real
giving figures between them. Replace the number with named observations: *"ACNC AIS lists $X to Y
purposes in FY24"*, *"has funded 3 orgs in your LGA"*, *"DGR Item 1 — Butterfly can receipt"*.
A row either carries evidence or it does not appear.

**2. Strong evidence updates records; weak evidence becomes a human-reviewed suggestion.**
The 1,005 `saved` rows are weak signals wrongly written as records. Demote them to a suggestions
tray that costs nothing to ignore. Promote only rows with a verified giving figure and verified
grantmaker status.

**3. `schedule_recheck` — the agent books its own follow-up, visibly.**
19 next steps and 11 next-touch dates across 1,063 rows is the whole gap. Every promoted row should
arrive with a dated next move already on it.

**4. The Agent tab: reasoning, discarded leads, and unanswered questions.**
"Unanswered questions" is the missing primitive. The recommender should be able to say *"I cannot
rank Empathy Ledger funders until you tell me whether it can receipt through Butterfly"* instead of
emitting 99 confidently wrong matches. `project_funding_profiles.next_question` already exists for
this and is unused in the flow.

**Refuse: the autonomous always-on agent daemon.** ACT's problem is not suggestion throughput —
suggestions already outnumber decisions 1,005 to 13. More autonomous generation makes it worse.
Take the epistemics, leave the daemon.

---

## Order of work

Sequenced by money unlocked per unit of effort. **Step 2 must land before step 3**, or step 3
industrialises the noise.

**1. Reconcile the two project registries.** Make `act_grant_recommendations_current` join on
canonical `org_projects.id`. Resolve the duplicate codes (Contained: ACT-CN vs ACT-JH-CT;
CivicGraph: ACT-CS vs ACT-JH-CG). Decide whether Gold.Phone, Mounty Yarns and ACT Core become
`org_projects` rows or are dropped. Unstrands 90 daily recommendations. Cheapest fix here.

**2. Gate on verified money before anything reaches a desk.** A funder may not be promoted unless:
its giving figure traces to a real ACNC/AIS filing (not 500,000 / 25,000 / 100,000); it is a
grantmaker, not a program charity; and it is not a duplicate trust of a funder already listed.
On today's data this cuts 286 to a double-digit number. **That is the correct outcome** — ten
funders Ben believes beat 286 he does not.

**3. Delete the Goods hardcode.** Four literals in `act-one-desk.ts`, one `.eq()` in
`goods-funder-scan.ts`, and lift "Money in" out of `GOODS_RAIL_SECTIONS`. Once step 2 has cleaned
the pool, this exposes Empathy Ledger's and PICC's funders to the desk Ben already uses every day.

**4. Build the per-project "Apply now" ten.** Replace the filtered portfolio-five on
`/org/act/{project}/funding` with the project's own ranked ten, from
`act_grant_recommendations_current`. Removes the guaranteed-empty page for six projects.

**5. Retire the losers.** `goods_relevance_score` (cannot scale past one project). Either put
`/org/act/funding` on the rail or delete it — a zero-inbound-link page is not a surface. Bring
`/ops/grant-recommendations` into the ACT workspace or link it from the rail.

**6. Give the recommender a mouth.** Wire `project_funding_profiles.next_question` so unresolvable
eligibility (DGR route? which entity? auspice via Butterfly?) surfaces as a question to Ben rather
than a fabricated match.

**7. Decide the five dark projects.** ALMA, CivicGraph, Contained, Elders Room and Station Precinct
have no profile, no funders, no pipeline. Give each a funding profile, or mark them explicitly
not-fundraising so the portfolio view stops implying coverage it does not have.

---

## Provenance

All figures queried 2026-08-07 against project `tednluwflfhxyucgwigh` via `scripts/gsql.mjs`.
Tables: `org_projects`, `org_profiles`, `org_project_foundations`, `org_pipeline`, `foundations`,
`grant_opportunities`, `act_grant_recommendations_current`, `act_grant_recommendation_decisions`,
`project_funding_profiles`. Code claims verified by reading the named files and line numbers.
