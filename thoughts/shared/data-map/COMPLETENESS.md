# COMPLETENESS — what is MISSING from the data map

Adversarial completeness review of `CANONICAL-DATA-MAP.md`, `BUILD-SPEC.md`, `OPPORTUNITY-MAP.md`.
Written 2026-08-14. Every number below is either **[V]** verified this session by direct psql /
mechanical diff, or **[I]** inferred, or **[U]** unverified. No number is carried on faith.

---

## VERDICT IN ONE PARAGRAPH

The three documents map **812 of 812** tables and materialized views — that part is genuinely
complete, and I verified it two independent ways. But **812 was the wrong universe.** The `public`
schema holds **1,024** relations, not 812. The missing **212 regular views** and **409 functions**
were never inventoried: 208 of the 212 views and 406 of the 409 functions are not named once in any
of the three documents. That is not a rounding error. **61 of those views are built directly on
civic data**, and at least four of them already implement work the documents propose as new —
including a `justice_funding` cleaning view whose filter *disagrees* with the one OPPORTUNITY-MAP
declares mandatory. Ben asked to see "absolutely every piece of data". A map that omits every view
and every function omits the layer where the analytics actually live.

Second-order: the map has no governance dimension at all — **762 RLS policies, 227 of them granting
anonymous SELECT with `USING true`**, were never looked at, on a database whose own sensitivity
register says it holds plaintext OAuth tokens and named-individual finance. And a **semantic-search
layer of 39 vector columns with ~199,000 populated embeddings** (including 135,208 on `gs_entities`)
is invisible in all three documents.

---

## 1. DID WE MAP EVERY OBJECT? — Set difference, mechanically computed

### 1a. Tables + matviews: PASS (812/812), verified two ways **[V]**

| Test | Result |
|---|---|
| Census objects named anywhere in the 3 inventory shards | **812 / 812**, zero missing |
| Census objects named anywhere in `CANONICAL-DATA-MAP.md` | **812 / 812**, zero missing |
| Census objects parsed as a full 9-cell shard table row | **812 / 812**, zero missing |
| Shard rows with an **empty** `purpose` cell | **0** |
| Shard rows with an empty `grain` cell | **34** |
| Shard rows with an empty `join_keys` cell | **60** |
| Shard `purpose` length: median / p10 / p90 | 70 / 40 / 132 chars |

The BUILD-SPEC's claim that the shards "classify all 812 objects with domain, lifecycle, grain and
purpose" is **true and I re-verified it independently.** The seed data really does exist.

### 1b. But depth is bimodal — 276 objects got a name and nothing else **[V]**

In `CANONICAL-DATA-MAP.md`, only **536 of 812** objects appear as a described table row (with a
purpose/caveat column). The other **276** appear only inside dense run-on tier lists as
`` `name` (rows) *dark* `` — for example, `act_ask_none_owed` (19) appears exactly once, in a
single 112-item comma-separated D14 line.

That satisfies "assigned a tier". It does not satisfy "mapped". The shards carry the depth; the
canonical map carries a bibliography for 34% of the corpus. **If `/clarity` is seeded from the
canonical map rather than the shards, 276 objects arrive with no description.** Seed from the
shards (as BUILD-SPEC slice 1 correctly specifies) and this problem disappears.

### 1c. The downstream documents barely reference the corpus at all **[V]**

| Document | Census objects named | Coverage |
|---|---|---|
| Inventory shards (a, g-m, n-z) | 812 | 100% |
| `CANONICAL-DATA-MAP.md` | 812 | 100% |
| `BUILD-SPEC.md` | **39** | 4.8% |
| `OPPORTUNITY-MAP.md` | **54** | 6.7% |

This is expected for a build spec, less so for an opportunity map. The opportunity map ran nine
real cross-sections against 54 objects and declared the rest out of scope without saying so.
**~670 populated objects have never been asked a single analytic question.**

### 1d. THE REAL SET DIFFERENCE: the universe was 1,024, not 812 **[V]**

```
public schema, pg_class:   714 tables + 212 views + 98 matviews = 1,024 relations
census.csv / all 3 docs:   714 tables +   0 views + 98 matviews =   812 relations
                                       ─────────
                        NEVER INVENTORIED: 212 regular views  (20.7% of the schema)
```

Plus **409 distinct functions** in `public` (410 rows in `functions.csv` — overloads counted
separately), of which **406 are never named in any document.** The three that are: `exec_sql`,
`snapshot_data_catalog`, `closing_the_gap_state_summary`.
The four views that are: `v_award_rows`, `v_data_catalog_latest`, `v_lga_place_profile`,
`v_ndis_youth_justice_overlay`.

