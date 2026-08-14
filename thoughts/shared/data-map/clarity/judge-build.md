# JUDGE — BUILDABILITY AND HONESTY

Lens: could an engineer build this from the spec, on the real data, in this codebase, without
discovering three weeks in that a panel is impossible? Honesty scored as highly as ambition.

Judged 2026-08-14 against the real drafted DDL, the real `package.json`, the real codebase, and
direct psql against `tednluwflfhxyucgwigh`. Every finding below marked **[V]** I checked myself in
this session; **[G]** is a PostgreSQL grammar certainty I did not execute; **[R]** is relayed.

| Design | Score | One-line verdict |
|---|---|---|
| **THE ATLAS** | **9 / 10** | Its central query compiles verbatim against the real DDL, its node caps are measured not asserted, it adds zero dependencies, and its weakness list is the longest and least flattering of the three. |
| **THE INTERROGATOR** | **8 / 10** | The most honest treatment of *claims* by a distance, every want-list blocker verified exact — but its migration will not apply as written, and its front door is 23 unwritten SQL statements. |
| **THE INSTRUMENT** | **7 / 10** | The sharpest single ideas in the exercise, undermined by four unflagged column-name errors, one concrete architecture error that SSR-crashes on day one, and a thesis that is inert for thirty nights. |

---

## 1. WHAT I VERIFIED MYSELF

Before scoring I checked the claims all three designs stand on. This is the evidence base.

### 1.1 The codebase

| Claim | Reality |
|---|---|
| `recharts ^3.7.0`, `react-force-graph-2d ^1.29.1`, `leaflet ^1.9.4`, `react-leaflet ^5.0.0` installed | **[V] TRUE**, `apps/web/package.json` |
| `@tanstack/react-virtual` installed | **[V] FALSE** — not present. Instrument's one addition |
| `d3-sankey` / any `d3` installed | **[V] FALSE** — not present. Interrogator's slice-6 addition |
| `topojson-client` installed | **[V] FALSE** — and **no design declares it** (see §4.2) |
| `requireAdminPage` exists | **[V] TRUE**, `apps/web/src/lib/admin-auth.ts:40` |
| `getDirectServiceSupabase` / `getServiceSupabase` | **[V] TRUE**, `supabase.ts:167` / `:159`; the `/app/reports/` stack-sniff stub is real at `:153-157` |
| `.ws` workspace theme | **[V] TRUE**, `globals.css:116` |
| `/clarity` route exists | **[V] FALSE** — free to claim |
| `/api/data/schema-graph/route.ts`, 280 lines, orphaned | **[V] TRUE**. Header comment at line 11 literally says *"Powers the interactive Obsidian-style schema visualization on /clarity"*. `TABLE_DOMAIN` at :30 with `if (!domain) continue;` at :151. `WHERE n_live_tup > 0` at :109 — so on an instance where `n_live_tup` is broken it silently drops whole tables. All three designs describe this correctly |
| The working `react-force-graph-2d` pattern in this repo | **[V]** Both existing usages (`app/graph/page.tsx`, `app/entity/[gsId]/network-graph.tsx`) are `'use client'` + `dynamic(() => import('react-force-graph-2d'), { ssr: false })` **inside the client file** |
| `exec_sql` reachable from the app runtime | **[V] TRUE for reads.** `fullyBlockedSqlRpcNames = {exec, execute_sql, exec_agent_sql}`; `exec_sql` passes when `isReadOnlyExecSql()` matches `^(select|with)` with no stacked statements. So Interrogator's stored-`rows_sql` path is viable |

### 1.2 The database

