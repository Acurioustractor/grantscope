# Admin screens — UX audit pass 1

2026-08-18. Surface: `/ops`, `/ops/health`, `/ops/claims`, `/ops/grant-recommendations`,
`/admin/api-usage`. Reviewer is Ben, reviewing his own system, so findings assume CivicGraph
vocabulary and go straight at what is wrong.

Shots in `docs/ux-audit/shots/admin-*.png`. Effort ranked S / M / L. Phase 1 only — nothing fixed.

Both routes are properly guarded (`requireAdminPage` on each layout, `/ops` also in the middleware
`protectedPrefixes`). Access was not a finding.

---

## A1 — `/ops/grant-recommendations` shows zeros for everything, and the cause is upstream (L)

**Clarity / Meaning.** Eleven project tiles all read `0 · STRONG 0 TOP · MAX 0`. Every decision chip
reads `(0)`. `0 total · 0 strong fits`. A full filter apparatus — search, project, min score,
deadline, funder, strong-fits, dedup, pile-by, nine decision chips — operating on nothing.

Traced it, because "empty screen" and "broken screen" need different fixes:

| table / view | rows |
|---|---|
| `act_grant_recommendations` (base) | 22,252 (2,881 with a future deadline) |
| `act_grant_recommendation_decisions` | **89** |
| `act_grant_recommendation_projects` | 12 |
| `act_grant_recommendations_current` (what the page reads) | **0** |

The `current` view requires `cs.feed_status = ANY('apply_now','rolling')` from
`act_funding_opportunity_current_status`. **Every one of the 2,592 rows in that table is
`quarantined`.** Nothing qualifies, so the view is empty.

So: the page is not broken and the data is not missing. An upstream quarantine has swallowed 100%
of the feed, and **89 real decisions are rendering as zeros** with nothing on screen saying so.

**Decision for Ben:** is a 100%-quarantined feed correct (the source went bad) or a stuck pipeline?
That answer decides whether the fix is "unstick the feed" or "say on screen that the feed is
quarantined, and show the 89 decisions anyway".

## A2 — the marketing site header renders on top of the app shell (S)

**Aesthetic / Clarity.** `/ops`, `/ops/claims`, `/ops/grant-recommendations` and
`/admin/api-usage` all render the public nav bar — SEARCH · FUNDING · DATA · POWER · REPORTS ·
SUPPORT, plus **LOGIN** and **START FREE** — above the shell, with the shell inset in a box
instead of full-bleed. On an authenticated admin page, offering LOGIN and START FREE is nonsense.

**`/ops/health` does not do this** — it renders correctly, full-bleed, no marketing chrome. So one
of these layouts is right and the others inherit something they should not. That is the fix's
starting point.

## A3 — the same metric reports two different numbers on two admin screens (S)

**Meaning / honesty.** Foundations profiled:

- `/ops` — **598** of 11,177 (5.4%)
- `/ops/health` — **919** of 11,177 (8.2%)

Same denominator, different numerator. At least one is wrong, or they mean different things and
neither says which. On the screens whose whole job is telling Ben whether the data is healthy, a
disagreement between two health numbers is the worst possible defect.

## A4 — ops pages are navigational dead ends (M)

**Clarity — dead-end disease.** The rail renders its Ops section only when `user.isAdmin`, which
was false in this session even though the ops routes themselves admitted me. Result: from `/ops`
there is no link to `/ops/health`, `/ops/claims`, or anything else in ops. You can arrive at an
ops screen and have no way to reach its siblings without typing URLs.

Worth checking whether the rail's admin test and the route guard's admin test are the same test.
If they can disagree, the rail will keep lying about what exists.

## A5 — `/ops/claims` has an ACTIONS column that never contains an action (S)

**Clarity.** The table header promises `ACTIONS`; every cell is empty. The screen's entire purpose
is approving or rejecting claims, and there is nothing to click.

## A6 — `/ops/claims` has no empty state (S)

**Friction.** It reads `0 pending` above two already-verified rows, and says nothing about what a
pending claim is, where claims come from, or what Ben would do when one arrives. The queue screen
does not explain the queue.

## A7 — label stack on the claims rows (S)

**Ben's rage-trigger.** `A Curious Tractor` + `SOCIAL ENTERPRISE` + `ECOSYSTEM`, three labels
restating one thing, wrapping onto a second line and breaking the row rhythm.

## A8 — the composite health score is a number with no scale (S)

**Meaning.** `/ops/health` leads with **63** in an amber circle. No target, no threshold, no trend,
no legend. Is 63 good? Better than last week? The five weighted components underneath are genuinely
informative — the headline number is the least useful thing on an otherwise strong screen.

## A9 — "9,650,215 total records across 21 datasets" has an unstated basis (S)

**Meaning.** The database holds ~52.3M rows across 724 populated relations (CLAUDE.md, measured
2026-08-14). This says 9.65M across 21 datasets. Both can be true — "datasets" is clearly a curated
subset — but nothing says which 21 or why, so the headline reads as "the size of the graph" when it
is not.

## A10 — `/admin/api-usage` denies access with no reason and no way forward (S)