Detail in §5. This is the headline finding.

---

## 2. BEN'S NINE NAMED DOMAINS, ITEM BY ITEM

All row counts **[V]** from `census.csv` (exact `count(*)`).

| # | Ben's word | What we actually hold | Verdict |
|---|---|---|---|
| 1 | **philanthropy** | `foundations` 11,159 · `mv_foundation_regranting` 85,401 · `mv_trustee_grantee_chain` 79,535 · `mv_foundation_grantees` 15,003 · `foundation_grantees` 6,001 · `foundation_programs` 4,218 · `mv_foundation_trends` 53,985 · `mv_foundation_readiness` 10,464 | **STRONG.** Covered in D4 (36 objects, 379K rows). Known ceiling: trustee chain is 195 trustees / 25 foundations. |
| 2 | **giving** | `political_donations` 2,549,483 · `mv_donor_contract_crossref` · `mv_fy_donation_contracts` 50,685 · `mv_donation_contract_timing` 232,474 | **STRONG**, with the 8x `receipt_type` defect correctly found. |
| 3 | **charities** | `acnc_ais` 360,488 · `acnc_charities` 66,023 · `nz_charities` 45,192 · `mv_charity_network` 351,455 · `mv_charity_rankings` 42,503 · `mv_acnc_latest` | **STRONG.** Unused asset correctly flagged (ACNC beneficiary flags: 4,629 prison-release charities, only 18.6% in the funding rollup). |
| 4 | **spend** | `austender_contracts` 823,620 · `grantconnect_awards` 291,264 · `state_tenders` 199,719 · `justice_funding` 157,116 · `rogs_justice_spending` 22,364 · `vic_grants_awarded` | **STRONG**, with two real defects found (the $121bn phantom contract; the 45x aggregate/grant mix). |
| 5 | **youth detention numbers** | `qld_watchhouse_snapshot_rows` **8,488** + `qld_watchhouse_snapshots` 201 · `aihw_youth_justice_stats` **13** · `youth_detention_facilities` **21** | **THIN AND ONE-STATE.** The only real series in the database is Queensland watchhouses. There is **no** daily or monthly detention count for NSW, VIC, WA, SA, NT, TAS or ACT. Correctly flagged as gap #1, but see §7 — no acquisition plan exists. |
| 6 | **child protection** | `aihw_child_protection` **2,981** (state × FY × metric) · `children_commissioner_reports` **11** | **THIN.** Two objects. I checked hard: no other child-protection table exists in the census (regex over `child\|protect\|foster\|oohc\|care` returned exactly these two). The docs *do* cover it honestly — CANONICAL folds it into D8 with an explicit "cannot say anything sub-state" and gap #22. **Not skipped, but not solved, and with no source named.** |
| 7 | **organisations doing the work** | `gs_entities` 609,448 · `organizations` 104,427 · `alma_interventions` 2,136 · `community_orgs` 1,215 · `services` 508 · `registered_services` **19** | **STRONG at the registry layer, WEAK at the "doing the work" layer.** 609K entities, but only 2,136 typed interventions and 19 registered services. Ben's phrase means the second thing. |
| 8 | **media** | `alma_media_articles` **872** · `exa_media_mentions` 162 · `articles` 49 · `alma_stories` 14 · `wiki_articles` 3 | **WEAKEST PILLAR IN THE VISION.** Total civic media corpus ≈ **1,100 records**. D12 is 77 objects holding 4,501 rows and most of that is storyteller/consent machinery, not media. **And OPPORTUNITY-MAP explicitly recommends *against* acquiring more** ("buying a media corpus" is on the not-recommended list). A named vision pillar is being declined without an alternative. See §7. |
| 9 | **director links** | `person_roles` 339,698 · `person_identities` 230,434 · `mv_charity_network` 351,455 · `mv_board_interlocks` 39,757 · 8 × `mv_person_*` (~2.4M rows) · view `org_governance` | **STRONG data, BROKEN operations.** See §5c — every one of these matviews is **absent from the nightly cron** and last refreshed **2026-08-09**. |

**Bonus — a domain Ben did not name but the DB holds and the docs did cover:** civic accountability —
`civic_ministerial_diaries` 1,728, `civic_ministerial_statements` 649, `civic_hansard` 647,
`parliament_bills` 249, `coroners_findings` 39, `anao_mmr_*` 35. All present in CANONICAL. **[V]**
Counter-note: **there is no lobbyist-register table in the census at all**, yet CLAUDE.md describes
`mv_revolving_door` as combining "lobbying, donations, contracts, funding". I did not read the
matview definition, so the lobbying vector is **[U] unverified and should be checked before any
"revolving door" claim is published.**

