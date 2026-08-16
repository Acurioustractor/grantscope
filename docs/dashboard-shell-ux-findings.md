# Dashboard shell — polish audit, pass 1 (2026-08-17)

Phase-1 collect-only pass over the softened-Bauhaus shell, run against localhost:3013 at 1280×900
(prod is Vercel-challenged for tooling; the deployed pixels still deserve Ben's own eyes).
Screens: `/dashboard`, `/dashboard/views/youth-justice-money`, `/dashboard/docs`, `/clarity`
(the dark-inside-light question). Judged against the five questions in `/polish`.

## Ranked findings

### F1 (M) — The view page contradicts itself about its own number
`/dashboard/views/youth-justice-money`: the registry blurb says **"filtered clean ($915.7M
FY2018–24)"** while the loader's headline says **$1.04bn, 2008-09–2024-25** — two figures and two
spans on one screen, no reconciliation. Classic copy-rots-against-loader. Fix: blurbs must not
carry figures; the loader owns the number and its span (or the blurb derives from the same query).

### F2 (M) — The remoteness chart sits in a scoped zone but is not scoped
`/dashboard`: the topic/year dropdowns say they scope "the money tiles and top recipients"; the
remoteness chart directly below shows ALL funding ($1004bn total) under a youth-justice-scoped
header row. The caption admits it, but the layout implies scope. Either scope the chart to the
filters or move/mark it visually outside the scoped zone.

### F3 (S) — Zero-valued caveats render as noise
Two places: the tile line "$0 of aggregates excluded" and the view caveat "0 aggregate-shaped rows
worth $0 excluded". A filter that removed nothing is not worth a sentence — show these only when
non-zero. Stating-the-absence is right for measurements; wrong for filters that fired vacuously.

### F4 (M) — Top-recipient rows on the view page look like dead ends
On `/dashboard` the top recipients link to `/entity/*`; on the view page the same rows render
unlinked. Verify and link — dead-end disease on the drill-in page, which is exactly where a reader
wants to keep going.

### F5 (S) — Remoteness chart is unreadable as comparison
Major cities ($1004bn) vs Very remote ($11.5bn): four of five bars are slivers. A share-of-total
treatment (or excluding the dominant bucket with a stated reason) would actually show the
distribution the chart exists to show.

### F6 (S) — No active state for /dashboard/docs in the rail
On `/dashboard/docs` the rail still highlights "Dashboard"; docs is reachable only through the help
menu and has no you-are-here marker.

### F7 (S, watch) — The /clarity chip row is nearing a label stack
Now 10 chips (findings, owners, projects, stories added this week), wrapping to two lines above the
hero. Not yet a violation, but one more surface and it becomes the stacked-label pattern Ben flagged
on ACT surfaces. Consider grouping (adjudication: findings·owners·unfiled | content: projects·stories).

## What reads well (no action)
- `/dashboard/docs` is the strongest screen: the four-kinds-of-data spine, per-dataset "what it
  cannot tell you", row counts, and the verified-grading paragraph. Honest and calm.
- Tile hierarchy on `/dashboard`: filtered-clean figure leads, basis stated on the ACCO tile.
- The shell itself: dark rail + light canvas + mono numerals reads coherent; saved-views cards
  continue the journey; "Options come from the data, not a list" is exactly the right sentence.

## The decision only Ben can make
**Dark-inside-light (`/clarity` in the shell):** my read is that it WORKS — the black Clarity hero
reads as a deliberate Bauhaus object contained by the soft shell, not a clash; the live surfaces
under it are light; the double-nav (shell rail + clarity chips) is acceptable as section sub-nav.
Recommend: accept the framing, which un-gates the dark shell variant. But this is the taste verdict
the ledger reserves for Ben — this paragraph is input, not the verdict.
