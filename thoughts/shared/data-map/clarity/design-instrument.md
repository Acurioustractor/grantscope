# /clarity — THE INSTRUMENT

**A control room for a living system.** Six boards, one persistent watch strip, one keyboard.
Written 2026-08-14 for `/Users/benknight/Code/grantscope`, app at `apps/web`.

Binding: `DESIGN.md` (Civic Bauhaus), `CLAUDE.md` (Server Components by default, in-app not CLI,
bulk SQL not API loops), the honest visualization ceiling (30–150 nodes on screen), the ACT
exclusion, and the rule that absence gets a glyph and an organisation never "has no evidence".

Verification key: **[V]** I ran the query or read the file this session · **[R]** relayed from a
document in this exercise that marked it verified · **[I]** my inference · **[U]** unverified.

---

## 0. The one-paragraph answer

`/clarity` is not a catalog you read, it is an instrument you run. Six boards —
**BOARD · LEDGER · SEAMS · DEFECTS · BENCH · TAPE** — switched with number keys, sharing one
persistent health strip and one baseline selector. Every number on every board carries its delta
against a selectable baseline (last scan / 7d / 30d / 90d), because in a system with 5 cron jobs,
~50 agents, 98 matviews and 20M rows of external registry churn, **the state is not the signal —
the derivative is**. The complete list Ben asked for is the LEDGER, all 1,433 objects and all
14,310 columns, no pagination, no hiding. The gaps he asked for are not blank cells but 23 measured
metrics with thresholds that fire. The cross-sections he asked for are not a future phase but
BOARD 5, a typed registry where every question carries the named ways it lies. Two libraries used,
one 3KB dependency added, zero maps — because `/clarity` does not host the visualisations, it
commissions and monitors them.

---

## 1. THE ARGUMENT — why an operator's instrument, not an explorer's atlas

The alternative direction is a good one and I want to state it fairly. The atlas says: the user
does not know what is in there, so give them overview → zoom → filter → details, make the corpus
browsable, make the structure beautiful, let discovery happen. Shneiderman's mantra, Amundsen's
IA, dbt's lenses. That is the right answer for a data catalog serving an organisation.

It is the wrong answer here, for six reasons, five of which are measurements rather than opinions.

### 1.1 The corpus is 1,433, not 200,000. Discovery finishes; operation does not.

Airbnb built Dataportal because it had **"more than 200,000 tables in Hive"** [R:
research-dashboards §2.3]. Ranking-by-popularity, search-first landing and PageRank exist because
no human could ever see that corpus. Ben can see all 1,433 objects in an afternoon — the LEDGER
below shows them in about 60 screens of scroll, and the ranked top 30 [R: clarity-data-layer §4.3]
already covers every pillar he named.

So the atlas's central job — *making an unseeable corpus navigable* — is a one-week job here.
Day two onwards, the question is never "what is in there". It is **"what moved, what broke, and
what did I lose"**. The atlas has no answer to that question. It renders the current frame
beautifully and tells you nothing about the film.

### 1.2 This database has already lost data silently, three times, and nothing noticed.

This is the load-bearing argument and it is a fact, not a hypothetical.

| Object | Then | Now | Change | Did anything fire? |
|---|---|---|---|---|
| `justice_funding` | 218,022 (2026-04-02) | **157,116** | **−60,906 rows, −28%** | No [R] |
| `gs_relationships` | 1,530,000 (2026-04-02) | 3,429,184 | +124% | No [R] |
| `political_donations` | 302,000 (2026-04-02) | 2,549,483 | +744% | No [R] |

The April `db-inventory.md` was the best data map anyone here has ever written — 572 lines,
63 tables, real breakdowns [R: existing-surfaces §1e]. It went stale in four months and **nothing
failed**. `COMPENDIUM.md` and `data/schema-cache.md` did the same. Three markdown maps, three
silent rots [R: existing-surfaces §6].

An atlas built today would render `justice_funding = 157,116` perfectly and correctly, and would
have been just as blind to the moment 60,906 rows left. An instrument shows
`157,116  ▼60,906 since 02 APR` in red, on the front board, forever, until someone writes the
reason down. That is the entire difference and it is worth the whole design.

### 1.3 The machine is measurably unhealthy right now, and an atlas has nowhere to put that.

Run this session, against the live database:

```
agent_runs, last 7 days      [V]        mv_refresh_log, latest per matview   [V]
  success    187  (50 agents)              ever logged      44 of 98
  timed_out   41  (16 agents)              last status ok   39 of 44
  failed      14  (11 agents)              last finish      2026-08-13 17:30 UTC
  partial     10
  running      3            → 74% success
```

Plus, measured by the data-layer pass [R: clarity-data-layer §5]: **70 of 98 matviews stale >48h**;
**54 never logged a refresh at all**; **4 fall back from `CONCURRENTLY`** and take an
`ACCESS EXCLUSIVE` lock nightly for want of a unique index; **71 of 98 in no scheduled refresh**;
5 pg_cron jobs of which exactly one refreshes matviews.

That is an operations problem wearing a catalog's clothes. It is not a footnote to "what data do
we hold" — on any given morning it is the *answer* to "can I trust what I'm about to read". The
atlas genre has no slot for it. The instrument puts it in a strip across the top of every board,
eight cells wide, always visible, and it is the first thing you read.

### 1.4 DESIGN.md commissioned a terminal, in writing.

> "Authoritative, precise, serious. This is accountability infrastructure with teeth — **a
> Bloomberg Terminal designed by the Bauhaus school.** Not friendly, not playful, not
> 'approachable.' Rigorous." — `DESIGN.md`, Aesthetic Direction

> "Grid-disciplined — strict columns, predictable alignment. **Data density is a feature.**"
> — `DESIGN.md`, Layout

A Bloomberg terminal is not a browsing surface. It is six panes of numbers that a professional
reads at speed, every day, looking for the one that moved. The house style is not decoration on
top of an atlas — it *is* the instrument genre, already chosen, already documented, already
enforced by `border-radius: 0 !important`. Building an explorer's atlas in Civic Bauhaus means
fighting the design system for the whole build. Building an instrument means the design system
does the work for free.

The `.ws` workspace theme — 1px borders, subtle shadow, Satoshi 700 not 900, reduced tracking
[V: `globals.css:116`] — exists *specifically* for "operational/internal tools". It has been
sitting there waiting for this surface.

### 1.5 Ben's own recorded workflow is an operator's day, not an explorer's.

From the project's own instructions and memory: `/preflight` at session start → work → `/close`
at session end. `/health` is already a registered skill: "Data + agent + scheduled-job health
dashboard — entity coverage, MV status & staleness, pg_cron job failures, agent success rates".
Memory records the taste: **"desk-centric, rail-owns-filters, plain words, kill label stacks"**
and **"explicit action menus — never 'say the word'"**.

A desk is an instrument. A daily preflight is a watch strip. `/clarity` as designed here is the
screen that `/preflight` and `/health` have been approximating in a terminal for months.

### 1.6 The gaps he wants are open work items, and a static hole does not get closed.

"44% documented" is a fact. It is also inert — it will read 44% next month and nobody will feel
anything. What changes behaviour is:

```
PURPOSED   812 / 1,433   56.7%   ▲ +0 in 30d      621 to go   at 0/wk: never
```

That last clause is the whole reason to build an instrument. Coverage as a **burn-down with a
velocity and an ETA** turns a metric into a decision. The atlas's `+` glyph makes the hole
visible; the instrument's `+0 in 30d · never` makes it *urgent*. Absence needs a glyph **and a
trend**, and the trend is the half that does the work.

### 1.7 What this argument does not claim

It does not claim the atlas is wrong in general, or that discovery does not matter. Section 9 is an
honest list of five things the atlas direction does better than this one, including one — the
first-month cold start — that is a genuine structural weakness of my design and not a trade I can
argue away.

---

## 2. ROUTES AND FILES

```
apps/web/src/app/clarity/
├── layout.tsx                   admin gate · .ws theme · WATCH STRIP · COMMAND BAR · board tabs
├── page.tsx                     BOARD 1 · THE BOARD          (one screen, no scroll)
├── ledger/page.tsx              BOARD 2 · THE LEDGER         (1,433 objects / 14,310 columns)
│   └── ledger-client.tsx        "use client" — the list island: keyboard, facets, lens, extract
├── seams/page.tsx               BOARD 3 · THE SEAMS          (every join as a row)
│   └── seam-graph-client.tsx    "use client" — react-force-graph-2d, ≤140 nodes, behind `g`
├── defects/page.tsx             BOARD 4 · THE DEFECTS        (23 metrics, thresholds, firings)
├── bench/page.tsx               BOARD 5 · THE BENCH          (16 cross-sections)
│   └── [section]/page.tsx       one cross-section, live, with its sentinels
├── tape/page.tsx                BOARD 6 · THE TAPE           (everything that changed)
├── o/[key]/page.tsx             OBJECT PANEL, permalink (server-rendered, shareable, printable)
└── components/                  watch-strip · spark · delta · glyph · coverage-bar · heat-block
                                 domain-tile · estate-bar · seam-row · sentinel-chip · event-line

apps/web/src/app/api/clarity/
├── object/[key]/route.ts        GET one object dossier as JSON (~15 KB) — feeds the docked panel
├── section/[key]/route.ts       POST run one bench section live, returns rows + sentinel verdicts
└── watch/route.ts               POST pin / unpin / set threshold

apps/web/src/lib/clarity/
├── types.ts                     ClarityObject · Delta · Seam · Metric · Event · CrossSection
├── glyphs.ts                    THE ALPHABET — the ten glyphs and their exact semantics
├── domains.ts                   14 domains: key, label, colour band, order, blurb
├── sections.ts                  THE BENCH REGISTRY — 16 typed cross-sections (content in code)
├── read.ts                      server reads: getBoard(), getLedger(), getSeams(), getTape()…
└── baseline.ts                  the four baselines and the "history is thinner than this" rule

apps/web/src/__tests__/clarity/
├── bench-registry.test.ts       fails CI on: empty caveat · zero sentinels · unknown `reads`
│                                object · coverageFloor > measured rate without state 'blocked'
└── glyph-coverage.test.ts       fails CI if any renderer can emit an empty cell
```

**Nav.** Not in `components/nav.tsx` (the 42-link public nav). Admin strip only, beside `/ops` and
`/mission-control`, behind `requireAdminPage` [V: `src/lib/admin-auth.ts:40`], exactly as
`/ops/layout.tsx` does. The 2026-04-24 decision that killed `/clarity` was
*"kill SaaS-shaped surfaces"* [R] — an admin instrument honours that decision rather than
quietly reversing it.

**Client boundary.** Three `"use client"` files total: the ledger list island (justified: keyboard
navigation and in-memory filtering of 1,433 rows at <100 ms, which is a genuine interaction), the
seam graph host, and the docked object panel's fetcher (inside the ledger island). Everything else
— the shell, the watch strip, all six board bodies, the object permalink, the bench sections — is
a Server Component reading through `getDirectServiceSupabase()`. No `next/dynamic` anywhere; the
force graph lives in a client file that a client parent imports normally.

---

## 3. THE ALPHABET — ten glyphs, one meaning each, no empty cells ever

