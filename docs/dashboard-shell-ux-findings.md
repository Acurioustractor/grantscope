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

### F6 (S) — RECLASSIFIED on fix-pass 1: section-level active is defensible
The rail highlighting "Dashboard" on `/dashboard/docs` is section-level active state — a standard
pattern. The residual question is IA, not styling: should "The data" be a rail entry rather than
help-menu-only? That's Ben's call; no code change made.

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


## Fix pass 1 (2026-08-17, branch shell-polish-fixes-1)
- **F1 FIXED** — figures stripped from registry blurbs; the loader owns every number and span.
- **F2 FIXED (labelling)** — chart retitled "Where ALL money sits" + caption states the filters do
  not scope it. The full fix (a topic-scoped remoteness query) is real data work, left open.
- **F3 FIXED** — zero-valued exclusion clauses suppressed on the tile and the view caveat.
- **F4 FIXED** — the cause was styling, not missing hrefs: linked rows were visually identical to
  plain text. Links now carry the accent colour + hover underline.
- **F5 / F7 / dark-inside-light** — open, Ben's taste calls.


## Surfaces walkthrough — consent review, pass 1 (2026-08-17)

Chased all 27 consent-object references on public-family code (from /clarity/surfaces) to their
actual lines.

### SEVERE, FIXED (branch consent-gate-place-voice)
`/places/[postcode]` RENDERED consent-governed content, and the gate was broken twice over:
1. **The "Community Voice" transcript section's only filter was `status='published'` — a status
   that does not exist in el_transcripts** (the vocabulary is 'completed' only), so the primary
   query always matched nothing and a "try without status filter" fallback rendered EVERY
   transcript's storyteller name + verbatim excerpt, anchored to the place. Place is a
   quasi-identifier; this is the exact re-identification pattern the story↔project design forbids.
   el_transcripts carries NO consent columns of its own.
2. **Storyteller cards (name + bio + photo, up to 6) checked no consent flag** — 11 of 227
   storyteller rows lack consent_given and were renderable.

Fix: excerpts now require the storyteller's `quote_sharing_consent` AND `consent_given`,
unexpired, via the storyteller_id join (41 of 52 transcripts qualify); a transcript with no
storyteller_id has no consent basis and never renders. Storyteller cards gained the same
consent_given + expiry gate. The API brief route and the PDF reuse the same service — fixed once.

### Benign (verified, no action)
- `/reports/yj/[state]/sector`: the word "transcripts" in Hansard-caveat prose.
- `/snow-foundation`: external links to Empathy Ledger, no data rendered.
- `stories`/`quotes` word-matches across 20 files: overwhelmingly the English words in copy, or
  reads of the PUBLISHED-status stories table (its own gate). Spot-checked, none render
  consent-governed rows.
- `photos` on /goods-on-country: Goods' own photo assets, not storyteller photos.


## Admin one-language sweep (2026-08-17, Ben's ruling: all soft shell, worst-first)

Census: 10 dashboard routes spoke shell; ~20 admin routes were hard Bauhaus inside the shell;
the old ledger suite was a third, DARK language. Repairs, all structural:

1. **Bauhaus bridge** (merged as its own PR): border/radius/canvas vocabulary reads soft inside
   `.shell`. Converted ~15 routes at once.
2. **Dark suite token flip**: `.shell .clarity-dark` re-reads the dark tokens light — catalogue,
   seams, cross-sections, want list, what-changed all converted by one rule. Verified on seams.
3. **Typography pass** over 9 clarity surfaces: page titles and section headers to display type;
   chips/micro-labels stay mono uppercase (the dashboard's own accent grammar).
4. **Hard offset shadows** soften via bridge (search box was the tell).
5. **Rows chip de-hardcoded**: '52.3M' had rotted (truth 51.9M); now an RPC summed daily.

Verified unified by eye: clarity index, object page, seams (ex-dark), findings, search, ops/health.
Trackers self-gate to /login when signed out (correct; eyeball them signed in).

### Found by the sweep, needs its own fix
- **/ops/health data is rotted**: Total grants 0, Foundations 0, Community orgs 0, 'entity graph:
  empty', denominators of zero, health score 26. The page is style-unified but its queries are
  measuring a schema that has moved. Repair is a data job, not a style job.
- **/clarity/catalogue vs the new index**: the demoted dark ledger now duplicates most of the
  index's job (search, facets). DECISION FOR BEN: retire it, or keep as the power-user deep table.
- /alerts unverified signed-in (self-gated).
