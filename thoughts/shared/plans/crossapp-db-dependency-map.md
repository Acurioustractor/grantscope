# Cross-app DB dependency map — who reads grantscope's data

**Date:** 2026-06-21 · **Method:** DB-free static audit of 5 repos (no DB queried — shared box was mid-saturation)
**Question:** Can grantscope's data move off the shared "Empathy Ledger" box (`tednluwflfhxyucgwigh`) without breaking JusticeHub / act-global / regenerative / empathy-ledger-v2?
**Verdict:** **Partially safe. Recommended door: read-replica / "CivicGraph-as-a-service" — NOT a clean cut-the-cord, NOT keep-as-is.**

## The headline (Ben's nervousness was correct)
The other apps **do** read grantscope's data. A naive "move it and cut the cord" **breaks JusticeHub and act-global today.** BUT the coupling is small and bounded — raw grep counts (92 `gs_entities` hits etc.) overstate it; ~90% of those are grantscope's *own* code.

## The estate splits three ways

### 1. Grantscope-only (80+ tables) — moves with ZERO cross-app impact
All `org_*`, `foundation_*` (except the few below), `goods_*`, `civic_*`, `agent_*`, `se_*`, the grant-discovery pipeline, **every `mv_*` view**, `ato_tax_transparency`, `seifa_2021`, `postcode_geo`, `saved_*`, alerts, `api_keys`. **This is the heavy/batch load causing the saturation, and it's free to move.**

### 2. The shared read/write surface (~13 tables) — the real blockers
| Table | Also used by | Access | Impact if moved |
|---|---|---|---|
| `gs_entities` | JusticeHub, EL, act-global | read ×3, **WRITE by JusticeHub** (enrich cron) | JH org graph/power-map break (22 files); enrich cron silently stops; act-global `/api/grantscope` → 0 |
| `gs_relationships` | JusticeHub, EL, act-global | read-only | JH network viz loses edges; EL/act-global relationship panels blank |
| `acnc_charities`, `acnc_ais` | EL, act-global | read-only | EL charity financials / sector benchmarks break |
| `austender_contracts`, `political_donations`, `mv_gs_donor_contractors` | EL | read-only | EL revolving-door analysis loses sides |
| `foundations`, `foundation_programs` | EL, act-global, act-regen(build) | read-only | act-global finance/pipeline/search + EL grant-matching break |
| `foundation_relationship_signals` | act-global | read-only | act-global finance dashboard loses ACT-signal columns |
| `outcome_submissions` | EL | **WRITE** (funding write-back) | EL's funding-evidence write-back into grantscope breaks |
| `grant_opportunities`, `grant_applications` | act-global | **READ-WRITE** (grant-engine) | ⚠️ **CO-OWNED, ambiguous** — thorniest blocker |

**Only TWO cross-app writes** into grantscope exist: JusticeHub→`gs_entities`, EL→`outcome_submissions`. Both are async-tolerant evidence write-back.

### 3. Shared identity backbone — STAYS on the main box regardless
`auth.users`, `org_profiles`, `org_members`, `canonical_entities`, `entity_identifiers`, `ghl_*`, `xero_*`. Grantscope FK-references `auth.users`/`org_profiles`/`org_members` from ~8 of its own tables — moving grantscope **severs those FKs** unless they're replicated or soft-referenced (internal migration cost, not a cross-app blocker).

## Per-app verdict
- **empathy-ledger-v2** — reads grantscope data BUT already uses a **separate `CIVICGRAPH_SUPABASE_URL` client**. It follows grantscope wherever it lives — **a repoint, not a rewrite.** Not a real blocker. *This is the pattern to generalize.*
- **act-regenerative-studio** — **not a blocker.** Only a build script reads `foundations`; running site unaffected.
- **JusticeHub** — **genuine break-on-move.** `gs_entities`/`gs_relationships` org graph + the write-back cron. Needs a CivicGraph-style separate client.
- **act-global-infrastructure** — **genuine break-on-move.** grant-engine read-WRITE + `/api/grantscope`. Needs the co-ownership resolved + a CivicGraph client.