| Claim | Reality |
|---|---|
| `mv_gs_entity_stats` indexed on `gs_id` (Atlas marked this **unchecked**, Q15 depends on it) | **[V] TRUE** — `idx_mv_gs_es_gs_id`. Also indexed on `id` (unique), `abn`, `total_relationships DESC`. Atlas's pre-flight is sound |
| `gs_relationships` indexed for Atlas's Q16 ego query | **[V] TRUE and better than assumed** — `idx_gs_rel_source_type_amt (source_entity_id, relationship_type, amount DESC NULLS LAST, id)` and the target mirror. Atlas's `WHERE source_entity_id=$1 AND relationship_type = ANY($2) ORDER BY amount DESC NULLS LAST LIMIT 200` is index-covered |
| `agent_runs` indexed on `started_at` (Instrument marked **[U]**, "assume it needs adding") | **[V] Instrument was right — it does not exist.** Indexes are on `id`, `agent_id`, `completed_at DESC`, `status`. Non-fatal: `agent_runs` is **6,117 rows** |
| `service_role` can read `cron.job` (Instrument marked **[U]**) | **[V] Half true, and Instrument's caution was correct.** `has_table_privilege('service_role','cron.job','SELECT')` = **t**, but `has_schema_privilege('service_role','cron','USAGE')` = **f**. A direct read fails. Its proposed `SECURITY DEFINER v_cron_jobs` is exactly the right fix, and its stated `?`-with-reason fallback is the right default |
| Atlas's flagship finding: the two largest graph nodes are procurement *categories* | **[V] EXACT.** `Specialised Supplies and Services` / program / **330,460**; `Specialised Support Services` / program / **274,675**; `Department of Defence` / government_body / 270,864; ALP 102,594; ALP-QLD 98,465; Safe Places 81,994. `mv_gs_entity_stats` = **400,276** rows, matching its 209,172-isolate derivation |
| Interrogator's flagship [V] claim, re-run by me | **[V] EXACT REPRODUCTION.** 662 orgs / $663.9m unlinked · 116 / $478.2m linked = 85.1% of 778. My wall clock 1,345 ms vs their reported 279 ms — different load, both far inside their own 5 s `live_rerun_ok` gate |
| Interrogator's want-list blockers | **[V] ALL FIVE EXACT.** `abs_indigenous_population_by_lga` **0** · `mv_board_contractor_links` **4** · `mv_board_donor_links` **2** · `mv_multi_board_persons` **1** · against `mv_board_interlocks` **39,757** |
| `catalog_object_scope` / `mv_refresh_registry` exist | **[V] NEITHER EXISTS.** The parallel session's five migrations are unapplied. All three designs depend on `scope` in some form (see §4.4) |

### 1.3 The drafted DDL — the thing every panel actually has to compile against

I read `supabase/migrations/20260815000000_clarity_catalog_schema.sql` in full. The real column
names, which matter more than any wireframe:

```
clarity_object       ... no `scope`, no `position`, no `layout_x/y`, no `has_*` flags
                         (the has_* flags live on v_clarity_ledger)
clarity_column       ... null_pct, distinct_est        NOT fill_rate / null_fraction /
                         distinct_count; and there is NO fk_target column at all
clarity_edge         ... match_rate, match_numerator, match_denominator, match_method,
                         match_measured_at, note, declared, mechanism
                         NO rows_at_stake, NO grain, NO edge_key, NO scope;
                         NO clarity_edge_history table
clarity_object_history ... snapshot_at                 NOT captured_at
clarity_gap_metric   ... metric_key,title,family,question,numerator_sql,denominator_sql,unit,
                         direction,target,cost_class,enabled,note
                         NO label/board_slot/display_order/polarity/threshold/
                         threshold_direction/names_objects/sql_text/last_measured_at
clarity_gap_measurement ... numerator, denominator, value, measured_at, status, duration_ms
v_clarity_ledger     ... o.* + owner_team,pii_level,sla_hours,licence,public_export,
                         public_caveat,source_url,catalog_description,catalog_linked,
                         has_domain,has_purpose,has_owner,has_join,has_use,is_fresh,
                         exposure_conflict
```

This is the single most discriminating test in the exercise, and the three designs score very
differently on it.

---

## 2. THE ATLAS — 9 / 10

### Why it scores highest on buildability

**Its most important query compiles verbatim.** The estate payload (§6.2) is the query everything
on L0 depends on — the mosaic, the ledger, the rail's facet counts, the minimap. I checked all 30
selected fields against `v_clarity_ledger`: **every one exists.** `row_count_probe`,
`freshness_probe`, `refs_db_function`, `owner_app`, `anon_readable`, `security_invoker`,
`exposure_conflict`, `act_business`, `has_purpose`, `has_owner`, `has_join`, `has_use`, `is_fresh`,
`pii_level` — all real. No other design's flagship query does this.