This is the single most important spec in the document. Everything else is layout.

| Glyph | Colour | Means | Never means |
|---|---|---|---|
| `·` | black | measured, nominal | zero |
| `▲` `▼` | black, or **red** if the direction is bad | moved since baseline | — |
| `⊕` | black outline | **new** since last scan | — |
| `⊖` | **red** | **disappeared** since last scan (`missing_since` set) | deleted-and-fine |
| `+` | **blue** | **GAP** — we have not done this yet. Clickable; it is the affordance to fix it | the data is bad |
| `?` | **yellow** | **UNMEASURABLE** — probe timed out, no candidate column, history too short | zero |
| `≈` | yellow superscript | estimate, not an exact count (6 objects ≥2M rows [R]) | — |
| `⛔` | **red** | cruft / dead key / refuses to render, with a written reason | unused |
| `▮` | black | sentinel armed, holding | — |
| `▰` | **red** | **sentinel FIRED** — the number on screen is known to be wrong | — |
| `○` | blue outline | declared but not live (the `atlas/layers.ts` pattern) | empty |

**Three rules that follow, and they are hard:**

1. **`+` and `?` and blank are three different states and must never collapse.** `+` is our
   omission (fixable by us, blue). `?` is a physical limit (the probe cannot establish it, yellow).
   Blank is banned — `glyph-coverage.test.ts` fails the build if any cell renderer has a code path
   that returns empty. This is the "absence must be visible" constraint made structural instead of
   remembered.
2. **Red = the data is wrong or lost. Blue = our documentation is missing.** [R:
   research-dashboards §4.5] Conflating them is what makes catalogs feel accusatory and get
   ignored.
3. **No green.** `DESIGN.md` defines `#059669` for success/money, and I am deliberately not using
   it on this surface. Reason: red/green is the classic deuteranopia failure and Few's Pitfall #12
   [R], and in an instrument every cell is a state cell so the failure would be everywhere.
   Improvement is a **black** `▲` beside a black number; degradation is a **red** `▼`. Direction is
   carried by glyph, magnitude by the number, severity by colour-presence. Three channels, no hue
   pairs. This is a stated deviation from DESIGN.md's semantic palette, scoped to `/clarity`, with
   the reason recorded here.

**Typography (per DESIGN.md, with one instrument-specific rule).** Every number in `/clarity` is
JetBrains Mono, `tabular-nums`, 11px — not DM Sans. DESIGN.md assigns JetBrains Mono to
"ABNs, GS-IDs, technical identifiers". On an instrument, **a figure is an identifier**: you find
the row that moved by scanning a column of digits, and that only works if the digits align.
Labels: Satoshi 700, 10px, uppercase, 0.1em tracking. Prose: DM Sans 13px. Row height 22px on the
ledger and tape, 26px on seams.

---

## 4. THE PERSISTENT CHROME — watch strip, command bar, baseline

Rendered by `layout.tsx`. Identical on all six boards. 108px total.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CLARITY   [1]BOARD [2]LEDGER [3]SEAMS [4]DEFECTS [5]BENCH [6]TAPE      / command    ? keys          │
│ 1,433 OBJECTS · 714 TABLE · 98 MATVIEW · 212 VIEW · 409 ROUTINE · 52,349,579 ROWS · 28 GB           │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────────────────────┤
│ SCAN     │ PIPELINE │ MATVIEWS │ CRON     │ DEFECTS  │ MOVED    │ NEW/GONE │ BASELINE  [ ] to cycle │
│ 6h 12m   │ 187/252  │  28/98   │  5/5     │  9 of 23 │   41     │  ⊕3 ⊖0   │ ◀ LAST SCAN ▶          │
│ ·        │ ▼ 74%    │ ⛔ 70 stl│ ·        │ ▰ 2 FIRED│ ▲12 ▼29  │ ⊕        │ 7d · 30d · 90d         │
│ ▁▁▂▁▁▁▁▁ │ ▅▆▄▇▃▂▅▆ │ ▂▂▂▂▂▂▂▂ │ ████████ │ ▃▃▄▄▄▅▅▅ │ ▁▃▂▇▁▂▁▄ │          │ history: 1 night ?     │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴────────────────────────┘
```

Eight cells, each: label / value / state glyph / 30-day sparkline. Read left to right this says
*"the scan is 6 hours old, a quarter of agent runs failed, 70 matviews are stale, cron is fine,
9 defect metrics are over threshold and 2 sentinels have fired, 41 objects moved, 3 appeared"* —
in about one second, on every board, forever.

**Query** — one round trip, all catalog-sized, no big table touched:

```sql
WITH scan AS (
  SELECT max(refreshed_at) AS last_scan,
         count(*) FILTER (WHERE missing_since IS NULL) AS live_objects
    FROM clarity_object
), pipe AS (
  SELECT count(*)                                                   AS runs,
         count(*) FILTER (WHERE status = 'success')                 AS ok,
         count(DISTINCT agent_id)                                   AS agents
    FROM agent_runs WHERE started_at > now() - interval '24 hours'
), mv AS (
  SELECT count(*) AS logged,
         count(*) FILTER (WHERE finished_at > now() - interval '48 hours') AS current
    FROM (SELECT DISTINCT ON (mv_name) mv_name, finished_at, status
            FROM mv_refresh_log ORDER BY mv_name, started_at DESC) t
), cron AS (
  SELECT count(*) AS jobs, count(*) FILTER (WHERE active) AS active FROM v_cron_jobs
), defects AS (
  SELECT count(*) AS metrics,
         count(*) FILTER (WHERE m.breached) AS breached,
         count(*) FILTER (WHERE m.sentinel_fired) AS fired
    FROM v_clarity_metric_latest m
), moved AS (
  SELECT count(*) FILTER (WHERE row_delta <> 0)  AS moved,
         count(*) FILTER (WHERE row_delta > 0)   AS up,
         count(*) FILTER (WHERE row_delta < 0)   AS down,
         count(*) FILTER (WHERE is_new)          AS appeared,
         count(*) FILTER (WHERE is_missing)      AS gone
    FROM clarity_delta WHERE baseline = $1
)
SELECT * FROM scan, pipe, mv, cron, defects, moved;
```

Requires an index on `agent_runs(started_at DESC)` — **[U] not verified; assume it needs adding.**

**States.**
- *Never scanned:* every cell renders `?` in yellow and the strip's right end becomes a black card:
  `THE ESTATE HAS NEVER BEEN SCANNED · run scripts/snapshot-clarity.mjs · ~4.5 min · nothing on
  this page is guessed`.
- *Scan older than 26h:* the whole strip gets a 2px yellow top border and the SCAN cell reads
  `43h ⛔`. Numbers are still shown — they are true as of the timestamp — but never presented as
  current.
- *Any cell's query errors:* that cell alone renders `?` with the error on hover. The other seven
  render. Each cell is its own `<Suspense>` + error boundary. **A pane never takes the page down.**

**BASELINE is the most important control on the surface.** `[` and `]` cycle
`LAST SCAN → 7d → 30d → 90d`. It is a `searchParam` (`?base=7d`), it applies to every delta on
every board simultaneously, and when history is thinner than the selected baseline the option is
shown **greyed with its reason** (`30d — history begins 15 AUG, 3 nights`) and every delta cell in
the app renders `?`, never `0`. See §9.4 — this is the cold-start problem and it is handled by
telling the truth about it, not by drawing a flat line.

**COMMAND BAR (`/`).** One fuzzy input over four namespaces at once — 1,433 object names, 23 metric
keys, 16 section keys, ~20 verbs. Results are grouped and typed:

```
/ justice_
  OBJECT   justice_funding              157,116  ▼60,906   rank 2      → open panel
  OBJECT   justice_funding_clean (view) 151,866  ?         rank 183    → open panel
  OBJECT   mv_justice_charity_financial_health  5,898  ·               → open panel
  METRIC   justice_edge_drillthrough    0.0% of 49,426    ▰ FIRED      → defects
  SECTION  Q3 money to orgs with no evidence record linked  ▮ armed    → bench
  VERB     extract all objects matching "justice" as SQL IN-list
