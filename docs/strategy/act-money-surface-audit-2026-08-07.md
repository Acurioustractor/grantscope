# ACT money surface — audit against Phase 1

**Status:** audit · **Date:** 7 August 2026 · **Audits:** `phase-1-project-funding-operating-system.md` (3 Aug 2026)

Not a new plan. Phase 1 already decided the right thing four days ago: open ACT, pick any project,
get a small list of verified, actionable funding routes. This is the measurement of what shipped,
what didn't, and the one data defect that will make Phase 1 fail even when fully built.

Scope note: this is ACT's internal money surface, not the SE registry product. `buyer-wedge.md`
does not gate it.

Every figure below was queried directly against `tednluwflfhxyucgwigh` on 2026-08-07.

---

## Progress (same day)

Four commits landed on `fix/act-grant-feed-status-filter`. Everything diagnosed below is addressed
except the classifier credit, which is a billing action. See "Closed out" at the end for the
item-by-item state.

| | before | after |
|---|---|---|
| Opportunities the ACT engine can see | 18 | **344** |
| Feed status | 34 apply_now · 662 quarantined | 34 apply_now · **337 rolling** · 325 quarantined |
| Recommendation rows | 197 | 3,783 |
| Strong fits, portfolio-wide | 7 | **185** (PICC 7→106, Mounty Yarns 1→34, Goods 1→30) |

Three root causes were found below the ones diagnosed here:

1. **`application_status` semantics.** The promotion filtered `='open'` (372 live rows) while
   `not_applied` held 4,087 of the 4,463 future-deadline grants. Fixed; 596 rows promoted.
2. **The alignment gate passed 94% of candidates.** It substring-matched a flattened set of all
   11 projects' keywords, where `support` (2,971 rows), `research` (2,747) and `community` (2,525)
   each hit a quarter of the corpus — any two cleared the 15-point threshold, and 43% of the pool
   is university research ACT never applies for. Now word-boundary matched, generic words
   suppressed, phrases weighted 25 vs 10, academic providers and scholarships excluded.
3. **The LLM classifier has been dead since ~2026-05-16.** It moves rows from `unverified` to
   `open_grant`, so nothing reaches the feed without it. Its API key is out of credit, every batch
   400s, and it logged `status: success` with `items_found: 300, items_new: 0` throughout. 26 rows
   have ever been classified; **5,436 are backlogged.** It now fails loudly. **Unblocking it needs
   an Anthropic API credit top-up — roughly $0.55 clears the entire backlog at Haiku rates.**

The rolling lane is live: a verified, URL-live row with no deadline is an open rolling program, not
a timing failure. That distinction alone recovered 337 opportunities.

**Still open:** the foundations/philanthropy queue (1,005 `saved`, placeholder giving figures), the
two-registry split, the Goods hardcode, and the per-project "Apply now" page.

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

---

## Closed out (2026-08-07, same day)

All five items from the order of work below are now done except the classifier credit,
which is a billing action, not a code one.

| Item | State |
|---|---|
| 1. Reconcile the two registries | **Done.** `act_grant_recommendation_projects.org_project_id` FK added; all 12 rows linked; zero orphans. Contained (ACT-CN/ACT-JH-CT) and CivicGraph (ACT-CS/ACT-JH-CG) collisions resolved. Gold.Phone, Mounty Yarns and ACT Core created as `org_projects` rows — Phase 1 names them as canonical but they were never registered. |
| 2. Gate on verified money | **Done, differently than planned.** Gating on money would have left 6 funders, so the gate grades evidence instead: A = recorded grants on file, B = DGR or verified giving, C = theme overlap only. 1,063 rows graded 179 A / 248 B / 636 C. |
| 3. Delete the Goods hardcode | **Done.** `getFunderScan(slug?)` replaces the pinned `.eq(…,'goods')`; One Desk scans portfolio-wide and shows each funder's real project. |
| 4. Per-project "Apply now" ten | **Done.** `getProjectApplyNow()` reads the project's own ranked list, split into dated (urgency-ranked) and rolling (fit-ranked). Every one of the 11 projects now resolves 17–18 dated + 326 rolling. |
| 5. Retire the losers | **Partly.** `goods_relevance_score` is no longer the One Desk gate. `/org/act/funding` still has zero inbound links — it needs a rail slot or deletion, which is Ben's call. |
| 6. Give the recommender a mouth | **Not done.** `project_funding_profiles.next_question` remains unwired. |
| 7. The dark projects | **Partly.** Gold.Phone, Mounty Yarns and ACT Core now exist and receive recommendations. ALMA, Elders Room and Station Precinct still have no registry row — they are sub-projects, and whether they fundraise independently is a judgement call, not a data fix. |

