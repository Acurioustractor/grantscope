# Shell UX audit — pass 2

2026-08-18. Sweep across the browse surfaces after pass 1's 14 findings shipped (#255, #256).
Screens read: foundations, social enterprises, charities, grant recipients, political donors,
people, dashboard.

Pass 1 was mostly about how the shell looked. Pass 2 is mostly about **whether the numbers mean
what the page says they mean.** The three highest findings are all cases where a page states a
national, complete-sounding figure over data that is neither.

Every claim below was checked against the database. Where a finding is visual only and not yet
verified in data, it says so.

---

## P1 — the page says something the data does not support

### F1. The grants browser reads as national. It is 92% Queensland. **[FIXED]**

`justice_funding`, grant rows, aggregates excluded:

| state | rows | dollars |
|---|---|---|
| QLD | 114,642 | $27.60bn |
| NSW | 8,139 | $5.62bn |
| (blank) | 272 | $0.25bn |
| VIC | 915 | **$0.18bn** |
| NT | 91 | $0.14bn |

Victoria — 6.8 million people — shows $180m. That is a **coverage artifact, not a finding about
Victoria**, and the page discloses none of it. A reader comparing states on this screen will draw
a conclusion that is exactly backwards.

The header currently reads "124,800 grants worth $34.0bn after the filters · 32,316 rows
excluded". It is precise about the filters and silent about the thing that would actually mislead
someone.

**Fix direction:** state the coverage skew in the stats line, or show a per-state coverage strip.
Do not let a state comparison render without it.

### F2. Over half the money on that screen has no topic tag, and the #1 recipient is a railway. **[FIXED]**

Same filter set:

| | rows | dollars |
|---|---|---|
| tagged with any topic | 24,623 | $15.03bn |
| **untagged** | **100,391** | **$18.68bn** |

**55% of the $34.0bn carries no topic at all.** The top recipient is `QUEENSLAND RAIL LTD` at
$4.1bn, whose rows are `Transport Service Contracts` and `Rail Concession Scheme`, topics `{}`.

This is the same class of defect as the `Total` aggregate rows CLAUDE.md documents, one level up:
those rows are real grants to a real organisation, they are simply not justice funding, and
nothing on the page says the list is unfiltered by topic.

**Fix direction:** either default the browser to tagged rows, or label the untagged share
honestly in the stats line. Leaning to the second — hiding $18.7bn is its own dishonesty.

### F3. The charities browser's default view is broken. **[FIXED]**

`charity_browse(NULL,NULL,NULL,'total',200)` takes **10.4s**, over the statement timeout, so the
unfiltered landing renders "The list could not be read: canceling statement due to statement
timeout". Adding any state filter drops it under the limit and the page works.

**Every first-time visitor hits the broken state.** The page fails honestly, which is the pass-1
design working, but it fails.

**Fix direction:** the RPC needs the treatment the donor rollup just got — the work belongs in
indexed structures, not in a per-request scan. A default state or size filter would only hide it.

---

## P2 — undisclosed limits and wrong-looking data

### F4. The people browser silently drops anyone with more than 10 boards. **[PARTLY WRONG — see correction]**

`person_browse` carries `AND v.board_count <= 10`. `mv_board_interlocks` holds people with up to
**745** boards. The cap is deliberate and correct — above ~10 is mostly name-collision noise, and
memory says the cap stays — but it is **invisible**. The page says "241,049 people on the graph ·
showing the top 200 for this search and sort" while excluding an entire class, and the top rows
all read exactly `10`, which reads as a measurement rather than a ceiling.

**Fix direction:** say it. "People credited with more than 10 boards are excluded — above that,
shared names outnumber real directors."

### F5. The foundations browser lists organisations that are not foundations. **[FIXED, and partly wrong]**

The page promises "Every giving organisation we can see". The first screen includes The
University of Sydney, Monash University, Catholic Education Centre, Ecumenical Schools Australia,
Lutheran Education SA/NT/WA, and Latter-day Saint Charities.

Related and unverified: `GIVING / YR` equals `GRANTED` exactly for several rows (Sydney $340.7m,
Catholic Education $281.5m, Ecumenical $245.4m) while World Vision shows $514.1m giving against
$5.7m granted — a 90x gap. What the two columns mean relative to each other is not stated and is
not self-evident. **Needs a data check before fixing.**

### F6. Two of the six foundations columns are empty. **[FIXED — sparse, not empty]**

`GRANTEES` and `BOARD` are `—` for effectively every row (one row showed a board count of 1).
Columns that never carry data are chrome — either populate them or drop them.

### F7. Raw Postgres array syntax is leaking into the social enterprises table. **[FIXED]**

The Detail column renders `{education, indigenous}`, `{"Community & Social Servic…`,
`{"Food & Beverage Products"…` — array literals with braces and quotes, straight through to the
user.

---

## P3 — polish

- **F8.** `$0k` renders for zero and near-zero dollars (social enterprises, charities). Should be
  `—` or `$0`.
- **F9.** Grant year ranges render run-together: `2008-09-2024-25`, `2015-16-2024-25`. Needs a
  separator.