**Friction.** A bare red box: `ADMIN ACCESS REQUIRED`. It does not say whether the problem is being
logged out, not being an admin, or an expired session, and offers no action.

Underneath: `GET /api/admin/api-usage` returns **403** while the page's layout let the render happen
(local dev bypass). **Caveat: this is partly a local-dev artifact** — the layout guard and the API
guard disagree only because dev skips the former. Verify against production with a real admin
session before treating the 403 itself as a bug. The empty failure message is a finding either way.

## A11 — `/ops` activation funnel is eight zeros with no empty state (S)

**Clarity.** `PROFILE READY 0 · FIRST SHORTLIST 0 · PIPELINE STARTED 0 · FIRST ALERT CREATED 0`,
then four more. If that is real (no activated users yet) the screen should say so; as rendered it is
indistinguishable from a broken query. Same failure mode as A1, and the two together are why the
admin surface currently reads as "lots of zeros" rather than "here is the state of the system".

## A12 — floating widgets sit over content (S)

**Aesthetic.** The red `AI` button (bottom-right) overlaps the table area on `/ops/claims`, and the
avatar bubble sits bottom-left over the rail. Same class as SH-9 from the shell audit, which was
solved there with rail clearance rather than by moving the widget.

---

## Answers (investigated 2026-08-18, Ben asked me to determine these)

### A1 — the feed is stuck, not bad. One job stopped and took the screen with it.

`act_funding_opportunity_current_status` quarantines an opportunity if it fails ANY of six
requirements. Measured across all 2,592 `open_grant` rows:

| requirement | failing |
|---|---|
| **stale_verification** (`verified_at` older than 7 days) | **2,592 — all of them** |
| missing_application_url | 348 |
| missing_official_source | 279 |
| past_deadline | 235 |
| not_verified | 184 |
| missing_verification_timestamp | 0 |

**Every single row fails the same requirement.** The newest `verified_at` in the table is
**2026-08-07** — eleven days ago. The 7-day freshness window expired on **14 August** and the
entire feed flipped to quarantined on that date, in one step. 2,408 of the 2,592 are still marked
`verification_status = 'verified'`; they are just not *recently* verified.

Meanwhile the ingest is alive: the `GrantConnect Open Opportunities` agent ran successfully on
2026-08-17 (123 items) and 2026-08-16 (121). So rows keep arriving, and nothing re-stamps
`verified_at`.

**1,957 opportunities would qualify the moment verification runs again** (verified, with both URLs,
deadline not past). That is the recovery number.

**Verdict: stuck pipeline.** Two things to fix, and they are separate:
1. Whatever refreshes `verified_at` stopped on 7 Aug — find it and restart it.
2. **A 7-day hard cliff with no warning is a fragile design.** One missed weekly job silently
   zeroes the entire screen. Consider a warn band (stale >7d shows with a "verification is N days
   old" flag) before the hard quarantine, so the failure is visible while it is still small.

### A3 — the zeros are real, but they do not mean "no users". They mean no telemetry.

`product_events` contains **exactly one event, ever**: a single `upgrade_prompt_viewed` on
**2026-04-20**, from one user. Nothing in the four months since. The funnel window is 30 days, so
0 is arithmetically correct.

The screen is not measuring a quiet month — it is measuring an **empty instrumentation table**.
Reporting "PROFILE READY 0 / FIRST SHORTLIST 0 / ACTIVATED 0" implies user behaviour was observed
and was zero. It was not observed at all.

**Recommendation:** say that. "No product events recorded since 20 Apr 2026 — instrumentation
appears inactive" is true and useful; eight zeros are neither. Then decide separately whether
product analytics is a thing you want working.

### A4 — both numbers are real; they count different things, and only one matches its label.

| screen | predicate | count |
|---|---|---|
| `/ops` — "AI-profiled" | `last_scraped_at IS NOT NULL` | **598** |
| `/ops/health` — "PROFILED" | `description IS NOT NULL` | **919** |

Of 11,177 foundations: 598 scraped, 919 with a description, and **597 with both**. So 321
foundations carry a description that did not come from the profiler (imported from another source),
and exactly one was scraped without producing a description.

**`/ops` is the one that matches its label.** "AI-profiled" means the profiler ran, which is
`last_scraped_at` — 598. `/ops/health` labels 919 as "PROFILED" while actually counting "has a
description from anywhere".

**Recommendation:** `/ops/health` switches to `last_scraped_at` so both screens say 598, and if the
919 is worth keeping it becomes its own tile with an honest label ("has a description").

---

## Decisions only Ben can make

1. **A1 — the quarantine.** Is 100% of the opportunity feed being quarantined correct, or is the
   pipeline stuck? Everything about how to fix that screen follows from the answer.
2. **A2 — which layout is right.** `/ops/health` renders clean and the rest inherit the marketing
   header. Should ops pages be full-bleed like health, or is health the one that is wrong?
3. **A11 — are the activation zeros real?** If there genuinely are no activated users, the funnel
   should say that rather than show eight zeros.
4. **A3 — which foundations-profiled number is true**, 598 or 919, and what each was counting.