**Its coverage-scalar query also compiles verbatim.** `title, question, numerator, denominator,
value, unit, direction, target, measured_at, status` across `clarity_gap_metric` ⋈
`clarity_gap_measurement` — all real columns. Compare Instrument's equivalent, which invents seven.

**Its node caps are measured, not asserted.** It ran the degree distribution itself and got
p50 = 2, p95 = 23, p99 = 84, max = 330,460, 2,594 nodes over 150. That is the only empirical answer
in the exercise to "does this node-link view exceed the ~150-node ceiling", and it produces three
designed states rather than one cap: **draw it** (99%+ of connected nodes), **Hub Sheet** (2,594),
**Isolate panel** (209,172 entities, 34.3%, with the text written out as a fact about the database).
The L1 constellation is bounded by construction — largest civic domain is D13 at 104, plus ≤15
spokes = ≤119 — and `UNFILED` (621) always refuses to the matrix. **[V]** I confirmed the top-6 hub
list and `mv_gs_entity_stats` = 400,276 exactly.

**Zero dependencies added.** **[V]** Verified against `package.json`: recharts, react-force-graph-2d
and inline SVG cover every form it proposes. It declines `nuqs`, `d3-sankey`, `maplibre`, `deck.gl`,
`cosmograph`, `cytoscape` with a reason each, and defers `@tanstack/react-virtual` on the correct
grounds (≤60 columns per object, not needed).

**Correct Server/Client architecture.** §16.2 states the rule and gets it right: `EgoNetwork.tsx`
and `DomainConstellation.tsx` are `'use client'` files that hold `next/dynamic(..., {ssr:false})`
*inside themselves*, and the Server page imports the client wrapper normally. **[V]** That is
exactly the pattern both working force-graph components in this repo already use. It also names
the `getServiceSupabase()` `/app/reports/` stack-sniff trap and routes around it.

**New DB objects are declared, sized, and priced.** `mv_clarity_flow` carries its own apply command,
a stated max of 1,210 rows (11 × 11 × 10), a `UNIQUE INDEX` for `CONCURRENTLY`, and the honest
reason it must be a matview — it measured the live `GROUP BY` at ~40 s. `clarity_frontier` and
`clarity_null_reason` likewise. §20 lists five preconditions including the three columns its own
design adds that the DDL lacks.

### Why it scores 9 and not 10

| Defect | Severity | Cost |
|---|---|---|
| `clarity_column.fill_rate` **does not exist** — the real column is `null_pct` **[V]**. Used by L2's column profile and all of L2b | Low | Atlas **flagged this itself** in §22 as unchecked. `fill = 100 - null_pct`. One line |
| L1's constellation query selects `has_purpose, has_use` **from `clarity_object`** — they exist only on `v_clarity_ledger` **[V]** | Low | One-word fix |
| `distinct_count` → real name `distinct_est`; no `fk_target` column exists (must be derived from `clarity_edge`) **[V]** | Low | Shape of the column table changes slightly |
| §16.2 says "the client islands are exactly nine" then lists fifteen | Cosmetic | — |
| Six levels × four forms × eight lenses × a refusal registry, for a one-to-two-person team | **Real** | Atlas names it itself (§21.4) as ~3× the component count of a ledger |
| L5's whole promise is provenance, and the flagship drill path (edge → grant) is **0.0%** | **Real** | Atlas names it itself (§21.7). Mitigated by L5 being step **9 of 10** — the exposure arrives late and pre-announced |
| Frozen mosaic `position` + offline per-domain force layout need a nightly write step not in the specced runner | Low | One more step in `snapshot-clarity.mjs` |

### Honesty

The best in the exercise, and it is not close on one specific axis: **Atlas is the only design that
flags placeholder numbers inside its own wireframes.** §22: *"The per-cell figures inside the L3
wireframe (41,882 edges · $2.1bn · amount present on 71%) are illustrative placeholders for one
cell, not measurements."* Both other designs have wireframes dense with numbers that read as real
and are not marked. On a surface whose entire purpose is telling the truth about numbers, that is
the correct instinct.