```

---

## 5. BOARD 1 — THE BOARD (`/clarity`)

**One screen. 1440×900. No vertical scroll.** This is the daily visit. If something matters and it
is not on this screen, the design has failed.

**The sentence only this board finishes:** *"Since yesterday, the estate gained ___, lost ___, and
the thing most worth my attention this morning is ___."*

```
[ persistent chrome — 108px, per §4 ]
┌────────────────────────────────┬──────────────────────────────────┬───────────────────────────────┐
│ THE ESTATE            base 30d │ DOMAINS · 13 civic + 1 unfiled    │ THE TAPE      last scan 03:14 │
│                                │                                   │                               │
│ PURPOSED   812/1433 56.7% +0   │ ┌──────────┐┌──────────┐┌───────┐│ 03:14 ⊕ stg_lga_probe         │
│ ██████████████░░░░░░░░░ never  │ │D2 REGIST ││D1 SPINE  ││D7 INFL││       new · 0 rows · unclassd │
│ GOVERNED    25/1433  1.7% +0   │ │ 30 obj   ││ 18 obj   ││28 obj ││ 03:14 ▲ austender_contracts   │
│ █░░░░░░░░░░░░░░░░░░░░░░ never  │ │ 23.4M    ││ 17.2M    ││ 2.86M ││       +2,481 (+0.30%)         │
│ FRESH≤30d  467/608  76.8% ▼11  │ │ ▁▁█▂▁▁▁▁ ││ ▁█▃▁▁▁▁▁ ││▁▂█▃▁▁▁││ 03:13 ▼ acnc_ais              │
│ ████████████████░░░░░░ 141 old │ │ ●●●○○○○○ ││ ●●●●●○○○ ││●●○○○○○││       ? probe timed out       │
│ JOINED     633/1024 61.8% ·    │ │ · 2 stale││ · nominal││⛔1 dead││ 03:12 ⛔ mv_person_network     │
│ █████████████░░░░░░░░░ 391 gap │ └──────────┘└──────────┘└───────┘│       stale 5d · no registry  │
│ READ        ... 1024   ▲+4     │ ┌──────────┐┌──────────┐┌───────┐│ 03:11 ▰ SENTINEL political_   │
│ ███████████░░░░░░░░░░░ 184 drk │ │D10 PLACE ││D13 PLTFRM││D3 MONY││       donations receipt_type  │
│ ANON-OPEN  451/1024 44.0% ·    │ │ 46 obj   ││104 obj   ││37 obj ││       89% non-donation ▰      │
│ ███████████░░░░░░░░░░░ ⛔ 3 fn │ │ 1.65M    ││ 1.44M    ││ 1.59M ││ 02:58 ▲ grantconnect_awards   │
│                                │ │ ▁▂▄█▁▁▁▁ ││ ▂▃▅█▂▁▁▁ ││▁▁█▄▂▁▁││       +812 (+0.28%)           │
│ SCOPE                          │ │ ●●●●○○○○ ││ ●●○○○○○○ ││●●●●●●○││ 02:58 ▼ justice_funding       │
│ CIVIC        1,195  shown      │ │⛔5 backup││ · nominal││· nomin││       −0 · watch: −60,906     │
│ UNCLASSIFIED    ?  +  flagged  │ └──────────┘└──────────┘└───────┘│       since 02 APR, no reason │
│ ACT-PRIVATE    238  hidden ⌄   │ ┌──────────┐┌──────────┐┌───────┐│ 02:57 · 44 matviews refreshed │
│ PLATFORM         ?  shown      │ │D8 JUSTICE││D6 PEOPLE ││D9 ALMA││       5 fell back non-concur  │
│                                │ │ 54 obj   ││ 24 obj   ││54 obj ││ 02:41 ▼ agent alma-media      │
│ KIND                           │ │ 253K     ││ 2.61M    ││61.7K  ││       timed_out (3rd in 7d)   │
│ TABLE   714 ·  MATVIEW  98 ⛔  │ │ ▂█▃▁▁▁▁▁ ││ ▁▃█▂▁▁▁▁ ││█▄▂▁▁▁▁││                               │
│ VIEW    212 +  ROUTINE 409 +   │ │ ●●●●●●○○ ││ ●●●●○○○○ ││●●●●●●●││ [ 6 · FULL TAPE → ]           │
│                                │ │⛔13-row  ││ · nominal││· nomin││                               │
├────────────────────────────────┤ └──────────┘└──────────┘└───────┘├───────────────────────────────┤
│ TOP DEFECTS         4 · ALL →  │ ┌──────────┐┌──────────┐┌───────┐│ THE BENCH        5 · ALL →    │
│ ▰ justice edge→grant  0.0% of  │ │D4 PHILAN ││D12 MEDIA ││D5 OPP ││ Q1 QLD watchhouse children    │
│   49,426 · DEAD KEY NAMESPACE  │ │ 36 obj   ││ 77 obj   ││37 obj ││    38.8 avg ▲3.0× since APR ▮ │
│ ⛔ 71/98 matviews unregistered  │ │ 379K     ││ 4,501    ││62.8K  ││ Q3 YJ money, no evidence rec  │
│   2,871,838 rows               │ │ ▁▁█▃▁▁▁▁ ││ █▁▁▁▁▁▁▁ ││▂█▄▁▁▁▁││    85% of orgs ▮ coverage 93% │
│ ⛔ donations ABN 25.1%  ▼      │ │ ●●●○○○○○ ││ ●○○○○○○○ ││●●●○○○○││ Q5 donor↔contractor  ▰ BLOCKED│
│ ▰ 3 SECDEF fns anon-executable │ │· nominal ││⛔over-mdl││· nomin││    2 sentinels fired          │
│ + 621 objects no purpose  ⊕    │ └──────────┘└──────────┘└───────┘│ Q6 funding deserts ▮ grain ⚠  │
│                                │ ┌──────────┐┌──────────┐┌───────┐│ Q7 67K awards, unknown ABNs ▮ │
│                                │ │D11 NDIS  ││ UNFILED  ││+ ACT  ││ Q9 foundation↔contract ▮      │
│                                │ │ 30 obj   ││ 621 obj  ││238 obj││ Q10 3+ influence systems ○    │
│                                │ │ 529K     ││ views +  ││hidden ││ Q16 NDIS ⛔ REFUSES: lga_code │
│                                │ │ ▁▂█▂▁▁▁▁ ││ routines ││ ⌄ show││      100% NULL — no LGA map   │
│                                │ │ ●●○○○○○○ ││ + + + +  ││       ││                               │
│                                │ │⛔lga NULL││+ NO DOMAIN││      ││ 9 RAN · 6 FEASIBLE · 1 BLOCKED│
└────────────────────────────────┴──────────────────────────────────┴───────────────────────────────┘
 scan 03:14 · 4m 21s · next 03:00 · 806 exact + 6 est + 18 probe-timeout · cost 92.7s count / 53.4s fresh
```

### Panels, components and queries

| # | Panel | Component | Server? | Query |
|---|---|---|---|---|
| 1 | THE ESTATE | `<EstateBar>` ×6 | server | metrics with `board_slot='estate'` (below) |
| 2 | SCOPE / KIND | `<ScopeBlock>` | server | `GROUP BY scope`, `GROUP BY object_kind` on `clarity_object` |
| 3 | DOMAIN TILES ×16 | `<DomainTile>` | server | one grouped read (below) |
| 4 | THE TAPE | `<EventLine>` ×14 | server | `clarity_event` last 24h, severity-ordered |
| 5 | TOP DEFECTS | `<DefectLine>` ×5 | server | breached metrics ranked by `rows_at_stake` |
| 6 | THE BENCH | `<SectionTicker>` ×8 | server | `lib/clarity/sections.ts` × latest measurement |

**Panel 1 — THE ESTATE.** Six coverage scalars, each: percent, absolute, delta against baseline, a
bar, and the **burn-down clause** (`621 to go · at 0/wk: never`). Clicking a bar navigates to the
LEDGER filtered to *the complement* — the gap, not the coverage. That is deliberate: you never want
to browse the 812 objects that have a purpose.

```sql
SELECT g.metric_key, g.label, g.unit, g.polarity, g.threshold,
       m.value, m.denom, round(100.0 * m.value / nullif(m.denom, 0), 1) AS pct,
       m.value - b.value                                   AS delta,
       (m.value - b.value) / nullif(extract(epoch FROM m.measured_at - b.measured_at) / 604800, 0)
                                                            AS per_week,
       (SELECT array_agg(h.value ORDER BY h.measured_at)
          FROM clarity_gap_measurement h
         WHERE h.metric_key = g.metric_key
           AND h.measured_at > now() - interval '90 days')  AS spark
  FROM clarity_gap_metric g
  JOIN clarity_gap_measurement m ON m.metric_key = g.metric_key
                                AND m.measured_at = g.last_measured_at
  LEFT JOIN LATERAL (
        SELECT value, measured_at FROM clarity_gap_measurement
         WHERE metric_key = g.metric_key AND measured_at <= $baseline_at
         ORDER BY measured_at DESC LIMIT 1) b ON true
 WHERE g.board_slot = 'estate' AND g.enabled
 ORDER BY g.display_order;
```

If `b` is null → the delta cell renders `?` (yellow) and the burn-down clause is suppressed. It
does not render `+0`.

**Panel 3 — DOMAIN TILES.** Small multiples, identical frame, per Tufte's "constancy of design puts
the emphasis on changes in data rather than changes in data frames" [R: research-dashboards §3.5].
Each tile: domain label, object count, row count, a **log₁₀ row-count distribution sparkline on an
identical scale across all tiles**, a coverage dot-row (8 dots: purposed / governed / joined / read
/ fresh / scoped / rls-sane / registered), and a one-line worst-state chip.

The 16th tile is the point: **UNFILED 621** in blue, because the three inventory shards describe
every table and matview and **zero of the 212 views and 409 routines** [R: clarity-data-layer §5,
metric 1]. That tile does not shrink until someone writes purposes. It is a visible, permanent,
loud backlog — and it is exactly the sort of thing a beautiful atlas would quietly not render.

The 17th tile is `ACT-PRIVATE 238 · hidden`, collapsed, with a disclosure caret. **Excluded from
every civic count on every board, and its count is always on screen.** Never silently hidden.

```sql
SELECT d.domain_key, d.label, d.display_order,
       count(*)                                                   AS objects,
       sum(o.row_count)                                           AS rows,
       array_agg(width_bucket(ln(greatest(o.row_count,1)), 0, ln(2.1e7), 8)) AS spark_buckets,
       count(*) FILTER (WHERE o.purpose IS NOT NULL)              AS purposed,
       count(*) FILTER (WHERE o.governed)                         AS governed,
       count(*) FILTER (WHERE o.fk_out + o.fk_in + o.lineage_in > 0) AS joined,
       count(*) FILTER (WHERE o.refs_app + o.refs_script + o.refs_db_function > 0) AS read,
       count(*) FILTER (WHERE o.last_write_at > now() - interval '30 days') AS fresh,
       count(*) FILTER (WHERE o.lifecycle = 'backup')             AS backups,
       count(*) FILTER (WHERE o.row_count = 0)                    AS empty,
       sum(dl.row_delta)                                          AS row_delta
  FROM clarity_object o
  JOIN clarity_domain d ON d.domain_key = coalesce(o.domain, 'unfiled')
  LEFT JOIN clarity_delta dl ON dl.object_key = o.object_key AND dl.baseline = $1
 WHERE o.missing_since IS NULL AND o.scope <> 'act_private'
 GROUP BY d.domain_key, d.label, d.display_order
 ORDER BY d.display_order;
```

**Panel 4 — THE TAPE.** The most operator-native thing on the page: a reverse-chronological feed of
what the last scan found. Each line is `time · glyph · object · what changed · consequence`. It is
read top-down like a log, and it is the only place in the whole design where the reading order is
temporal rather than ranked.

```sql
SELECT e.at, e.event_type, e.object_key, e.metric_key, e.before, e.after,
       e.severity, e.note, o.domain, o.row_count
  FROM clarity_event e
  LEFT JOIN clarity_object o ON o.object_key = e.object_key
 WHERE e.at > now() - interval '36 hours'
   AND coalesce(o.scope, 'civic') <> 'act_private'
 ORDER BY (e.severity = 'critical') DESC, e.at DESC
 LIMIT 14;
```

**Panel 6 — THE BENCH TICKER.** Eight cross-sections with their headline number, its delta, and
their sentinel state. `Q16 NDIS ⛔ REFUSES: lga_code 100% NULL` is on the front board on purpose —
a refusal, stated in public, is a finding.

### States

- **Loading.** `loading.tsx` renders the exact chrome plus six empty panel frames with their labels
  and 1px borders. **No spinner** (DESIGN.md forbids decorative motion). Each panel streams in via
  `<Suspense>` as its query returns; a slow panel does not hold the other five.
- **Never scanned.** Whole board renders its frames; every value is `?`; one black card centre-left
  gives the exact command and the honest sentence: *"Nothing on this page is guessed. Until the
  scan runs there is nothing to show."*
- **Partial.** If `clarity_event` is empty but `clarity_object` is populated, THE TAPE renders
  `?  NO EVENTS RECORDED — the scan ran but wrote no deltas. Either nothing moved (unlikely across
  1,433 objects) or clarity_delta was not written. Check the runner's step 4.` That is a diagnosis,
  not an empty state.
- **Error, per panel.** Frame and label survive; body becomes one red-bordered line with the
  Postgres error text and a `RETRY` that re-runs only that panel.

---

## 6. BOARD 2 — THE LEDGER (`/clarity/ledger`)

**The literal answer to "list absolutely every piece of data."** All 1,433 objects. All 14,310
columns. No pagination, ever. Master–detail: dense list left, object panel right.

**The sentence only this board finishes:** *"`justice_funding` is the 2nd most important object we
hold, 157,116 rows, down 60,906, read by 133 app files, and nobody has written down what it is."*

