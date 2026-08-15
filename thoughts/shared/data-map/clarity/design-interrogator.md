# /clarity — THE INTERROGATOR

**A question-first design. Written 2026-08-14.**
Target: `/Users/benknight/Code/grantscope`, app at `apps/web`.
Binding: `DESIGN.md` (Civic Bauhaus), `CLAUDE.md` (Server Components by default, in-app not CLI),
`getDirectServiceSupabase()` not `getServiceSupabase()`, no new deps in slices 1–3.

Verification key used throughout:
**[V]** I ran the query or read the file in this session ·
**[R]** relayed from a document that marked it verified, and re-checked against `VERIFICATION.md` ·
**[I]** my inference · **[U]** unverified.

---

## 0. The one-paragraph answer

BUILD-SPEC proposes a catalog whose primary object is the **table**. That is the wrong primary
object for this database, because nothing in this database is valuable table-by-table — ACNC
publishes `acnc_charities`, AusTender publishes `austender_contracts`, the ABS publishes SEIFA.
The only thing here that exists nowhere else is the **join**: `acnc_ais × austender_contracts` =
*can this bidder survive the contract*, which no Australian source can answer and which I ran
today in 196 ms **[V]**. So make the **question** the primary object. `/clarity` opens as a board
of every question this database can answer, every question it can *nearly* answer, and every
question it *cannot yet* answer — each carrying its live number, its honest coverage fraction,
its binding join, its caveat and its sentinels, all machine-computed from SQL stored next to the
answer so the number on screen and the number in the doc are the same number by construction.
The full 1,433-object ledger is still built, in full, one click away — but it hangs off the
questions, and it gains a column no inventory-first design can have: **FEEDS — how many
registered questions this object serves.** `FEEDS 0` on a 2.1M-row table is the loudest signal
this codebase can produce, and it is an opportunity rather than a chore.

---

## 1. The argument: why question-first beats inventory-first, for this person, on this data

### 1.1 The inventory answers a question Ben already knows the answer to

Ben knows he has AusTender. He knows he has ACNC. A catalog's core service is *known-item search*
— "where does the charity data live" — and Shneiderman puts that at the opposite pole from what
Ben actually asked for: *"see it all, see the gaps, and find opportunities."* Brehmer & Munzner
classify that as **search with target unknown and location unknown** — browse, not lookup
**[R: research-dashboards §1.4]**. `research-dashboards` establishes the browse framing in §1 and
then §5 builds a lookup UI anyway: a search box, a facet rail and 812 sorted rows. That is a very
good lookup UI. It does not answer "find opportunities", because an opportunity is a *finding*,
and a table list contains no findings.

### 1.2 The unit of value here is the edge, and a table-ledger renders the edge as a footnote

Every one of the nine cross-sections OPPORTUNITY-MAP ran for real is a join, and in each case both
sides are individually public:

| Cross-section | Left | Right | Who else joins them |
|---|---|---|---|
| Can this bidder survive the contract? | `acnc_ais` (ACNC publishes) | `austender_contracts` (AusTender publishes) | **nobody** |
| Does money reach evidence? | `justice_funding` | `alma_interventions` | **nobody, there is no such linkage in Australia** |
| Two purses, one org | `foundation_grantees` | `austender_contracts.supplier_abn` | **nobody** |
| Who serves people leaving prison | `acnc_charities.ben_pre_post_release` | `mv_entity_total_funding` | **nobody — 30+ free flags, unused** |

In a table-ledger, `acnc_ais` and `austender_contracts` are two rows 400 apart alphabetically, and
the thing that makes them worth $46bn of visibility is a `fk`/`join` edge you have to reconstruct
in your head from a dossier tab. In a question-board, that join **is** a card with a number on it.

### 1.3 A coverage bar is a chore. An unanswerable question is a want-list.

Consider the same fact rendered two ways:

> **Inventory-first:** `abs_indigenous_population_by_lga` — 0 rows — ⛔ EMPTY — 31% CONNECTED
>
> **Question-first:** ▌ CANNOT ANSWER YET — *"Is this LGA's Indigenous youth over-representation
> above or below the state rate?"* — blocked by one empty table; the fix is a CC-BY-4.0 download;
> effort **S**; unlocks **4 other questions** and every per-capita Indigenous rate on the Atlas.

Identical information. Opposite affect. The first is an audit finding; the second is a to-do with
a payoff attached. Grover's documented cause of catalog death is that a catalog is *"a passive
repository"* outside the daily workflow **[R: research-dashboards §2.4]**. A question board has a
payoff on every row and a delta on every card, which is what makes something get opened twice.

### 1.4 Provenance has somewhere to live, and it is the place where this project has been wrong

Every headline number in this database that has turned out to be wrong was wrong at the **claim**
level, not the table level:

- `justice_funding` mixes state budget aggregates with grants — a naive youth-justice sum is
  **45.3× too big** **[R, CONFIRMED VERIFICATION V17]**
- `political_donations` is **72.1% of rows / 85.3% of dollars** `other receipt`, not donations
  **[R, V20 confirmed / V21 corrected from 88.6%]**
- **13 AusTender rows carry 29.4% of all recorded Commonwealth contract value**, largest being
  Hays Specialist Recruitment at $123.00bn to Treasury — not Gilbert and Tobin, which is #2
  **[R, V22 confirmed / V23 corrected]**
- `mv_entity_total_funding.grants_total` is **exactly zero across all 94,088 rows** **[R, V30]**

A table ledger can carry `row_count` and `last_write_at` for each of these and be entirely
truthful while the derived claim is catastrophically false. The Interrogator attaches provenance,
sentinels and coverage to the **claim**, which is the thing that leaves the building.

### 1.5 The catalog still gets built — and it gets better

I am not trading the inventory away. `/clarity/data` is the full 1,433-object faceted ledger with
the coverage matrix and the `+` glyph, built on the `clarity_object` schema already drafted in
`clarity-data-layer.md` (which I extend rather than replace — it is measured, correct, and its
five corrections to BUILD-SPEC all hold). What question-first *adds* to the ledger is the
backwards index:

- **FEEDS n** — questions this object serves. Sortable. Default secondary sort.
- **BLOCKS n** — questions this object's defect prevents.
- On the dossier: *"`acnc_ais` answers 3 questions and blocks 1"* — which finally answers the one
  thing a catalog row can never say on its own: **what is this FOR.**

Grover's fix #3 is *"curate the top 20% rather than attempting comprehensive coverage"*
**[R: research-dashboards §2.4]**. A question registry does that automatically: the objects that
feed questions *are* the top 20%, and they nominate themselves.

### 1.6 The one-line rebuttal to the obvious objection

> *"Ben asked for an overview page that lists absolutely every piece of data."*

He did, and I am deliberately not putting 1,433 rows on screen one. My defence is the second half
of the same sentence — *"so he can see it all, see the gaps, and find opportunities"* — and the
observation that the first clause is a **means** and the second is the **end**. The estate strip
at the top of `/clarity` carries the whole estate in one line and one click, and it carries the
number that makes the estate matter:

```
1,433 OBJECTS · 52,349,579 ROWS · 28 GB · 68 FEED A REGISTERED QUESTION · 1,365 DO NOT
```

That line is a more honest and more motivating rendering of "everything you have" than 1,433 rows
sorted by importance, because it states the actual finding: **95% of this database is not yet
doing any work.** §11 lists what this costs me, without softening it.

---

## 2. Information architecture

### 2.1 Two ladders that cross

The failure mode of drill-down is "the same thing, smaller." The fix is that each level must
finish a sentence no other level can **[R: research-visualization §5.1]**. I have two ladders, and
the crossing between them is the design.

**The question ladder** — how you get from a hunch to a defensible claim:

| L | Route | Sentence only this level finishes | Form |
|---|---|---|---|
| Q0 | `/clarity` | "This database can answer **14** questions nobody else in Australia can, is **5** defects away from answering **5** more, and **cannot yet** answer **7**." | board of cards |
| Q1 | `/clarity/q/[slug]` | "**85.1%** of youth-justice grant orgs have no evidence record linked — over a binding join measured at **93.65%**, excluding `measure_kind <> 'grant'`, honest at **ENTITY**." | the declared form + provenance ledger |
| Q2 | `/clarity/q/[slug]/rows` | "**These 662 organisations**, by name, by dollar, each with its source row." | dense table + export |
| Q3 | `/entities/[gsId]`, `/atlas`, `/graph` | "**This** organisation is connected to ___ through ___, worth $___." | existing surfaces |

**The data ladder** — how you get from a claim to the schema underneath it:

| L | Route | Sentence only this level finishes | Form |
|---|---|---|---|
| D0 | `/clarity/data` | "We hold **1,433** objects; **1,365** feed nothing; **71** matviews are in no refresh registry; **26** views return zero rows." | dense faceted ledger + coverage matrix |
| D1 | `/clarity/data/[object]` | "`acnc_ais` holds **360,488** rows, matches `gs_entities` on ABN at **94.08%**, was last written *timeout*, answers **3** questions and blocks **1**." | record + column profile |
| D2 | `/clarity/joins` | "The value in this database is concentrated on **7** objects; `gs_entities` is what makes it one graph; these **1,365** are islands." | force graph, ≤150 nodes, lensed |
| D3 | `/clarity/wants` | "The cheapest thing we could do next is **one CC-BY-4.0 download**, and it unlocks **4** questions." | ranked backlog |

**The crossing is the ingredient chip.** Every object name anywhere on the question ladder renders
as `⟨mono, 2px border⟩ acnc_ais` and links to `D1`. Every question name anywhere on the data ladder
renders as a stub chip and links to `Q1`. One component, `<ObjectChip>` / `<QuestionChip>`, used
everywhere. That is what makes this one surface rather than two.

Note the forms: **board → chart → table → graph** on the question side, **table → record → graph →
ranked list** on the data side. Six distinct representations. No level is another level zoomed.

### 2.2 Route family

```
apps/web/src/app/clarity/
├── layout.tsx                      requireAdminPage('/clarity') + .ws workspace theme
├── page.tsx                        Q0  THE INTERROGATION ROOM        (Server)
├── board-client.tsx                    "use client" — ask bar, facets, sort, in-memory filter
├── q/[slug]/page.tsx               Q1  THE WORKED ANSWER             (Server)
├── q/[slug]/forms/                     one component per form; only 3 of 9 are client
│   ├── scalar.tsx                      Server, inline SVG
│   ├── ranked-bar.tsx                  Server, inline SVG
│   ├── stacked-three.tsx               Server, inline SVG  (resolved / refused / missing)
│   ├── matrix.tsx                      Server, inline SVG  (PivotGraph)
│   ├── refused.tsx                     Server — renders WHY NOT, not a chart
│   ├── timeseries-client.tsx           "use client" — recharts + sample-size track
│   ├── distribution-client.tsx         "use client" — recharts beeswarm/strip
│   ├── hexmap-client.tsx               "use client" — static hex TopoJSON (slice 5)
│   └── sankey-client.tsx               "use client" — d3-sankey (slice 6, dep justified there)
├── q/[slug]/rows/page.tsx          Q2  THE ROWS BEHIND THE ANSWER    (Server + one island)
├── data/page.tsx                   D0  THE LEDGER                    (Server)
├── data/ledger-client.tsx              "use client" — the one 1,433-row island
├── data/[object]/page.tsx          D1  THE OBJECT DOSSIER            (Server)
├── joins/page.tsx                  D2  THE JOIN MAP (server shell)
├── joins/join-map-client.tsx           "use client" — next/dynamic(react-force-graph-2d) HERE
└── wants/page.tsx                  D3  THE WANT LIST                 (Server)

apps/web/src/app/api/clarity/
├── search/route.ts                 column-level search (14,310 columns, too many to ship)
├── question/[slug]/rerun/route.ts  admin: re-run ONE question, only if measured < 5s
└── inventory/route.ts              the whole snapshot as JSON (external consumers, the join map)

apps/web/src/lib/clarity/
├── types.ts                        Question / Ingredient / Answer / Sentinel / DataObject
├── questions.ts                    server reads: getBoard(), getQuestion(), getRows()
├── inventory.ts                    server reads: getLedger(), getObject(), getEdges()
├── phrasing.ts                     FORBIDDEN_PHRASINGS + the vitest that enforces them
├── forms.ts                        FormKind union + which are client + which refuse
└── reach.ts                        the board ranking

scripts/
├── snapshot-clarity.mjs            NIGHTLY: catalog sweep (already specced) …
└── run-clarity-answers.mjs         … then every question's answer_sql → clarity_answer
```