§21 is eight named weaknesses, several genuinely damaging: *"time to first value is roughly 3× a
flat ledger… if the real need is an audit pass this month, the ledger direction wins outright and I
would say so"*; *"known-item search is genuinely worse, and the fix is a mitigation not a cure"*;
*"the deepest level is where the data is weakest, which is embarrassing for a design whose payoff is
depth."* §17 marks every one of nineteen cost estimates **[I]** and states plainly that none of
Q1–Q19 was executed. §22 says *"I did not load a single page in a browser."*

---

## 3. THE INTERROGATOR — 8 / 10

### Why it scores high

**Its measurement discipline is real, and I tested it.** I re-ran the flagship evidence-gap query
and reproduced 662 / 778 orgs and $663.9m / $1,142.1m **exactly** **[V]**. I checked all five
want-list blockers and every count is exact **[V]**. It also re-derived a number the source document
got wrong — OPPORTUNITY-MAP reported mean months-of-reserves; it ran the median and got **773
fragile charities at a median 0.9 months** — and shipped the median as the registered `answer_sql`,
so the screen and the doc cannot disagree again. That is the whole thesis working on itself.

**Its 8-second-ceiling handling is the cleanest of the three.** `live_rerun_ok` is set *by the
runner from measured duration*, not by a guess. Its three measured questions (279 ms / 196 ms /
3,076 ms) put `interlocked-boards` on the snapshot-only side of the line for a stated reason.
**[V]** I confirmed the `exec_sql` read path is actually open in the app runtime, so its stored-SQL
`rows_sql` and `rerun` routes are viable — a real risk I expected to find fatal and did not.

**Its CHECK constraints do real work.** `executable_or_blocked` makes "a question that neither runs
nor says why" impossible to insert. `blocked_has_a_price` forces every blocked question to state its
cost. `caveat NOT NULL CHECK (length(btrim(caveat)) > 20)` generalises `atlas/layers.ts` from places
to claims. `clarity_one_binding` forces exactly one join to own the coverage number — which is
precisely the "striking finding with 4% join coverage" liability, closed structurally.

**Correct Server/Client architecture** — §9 puts the `next/dynamic` import inside
`joins/join-map-client.tsx`, never in the Server Component. Zero new deps through slice 5, verified.

**Slice 1 is honestly scoped**: three questions end to end, all three measured under 300 ms today.
Not 26. It says so explicitly.

### The defects

| Defect | Severity | Note |
|---|---|---|
| **`PRIMARY KEY (question_slug, object_key, coalesce(join_key,''))`** on `clarity_question_ingredient` | **HARD — the migration will not apply** | **[G]** PostgreSQL's table-constraint grammar takes a column list, not expressions; only `CREATE UNIQUE INDEX` accepts expressions. Slice 1 is gated on this migration. Fix: `join_key text NOT NULL DEFAULT ''` + plain PK. One line, but it is a migration that fails at parse |
| `hexmap` form = "static hex TopoJSON + inline SVG", but **no topojson library is installed** **[V]** and the design states *"`d3-sankey` is the only proposed addition"* | Medium | Either pre-bake hex paths as SVG (fine, but say so) or declare `topojson-client`. Slice 6, so late |
| Join map wireframe offers `depth=2` with **no stated refusal rule at depth 2** | Low | Every other node-link surface in all three designs has one |
| Front door does not answer the literal ask — 26 cards, one summary line for 1,433 objects | **Real** | Conceded openly in §11.1 as *"a deliberate refusal of half a stated requirement"* |
| **Curation debt: 23 of 26 questions have SQL nobody has written.** Three weeks in, the discovery is not "a panel is impossible" — it is "we have 3 questions and 23 empty cards" | **The main risk** | Named by the design itself as *"the strongest argument against me"* (§11.2) |
| "A question can go silently wrong in a way a row count cannot" | **Real** | Named in §11.3. It adds a *confident* failure mode the other two do not have |

### Honesty

Highest of the three on the *claim* axis, which is the axis this project has actually been wrong on.
It ships `two-purses` with an **UNVERIFIED** stamp because `VERIFICATION.md §9` did not re-measure
it. It ships `ministerial-diaries` with a **PILOT** band because 1,728 meetings is a demo, not a
corpus. It lists by number the twelve seed questions it did not personally run. §11 is seven named
weaknesses including one it explicitly refuses to concede — which is the right way to disagree.

