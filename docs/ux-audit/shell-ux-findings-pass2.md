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

### F1. The grants browser reads as national. It is 92% Queensland.

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

### F2. Over half the money on that screen has no topic tag, and the #1 recipient is a railway.

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

### F3. The charities browser's default view is broken.

`charity_browse(NULL,NULL,NULL,'total',200)` takes **10.4s**, over the statement timeout, so the
unfiltered landing renders "The list could not be read: canceling statement due to statement
timeout". Adding any state filter drops it under the limit and the page works.

**Every first-time visitor hits the broken state.** The page fails honestly, which is the pass-1
design working, but it fails.

**Fix direction:** the RPC needs the treatment the donor rollup just got — the work belongs in
indexed structures, not in a per-request scan. A default state or size filter would only hide it.

---

## P2 — undisclosed limits and wrong-looking data

### F4. The people browser silently drops anyone with more than 10 boards.

`person_browse` carries `AND v.board_count <= 10`. `mv_board_interlocks` holds people with up to
**745** boards. The cap is deliberate and correct — above ~10 is mostly name-collision noise, and
memory says the cap stays — but it is **invisible**. The page says "241,049 people on the graph ·
showing the top 200 for this search and sort" while excluding an entire class, and the top rows
all read exactly `10`, which reads as a measurement rather than a ceiling.

**Fix direction:** say it. "People credited with more than 10 boards are excluded — above that,
shared names outnumber real directors."

### F5. The foundations browser lists organisations that are not foundations.

The page promises "Every giving organisation we can see". The first screen includes The
University of Sydney, Monash University, Catholic Education Centre, Ecumenical Schools Australia,
Lutheran Education SA/NT/WA, and Latter-day Saint Charities.

Related and unverified: `GIVING / YR` equals `GRANTED` exactly for several rows (Sydney $340.7m,
Catholic Education $281.5m, Ecumenical $245.4m) while World Vision shows $514.1m giving against
$5.7m granted — a 90x gap. What the two columns mean relative to each other is not stated and is
not self-evident. **Needs a data check before fixing.**

### F6. Two of the six foundations columns are empty.

`GRANTEES` and `BOARD` are `—` for effectively every row (one row showed a board count of 1).
Columns that never carry data are chrome — either populate them or drop them.

### F7. Raw Postgres array syntax is leaking into the social enterprises table.

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