**Why `/clarity` and not something new.** The route name is already written into a live, deployed,
zero-consumer API: `apps/web/src/app/api/data/schema-graph/route.ts` says *"Powers the interactive
Obsidian-style schema visualization on /clarity"* **[R, CONFIRMED V4]**, and `/clarity` does not
exist **[R, V8]**. Taking the name back reconnects a working backend. It was killed 2026-04-24 for
being a *"SaaS-shaped surface"*; this ships **admin-gated** behind `requireAdminPage` exactly as
`/ops/layout.tsx` does **[R, V7]**, which honours the original decision rather than reversing it.
Not in the public nav.

### 2.3 URL state — plain searchParams, no new dependency

`nuqs` is recommended by the research and is **not installed** in grantscope. It is not needed: at
26 questions and 1,433 rows the whole payload is server-rendered, and the client island only needs
to write back. Use Next 15 `searchParams` on the server and `router.replace(url, {scroll:false})`
in the island — the proven pattern from JusticeHub `/explore` **[R: existing-surfaces]**.

```
/clarity?ask=justice&subject=justice&state=contested&sort=moved
/clarity/q/evidence-gap?topic=child-protection
/clarity/q/evidence-gap/rows?linked=false&sort=amount&page=2
/clarity/data?kind=matview&domain=D6&gap=no_refresh&sort=feeds&dir=asc
/clarity/data/mv_person_network
/clarity/joins?lens=feeds&seed=gs_entities&depth=2&s=120
/clarity/wants?effort=S
```

Every one of those is a copy-pasteable finding. `[COPY THE CLAIM]` (§6.5) pastes the permalink
*with* the coverage fraction and the caveat, so a link cannot travel without its qualifications.

### 2.4 The visual system — how Civic Bauhaus survives 26 question cards

DESIGN.md is binding and says *"Do not deviate without explicit user approval."* A question board
puts prose on screen at heading prominence, which is where a Bauhaus system usually breaks —
`font-black uppercase tracking-widest` destroys legibility past about six words. **I do not
deviate.** The fix is to split the question into two typographic objects, which is exactly
DESIGN.md's own card pattern (*"Satoshi 700 uppercase title, DM Sans value + label"*):

| Element | Type | Spec | Why |
|---|---|---|---|
| Kicker | `JUSTICE · EVIDENCE   HONEST AT ENTITY` | Satoshi 700, 11px, uppercase, `tracking-[0.1em]`, muted `#777` | DESIGN.md Micro. Machine-derived, reads as metadata |
| **Stub** | `THE EVIDENCE GAP` | Satoshi 800, 20px, uppercase, tight tracking | DESIGN.md H3. 2–4 words — the **name** of the question |
| **Question** | *How much youth-justice grant money goes to organisations with no evidence record linked?* | **DM Sans 400, 16px, sentence case** | DESIGN.md Body. Prose stays prose. This is the whole trick |
| Answer | `85.1%` | Satoshi 900, 56px, `tabular-nums` | DESIGN.md Hero |
| Denominator | `662 of 778 organisations` | DM Sans 500, 13px, `tabular-nums` | DESIGN.md Meta |
| Coverage fraction, object names, ABNs, SQL, timings | `93.65%` · `justice_funding` · `279 ms` | **JetBrains Mono 400, 12–14px** | DESIGN.md Code — identifiers and technical values only |

`stub` and `question` are separate columns in `clarity_question` precisely so this split is
enforced by the schema rather than by a component author's judgement, and a lint on stub length
(≤ 4 words) keeps it honest.

**Geometry, unchanged from DESIGN.md.** Cards: white ground, `border-4 border-bauhaus-black`,
`8px 8px 0 0` hard shadow, **zero radius**, plus the 8px coloured left border DESIGN.md already
allows for category accent — here repurposed as *state* accent (black answered / red contested /
blue blocked). Tables: 4px outer border, black header row with Satoshi 700 white uppercase, 1px row
dividers, hover `#E8EEFF`. Sticky header and frozen first column on the 1,433-row ledger. Base unit
4px; 12-column grid; content max 1200px — the ledger and the join map are the two deliberate
full-bleed exceptions, because a 12-column-wide dense table wastes half a 1440 screen.

**Motion, unchanged.** Filter and sort transitions at 150 ms. The board re-flows without animation.
No spring, no parallax, no scroll reveals. Bauhaus is still.

**Theme: `.ws` workspace variant, not full Bauhaus.** `/clarity` is an internal instrument, not a
product page, and DESIGN.md's `.ws` variant exists for exactly this (1px borders, subtle shadow,
Satoshi 700 not 900, reduced tracking) — the existing-surfaces survey reaches the same conclusion
independently. **One exception:** the question cards on the board keep the full 4px border and 8px
hard shadow, because they are the one place on this surface that is a *claim* rather than a
control, and claims should look like objects. That is a judgement call and it is the only place I
would want Ben's eye before building.

---

## 3. The data layer

### 3.1 What I inherit and do not rebuild

`clarity-data-layer.md` already drafted, measured and justified three unapplied migrations:
`clarity_object` (1,433 rows, not 812), `clarity_column`, `clarity_edge` (FK + 695 view-lineage +
curated joins), `clarity_code_ref` (distinct **files**, split app/script/migration/db_function),
`clarity_gap_metric` + `clarity_gap_measurement`, `clarity_metric_definition`, and
`v_clarity_ledger`. Its five corrections to BUILD-SPEC all hold, and two of them are load-bearing
for me:

- **`SET LOCAL statement_timeout` inside plpgsql cannot cancel a running query** — proven
  empirically **[R: clarity-data-layer §2d]**. So my answer-runner issues **one statement per
  question from the client side**, where a timeout can actually fire. Not a loop inside a function.
- **The 8-second PostgREST ceiling is inescapable** — `set_config` mid-statement does not re-arm
  the timer **[R, §2c]**. So the nightly runner is psql/pg_cron, and the in-app re-run button is
  gated on measured duration.

I add exactly four tables. Everything else is reuse.

### 3.2 The question registry — `20260815000300_clarity_question_registry.sql` (DELIVERABLE, UNAPPLIED)

```sql
-- =====================================================================================
-- CivicGraph Clarity — the question registry (part 4)
--
-- NOT APPLIED.  Apply AFTER 20260815000000 / 000100 / 000200, with psql
-- (gsql.mjs -c mangles $$ dollar-quoting):
--
--   cd /Users/benknight/Code/grantscope && source .env && \
--   PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000300_clarity_question_registry.sql
--
-- WHY THIS EXISTS: the number rendered on /clarity and the SQL that produced it must be the
-- same object.  Every headline error this project has shipped (justice 45x, donations 8x,
-- the $123bn Treasury contract, grants_total = 0) was a CLAIM-level error that a table-level
-- catalog would have carried truthfully.  Provenance therefore attaches to the claim.
-- =====================================================================================

CREATE TYPE clarity_question_state AS ENUM ('answered','contested','unanswerable','refused','retired');
CREATE TYPE clarity_form_kind     AS ENUM ('scalar','ranked_bar','stacked_three','matrix',
                                           'timeseries','distribution','hexmap','sankey','refused');
CREATE TYPE clarity_publishable   AS ENUM ('public','shareable','internal');
CREATE TYPE clarity_honest_at     AS ENUM ('national','state','lga','postcode','facility',
                                           'entity','person_block','abn','none');
CREATE TYPE clarity_effort        AS ENUM ('S','M','L');

CREATE TABLE clarity_question (
  slug                text PRIMARY KEY,
  stub                text NOT NULL,            -- 2-4 words, uppercase in the UI
  question            text NOT NULL,            -- the sentence, sentence case, DM Sans
  subject             text NOT NULL,            -- reader-facing: MONEY JUSTICE CHARITY …
  state               clarity_question_state NOT NULL,
  form                clarity_form_kind      NOT NULL,
  honest_at           clarity_honest_at      NOT NULL,
  publishable         clarity_publishable    NOT NULL DEFAULT 'internal',
  defamation_sensitive boolean NOT NULL DEFAULT false,

  -- the four things a claim may never ship without
  caveat              text NOT NULL CHECK (length(btrim(caveat)) > 20),
  exclusions          text NOT NULL,            -- the DETERMINISTIC filter, printed in the caption
  claim_phrasing      text NOT NULL,            -- the sentence the UI is allowed to render
  forbidden_phrasing  text[] NOT NULL DEFAULT '{}',

  -- the executable half
  answer_sql          text,                     -- returns ONE jsonb payload row
  rows_sql            text,                     -- returns the drill rows, must accept LIMIT/OFFSET
  coverage_sql        text,                     -- returns (numerator, denominator, label)
  refuses_when        text,                     -- prose; if set and tripped, render form='refused'
  live_rerun_ok       boolean NOT NULL DEFAULT false,   -- set by the runner from measured ms
  measured_ms         integer,

  -- blocked questions
  blocked_by          text[] NOT NULL DEFAULT '{}',  -- clarity_object.object_key or gap_metric_key
  unlock_effort       clarity_effort,
  unlock_note         text,
  unlock_dollars      numeric,                  -- dollars this would make legible, if known
  uniqueness          numeric NOT NULL DEFAULT 0.5 CHECK (uniqueness BETWEEN 0 AND 1),
  uniqueness_basis    text,                     -- WHY we believe no public source does this

  reach_score         numeric,                  -- derived, see reach.ts
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- a question is either executable or explicitly blocked.  Never silently neither.
  CONSTRAINT executable_or_blocked CHECK (
    (state IN ('answered','contested') AND answer_sql IS NOT NULL)
    OR (state IN ('unanswerable','refused') AND array_length(blocked_by,1) >= 1)
    OR state = 'retired'
  ),
  -- a blocked question must say what it would cost to unblock it
  CONSTRAINT blocked_has_a_price CHECK (
    state NOT IN ('unanswerable','refused') OR (unlock_effort IS NOT NULL AND unlock_note IS NOT NULL)
  )
);

CREATE TABLE clarity_question_ingredient (
  question_slug   text NOT NULL REFERENCES clarity_question(slug) ON DELETE CASCADE,
  object_key      text NOT NULL,               -- -> clarity_object.object_key
  role            text NOT NULL CHECK (role IN ('spine','fact','reference','filter','denominator')),
  join_key        text,                        -- 'justice_funding.gs_entity_id -> gs_entities.id'
  is_binding      boolean NOT NULL DEFAULT false,  -- the join whose coverage CAPS the answer
  measured_pct    numeric,                     -- refreshed nightly by the runner
  measured_at     timestamptz,
  PRIMARY KEY (question_slug, object_key, coalesce(join_key,''))
);
-- exactly one binding ingredient per question, or none (self-contained series)
CREATE UNIQUE INDEX clarity_one_binding ON clarity_question_ingredient (question_slug)
  WHERE is_binding;

CREATE TABLE clarity_answer (
  id              bigserial PRIMARY KEY,
  question_slug   text NOT NULL REFERENCES clarity_question(slug) ON DELETE CASCADE,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  ok              boolean NOT NULL,
  error_text      text,
  payload         jsonb,                       -- the form's data, shape declared per form kind
  headline        text,                        -- '85.1%'
  headline_sub    text,                        -- '662 of 778 organisations'
  coverage_num    numeric,
  coverage_den    numeric,
  coverage_label  text,                        -- 'justice_funding.gs_entity_id -> gs_entities'
  sentinel_flags  jsonb NOT NULL DEFAULT '{}', -- {contract_ceiling:{rows:13,share:0.294}}
  row_count       bigint,
  duration_ms     integer
);
CREATE INDEX clarity_answer_latest ON clarity_answer (question_slug, computed_at DESC);

CREATE TABLE clarity_sentinel (
  key             text PRIMARY KEY,
  label           text NOT NULL,
  description     text NOT NULL,
  probe_sql       text NOT NULL,               -- returns (tripped bool, n bigint, share numeric, detail jsonb)
  severity        text NOT NULL CHECK (severity IN ('block','warn')),
  applies_to      text[] NOT NULL DEFAULT '{}' -- question slugs; empty = global
);

-- The read view both apps may use.  security_invoker so the catalog does not become one of the
-- 99 definer-rights anon-readable views it exists to count.
CREATE VIEW v_clarity_board WITH (security_invoker = true) AS
SELECT q.*, a.headline, a.headline_sub, a.coverage_num, a.coverage_den, a.coverage_label,
       a.computed_at, a.ok, a.error_text, a.sentinel_flags, a.duration_ms
FROM clarity_question q
LEFT JOIN LATERAL (SELECT * FROM clarity_answer x
                    WHERE x.question_slug = q.slug ORDER BY x.computed_at DESC LIMIT 1) a ON true
WHERE q.state <> 'retired';
GRANT SELECT ON v_clarity_board TO service_role;
```