---

## 4. THE INSTRUMENT — 7 / 10

### The ideas are the sharpest in the exercise

I want to be clear that this ranks third on *my* lens, not on invention. Three of its ideas are the
best individual ideas produced by anyone here (§5), and one of them — the seam board — I would build
first.

Its verification instincts were also correct where it mattered most. It flagged **[U]** that
`agent_runs` might lack a `started_at` index (**[V]** it does), and **[U]** that the app role might
not reach the `cron` schema (**[V]** `service_role` has SELECT on `cron.job` but **no USAGE on the
schema**, so a direct read fails and its `SECURITY DEFINER v_cron_jobs` proposal is exactly right).
Both flags were right, and both carried a stated fallback.

### What costs it

**A concrete architecture error that crashes on first render.** §2: *"No `next/dynamic` anywhere;
the force graph lives in a client file that a client parent imports normally."* This is wrong.
Client Components are still server-rendered for the initial HTML, and `react-force-graph-2d`
touches `window` at module scope. **[V]** Both existing usages in this repo use
`dynamic(..., {ssr:false})` inside the client file, and both other designs specify it. This is a
three-line fix, but it is the author asserting an architecture rule they got backwards — an
over-application of CLAUDE.md's "never `next/dynamic` in a Server Component."

**Four unflagged column-name errors against the real DDL** — the discriminating test:

| Instrument writes | Real column **[V]** |
|---|---|
| `clarity_column.null_fraction` | `null_pct` |
| `clarity_column.distinct_count` | `distinct_est` |
| `clarity_column.fk_target` | **does not exist at all** — must be derived from `clarity_edge` |
| `clarity_object_history.captured_at` | `snapshot_at` |
| `clarity_gap_metric.last_measured_at` (joined on in §5) | does not exist, and is **not in its own amendment list** |

Contrast Atlas, which got `snapshot_at` right and flagged `fill_rate` as unchecked. Instrument
flagged none of these. It is fair to note the counterweight: Instrument is the **only** design that
enumerates its schema amendments as a numbered list of deliverables (§10.3, seven items), and it
correctly declares `clarity_delta`, `clarity_event`, `clarity_watch`, `v_clarity_metric_latest`,
`v_cron_jobs`, four `clarity_edge` columns and `clarity_edge_history`. It just also uses several
columns it never declared and several that exist under other names.

**Two more declared-but-missing**: its SEAMS query uses `e.edge_key` and `e.scope`, neither in
`clarity_edge` nor in its own amendment list.

**A new dependency, unverified.** `@tanstack/react-virtual` **[V]** is not installed; React 19 /
Next 15 compatibility flagged **[U]**. Low risk, correctly declared.

**And the structural one, which it leads with.** §12.1: every delta, sparkline, burn-down and
anomaly renders `?` on night one, and 1,408 of 1,433 objects render `?` for thirty nights. Its
thesis — *"the state is not the signal, the derivative is"* — is inert exactly when the tool is
newest. Its mitigations (backfill 25 objects from `data_catalog_snapshots`, seed three known events)
are the best cold-start answer anyone gave, and they are also partial by its own admission. Six
boards, a watch strip, a command bar, 23 monitored metrics and 16 bench sections is the largest
surface of the three, for a payoff that arrives in a month.

**One risk it names that is not a trade-off**: the whole design assumes `clarity_refresh()` runs and
finishes, and it *has never been executed by anyone*. If the 4.5-minute job proves fragile under the
shared pooler, the instrument degrades to a stale-numbers reader with a yellow bar. It says exactly
this (§12.6) and puts a three-night burn-in ahead of slice 1. That is the right call and it is
honestly made.

### Honesty

Very high — §12 is six weaknesses, §13 splits [V]/[R]/[I]/[U] cleanly, and §12.1 leads with the one
that is fatal-if-true to its own thesis. Its unflagged DDL slips are the gap between its honesty
about *design* and its rigour about *schema*.

---

## 5. THE BEST TRANSPLANTABLE IDEAS

Ranked by value, with the host named. Several of these come from the design I rank lowest.

