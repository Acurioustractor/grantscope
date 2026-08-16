# The Clarity Console, part 2 — connection

**Status:** plan, agreed 2026-08-16 via a second design grilling. Not started.
**Companion to:** `clarity-console.md`, which stands. This does not replace it; it answers a
different question that the first plan did not ask.
**Scope:** grantscope. One declaration file in `act-global-infrastructure`. Nothing in
empathy-ledger-v2 or act-regenerative-studio.

---

## The reframe

The first plan built a catalogue of the database and it is correct. Slices 1 and 3 shipped and
work. Then the feedback was: *"very code tech speak… wanna keep thinking about how I can see real
data and how it all starts to connect and asks real questions and shows real data."*

That is not a request for a better catalogue. Going looking for what to build, three separate
times the answer came back the same:

| Looked for | Found |
|---|---|
| A real-data surface to build | **54 report directories**, grouped into **13 themes**, with `qld-youth-justice`, `child-protection`, `donor-contractors`, `board-interlocks`, `who-runs-australia`, `procurement-oligopoly` already written |
| A way to show connection | **`/entity/[gsId]`, 958 lines**, firing 16 parallel queries across justice funding, procurement, donations, ACNC, ATO, board interlocks, revolving door, ALMA — the cross-system resolution, built |
| A search to build | **`unified-search.tsx`, 495 lines**, already grouped by kind |
| An ACT workspace to build | **62 pages under `/org/[slug]`** — desk, funding, contacts, communities, ecosystem, explore, and a full goods suite |

**276 page routes exist. The `/clarity` index indexes 1,479 database objects and zero of them.**

So the diagnosis is not "the real-data views are thin". It is:

> **The console is a map of the shelves. The books are one directory away, unindexed.**

This plan is therefore mostly **connection and deletion**, not construction. It will feel like
less building than part 1. That is the point.

---

## What it is for

Unchanged from part 1, and it is what forced this correction:

> Keep surfacing what makes sense, what is matched, and what is still not working. Build the
> process that surfaces all related things **so community can make better decisions** — better
> relationships with funding, philanthropy and grants — and build the system to see what is
> actually happening in Australia across justice, child protection and health.

Part 1 served the operator finding a table. That is a legitimate need and it is not this need.

---

## The four decisions that govern everything else

### 1. One visibility vocabulary

`/atlas` already had one — `public` / `org` / `withheld`, with two rules in its code: *withheld
renders nowhere*, and *only a server component behind the right gate may pass org data*. Meanwhile
this grilling invented a fourth model one question at a time (public reports, admin console, ACT
login, consent-refused), and there is a separate commercial `Tier` ladder that is a different axis
entirely.

Extend the Atlas model with exactly one addition:

```
public  →  org  →  operator  →  withheld
```

`operator` is for things true about the **estate** rather than the **world**: unfiled counts,
review status, the 1,151 objects whose usage was never measured.

### 2. Data declares a floor; a screen may be stricter, never looser

A screen may always be more restrictive than the data it reads. It may never be less. That single
asymmetry means a consent-governed table cannot leak onto a public page no matter who writes that
page later — which matters because the stories and the 52.3M rows share one Supabase project.

It is also **testable**: assert that no `public` surface reads an object above `public`.

### 3. Absence is always stated, never silent

A rule now, not three coincidences. A public page says "3 more reports in review — not published".
The console says "rows withheld, consent-governed". A theme page says "no registered question
answers this yet".

Same principle as the refusal cards and the `?`-never-`0` rule already running through everything
built: **the shape of what you cannot see is itself information, and hiding it is the one thing
that makes a system untrustworthy.**

The exception that proves it: withheld content is never counted in a way that re-identifies
anyone. **A count of 1 in a small community is a name.**

### 4. Findings first, plumbing last

On every surface. Reports and questions at the top; the data objects at the bottom under "what
this is built from". The tech-speak stays — it is honest, and part 1 exists to make it available —
but it is never the first thing read.

---

## Search

**One page at `/search`**, grouped by kind, with a shareable URL. The nav box and ⌘K become entry
points to it rather than three separate rankings.