---

## 3. DID THE WORK DRIFT TO GRANTSCOPE? — Yes, at the build layer

**Evidence for genuine JusticeHub coverage** (wave 1 did this well):
- `usage-justicehub.md` is a real trace: 3,375 files, 6,031 client hits, 3,751 raw-SQL hits;
  §4 SHARED SURFACE; §6 CROSS-DB. It found the `gs_entities` JSONB read-modify-write race from a
  JusticeHub cron. That is not a token pass.
- `CANONICAL-DATA-MAP.md` names JusticeHub **32 times** **[V]**, carries the `GS+JH` / `JH` owner
  column on object rows, and cites JusticeHub's `surface.ts` as the governance model to copy.

**Evidence of drift:**

| Signal | Measure |
|---|---|
| Usage-doc size, GrantScope vs JusticeHub | 82,849 B vs 31,582 B — **2.6×** **[V]** |
| `OPPORTUNITY-MAP.md` mentions of "JusticeHub" | **0** **[V]** |
| `OPPORTUNITY-MAP.md` mentions of Empathy Ledger | **0** **[V]** |
| BUILD-SPEC deliverable paths under `apps/web/` (GrantScope) | all of them **[V]** |
| BUILD-SPEC deliverable paths under JusticeHub | **zero** — JusticeHub appears only as a data source, a hazard, and a **"DO NOT TOUCH"** |
| Migrations on disk: GrantScope vs JusticeHub | 273 vs **411** **[V]** |