### From THE INSTRUMENT (ranked 3rd)

**1. THE SEAMS BOARD — a join is a row, not an edge, ranked by `rows_at_stake × (1 − match_rate)`.**
The best single idea in the exercise. The four defects Ben actually cares about sort to the top four
rows: `gs_relationships.source_record_id → justice_funding` 0.00% / 49,426 edges; donations ABN
25.1% / 1.9M rows; `ndis_participants_lga.lga_code` 0.00% / 8,329; `mv_funding_by_lga` grain at 3.16
rows per key. Not one of those is visible in a force-directed graph. Atlas has a *per-object* join
ledger (§8) and a *per-domain-pair* join matrix (§10.4) but no global "the most expensive broken
connection in this database is ___, and it is costing ___ rows."
**Host: ATLAS**, as a route between L2 and L3, reusing Atlas's already-correct
`clarity_edge` query and adding Instrument's `rows_at_stake` / `grain` / `clarity_edge_history`
amendments. Its own sort inversion — broken first, unmeasured last — Atlas already has.

**2. THE TAPE + the anomaly rule.** One boolean and a text box: any object where
`|row_delta| / prev > 0.10`, or a zero crossing, or `missing_since` set, writes a
`severity='critical'` event that stays **NO REASON RECORDED** in red until a human writes one. This
is the mechanism that would have caught `justice_funding` 218,022 → 157,116. Atlas has a history
sparkline and no alarm — it would render the loss perfectly and notice nothing.
**Host: ATLAS**, in the gap gutter plus a filtered view. Not as a seventh level.

**3. The cold-start backfill.** Seed `clarity_object_history` from `data_catalog_snapshots`' 1,419
real rows over the 25 spine tables, and insert the three documented row-moves into the events table
with `note = 'reconstructed from db-inventory.md, 2026-04-02'` and `reason IS NULL`. Atlas's L2
history sparkline is empty on day one and it never says how it gets filled.
**Host: ATLAS build step 0.**

**4. The burn-down clause.** `PURPOSED 812/1,433 · +0 in 30d · 621 to go · at 0/wk: never`. Atlas's
nine coverage scalars are static percentages — inert exactly as Instrument argues. Velocity + ETA is
a few lines and turns a metric into a decision.
**Host: ATLAS's `<CoverageBar>` and the gap gutter.**

**5. `glyph-coverage.test.ts`** — the build fails if any cell renderer has a code path that returns
empty. Atlas has a six-glyph alphabet and a copy lint but no *structural* guarantee a cell is never
blank. Two hours, permanent.
**Host: ATLAS's `glyphs.ts`.**

**6. The third absence state.** Atlas splits `+` (never measured) from `×` (measured, zero) —
correct and better than one glyph. Instrument adds `?` for *the probe could not establish an answer*
(the 18 timing-out views, the 97 matviews with no freshness column, `acnc_ais` deferred). "We
haven't looked", "we looked and it's zero", and "we looked and could not tell" are three states.
**Host: ATLAS's alphabet, as a fourth glyph** — with Instrument's rule attached: *never store a
timeout as 0.*

### From THE INTERROGATOR (ranked 2nd)

**7. `FEEDS n` / `BLOCKS n` as ledger columns, and the ANSWERS/BLOCKS band on the object dossier.**
The best graftable idea in the exercise. Fully derived, zero curation, and it answers the one thing
a catalog row can never answer alone — *what is this FOR*. `FEEDS 0` sorted ascending and filtered
to `rows > 1M` is a two-click answer to "what enormous thing am I not using": `abr_registry` 20.0M,
`asic_name_lookup` 2.1M, `privacy_audit_log` 1.28M. It also fixes a problem **Atlas admits it has** —
`abr_registry` sits at rank 56 on importance and falls below the fold forever.
**Host: ATLAS L0 ledger + L2 header.**