Reconcile the two components that already exist — `unified-search.tsx` (495 lines, 3 kinds:
entity, foundation, grant) and `global-search.tsx` (400 lines) — rather than adding a third.
Extend from 3 kinds to ~8: **reports · questions · themes · entities · people · places · grants ·
objects**.

**Grouped, not one ranked list.** A flat list must decide whether `/reports/youth-justice` beats an
organisation named "Youth Justice NSW", and it will get that wrong constantly because they are
incomparable. Grouping also lets a group say *"no reports match"* — which is information.

**Hybrid index.** The small kinds — 54 reports, 26 questions, 13 themes, 1,479 objects ≈ 1,575
items — ship to the client and filter in memory. That is smaller than the catalogue the ledger
already inlines (verified ~500KB), so it is instant, offline and free, and "nothing matches" is
answerable without a round trip. Entities and grants stay live queries; they already work.

---

## Theme pages

**At `/reports/[section]`.** The 13 sections already exist in `reports/_components/sidebar-nav-data.ts`
— Current Map · State Dashboards · **Youth Justice** · **Child Protection** · **Disability** ·
Education · Cross-System · Accountability & Power · Funding & Equity · Social Sector · Philanthropy
& Corporate · Research & Procurement · Data & System. Making them real pages fills a hole users
already walk past. It is not a new concept, and `/reports` gets a purpose beyond being a list.

Not `/themes/[slug]` (a 15th navigational concept) and **not** under `/clarity` — that layout is
admin-gated, and an auth gate with an exception inside it is the shape of a future accident.

### Three taxonomies, and which one wins

| Taxonomy | Count | Role |
|---|---|---|
| Report sections | 13 | **The spine.** The only one written in the language a human uses about the world |
| ACT project categories | 11 | **Aligned to, not navigated by.** A theme says "ACT-JH works here" |
| Database domains | 17 | Rejected in part 1 — a schema taxonomy in subject clothing |

Do not build a fourth to unify the three. A fourth taxonomy to unify three is how you get five.

### What is on the page

In this order:

1. **The reports in that section**, each carrying its status at the link
2. **The registered questions** on that theme
3. **The key numbers** — from registered questions only, see below
4. **The real money and the real organisations** — see below
5. **One line** acknowledging ACT works in this area, linking to the studio
6. **What this is built from** — the data objects, last
7. **What's missing** — `operator` tier, visibly withheld from the public view

### Key numbers come only from registered questions

Strictly. A theme with no registered question shows **no number at all** rather than borrowing one
from report prose. This is the entire point of the eight slices: a number on a public page carries
a sentinel, a coverage figure and an exclusions note, or it is not shown.

An empty key-numbers slot is an honest advertisement for which question to register next — which
makes the theme page a work queue, which is what was asked for.

Pulling figures out of report prose is the tempting option and it is how a stale figure gets quoted
back at you by a funder. 20 reports are flagged as needing figure review; their numbers are exactly
the ones that must not be lifted.

### Real money, real organisations

`justice_funding.topics` is already tagged, and the tags line up with the sector themes:

| Tag | Rows |
|---|---|
| `child-protection` | 16,418 |
| `family-services` | 7,102 |
| `youth-justice` | 5,580 |
| `ndis` | 4,555 |
| `indigenous` | 2,595 |
| `community-led` | 1,440 |
| `legal-services` | 935 |
| `diversion` | 863 |
| `prevention` | 326 |

So a Youth Justice page showing *"$X across N grants, and here are the 20 organisations receiving
most of it"* — each name linking into the entity page that already resolves them across seven
registers — is one `WHERE` clause and a link. **This is the moment the system stops being
tech-speak.**

Two hard constraints:

- **`measure_kind = 'grant'` is mandatory.** Without it the 848 whole-of-state budget rows turn
  $46.1bn into $66.1bn of nonsense. Same for `receipt_type = 'donation received'` on donations.
- Topics use **hyphens**. `topics @> ARRAY['youth_justice']` returns zero rows silently.

The **power themes have no tags at all** — there is no tag for Accountability & Power, Philanthropy
or Procurement. Those pages show reports and questions only, and **say why there are no figures**.

