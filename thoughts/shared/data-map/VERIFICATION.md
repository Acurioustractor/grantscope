# VERIFICATION — adversarial review of CANONICAL-DATA-MAP / BUILD-SPEC / OPPORTUNITY-MAP

Verified 2026-08-14 by direct psql against `tednluwflfhxyucgwigh`, plus mechanical greps over
`/Users/benknight/Code/grantscope` and `/Users/benknight/Code/JusticeHub`.

**Headline:** the synthesis is unusually accurate on measured numbers — 34 of 41 checks CONFIRMED,
most to the exact digit. It fails in one place that matters more than all the arithmetic combined:
**19 objects on the DELETE/DROP list are read or written by live application code.**

Scoreboard: **CONFIRMED 34 · REFUTED 5 · PARTIAL 2 · NEW (missed entirely) 3.**

---

## 1. Claim-by-claim table

| # | Claim (source doc) | Verdict | Evidence |
|---|---|---|---|
| V1 | Every census object appears in the 3 inventory shards (no silent gaps) | **CONFIRMED** | Word-boundary regex, 812/812 matched, 0 missing |
| V2 | Shards parse to 812 rows × 9 cells, zero missing, machine-readable seed | **CONFIRMED** | Pipe-table parse keyed on col 1: 812 rows, cell-count distribution `[(9, 812)]`, 0 duplicates |
| V3 | `react-force-graph-2d` ^1.29.1 already installed in BOTH repos | **CONFIRMED** | `apps/web/package.json:34` + `JusticeHub/node_modules/react-force-graph-2d`. GS also has `react-force-graph-3d`, `recharts`, `leaflet` |
| V4 | `/api/data/schema-graph/route.ts` docstring says it powers `/clarity`; it is orphaned | **CONFIRMED** | Line 8-11 "Powers the interactive Obsidian-style schema visualization on /clarity". `rg schema-graph` outside its own dir → **0 consumers** |
| V5 | That route filters `n_live_tup > 0` and so drops huge tables | **CONFIRMED** | Filter present in the `exec_sql` string, ~line 109 |
| V6 | `pg_stat_user_tables.n_live_tup` is broken on this instance | **CONFIRMED** | `political_donations` 0 vs 2,549,483 · `data_catalog` 0 vs 25 · `qld_watchhouse_snapshot_rows` 144 vs 8,488 |
| V7 | `requireAdminPage` gate pattern exists at `/ops/layout.tsx` | **CONFIRMED** | File read; `await requireAdminPage('/ops')` |
| V8 | `/clarity` route is free | **CONFIRMED** | `ls apps/web/src/app/clarity` → absent |
| V9 | `getServiceSupabase()` sniffs the call stack for `/app/reports/`; use `getDirectServiceSupabase()` | **CONFIRMED** | `lib/supabase.ts:157` stack test; `:168` `getDirectServiceSupabase` |
| V10 | App Proxy blocks `exec`/`execute_sql`/`exec_agent_sql`, admits `exec_sql` for SELECT/WITH only | **CONFIRMED** | `lib/supabase.ts:13` `fullyBlockedSqlRpcNames`; `:107` "exec_sql only accepts read-only (SELECT/WITH)" |
| V11 | Matviews are absent from `information_schema.columns` (guard rail #2) | **CONFIRMED** | `columns.csv` holds 714 tables + 212 views = 926; **0 of 98 matviews**. `mv_board_interlocks`, `mv_funding_deserts`, `mv_entity_total_funding` all return no columns |
| V12 | `vercel.json` crons are HTTP requests, so refresh must not be one | **CONFIRMED** | `vercel.json:15` `"crons"` with `"path": "/api/civicscope/cron?..."` |
| V13 | `next/dynamic` never appears in a Server Component in the spec | **CONFIRMED** | BUILD-SPEC:1030 "SERVER component. No next/dynamic here"; :1038 inside client component. Repo precedent: `app/power/client.tsx`, `dashboard/*-loader.tsx` |
| V14 | `/architecture` lists `/corporate`, `/simulator`, `/for/*` which do not exist | **CONFIRMED** | All three absent from `apps/web/src/app/` |
| V15 | `data_catalog` (25, ours) vs `data_catalogue` (261, JusticeHub's external harvest) correctly distinguished | **CONFIRMED** | Census confirms both; CANONICAL-DATA-MAP:862 describes the collision correctly |
| V16 | `lib/atlas/layers.ts` typed registry + JH `src/config/surface.ts` exist as governance precedent | **CONFIRMED** | Both files present (25KB / 67KB) |
| V17 | justice_funding 45x error: aggregates $66.1bn vs grants $1.53bn on youth-justice | **CONFIRMED** | `expenditure_aggregate` 848 / $66.126bn · `budget_announcement` 57 / $1.583bn · `grant` 4,111 / $1.534bn · `contract_value` 564 / $0.195bn. Naive total $69.44bn ÷ $1.534bn = **45.3x** |
| V18 | `topics && ARRAY['youth_justice']` (underscore) silently returns zero | **CONFIRMED** | count = 0 |
| V19 | 85.1% of youth-justice grant orgs have no evidence: 662/778, $663.9m of $1,142.1m | **CONFIRMED** | Reproduced to the exact dollar |
| V20 | political_donations: 72.1% of rows are `other receipt` | **CONFIRMED** | 1,838,739 / 2,549,483 = 72.12% |
| V21 | political_donations: **88.6% of dollars** are `other receipt` | **REFUTED** | Actual **85.3%** ($186.72bn of $218.89bn). No plausible denominator reaches 88.6% |
| V22 | AusTender outliers: 115 ≥$1bn, 13 ≥$5bn, 3 ≥$20bn, max $123.0bn, total $1,266.0bn, 13 rows = $372.5bn = 29.4% | **CONFIRMED** | Exact: 115 / 13 / 3 / $123.00bn / $1,266.04bn / $372.51bn = 29.42% |
| V23 | "THE PHANTOM CONTRACT" is Gilbert and Tobin at $121,149.1m | **PARTIAL** | Row exists exactly (Treasury, 2018-06-03, $121.15bn). But it is **#2**. #1 is **Hays Specialist Recruitment, Treasury, $123.00bn, 2018-02-25** — the doc names the wrong exemplar |
| V24 | GrantConnect off-spine: 68,175 awards / 30,129 distinct ABNs / $11.83bn | **CONFIRMED** | Exact. Total nulls 80,503 of 291,264 |
| V25 | "24.4% of rows, 5.7% of dollars" | **CONFIRMED (undeclared denominator)** | Correct **only** against the valid-ABN subset (278,936 rows / $207.38bn), not all awards (23.4% / 5.1%). Must be stated |
| V26 | Only 44 of 98 matviews ever appear in `mv_refresh_log` | **CONFIRMED** | 44 / 98 exactly |
| V27 | `nz_charities` FK populated on 0 of 45,192 rows | **CONFIRMED** | 45,192 total, 0 linked |
| V28 | `ndis_participants_lga.lga_code` 100% NULL | **CONFIRMED** | 8,329 rows, 0 with code |
| V29 | 53,223 undelivered `procurement_alerts` | **CONFIRMED** | All 53,223 rows status `unread` |
| V30 | `mv_entity_total_funding.grants_total` looks unpopulated (flagged N10, unread definition) | **CONFIRMED, WORSE** | Not "under $5m" — it is **exactly zero**: `sum = 0.000`, `count(*) FILTER (grants_total > 0) = 0` across all 94,088 rows |
| V31 | Board matviews return 4 / 2 / 1 rows against a 39,757-row interlock MV | **CONFIRMED** | `mv_board_contractor_links` 4 · `mv_board_donor_links` 2 · `mv_multi_board_persons` 1 · `mv_board_interlocks` 39,757 |
| V32 | 39,139 people in the 2–10 cap; 618 above; max 745 boards | **CONFIRMED** | Exact. Seats 106,143 (doc said 106,138 — trivial) |
| V33 | `entity_identifiers` has zero ABNs (ACT CRM island) | **CONFIRMED** | Types are linkedin_id 13,807 · linkedin_url 13,520 · ghl_id 2,012 · email 1,720 · xero_id 349 · phone 31 · platform 9 · website 3. **No `abn` type at all** |
| V34 | `grant_opportunities` self-loops: 6,497 of 6,656 (97.6%) | **CONFIRMED** | Exact |
| V35 | `gs_relationships.year` spans 140–2999 | **CONFIRMED** | min 140, max 2999 — but only **7 rows** are implausible |
| V36 | `mv_trustee_grantee_chain` 79,535 rows | **CONFIRMED** | Exact |
| V37 | ACNC: 4,629 pre/post-release charities, 4,065 also ATSI | **CONFIRMED** | Exact (87.8%) |
| V38 | ~700K orphaned justice edges = **82%**, so drill-through 404s ~4 times in 5 | **REFUTED — actually worse** | `source_record_id` is uuid-shaped and unique-ish (857,731 distinct of 857,798). Anti-join on a 200,000-row sample: **200,000 orphaned = 100%**. Also does not match `justice_funding.source_statement_id` (0 hits). The "82%" is arithmetic on a row-count differential (857,798 − 157,116), not a measured join |
| V39 | `mv_funding_deserts` grain: 1,997 rows over 551 LGA names / **717 name\|state pairs**; fix = GROUP BY lga_name, state | **REFUTED** | Rows 1,997 ✓, names 551 ✓, but **name\|state = 1,130**, not 717. At 1,997/1,130 = 1.77 rows per pair, **the prescribed GROUP BY does not make the grain unique** — the fix as written still double-counts |
| V40 | Redundancy hit list: 1,565,002 rows deletable (14 backups at 1,541,951 + goods_supply_routes 23,873) | **REFUTED (arithmetic)** | 1,541,951 + 23,873 = **1,565,824**. The 822-row `gs_entities_dedup_backup_20260809` is counted in the 14 but dropped from the total. gs_entities backup subtotal is 1,462,763, not the stated 1,461,941 |
| V41 | CANONICAL-DATA-MAP contains all 812 objects | **CONFIRMED (with granularity caveat)** | All 812 mentioned. But only **536 have a dedicated pipe-table row**; 276 appear only inside bulk comma-separated tier listings. No build risk — BUILD-SPEC seeds from the shards (V2), which do have 812 individual rows |

---

## 2. The expensive error: delete recommendations that break live code

I extracted all 68 objects carrying a bolded **DELETE**/**DROP** verdict and grepped both repos for
PostgREST/SQL usage (`from('x')`, `FROM x`, `JOIN x`, `INTO x`, `UPDATE x`, `rpc('x')`), restricted
to live application source (`apps/web/src`, `JusticeHub/src`).

**19 objects are live-referenced. Acting on these verdicts breaks running code.**

| Object | Doc verdict & stated reason | Reality |
|---|---|---|
| `act_obligations` | **DROP or BUILD** — "Do not design screens against it" | 8+ refs: `lib/services/act-communities.ts:69,92`, `lib/services/act-obligations.ts:97,134` |
| `act_people` | **DROP or BUILD** — "the whole sub-tree is dead" | 8+ refs: `act-desk-digest.ts:106`, `act-people.ts:70,134`, `act-desk-people.ts:38` |
| `act_person_roles` | **DROP** — "Empty duplicate of person_roles" | Inserted/deleted by `api/org/[orgProfileId]/people/route.ts:86,133,144` |
| `act_ask_warmers` | **DROP** — "Parent act_people is empty" | Upserted/deleted by `api/org/[orgProfileId]/people/route.ts:159,173` |
| `act_ask_artefacts` | **DROP or BUILD** | `lib/services/act-ask-artefacts.ts:45` |
| `act_community_links` | **DROP** — "no FK and no rows" | `lib/services/act-communities.ts:68,91` |
| `alert_notifications` | **DROP** — "Duplicate of the live grant_notification_outbox" | `lib/grant-alert-digests.ts:317,513,548` |
| `funding_ghl_handoffs` | **DROP or BUILD** — "never fired" | 7 refs in `lib/services/funding-ghl.ts` incl. `.upsert()` and 2 `.update()` |
| `funding_ghl_callback_events` | **DROP** — "never used" | `api/integrations/ghl/funding-callback/route.ts` |
| `ghl_task_bridge` | **DROP** — "Never populated; GHL tasks are managed in GHL" | `lib/services/act-ghl-task-bridge.ts:70,92,108,125` — the app **writes** it |
| `kiosk_control_signals` | **DROP** — "Remote control for a physical kiosk display" | JH `app/admin/kiosk/status/page.tsx:33`, `api/kiosk/control/route.ts:37`, `api/kiosk/control-signal/route.ts:17` |
| `record_grants` | **DROP** — "name collides confusingly" | JH correction workflow, 5 refs: `api/records/[table]/[id]/correction/route.ts:100,139`, `api/people/[slug]/correction/route.ts:84,136`. This grants record access — dropping it is a permissions change |
| `project_backers` | **DROP** — "FK targets art_innovation, which has 7 rows" | JH `app/admin/contained/page.tsx:16`, `api/admin/contained/crm/route.ts:31` |
| `tour_reactions` | **DROP** — doc itself says "9 JusticeHub references" | 5+ refs incl. `app/admin/contained/page.tsx:19,52`, `api/admin/campaign-alignment/momentum/route.ts:82` |
| `tour_stories` | **DROP** — "Same dead lane" | 8+ refs incl. `api/contained/tour-stories/route.ts:27`, `api/contained/tour-stops/[slug]/route.ts:55` |
| `mv_person_network` | **DROP after cutover** | `app/reports/power-network/page.tsx:84,99,107`, `app/reports/reallocation-atlas/page.tsx:91` |
| `mv_person_influence` | **DROP after cutover** — "CLAUDE.md documents this one and not v2" | `lib/services/act-people.ts:199`, `api/data/person/route.ts:48,99` |
| `mv_person_identity_influence` | **DROP after cutover** | `app/person/[name]/page.tsx:10,90`, `api/data/person/route.ts:75` |
| `mv_board_power` | **DROP after cutover** — "No refresh path" | `api/data/board-power/route.ts:52,58` — a live API route |

**Root cause: the analysis equated "empty" with "unused".** Most of the ACT/GHL tables are
write-first — the app inserts into them and they happen to be empty because the feature has not
fired yet. Dropping them turns a dormant feature into a runtime 500.

Two verdicts are also *self-contradictory*: `tour_reactions` says "9 JusticeHub references" and then
DROP; `ndis_providers` says "Still named in `reports/ndis/page.tsx`" — that reference is actually a
**SQL column alias** (`COUNT(*) FILTER (WHERE in_ndis_provider = 1) as ndis_providers`), not the
table, so the DROP is safe but the stated evidence is a false positive.

**Verdicts that survive:** the 13 `*_backup_*` tables (only reference is the migration that created
them, plus one handoff doc), `goods_supply_routes` and `mv_multi_board_persons` (generated
`database.types.ts` only). Deleting the backups does remove the documented rollback path for
migration `20260808130000_resolve_or_null_entity_lga.sql` — take a dump first.

---

## 3. "Dark data" is an upper bound, not a measurement

The 290-dark-object / 14,894,611-row figure comes from grepping two codebases. It never looked at
the database's own code.

- **410 functions in `public`, 386,420 characters of `prosrc`** — the usage scan used
  `functions.csv`, which contains only `proname,args,lanname,prokind` (26,650 chars). **No function
  body was ever scanned.**
- **227 non-internal triggers** exist. Trigger-written tables look dark to a code grep by construction.
- Sampling 13 of the largest dark objects against `pg_proc.prosrc`: `integration_events` (3 refs),
  `mv_org_justice_signals` (2), `webhook_delivery_log` (1) are referenced in DB functions. **3 of 13
  = 23% false-positive rate on this sample.**

The claim survives for the biggest items — `asic_name_lookup` (2.1M), `privacy_audit_log` (1.28M),
`mv_entity_total_funding`, `mv_fy_donation_contracts` have **zero** refs in app source, scripts, or
function bodies. But "290" must be labelled *unreferenced by app code*, not *unused*.

---

## 4. The watchhouse flagship: right direction, fragile baseline

The numbers reproduce exactly — and they are a **monthly** aggregation whose first bucket is
**two snapshots**.

| Month | Snaps | Avg children | FN | Non-Indig | % FN | Over-7d | Longest |
|---|---|---|---|---|---|---|---|
| 2026-04 | **2** | 13.0 | 10.5 | 2.5 | **80.8** | 0.00 | 5 |
| 2026-05 | 59 | 14.2 | 9.9 | 4.2 | 70.1 | 0.07 | 7 |
| 2026-06 | 52 | 24.8 | 15.5 | 9.3 | 62.4 | 1.71 | 12 |
| 2026-07 | 62 | 28.6 | 15.8 | 12.8 | 55.2 | 3.56 | 14 |
| 2026-08 | 26 | 38.8 | 14.6 | 24.2 | **37.6** | 8.35 | 14 |

Every headline figure (13.0→38.8, 80.8%→37.6%, 0.00→8.35, 5→14, +39%, +868%) is anchored on
**n = 2**. Rebased on May (n = 59) the same series reads 14.2→38.8 = **2.7x** (not 3.0x), FN share
70.1%→37.6%, non-Indigenous **+476%** (not +868%).

What I tested and **cleared**:
- **Component consistency**: `child_first_nations + child_non_indigenous + child_other_status =
  total_children` on **201 of 201** snapshots, zero NULLs. `child_other_status ≈ 0` throughout — the
  synthesis's claim that the FN-share drop is not an artefact **holds**.
- **Time-of-day confound** (my own hypothesis, since there are multiple intra-day snapshots — e.g.
  2026-08-13 appears twice at 43 and 33 children): mean snapshot hour is stable at 11.5–12.3 across
  all five months with a balanced morning/afternoon split. **This does not explain the rise.**
- Facility split CONFIRMED exactly: Cairns avg 5.1 / peak 13 / 94.5% FN (897 vs 52); Brisbane
  inverse (121 vs 386 = 23.9% FN); Townsville 83.2%.

So the finding is real and publishable. The baseline is not. Note also that "average children held"
is **per snapshot**, not per day (201 snapshots over 108 distinct days) — the axis must say so.

---

## 5. Things nobody caught

**N1 — `austender_contracts` has CSV field-shift corruption.** Probing the top-value rows returned
records where `supplier_name` is empty and `buyer_name` holds fragments of a neighbouring CSV row:
`"ABN:55 152 420 936,4060,Limited,,,"` and `",03/01/2019,92796,Drive Engineering Pty Ltd"`. Measured:
**54 rows** with a shifted `buyer_name`, **1,905 rows** with NULL `contract_value`. Small, but it is
an unquoted-comma parser bug in a flagship table, and it is a different defect from the outlier
problem the docs describe.

**N2 — `ORDER BY contract_value DESC` puts NULLs first.** Any "top contracts" panel built naively
will lead with 1,905 blank rows. Needs `NULLS LAST` everywhere.

**N3 — CLAUDE.md's column names for `mv_board_interlocks` are wrong.** It documents
`(person_name, entities, shared_board_count)`. Actual: `person_name_normalised`,
`person_name_display`, `board_count`, `organisations`, `organisation_abns`, `entity_ids`,
`interlock_score`. My first query errored on `shared_board_count`. The three synthesis docs do **not**
propagate the stale name (0 occurrences) — this is CLAUDE.md's defect only, but it will bite anyone
writing queries from the project instructions.

---

## 6. Coverage claims under ~40% (task item 2)

All are disclosed by the docs rather than hidden, but they must ship as labels on the UI, not
footnotes:

| Cross-section | Honest coverage | Status |
|---|---|---|
| Justice edge → `justice_funding` drill-through | **0%** on a 200,000-row sample | Worse than the stated 18% |
| Interlocked people with a funding rollup | 5,359 of 41,614 orgs = **12.9%** | Sentence is ambiguous: 5,359 counts **organisations**, not people. 14,795 of 39,139 people (37.8%) carry any dollar value in the MV |
| ACNC pre/post-release charities in funding rollup | 862 of 4,629 = **18.6%** | Disclosed |
| Foundation grantees also holding contracts | 949 of 4,167 = **22.8%** | Not re-measured — **UNVERIFIED** |
| Entities with a funding rollup (L4) | **15.4%** | Not re-measured — **UNVERIFIED** |
| Director links / organisations | **17.5%** | Not re-measured — **UNVERIFIED** |
| SA2-level anything | **14.4%** | Doc already says do not build |
| `nz_charities` → spine | **0.00%** (0 of 45,192) | CONFIRMED |
| `ndis_participants_lga` → LGA | **0.00%** (0 of 8,329) | CONFIRMED |

---

## 7. BUILD-SPEC: does it actually work?

Mostly yes. Architecture compliance checks all pass (V7–V13). Three problems:

**B1 — the freshness statistic is computed over the wrong population.** "690 of 926 table/view names
carry a candidate timestamp column (74.5%)". That 926 = 714 tables + 212 **regular views**. The
`/clarity` ledger's population is 812 = 714 tables + 98 **matviews**. The two sets differ by 310
objects. Measured from `columns.csv`: of the 714 census tables present, **689 (96.5%)** have a
timestamp/date column; across all 926 tables+views, 835 (90.2%) do. The spec's own remedy is right —
it reads `pg_attribute`, which does cover matviews — but the headline coverage number does not
describe the thing being built. Recompute over the 812.

**B2 — `mv_funding_deserts` guard is wrong** (V39): `GROUP BY lga_name, state` leaves 1.77 rows per
key. Needs a real grain investigation before any desert screen ships.

**B3 — the seeded opportunity queue inherits every corrected number below.**

Not a problem: `next/dynamic` placement, the RPC block, `getDirectServiceSupabase`, the admin gate,
the zero-new-dependency claim, and the 812-row seed all check out.

---

## 8. Ranked corrections that MUST be applied

1. **Strike the 19 live-referenced objects from the DELETE/DROP list** (§2). Re-verdict them as
   "empty but write-first — keep". Add a mandatory rule: no drop verdict without a
   `from\(|FROM|JOIN|INTO|UPDATE` grep over both `src` trees **and** `pg_proc.prosrc`.
2. **Restate the justice drill-through gap as 100%, not 82%**, and correct the mechanism:
   `gs_relationships.source_record_id` does not reference `justice_funding.id` (or
   `source_statement_id`) at all. It is a dead key namespace, not a partial-orphan problem. Any
   "click an edge to see the grant" feature is unbuildable until the key is rebuilt.
3. **Rebaseline every watchhouse figure off May (n=59), not April (n=2)** — 2.7x, 70.1%→37.6%,
   +476%. Keep the FN/non-Indigenous dual reading; it survived my artefact tests. Label the series
   "per snapshot (201 snapshots, 108 days)".
4. **Relabel "290 dark objects" as "unreferenced by application code"** and note the unscanned
   386KB of `pg_proc` source and 227 triggers. Rerun the scan against function bodies before any
   deletion decision cites it.
5. **Fix `political_donations` dollar share: 85.3%, not 88.6%.** Row share 72.1% is correct.
6. **Fix the `mv_funding_deserts` grain remedy** — 1,130 name|state pairs, not 717; the GROUP BY does
   not resolve it.
7. **Declare the GrantConnect denominator**: 24.4% / 5.7% are against valid-ABN rows (278,936 /
   $207.38bn). Against all awards it is 23.4% / 5.1%.
8. **Recompute the freshness coverage over the 812-object ledger population**, not 926 tables+views.
9. **Rename the phantom-contract exemplar**: the largest outlier is Hays Specialist Recruitment
   ($123.00bn, Treasury, 2018-02-25); Gilbert and Tobin is #2.
10. **Upgrade `mv_entity_total_funding.grants_total` from "suspected" to "confirmed broken"** — it is
    exactly zero across all 94,088 rows.
11. **Add the CSV field-shift defect (N1) and `NULLS LAST` (N2) to the guard rails.**
12. **Fix the redundancy total**: 1,565,824 rows, not 1,565,002 (the 822-row dedup backup was
    dropped from the sum).
13. **Disambiguate the interlock coverage sentence** — 5,359 (12.9%) counts organisations, not people.
14. **Correct CLAUDE.md's `mv_board_interlocks` columns** (`board_count`, not `shared_board_count`).

---

## 9. What I did not check

- The 22.8% foundation/contract overlap, 15.4% entity rollup, 17.5% director-link coverage, and the
  charity-fragility tiers (773 fragile / 1,776 watch) — **UNVERIFIED**, not re-measured.
- The 14.9M dark-row total and the 16-domain / 8-lifecycle distributions — internal consistency only.
- The competitive claims ("no public source does this", Foundation Maps Australia being members-only,
  the 1 Jul 2026 AEC reform) — **UNVERIFIED**, no external source consulted.
- Sensitivity register contents (plaintext OAuth tokens in `xero_tokens` / `gmail_auth_tokens`) — not
  opened, deliberately.
- Whether the 44 logged matviews are actually fresh, versus merely logged.