```
[ persistent chrome ]
┌──────────┬────────────────────────────────────────────────────┬─────────────────────────────────────┐
│ FACETS f │ SOURCES 714 │ DERIVED 98 │ LENSES 212 │ ROUTINES 409 │ ALL 1,433   ⌕ q      COLUMNS 14,310│
│          │ LENS [DRIFT ▾] rows·bytes·drift·degree·readers·gaps·exposure·scope   sort DRIFT ▾  E ext │
│ DOMAIN   ├──────────────────────────────┬────────┬──────┬─────┬─────┬───┬───┬───┬───┬──┬────────────┤
│ ▢ D1  18 │ OBJECT                       │  ROWS  │  Δ30d│ SIZE│SEEN │PUR│GOV│JOI│RD │SC│ IMPORTANCE │
│ ▢ D2  30 ├──────────────────────────────┼────────┼──────┼─────┼─────┼───┼───┼───┼───┼──┼────────────┤
│ ▢ D3  37 │ justice_funding              │ 157,116│▼60906│1.2GB│  0d │ + │ ✓ │ ✓ │ ✓ │· │ 0.930 ██▉  │
│ ▢ D4  36 │ austender_contracts          │ 823,620│▲ 2481│ 890M│  7d │ ✓ │ ✓ │ ✓ │ ✓ │· │ 0.938 ███  │
│ …        │ organizations                │ 104,427│▲  118│ 210M│  0d │ + │ + │ ✓ │ ✓ │· │ 0.921 ██▉  │
│          │ gs_relationships             │3429,184│▲ 5263│2.1GB│  5d │ ✓ │ + │ ✓ │ ✓ │· │ 0.910 ██▊  │
│ KIND     │ gs_entities                  │ 609,448│▲  892│5.2GB│  0d │ ✓ │ ✓ │ ✓ │ ✓ │· │ 0.909 ██▊  │
│ ▢ table  │ political_donations          │2549,483│  ·   │1.1GB│  7d │ ✓ │ + │ ✓ │ ✓ │· │ 0.897 ██▋  │
│ ▢ matvw  │ foundations                  │  11,159│▲   14│ 44MB│  1d │ ✓ │ ✓ │ ✓ │ ✓ │· │ 0.889 ██▋  │
│ ▢ view   │ alma_interventions           │   2,136│  ·   │ 19MB│  1d │ ✓ │ + │ ✓ │ ✓ │· │ 0.854 ██▌  │
│ ▢ routine│ acnc_charities               │  66,023│  ·   │ 81MB│  7d │ ✓ │ ✓ │ ✓ │ ✓ │· │ 0.847 ██▌  │
│          │ grant_opportunities          │  25,897│▲  340│ 96MB│  1d │ ✓ │ ✓ │ ✓ │ ✓ │· │ 0.846 ██▌  │
│ STATE    │ …                                                                                        │
│ ▢ live   │ acnc_ais                     │ 360,488│  ?   │ 1.4G│  ?  │ ✓ │ + │ ✓ │ ✓ │· │ 0.739 ██▏  │
│ ▢ empty  │   ? probe deferred_too_large · freshness unknowable, not zero                            │
│ ▢ tiny   │ person_roles                 │ 339,698│  ·   │ 120M│ 57d │ ✓ │ + │ ✓ │ ✓ │· │ 0.790 ██▎  │
│ ▢ backup │   ⛔ 57d stale · this is the entire director-links pillar                                 │
│ ▢ stagng │ ⛔ gs_entities_lga_backup_20260808         BACKUP · superseded by live table              │
│ ▢ supers │                              │ 609,416│  ·   │ 41MB│  6d │ + │ + │ + │ + │· │ 0.048 ▏    │
│          │ v_org_funding_profile (view) │ 609,448│  ?   │  —  │  —  │ + │ + │ ○ │ ✓ │· │ 0.183 ▎    │
│ GAP      │ v_entity_360         (view)  │   ?    │  ?   │  —  │  —  │ + │ + │ ○ │ ✓ │· │ 0.171 ▎    │
│ ▢ no pur │   ? row count timed out at 3s · re-probed weekly at 30s · never stored as 0              │
│ ▢ no gov │ rebuild_funder_intelligence()│   —    │  —   │  —  │  —  │ + │ + │ — │ ✓ │⛔│ 0.402 ▌    │
│ ▢ no join│   ⛔ SECURITY DEFINER · anon-executable · writes                                          │
│ ▢ no read│ ─────────────────────────────────────────────────────────────────────────────────────── │
│ ▢ stale  │ 1,433 objects · showing 1,195 · 238 ACT-private hidden · sticky header · frozen col 1    │
│ ▢ anon   │ A vertical run of + is a hole you can see from two metres. j/k move · ⏎ opens · x marks. │
│          ├──────────────────────────────────────────────────────────────────────────────────────────┤
│ SCOPE    │ ▸ OBJECT PANEL — docked right when a row is selected; see §6.2                            │
│ ▢ civic  │                                                                                          │
│ ▢ unclsf │                                                                                          │
│ ▢ platfm │                                                                                          │
│ ▣ act ⌄  │                                                                                          │
└──────────┴──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.1 The five decisions in this board

1. **Segmented by kind, not one flat list.** Measured constraint, not taste: views carry zero bytes
   and low degree, so in a single ranked list *the highest view is #183* and the first 182 rows are
   100% tables and matviews [R: clarity-data-layer §4.2]. A flat list would silently bury 206
   anon-readable API surfaces including `v_entity_360` and `org_governance`. The segmented control
   is one keystroke, preserves one layout, and never lies about rank. Default `SOURCES`; `ALL 1,433`
   is always one click away and is the literal complete list Ben asked for.

2. **`Δ` is a first-class column, and it is column 3.** Not buried in a detail view. The column
   directly beside ROWS. Sorting by drift descending is the operator's default morning move and it
   is one keystroke (`sort DRIFT`).

3. **The lens recolours the same layout, eight ways** — dbt's Lenses [R: research-dashboards §2.2].
   `rows · bytes · drift · degree · readers · gaps · exposure · scope`. One layout learned once,
   eight encodings. `exposure` is the one nobody else would ship: it colours by
   `anon_readable / security_definer / policy_count = 0`, turning the governance surface into a
   visible pattern (451 of 1,024 relations anon-readable, 215 tables RLS-on-zero-policy [R]).

4. **Sub-rows carry the reason, in place.** When a row's state is not nominal, a 16px sub-row in
   the row's own colour explains it: `? probe deferred_too_large · freshness unknowable, not zero`.
   No tooltips for load-bearing information — tooltips are unprintable, unsearchable and
   unscreenshottable, which is disqualifying on an instrument.

5. **COLUMNS mode is real, not a promise.** The `COLUMNS 14,310` control swaps the left list from
   objects to columns — name, type, nullable, nullity %, is_vector, vector_dim, FK target, distinct
   count where known. This is the only place in the design that needs virtualization, and it is the
   only new dependency (§10).

### 6.2 The object panel

Docked right when a row is selected (`?o=justice_funding`), fetched from
`/api/clarity/object/[key]` (~15 KB, <100 ms). Also a standalone Server Component at
`/clarity/o/justice_funding` for sharing and printing. Bands, not tabs — **tabs hide things and
this is an instrument**. All bands open by default; `Space` collapses the focused one.

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ justice_funding                          table · D8 JUSTICE · core_source · CIVIC · rank 2 │
│ 157,116 rows  ▼60,906 (−27.9%) since 02 APR      1.2 GB ▼      deg 45      importance .930 │
│ ROWS, 90 DAYS                                                                              │
│ 218,022 ┤███████▔▔▔▔▔╲                                                                     │
│         │            ╲___________________________________________________ 157,116          │
│         └─────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────        │
│           MAY 15   MAY 29  JUN 12  JUN 26  JUL 10  JUL 24  AUG 07  AUG 14                  │
│         ⛔ −60,906 on or before 02 APR · NO REASON RECORDED  [ RECORD THE REASON → ]        │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ PURPOSE      + NOT WRITTEN — this is one of 621. [ WRITE IT → ]                             │
│ CAVEAT       ▰ measure_kind mixes grants with state budget aggregates. Summing the whole    │
│              table gives $120.6bn against $46.1bn of actual grants — 2.6× inflation.        │
│              grant 126,673 / $46.097bn · contract_value 29,519 / $6.106bn ·                 │
│              expenditure_aggregate 848 / $66.126bn ← 55% of dollars in 0.5% of rows         │
│              budget_announcement 76 / $2.236bn                                              │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ SEAMS (12)                                        measured   at stake      trend            │
│  → gs_entities.id            via gs_entity_id     93.65%     149,207 rows  ·                │
│  → gs_entities.abn           via recipient_abn    95.00%     149,207 rows  ·                │
│  ← gs_relationships          via source_record_id  0.00% ⛔  49,426 edges  ⛔ DEAD NAMESPACE │
│     ⛔ uuid-shaped, matches neither justice_funding.id nor source_statement_id.              │
│        Any "click an edge to see the grant" feature is unbuildable until this is rebuilt.   │
│  ← justice_funding_clean (view)  lineage          151,866 rows ▰ COMPETING DEFINITION       │
│     ▰ 151,866 (sector <> 'procurement') vs 126,673 (measure_kind='grant'). Gap 25,193 rows. │
│  … 8 more                                                            [ 3 · SEE ALL SEAMS ]  │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ READERS      133 app files · 138 pipeline files · 4 db functions · 2 triggers · 3 views     │
│  app   apps/web/src/lib/report-service.ts ·  app/reports/*/page.tsx ×9 · lib/services/…     │
│  fn    topic_funding_rollup() · refresh_civicgraph_mvs() · …                                │
│  trg   trg_justice_funding_stamp_topics BEFORE INSERT OR UPDATE                             │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ COLUMNS (34)   nullity ▁▁█▁▁▁▂▁▁▁▁▃▁▁▁▁▁█▁▁▁▁▁▁▁▂▁▁▁▁▁▁▁                                    │
│  recipient_name  text     NOT NULL                                                          │
│  recipient_abn   text     NULL    ███████████░ 95.0%   → gs_entities.abn                   │
│  gs_entity_id    uuid     NULL    ███████████░ 93.7%   → gs_entities.id                    │
│  amount_dollars  numeric  NULL    ██████████░░ 88.2%                                        │
│  measure_kind    text     NOT NULL  4 distinct  ▰ see caveat                                │
│  … 29 more                                                                                  │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ DEFECTS NAMING THIS OBJECT (4)   metric 10 ▰ · metric 12 ▮ · metric 16 ▮ · metric 20 ▰      │
│ GOVERNANCE   RLS on · 3 policies · anon: no · scope CIVIC (catalog_object_scope) · pii: low │
│ HISTORY      41 events · last: 02 APR row drop · [ 6 · TAPE FILTERED TO THIS OBJECT → ]     │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ COPY SELECT ] [ /ops/health → ] [ /graph justice mode → ] [ VERDICT ▾ ] [ p PIN TO WATCH ]│
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Query** (`/api/clarity/object/[key]`) — six small reads, none touching a big table:

```sql
-- 1 header
SELECT * FROM v_clarity_ledger WHERE object_key = $1;
-- 2 strip chart, 90 days
SELECT captured_at, row_count, bytes, degree, importance
  FROM clarity_object_history
 WHERE object_key = $1 AND captured_at > now() - interval '90 days'
 ORDER BY captured_at;