### Report status becomes visible at the link

`sidebar-nav-data.ts` already carries a status on 74 nav items: **27 `current` · 27 `reference` ·
20 `review`**, where `review` means *"needs source-date, figure, and framing review before quoting
externally"*.

Surface it everywhere a report is linked — search results, theme pages, the index — so you never
click into something without knowing it needs review. Moving it into the database alongside the
question registry is right eventually, and should wait until the adjudication pattern from part 1
is built once rather than twice.

### The review-status restriction

**10 of the 20 `review` reports are in Accountability & Power** — the section holding
`who-runs-australia`, `donor-contractors`, `board-interlocks`, `consulting-class`. Youth Justice
and Child Protection carry **zero**.

So:

- **Accountability & Power:** review-status reports are **counted, not linked**. "3 more in review."
- **Everywhere else:** listed with a visible warning label.

A framing-unreviewed report about disability funding is a quality problem. A framing-unreviewed
report naming individuals and their board seats is a defamation problem — and this project already
refused an entire registered question, ministerial diaries, on exactly that reasoning.

This is a real editorial restriction on the most striking work in the repo. It was accepted with
that named.

---

## ACT

### The workspace already exists

`/org/[slug]` has **62 pages**: desk, funding, contacts, communities, ecosystem, explore,
per-project funding and journeys, and a goods suite (buyers, capital, foundations, applications,
campaign, channels, engagement), with an `ActWorkspaceShell` and `isAdminEmail` wired.

*"All behind a login with data for all projects"* is a description of this. **Extend it.** Do not
build a parallel ACT surface — it would be the fourth front door — and do not split ACT across two
logins for a distinction only we would understand.

The two gaps: **no cross-project view**, and **no route into the 52.3M rows**.

### Auth: admin now

The four admin emails; only two have accounts. `org_profiles` has **3 rows** with 24 tables
FK'd to them — load-bearing but not yet a tenancy model. Adding membership for a workspace with one
occupant is work that will be wrong by the time a second person arrives.

**Named explicitly:** if a community organisation is ever meant to log in and see *their own* data,
that is a different product with real RLS consequences and it must be a deliberate decision, not
something that grows out of this.

### "Query all of this data" — without breaking the refusal apparatus

The ask was access to query everything from grants to philanthropy to buyers to reporting to
people. Free-text asking over 52.3M rows was ruled out in this same grilling, because an ad-hoc
answer carries no sentinel, no coverage caveat, no exclusions and no verdict — everything eight
slices were spent building.

The honest version is two things together:

1. **Saved parameterised queries** — the questions ACT actually asks, written once, audited once,
   re-run with your inputs, with the mandatory filters baked in so they cannot be forgotten. This
   is where *"relevant to what we are working to do"* lives.
2. **The generic row viewer** from part 1 — the escape hatch for everything unanticipated, with its
   consent refusal, still shipping in the same slice as the viewer itself.

The difference between these and free-text is that **these carry their caveats with them.** A
funder email quoting a number from an unaudited query is the failure this system exists to prevent.

### What is public about ACT

**One sentence.** "A Curious Tractor works in this area", linking to the studio. It is true, it is
already public there, and it is honest disclosure that the people running this atlas also work in
the field — which a community organisation reading a youth justice page has a legitimate interest
in knowing.

Everything with substance — which projects, what evidence, what money, and above all **what's
missing** — is behind the login. Publishing your own to-do list as though it were findings is a
different product, and "ACT-GD has zero evidence" hands a funder a stick.

---

## Research

Everything above serves browsing and deciding. Research needs different things, and this system is
closer than any comparable one because every registered question already carries its SQL, its
ingredients, its sentinels, its coverage and its exclusions.

What is missing is that **none of it is addressable.**

1. **Stable citable claim URLs** — "this claim, as at 2026-08-16". `clarity_answer` already stores
   **89 historical answers**, which makes this close to free. First priority.
2. **Provenance you can follow to source.** Largely present; needs surfacing.
3. **Export** — CSV, and the query that produced it. Second, and cheap.
4. **Reproducibility** — the hard one, and worth being honest about. The snapshot moves and the
   matviews refresh nightly, so a 2026 answer will not reproduce in 2027 unless the answer is
   pinned. Those 89 stored answers are exactly what pinning means.