**Three constraints doing real work here.**

1. `caveat` is `NOT NULL` with a length floor. This is `atlas/layers.ts` generalised from places to
   claims — *"a layer with no caveat cannot be registered; the type requires one and the tests
   reject empty ones"* **[R: existing-surfaces]**, which is described as the best-engineered thing
   in either codebase.
2. `executable_or_blocked` makes "a question that neither runs nor says why" impossible. That is
   the state BUILD-SPEC's hand-seeded `data_inventory_opportunity` prose would drift into.
3. `clarity_one_binding` forces exactly one join to own the coverage number. Without it, a question
   with a 94% join and a 12.9% join renders the 94%. That is precisely the failure mode the brief
   names — *"a striking finding with 4% join coverage is a liability."*

### 3.3 Forbidden phrasing, made structural

```ts
// apps/web/src/lib/clarity/phrasing.ts
export const FORBIDDEN_PHRASINGS = [
  { pattern: /\bhas no evidence\b|\bwithout evidence\b|\bno evidence for\b/i,
    instead: 'no evidence record linked',
    why: 'ALMA holds 2,136 interventions — a curated register, not a census of practice. ' +
         '"Has no evidence" is a claim about the organisation; "no evidence record linked" is ' +
         'a fact about this database.' },
  { pattern: /\breceives? no funding\b|\bunfunded\b|\bgets? nothing\b/i,
    instead: 'no funding recorded in this database',
    why: 'mv_entity_total_funding reaches 15.4% of the spine [R]. And remote NT/WA/SA ' +
         'communities are funded through regional and land councils whose registered address ' +
         'credits the hub [R: memory].' },
  { pattern: /\bno directors?\b|\bno board\b|\bungoverned\b/i,
    instead: 'no board data held',
    why: '64,139 of ~368,606 non-person entities have any board data — a 17.5% ceiling [R].' },
  { pattern: /\bzero dollars\b|\bnever funded\b/i,
    instead: 'no dollars visible in the six sources we hold' },
] as const;
```

Enforced by `apps/web/src/__tests__/clarity-phrasing.test.ts`, which walks
`app/clarity/**/*.tsx` plus every `claim_phrasing`, `caveat` and `stub` in the seed and fails the
build on a match. The constraint in the brief — *never render "has no evidence"* — becomes a CI
guard rather than a thing someone has to remember at 11pm.

### 3.4 The nightly runner — measured, not estimated

```
scripts/run-clarity-answers.mjs      (runs AFTER scripts/snapshot-clarity.mjs)

for each question where state in ('answered','contested'):
    psql -c "SET statement_timeout='30s'; <answer_sql>"     -- one statement, real timeout
    -> INSERT clarity_answer (ok, payload, headline, coverage_*, duration_ms)
    -> UPDATE clarity_question SET measured_ms, live_rerun_ok = (measured_ms < 5000)
for each ingredient: run coverage_sql, write measured_pct
for each sentinel:   run probe_sql, fan the result into every applicable answer's sentinel_flags
recompute reach_score
log to agent_runs via scripts/lib/log-agent-run.mjs
```

**Measured costs, run by me today [V]:**

| Question | Wall clock | Verdict |
|---|---|---|
| Evidence gap (`justice_funding × alma_interventions`) | **279 ms** | live re-run allowed |
| Bidder fragility (`mv_justice_charity_financial_health`) | **196 ms** | live re-run allowed |
| Interlocked boards (`unnest(entity_ids) × mv_entity_total_funding`) | **3,076 ms** | snapshot only — under the 8 s psql budget, over the 3 s anon ceiling |
| `mv_refresh_log` freshness probe | **56 ms** | — |

Extrapolating to ~26 questions at that spread: **well under a minute**, on top of the measured
4.5-minute catalog sweep **[R]**. The board renders from `clarity_answer`, never from source
tables. `/api/clarity/question/[slug]/rerun` exists but refuses when `live_rerun_ok = false` and
prints the measured duration as the reason.

**A number I re-derived that the source document got wrong, which is what this machinery is for.**
OPPORTUNITY-MAP §2.4 reports mean months-of-reserves and flags the `watch` tier's 1,956 as outlier
contamination. Running the median instead **[V]**:

```
fragility_tier | charities | in_deficit | median_months
healthy        |      3124 |          0 |          14.6
watch          |      1776 |       1460 |           8.7
fragile        |       773 |        530 |           0.9
unknown        |       225 |         14 |          39.6
```

**773 fragile charities at a median 0.9 months of reserves** — five weeks of cash, tighter than the
1.1-month mean the document reports. The `answer_sql` in the registry is the median version, so the
screen and the doc can never disagree again.

---

## 4. The seed — 26 questions, every one with a verified basis

D14 (ACT private business, 238 objects) is excluded per Ben's decision; no question references an
ACT object, and `/clarity/data` states the exclusion out loud rather than hiding it.

### 4.1 ANSWERED (14) — cards carry a live number

| # | slug · STUB | The question | Today | Honest at | Basis |
|---|---|---|---|---|---|
| 1 | `evidence-gap` · **THE EVIDENCE GAP** | How much youth-justice grant money goes to organisations with no evidence record linked? | **85.1%** — 662/778 orgs, $663.9m of $1,142.1m | ENTITY | **[V] I ran it: 279 ms, exact reproduction.** Confirmed V19 |
| 2 | `watchhouse-children` · **WATCHHOUSE CHILDREN** | How many children are held in QLD police watchhouses, where, for how long, and is it changing? | **2.7×** May→Aug (14.2→38.8 per snapshot) | FACILITY | [R] rebaselined by V§4 off May n=59, **not** April n=2 |
| 3 | `bidder-fragility` · **BIDDER FRAGILITY** | Can the charity delivering this government service survive the contract? | **773 fragile**, median **0.9 months** reserves | ENTITY | **[V] I ran it, 196 ms, with the median** |
| 4 | `interlocked-boards` · **INTERLOCKED BOARDS** | Which organisations are governed by someone who also sits on another board? | **41,614 orgs**, 39,139 people (2–10 cap), $63.04bn over 12.9% rollup | PERSON_BLOCK | **[V] I ran it, 3.08 s.** Confirmed V32 |
| 5 | `off-spine-grants` · **MONEY WE CANNOT SEE** | How much Commonwealth grant money goes to organisations this graph has never created? | **$11.83bn** · 68,175 awards · 30,129 ABNs | ABN | [R] confirmed V24; denominator must be stated (V25) |
| 6 | `prison-release-charities` · **AFTER RELEASE** | Who says they serve people leaving prison, and does any money reach them? | 4,629 charities · **862 (18.6%)** have any rollup | ENTITY | [R] confirmed V37 |
| 7 | `two-purses` · **TWO PURSES, ONE ORG** | Which foundation grantees also hold Commonwealth contracts? | **949 of 4,167 (22.8%)** | ENTITY | [R] — **UNVERIFIED per V§9. Ships with an UNVERIFIED stamp.** |
| 8 | `revolving-door` · **THREE SYSTEMS AT ONCE** | Which entities lobby, donate, contract and receive funding at the same time? | 6,976 rows in `mv_revolving_door` | ENTITY | [R] feasible, not yet run |
| 9 | `govt-dependence` · **HOW MUCH IS GOVERNMENT** | Which charities are most dependent on government revenue, and does it track size/state/sector? | — | ENTITY | [R]. Hazard: `acnc_ais` has **no FY2024 rows**; `GROUP BY ais_year` is mandatory |
| 10 | `every-dollar-one-abn` · **EVERY DOLLAR** | For one ABN, what is every dollar from every tier of Australian government? | 6 sources, 65–95% each | ENTITY | [R]. Renders **"at least $X"**, per-source linkage shown |
| 11 | `community-controlled-share` · **WHOSE MONEY, WHOSE PLACE** | Where community-controlled orgs exist, what share of the money do they get? | — | LGA (48.3%) | [R]. `cc_confidence` gates the view |
| 12 | `ministerial-diaries` · **WHO MET WHOM** | Which ministers met which organisations, and did those orgs later win contracts? | 1,728 meetings | ENTITY | [R] — **stamped PILOT. A worked example, not a corpus.** |
| 13 | `ndis-concentration` · **NDIS CONCENTRATION** | Where does NDIS market concentration sit against disadvantage? | — | **STATE** | [R] confirmed V28: `ndis_participants_lga.lga_code` 100% NULL. **Refuses to draw an LGA map.** |
| 14 | `exec-pay-dependence` · **PAY AND DEPENDENCE** | Does executive pay track government dependence? | — | ENTITY | [R]. `publishable = internal`, `defamation_sensitive = true` |