**8. The question registry itself, as a layer on the Atlas rather than its front door.** Atlas
already has `clarity_frontier` (gap + unlocks + effort + leverage) and §10.5's "saved
cross-sections" in `cross-sections.ts`. Interrogator's `clarity_question` is the same object done
properly: `state`, `answer_sql`, `coverage_sql`, `rows_sql`, one binding join, `caveat NOT NULL`,
`claim_phrasing`, `forbidden_phrasing`, `honest_at`, `publishable`, `defamation_sensitive`,
`unlock_effort`, `measured_ms`, `live_rerun_ok` — plus the two CHECK constraints that make a
half-written entry fail to insert rather than rot. This is the largest transplant and the one that
turns Atlas's L3 from "four matrices" into a registry of everything this database can and cannot
answer.
**Host: ATLAS** — replace `clarity_frontier` + `cross-sections.ts` with
`clarity_question` / `_ingredient` / `_answer` / `clarity_sentinel`. **Fix the PK expression bug on
the way in.**

**9. The `refused` form as a first-class rendered object with its own route.** Atlas has a refusal
*contract* and refusal *panels*, but a refusal is always a substitute for something. Interrogator
gives `detention-by-lga` a full card and a full page that renders **no chart at all**, names the
source (13 rows, one year, `source_table='PDF_HEADLINE'`, NT missing), offers what can honestly be
shown instead, and prices the fix. A refusal stated in public is a finding.
**Host: ATLAS**, as `form: 'refused'` in the `ClarityView` registry plus a real route.

**10. The sample-size track.** One extra `<rect>` row under every time series showing n per bucket.
`VERIFICATION.md §4` found every headline watchhouse figure anchored on a first bucket of **n = 2**,
and nobody caught it for a day because a line chart draws its first point as confidently as its
hundredth. Cheapest high-value idea here, and it generalises to every time series in both apps.
**Host: ATLAS's `HistorySpark` and every recharts series.**

**11. `[COPY THE CLAIM]`.** Copying a number also copies the binding join and its measured rate, the
honest-at grain, the deterministic exclusions, the caveat and the permalink. Atlas's `[EXTRACT ▾]`
copies CSV / SQL IN-list / URL — none of the qualifications. A finding travelling naked is the
liability, and this makes nakedness require deliberate effort.
**Host: ATLAS's `ExtractMenu`, as a fourth option.**

**12. `live_rerun_ok` derived from measured duration**, with the refusal printing the measured
duration as its reason. The cleanest possible handling of the 8 s ceiling.
**Host: ATLAS's `/api/clarity/rescore` and any live-run affordance.**

**13. UNVERIFIED / PILOT as registry fields**, not as memory. Epistemic status of the *claim*
becomes a column.
**Host: ATLAS**, on the transplanted question registry.

**14. Three freshness badges, not two: FRESH / STALE / UNMONITORED.** 54 matviews have never
appeared in `mv_refresh_log`. Rendering them "stale" is a guess; blue "we do not know" is the truth,
and it is a different fix with a different owner.
**Host: ATLAS's FRESHNESS lens.**

### What ATLAS holds that neither other design has

Named so the graft does not accidentally discard them: the measured degree distribution and the
three L4 states it licenses (draw / Hub Sheet / Isolate, with the 209,172-isolate empty state
written out as a fact about the database); the **category-node warning**, a live verified defect
that invalidates every centrality score in the product and that nothing else in either repo
surfaces; the persistent frame with level-independent filters, which is the only real answer any of
the three gives to *"click down through levels to see how it connects"*; the equal-area mosaic with
a refused treemap, justified by seven orders of magnitude in row count; frozen `position` +
server-computed layout so nothing moves unless the data moved; and zero new dependencies.

---

## 6. THE WINNER, AND WHAT IT MUST STEAL

### Winner: **THE ATLAS.**

On this lens the decision comes down to one question — *what does an engineer discover three weeks
in?*

- **Atlas:** L0–L3 are populated entirely by the nightly sweep. Zero curation debt. Its riskiest
  panel (L5 provenance, whose bottom rung is 0.0%) is **step 9 of 10** and is pre-announced in its
  own weakness list. Its node caps were measured. Its flagship query compiles. Its dependency count
  is zero.
- **Interrogator:** the discovery is *"we have 3 questions and 23 empty cards"* — a slow failure the
  design names as the strongest argument against itself.
- **Instrument:** the discovery is *"the nightly job that everything depends on has never been
  executed, and 1,408 objects have rendered `?` for a month"* — a fast failure of the premise.