-- 3 seams both directions, with measured match rate
SELECT e.*, CASE WHEN e.src_object = $1 THEN 'out' ELSE 'in' END AS dir
  FROM clarity_edge e
 WHERE e.src_object = $1 OR e.tgt_object = $1
 ORDER BY e.rows_at_stake DESC NULLS LAST;
-- 4 readers, distinct files by class
SELECT ref_class, count(DISTINCT file_path) AS files,
       array_agg(DISTINCT file_path ORDER BY file_path) FILTER (WHERE ref_class IN ('app','db_function','trigger')) AS paths
  FROM clarity_code_ref WHERE object_key = $1 GROUP BY ref_class;
-- 5 columns with nullity
SELECT column_name, data_type, is_nullable, null_fraction, distinct_count,
       is_vector, vector_dim, fk_target
  FROM clarity_column WHERE object_key = $1 ORDER BY ordinal_position;
-- 6 defects + events
SELECT m.metric_key, g.label, m.value, m.breached, m.sentinel_fired
  FROM v_clarity_metric_latest m JOIN clarity_gap_metric g USING (metric_key)
 WHERE $1 = ANY(g.names_objects);
SELECT * FROM clarity_event WHERE object_key = $1 ORDER BY at DESC LIMIT 20;
```

**States.** Object missing (`missing_since` set) → the whole panel renders with a red top rule and
`⊖ THIS OBJECT DISAPPEARED ON 12 AUG. Its history is preserved below.` — the row is never deleted,
per the data layer's `missing_since` design. Column probe unavailable → `?`. History shorter than
90 days → the strip chart draws only what exists and prints `history begins 15 AUG (3 nights)`
under the axis; it does not extend a flat line backwards.

---

## 7. BOARD 3 — THE SEAMS (`/clarity/seams`)

This is my sharpest departure from the floor. BUILD-SPEC's Screen 4 is a **join map**: a
force-directed graph of ~200 nodes. That is the atlas move — pretty, orienting, and it cannot tell
you that a join is broken.

**The instrument's move: a join is a row, not an edge.** 636 declared FKs + 695 view-lineage edges +
curated implicit joins, each with a *measured match rate* and *rows at stake*, ranked by
`rows_at_stake × (1 − match_rate)` — i.e. **by how much data the seam is currently losing**.

**The sentence only this board finishes:** *"The single most expensive broken connection in the
database is ___, and it is costing us ___ rows."*

```
[ persistent chrome ]
┌─────────────┬──────────────────────────────────────────────────────────────────────────────────────┐
│ MECHANISM   │ SEAMS · 1,331 declared + 84 curated · ranked by ROWS LOSING       g GRAPH   E extract│
│ ▢ fk    636 ├────────────────────────────────┬───────────────────────────┬───────┬────────┬────────┤
│ ▢ lineage695│ FROM                           │ TO                        │ MATCH │ LOSING │ TREND  │
│ ▢ curated 84├────────────────────────────────┼───────────────────────────┼───────┼────────┼────────┤
│ ▢ abn       │ gs_relationships.source_rec_id │ justice_funding.id        │ 0.00%⛔│ 49,426 │ ⛔ dead│
│ ▢ postcode  │  ⛔ DEAD KEY NAMESPACE — uuid-shaped, matches neither .id nor .source_statement_id.  │
│             │     Consequence: "click an edge to see the grant" is unbuildable. Rebuild required.  │
│ STATE       │ political_donations.donor_abn  │ gs_entities.abn           │25.10% │1,910,053│ ▼ 0.4pp│
│ ▢ ⛔ dead  3│  ⛔ Only 653,261 of 2,549,483 rows carry any donor_abn. Loss is at COLLECTION, not   │
│ ▢ ⚠ <50%  9│     matching. Three times worse than any other money table.                          │
│ ▢ ✓ ≥90% 71│ grantconnect_awards.recip_abn  │ gs_entities.abn           │72.40% │ 80,500 │ ▲ 1.2pp│
│ ▢ ○ declrd  │  ⚠ 68,172 well-formed ABNs absent from gs_entities · 99.97% exist in abr_registry.  │
│ ▢ + unmeasd │     FIXABLE BY ONE BULK INSERT.  [ 5 · BENCH Q7 → ]                                  │
│             │ nz_charities.gs_entity_id      │ gs_entities.id            │ 0.00%⛔│ 45,192 │ ⛔ nvr │
│ GRAIN       │  ⛔ DECLARED BRIDGE, NEVER POPULATED. 0 of 45,192.                                   │
│ ▢ ✓ 1:1  ..│ ndis_participants_lga.lga_code │ postcode_geo.lga_code     │ 0.00%⛔│  8,329 │ ⛔ nvr │
│ ▢ ⚠ n:1  ..│  ⛔ 100% NULL. 362,313 NDIS rows stranded at state level. Q16 REFUSES an LGA map.     │
│ ▢ ⛔ frayed│ funding.postcode               │ postcode_geo.postcode     │41.70% │  3,894 │ ·      │
│             │  ⛔ GRAIN DEFECT: the reference table (2,909 distinct postcodes) is SMALLER than the │
│             │     fact table it is supposed to place (6,684). Reference, not data, is the problem. │
│ AT STAKE    │ mv_funding_by_lga.lga_code     │ (self, grain)             │  —    │  1,729 │ ⛔ 3.16│
│ ├──●─────┤  │  ⛔ 1,729 rows for 548 LGA codes = 3.16 rows per key. A choropleth on this silently  │
│  1K    2M   │     triple-counts. Same defect already found in mv_funding_deserts (551/717/1,997).  │
│             │ austender_contracts.supplier_abn│ gs_entities.abn          │92.90% │ 58,189 │ ▲ 0.1pp│
│             │ justice_funding.gs_entity_id   │ gs_entities.id            │93.65% │  9,976 │ ·      │
│             │ acnc_charities.abn             │ gs_entities.abn           │100.0% │      0 │ ·      │
│             │ … 1,406 more · sorted by rows losing · sticky header                                 │
├─────────────┴──────────────────────────────────────────────────────────────────────────────────────┤
│ g — CONSTELLATION · 14 domain nodes + top 126 objects by degree · 140 nodes, 318 edges              │
│     ⛔ REFUSES above 200 nodes. A 2-hop neighbourhood in the ENTITY graph is ~2,345 nodes and is    │
│        not drawable as node-link. This is the SCHEMA graph, which is small enough to be honest.     │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Component.** `<SeamRow>` server-rendered; `<SeamGraphClient>` is the only
`react-force-graph-2d` use in `/clarity`, mounted behind `g`, capped at 140 nodes, seeded from the
current filter, and it **refuses** above 200 with the reason printed. It reuses
`/api/data/schema-graph` [R: existing-surfaces — 280 lines, live, zero consumers] with two fixes
that document themselves as bugs: delete the 70-entry `TABLE_DOMAIN` hard-filter which silently
drops 742 of 812 objects, and replace `pg_stat_user_tables.n_live_tup` which reports **0** for
`political_donations` (actual 2,549,483) [R] — meaning the orphaned API currently drops the
second-largest table in the database entirely.

**Query.**

```sql
SELECT e.mechanism, e.src_object, e.src_column, e.tgt_object, e.tgt_column,
       e.declared, e.match_rate, e.rows_at_stake, e.grain, e.note,
       e.match_rate - b.match_rate AS match_delta,
       round(e.rows_at_stake * (1 - coalesce(e.match_rate, 0))) AS rows_losing
  FROM clarity_edge e
  LEFT JOIN clarity_edge_history b
         ON b.edge_key = e.edge_key AND b.captured_at = $baseline_at
 WHERE coalesce(e.scope, 'civic') <> 'act_private'
 ORDER BY rows_losing DESC NULLS LAST;
```

`match_rate` is measured by the nightly job for declared FKs and curated joins under a cost bound
(the expensive ABN metrics run weekly [R: clarity-data-layer §7]); unmeasured seams render `+`
(blue) with `not yet measured`, never `0`.

**Why this beats the map.** The map answers *"is it connected?"* — which, for a database with 636
declared FKs, is almost always yes and almost never interesting. The seam board answers *"is the
connection carrying the data?"*, which is where all four of Ben's stated frustrations actually
live: the 100% justice drill-through gap, the 25.1% donation attribution, the 0% NDIS LGA bridge,
and the 3.16-rows-per-key grain defect that would make a choropleth lie. Not one of those is
visible in a force-directed graph. All four are the top four rows here.

---

## 8. BOARD 4 — THE DEFECTS · BOARD 5 — THE BENCH · BOARD 6 — THE TAPE

### 8.1 BOARD 4 — THE DEFECTS (`/clarity/defects`)

23 gap metrics [R: clarity-data-layer §5], each with today's value, the baseline, the delta, a
threshold, and whether it **fired**. Monte Carlo's coverage matrix reframed as an alarm list,
which is what an operator needs. Every metric carries the SQL that produces it, so the number on
screen and the number in the doc are the same number by construction.

**The sentence only this board finishes:** *"Nine of our twenty-three quality metrics are over
threshold, two sentinels have fired, and the one degrading fastest is ___."*