### 4.2 CONTESTED (5) — answerable, but a named defect must be fixed first. Red border, struck-through number.

| # | slug · STUB | Blocking defect | Fix |
|---|---|---|---|
| 15 | `donor-contractor` · **GIVES AND TAKES** | 72.1% of rows / **85.3% of dollars** in `political_donations` are `other receipt` [R, V21] **and** 13 AusTender rows carry 29.4% of all value, max **Hays $123.00bn** [R, V22/V23] | two sentinels: `receipt_type='donation received'` + a $5bn ceiling. Both registered in `clarity_sentinel`, both tripped today |
| 16 | `funding-deserts` · **DISADVANTAGE, NO MONEY** | `mv_funding_deserts` is 1,997 rows over 551 names and **1,130 name\|state pairs** — 1.77 rows per key, so **the prescribed `GROUP BY lga_name, state` does not resolve the grain** [R, V39 REFUTED the fix] | a real grain investigation; until then the question renders the grain defect instead of a map |
| 17 | `commonwealth-spend` · **WHAT THE COMMONWEALTH SPENDS** | 13 rows = 29.4% of $1,266.04bn; plus **54 rows with CSV field-shift corruption** and **1,905 NULL contract_value** [R, V§5 N1/N2] | outlier sentinel + `NULLS LAST` everywhere + adjudicate the 13 |
| 18 | `youth-justice-total` · **YOUTH JUSTICE MONEY** | `measure_kind` mixing inflates the topic total **45.3×** ($69.44bn vs $1.534bn) [R, V17] | `measure_kind` becomes a **required, visible facet**, never a default. The question cannot render without one selected |
| 19 | `org-total-funding` · **WHAT HAS THIS ORG RECEIVED** | `mv_entity_total_funding.grants_total` is **exactly zero across all 94,088 rows** [R, V30 upgraded from suspected to confirmed] | read the MV definition, rebuild. Until then the question shows contracts + justice only and says so |

### 4.3 CANNOT ANSWER YET (7) — the want list, each auto-derived from a gap

| # | slug · STUB | Blocked by | Effort | Unlocks |
|---|---|---|---|---|
| 20 | `indigenous-over-rep` · **OVER-REPRESENTATION** | `abs_indigenous_population_by_lga` is **EMPTY** [R] | **S** — one CC-BY-4.0 ABS download | every per-capita Indigenous rate below state level; 4 other questions |
| 21 | `board-to-contractor` · **DIRECTORS AND CONTRACTS** | `mv_board_contractor_links` **4 rows**, `_donor_links` **2**, `mv_multi_board_persons` **1**, against a 39,757-row interlock MV [R, V31] | **S** — a predicate bug, one day | two flagship cross-sections |
| 22 | `grant-behind-this-edge` · **THE RECEIPT** | `gs_relationships.source_record_id` is a **dead key namespace — 100% orphaned on a 200,000-row anti-join**, and does not match `source_statement_id` either [R, V38] | **M** — key rebuild | "click an edge, see the grant" everywhere in the product |
| 23 | `detention-by-lga` · **DETENTION BY PLACE** | `aihw_youth_justice_stats` = **13 rows**, one year, `source_table='PDF_HEADLINE'`, NT missing [R] | **L** | **state ÷ LGA framing only.** Renders `form='refused'` — see §6.9 |
| 24 | `national-crime-map` · **CRIME, NATIONALLY** | `crime_stats_lga`: **WA 0 rows, TAS 0 rows** [R] | **M** | a national LGA crime × funding map that does not silently invent two states |
| 25 | `anything-at-sa2` · **SA2 GRAIN** | `gs_entities.sa2_code` populated on **14.4%**; `postcode_geo` is not a complete SA2 register [R] | **M** — ABS SA2 ingest | every sub-LGA claim |
| 26 | `nz-crosswalk` · **ACROSS THE TASMAN** | `nz_charities.gs_entity_id` populated on **0 of 45,192** [R, V27] | **S** | a trans-Tasman charity view |

**Every one of the 26 has a citation.** Nothing in this seed was invented; the registry's job is to
make that permanent.

---

## 5. Screen 1 — `/clarity` · THE INTERROGATION ROOM

### 5.1 Wireframe (1440px)

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ CIVICGRAPH ▸ CLARITY                                                        ADMIN · WORKSPACE .ws║
╠══════════════════════════════════════════════════════════════════════════════════════════════════╣
║ 1,433 OBJECTS · 52,349,579 ROWS · 28 GB · 1,024 RELATIONS + 409 ROUTINES                         ║
║ 68 FEED A REGISTERED QUESTION · 1,365 DO NOT      SWEPT 15 AUG 03:14 (4m38s)   [ THE LEDGER → ]  ║
║ 238 ACT PRIVATE-BUSINESS OBJECTS EXCLUDED FROM THIS VIEW  ▸ scope register                       ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

  ┌────────────────────────────────────────────────────────────────────────────────────────────┐
  │  ⌕   Ask the database…                                                                     │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   26 QUESTIONS · 14 ANSWERED · 5 CONTESTED · 7 CANNOT ANSWER YET · 3 MOVED SINCE 14 AUG

   [ ALL 26 ] [ JUSTICE 8 ] [ MONEY 6 ] [ CHARITY 5 ] [ POWER 4 ] [ PLACE 4 ] [ EVIDENCE 3 ]
   SORT ▾  REACH · newest answer · biggest move · shakiest coverage · most blocked

┌─ ANSWERED · 14 ──────────────────────────────────────────────────────────────────────────────────┐

 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━━━━━━━━━━━━┓
 ┃▌JUSTICE · EVIDENCE   ENTITY    ┃  ┃▌JUSTICE · DETENTION  FACILITY  ┃  ┃▌CHARITY · PROCUREMENT  ┃
 ┃▌                               ┃  ┃▌                               ┃  ┃▌              ENTITY   ┃
 ┃▌THE EVIDENCE GAP               ┃  ┃▌WATCHHOUSE CHILDREN            ┃  ┃▌BIDDER FRAGILITY       ┃
 ┃▌How much youth-justice grant   ┃  ┃▌How many children are held in  ┃  ┃▌Can the charity        ┃
 ┃▌money goes to organisations    ┃  ┃▌QLD police watchhouses, where, ┃  ┃▌delivering this        ┃
 ┃▌with no evidence record        ┃  ┃▌for how long, and is that      ┃  ┃▌government service     ┃
 ┃▌linked?                        ┃  ┃▌changing?                      ┃  ┃▌survive the contract?  ┃
 ┃▌                               ┃  ┃▌                               ┃  ┃▌                       ┃
 ┃▌  85.1%                        ┃  ┃▌  2.7×          ▲ +2.4 (14 AUG)┃  ┃▌  773                  ┃
 ┃▌  662 of 778 organisations     ┃  ┃▌  14.2 → 38.8 children/snapshot┃  ┃▌  fragile of 5,898     ┃
 ┃▌  $663.9m of $1,142.1m         ┃  ┃▌  May → Aug 2026               ┃  ┃▌  median 0.9 months    ┃
 ┃▌                               ┃  ┃▌                               ┃  ┃▌  of reserves          ┃
 ┃▌ ▁▂▃▅▆█                        ┃  ┃▌ ▁▂▄▆█                         ┃  ┃▌ ▃▃▃▄▄▄                ┃
 ┃▌ ██████████████████▒▒  93.65%  ┃  ┃▌ ██████████████████████  100%  ┃  ┃▌ ███████████████▒▒ 94% ┃
 ┃▌ binding justice_funding       ┃  ┃▌ self-contained series         ┃  ┃▌ binding acnc_ais.abn  ┃
 ┃▌   .gs_entity_id → gs_entities ┃  ┃▌                               ┃  ┃▌   → gs_entities.abn   ┃
 ┃▌ 4 ingredients · fresh 14h     ┃  ┃▌ 2 ingredients · fresh 9h      ┃  ┃▌ 3 ingr. · fresh 2d    ┃
 ┃▌ ✓ sentinels clear             ┃  ┃▌ ⚠ rebaselined off May (n=59)  ┃  ┃▌ ✓ sentinels clear     ┃
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━━━━━━━━━━━━┛
                       … 11 more, 3 across, ranked by REACH …
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─ CONTESTED · 5 ── answerable, but a defect would make the claim wrong ────────────────────────────┐

 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
 ┃▌MONEY · POWER   ⚑ 2 SENTINELS  ┃  ┃▌PLACE · MONEY   ⚑ GRAIN DEFECT ┃    ▌ = 8px RED left border
 ┃▌                               ┃  ┃▌                               ┃
 ┃▌GIVES AND TAKES                ┃  ┃▌DISADVANTAGE, NO MONEY         ┃
 ┃▌Which entities give money to   ┃  ┃▌Which of Australia's most      ┃
 ┃▌political parties and take     ┃  ┃▌disadvantaged places receive   ┃
 ┃▌money from government?         ┃  ┃▌essentially no recorded money? ┃
 ┃▌                               ┃  ┃▌                               ┃
 ┃▌  ~~$713,456m~~   NOT SHOWN    ┃  ┃▌  ~~12 LGAs~~     NOT SHOWN    ┃
 ┃▌                               ┃  ┃▌                               ┃
 ┃▌ ⚑ receipt_type — 85.3% of the ┃  ┃▌ ⚑ 1,997 rows over 1,130       ┃
 ┃▌   dollars are 'other receipt',┃  ┃▌   name|state pairs = 1.77 per ┃
 ┃▌   not donations               ┃  ┃▌   key.  GROUP BY lga_name,    ┃
 ┃▌ ⚑ contract ceiling — 13 rows  ┃  ┃▌   state does NOT fix it.      ┃
 ┃▌   (29.4%) above $5bn; max     ┃  ┃▌                               ┃
 ┃▌   Hays $123.00bn to Treasury  ┃  ┃▌ [ WHAT WOULD FIX THIS → ]     ┃
 ┃▌ [ ADJUDICATE THE 13 ROWS → ]  ┃  ┃▌                               ┃
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─ CANNOT ANSWER YET · 7 ── the want list ─────────────────────────────────────────────────────────┐

 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
 ┃▌PLACE · JUSTICE          ┼ GAP ┃  ┃▌POWER · GOVERNANCE       ┼ GAP ┃    ▌ = 8px BLUE left border
 ┃▌                               ┃  ┃▌                               ┃    ┼ = the gap glyph
 ┃▌OVER-REPRESENTATION            ┃  ┃▌DIRECTORS AND CONTRACTS        ┃
 ┃▌Is this LGA's Indigenous youth ┃  ┃▌Which directors sit on the     ┃
 ┃▌over-representation above or   ┃  ┃▌board of an organisation that  ┃
 ┃▌below the state rate?          ┃  ┃▌holds a government contract?   ┃
 ┃▌                               ┃  ┃▌                               ┃
 ┃▌ BLOCKED BY                    ┃  ┃▌ BLOCKED BY                    ┃
 ┃▌  ┼ abs_indigenous_population_ ┃  ┃▌  ┼ mv_board_contractor_links  ┃
 ┃▌      by_lga    0 rows         ┃  ┃▌      4 rows  (vs 39,757 in    ┃
 ┃▌                               ┃  ┃▌      mv_board_interlocks)     ┃
 ┃▌ EFFORT  S · one CC-BY-4.0 ABS ┃  ┃▌  ┼ mv_board_donor_links 2 rows┃
 ┃▌         download              ┃  ┃▌                               ┃
 ┃▌ UNLOCKS 4 questions + every   ┃  ┃▌ EFFORT  S · predicate bug     ┃
 ┃▌         per-capita Indigenous ┃  ┃▌ UNLOCKS 2 flagship questions  ┃
 ┃▌         rate below state      ┃  ┃▌ [ OPEN THE WANT LIST → ]      ┃
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Components