**The structural problem:** JusticeHub owns *more schema* than GrantScope (411 migration files vs
273) and touches 218 populated objects, of which **~159 are JusticeHub-only** [I, from
usage-justicehub's 218 / 275 / 59-both]. The build spec puts the catalog of a co-owned database
behind `requireAdminPage` inside GrantScope's app, on a different React/Next/Tailwind major
version, explicitly non-portable. **A JusticeHub developer will never see this map.** Since the
whole point is to stop the two apps silently diverging on a shared database, this is the wrong
delivery shape.

**What is missing, concretely:** no plan for how JusticeHub reads the inventory. The minimum is a
read-only JSON endpoint (`/api/clarity/inventory`) or a published `v_clarity_ledger` view granted
to both apps' service roles — one line in the spec, currently absent.

---

## 4. THE EMPATHY LEDGER SECOND DATABASE — accounted for in wave 1, LOST in synthesis

**[V] Mention counts:**

| Document | "empathy" / `yvnuayz` mentions |
|---|---|
| `usage-justicehub.md` | ~25 (a full §6 CROSS-DB with three transports, direction of flow, and bridge columns) |
| `CANONICAL-DATA-MAP.md` | 11 |
| `BUILD-SPEC.md` | 1 (only as "the pooler is shared with JusticeHub, Empathy…") |
| `OPPORTUNITY-MAP.md` | **0** |

Wave 1 established the seam properly and found the sharp edge: JusticeHub holds an
`EMPATHY_LEDGER_SERVICE_KEY` and **writes** to the other project (`push-sync.ts`,
`api/empathy-ledger/engagement`), while GrantScope renders consented Empathy Ledger narrative
through a pipe it cannot see. Consent lineage crosses a database boundary with **no shared audit
object.**

**What is missing:**
1. The canonical map's own connection diagrams show **one** database. There is no node for
   `yvnuayzslukamizrlhwb` and no edge for the write path. Ben will read the map as "this is the
   data" and it is not.
2. **Nobody ran a census on the second database.** Object count, row count and PII shape of
   `yvnuayzslukamizrlhwb` are entirely unknown. I did not query it either — no credentials in this
   repo's `.env`. **[U]**
3. The bridge columns *are* schema-verified on the shared DB
   (`organizations.empathy_ledger_org_id`, `public_profiles.empathy_ledger_profile_id`,
   `partner_stories.empathy_ledger_story_id`, `blog_posts.empathy_ledger_story_id`, …) but **no
   populated-vs-null coverage was measured on any of them.** A bridge with 0% fill is a broken
   seam and we would not know.
4. The env-var trap wave 1 found (`EMPATHY_LEDGER_URL` is read; `EMPATHY_LEDGER_SUPABASE_URL` is
   defined and unused) never made it into any synthesis doc.

---

## 5. WHAT NOBODY LOOKED AT AT ALL

Everything in this section was queried live this session. **[V]** unless marked.

### 5a. THE 212 REGULAR VIEWS — the single biggest omission

- **212 views. 208 never named in any of the three documents.**
- **Every one is exposed:** SELECT granted to `service_role` on 212/212, `authenticated` 210/212,
  **`anon` 206/212**. These are live API surfaces, not internal helpers.
- Dependency graph: 212 views over **185 distinct base relations**. Most-depended-on bases:
  `gs_entities` (20 views), `justice_funding` (20), `xero_invoices` (16), `ghl_contacts` (13),
  `email_financial_documents` (11), `xero_transactions` (11), `communications_history` (9),
  `organizations` (8), `austender_contracts` (7).
- **61 views are built on civic base tables** [I — my classification, from a 31-table civic seed set].
- Code references (strict scan: `.from('x')` / `FROM x` / `JOIN x` across both repos, excluding
  `node_modules`/`.next`/`dist`): **47 GrantScope-only, 29 JusticeHub-only, 2 both, 134 with no
  query-shaped reference.** A loose name-match scan puts the upper bound at 210/212 mentioned
  somewhere. **Either bound, zero were inventoried.**

**Four views that already do work the documents propose as new:**

| View | What it already is | Why it matters |
|---|---|---|
| `justice_funding_clean` | `SELECT … FROM justice_funding WHERE sector IS DISTINCT FROM 'procurement'` | **DIRECT CONFLICT.** OPPORTUNITY-MAP declares the mandatory filter is `measure_kind='grant'`. This view uses a different, weaker rule. Two "clean justice funding" definitions now exist and no document reconciles them. Any surface reading this view already disagrees with the recommended number. |
| `v_data_health` | 12+ subselects over `gs_entities`, `postcode_geo`, `gs_relationships`, `political_donations`, `foundations`, `acnc_charities`, `money_flows` | An already-built, already-drifting version of the exact `/clarity` coverage band BUILD-SPEC specifies. It contains a **hardcoded `2473 AS sa2_regions_total`** — a literal that cannot self-update. Absent from BUILD-SPEC's 11-surface disposition table. |
| `org_governance` | `person_roles` + `person_identities`, filters `cessation_date IS NULL`, excludes `is_nominee_block` | CANONICAL says "any public director surface **must** gate on `is_nominee_block`". **It already does.** This is Ben's "director links" ask, built, and not in the map. |
| `v_announced_money_by_kind` | regex classifier over `program_name` splitting `budget_total` / `detention_facility` / `service_line` | A more sophisticated version of the 45x fix OPPORTUNITY-MAP proposes. Never mentioned. |

Also uninventoried and directly on Ben's vision: `v_entity_360`, `v_entity_funding_mix`,
`v_lga_place_profile`, `v_qld_watchhouse_latest`, `v_indigenous_youth_overrepresentation`,
`v_ctg_youth_justice_progress`, `v_youth_justice_state_dashboard`, `v_charity_explorer`,
`canonical_organizations`, `alma_media_articles_publishable` (the consent/quarantine gate on the
entire media pillar), `v_relationship_health`, `v_acco_yj_retention_qld`.

**BUILD-SPEC consequence:** `data_inventory` as specified is seeded from the 812 census objects.
As written, **the shipped catalog would omit all 212 views and all 409 functions** — it would tell
Ben the database has 812 things when it has 1,433.

### 5b. THE 409 FUNCTIONS

| Class | Count |
|---|---|
| Trigger functions (return `trigger`) | 115 |
| `SECURITY DEFINER` (privilege-escalating, RLS-bypassing) | **55** |
| Plain callable | 239 |
| plpgsql / sql split | 323 / 87 |
| **Named in any of the three documents** | **3** |
| No call site found by strict scan, excluding trigger fns — **orphan callable functions** | **139** |

The 55 `SECURITY DEFINER` functions are the RLS bypass surface of the whole platform and were never
enumerated, let alone reviewed. Sample orphans: `can_access_story`, `can_read_storyteller_data`,
`calculate_trust_score`, `calculate_project_sovereignty_score`, `approve_proposal`,
`auto_approve_high_confidence`, `charity_snapshot_*`. The first two are **consent gates on the most
sensitive data in the database** with no call site found.

### 5c. pg_cron — 5 jobs, and the finding that corrects an existing document

`pg_cron` appears once, in `OPPORTUNITY-MAP.md`. Nobody read the jobs. **[V]**

```
jobid 1  */15 * * * *   SELECT retry_missed_reactions()
jobid 2  0 3 * * *      DELETE FROM net._http_response WHERE created < now()-'7 days'
jobid 4  0 17 * * *     SELECT refresh_civicgraph_mvs()          ← the nightly MV job
jobid 9  0 4 * * *      SELECT act_auto_pass_stale_pipeline()
jobid 10 30 17 * * *    SELECT public.refresh_closing_the_gap_state_summary()
```

I read the body of `refresh_civicgraph_mvs()`. It contains a **hardcoded 27-name array.**
`scripts/refresh-views-v2.mjs` contains a **46-name `VIEW_LIST`.** They disagree by 19 objects.

**Therefore: 71 of 98 materialized views (2,871,838 rows) are not refreshed by any scheduled job.**

Verified against `mv_refresh_log`: the cron ran **2026-08-13** across 27 objects. Every
person/board/charity-network matview last ran **2026-08-09** — the day someone ran the mjs script
by hand.

```
  351,455  mv_charity_network            last refresh 2026-08-09
  336,444  mv_person_entity_network      never in mv_refresh_log
  331,239  mv_person_entity_crosswalk    never in mv_refresh_log
  328,939  mv_person_identity_network    last refresh 2026-08-09
  241,269  mv_person_identity_influence  last refresh 2026-08-09
  241,260  mv_person_identity_influence_v2  never in mv_refresh_log
  237,990  mv_person_network             last refresh 2026-08-09
  237,340  mv_person_influence           last refresh 2026-08-09
   94,088  mv_entity_total_funding       never
   85,401  mv_foundation_regranting      never
   79,535  mv_trustee_grantee_chain      never
   38,199  mv_board_power                never
```

**This corrects `CANONICAL-DATA-MAP.md`.** It states "the corrected `_v2` influence matview is
unscheduled while the superseded v1 refreshes nightly." **v1 does not refresh nightly.** Neither is
scheduled. Both are five days stale and drifting at the same rate. The whole director-links
pillar — Ben's item 9 — is running on a hand-cranked refresh.

The docs' framing was "54 matviews need an UNMONITORED state in the freshness UI." The real
statement is stronger and actionable: **71 matviews are missing from a hardcoded array in one
plpgsql function, and the fix is to add them.**

### 5d. RLS — 762 policies, never examined

| Measure | Value |
|---|---|
| public tables with RLS **enabled** | 693 |
| public tables with RLS **disabled** | 21 (all backup/staging: `gs_entities_lga_backup_*`, `stg_*`, `dedup_tranche1_*`, plus `pulse_responses`) |
| total policies in `public` | **762** |
| tables carrying at least one policy | 478 |
| **tables with RLS on and ZERO policies** (fully locked out of the API) | **215** |
| **SELECT policies granting `anon` with `USING true`** (fully public reads) | **227** |

Not one of these numbers appears in any document. `RLS` is named 5 times in CANONICAL, 0 in
BUILD-SPEC, 1 in OPPORTUNITY-MAP — always as a passing aside, never measured.

This matters more than any other omission for a public product. CANONICAL's §9 sensitivity register
correctly identifies which objects are dangerous. **It never checks which of them are already
readable by `anon`.** The register is a statement of intent; the 227 policies are the statement of
fact. Nobody reconciled them.

Second: **215 tables have RLS on with no policy** — invisible through PostgREST regardless of
grants. Some of those are certainly the "dark data" the map attributes to "no code reference".
Being unreachable is a different diagnosis from being unused, with a different fix.

### 5e. Storage buckets — 18 buckets, 4,283 objects, zero mentions

**15 of 18 buckets are PUBLIC.** Private: `documents`, `org-knowledge`, `receipt-attachments`.

```
receipt-attachments 2,733 (private)   media 437   images 344   profile-images 323
storyteller-media 110   photos 88   story-images 87   site-media 59   photo-wall 31
portraits 21   audio 15   org-knowledge 12   empathy-ledger-media 12
storyteller-photos 7   avatars 3   media-uploads 1
```

`storyteller-media`, `storyteller-photos`, `portraits`, `story-images` are **public buckets holding
material from the consent-governed corpus** the sensitivity register calls the most sensitive in the
database. Whether those specific files are consented is **[U] unchecked** — but the map should not
be silent about a public bucket next to a consent register.

### 5f. Other schemas — 8 schemas, 48 tables, never mentioned

```
auth  23 tables  (auth.users = 24 accounts, 4 signed in within 90 days)
storage 8   realtime 9   cron 2   net 2   supabase_migrations 2 (396 migrations, latest 20260813100000)
vault 1 + 1 view   drizzle 1   extensions 2 views
```

`auth.users` has **24 rows**. The map treats several `users` / `user_profiles` / `profiles` tables
in `public` as a "four user tables" duplication problem without ever noting that the *actual*
identity table lives in `auth` and holds 24 people. **[V]**

### 5g. Enum types (24), triggers (219 on 178 tables) — zero mentions

24 enum types in `public`; **219 non-internal triggers across 178 tables.** Enums are the closest
thing this database has to a controlled vocabulary and they were never listed. 219 triggers mean
178 tables mutate as a side effect of writes to other tables — invisible in the FK graph, and a
direct hazard for anything that reasons about lineage from `foreign_keys.csv` alone (as all three
documents do).

### 5h. Extensions and the embedding layer — a whole asset class missed

Extensions: `vector 0.8.0`, `pg_cron 1.6`, `pg_net 0.20.0`, `pg_trgm 1.6`, `fuzzystrmatch`,
`pgcrypto`, `pg_stat_statements`, `uuid-ossp`, `supabase_vault`, `plpgsql`.

**39 `vector` columns exist.** Populated counts, measured on six of them:

| Table | Embedded | Total | Fill |
|---|---|---|---|
| `gs_entities` | **135,208** | 609,448 | 22.2% |
| `grant_opportunities` | 25,890 | 25,897 | 99.97% |
| `knowledge_chunks` | 19,413 | 19,413 | 100% |
| `foundations` | 10,775 | 11,159 | 96.6% |
| `civic_intelligence_chunks` | 7,022 | 7,022 | 100% |
| `alma_evidence` | 631 | 631 | 100% |

**≈198,939 populated embeddings in six tables alone**, with HNSW indexes already built
(`idx_gs_entities_embedding`, `idx_alma_evidence_embedding_hnsw`, …). The word "embedding" appears
**once** across all three documents, and zero times in BUILD-SPEC and OPPORTUNITY-MAP.

Ben asked for "cross-sections no one else does". Semantic similarity across 135K entities, 26K
grants and 11K foundations is exactly that, it is already paid for, and no document mentions it
exists. `pg_net` also means **the database makes outbound HTTP calls** — an egress path absent from
every architecture diagram.

### 5i. Schemaless columns — 560 jsonb, 490 array

`columns.csv` records that a column is `jsonb`; nobody looked *inside* one. **560 jsonb columns
across 328 tables; 490 array columns across 219 tables.** Heaviest: `user_profiles` 11,
`founder_intakes` 10, `grant_opportunities` 10, `storytellers` 10, `services` 7.

`gs_entities.metadata` and `gs_entities.source_datasets` are jsonb, are the subject of the
documented cross-repo lost-update race, and their key structure is nowhere in the map. A jsonb key
census (`jsonb_object_keys` on a sample) is cheap and would materially change what the map can say
about the spine.

### 5j. Edge functions — checked, apparently none **[V/U]**

No `supabase/functions/` directory in either repo; zero `functions.invoke` call sites in either
codebase. The Supabase MCP returned **Unauthorized**, so I could not enumerate *deployed* edge
functions. Best evidence: none exist. Flag as **[U] not enumerable from here.**

### 5k. Size figure to correct

`pg_database_size` = **28 GB** **[V]**. Any per-schema total built by summing
`pg_total_relation_size` over all `pg_class` rows (which is how I first got "39 GB") double-counts
indexes. Use 28 GB.

---

## 6. QUESTIONS BEN WILL ASK THAT THESE DOCUMENTS CANNOT ANSWER

1. **"What's the total amount of money in here?"** — There is no single reconciled money figure with
   an as-at date. The documents produce $1,266.0bn contracts, $186.7bn other receipts, $22.97bn
   donations, $195.55bn GrantConnect, $66.1bn justice aggregates — five ledgers, overlapping,
   never summed or explicitly declared un-summable. Ben will try to add them.
2. **"What changed since last week?"** — No diff exists. `data_catalog_snapshots` holds 1,419 rows
   of real row-count history for **25 tables** (2.5% of the schema, latest 2026-08-13). BUILD-SPEC
   specs a *new* `data_inventory_history` table rather than widening the working one.
3. **"Which of these can I publish?"** — `data_catalog` already has `licence`, `public_export`,
   `public_caveat`, `pii_level`, `source_url`, `source_owner`, `collection_method`,
   `update_cadence`, `sla_hours` — **21 columns, populated for 25 of 812 objects (3.1%)**. The
   answer requires joining that to the 227 anon-readable policies. Neither document does.
4. **"Who owns this table?"** — `owner_app` (civicgraph/justicehub) is specified. No human owner,
   no "who do I ask", no last-touched-by. `data_catalog.owner_team` exists and is unused.
5. **"Show me one organisation, everything we know."** — `v_entity_360` already joins
   `acnc_charities` + `ato_tax_transparency` + `civic_org_classifications` + `foundation_grantees`
   + `justice_funding` + `ndis_registered_providers` + `organizations` + `oric_corporations`.
   The documents describe building this from scratch as drill level L4.
6. **"Why is this number different from the number on the other page?"** — The
   `justice_funding_clean` vs `measure_kind='grant'` conflict (§5a) is the first instance. Nothing
   in the build defines a canonical metric layer, so a second definition can be added tomorrow.
7. **"Is anything at risk of being public that shouldn't be?"** — Answerable only with §5d and §5e,
   which no document contains.
8. **"How much is this costing me?"** — 28 GB, 396 migrations, 5 cron jobs, ~199K embeddings.
   No cost or footprint dimension anywhere.
9. **"Can I get the media pillar at all?"** — 872 articles and an explicit recommendation not to
   buy more. No alternative named (Trove API, ABC/Guardian RSS, `alma_media_articles`'s own
   `quarantined_at` pipeline). The vision item is declined, not solved.
10. **"What's in the other database?"** — Unknown. Nobody censused Empathy Ledger.

---

## 7. PRIORITISED — WHAT MUST STILL BE DONE

Effort: **XS** <1h · **S** half day · **M** 1-2 days · **L** >2 days.

### P0 — the map is wrong until these are done

| # | Action | Effort | Why |
|---|---|---|---|
| 1 | **Inventory the 212 views.** Same 9-cell shard treatment. Seed from `_view_deps.csv` (already written: view → base relations). Add `kind='view'` to `data_inventory` and to the BUILD-SPEC seed parser. | M | 20.7% of the schema, 206 exposed to `anon`, 61 civic. Without this the catalog is provably incomplete on day one. |
| 2 | **Reconcile `justice_funding_clean` against `measure_kind='grant'`.** Pick one, delete or redefine the other, and put the winner in a metric registry. | S | Two live, conflicting definitions of the headline number. Ships wrong money either way. |
| 3 | **Inventory the 409 functions**, split trigger / SECURITY DEFINER / plain, with call sites. Review the 55 `SECURITY DEFINER` functions and the 2 orphaned consent gates (`can_access_story`, `can_read_storyteller_data`). | M | The RLS-bypass surface, currently unmapped. |
| 4 | **Add the 71 missing matviews to `refresh_civicgraph_mvs()`**, or make the cron call `refresh-views-v2.mjs`'s list. Delete one of the two registries. | S | 2,871,838 rows, including the entire director-links pillar, last refreshed 2026-08-09. Ben's item 9 is stale right now. |
| 5 | **RLS + grants layer on every object:** `rls_enabled`, `policy_count`, `anon_readable`. Cross it against §9 sensitivity. | S | 227 anon `USING true` SELECT policies vs a sensitivity register nobody joined to them. This is the one that becomes a headline if wrong. |
| 6 | **Correct CANONICAL's MV-freshness claim** (v1 influence does *not* refresh nightly) and re-derive the "54 unmonitored" figure as "71 not in the cron array". | XS | A stated fact is wrong. |

### P1 — before the build ships

| # | Action | Effort | Why |
|---|---|---|---|
| 7 | **Give JusticeHub read access to the inventory** — `v_clarity_ledger` granted to both service roles, or `/api/clarity/inventory`. | S | JusticeHub owns 411 migrations and ~159 objects nobody else touches. A catalog it cannot read solves nothing. |
| 8 | **Census the Empathy Ledger project** (`yvnuayzslukamizrlhwb`): object count, rows, PII shape. Measure fill rate on the 8+ verified bridge columns. Add it to the connection diagram as a second database with a **write** edge. | M | Consent lineage crosses a boundary the map does not draw. |
| 9 | **Widen `data_catalog` from 25 → 812+ rows** rather than building `data_inventory_history` alongside `data_catalog_snapshots`. Populate `licence`, `public_export`, `public_caveat`, `pii_level`. | M | The governance table already exists with the right 21 columns at 3.1% coverage. Do not build a second one. |
| 10 | **Surface the embedding layer**: `has_embedding`, `embedding_fill_pct`, `embedding_dim`, index present. 39 columns, ~199K vectors. | S | A paid-for, indexed semantic-search asset that appears in zero documents. |
| 11 | **jsonb key census** — `jsonb_object_keys` over a 1,000-row sample of the top 30 jsonb columns, starting with `gs_entities.metadata` / `.source_datasets`. | S | 560 jsonb columns; the map currently says "jsonb" and stops, on the exact columns involved in the documented cross-repo write race. |
| 12 | **Enumerate 24 enums + 219 triggers.** Triggers especially — lineage reasoning built on `foreign_keys.csv` alone is blind to 178 tables that mutate as side effects. | S | |

### P2 — the vision pillars that are still unanswered

| # | Action | Effort | Why |
|---|---|---|---|
| 13 | **Name a source for youth detention outside QLD.** AIHW Youth Justice NMDS is quarterly + state-level; each state's own quarterly custody report is the only sub-state path. Today: `aihw_youth_justice_stats` = **13 rows**. | L | Ben's named pillar #5 is one state deep. |
| 14 | **Name a source for child protection.** `aihw_child_protection` 2,981 rows, state-level; the AIHW Child Protection Australia data tables carry remoteness and Indigenous-status splits that are not ingested. | M | Pillar #6 is 2 objects. Correctly flagged, never sourced. |
| 15 | **Decide the media pillar explicitly.** Current state: ~1,100 records, and an explicit recommendation *against* acquiring more. Either name a free path (Trove API, ABC/Guardian RSS into the existing `alma_media_articles` schema, which already has `quarantined_at` consent machinery) or tell Ben the pillar is out of scope. | S to decide | Pillar #8 is being declined by omission. |
| 16 | **Verify the lobbying vector in `mv_revolving_door`.** No lobbyist-register table exists in the census; CLAUDE.md claims one of four vectors is lobbying. | XS | An unverified claim sitting on a publishable surface. |
| 17 | **Audit the 4 public storage buckets holding consent-governed material** (`storyteller-media`, `storyteller-photos`, `portraits`, `story-images` — 221 objects). | S | Public buckets adjacent to the most sensitive register in the database. |
| 18 | **Deepen the 276 name-only objects** in the canonical map to shard-level description, or state plainly that the shards are the reference and the canonical map is a synthesis. | S | Prevents a `/clarity` seeded from the wrong file shipping 276 blank descriptions. |

---

## 8. WHAT I DID AND DID NOT CHECK

**Verified by direct query or mechanical diff this session:** the 812/812 object diff against all
three documents and the shards (two methods); shard cell-completeness (0 empty purpose, 34 empty
grain, 60 empty join_keys); the 536/276 described-vs-named split; the 212-view and 409-function
non-coverage counts; view→base-relation dependency graph (212 rows, 185 bases); view grants to
anon/authenticated/service_role; strict and loose code-reference scans over both repos; function
classification (trigger/secdef/plain, language); all 5 pg_cron jobs and the body of
`refresh_civicgraph_mvs()`; `refresh-views-v2.mjs` `VIEW_LIST`; `mv_refresh_log` distinct objects
and last-run dates; the 71-matview cron gap; RLS enabled/disabled/policy counts and the 227
anon-true SELECT policies; storage buckets and per-bucket object counts; `auth.users`; non-public
schema inventory; enum and trigger counts; extension list; 39 vector columns and embedding fill on
six tables; jsonb and array column counts; `data_catalog` column list; `pg_database_size`;
migration file counts in both repos; the four view definitions quoted in §5a.

**Inferred, not directly confirmed:** the "61 civic views" figure (my own classification from a
31-table seed set, not an authoritative taxonomy); the ~159 JusticeHub-only object count (derived
from usage-justicehub's 218/275/59 figures, not recomputed); the strict code-reference scan's
false-negative rate (dynamic table names and template literals are invisible to it — treat 134
"no query-shaped reference" views as an upper bound on dark views, and 210 as the upper bound on
referenced ones).

**Not checked at all:** the contents of the Empathy Ledger database (no credentials here); whether
the 221 objects in public storyteller buckets are consented; the definition of
`mv_revolving_door` (so the lobbying-vector claim is unresolved); whether any of the 55
SECURITY DEFINER functions actually leak data; deployed Supabase edge functions (MCP returned
Unauthorized); the row counts each of the 212 views actually returns (I mapped their dependencies
rather than executing 212 counts against a shared pooler); the contents of any jsonb column.