```
[ persistent chrome ]
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ DEFECTS · 23 metrics · 9 breached · 2 fired · 1 disabled                base 30d      S show SQL │
├────┬────────────────────────────────────────┬───────────┬────────┬───────┬──────────┬────────────┤
│    │ METRIC                                 │     TODAY │ Δ30d   │ THRESH│ SPARK    │ NAMES      │
├────┼────────────────────────────────────────┼───────────┼────────┼───────┼──────────┼────────────┤
│ ▰10│ justice edge → grant drill-through     │ 0.0%      │  ·     │ ≥50%  │ ▁▁▁▁▁▁▁▁ │ 2 objects  │
│    │  49,426 edges · DEAD KEY NAMESPACE · gs_relationships.source_record_id                      │
│ ▰20│ concepts with >1 live definition       │ 1         │  ·     │  =0   │ ▁▁▁▁▁█▁▁ │ 2 objects  │
│    │  justice_funding_clean 151,866 vs measure_kind='grant' 126,673 · gap 25,193                 │
│ ⛔ 5│ matviews in no scheduled refresh       │ 71 of 98  │  ·     │  ≤10  │ ████████ │ 71 objects │
│    │  2,871,838 rows · 55 in NEITHER registry · [ SEE THE 55 → ]                                 │
│ ⛔ 6│ matviews stale > 48h                   │ 70 of 98  │ ▲ +4   │  ≤10  │ ▆▆▆▇▇▇▇█ │ 70 objects │
│ ⛔13│ ABN attribution, donations             │ 25.1%     │ ▼ 0.4pp│ ≥60%  │ ███▁▁▁▁▁ │ 1 object   │
│ ⛔11│ declared bridge columns populated      │ 0.0%      │  ·     │ ≥80%  │ ▁▁▁▁▁▁▁▁ │ 2 objects  │
│ ⛔17│ relations anon-readable                │451 of 1024│  ·     │  ≤50  │ ████████ │ 451 objs   │
│    │  206 of 212 views · 99 run DEFINER · 215 tables RLS-on-zero-policy (unreachable ≠ protected)│
│ ⛔19│ SECURITY DEFINER fns anon-executable   │ 3         │  ·     │  =0   │ ███▁▁▁▁▁ │ 3 routines │
│ ⛔ 1│ objects with a written purpose         │812 of 1433│  ·     │ ≥95%  │ ▅▅▅▅▅▅▅▅ │ 621 gap    │
│ ⛔ 2│ objects with a governance row          │ 25 of 1433│  ·     │ ≥50%  │ ▁▁▁▁▁▁▁▁ │ 1,408 gap  │
│  ·14│ entities with a resolved LGA           │ 48.3%     │ ▲ 6.7pp│ ≥60%  │ ▂▃▄▅▆▇▇█ │ ▲ improving│
│  · 8│ dark rows (populated, nothing reads)   │184 / 5.09M│ ▼ −6   │  ≤100 │ ███▇▇▇▆▆ │ 184 objs   │
│  ·22│ row counts that are estimates          │ 6         │  ·     │  ≤20  │ ▁▁▁▁▁▁▁▁ │ 6 objects  │
│  ○ 5b│ matviews unregistered (successor)     │ DISABLED  │  —     │  —    │  —       │ ○ pending  │
│    │  ○ Its table mv_refresh_registry does not exist yet. Flip metric 5 → 5b in the same change   │
│    │    that applies the registry migration, or metric 5 will report a confident, wrong 98/98.    │
│ … 9 more                                                                                         │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ WHERE THE HOLES CLUSTER · domain × dimension, 14 × 8. A dark block is an abandoned region.        │
│              PURPOSE  GOVERN  JOIN  READ  FRESH  SCOPE  RLS  REFRESH                             │
│ D1 SPINE        ░       █      ░     ░      ▒      ░     ▒     ░                                  │
│ D8 JUSTICE      ▒       █      ▒     ▓      ▓      ░     ▒     ▓                                  │
│ D12 MEDIA       ▓       █      █     █      █      ▒     ▓     █   ← 77 objects, 4,501 rows       │
│ D13 PLATFORM    ▒       █      ▓     ▒      ▒      ▓     █     ▓                                  │
│ UNFILED         █       █      █     ▓      █      █     ▓     █   ← 621 views + routines         │
│ …                                                                                                │
│ █ 0–20% covered   ▓ 20–50%   ▒ 50–80%   ░ 80–100%                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

The heat block is the **domain × dimension** compression of the per-object coverage matrix — 14×8
fits one screen where 1,433×8 does not, and the per-object cells live in the LEDGER where you can
sort by them. Same information, two grains, neither one a wall of pixels.

**Query.**

```sql
SELECT g.metric_key, g.label, g.unit, g.threshold, g.threshold_direction, g.polarity,
       g.sql_text, g.names_objects,
       m.value, m.denom, m.measured_at, m.breached, m.sentinel_fired,
       m.value - b.value AS delta,
       (SELECT array_agg(h.value ORDER BY h.measured_at) FROM clarity_gap_measurement h
         WHERE h.metric_key = g.metric_key AND h.measured_at > now() - interval '90 days') AS spark
  FROM clarity_gap_metric g
  LEFT JOIN v_clarity_metric_latest m USING (metric_key)
  LEFT JOIN LATERAL (SELECT value FROM clarity_gap_measurement
                      WHERE metric_key = g.metric_key AND measured_at <= $baseline_at
                      ORDER BY measured_at DESC LIMIT 1) b ON true
 ORDER BY m.sentinel_fired DESC, m.breached DESC, (m.value - b.value) DESC NULLS LAST;
```

`S` reveals `g.sql_text` inline in a JetBrains Mono block with a `COPY` action. That is the
anti-rot mechanism: a metric whose SQL has silently stopped meaning what its label says can be
found, because the SQL is next to the number.

### 8.2 BOARD 5 — THE BENCH (`/clarity/bench`)

**This is where I break hardest from the floor.** BUILD-SPEC says: *"SLICE 7+ — THE ANALYTICS HALF
— separate spec, do not scope here."* Ben's actual ask has the analytics half as the *point*: "the
biggest dataset of Australian philanthropy… cross-sectioned in a way no one else does… find
opportunities". Deferring it means shipping a very good inventory of a thing whose value nobody can
see.

The bench makes the cross-sections **first-class registered objects**, monitored exactly like
tables — with headline numbers, coverage gates, and named sentinels that fire when the number is
known to be wrong.

**The sentence only this board finishes:** *"Of the sixteen things only we can compute, nine are
live, six are blocked on a named fix, and two are currently lying."*

```
[ persistent chrome ]
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ THE BENCH · 16 cross-sections · 9 RAN · 6 FEASIBLE · 1 REFUSES · 3 sentinels FIRED               │
├──────────────────────────────┬──────────────────────────────┬────────────────────────────────────┤
│ Q1 QLD WATCHHOUSE CHILDREN ▮ │ Q3 YJ MONEY, NO EVIDENCE   ▮ │ Q5 DONOR ↔ CONTRACTOR         ▰ ⛔ │
│ 38.8 avg/day  ▲ 3.0× 15 wks  │ 85% of orgs                  │ 2,175 entities                     │
│ ▁▂▃▄▅▆▇█  Apr 13.0 → Aug 38.8│ ▁▁▂▂▃▃▄▄  93.65% coverage    │ BLOCKED — 2 sentinels FIRED        │
│ over-7-days 0.00 → 8.35 ▲    │ reads justice_funding ·      │ ▰ 89% of political_donations.amount│
│ longest 5d → 14d ▲           │       alma_interventions     │   is receipt_type 'other receipt', │
│ reads qld_watchhouse_* · 8,488│ ⚠ NEVER SAY "has no evidence"│   not donations. MV sums all types │
│ ⚠ person-observations, not   │   → "no evidence record      │ ▰ $121,149.1m Gilbert and Tobin /  │
│   distinct children          │      linked" (denominator)   │   Treasury row is 99.96% of that   │
│ ⚠ FN share fell 80.8→37.6% ▲ │ ▮ measure_kind='grant' armed │   supplier and cannot be real      │
│   because non-Indigenous rose│ ▮ topics HYPHENS not _ armed │ REFUSES to render a total until    │
│   +868%, not because fewer   │                              │ both are resolved. Correlation     │
│   Aboriginal children held.  │ [ RUN · 1.2s ]  [ SQL ]      │ only, never causation.             │
│   BOTH true. Second is the   │                              │ [ SEE THE EVIDENCE ]  [ SQL ]      │
│   one that gets misreported. │                              │                                    │
│ [ RUN · 0.4s ]  [ SQL ]      │                              │                                    │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────┤
│ Q6 FUNDING DESERTS        ▮⚠ │ Q7 67K AWARDS, UNKNOWN ABN ▮ │ Q16 NDIS × DISADVANTAGE       ⛔    │
│ 1,997 rows / 551 LGA names   │ 68,172 ABNs                  │ REFUSES TO RENDER                  │
│ ⚠ GRAIN: 717 name|state.     │ 99.97% exist in abr_registry │ ⛔ ndis_participants_lga.lga_code   │
│   MUST GROUP BY name,state   │ ONE BULK INSERT FIXES IT     │   is 100% NULL. 362,313 rows are   │
│   or you triple-count.       │ ▲ +812 awards since baseline │   stranded at state level. Nothing │
│ ⚠ remote NT/WA/SA funded via │ [ 3 · SEAM ]  [ SQL ]        │   maps an NDIS district to an LGA. │
│   land councils → hub keeps  │                              │ Ships at STATE level only.         │
│   the credit. "$0 recorded"  │                              │ ⛔ DO NOT DRAW AN LGA CHOROPLETH.   │
│   = not visible here, which  │                              │ [ STATE-LEVEL VERSION → ]          │
│   is a legibility finding.   │                              │                                    │
├──────────────────────────────┴──────────────────────────────┴────────────────────────────────────┤
│ Q2 board interlocks ▮ · Q4 charity financial fragility ▮ · Q8 pre/post-release ▮ · Q9 foundation↔ │
│ contract ▮ · Q10 3+ influence systems ○ · Q11 gov dependence ○ · Q12 one ABN all tiers ○ ·        │
│ Q13 exec pay × dependence ○ · Q14 community-controlled share ○ · Q15 ministerial diaries ○ pilot  │
│ only, 1,728 meetings is a demo not a corpus                                                       │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ WHERE THESE LAND   Q1→/reports · Q3→/reports · Q6→/atlas (funding-deserts layer, LIVE) ·          │
│ Q10→/graph (power mode, LIVE) · Q2→/power · the rest have no public surface yet: + 9 unlanded      │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**The registry type** (content in code, state in DB — the `atlas/layers.ts` and `surface.ts`
precedent, both of which demonstrably did not rot):

```ts
// apps/web/src/lib/clarity/sections.ts
export type Sentinel = {
  key: string;
  claim: string;          // 'political_donations.amount is 89% non-donation receipts'
  check: string;          // SQL returning one numeric
  firesWhen: string;      // 'value > 0.5'
  onFire: 'block' | 'annotate';
};

export type CrossSection = {
  key: string;                    // 'q5-donor-contractor'
  question: string;               // the one sentence only this section answers
  state: 'ran' | 'feasible' | 'blocked';
  domains: DomainKey[];
  reads: string[];                // object_keys — CI fails if any is not in clarity_object
  bindingJoin?: { from: string; to: string; measuredRate: number; measuredAt: string };
  coverageFloor: number;          // reject below this unless state === 'blocked'
  sql: string;
  headline: (rows: Row[]) => { value: string; unit: string; asOf: string };
  sentinels: Sentinel[];          // CI fails if empty
  refusesWhen: RefusalRule[];     // e.g. { when: 'lga_code null_fraction = 1', say: '…' }
  caveat: string;                 // CI fails if empty  ← the atlas/layers.ts rule
  neverSay: string[];             // ['has no evidence'] → CI greps the rendered copy
  surface?: string;               // '/atlas', '/graph', or undefined = unlanded
};
```

`bench-registry.test.ts` fails the build on: an empty `caveat`; zero `sentinels`; a `reads` entry
absent from `clarity_object`; a `coverageFloor` above the measured `bindingJoin.measuredRate`
without `state: 'blocked'`; or any string in `neverSay` appearing in the section's rendered copy.
That last check is what enforces the hard constraint — **`neverSay: ['has no evidence']` on Q3
makes "no evidence record linked" a build-time guarantee rather than a remembered rule.**

`RUN` posts to `/api/clarity/section/[key]`, which runs the section's SQL, evaluates every sentinel
first, and returns `{ rows, sentinelVerdicts, elapsedMs }`. If any sentinel with `onFire: 'block'`
fires, **rows are not returned at all** and the card renders the refusal with the evidence. That is
the BOVS "Accurate" principle in executable form [R: research-visualization §2.6].

The 8-second ceiling is shown as a depleting bar during the run. On cancellation:
`CANCELLED AT 8.0s — this query cannot run through the app. Run it from psql:` followed by the
exact command. A limit, stated, with the workaround.

### 8.3 BOARD 6 — THE TAPE (`/clarity/tape`)

The full change log with the drift chart. This is where the `justice_funding` −60,906 event would
have been caught, and the board is designed so that the *next* one is.