| Component | Kind | Notes |
|---|---|---|
| `EstateStrip` | Server | Black band, JetBrains Mono 13px, white text. One `SELECT` over `clarity_object` aggregates. The `68 FEED / 1,365 DO NOT` clause is the whole inventory-first argument compressed into two numbers |
| `AskBar` | Client | Debounced 150 ms. Matches questions (stub, question text, tags) + object names in memory; falls through to `/api/clarity/search` for the 14,310 columns |
| `SubjectChips` | Client | Facet counts, greyed at zero — the zero-dead-end rule **[R: research-dashboards §3.7]** |
| `QuestionCard` | Server | The whole card is server-rendered HTML; only the parent grid is a client island for filtering |
| `Sparkline` | Server | Inline SVG, 6 runs of `clarity_answer`. No library |
| `CoverageBar` | Server | Inline SVG. **Always prints the fraction, never a bare %.** Binding join named underneath |
| `SentinelRow` | Server | `✓ clear` (black) / `⚑ n tripped` (red, with count and share) |
| `GapGlyph` | Server | 16px, 2px blue border, black `+`. Clickable → `/clarity/wants#<key>`. Monte Carlo's affordance-that-is-also-the-fix **[R]** |

### 5.3 The query

```sql
-- getBoard() — apps/web/src/lib/clarity/questions.ts, getDirectServiceSupabase()
SELECT b.*,
       (SELECT count(*) FROM clarity_question_ingredient i WHERE i.question_slug = b.slug) AS ingredients,
       (SELECT min(o.last_write_at) FROM clarity_question_ingredient i
          JOIN clarity_object o ON o.object_key = i.object_key
         WHERE i.question_slug = b.slug)                                    AS oldest_ingredient_write,
       (SELECT jsonb_agg(jsonb_build_object('at', x.computed_at, 'h', x.headline) ORDER BY x.computed_at)
          FROM (SELECT * FROM clarity_answer y
                 WHERE y.question_slug = b.slug AND y.ok ORDER BY y.computed_at DESC LIMIT 6) x) AS spark,
       prev.headline AS prev_headline, prev.computed_at AS prev_at
FROM v_clarity_board b
LEFT JOIN LATERAL (SELECT * FROM clarity_answer x WHERE x.question_slug = b.slug AND x.ok
                    ORDER BY x.computed_at DESC OFFSET 1 LIMIT 1) prev ON true
ORDER BY b.state, b.reach_score DESC NULLS LAST;
```
~26 rows, one round trip, sub-50 ms **[I]** — it reads only registry tables, no source data.

### 5.4 REACH — the default sort, derived not typed

Every catalog that works ranks by derived importance, never alphabetically (Amundsen, Airbnb,
Select Star, Monte Carlo) **[R: research-dashboards §2.1]**. The question-board equivalent:

```
reach = 0.30 · ln(1+dollars_made_legible)/ln(1+max_dollars)
      + 0.25 · binding_coverage                        -- the honest cap on the claim
      + 0.15 · uniqueness                              -- 1.0 = no public Australian source does this
      + 0.15 · recency_band(oldest ingredient write)   -- 1.0 ≤7d · 0.7 ≤30d · 0.4 ≤180d · 0.1 older
      + 0.15 · publishable_weight                      -- public 1.0 · shareable 0.7 · internal 0.4
      × state_multiplier                               -- answered 1.0 · contested 0.6 · unanswerable 0.5
```

`uniqueness` is the only hand-set input, and it carries `uniqueness_basis` — the written reason we
believe no public source does this. That is curation debt and I declare it in §11.

Alternate sorts, all one click: **newest answer · biggest move · shakiest coverage · most blocked.**
"Shakiest coverage" ascending is the sort that finds liabilities before a journalist does.

### 5.5 States

| State | Render |
|---|---|
| **Loading** | Card skeleton with the stub, question and ingredient chips already present (they come from the registry, not the answer). Only the number and bar are skeletons. Never a spinner over a blank card |
| **Never run** | `NEVER RUN` in blue mono where the number goes, plus the registration date. **Never a zero** |
| **Last run errored** | Red band across the card top with the `error_text`; the last good answer shown beneath, greyed, with `AS AT <date>`. Never the stale number presented as current |
| **Sentinel tripped** | Number struck through, `NOT SHOWN` beside it, the tripped sentinels listed with counts and shares, and the adjudication CTA. This is the Hays/$123bn case rendered as a refusal rather than a disclaimer |
| **Empty board** (registry unseeded) | The estate strip alone plus one card: *"No questions registered. Seed with `node scripts/seed-clarity-questions.mjs`."* — an instrument that says what to do, not an empty page |
| **DB unreachable** | The whole board is one red-bordered panel with the error and the last-known `computed_at` from the client cache. Never a partial board — JusticeHub's `/what-we-hold` returns `null` on any failure rather than partial numbers, which is the right posture **[R: existing-surfaces]** |

---

## 6. Screen 2 — `/clarity/q/[slug]` · THE WORKED ANSWER

This is the heart of the design. It is where "the best possible maps, visualisations and analytics"
actually lives, and where the honesty constraints become visual objects rather than footnotes.

### 6.1 Wireframe

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ CLARITY   JUSTICE · EVIDENCE            ANSWERED    HONEST AT ENTITY    PUBLISHABLE: SHAREABLE ║
║                                                                                                  ║
║ THE EVIDENCE GAP                                                                                 ║
║ How much youth-justice grant money goes to organisations with no evidence record linked?         ║
║                                                                                                  ║
║ COMPUTED 15 AUG 03:19 · 279 ms · run #7      [ RE-RUN ] [ COPY THE CLAIM ] [ SEE THE 662 ROWS → ]║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
┌──────────────────────────────────────────────────────────┬───────────────────────────────────────┐
│                                                          │ PROVENANCE                            │
│  85.1%                                                   │                                       │
│  of organisations receiving youth-justice grant money     │ ▣ justice_funding          SPINE     │
│  have no evidence record linked in ALMA                  │   157,116 rows · written 14 AUG      │
│                                                          │   gs_entity_id → gs_entities.id      │
│  TOPIC  [ youth-justice ▾ ]  child-protection · all      │   ████████████████████▒▒  93.65%     │
│  MEASURE_KIND  [ grant ▾ ] ← REQUIRED, see caveat        │   ◀ BINDING JOIN — caps this claim    │
│                                                          │                                       │
│         ORGANISATIONS              GRANT DOLLARS         │ ▣ alma_interventions       FACT      │
│  no ev. ████████████████████ 662   ██████████ $663.9m    │   2,136 rows · written 14 AUG        │
│  linked ███ 116                    ███████ $478.2m       │   gs_entity_id (70.27% stamped)      │
│         └──────────────────┘       └────────────────┘    │   ██████████████▒▒▒▒▒▒  70.27%       │
│         0            400    800    0        400m   800m  │                                       │
│                                                          │ ▣ gs_entities              REFERENCE │
│  ⬛ no evidence record linked   ⬜ evidence record linked  │   609,448 rows · written 14 AUG      │
│                                                          │                                       │
│  RUN HISTORY                                             │ ▣ alma_intervention_evidence  FILTER │
│  85.4 ─ 85.3 ─ 85.1 ─ 85.1 ─ 85.1 ─ 85.1                 │   3,109 rows · written 14 AUG        │
│  10AUG            12AUG            15AUG                 │                                       │
│                                                          ├───────────────────────────────────────┤
├──────────────────────────────────────────────────────────┤ SENTINELS                             │
│ ⚠ SAY IT THIS WAY                                        │ ✓ measure_kind filter applied         │
│                                                          │   (without it this number is 45.3×    │
│   SAY: "no evidence record linked in ALMA"               │    wrong — $69.44bn vs $1.534bn)      │
│   NOT: "has no evidence"                                 │ ✓ topic array uses HYPHENS            │
│                                                          │   'youth-justice' not 'youth_justice' │
│   ALMA holds 2,136 interventions — a curated register,   │   (underscore silently returns 0)     │
│   not a census of practice.  The first is a fact about   │ ✓ no plausibility ceiling breached     │
│   this database.  The second is a claim about the        ├───────────────────────────────────────┤
│   organisation, and it is a slur.                        │ EXCLUSIONS (deterministic, not a      │
│                                                          │ sample)                               │
├──────────────────────────────────────────────────────────┤  · measure_kind <> 'grant'            │
│ WHAT WOULD MAKE THIS BETTER                              │    — 848 rows / $66.126bn of RoGS &   │
│                                                          │      AIHW state budget aggregates     │
│  ┼ alma_interventions.gs_entity_id is 70.27% stamped.    │  · gs_entity_id IS NULL               │
│    Stamping the remaining 635 would move the             │    — 6.35% of justice_funding         │
│    denominator, not the numerator.        EFFORT S       │  · topics NOT && ['youth-justice']    │
│                                                          ├───────────────────────────────────────┤
│  ┼ mv_entity_total_funding.grants_total = 0 across all   │ RELATED — shares ≥2 ingredients        │
│    94,088 rows, so this cannot yet be expressed as a     │  ▸ AFTER RELEASE                      │
│    share of ALL money an org receives.    EFFORT M       │  ▸ YOUTH JUSTICE MONEY   ⚑ contested  │
│                                          [ WANT LIST → ] │  ▸ WHOSE MONEY, WHOSE PLACE           │
└──────────────────────────────────────────────────────────┴───────────────────────────────────────┘
  ▸ THE SQL                                                                          [ COPY ]
  ┌────────────────────────────────────────────────────────────────────────────────────────────┐
  │ WITH jf AS (SELECT gs_entity_id, sum(amount_dollars) amt, count(*) n FROM justice_funding   │
  │   WHERE measure_kind='grant' AND gs_entity_id IS NOT NULL                                   │
  │     AND topics && ARRAY['youth-justice'] GROUP BY 1)                                        │
  │ SELECT (a.gs_entity_id IS NOT NULL) AS evidence_linked, count(*) orgs, …                    │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Why the layout is this way

- **The caveat is not a footnote.** `⚠ SAY IT THIS WAY` sits at the same visual weight as the
  answer, in a yellow-bordered box, on the left column under the chart. It is the *first* thing
  below the fold, before "what would make this better".
- **The provenance ledger is a permanent right rail**, not a tab. Every ingredient shows its
  measured coverage bar, and the binding one is marked. You cannot read the number without seeing
  what caps it.
- **Exclusions are printed as the deterministic filter**, per the sampling rule: *never sample
  randomly for a view that carries an analytical claim; state exactly what was excluded*
  **[R: research-visualization §2.5]**.