---

## Build order

Ordered so the first three slices are the ones that make the system feel connected.

| # | Slice | Notes |
|---|---|---|
| A | **Merge PR #216** | Green, coherent, admin-only, nothing public depends on it. Holding it while this lands is how a branch goes stale through three more slices. |
| B | **Theme pages at `/reports/[section]`** — reports with status, questions, "built from", the ACT line | No new data. The single biggest legibility win. |
| C | **Real money on sector theme pages** — topic-filtered aggregates + top recipients linking to entity pages | `measure_kind = 'grant'` mandatory. Where tech-speak ends. |
| D | **`/search`** — reconcile the two components, extend to ~8 kinds, hybrid index | Shareable result URLs. |
| E | **The visibility model** — `public`/`org`/`operator`/`withheld` as one vocabulary, plus the floor/stricter test | Do before anything else goes public. |
| F | **Report status surfaced at every link**, and the Accountability & Power count-only rule | Small, and it changes what you'd trust. |
| G | **Themes above the noun index** on `/clarity` — the demotion from part 1's Q10 | One section move. |
| H | **ACT cross-project view** in `/org/act` | Extends 62 existing pages. |
| I | **Saved parameterised queries** for ACT | Mandatory filters baked in. |
| J | **Citable claim URLs** off the 89 stored answers | The research unlock. |
| K | **Deletions** — `/discover`, `/dashboard`, `/start`, and whatever B–D orphan | Part 1's slice 0, now with more evidence about what is redundant. |

**E should arguably run first.** It is listed fifth because B and C are what you want to see, but
nothing new should reach a public surface before the visibility vocabulary exists — the current
state is per-screen decisions, which is how this grilling ended up re-deciding visibility in every
second question.

---

## Deliberately not being built

- **Free-text natural-language querying.** Ruled out twice, for the same reason both times.
- **A fourth taxonomy** unifying report sections, ACT categories and DB domains.
- **A new ACT surface** parallel to `/org/act`.
- **A network-graph visualisation** of connection. `/graph` exists at 2,149 lines; connection is
  the entity spine walked as links, not a 3.4M-edge hairball.
- **Membership/tenancy auth.** Admin allowlist until a second person needs in.
- **Figures lifted from report prose.** Registered questions only.

---

## Open

- Whether the Accountability & Power count-only rule survives contact with seeing it applied.
- Which of the 276 routes are genuinely dead. B–D will reveal more than guessing can.
- Whether `/insights` (323 lines) lives or dies — still unread.
- The commercial `Tier` ladder (`community`/`professional`/`organisation`/`funder`/`enterprise`) is
  a separate axis from the visibility vocabulary and has not been reconciled with it. It will need
  to be before anything is sold.

---

## Measured facts behind this plan

All measured 2026-08-16. Re-measure before trusting again.

| Fact | Value |
|---|---|
| Page routes in the app | **276** |
| Report directories | 54 |
| Report nav items carrying a status | 74 — 27 current, 27 reference, **20 review** |
| Review-status reports in Accountability & Power | **10 of 20** |
| Review-status in Youth Justice / Child Protection | **0** |
| Report sections (the theme spine) | 13 |
| ACT project codes / categories | 74 / 11 |
| Pages under `/org/[slug]` | **62** |
| `/entity/[gsId]` | 958 lines, 16 parallel cross-system queries |
| `/places/[postcode]` | 1,332 lines |
| `/graph` | 2,149 lines |
| `unified-search.tsx` / `global-search.tsx` | 495 / 400 lines, 3 kinds |
| `justice_funding` topic tags | 9, led by child-protection 16,418 and youth-justice 5,580 |
| Power themes with topic tags | **0** |
| `clarity_answer` stored answers | 89 |
| Catalogued objects / unfiled | 1,479 / **747** |
| Small-kind search index size | ~1,575 items |
| Existing visibility model | `/atlas`: public / org / withheld |
| Commercial tier ladder | community / professional / organisation / funder / enterprise |