**The sentence only this board finishes:** *"On 02 April, `justice_funding` lost 60,906 rows and
nothing fired. Here is every other time that has happened."*

```
[ persistent chrome ]
┌────────────┬─────────────────────────────────────────────────────────────────────────────────────┐
│ TYPE       │ DRIFT · 90 days · objects (left axis) vs total rows (right)                          │
│ ▢ row_move │  1440┤                                                    ╭─────────  1,433 obj      │
│ ▢ new      │      │                    ╭──────────────────────────────╯                           │
│ ▢ missing  │  1200┤        ╭───────────╯                                       52.3M rows ┈┈┈┈┈┈  │
│ ▢ state    │      │────────╯                                              ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈         │
│ ▢ scope    │   960┤ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈                          │
│ ▢ refresh  │      └──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────                │
│ ▢ sentinel │      MAY 18  MAY 31  JUN 13  JUN 26  JUL 09  JUL 22  AUG 04  AUG 14                   │
│ ▢ metric   │      ⊕ 812→1,024 relations first inventoried 14 AUG · ⊕ +409 routines                 │
│            ├─────────────────────────────────────────────────────────────────────────────────────┤
│ SEVERITY   │ ANOMALIES · |Δ| > 10% or a sign flip · 6 in 90 days · 1 unexplained                  │
│ ▢ critical │ ⛔ 02 APR  justice_funding      218,022 → 157,116   −27.9%   NO REASON RECORDED      │
│ ▢ warn     │            [ RECORD THE REASON → ]  suspected dedup, unconfirmed                     │
│ ▢ info     │  ·  09 AUG  gs_entities lga     253,648 → 294,214   +16.0%   LGA attribution rebuild │
│            │  ·  09 AUG  stg_ratio_winners    15,353 →       0  −100.0%   staging truncate, normal│
│ WINDOW     │  ⛔ 13 AUG  mv_person_network    stale 5d → stale 6d          in NEITHER registry     │
│ ◀ 90d ▶    │                                                                                      │
│            ├─────────────────────────────────────────────────────────────────────────────────────┤
│ OBJECT     │ EVENTS · 1,284 in window · newest first                                              │
│ [ ⌕      ] │ 14 AUG 03:14  ⊕  stg_lga_probe            new · 0 rows · scope unclassified          │
│            │ 14 AUG 03:14  ▲  austender_contracts      821,139 → 823,620  +2,481  +0.30%          │
│            │ 14 AUG 03:13  ?  acnc_ais                 freshness probe deferred_too_large         │
│            │ 14 AUG 03:12  ⛔ mv_person_network        refresh not attempted · no registry entry  │
│            │ 14 AUG 03:11  ▰  political_donations      SENTINEL receipt_type_contamination FIRED  │
│            │ 13 AUG 17:30  ·  44 matviews refreshed    5 used non-CONCURRENT · 12m 04s total      │
│            │ 13 AUG 04:00  ⛔ agent alma-media          timed_out · 3rd failure in 7 days          │
│            │ …                                                                                    │
└────────────┴─────────────────────────────────────────────────────────────────────────────────────┘
```

**The anomaly rule** (written by the nightly job into `clarity_event` with `severity='critical'`):
any object where `|row_delta| / greatest(prev_row_count, 1) > 0.10`, **or** the row count crosses
zero in either direction, **or** `missing_since` gets set, **or** `state` changes, **or** a scope
verdict changes. An event stays `NO REASON RECORDED` — in red, on the front board — until a human
writes one. That is the whole mechanism, and it is one boolean column plus a text box.

---

## 9. INTERACTION MODEL

### 9.1 Keyboard — the primary input

```
1 2 3 4 5 6   switch board                    /            command bar (objects·metrics·sections·verbs)
[ ]           cycle baseline  LAST·7d·30d·90d ?            key map
j k           row down / up                   g            graph, on SEAMS only (≤140 nodes)
⏎             open the object panel           Esc          close panel · then clear filter · then blur
o             cycle lens (8)                  f            focus the facet rail
s             cycle sort                      x            mark row into the extract set
e             extract  (CSV · SQL IN-list · seed the seam graph · copy the URL)
p             pin the focused row to the watch list
S             show the SQL behind the focused panel
.             run the focused panel's query live, with the 8s ceiling shown as a depleting bar
```

Every keystroke has a visible affordance on screen — the bracketed letters in the chrome are not
decoration, they are the key. Nothing is keyboard-only; nothing is mouse-only.

### 9.2 URL state — the whole instrument is one copyable string