- **`measure_kind` is a required control, not a default.** The 45.3× error is structurally
  impossible because the chart will not render until one is selected.

### 6.3 The nine forms, and which question gets which

Form follows the question, not the data type. Each is declared in `clarity_question.form`.

| Form | For | Library | Justification |
|---|---|---|---|
| `scalar` | one number + denominator — `off-spine-grants` | inline SVG | position + length, Cleveland-McGill ranks 1–2 |
| `ranked_bar` | anything ordered — `bidder-fragility`, `evidence-gap` | inline SVG (Server) | *"the fix to a treemap is a sorted bar chart"* **[R: NN/g]** |
| `stacked_three` | **RESOLVED / REFUSED / MISSING** — `community-controlled-share` | inline SVG | the three-segment rule from the gaps spec: yellow means *we know where it isn't* |
| `matrix` | `funder_type × recipient_type` — `two-purses`, `revolving-door` | inline SVG | PivotGraph: aggregate along 2 categorical dimensions, **zero hairball risk** **[R: §2.4]** |
| `timeseries` | `watchhouse-children` | recharts (installed) | + the sample-size track, §6.4 |
| `distribution` | months-of-reserves — `bidder-fragility` detail | recharts | median + outliers both visible; the mean is 1,956 and the median is 8.7 |
| `hexmap` | `funding-deserts`, `community-controlled-share` | static hex TopoJSON + inline SVG | a raw Australian LGA choropleth **inverts the editorial claim** — remote Australia dominates visually **[R: §4.3]**. Slice 5 |
| `sankey` | `every-dollar-one-abn` | d3-sankey — **new dep, slice 6** | ≤10 nodes/stage, ≤5 stages, **cycle detection with refusal** **[R: §3.1]** |
| `refused` | `detention-by-lga` | none | §6.9 |

**Zero new dependencies for slices 1–4.** `recharts` ^3.7.0, `react-force-graph-2d` ^1.29.1 and
`leaflet` are already in `apps/web/package.json` **[R: installed-viz-libs]**. `d3-sankey` is the
only proposed addition and it is deferred to slice 6, where it is justified by being the only
honest primitive for staged money flow and already proven in JusticeHub's `SankeyDiagram.tsx`.

### 6.4 The one visualisation primitive I would fight for: the sample-size track

`VERIFICATION.md §4` found that every headline watchhouse figure — 3.0×, 80.8%→37.6%, +868% — is
anchored on a first bucket of **n = 2 snapshots**, and that rebasing on May (n = 59) gives **2.7×**
and **+476%** instead. Nobody caught it for a day, because a line chart draws a first point exactly
as confidently as its hundredth.

So: **every `timeseries` form renders a second track under the x-axis showing n per bucket**, as a
hairline bar. An n=2 bucket is a 2px sliver against a 59px bar and it is impossible to miss. The
axis label reads `per snapshot · 201 snapshots over 108 days`, not `per day`.

```
  40 ┤                                        ●
     │                                ●
  30 ┤
     │                        ●
  20 ┤
     │        ●       ●
  10 ┤ ●
   0 ┼────────┬───────┬───────┬───────┬───────┬──
     APR     MAY     JUN     JUL     AUG
 n   ▌       █████   █████   █████   ███
     2       59      52      62      26        ← the sample-size track
     └ baseline refused: n=2.  Series rebased on MAY.
```

This is cheap (one extra `<rect>` row), it generalises to every time series in both apps, and it is
a structural fix for the exact class of error that got past two review passes.

### 6.5 `[COPY THE CLAIM]` — the artifact that leaves the building

Clicking it copies:

```
85.1% of organisations receiving youth-justice grant money have no evidence record linked in ALMA.
662 of 778 organisations, holding $663.9m of $1,142.1m.

Coverage: binding join justice_funding.gs_entity_id -> gs_entities.id, measured 93.65%.
Honest at: ENTITY.
Excludes: measure_kind <> 'grant' (848 rows / $66.126bn of state budget aggregates);
          gs_entity_id IS NULL (6.35%); topics not containing 'youth-justice'.
Caveat:   ALMA holds 2,136 interventions — a curated register, not a census of practice.
          This measures evidence RECORDED IN ALMA, not evidence that exists.
Computed: 2026-08-15 03:19 UTC.  https://…/clarity/q/evidence-gap
```

You cannot copy the number without the coverage and the caveat. That is my answer to *"a striking
finding with 4% join coverage is a liability."* The liability is not the finding — it is the
finding travelling naked, and this makes that require deliberate effort.

### 6.6 The UNVERIFIED stamp

`two-purses` (949 of 4,167 = 22.8%) is marked **UNVERIFIED** in `VERIFICATION.md §9` — the
adversarial pass did not re-measure it. Its card and page carry a blue `UNVERIFIED` chip and a line
naming what would clear it. A question-first surface can carry the epistemic status of the *claim*;
a table ledger has nowhere to put it, because "the table exists" is not in doubt.

### 6.7 The PILOT stamp

`ministerial-diaries` is 1,728 meetings. That is a demo, not a corpus. `state = 'answered'` but a
yellow `PILOT — worked example, not a finding` band sits above the chart, and `publishable` is
`internal`. The registry makes this a field rather than a memory.

### 6.8 Screen 3 — `/clarity/q/[slug]/rows`

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ THE EVIDENCE GAP        662 ORGANISATIONS · NO EVIDENCE RECORD LINKED · $663.9m               ║
║ [ evidence linked: NO ▾ ]  [ topic: youth-justice ▾ ]  [ sort: $ ▾ ]      [ CSV ] [ SQL IN-LIST ]║
╠═══════════════════════════════════╤═════════╤════════════╤═══════════╤═══════════════════════════╣
║ ORGANISATION                      │ GRANTS  │ TOTAL      │ LGA       │ ALMA                      ║
╟───────────────────────────────────┼─────────┼────────────┼───────────┼───────────────────────────╢
║ ▸ Example Youth Service Inc       │      14 │ $12,480,00 │ Cairns    │ ┼ no record linked        ║
║   GS-41822 · ABN 89 006 ···       │         │            │ QLD       │                           ║
║ ▸ …                               │         │            │ ⚠ no LGA  │ ┼ no record linked        ║
║                                   │         │            │  refused  │                           ║
╚═══════════════════════════════════╧═════════╧════════════╧═══════════╧═══════════════════════════╝
  Showing 1–50 of 662.  Every row links to /entities/[gsId].
  ⚠ 34,223 entities across the database hold a postcode and no LGA BECAUSE the rebuild refused to
    be confidently wrong.  Yellow, not red.  [ what "refused" means → ]
```

`rows_sql` is stored on the question and must accept `LIMIT`/`OFFSET`; the page appends them.
Export writes the same deterministic filter string into the CSV header, so an exported file carries
its exclusions.

### 6.9 The `refused` form — the most important one in the set

`detention-by-lga` gets a full card and a full page, and renders **no chart at all**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◀ CLARITY   PLACE · JUSTICE                                    REFUSED     HONEST AT: STATE      │
│                                                                                                  │
│ DETENTION BY PLACE                                                                               │
│ What is the youth detention rate in this LGA?                                                    │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   THIS VIEW REFUSES TO RENDER.                                                                   │
│                                                                                                  │
│   An LGA choropleth of youth detention would be a fabrication.  The source                       │
│   ▣ aihw_youth_justice_stats holds 13 rows, one year, source_table = 'PDF_HEADLINE',             │
│   and the Northern Territory is missing entirely.  AIHW publishes state-level,                   │
│   quarterly, roughly two quarters lagged, by design.                                             │
│                                                                                                  │
│   WHAT WE CAN HONESTLY SHOW INSTEAD                                                              │
│     ▸ state ÷ LGA framing, labelled as such                                                      │
│     ▸ WATCHHOUSE CHILDREN — facility-level, near-daily, ~1 day lagged.  Police custody,          │
│       not detention.  Not comparable to AIHW figures without saying so.                          │
│                                                                                                  │
│   WHAT WOULD MAKE THIS ANSWERABLE                                                                │
│     ┼ per-LGA detention counts.  EFFORT L.  Nothing cheap exists.        [ WANT LIST → ]         │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Open Ownership's BOVS "Accurate" principle says design *"can accidentally mislead… so they
deliberately choose approaches that are unambiguous, to avoid suggesting we know more than we in
fact do"* **[R: research-visualization §2.6]**. Making refusal a **first-class rendered object with
its own route and its own card** is how that becomes a product feature instead of a discipline.
No inventory-first design has anywhere to put it: a table row for `aihw_youth_justice_stats` says
`13 rows` and stops.

---

## 7. Screen 4 — `/clarity/data` · THE LEDGER

The full inventory, built in full. Everything BUILD-SPEC's screen 1 does, plus two columns it
cannot have.

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ CLARITY ▸ THE LEDGER          1,433 OBJECTS · 68 FEED A QUESTION · 1,365 DO NOT                ║
║ ⌕ search names, purposes, 14,310 columns…            LENS ▾ feeds · rows · bytes · fresh · gaps  ║
╠════════════╤═════════════════════════════════════════════════════════════════════════════════════╣
║ FACETS     │ SOURCES · 714 tables                          sorted by FEEDS ▾ then IMPORTANCE     ║
║            │ ┌──────────────────────┬───────┬──────┬─────┬─────┬───┬───┬───┬───┬───┬───┬───────┐║
║ KIND       │ │ OBJECT               │  ROWS │ SIZE │FRESH│FEEDS│ROW│FRS│PUR│OWN│FK │USE│BLOCKS │║
║ ☐ table 714│ ├──────────────────────┼───────┼──────┼─────┼─────┼───┼───┼───┼───┼───┼───┼───────┤║
║ ☐ matvw 98 │ │ justice_funding      │ 157K  │ …    │  1d │  6  │ ✓ │ ✓ │ ✓ │ ┼ │ ✓ │ ✓ │   1   │║
║ ☐ view 212 │ │ ████████████████████ │       │      │     │     │   │   │   │   │   │   │       │║
║ ☐ func 409 │ │ gs_entities          │ 609K  │4.9GB │  1d │  9  │ ✓ │ ✓ │ ✓ │ ┼ │ ✓ │ ✓ │   0   │║
║            │ │ acnc_ais             │ 360K  │ …    │ ⚠TMO│  3  │ ✓ │ ⚠ │ ✓ │ ┼ │ ✓ │ ✓ │   0   │║
║ SUBJECT    │ │ austender_contracts  │ 824K  │ …    │  8d │  4  │ ✓ │ ✓ │ ✓ │ ┼ │ ✓ │ ✓ │   1   │║
║ ☐ justice  │ │ ⛔abr_registry        │20.0M  │6.9GB │ DEF │  0  │ ✓ │ ┼ │ ✓ │ ┼ │ ┼ │ ┼ │   0   │║
║ ☐ money    │ │ ▎ 20M rows · zero app references · feeds no question · deferred_too_large       │║
║ ☐ …        │ │ ⛔asic_name_lookup    │ 2.1M  │ …    │  ?  │  0  │ ✓ │ ┼ │ ┼ │ ┼ │ ┼ │ ┼ │   0   │║
║            │ │ ▎ zero references anywhere — app, script, DB function, trigger or view lineage   │║
║ STATE      │ │ ┼abs_indigenous_pop… │     0 │  8kB │  —  │  0  │ ┼ │ ┼ │ ✓ │ ┼ │ ┼ │ ┼ │   1 ⚑ │║
║ ☐ live     │ │ ▎ EMPTY · blocks OVER-REPRESENTATION · fix = one CC-BY-4.0 download [ WANT → ]  │║
║ ☐ empty 88 │ └──────────────────────┴───────┴──────┴─────┴─────┴───┴───┴───┴───┴───┴───┴───────┘║
║ ☐ backup 14│                                                                                     ║
║ ☐ stale    │ DERIVED · 98 matviews         ⚠ 71 in NO refresh registry · 2,871,838 rows          ║
║            │ LENSES · 212 views            ⚠ 132 have no reference anywhere · 26 return 0 rows   ║
║ GAPS       │ ROUTINES · 409 functions      ⚠ 3 SECURITY DEFINER are anon-executable, all write   ║
║ ☐ feeds 0  │                                                                                     ║
║   1,365    │ ✓ satisfied  ⚠ degraded  ┼ GAP (click to fix)  ⛔ cruft  DEF deferred (too large)   ║
║ ☐ no purp. │                                                                                     ║
║ ☐ no refr. │ EXCLUDED FROM THIS VIEW: 238 ACT private-business objects. Not hidden — scoped.     ║
║ ☐ unmonit. │ ▸ open the scope register                                                           ║
║ ☐ anon-rd. │                                                                                     ║
║   451      │ [ EXTRACT ▾ ]  CSV · SQL IN-list · open in the join map · save this view             ║
╚════════════╧═════════════════════════════════════════════════════════════════════════════════════╝
```