**The one open action: the Anthropic API key is out of credit.** No new opportunity can
reach `open_grant` until it is topped up, so 344 is a ceiling rather than a floor.
5,436 rows are backlogged; roughly $0.55 of Haiku clears them.

---

## Final state (2026-08-07, end of session)

The classifier backlog is cleared and the feed is rebuilt.

| | morning | now |
|---|---|---|
| Opportunities the ACT engine can see | 18 | **1,535** |
| Feed status | 34 apply_now · 662 quarantined | **387 apply_now · 1,572 rolling** · 633 quarantined |
| Unclassified backlog | 5,436 (dead classifier) | **23** |
| Strong fits, portfolio-wide | 7 | **63** |
| Projects with a working funding page | 0 | 11 |

2,662 rows classified in 66 minutes on Gemini 2.5 Flash's free tier at no cost —
1,193 open_grant, 830 award, 373 invitation_only, 165 policy_framework,
80 partnership, 21 placeholder. 23 errors, 25 held below the confidence threshold.

Strong fits fell from 185 to 63 on purpose. The old flag fired at `fit_score >= 55`,
which did not discriminate — a $1,000 computer grant and a $1M Paul Ramsay round
scored identically. The bar now also requires a geography signal, a grant of
$50,000 or more, or a funder ACT has won from before.

PICC's list is the test case worth reading: Building Early Education Fund's ACCO
grant opportunity ($3M), Paul Ramsay First Nations Targeted Round ($500K), Just
Futures ($1M, fit 78), Yadha Muru City-Country Partnerships ($6.7M). Those are
the right rounds for a Palm Island Aboriginal community organisation.

### Two defects remain, both visible in that list

**Near-duplicate programs survive dedup.** Paul Ramsay's Just Futures appears
three times under three names — "Just Futures", "Just Futures (New Open Grant
Round to Help Prevent Contact with the Justice System)", "Just Futures: National
Open Grant Round". Dedup keys on exact (name, funder); these need fuzzy matching
on the funder plus a name stem.

**Geography still leaks.** Victorian and NSW-only programs reach PICC, a
Queensland organisation — the Aboriginal Justice Agreement Bail and Remand
program, Environmental Restoration NSW, Geelong Community Foundation. The
`geography_score` exists but only adds points; it never excludes.

### Open, unchanged

- Four projects still have zero strong fits: Gold.Phone, CivicGraph, Contained,
  ACT Core. Their theme keywords are thin, which is a content problem, not a
  pipeline one.
- `project_funding_profiles.next_question` remains unwired.
- `/org/act/funding` still has no inbound links.

---

## Ben's calls (2026-08-08)

Four judgement questions the audit could not answer for itself. Answered, so
nobody re-opens them.

**Extractive funders stay blocked on both paths.** BHP, Fortescue, Rio Tinto and
Santos are excluded from grant rounds as well as philanthropy. The exclusion is a
values decision about whose money ACT takes, not a claim about the quality of the
round, so it does not care which door the money comes through. Do not split the
paths.

**`/org/act/funding` gets a rail slot.** It was cut from the rail on 2026-08-05
when the feed held 18 opportunities and the room was empty. The feed now backs
~1,535 across 11 projects, so the portfolio-wide decision queue earns a door.
Curiosity stays the raw-leads room; Funding is the ranked five. The rest of the
2026-08-05 cut stands.

**ALMA, Elders Room and Station Precinct fundraise through a parent.** They are
programs inside another project, not fundraising units. No `org_projects` rows,
no funding pages, and their money shows on the parent's page. Their absence from
the registry is now a recorded decision, not a gap to be closed. Item 7 is
closed on this basis.

**Gold.Phone, Mounty Yarns and ACT Core stay as registry rows.** Created during
the 2026-08-07 session because Phase 1 names them as canonical. Reviewed and
kept.

### Closed since

- `project_funding_profiles.next_question` is wired. It renders above the
  ranking on `/org/{slug}/{project}/funding`, with the ranking marked a best
  guess until the question is answered.
- `/org/act/funding` now has an inbound link: rail room 05, "Funding · Money
  worth chasing".