- **F10.** The people table's `INFLUENCE …` column header is truncated in the header row itself.
- **F11.** A transient DB timeout leaves a browse page with nothing — no retry, no stale
  fallback. Observed while the name-key materialized views were building and saturating the
  pooler; the page recovered on reload. The fragility is real even though that particular trigger
  was self-inflicted.
- **F12.** Name casing is inconsistent within a single grants column (`QUEENSLAND RAIL LTD` next
  to `Legal Aid Queensland`). The whitespace-collapsing `display()` helper added to
  `ContractSideBrowser` in the name-normalisation work could extend to casing, carefully — some
  all-caps names are correct.

---

## Not findings

- The donations browser's three identical `Pratt Holdings Pty Ltd` rows are three genuinely
  different declared ABNs. Fixed in the name-normalisation PR by printing the ABN when a name
  repeats, rather than by merging entities the data says are distinct.
- The dashboard remoteness chart no longer disclaims the topic filter; it now reconciles exactly
  with the money tiles.

---

## Fixes applied 2026-08-18

**F3.** `mv_charity_browse` precomputes the two LATERAL enrichments for all 66,023 charities;
`charity_browse` became filter + order + limit over it. **10.4s to 92ms.** Registered for the
nightly refresh. `migrations/2026-08-18-charity-browse-mv.sql`.

**F1 + F2.** `grant_browse_stats()` now also returns per-state rows/dollars and the untagged
share, and the browser states both above the table. The numbers are computed in the RPC rather
than written into copy, so they cannot rot. `migrations/2026-08-18-grant-coverage-stats.sql`.

Live values: 91% of rows are QLD ($27.3bn of $33.7bn) against Victoria's $125m; 55% of the money
($18.7bn across 99,891 grants) carries no topic tag.

One trap worth remembering: adding fields to a value wrapped in `unstable_cache` does nothing
until the key changes. The old cached object had no `states`, so the disclosure silently did not
render — and in production it would have stayed invisible for an hour with no error anywhere. The
cache key is now versioned.


---

## Corrections to this document, 2026-08-18

Two P2 findings were overstated because I read the viewport and not the page.

**F4 was wrong about the cap being invisible.** `exclusionNote` already says it, in full: how many
identities are excluded, that the threshold is 10 boards, and why ("above it, 'one person' is
usually a nominee service"). What is true is placement: the note sits below a 200-row table, so a
reader scanning a column of identical `10`s has no signal nearby. The only change made was
labelling the column header `Boards (max 10)`. The note was already doing its job.

**F5 was half wrong.** The giving-versus-granted confusion I flagged as needing a data check is
already disclosed in the footer: "'Giving' can mix grantmaking with program spend". That covers
World Vision's $514.1m giving against $5.7m granted. The real half stands: `foundations.type`
carries `university`, `service_delivery`, `religious_organisation`, `peak_body` and 20 more kinds,
the type chips exposed only six of them, and nothing on the row said Monash University was a
university. Fixed by printing the type beside every name.

**F6 was "empty", which is too strong.** Of the top 500 foundations, 6 have grantees and 31 have
board links. Sparse, not absent — and the few that are populated carry real signal, so dropping
the columns would lose it. Fixed by stating in the footer why they are sparse (each needs a
matched grant record or a matched director).

---

## New finding from the fix pass

### F13. The social enterprises "Visible $" column double-counts, badly. **[FIXED — collapsed by ABN]**

Sorting by dollars shows five rows carrying the identical $7.64bn:

| name | abn | visible_dollars |
|---|---|---|
| Australian Red Cross | 50169561394 | $7,639,609,921 |
| Australian Red Cross Family Store | 50169561394 | $7,639,609,921 |
| Ballarat Red Cross | 50169561394 | $7,639,609,921 |
| Horsham Red Cross | 50169561394 | $7,639,609,921 |
| Red Cross | 50169561394 | $7,639,609,921 |

Five register entries share one ABN, `se_browse` joins the power index on ABN, and each branch
inherits the whole national figure. The same pattern repeats for genU ($887.5m twice) and SSI
($1.0bn twice). The column is not additive and the page does not say so — summing it, or reading
"Ballarat Red Cross moves $7.6bn", is wrong by orders of magnitude.

This is the same class as the donations Pratt problem, inverted: there, one organisation was split
across many rows; here, many rows each claim one organisation's whole total.

**Fixed 2026-08-18 by collapsing.** `se_browse` now groups by ABN, so one ABN is one row and the
money is counted once. Choices worth knowing:

- **Display name** comes from `gs_entities.canonical_name` for the ABN — the registered entity
  ("Australian Red Cross Society"), not whichever branch sorted first. Falls back to the shortest
  register name so the pick stays deterministic.
- **Search still matches any branch.** Searching "Ballarat Red Cross" returns the collapsed row;
  the filter runs across every entry in the group, not just the displayed name.
- **The register's shape stays visible.** `entries` is returned and rendered beside the name as
  "5 listings", so the collapse is disclosed rather than hidden.
- **Rows with no ABN (1,793) are untouched** — nothing to group them by, so they stand alone.
- **State** shows blank where a group spans several states rather than picking one.

Cost: the dollars sort went from 0.8s to 2.2s. `migrations/2026-08-18-se-collapse-by-abn.sql`.