**Four ranked strips, not one flat list** — Sources / Derived / Lenses / Routines. Measured
justification: views carry zero bytes and low degree, so a single `importance`-sorted list is 100%
tables and matviews for its first 182 rows, and the highest-ranked view is #183 **[R:
clarity-data-layer §4.2]**. That is a measured design constraint, not a taste call.

**The `FEEDS` and `BLOCKS` columns are the whole difference.** `FEEDS 0` sorted ascending, filtered
to `rows > 1,000,000`, is a two-click answer to "what enormous thing am I not using": today that
returns `abr_registry` (20.0M), `asic_name_lookup` (2.1M), `privacy_audit_log` (1.28M) — the three
objects VERIFICATION confirmed have zero references of any kind **[R]**.

**Lenses, per dbt Explorer** — one layout, N encodings swapped over it, preserving the reader's
learned mental map **[R: research-dashboards §2.2]**: `feeds · rows · bytes · freshness · gaps ·
anon-readable · repo`.

**Colour semantics, one meaning each, no exceptions:**

| Colour | Meaning | Example today |
|---|---|---|
| **Black** `#121212` | present, fine | default row |
| **Red** `#D02020` | the data is wrong or absent | 88 empty · 14 backup tables (1,541,951 rows) · contaminated columns · tripped sentinels |
| **Yellow** `#F0C020` | a deliberate refusal or a known limit | 34,223 entities with a postcode and no LGA — the rebuild **refused to be confidently wrong**. `HONEST AT: STATE` chips |
| **Blue** `#1040C0` | we don't know about our own data | no purpose · **unmonitored** matview (54 never logged) · unmeasured coverage · the `┼` gap glyph |

Red is data; blue is metadata; yellow is a decision. Conflating them is what makes catalogs feel
accusatory **[R: research-dashboards §4.5]**. **No green anywhere as a health signal** — the
palette has none, which is an accidental deuteranopia win. DESIGN.md's `#059669` stays confined to
its documented job (positive financial values in tables) and never signals status.

**Freshness has three badges, not two** — FRESH / STALE / **UNMONITORED**. 54 matviews have never
appeared in `mv_refresh_log` **[V: 44 of 98 logged, latest 2026-08-13]**. Rendering them as stale
would be a guess; rendering them blue says *we do not know*, which is the truth and a different fix.

---

## 8. Screen 5 — `/clarity/data/[object]` · THE DOSSIER

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ THE LEDGER    justice_funding                                    TABLE · D8 · CORE_SOURCE      ║
║ 157,116 rows · exact · written 14 AUG 09:22 · importance 0.930 · rank #2 of 1,433                ║
║                                    [ KEEP ] [ SUSPECT ] [ CRUFT — reason required ]              ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════╣
║ ANSWERS 6 QUESTIONS                                    BLOCKS 1                                  ║
║  ▸ THE EVIDENCE GAP        binding join, 93.65%         ▸ YOUTH JUSTICE MONEY    ⚑ contested     ║
║  ▸ AFTER RELEASE                                          measure_kind mixing inflates the       ║
║  ▸ WHOSE MONEY, WHOSE PLACE                               topic total 45.3×                      ║
║  ▸ EVERY DOLLAR                                                                                  ║
║  ▸ DISADVANTAGE, NO MONEY  ⚑ contested                                                           ║
║  ▸ WHAT THIS ORG RECEIVED  ⚑ contested                                                           ║
╠═══════════════════════════════╤══════════════════════════════════════════════════════════════════╣
║ COLUMNS (n)  JOINS (45)  CODE (133 files)  HISTORY  SAMPLE  DEFINITIONS                          ║
╟──────────────────────────────────────────────────────────────────────────────────────────────────╢
║ ⚑ CONTESTED DEFINITION — this object has 2 live definitions of one concept                       ║
║   "justice funding, cleaned"                                                                     ║
║     view justice_funding_clean (sector <> 'procurement')  = 151,866 rows                         ║
║     measure_kind = 'grant'                                = 126,673 rows / $46.097bn             ║
║   Gap: 25,193 rows.  Registered in clarity_metric_definition.  Canonical: measure_kind='grant'.   ║
╟──────────────────────────────────────────────────────────────────────────────────────────────────╢
║ COLUMNS                                        nullity ▁▁█▁▁▁▁▂▁▁▁▁                              ║
║  gs_entity_id     uuid    → gs_entities.id     ████████████████████▒▒  93.65% · BINDING          ║
║  measure_kind     text    4 distinct           ⚑ grant 126,673 · contract_value 29,519 ·         ║
║                                                  expenditure_aggregate 848 ($66.126bn) ·         ║
║                                                  budget_announcement 76                          ║
║  topics           text[]  GIN                  ⚠ hyphens, not underscores                        ║
║  amount_dollars   numeric                      ⚑ MIXES THREE INCOMPATIBLE MEASURES               ║
║  …                                             virtualised past 50 columns                       ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
```

The `ANSWERS / BLOCKS` band at the top is the backwards index. It is the answer to the question a
catalog row can never answer on its own — **what is this FOR** — and it is derived entirely from
`clarity_question_ingredient` and `clarity_question.blocked_by`. No human writes it.

`CRUFT` requires a written reason (Alation's rule **[R]**), and the schema already carries the
guard: *no `cruft` verdict while `refs_app` / `refs_script` / `refs_db_function` / `lineage_in` are
non-zero* **[R: clarity-data-layer §3.2]** — the constraint that encodes the 19-live-objects error
so it cannot recur.

---

## 9. Screen 6 — `/clarity/joins` · THE JOIN MAP

Behind a **RENDER** button, per dbt **[R: research-dashboards §2.3]**. Node budget **≤150**, per
Ghoniem et al. (matrix beats node-link above ~20 nodes; node-link only wins on path-finding) and
van Ham & Perer (a 2-hop neighbourhood in a graph this shape is 2,345 nodes and *"impractical to
visualize using a node link diagram"*) **[R: research-visualization §2.2]**.

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ CLARITY ▸ THE JOIN MAP        LENS ▾ FEEDS · freshness · coverage · domain · anon-readable     ║
║ SEED [ gs_entities ▾ ]  DEPTH ●──○──○  1   SIZE ├───●──────┤ 120        [ RENDER ]               ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                  ║
║                    ╔═══════════════╗                    ● size    = questions fed                ║
║          ╭─────────╢  gs_entities  ╟─────────╮          ● fill    = black, feeds ≥1              ║
║          │  abn    ║   FEEDS 9     ║  uuid   │          ○ hollow  = feeds 0 (1,365 of them)      ║
║          │         ╚═══════╤═══════╝         │          ┼ blue    = empty / blocks a question    ║
║     ╔════▼═════╗   ╔═══════▼══════╗   ╔══════▼═════╗                                             ║
║     ║ acnc_ais ║   ║justice_fund. ║   ║ austender_ ║    ── fk        ┄┄ measured join            ║
║     ║ FEEDS 3  ║   ║  FEEDS 6     ║   ║ contracts  ║    ═══ binding join of a question           ║
║     ╚══════════╝   ╚═══════╤══════╝   ║  FEEDS 4   ║                                             ║
║                            ┊ ✗        ╚════════════╝    ✗ = a declared edge that does not        ║
║                    ╔═══════▼══════╗                         resolve.  gs_relationships           ║
║                    ║gs_relations. ║  ⚠ source_record_id     .source_record_id: 0 of 200,000      ║
║                    ║  FEEDS 0     ║     DEAD KEY            sampled.  A dead key namespace.      ║
║                    ╚══════════════╝                                                              ║
║                                                                                                  ║
║     ○ abr_registry 20.0M · FEEDS 0        ○ asic_name_lookup 2.1M · FEEDS 0                      ║
║     ○ privacy_audit_log 1.28M · FEEDS 0   … 1,362 more hollow rings, off-canvas                  ║
║                                                                                                  ║
║  SHOWING 118 of 1,433.  Deterministic filter: objects that feed ≥1 question, plus 1 hop.         ║
║  Not a sample.                                                                                   ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════╣
║ SELECTED ▸ justice_funding   157,116 rows · 45 edges · feeds 6 questions · blocks 1              ║
║ [ dossier ] [ the 6 questions ] [ browse rows ] [ copy SELECT ]                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
```

Two things this does that a domain-coloured schema graph does not:

1. **Node size and fill encode question participation.** The map becomes a picture of *where the
   value is*, and the hollow rings are the opportunity. `abr_registry` is the largest object in the
   database, sits at rank 56 by importance, and feeds nothing.
2. **A dead edge renders as a dead edge.** `gs_relationships.source_record_id` is drawn with a `✗`
   and a dotted line. Every "click an edge to see the grant" feature in the product is unbuildable
   until that key is rebuilt **[R, V38]**, and this is the only place in either app where that fact
   is visible rather than discovered at runtime.

Implementation: `joins/page.tsx` is a Server Component that fetches `{nodes, edges}` from
`/api/clarity/inventory`; `joins/join-map-client.tsx` is `"use client"` and holds the
`next/dynamic` import of `react-force-graph-2d` — never in the Server Component. Extends the
orphaned `/api/data/schema-graph` route by deleting its 70-entry `TABLE_DOMAIN` hard-filter (which
silently drops 742 of 812 objects) and replacing `pg_stat_user_tables.n_live_tup`, which is broken
on this instance **[R, V5/V6]**.

---

## 10. Screen 7 — `/clarity/wants` · THE WANT LIST