Plain `searchParams` + `router.replace`. No new dependency. (`nuqs` is a fine addition later; it is
not required, and §10's dependency budget is one.)

```
/clarity/ledger?kind=source&dom=D8&lens=drift&base=30d&sort=drift&dir=desc
               &gap=purpose&scope=civic&o=justice_funding&q=abn&x=a,b,c
/clarity/seams?mech=fk&state=broken&base=7d&min=1000
/clarity/bench/q5-donor-contractor?run=1
/clarity/tape?type=row_move&sev=critical&window=90d&obj=justice_funding
```

`base` and `scope` are **global** — they persist across board switches, because an operator changes
baseline once and then reads six boards through it.

### 9.3 Drill targets — every one changes FORM, not just depth

The test [R: research-visualization §5.1]: write the sentence a level can finish and nowhere else.
If two levels finish the same sentence, delete one.

| From | To | Form change | Sentence gained |
|---|---|---|---|
| BOARD tile | LEDGER filtered | small multiples → **ranked table** | "…and within that domain the biggest is ___" |
| LEDGER row | OBJECT PANEL | table row → **record + strip chart** | "…and it lost 60,906 rows on 02 April" |
| OBJECT seam | SEAMS filtered | record → **ranked join table** | "…and that join carries only 25.1% of its rows" |
| SEAMS `g` | CONSTELLATION | table → **node-link, ≤140** | "…and the estate has N islands; gs_entities is what makes it one graph" |
| DEFECT row | LEDGER filtered to `names_objects` | metric → **the objects it names** | "…and these 71 matviews are the ones nobody refreshes" |
| BENCH card | SECTION, run live | card → **result set + sentinel verdicts** | "…and here is the number, and here is why it might be wrong" |
| TAPE anomaly | OBJECT PANEL at that date | event → **record with the strip cursor set** | "…and this is what it looked like the night it happened" |
| OBJECT actions | `/graph` · `/atlas` · `/ops/health` · `/entities` | catalog → **the product surfaces** | "…and here is the same thing as a map / a network / rows" |

Eight drills, seven distinct forms. The last one is the important one: **`/clarity` hands off to
the existing surfaces rather than duplicating them.** Existing-surfaces records that at least five
things called some variant of "power map" or "network" already exist across the two repos. A
seventh belongs in nobody's roadmap.

### 9.4 The four baselines, and the honest cold start

`clarity_object_history` has **zero rows on the day the migration is applied**. My entire thesis —
change is the signal — is under-powered for the first month. I will not paper over that with flat
sparklines. Three specific mitigations, in order of honesty:

1. **The `?` glyph is the day-one default for every delta cell.** Not `0`, not a flat line. The
   baseline selector greys unavailable options with the reason: `30d — history begins 15 AUG,
   3 nights`.
2. **Backfill from real history where real history exists.** `data_catalog_snapshots` holds
   **1,419 rows over 25 tables** [R: existing-surfaces §1a] with `snapshot_at`, `row_count`,
   `freshness_hours`, `provenance_coverage_pct`, `confidence_coverage_pct`. Those 25 are the spine
   — `gs_entities`, `justice_funding`, `austender_contracts`, `foundations` and friends. One
   `INSERT … SELECT` gives the most important 25 objects a genuine multi-month strip chart on
   day one, and the other 1,408 render `?` until the job has run. Real history for the rows that
   matter, an honest glyph for the rest.
3. **The known events are seeded, with provenance.** The three documented row moves
   (`justice_funding` −60,906, `gs_relationships` +124%, `political_donations` +744%) are inserted
   into `clarity_event` dated 2026-04-02 with `note = 'reconstructed from
   thoughts/shared/handoffs/frontend-data-audit/db-inventory.md, 2026-04-02'` and
   `severity='critical'`, `reason IS NULL`. They appear as unexplained anomalies on the first
   render, which is exactly what they are.

---

## 10. LIBRARIES, PERFORMANCE, AND WHAT I REFUSE TO ADD

### 10.1 Two libraries used. One dependency added. Zero maps.

| Library | Status | Use in `/clarity` |
|---|---|---|
| **inline SVG** (no library) | — | every sparkline, strip chart, coverage bar, heat block, drift chart. ~25 lines per component. Mounting 1,433 recharts instances is not an option. |
| `recharts` ^3.7.0 | installed | **one** use: bench section detail charts, where axes / tooltips / legends are genuinely needed (e.g. the QLD watchhouse monthly series) |
| `react-force-graph-2d` ^1.29.1 | installed | **one** use: the SEAMS constellation, ≤140 nodes, degree-limited, behind `g`, refuses above 200 |
| `leaflet` / `react-leaflet` | installed | **zero uses.** `/clarity` is about the data estate, not places. Maps live at `/atlas` and `/clarity` links to them. |
| `@tanstack/react-virtual` | **ADD** | the one addition. Headless, ~3 KB, no styling, not a viz library. |
| `d3-sankey`, `maplibre-gl`, `pmtiles`, `nuqs`, `cosmograph`, `deck.gl`, `cytoscape` | **DECLINED** | none earns a place on this surface |

**Justification for the single addition.** Ben asked for "absolutely every piece of data". At
column grain that is **14,310 rows**. At 22px in plain DOM that is 315,000px of layout, which
either hangs the browser or forces pagination — and pagination is banned by the density thesis and
by the literal request. `@tanstack/react-virtual` is the difference between the promise being true
and being a lie. The research names it for exactly this [R: research-dashboards §3.6]. The 1,433-row
object ledger does **not** need it — plain DOM is fine and simpler there.

**Why d3-sankey is declined.** The money-flow Sankey is a real and good idea, and it belongs at
`/atlas` or in a report, seeded by a bench section. Putting it inside the instrument would make
`/clarity` a second gallery of the visualisations it exists to monitor — which is precisely the
fragmentation failure mode [R: research-dashboards §2.4] and the "five power maps" problem
[R: existing-surfaces].

**`/clarity` does not host the visualisations. It commissions and monitors them.** Every bench
section carries a `surface` pointer, and the bench's last row is `+ 9 unlanded` — nine
cross-sections that are computable and have nowhere public to live. That is a better answer to
"the best possible maps and analytics" than adding a tenth map here, because it makes the *absence*
of the map a tracked, visible work item.

### 10.2 Performance budget

Every board reads catalog-sized objects. **No board query touches `gs_entities`,
`gs_relationships`, `austender_contracts`, `abr_registry`, `political_donations` or
`asic_companies`.** All the expensive measurement happens in the nightly job [R:
clarity-data-layer §7 — ≈4.5 minutes, run from psql/pg_cron, never through the app because of the
8-second `statement_timeout`].

| Board | Queries | Largest row set | Payload | Target TTFB |
|---|---|---|---|---|
| chrome (watch strip) | 1 | ~1,433 aggregated to 8 scalars | 1 KB | 80 ms |
| 1 BOARD | 6, parallel, per-`<Suspense>` | 1,433 | ~20 KB | 250 ms |
| 2 LEDGER | 1 | 1,433 × ~26 cols | **~420 KB inline in the RSC payload** | 400 ms |
| 2 LEDGER, columns mode | 1 | 14,310 × 8 cols | ~1.1 MB, fetched on demand | 600 ms |
| 3 SEAMS | 1 | ~1,415 | ~180 KB | 300 ms |
| 4 DEFECTS | 2 | 23 + 112 heat cells | ~30 KB | 200 ms |
| 5 BENCH | 1 + registry | 16 | ~15 KB | 150 ms |
| 6 TAPE | 3 | ~1,300 events | ~150 KB | 300 ms |
| object panel | 6 small | ~200 | ~15 KB | 120 ms |

The 420 KB ledger payload is the deliberate architectural choice: **ship the whole ledger to the
client and filter in memory**, which meets Shneiderman's <100 ms dynamic-query goal with zero
round-trips [R: research-dashboards §3.1]. 1,433 rows is small; that is the advantage of not being
Airbnb.

`revalidate = 300` on all six boards (the underlying snapshot changes once a night), with the
object panel and bench runs uncached.

### 10.3 Schema amendments this design requires

All **additive**, on top of the three unapplied `clarity_*` migrations [R: clarity-data-layer §3].
They are deliverables to be written, left unapplied, with the apply command in the header.

1. **`clarity_delta`** — `(object_key, baseline, row_delta, row_delta_pct, bytes_delta,
   degree_delta, importance_delta, freshness_delta_hours, state_change, is_new, is_missing,
   computed_at)`, PK `(object_key, baseline)`, written nightly for the four baselines. This is what
   makes every delta on every board a single indexed read instead of a join to history.
2. **`clarity_event`** — the tape. `(id, at, event_type, object_key, metric_key, before, after,
   severity, note, reason, reason_by, reason_at)`. `event_type` enum: `row_moved · object_new ·
   object_missing · state_change · scope_change · refresh_failed · sentinel_fired · metric_crossed
   · probe_degraded`.
3. **`clarity_gap_metric`, add columns** — `label`, `unit`, `board_slot`, `display_order`,
   `polarity CHECK IN ('higher_is_better','lower_is_better')`, `threshold numeric`,
   `threshold_direction`, `names_objects text[]`.
4. **`clarity_edge`, add columns** — `match_rate numeric`, `rows_at_stake bigint`, `grain text`,
   `measured_at timestamptz`; plus **`clarity_edge_history`** for the seam trend column.
5. **`clarity_watch`** — pinned objects/metrics with per-row thresholds.
6. **`v_clarity_metric_latest`** — the latest measurement per metric with `breached` and
   `sentinel_fired` computed, so no board re-derives them.
7. **`v_cron_jobs`** — a `SECURITY DEFINER` view over `cron.job` + `cron.job_run_details` granted
   to `service_role` only. **[U] I did not verify that the app's role can reach the `cron` schema;
   assume it cannot.** If this cannot be granted, the CRON cell in the watch strip renders `?` with
   the reason, which is the correct behaviour anyway.

Two things this design **does not** add: it does not create a third governance table (it reads
`data_catalog`'s existing 21 columns), and it does not create a fourth scope mechanism (it reads
the other session's `catalog_object_scope`, four values, `unclassified` visible-and-flagged
[R: clarity-data-layer §7.2b]).

### 10.4 Copy deck for the constrained strings

These exact strings, enforced by `bench-registry.test.ts`'s `neverSay` grep:

| Never render | Always render |
|---|---|
| "has no evidence" | "no evidence record linked · 1,277 of 2,136 interventions carry one" |
| "this org has no funding" | "no funding row in this dataset · rollup reaches 15.4% of the spine" |
| "$0" for an unplaced area | "not visible in this data · remote NT/WA/SA funded via land councils whose registered address credits the hub" |
| "unused" | "no reference found in app code, scripts, DB functions, triggers or view lineage" |
| an empty cell | one of the ten glyphs in §3 |
| "0" for a failed probe | `?` plus the recorded probe reason |
| "up to date" | the timestamp and its age |

---

## 11. BUILD ORDER

Vertical slices, each shipping something usable. The first slice is deliberately not the prettiest
one — it is the one that starts the clock, because every day the nightly job does not run is a day
of history this design cannot recover.

| # | Slice | Days | Ships |
|---|---|---|---|
| 0 | Apply the three `clarity_*` migrations + the §10.3 amendments; write `scripts/snapshot-clarity.mjs`; register in `agent_schedules`; **backfill from `data_catalog_snapshots` and seed the three known events** | 1.5 | the clock starts |
| 1 | Chrome: layout, watch strip, command bar, baseline, `glyphs.ts`, `glyph-coverage.test.ts` | 1 | the health strip alone answers "can I trust today's numbers" |
| 2 | BOARD 2 LEDGER + object panel + permalink | 2 | the literal ask: every object, every column, no pagination |
| 3 | BOARD 1 THE BOARD | 1.5 | the daily visit |
| 4 | BOARD 6 TAPE + the anomaly rule | 1 | the thesis becomes operational; nothing is lost silently again |
| 5 | BOARD 4 DEFECTS + heat block | 1 | the 23 metrics become monitored, not measured-once |
| 6 | BOARD 3 SEAMS (table first, `g` graph second) | 1.5 | the four broken joins become the top four rows |
| 7 | BOARD 5 BENCH + registry + CI guards | 2 | the cross-sections stop being a document |

**Slices 0–2 are the minimum that satisfies the literal request.** Slice 4 is the one that
justifies the direction. Slice 7 is the one that makes it Ben's project rather than a good
internal tool.

---

## 12. WHAT THIS DIRECTION HANDLES WORSE

Five honest ones. The first is structural and I cannot argue it away.

**12.1 The cold start. My thesis is weakest exactly when the tool is newest.**
Every delta, sparkline, burn-down and anomaly is `?` on night one. An atlas is fully useful on
night one; this is useful in about a month. §9.4's backfill gives 25 objects real history and
seeds three known events, which is honest but partial — the other 1,408 objects render `?` for
thirty nights. If Ben opens this on day two and sees a wall of yellow question marks, the design
has to survive that impression on the strength of the LEDGER alone. **This is the strongest
argument against my direction and the reason slice 0 is first.**

**12.2 First-visit orientation. There is no "start here".**
THE BOARD is a wall of numbers with no narrative. A newcomer — or Ben after three months away —
gets no story, no guided path, no sense of what the database *is about*. The atlas direction wins
this outright: its domain constellation and its overview→zoom ladder teach the corpus. My
mitigation is one prose line in the chrome and the domain tiles' labels, and that is a mitigation,
not a solution. If more than one person ever uses this, the gap widens.

**12.3 Serendipity is suppressed by construction.**
Everything is ranked, thresholded and alarm-driven. The 199 objects with 1–9 rows [R] and the small
weird tables where a forgotten treasure might sit are pushed below the fold by the importance
score, permanently — `abr_registry`, the largest object in the database, sits at rank 56 because
no product surface reads it [R: clarity-data-layer §4.2]. An atlas invites wandering and wandering
is how you find the thing you were not looking for. My mitigations are real but partial: sort-by-
rows and sort-by-bytes as first-class controls, and the `ALL 1,433` segment. Neither invites
browsing the way a constellation does.

**12.4 Nothing here is shareable outside the operator's head.**
Nobody screenshots a terminal for a funder deck, an op-ed or a board paper. The atlas's hex maps,
constellations and Sankeys are the artefacts that travel. My design's answer — the bench's
`surface` pointer and its `+ 9 unlanded` counter — is a way of *tracking* that gap, not filling it.
If the immediate need is a picture that makes someone fund this, the atlas direction delivers it
and mine does not.

**12.5 Single-operator by design; hostile at 1440px and dead below it.**
No account model, no per-user thresholds, no alarm-fatigue handling, no notification routing. If
`/clarity` ever serves a team, the watch strip becomes noise for everyone whose job is not the
thing that fired, and that is a real product problem I have not designed for. And the density is
non-negotiable: this is a 1440px minimum surface with no responsive story. The atlas degrades
gracefully to a laptop and a phone; the instrument does not degrade, it breaks.

**12.6 One risk that is not a trade-off, just a risk.**
The whole design assumes the nightly `clarity_refresh()` runs and finishes. It has **never been
executed** — the migrations and the function are written, reasoned about, and unapplied
[R: clarity-data-layer §8]. If the 4.5-minute job proves fragile under a shared pooler, the
instrument degrades to a stale-numbers reader with a yellow strip across the top, which is honest
but not what was designed. Slice 0 should run the job three nights before slice 1 is written.

---

## 13. VERIFIED · INFERRED · NOT CHECKED

**Verified by me this session [V]:** `agent_runs` 7-day status split (187 success / 41 timed_out /
14 failed / 10 partial / 3 running, 50 distinct agents); `mv_refresh_log` latest-per-matview
(44 logged, 39 last-status success, last finish 2026-08-13 17:30 UTC); the column lists of
`agent_runs`, `agent_schedules`, `mv_refresh_log`, `data_catalog_snapshots`; that `.ws` exists in
`globals.css` at line 116 and reduces 4px borders to 1px; that `requireAdminPage` exists at
`src/lib/admin-auth.ts:40`; that both `getServiceSupabase` and `getDirectServiceSupabase` exist in
`src/lib/supabase.ts` (159, 167); the 14 domain names with their object and row counts from
`CANONICAL-DATA-MAP.md`.

**Relayed from this exercise's verified documents [R]:** all 1,433 / 714 / 98 / 212 / 409 counts,
the 52,349,579 rows and 28 GB; the ranking's top 30 and the rank-183-first-view finding; all 23 gap
metric values; the 8-second `statement_timeout` proof and the `SET LOCAL` no-op finding; the
matview registry reconciliation and the metric-5→5b flip; the ACT scope taxonomy; the three
historical row-count moves; the orphaned `/api/data/schema-graph` and its `n_live_tup` and
`TABLE_DOMAIN` bugs; the installed library versions; the visualization ceilings (2,345 nodes at
2 hops, 30–150 on screen, ≤10 nodes per Sankey stage); the QLD watchhouse and cross-section
numbers.

**Inferred [I]:** the row heights, panel proportions and per-board TTFB targets; the claim that
seam-as-a-row beats seam-as-an-edge for these four specific defects (it follows from the defects
being about match rate, which a node-link diagram does not encode, but I did not test it with a
user); the burn-down velocity framing; that a 420 KB inline RSC payload is acceptable here (it
follows from 1,433 × 26 columns but I did not build it and measure).

**Not checked [U]:** whether `agent_runs` has an index on `started_at`; whether the app's role can
read the `cron` schema at all; whether `clarity_refresh()` runs end to end (it has never been
executed by anyone); the actual rendered width of any wireframe above — none of this was built or
loaded in a browser; whether `@tanstack/react-virtual` installs cleanly against React 19 / Next 15
in `apps/web`; whether the three unapplied `clarity_*` migrations parse in Postgres (they were
lint-checked for shape, not executed).