## The proper way (recommended door: read-replica / CivicGraph-as-service)
Grantscope **is** the shared civic-data backbone the ecosystem already consumes — informally and accidentally, which is why it saturates. Don't cut it off; **promote it to a first-class shared service on its own box, and have every consumer connect to it explicitly** (exactly what empathy-ledger-v2 already does via `CIVICGRAPH_SUPABASE_URL`). Then:
- Heavy data + batch + the cross-app *reads* of grantscope all leave the Empathy Ledger **app** box → saturation relieved.
- Consumers keep their data — they read it from the dedicated box via a repointed CivicGraph client (and/or a read replica for the ~13 shared tables).
- The two write-backs (JH→`gs_entities`, EL→`outcome_submissions`) get repointed explicitly.

This **honors the shared-platform investment** — it makes the sharing explicit and robust instead of accidental and saturating.

## Ownership — RESOLVED by Ben 2026-06-21
1. **`grant_opportunities` / `grant_applications` → grantscope-owned.** They **MOVE** with grantscope. act-global read-WRITEs them via grant-engine → act-global becomes a cross-project CivicGraph client (a cross-project WRITE; must be repointed, not just read-replica'd).
2. **`justice_funding` / `alma_*` → JusticeHub-owned.** They **STAY** on the shared box (JusticeHub is system-of-record). **This flips an earlier assumption** — they were listed in grantscope's "moves" set; they come OUT. Consequence: **grantscope becomes a cross-project CONSUMER of JusticeHub's justice/alma data.**
   - ⚠️ **WRINKLE — VERIFIED (grep, 2026-06-21):** grantscope's pipeline is the **active WRITER** of this estate, not just a reader. **84 scripts write `justice_funding`** (`scrape-grants-sa`, `scrape-qgip-grants`, `scrape-qld-yj-contracts`, `ingest-prf-portfolio`, topic-tag backfills) and **53 write `alma_*`** (`enrich-alma-orgs`, `link-alma-entities`, `insert-picc-alma-programs`, ALMA linkers). So JusticeHub = system-of-record/product intent, but **grantscope = the data pipeline that fills them.** This means the tables should travel with the pipeline (**MOVE with grantscope**). This is *cleaner* for saturation: grantscope's justice/alma writes + the MVs that scan `justice_funding` (`mv_entity_power_index`) move off the shared box entirely.
   - ✅ **RESOLVED (grep of JusticeHub repo, 2026-06-21):** JusticeHub's **live app does NOT query `justice_funding`/`alma_*` at all — 0 `.from()` refs.** The 816/3247 raw mentions are entirely docs, output reports, archived scrapers (`.archive/scrapers/alma-*`), and `.claude` worktree caches. JH has old schema *migrations* but no runtime read/write. So **no bidirectional write problem — they move cleanly with grantscope.** JusticeHub's real coupling is only `gs_entities`/`gs_relationships` (org graph + enrich-back cron). Low-confidence residual: confirm JH doesn't reach them via raw SQL / RPC / a view (0 `.from()` + all-docs mentions make this unlikely — not a blocker).
3. **grantscope→`auth.users`/`org_profiles`/`org_members` FKs** (~8 tables) — replicate the IDs, soft-reference, or drop the FKs at move time. (Still open — internal migration cost.)

## Sequence (revised from the de-share plan)
1. **Immediate relief (reversible):** bump the shared box compute for headroom now while the proper move is planned. *(Optional but cheap.)*
2. **Resolve the 3 unknowns** above (Ben's knowledge + 1 quick query each once the box is reachable).
3. **Generalize the CivicGraph client pattern** — give JusticeHub + act-global the same separate-client treatment EL already has, pointed at the current box (no data move yet). This decouples the *connection* before moving the *data* — a safe intermediate state.
4. **Move grantscope's estate** to its own project (Barkly or new), repoint every CivicGraph client + the 2 write-backs, expose the ~13 shared tables via replica/API.
5. **Verify + decommission** (drop moved tables from Empathy Ledger to actually free the pool).

See also: `grantscope-deshare-to-barkly.md` (the table-level move/stay/cutover detail — still valid as the Door-4 playbook).