Every row is derived from a blocked question. Nothing is hand-typed.

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║ ◀ CLARITY ▸ THE WANT LIST        7 BLOCKED QUESTIONS · 4 fixes of effort S                       ║
║ ranked by  questions unlocked × dollars made legible ÷ effort           FILTER ▾ effort · licence║
╠═══╤══════════════════════════════════╤═════════╤════════╤═══════════════════════════════════════╣
║ 1 │ ABS Indigenous population by LGA │ EFFORT S│ CC-BY  │ ┼ abs_indigenous_population_by_lga     ║
║   │                                  │         │  4.0   │   is EMPTY.  One download.            ║
║   │ UNLOCKS  OVER-REPRESENTATION + 3 more, and every per-capita Indigenous rate below state.     ║
║   │ WITHOUT IT  no Indigenous-focused map in either app is honest.                               ║
╟───┼──────────────────────────────────┼─────────┼────────┼───────────────────────────────────────╢
║ 2 │ Repair 3 board matviews          │ EFFORT S│  none  │ ┼ mv_board_contractor_links   4 rows   ║
║   │                                  │         │        │ ┼ mv_board_donor_links        2 rows   ║
║   │                                  │         │        │ ┼ mv_multi_board_persons      1 row    ║
║   │ …against mv_board_interlocks at 39,757 rows with the same columns.  A predicate bug.         ║
║   │ UNLOCKS  DIRECTORS AND CONTRACTS + DIRECTORS AND DONORS — two flagship cross-sections.       ║
╟───┼──────────────────────────────────┼─────────┼────────┼───────────────────────────────────────╢
║ 3 │ Backfill 30,129 GrantConnect ABNs│ EFFORT S│ public │ MAKES LEGIBLE  $11.83bn / 68,175 awards║
║   │ from abr_registry                │         │        │ 99.97% of these ABNs exist in the ABR. ║
║   │ Long-tail small recipients — the mission population.  $174k avg vs $928k for linked.         ║
╟───┼──────────────────────────────────┼─────────┼────────┼───────────────────────────────────────╢
║ 4 │ Two data-integrity sentinels     │ EFFORT S│  none  │ MAKES PUBLISHABLE  GIVES AND TAKES     ║
║   │ receipt_type + $5bn ceiling      │         │        │ Fixes an 8× donation overstatement and ║
║   │                                  │         │        │ a 29.4%-of-total outlier exposure.     ║
╟───┼──────────────────────────────────┼─────────┼────────┼───────────────────────────────────────╢
║ 5 │ Rebuild gs_relationships         │ EFFORT M│  none  │ ✗ source_record_id: 0 of 200,000       ║
║   │ .source_record_id                │         │        │   sampled resolve.  Dead key namespace.║
║   │ UNLOCKS  "click an edge, see the grant" everywhere in the product.                           ║
╟───┼──────────────────────────────────┼─────────┼────────┼───────────────────────────────────────╢
║ 6 │ BOCSAR + WA + TAS crime data     │ EFFORT M│ mostly │ ┼ crime_stats_lga: WA 0 rows, TAS 0    ║
║ 7 │ ABS SA2 boundaries               │ EFFORT M│  open  │ ┼ sa2_code on 14.4% of gs_entities     ║
╚═══╧══════════════════════════════════╧═════════╧════════╧═══════════════════════════════════════╝
   AEC post-reform disclosures (1 Jul 2026: $5,000 threshold, 24-hour disclosure in election
   periods) is the only item with a DEADLINE.  It is not blocking a question today, so it does not
   appear above — it is tracked separately.        [ show non-blocking roadmap items ]
```

This screen is the coverage bar, inverted. Same underlying facts as "31% CONNECTED"; the difference
is that every row here reads as an opportunity with a price and a payoff.

---

## 11. What this direction handles WORSE than the alternatives

Six things, stated plainly. A judged panel should weigh these against §1.

**1. Schema archaeology is one click deeper, and that is Ben's literal request.**
Ben said *"an overview page that lists absolutely every piece of data in dashboard format."* I put
26 question cards on screen one and one line summarising 1,433 objects. An inventory-first design
puts all 1,433 on screen one. Someone asking *"can I drop `mv_person_network`?"* starts at
`/clarity/data`, not the front door. I believe the trade is right — but it is a deliberate refusal
of half a stated requirement, and it should be argued, not glossed.

**2. Curation debt. This is the strongest argument against me.**
The registry needs ~26 hand-written questions, each with a caveat, a claim phrasing, a uniqueness
basis and hand-authored SQL. That is exactly Grover's "Catalog Ghost Town" failure mode aimed at my
design: *"even if you somehow convinced others to add documentation, once it's added, it quickly
becomes out-of-date"* **[R]**. Mitigations: the seed already exists in machine-readable form
(OPPORTUNITY-MAP's 16 questions + N1–N10 = 26 rows); every *blocked* question is auto-derived from
a `clarity_gap_metric`; and the `caveat NOT NULL` / `executable_or_blocked` constraints make a
half-written question fail to insert rather than rot silently. But an inventory-first design has
**zero** curation debt because every column is derived, and that is a real advantage it holds over
mine.

**3. A question can go silently wrong in a way a row count cannot.**
If someone changes `justice_funding.measure_kind` semantics, my `answer_sql` keeps returning a
number and the card keeps looking healthy. `row_count = 157,116` cannot lie like that. I mitigate
with sentinels, answer history, and a delta alarm on the board — but I am adding a failure mode
that the alternatives do not have, and it is the more dangerous kind because it is confident.

**4. Estate coverage on the front screen is genuinely worse.**
26 questions touch roughly 60–80 objects. The other ~1,350 are invisible until you open the ledger.
If the actual job this week is "reconcile the matview refresh registries" (Ben's decision 2) or
"decide the 46 ACT borderlines", the Interrogator's front door is the wrong front door and the
ledger is where you should have landed.

**5. It is more code and slower to first value.**
BUILD-SPEC's slice 1 ships in ~2 days because the domain seed already exists. Mine needs the
registry, the answer-runner, the sentinel framework and the form components before the board has
anything to show. Honest slice 1: **3 questions end to end** (`evidence-gap`, `bidder-fragility`,
`watchhouse-children` — all three measured under 300 ms today **[V]**) plus the ledger, in ~4 days.
Do not attempt 26 in slice 1.

**6. Legal surface.**
A board that leads with *"which entities give money to political parties and take money from
government"* is a sharper object than a table list. OPPORTUNITY-MAP calls it *"simultaneously the
most publishable and the most defamation-sensitive question in the database."* I handle it with
`publishable`, `defamation_sensitive` and the sentinel block that refuses to render the number —
but the exposure exists because I chose to make claims the primary object, and an inventory has no
such exposure.

**7. One thing I do *not* concede.**
The alternatives will offer "opportunity" or "gap" as a *column* or a *screen* hanging off the
inventory. That inverts the priority: it makes the finding a property of the schema rather than the
schema a property of the finding. Ben's stated end is *"find opportunities"* and his stated vision
is *"cross-sections of all of it in a way no one else does."* Cross-sections are the product. The
schema is the parts bin.

---

## 12. Build order

| Slice | Days | What | Ships value on its own |
|---|---|---|---|
| **1** | ~4 | Registry migration (unapplied → Ben applies) · `run-clarity-answers.mjs` · **3 questions end to end** · the board · the worked-answer page with `ranked_bar` + `scalar` | Yes — three findings nobody else in Australia can compute, each with its provenance |
| **2** | ~2 | `/clarity/data` — the full 1,433-row ledger with the coverage matrix, `FEEDS`/`BLOCKS`, four strips, lenses | Yes — this is BUILD-SPEC's slice 1, and it satisfies "absolutely everything" |
| **3** | ~2 | `/clarity/data/[object]` dossier with the backwards index · `/clarity/wants` derived from blocked questions | Yes — the want list is the artefact Ben acts on |
| **4** | ~2 | Seed the remaining 23 questions · sentinels · `timeseries` with the sample-size track · `matrix` · `refused` | Yes — the board fills out |
| **5** | ~2 | `/clarity/joins` (extend the orphaned `schema-graph` route) · lenses | |
| **6** | ~2 | `hexmap` (static hex TopoJSON, one-off offline asset) · `sankey` (**justify `d3-sankey` here, not before**) | |

Zero new dependencies through slice 5. Every screen reads snapshot tables; no page load touches
`gs_entities`, `gs_relationships`, `austender_contracts` or `abr_registry`.

---

## 13. Confidence register

**Verified by me, this session [V]:** the evidence-gap query reproduces exactly (662/778 orgs,
$663.9m of $1,142.1m) in **279 ms**; the charity-fragility tiers with **median** months of reserves
(fragile 773 / 530 in deficit / **median 0.9 months**; watch 1,776 / 1,460 / 8.7; healthy 3,124 /
0 / 14.6) in **196 ms** — a correction to OPPORTUNITY-MAP's mean-based 1.1; the interlock rollup
(41,614 distinct orgs, 5,359 with a rollup, $63.04bn) in **3,076 ms**, which is the measurement
that puts it on the snapshot-only side of the line; `mv_refresh_log` holds **44 distinct matviews,
latest 2026-08-13**; and the existence of all 25 objects my seed questions depend on, with their
`reltuples` (which are visibly stale on small tables — `data_catalog` reports 22 against an actual
25, `qld_watchhouse_snapshots` 160 against 201 — confirming the `row_count_is_estimate` flag earns
its place).

**Relayed and cross-checked against `VERIFICATION.md` [R]:** every figure in §4's seed table; the
justice 45.3× inflation (V17); the `political_donations` 72.1% rows / **85.3%** dollars (V20/V21,
corrected from 88.6%); the AusTender outlier bands and the **Hays $123.00bn** exemplar (V22/V23,
corrected from Gilbert and Tobin); the GrantConnect $11.83bn with its declared denominator
(V24/V25); the dead `source_record_id` key namespace at **100%**, not 82% (V38); the
`mv_funding_deserts` grain at **1,130** name|state pairs with the prescribed `GROUP BY` **not**
resolving it (V39); `grants_total` **exactly zero** across 94,088 rows (V30); the watchhouse
rebaseline off May n=59 (V§4); the 19 live-referenced objects wrongly marked for deletion (V§2);
the 1,433-object universe, the 4.5-minute sweep budget, the `SET LOCAL` no-op proof and the 8 s
ceiling proof (clarity-data-layer §1–§2); all installed-library versions; and every design-research
citation.

**Inferred, marked as such [I]:** that the board query is sub-50 ms (it reads only registry tables,
but those tables do not exist yet); that ~26 questions total under a minute (extrapolated from
three measurements spanning 196 ms to 3,076 ms); the REACH weights, which are judgement calibrated
against the seed, not a derived constant.

**Not checked:** I did not render anything in a browser. I did not apply any migration. I did not
run the SQL for the 12 seed questions I did not personally execute (5, 6, 7, 8, 9, 10, 11, 12, 13,
14, 15, 16) — their numbers are relayed with their original verification markers. I did not verify
the `two-purses` 22.8% figure, which `VERIFICATION.md §9` also lists as unverified, which is why it
ships with an UNVERIFIED stamp rather than a silent number. I did not check whether
`abs_indigenous_population_by_lga` is still empty today — the want-list ranking assumes it is.
`d3-sankey`'s bundle cost in a Next 15 / React 19 tree is unverified; that is a slice-6 problem.