The transplant direction is also one-way. A question registry hangs off a catalog naturally; you
cannot graft a six-level spatial frame onto a card board without rebuilding it.

### What the Atlas must steal to be complete

**Must-have, in build order:**

1. **Interrogator's `clarity_question` registry** replacing `clarity_frontier` and
   `cross-sections.ts` — with the `PRIMARY KEY (…, coalesce(join_key,''))` expression **fixed** to
   `join_key text NOT NULL DEFAULT ''` + a plain PK. Keep both CHECK constraints and the
   `clarity_one_binding` partial unique index verbatim; they are the best schema work in the
   exercise.
2. **`FEEDS` / `BLOCKS`** on the L0 ledger and the ANSWERS/BLOCKS band on L2 — free once (1) lands,
   and it fixes Atlas's own admitted `abr_registry`-at-rank-56 problem.
3. **Instrument's SEAMS board** as a route between L2 and L3, plus the `clarity_edge` amendments
   (`rows_at_stake`, `grain`, `clarity_edge_history`) it already specced.
4. **Instrument's TAPE + anomaly rule + the `data_catalog_snapshots` backfill**, in step 0, so L2's
   sparkline is real on day one and a −60,906 never happens silently again.
5. **Interrogator's `refused` form** as a real route, and the **sample-size track** on every time
   series.
6. **Instrument's burn-down clause** on the nine coverage scalars.
7. **`[COPY THE CLAIM]`** folded into `ExtractMenu`.
8. **Both CI guards**: Instrument's `glyph-coverage.test.ts` and the phrasing test (Atlas already
   has `copy.test.ts`; take Interrogator's per-entry `forbidden_phrasing` array as well as the
   global list).

**Corrections the Atlas must apply before an engineer writes a line — all verified by me:**

- `clarity_column.fill_rate` → **`null_pct`** (`fill = 100 - null_pct`); `distinct_count` →
  **`distinct_est`**; **there is no `fk_target`** — derive it from `clarity_edge`.
- L1's constellation query must read `has_purpose` / `has_use` from **`v_clarity_ledger`**, not
  `clarity_object`.
- **`clarity_object` has no `scope` column**, and **`catalog_object_scope` does not exist yet** —
  derive from `act_business` until the parallel session's migration lands, then switch. Same for
  `mv_refresh_registry`: `mv_clarity_flow` cannot be "registered in `mv_refresh_registry`" until
  that table exists, so sequence behind it.
- Add the three columns Atlas already declared (`layout_x`, `layout_y`, `position`) plus the
  `clarity_edge` columns the SEAMS transplant needs.
- `mv_gs_entity_stats` **is** indexed on `gs_id` — Q15's `<10 ms` assumption holds. `gs_relationships`
  **is** indexed for Q16 including the amount-ordered composite. Both of Atlas's flagged unknowns
  resolve in its favour.
- `agent_runs` has **no** `started_at` index (6,117 rows, so harmless); `service_role` has **no
  USAGE on the `cron` schema**, so any cron panel needs a `SECURITY DEFINER` view or it renders `?`.

---

## 7. WHAT I DID NOT CHECK

- I applied no migration and ran no `clarity_refresh()`. **None of the three designs has ever
  rendered anything**, and neither the DDL nor the refresh function has been executed by anyone.
- I loaded no page in a browser. No claim here about layout, density or perceived performance.
- I did not verify `@tanstack/react-virtual` or `d3-sankey` against React 19 / Next 15.
- I did not re-run Atlas's full degree distribution (p50/p95/p99, the 2,594-over-150 count). I
  verified the top-6 hubs and `mv_gs_entity_stats` = 400,276, both consistent with it.
- I did not run the twelve Interrogator seed questions it also did not run, nor re-check the
  `mv_funding_deserts` grain or the AusTender outlier bands.
- The `PRIMARY KEY (…, coalesce(join_key,''))` failure is **[G]** — certain from PostgreSQL's
  table-constraint grammar (expressions are permitted only in `CREATE UNIQUE INDEX`), not confirmed
  by execution, because executing it would write to the database.
- I did not open JusticeHub's tree, and `existing-surfaces` records another session mid-flight on
  `src/lib/data-observatory/`. Coordinate before step 0.
