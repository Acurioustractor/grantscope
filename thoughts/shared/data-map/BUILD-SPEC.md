> **⚠ READ `VERIFICATION.md` BEFORE ACTING ON THIS DOCUMENT.**
> An adversarial pass checked 41 claims here: 34 CONFIRMED (most to the exact digit), 7 corrected.
> The corrections are not cosmetic. In particular:
> - **19 objects on the DELETE/DROP list are read or written by live application code.** The
>   analysis equated "empty" with "unused"; they are write-first tables. Do not drop anything
>   from this document without first grepping both `src` trees AND `pg_proc.prosrc`.
> - The justice drill-through gap is **100%, not 82%** — `gs_relationships.source_record_id` is a
>   dead key namespace, not a partial-orphan problem.
> - QLD watchhouse figures need rebaselining: the first monthly bucket is n=2 snapshots.
>   On a May baseline it is 2.7x (not 3.0x) and non-Indigenous +476% (not +868%).
> - "290 dark objects" means *unreferenced by application code*, not unused — the scan never read
>   410 database function bodies or 227 triggers (measured 23% false-positive rate on a sample).
> - This document covers 812 tables/matviews. The schema actually holds **1,024 relations** —
>   212 views and 409 functions were never inventoried. See `COMPLETENESS.md`.

---

# THE BUILD SPEC — CivicGraph Clarity

**The data map, the ledger, the drill-down and the gap board.**
Written 2026-08-14. Target repo: `/Users/benknight/Code/grantscope`, app at `apps/web`.
Binding constraints: `CLAUDE.md` (Server Components by default, no CLI for user features,
bulk SQL not API loops) and `DESIGN.md` (Civic Bauhaus — read before any visual decision).

Verification key: **[V]** I read the file / ran the query this session · **[R]** taken from a
wave-1 research file that marked it verified · **[I]** my inference · **[U]** unverified.

---

## 0. The one-paragraph answer

Ben asked for five things. They are four screens and one nightly job, and the job is the hard
part. Build a materialised **`data_inventory`** snapshot (one row per object, every column
machine-derived), render it as a **dense faceted ledger** at `/clarity`, add a **coverage matrix**
where absence has its own glyph, hang an **object dossier** off every row, and put the **join map**
behind a button. Do not build a KPI dashboard — the request is Shneiderman's *browse* pole, not
Few's *monitor* pole **[R: research-dashboards §1]**. Do not draw the entity graph as the front
door — 812 objects hairball and 609K entities are undrawable **[R: research-visualization §2.2]**.
Slice 1 ships in about two days because the domain classification for all 812 objects **already
exists in machine-parseable form** and does not need to be typed **[V, §3.4]**.

---

## 1. Information architecture

### 1.1 The route family: `/clarity`. Decision and defence.

```
apps/web/src/app/clarity/
├── layout.tsx                    admin gate + .ws workspace theme wrapper
├── page.tsx                      Screen 1 — THE LEDGER (Tier 0 overview + Tier 1 ledger)
├── ledger-client.tsx             "use client" — the one interactive island
├── gaps/page.tsx                 Screen 2 — THE GAP BOARD
├── [object]/page.tsx             Screen 3 — OBJECT DOSSIER
├── [object]/columns-client.tsx   "use client" — column filter/sort
├── map/page.tsx                  Screen 4 — THE JOIN MAP (server shell)
├── map/join-map-client.tsx       "use client" — react-force-graph-2d host
└── domain/[domain]/page.tsx      Screen 5 — DOMAIN VIEW (thin wrapper on the ledger)

apps/web/src/app/api/clarity/
├── inventory/route.ts            GET the whole snapshot as JSON (map + external consumers)
├── object/[name]/route.ts        GET live detail for one object (sample rows, live count)
└── refresh/route.ts              POST admin-only manual refresh trigger

apps/web/src/lib/clarity/
├── types.ts                      DataObject / DataEdge / Domain / Lifecycle / Verdict types
├── domains.ts                    the 16-domain registry: label, colour, blurb, order
├── seed-domains.ts               GENERATED — 812 name → {domain, lifecycle} assignments
├── inventory.ts                  server reads: getInventory(), getObject(), getEdges()
├── coverage.ts                   the six coverage scalars + the per-object gap vector
└── opportunities.ts              the typed opportunity registry (Screen 2's payload)

scripts/
├── seed-clarity-domains.mjs      ONE-OFF: parse the shard markdown → seed-domains.ts
├── snapshot-data-inventory.mjs   NIGHTLY: calls refresh_data_inventory() via psql
└── scan-code-references.mjs      WEEKLY: ripgrep both repos → data_inventory_code_ref
```

**Why `/clarity` and not `/catalog`, `/data` or `/atlas`.**

1. **The codebase already named it.** `apps/web/src/app/api/data/schema-graph/route.ts:11` says
   verbatim *"Powers the interactive Obsidian-style schema visualization on /clarity"* **[V]**.
   That API is live, deployed and has zero consumers **[V — I read it; `apps/web/src/app/clarity`
   does not exist]**. Taking the name back reconnects a working backend to its documented
   consumer. The commit reads as a restoration, not a new SaaS surface.
2. **The reason it was killed does not apply.** `/clarity` was deleted 2026-04-24 in commit
   `bd20a8c` *"scope cut to portfolio mode — kill SaaS-shaped surfaces"* **[R:
   existing-surfaces]**. This build is an internal instrument, not a product surface. It ships
   **admin-gated** behind `requireAdminPage`, exactly as `/ops/layout.tsx` does **[V]**, which
   honours the original decision instead of quietly reversing it.
3. **`/data` is wrong.** It collides conceptually with the `/api/data/*` namespace and reads as a
   downloads page; `/giving/downloads` already owns that meaning.
4. **`/catalog` is wrong.** There are already two tables one letter apart — `data_catalog` (25
   rows, ours) and `data_catalogue` (261 rows, JusticeHub's harvest of *other people's* open-data
   portals) **[V: both in census.csv]**. A third "catalog" noun makes an existing naming hazard
   worse.
5. **`/atlas` is taken and means places.** It has its own typed layer registry, and `/map` already
   307-redirects into it **[R: existing-surfaces]**. Overloading it would break a clean
   consolidation that has already happened.

The word *clarity* also happens to be the right register: this surface's job is to say what we
hold and what we get wrong, in that order.

### 1.2 Disposition of every existing surface — extend / replace / leave alone

| Surface | Disposition | Action |
|---|---|---|
| `/api/data/schema-graph` (280 lines, orphaned) | **EXTEND** | Keep the URL and the `{nodes, edges}` contract. Delete the 70-entry `TABLE_DOMAIN` map and the `if (!domain) continue;` at line 151 — it silently drops 742 of 812 objects **[V]**. Source domain from `data_inventory`. **Also replace `pg_stat_user_tables.n_live_tup` (line 107) — it is wrong on this instance: `political_donations` reports 0 against an actual 2,549,483 [V, §3.1]. The current route therefore drops the second-largest table in the database entirely.** |
| `data_catalog` + `data_catalog_snapshots` + `snapshot_data_catalog()` | **EXTEND, DO NOT REBUILD** | The nightly job runs and is real (latest snapshot 2026-08-13 **[R]**). Keep it as the *hand-curated governance overlay* — `owner_team`, `pii_level`, `sla_hours`, `source_of_truth`, `provenance_field`. `data_inventory` LEFT JOINs it on `table_name`. Do not migrate the 25 rows; do not delete anything. |
| `/mission-control` (33 hardcoded tables) | **LEAVE ALONE now → PARTIAL RETIRE at slice 5** | Its agent-runs, task, schedule and SQL-playground sections stay. At slice 5, replace the *Data Inventory* section with a link to `/clarity` and delete the hardcoded `TABLES` array. Not before — it works today. |
| `/ops/health` + `/ops/health/[dataset]` (20 datasets) | **LEAVE ALONE** | Different job: it browses *rows* for 20 curated datasets. `/clarity/[object]` links to it when `ops_health_slug` is set. At slice 4 its hand-written `connections` array becomes generated from `data_inventory_edge`. |
| `lib/giving-commons.ts` `PUBLIC_DATASETS` (6) | **LEAVE ALONE** | It is the public contract at `/giving/sources` with a corrections form. `data_inventory` gains a `public_dataset_key` pointer so the ledger shows "published publicly". |
| `lib/atlas/layers.ts` | **LEAVE ALONE — borrow the type discipline** | Copy the pattern, not the code: mandatory caveat, `status: 'live' \| 'declared'`, consent tier, `honestAt`. See §3.6. |
| `/architecture` (461 lines) | **DELETE** | Lists `/corporate`, `/simulator`, `/for/*` as public pages; none exist **[R: verified by `ls`]**. LLM health is a frozen snapshot presented as live status. Not in nav. Its pipeline-flow visual vocabulary is worth keeping as reference only. |
| `/graph` (2,149 lines, 9 modes) | **LEAVE ALONE** | It maps *entities* (ladder level L3), not the data model (L0). `/clarity/[object]` deep-links into it. Do not merge. |
| `/insights`, `/dashboard` | **LEAVE ALONE** | Narrative stat rollups, funder-facing. Different audience. |
| JusticeHub `/admin/data-observatory` + `src/lib/data-observatory/` | **DO NOT TOUCH** | 111 untracked files, a migration dated today, another session mid-flight **[R: existing-surfaces]**. It catalogs *sources and pipelines*; `/clarity` catalogs *objects*. They are complements. Ask Ben before any overlap; the integration point is a future `pipeline_asset_key` column, not shared code (React 19/Next 15/Tailwind 4 vs React 18/Next 14.2/Tailwind 3 — components are not portable **[R]**). |
| `data/schema-cache.md`, `COMPENDIUM.md`, `thoughts/.../db-inventory.md` | **STOP MAINTAINING** | All three rotted within five months and nothing failed **[R]**. Add a one-line header to each pointing at `/clarity`. Do not write a fourth markdown inventory. |

### 1.3 Nav

Do **not** add `/clarity` to `components/nav.tsx` (public nav, 42 links). Add it to the admin
strip alongside `/ops` and `/mission-control`. It is an instrument, not a product page.

---

## 2. The ladder — what each level answers

Semantic zoom means the *representation* changes, not the scale **[R: research-visualization §5.1]**.
The test: write the one sentence a user can finish at that level and nowhere else. If two levels
finish the same sentence, delete one.

| Level | Route | Sentence only this level finishes | Form |
|---|---|---|---|
| L0 | `/clarity` | "We hold **812 objects, 52.3M rows**, and **N%** of them are documented." | dense table + coverage bars |
| L1 | `/clarity/gaps` | "The **holes** are concentrated in ___, and the biggest recoverable one is ___." | coverage matrix + opportunity queue |
| L2 | `/clarity/[object]` | "`justice_funding` holds **157,116** rows about ___, joins to ___ at **93.65%**, and 96 files read it." | record + column profile |
| L3 | `/clarity/map` | "The database has **N** islands, and `gs_entities` is what makes it one graph." | force graph, ~200 nodes |
| L4 | `/graph`, `/entities/[gsId]`, `/atlas` | "This *organisation* is connected to ___ through ___, worth $___." | existing surfaces |

L0→L1 is a **matrix**, L1→L2 is a **record**, L2→L3 is a **graph**, L3→L4 is a **different app
surface**. Four forms in one path. That is what "several levels" must mean.

---

## 3. The data layer

### 3.1 Facts that dictate the design (all verified this session)

| Fact | Consequence |
|---|---|
| `pg_stat_user_tables.n_live_tup` is **unreliable here**: `political_donations` → 0 (actual 2,549,483), `data_catalog` → 0 (actual 25), `qld_watchhouse_snapshot_rows` → 144 (actual 8,488) **[V]** | **Never use `n_live_tup`.** The existing schema-graph route does, and drops the 2.5M-row donations table. |
| `pg_class.reltuples` is close but not exact: `qld_watchhouse` 7,404 vs 8,488 (−13%), `data_catalog` 22 vs 25, `mv_charity_network` 340,818 vs 351,455 (−3%) **[V]** | Use `reltuples` only for the 8 objects ≥ 2M rows, and mark them `row_count_exact = false` so the UI prints `≈`. |
| All **98 matviews are invisible to `information_schema.columns`** — `columns.csv` covers 926 names = 714 tables + 212 regular views, zero matviews **[V, R: join-spine §8.2]** | Column introspection must read **`pg_attribute`**, not `information_schema`. This is the single most common way this build fails silently. |
| **74.5% of tables (690 of 926) carry an auto-derivable freshness column** — `updated_at` 428, `created_at` 219, then a long tail **[V, computed from columns.csv]** | Freshness is derivable with zero human input for three-quarters of the estate. The other 236 get `freshness_column = null` and a `+` glyph, not a fake zero. |
| 812 objects, 26.3 GB, largest is `abr_registry` at 20,006,350 rows / 6.9 GB **[V/R]** | Exact `count(*)` on everything under 2M rows is ~28M rows scanned — fine nightly, fatal on page load. |
| The `exec_sql` RPC path has an **8-second statement timeout** and the app-side guard rejects anything that is not a single top-level SELECT/WITH **[V: `lib/supabase.ts`]** | The refresh job cannot run through the app. It runs as a plpgsql function invoked by psql. |
| **1,541,951 rows across 14 backup-named objects** and 1,278,440 rows of `privacy_audit_log` **[R]** | 5.4% of the database is noise. A naive "list everything" page is dominated by it. `lifecycle` must be a first-class filter, defaulting to hide `backup`. |

### 3.2 DDL — `supabase/migrations/20260815000000_clarity_data_inventory.sql`

Apply with psql per CLAUDE.md Rule #1 (`gsql.mjs -c` mangles `$$` dollar-quoting):

```bash
source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
  -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
  -U "postgres.tednluwflfhxyucgwigh" -d postgres \
  -f supabase/migrations/20260815000000_clarity_data_inventory.sql
```

```sql
-- CivicGraph Clarity — the object inventory.
-- One row per public-schema table or matview. Every column in this table is
-- MACHINE-DERIVED except domain/lifecycle (seeded once, editable) and the
-- verdict fields (human, optional). Nothing here blocks on human writing.
--
-- Refresh: SELECT refresh_data_inventory();   -- see scripts/snapshot-data-inventory.mjs
-- Never read pg_stat_user_tables.n_live_tup on this instance: it reports 0 for
-- political_donations (2.5M actual). Verified 2026-08-14.

-- ---------------------------------------------------------------- enums
DO $enum$ BEGIN
  CREATE TYPE clarity_lifecycle AS ENUM (
    'core_source',      -- ingested from a named external source
    'derived',          -- computed from other objects (most matviews)
    'crosswalk',        -- identifier resolution between universes
    'app_operational',  -- powers a product surface / workflow state
    'staging',          -- transient, feeding a migration or dedup lane
    'backup',           -- dated point-in-time snapshot, restorable, not live
    'superseded',       -- replaced by a newer object that still coexists
    'scaffold_empty'    -- declared but never populated
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

DO $enum$ BEGIN
  CREATE TYPE clarity_verdict AS ENUM ('keep','suspect','cruft');
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

-- ---------------------------------------------------------------- main table
CREATE TABLE IF NOT EXISTS data_inventory (
  relname            text PRIMARY KEY,
  kind               text NOT NULL CHECK (kind IN ('table','matview','view')),

  -- size, derived nightly
  row_count          bigint,
  row_count_exact    boolean NOT NULL DEFAULT true,
  bytes              bigint,
  column_count       integer,
  nullable_columns   integer,

  -- structure, derived nightly
  fk_out             integer NOT NULL DEFAULT 0,   -- declared FKs this object owns
  fk_in              integer NOT NULL DEFAULT 0,   -- declared FKs pointing at it
  join_out           integer NOT NULL DEFAULT 0,   -- curated implicit joins out (edge table)
  join_in            integer NOT NULL DEFAULT 0,
  degree             integer GENERATED ALWAYS AS (fk_out + fk_in + join_out + join_in) STORED,

  -- freshness, derived nightly
  freshness_column   text,        -- auto-picked timestamp column, null if none exists
  last_write_at      timestamptz, -- MAX(freshness_column); null if unknown
  freshness_probe    text CHECK (freshness_probe IN ('ok','no_column','timeout','error')),

  -- classification. Seeded once from the 2026-08-14 inventory shards, then editable.
  domain             text,
  lifecycle          clarity_lifecycle,
  grain              text,        -- "what makes a row unique" — prose, seeded
  purpose            text,        -- one sentence, seeded
  caveat             text,        -- what the number does NOT contain

  -- usage, derived by scripts/scan-code-references.mjs (ripgrep, weekly)
  refs_civicgraph    integer NOT NULL DEFAULT 0,
  refs_justicehub    integer NOT NULL DEFAULT 0,
  refs_scripts       integer NOT NULL DEFAULT 0,
  owner_app          text CHECK (owner_app IN ('civicgraph','justicehub','both','neither')),

  -- pointers into surfaces that already exist
  ops_health_slug    text,        -- /ops/health/<slug> if that dataset is browsable
  public_dataset_key text,        -- giving-commons PUBLIC_DATASETS key if published
  catalog_linked     boolean NOT NULL DEFAULT false, -- has a data_catalog row

  -- derived state + rank
  state              text,        -- live | empty | tiny | backup | superseded | staging
  importance         numeric(8,4) NOT NULL DEFAULT 0,

  -- human, optional. CRUFT requires a reason (enforced below).
  verdict            clarity_verdict,
  verdict_reason     text,
  verdict_by         text,
  verdict_at         timestamptz,

  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  refreshed_at       timestamptz NOT NULL DEFAULT now(),

  -- Alation's rule: a bad flag without a written reason becomes noise.
  CONSTRAINT data_inventory_cruft_needs_reason
    CHECK (verdict IS DISTINCT FROM 'cruft'
           OR (verdict_reason IS NOT NULL AND btrim(verdict_reason) <> ''))
);

CREATE INDEX IF NOT EXISTS idx_data_inventory_domain     ON data_inventory(domain);
CREATE INDEX IF NOT EXISTS idx_data_inventory_lifecycle  ON data_inventory(lifecycle);
CREATE INDEX IF NOT EXISTS idx_data_inventory_importance ON data_inventory(importance DESC);

-- ---------------------------------------------------------------- history
-- Catches the failure nobody caught: justice_funding went 218,022 -> 157,116
-- between April and August and nothing warned. A shrinking table is a signal.
CREATE TABLE IF NOT EXISTS data_inventory_history (
  id           bigserial PRIMARY KEY,
  snapshot_at  timestamptz NOT NULL DEFAULT now(),
  relname      text NOT NULL,
  row_count    bigint,
  bytes        bigint,
  last_write_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_dih_rel_time ON data_inventory_history(relname, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_dih_time     ON data_inventory_history(snapshot_at DESC);

-- ---------------------------------------------------------------- the join graph
-- Declared FKs are NOT the spine: the top FK target is `users` (17 rows, 91 FKs)
-- and the nine largest objects have no FKs at all. So this table carries BOTH
-- declared FKs (auto) and curated implicit joins (seeded, with measured rates).
CREATE TABLE IF NOT EXISTS data_inventory_edge (
  id              bigserial PRIMARY KEY,
  src_relname     text NOT NULL,
  src_column      text NOT NULL,
  tgt_relname     text NOT NULL,
  tgt_column      text NOT NULL,
  mechanism       text NOT NULL CHECK (mechanism IN
                    ('fk','uuid_stamp','abn','acn','name','postcode','lga','icn','other')),
  declared        boolean NOT NULL DEFAULT false,  -- true = real pg_constraint
  -- measured 2026-08-14 for the curated set; null until measured
  match_rate      numeric(6,3),
  match_measured_at timestamptz,
  match_method    text,        -- 'full scan' | 'TABLESAMPLE n=...' | null
  note            text,
  UNIQUE (src_relname, src_column, tgt_relname, tgt_column, mechanism)
);
CREATE INDEX IF NOT EXISTS idx_die_src ON data_inventory_edge(src_relname);
CREATE INDEX IF NOT EXISTS idx_die_tgt ON data_inventory_edge(tgt_relname);

-- ---------------------------------------------------------------- columns
-- Populated for objects under a size threshold; matviews read from pg_attribute
-- because information_schema.columns does not cover them (verified: 0 of 98).
CREATE TABLE IF NOT EXISTS data_inventory_column (
  relname      text NOT NULL,
  ordinal      integer NOT NULL,
  column_name  text NOT NULL,
  data_type    text NOT NULL,
  is_nullable  boolean NOT NULL,
  null_pct     numeric(6,2),   -- null when not profiled
  distinct_est bigint,         -- from pg_stats.n_distinct, null when unavailable
  profiled_at  timestamptz,
  PRIMARY KEY (relname, ordinal)
);

-- ---------------------------------------------------------------- code refs
CREATE TABLE IF NOT EXISTS data_inventory_code_ref (
  id         bigserial PRIMARY KEY,
  relname    text NOT NULL,
  repo       text NOT NULL CHECK (repo IN ('civicgraph','justicehub')),
  file_path  text NOT NULL,
  hits       integer NOT NULL DEFAULT 1,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relname, repo, file_path)
);
CREATE INDEX IF NOT EXISTS idx_dicr_rel ON data_inventory_code_ref(relname);

-- ---------------------------------------------------------------- opportunities
-- Screen 2's payload. Seeded from the 2026-08-14 research; each row is a
-- concrete, sized, actionable move — not a missing description.
CREATE TABLE IF NOT EXISTS data_inventory_opportunity (
  key          text PRIMARY KEY,
  title        text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('broken','dark','gap','cruft','unlinked','unpublished')),
  relnames     text[] NOT NULL DEFAULT '{}',
  rows_at_stake bigint,
  effort       text NOT NULL CHECK (effort IN ('S','M','L')),
  evidence     text NOT NULL,          -- the measurement that proves it
  action       text NOT NULL,          -- the one sentence an engineer executes
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','doing','done','declined')),
  status_note  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- read view
CREATE OR REPLACE VIEW v_clarity_ledger AS
SELECT
  di.*,
  dc.owner_team,
  dc.pii_level,
  dc.sla_hours,
  dc.source_of_truth,
  dc.description AS catalog_description,
  -- the six gap dimensions, as booleans the UI renders as ✓ or +
  (di.domain IS NOT NULL)                              AS has_domain,
  (di.purpose IS NOT NULL AND btrim(di.purpose) <> '') AS has_purpose,
  (dc.owner_team IS NOT NULL)                          AS has_owner,
  (di.degree > 0)                                      AS has_join,
  (di.refs_civicgraph + di.refs_justicehub + di.refs_scripts > 0) AS has_code,
  (di.last_write_at IS NOT NULL
     AND di.last_write_at > now() - interval '30 days') AS is_fresh
FROM data_inventory di
LEFT JOIN data_catalog dc ON dc.table_name = di.relname;
```

### 3.3 The refresh function

```sql
-- refresh_data_inventory() — the whole nightly job in one DB round trip.
-- Runtime ~60-150s. MUST NOT be called through the app's exec_sql RPC
-- (8s statement timeout, SELECT-only guard). Call it from psql.

CREATE OR REPLACE FUNCTION refresh_data_inventory()
RETURNS TABLE (objects integer, exact_counts integer, estimated_counts integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  rec        record;
  n_total    integer := 0;
  n_exact    integer := 0;
  n_est      integer := 0;
  v_rows     bigint;
  v_exact    boolean;
  v_fresh_col text;
  v_last     timestamptz;
  v_probe    text;
  -- priority order for auto-picking a freshness column. First hit wins.
  fresh_candidates text[] := ARRAY[
    'updated_at','created_at','snapshot_at','scraped_at','last_seen','fetched_at',
    'inserted_at','ingested_at','synced_at','imported_at','recorded_at','collected_at',
    'published_at','extracted_at','processed_at','started_at','run_at','captured_at',
    'crawled_at','harvested_at','observed_at','last_updated','event_time','occurred_at'
  ];
BEGIN
  FOR rec IN
    SELECT c.oid,
           c.relname,
           CASE c.relkind WHEN 'r' THEN 'table' WHEN 'm' THEN 'matview' ELSE 'view' END AS kind,
           c.reltuples::bigint AS est_rows,
           pg_total_relation_size(c.oid) AS bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','m')
    ORDER BY c.relname
  LOOP
    n_total := n_total + 1;

    -- 1. ROW COUNT. Exact under 2M; reltuples above (abr_registry is 20M / 6.9GB).
    IF rec.est_rows < 2000000 THEN
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I', rec.relname) INTO v_rows;
        v_exact := true; n_exact := n_exact + 1;
      EXCEPTION WHEN OTHERS THEN
        v_rows := GREATEST(rec.est_rows, 0); v_exact := false; n_est := n_est + 1;
      END;
    ELSE
      v_rows := GREATEST(rec.est_rows, 0); v_exact := false; n_est := n_est + 1;
    END IF;

    -- 2. FRESHNESS. pg_attribute, NOT information_schema — matviews are absent there.
    SELECT a.attname INTO v_fresh_col
    FROM pg_attribute a
    JOIN unnest(fresh_candidates) WITH ORDINALITY AS f(name, ord) ON f.name = a.attname
    WHERE a.attrelid = rec.oid
      AND a.attnum > 0 AND NOT a.attisdropped
      AND format_type(a.atttypid, NULL) IN ('timestamp with time zone','timestamp without time zone','date')
    ORDER BY f.ord
    LIMIT 1;

    v_last := NULL;
    IF v_fresh_col IS NULL THEN
      v_probe := 'no_column';
    ELSE
      BEGIN
        SET LOCAL statement_timeout = '6s';
        EXECUTE format('SELECT max(%I)::timestamptz FROM public.%I', v_fresh_col, rec.relname)
          INTO v_last;
        v_probe := 'ok';
      EXCEPTION
        WHEN query_canceled THEN v_probe := 'timeout';
        WHEN OTHERS        THEN v_probe := 'error';
      END;
      RESET statement_timeout;
    END IF;

    -- 3. UPSERT. Human/seeded fields are preserved by COALESCE-on-conflict.
    INSERT INTO data_inventory AS di (
      relname, kind, row_count, row_count_exact, bytes,
      column_count, nullable_columns,
      freshness_column, last_write_at, freshness_probe, refreshed_at
    )
    VALUES (
      rec.relname, rec.kind, v_rows, v_exact, rec.bytes,
      (SELECT count(*) FROM pg_attribute a
        WHERE a.attrelid = rec.oid AND a.attnum > 0 AND NOT a.attisdropped),
      (SELECT count(*) FROM pg_attribute a
        WHERE a.attrelid = rec.oid AND a.attnum > 0 AND NOT a.attisdropped AND NOT a.attnotnull),
      v_fresh_col, v_last, v_probe, now()
    )
    ON CONFLICT (relname) DO UPDATE SET
      kind = EXCLUDED.kind,
      row_count = EXCLUDED.row_count,
      row_count_exact = EXCLUDED.row_count_exact,
      bytes = EXCLUDED.bytes,
      column_count = EXCLUDED.column_count,
      nullable_columns = EXCLUDED.nullable_columns,
      freshness_column = EXCLUDED.freshness_column,
      last_write_at = EXCLUDED.last_write_at,
      freshness_probe = EXCLUDED.freshness_probe,
      refreshed_at = now();
  END LOOP;

  -- 4. DECLARED FK DEGREES (636 constraints — cheap, do it set-based).
  WITH fk AS (
    SELECT cl1.relname AS src, cl2.relname AS tgt
    FROM pg_constraint con
    JOIN pg_class cl1 ON con.conrelid  = cl1.oid
    JOIN pg_class cl2 ON con.confrelid = cl2.oid
    JOIN pg_namespace ns ON cl1.relnamespace = ns.oid
    WHERE con.contype = 'f' AND ns.nspname = 'public'
  )
  UPDATE data_inventory di SET
    fk_out = COALESCE((SELECT count(*) FROM fk WHERE fk.src = di.relname), 0),
    fk_in  = COALESCE((SELECT count(*) FROM fk WHERE fk.tgt = di.relname), 0);

  UPDATE data_inventory di SET
    join_out = COALESCE((SELECT count(*) FROM data_inventory_edge e
                          WHERE e.src_relname = di.relname AND NOT e.declared), 0),
    join_in  = COALESCE((SELECT count(*) FROM data_inventory_edge e
                          WHERE e.tgt_relname = di.relname AND NOT e.declared), 0);

  -- 5. STATE. Rule-derived, in precedence order.
  UPDATE data_inventory SET state = CASE
    WHEN relname ~ '_backup(_|$)' OR relname ~ '^_backup' OR lifecycle = 'backup' THEN 'backup'
    WHEN lifecycle = 'superseded'                     THEN 'superseded'
    WHEN lifecycle = 'staging' OR relname ~ '^stg_'
         OR relname ~ '_20[0-9]{6}[a-z]?$'            THEN 'staging'
    WHEN row_count = 0                                THEN 'empty'
    WHEN row_count < 10                               THEN 'tiny'
    ELSE 'live'
  END;

  -- 6. IMPORTANCE. Monte Carlo's five-input shape, with code refs standing in
  --    for query logs (we have none). Log-scaled so 20M rows does not swamp it.
  UPDATE data_inventory SET importance = ROUND((
      0.35 * LEAST(1.0, ln(GREATEST(row_count,1))    / ln(20000000))
    + 0.25 * LEAST(1.0, degree::numeric               / 20)
    + 0.25 * LEAST(1.0, ln(GREATEST(refs_civicgraph + refs_justicehub + refs_scripts, 1)) / ln(150))
    + 0.15 * CASE
               WHEN last_write_at IS NULL                              THEN 0.0
               WHEN last_write_at > now() - interval '7 days'          THEN 1.0
               WHEN last_write_at > now() - interval '30 days'         THEN 0.7
               WHEN last_write_at > now() - interval '180 days'        THEN 0.3
               ELSE 0.1 END
  ) * CASE WHEN state IN ('backup','staging','superseded') THEN 0.1 ELSE 1.0 END, 4);

  -- 7. CATALOG LINK
  UPDATE data_inventory di
     SET catalog_linked = EXISTS (SELECT 1 FROM data_catalog dc WHERE dc.table_name = di.relname);

  -- 8. HISTORY
  INSERT INTO data_inventory_history (relname, row_count, bytes, last_write_at)
  SELECT relname, row_count, bytes, last_write_at FROM data_inventory;

  -- 9. Retire rows for objects that no longer exist.
  DELETE FROM data_inventory di
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','m') AND c.relname = di.relname);

  RETURN QUERY SELECT n_total, n_exact, n_est;
END;
$fn$;
```

**Backfill of declared FK edges** (run once in the same migration, then it is idempotent):

```sql
INSERT INTO data_inventory_edge
  (src_relname, src_column, tgt_relname, tgt_column, mechanism, declared, note)
SELECT DISTINCT
  cl1.relname, att1.attname, cl2.relname, att2.attname, 'fk', true, con.conname
FROM pg_constraint con
JOIN pg_class cl1     ON con.conrelid  = cl1.oid
JOIN pg_class cl2     ON con.confrelid = cl2.oid
JOIN pg_attribute att1 ON att1.attrelid = cl1.oid AND att1.attnum = ANY(con.conkey)
JOIN pg_attribute att2 ON att2.attrelid = cl2.oid AND att2.attnum = ANY(con.confkey)
JOIN pg_namespace ns  ON cl1.relnamespace = ns.oid
WHERE con.contype = 'f' AND ns.nspname = 'public'
ON CONFLICT DO NOTHING;
```

### 3.4 Seeding domain + lifecycle — **this is already done, do not hand-write it**

The three inventory shard files in the scratchpad classify **all 812 objects** with
`domain / lifecycle / grain / join_keys / purpose / flags`, in pipe tables. I parsed them this
session: **812 of 812 matched, zero missing** **[V]**.

```
inventory-shard-a.md    281 rows
inventory-shard-g-m.md  225 rows
inventory-shard-n-z.md  306 rows
                        --- 812, exactly the census
```

Domain histogram **[V]**: `platform_ops_auth` 215 · `ai_agents_pipeline` 85 · `grants_funding` 71
· `storytelling_consent` 49 · `geography_place` 46 · `media_narrative` 44 ·
`evidence_outcomes_alma` 43 · `philanthropy_giving` 42 · `justice_youth_detention` 39 ·
`social_services` 37 · `people_directors_governance` 36 · `government_spend_procurement` 32 ·
`political_influence` 28 · `charities_ngo` 22 · `corporate_registry` 19 · `child_protection` 2 ·
`unknown` 2.

Lifecycle histogram **[V]**: `app_operational` 304 · `core_source` 189 · `derived` 154 ·
`scaffold_empty` 86 · `crosswalk` 37 · `staging` 20 · `backup` 14 · `superseded` 4 · (4 rows say
`scaffold_empty (effectively)` — normalise).

`scripts/seed-clarity-domains.mjs` — one-off, ~40 lines:

```js
// Parse the 2026-08-14 inventory shards into a typed seed module.
// Run once: node scripts/seed-clarity-domains.mjs <scratchpad-dir>
// Output:   apps/web/src/lib/clarity/seed-domains.ts  (committed, then hand-edited freely)
const ROW = /^\|\s*`?([a-zA-Z0-9_]+)`?\s*\|\s*(table|matview)\s*\|/;
// cells: [name, kind, rows, domain, lifecycle, grain, join_keys, purpose, flags]
// normalise: 'scaffold_empty (effectively)' -> 'scaffold_empty'; 'unknown' -> null
// emit: export const CLARITY_SEED: Record<string, SeedRow> = { ... }
```

Then a one-off SQL apply:

```sql
UPDATE data_inventory di SET
  domain    = s.domain,
  lifecycle = s.lifecycle::clarity_lifecycle,
  grain     = s.grain,
  purpose   = s.purpose
FROM (VALUES ('abr_registry','corporate_registry','core_source','one ABN','The full Australian Business Register…'), …)
  AS s(relname, domain, lifecycle, grain, purpose)
WHERE di.relname = s.relname AND di.domain IS NULL;
```

**Corollary: `DOMAINED` and `DESCRIBED` are ~100% on day one, not 44% and 12%.** The wireframe
numbers in research-dashboards were labelled placeholders; the real figures will be far better,
which changes what the coverage band should emphasise (freshness and code-usage, not domain).

Domain **display registry** in `lib/clarity/domains.ts` — 16 entries, each with label, one-line
blurb and one Bauhaus palette colour. Colours: this is 16 categories against a 4-colour palette,
so **do not colour-code domains by hue.** Use the four palette colours for *state* only
(§4.3) and give domains a neutral black label with a 4px black left-border on the tile — the
Bauhaus card pattern **[DESIGN.md, Cards]**. Sixteen hues would break the "colour signals state"
rule outright.

### 3.5 Refresh schedule and invocation

`scripts/snapshot-data-inventory.mjs` — mirrors `scripts/snapshot-data-catalog.mjs`
(which exists and works **[V]**):

```js
// Calls refresh_data_inventory() over psql (NOT the RPC — 8s timeout, SELECT-only guard),
// then logs to agent_runs via scripts/lib/log-agent-run.mjs.
// Flags: --fast  (skip exact counts, reltuples only — ~5s, for a mid-day nudge)
```

Register in `agent_schedules` the same way the migration for `data_catalog` did:

```sql
INSERT INTO agent_schedules (agent_id, interval_hours, enabled, freshness_threshold_hours,
                             auto_create_task, priority, params)
VALUES ('snapshot-data-inventory', 24, true, 26, false, 2, '{}'::jsonb)
ON CONFLICT (agent_id) DO UPDATE SET interval_hours = 24, enabled = true, updated_at = now();
```

**Do not add a Vercel cron for this.** `vercel.json` crons hit HTTP routes **[V]**; a 60–150s
plpgsql call under a shared pooler is not a safe serverless request. Run it on the same nightly
path as `refresh-views-v2.mjs`. `/api/clarity/refresh` exists only as an **admin-triggered
`--fast` refresh** (reltuples only), so a human can nudge the page without waiting for the night.

`scripts/scan-code-references.mjs` — weekly, offline, no DB reads:

```
For each of the 812 relnames, ripgrep both repos for:
   'name' | "name" | `name`  OR  \b(FROM|JOIN|INTO|UPDATE)\s+name\b
Exclude: node_modules, .next, dist, **/_archive/**, *.disabled,
         JusticeHub/src/types/database.types.ts  ← generated, lists every table, destroys signal
Then UPSERT data_inventory_code_ref and roll up refs_* + owner_app on data_inventory.
```

The generated-types exclusion is not optional — without it the usage signal is worthless **[R:
inventory-shard-g-m]**. The `.from()`-only approach under-reports by ~30%; the raw-SQL pass is
mandatory (`state_tenders` is invisible to `.from()` in grantscope but appears in three live
report pages via raw SQL) **[R: usage-justicehub]**.

### 3.6 Type discipline — copy `atlas/layers.ts`, don't copy its code

`lib/clarity/types.ts`:

```ts
/** A data object is not a table; it is a claim about what we hold. The type
 *  forces every claim to carry what it does NOT contain. An object may be
 *  registered without a caveat only while lifecycle is 'app_operational' —
 *  every core_source and derived object must state one, and the test rejects
 *  empty strings. (Pattern lifted from src/lib/atlas/layers.ts.) */
export interface DataObject {
  relname: string;
  kind: 'table' | 'matview' | 'view';
  domain: DomainKey | null;
  lifecycle: Lifecycle;
  state: 'live' | 'empty' | 'tiny' | 'backup' | 'superseded' | 'staging';
  rowCount: number | null;
  rowCountExact: boolean;      // false -> the UI prints "≈"
  bytes: number | null;
  lastWriteAt: string | null;
  freshnessProbe: 'ok' | 'no_column' | 'timeout' | 'error';
  degree: number;
  refs: { civicgraph: number; justicehub: number; scripts: number };
  ownerApp: 'civicgraph' | 'justicehub' | 'both' | 'neither';
  grain: string | null;
  purpose: string | null;
  caveat: string | null;       // what the number does not contain
  verdict: 'keep' | 'suspect' | 'cruft' | null;
  verdictReason: string | null;
  importance: number;
}
```

Guard test `lib/clarity/__tests__/inventory-coverage.test.ts` — the `surface.ts` pattern that is
the only artefact in either repo that demonstrably did **not** rot **[R: existing-surfaces]**:

```ts
it('every seeded relname exists in the census fixture', …)
it('every core_source or derived object has a non-empty caveat', …)
it('no object carries verdict=cruft without a reason', …)
it('every domain key in the seed appears in DOMAINS', …)
it('DOMAINS has no orphan entries', …)
```

Ship the fixture as a committed `census.json` refreshed by the same nightly script, so CI fails
when the registry and reality diverge. **A markdown map would rot the same way and nothing would
fail** — that sentence is already written in JusticeHub's `src/config/surface.ts` about this exact
repo **[R]**.

---

## 4. Screen-by-screen spec

Target 1440px. All screens wear the **`.ws` workspace theme** — 1px borders, subtle shadow,
Satoshi 700 not 900 **[V: `globals.css` lines 111–228]**. Set it on the layout:

```tsx
// apps/web/src/app/clarity/layout.tsx
import type { ReactNode } from 'react';
import { requireAdminPage } from '@/lib/admin-auth';
export const dynamic = 'force-dynamic';
export default async function ClarityLayout({ children }: { children: ReactNode }) {
  await requireAdminPage('/clarity');
  return <div className="ws min-h-screen bg-bauhaus-canvas">{children}</div>;
}
```

Available Tailwind tokens **[V]**: `bauhaus-black #121212`, `bauhaus-red #D02020`,
`bauhaus-blue #1040C0`, `bauhaus-yellow #F0C020`, `bauhaus-canvas #F0F0F0`,
`bauhaus-muted #777777`; `font-display` (Satoshi), `font-sans` (DM Sans), `font-mono`
(JetBrains Mono); `bauhaus-shadow`, `bauhaus-shadow-sm`.

---

### SCREEN 1 — `/clarity` · THE LEDGER

**Purpose.** Ben's ask (a) and (b), literally: every object, one row each, no pagination.
**Question it answers.** *"What do we hold, how big is it, and what do we not know about it?"*

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ CLARITY                                        ⌕ search 812 objects…            [ GAPS → ]   │
│ 812 OBJECTS · 714 TABLES · 98 MATVIEWS · 52,349,579 ROWS · 26.3 GB · SCANNED 14 AUG 03:12    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  LIVE          DOMAINED      PURPOSED      JOINED        USED IN CODE   FRESH ≤30d           │
│  724/812 89%   810/812 99%   810/812 99%   ??? /812      ??? /812       ??? /812             │
│  ████████▉░    █████████▉    █████████▉    ███▏░░░░░░    ████▎░░░░░     ██▌░░░░░░░           │
│  ↑ click any bar to filter the ledger to its complement (the gap, not the coverage)          │
│                                                                                              │
│  DOMAINS — 16 tiles, identical frame, click to filter. Sparkline = log10 row-count spread.   │
│  ┌───────────────┐┌───────────────┐┌───────────────┐┌───────────────┐┌───────────────┐       │
│  │▌PLATFORM/OPS  ││▌AI + PIPELINE ││▌GRANTS+FUNDING││▌STORY+CONSENT ││▌PLACE + GEO   │       │
│  │ 215 obj       ││  85 obj       ││  71 obj       ││  49 obj       ││  46 obj       │       │
│  │ 1.4M rows     ││ 6.2K rows     ││ 512K rows     ││ 1.1K rows     ││ 138K rows     │       │
│  │ ▁▃█▂▁▁▁▂▁▁    ││ ▁▂▄█▃▁▁▁▁▁    ││ ▂█▃▁▁▁▁▁▁▁    ││ █▄▂▁▁▁▁▁▁▁    ││ ▁▁█▅▂▁▁▁▁▁    │       │
│  │ 34 empty · 6⛔││ 12 empty      ││  9 empty      ││ 18 empty      ││  4 empty      │       │
│  └───────────────┘└───────────────┘└───────────────┘└───────────────┘└───────────────┘       │
│  ┌───────────────┐┌───────────────┐┌───────────────┐… 11 more tiles, same frame …            │
├────────────┬─────────────────────────────────────────────────────────────────────────────────┤
│ FILTERS    │ LENS [ROWS ▾]  rows · bytes · freshness · degree · code · gaps · owner · kind    │
│            │ 812 objects · showing 798 · sorted by IMPORTANCE ▾            [ EXTRACT ▾ ]      │
│ KIND       │ ┌───────────────────────┬───────┬───────┬──────┬─────────┬───┬───┬───┬───┬───┐  │
│ ▢ table 714│ │ OBJECT                │  ROWS │ SIZE  │ SEEN │ DOMAIN  │DOM│PUR│OWN│JOIN│USE│ │
│ ▢ matview98│ ├───────────────────────┼───────┼───────┼──────┼─────────┼───┼───┼───┼───┼───┤  │
│            │ │ gs_entities           │609,448│5.2 GB │  2d  │ENTITY   │ ✓ │ ✓ │ ✓ │ ✓ │ ✓ │ │
│ DOMAIN     │ │ ███████████████████   │       │       │      │         │   │   │   │   │   │ │
│ ▢ platform │ │ abr_registry        ≈ │20.0M  │6.9 GB │  +   │REGISTRY │ ✓ │ ✓ │ + │ ✓ │ ✓ │ │
│ ▢ grants   │ │ ████████████████████  │       │       │      │         │   │   │   │   │   │ │
│ ▢ justice  │ │ gs_relationships      │  3.4M │2.1 GB │  2d  │ENTITY   │ ✓ │ ✓ │ ✓ │ ✓ │ ✓ │ │
│ ▢ …16      │ │ █████████████         │       │       │      │         │   │   │   │   │   │ │
│            │ │ political_donations   │  2.5M │1.1 GB │ 31d  │INFLUENCE│ ✓ │ ✓ │ + │ ✓ │ ✓ │ │
│ LIFECYCLE  │ │ ████████████          │       │       │      │         │   │   │   │   │   │ │
│ ▢ core 189 │ │ mv_charity_network    │351,455│ 28 MB │  1d  │PEOPLE   │ ✓ │ ✓ │ + │ + │ + │ │
│ ▢ derived  │ │ ██████████  ⚠ refreshed nightly · read by NO code · 88% zero-value rows      │ │
│ ▢ app_op   │ │ ⛔ gs_entities_lga_backup_20260808          BACKUP · superseded by live table │ │
│ ▢ backup 14│ │ ██████████████████ 609,416 │ 41 MB │ 5d │ — │ + │ + │ + │ + │ + │             │ │
│ ▢ staging  │ ├───────────────────────┴───────┴───────┴──────┴─────────┴───┴───┴───┴───┴───┤  │
│            │ │ … 793 more rows · sticky header · frozen OBJECT column · NO pagination     │  │
│ STATE      │ └───────────────────────────────────────────────────────────────────────────┘  │
│ ▢ live 724 │  ✓ satisfied   + GAP (click to fill)   ⚠ degraded   ⛔ cruft   ≈ estimated count│
│ ▢ empty 88 │                                                                                 │
│ ▢ tiny 199 │  A vertical run of + is a hole you can see from two metres. That is the point.   │
│            │                                                                                 │
│ GAPS       │                                                                                 │
│ ▢ no owner │                                                                                 │
│ ▢ no join  │                                                                                 │
│ ▢ no code  │  ← the single most valuable filter in the UI: 305 objects, ~38% of the estate    │
│ ▢ stale90d │                                                                                 │
│            │                                                                                 │
│ OWNER APP  │                                                                                 │
│ ▢ CivicGr. │                                                                                 │
│ ▢ JustHub  │                                                                                 │
│ ▢ both     │                                                                                 │
│ ▢ neither  │                                                                                 │
└────────────┴─────────────────────────────────────────────────────────────────────────────────┘
```

**Components**

| Component | File | Client? | Notes |
|---|---|---|---|
| `<ClarityHeader>` | `page.tsx` inline | server | totals + scan time from `max(refreshed_at)` |
| `<CoverageBar>` ×6 | `components/coverage-bar.tsx` | server | CSS width %, no library. Clicking sets a searchParam |
| `<DomainTile>` ×16 | `components/domain-tile.tsx` | server | inline SVG sparkline, ~25 lines, no library |
| `<LedgerClient>` | `ledger-client.tsx` | **"use client"** | the ONE island. Owns facets, sort, lens, search. Filters in memory. |
| `<LedgerRow>` | inside the island | client | frozen first column, inline bar, glyph cells |

**Backing query** — one read, no joins to big tables:

```sql
SELECT relname, kind, row_count, row_count_exact, bytes, last_write_at, freshness_probe,
       domain, lifecycle, state, degree, importance,
       refs_civicgraph, refs_justicehub, refs_scripts, owner_app,
       purpose, caveat, verdict, verdict_reason,
       has_domain, has_purpose, has_owner, has_join, has_code, is_fresh,
       ops_health_slug, public_dataset_key
FROM v_clarity_ledger
ORDER BY importance DESC;
```

812 rows, ~18 columns → **≈300 KB JSON** inlined in the RSC payload. Shneiderman's <100 ms
dynamic-query goal is met client-side with no round trips **[R: research-dashboards §3.1]**.

**Loading state.** The Server Component `await`s one query. Add `loading.tsx` rendering the
header chrome plus 12 skeleton rows (1px borders, `bg-bauhaus-canvas` blocks). No spinner —
DESIGN.md forbids decorative motion.

**Empty state.** If `data_inventory` has zero rows (migration applied, refresh never run), render
a full-width black-bordered card:

> **THE INVENTORY HAS NEVER BEEN SCANNED.**
> Run `node --env-file=.env scripts/snapshot-data-inventory.mjs` or press REFRESH (fast scan,
> ~5 s, uses estimates). Nothing on this page is guessed — until the scan runs there is nothing
> to show.

That is the honest state, and it doubles as the fix affordance.

**Degraded state.** If `max(refreshed_at) < now() - 48h`, put a yellow 2px-bordered strip under
the header: `SCAN IS 3 DAYS OLD — the numbers below are from 11 Aug.` Never silently show stale
numbers as current.

**Drill-down targets.** Row click → `/clarity/[object]`. Domain tile → `/clarity/domain/[domain]`.
Coverage bar → same page with `?gap=owner`. `GAPS →` → `/clarity/gaps`. `EXTRACT ▾` → copy the
filtered set as CSV, as a SQL `IN` list, or open in `/clarity/map` pre-seeded.

---

### SCREEN 2 — `/clarity/gaps` · THE GAP BOARD

**Purpose.** Ben's ask (e), split honestly into two halves that the research says must not be
conflated: *our metadata is missing* (blue) versus *the data is wrong or unused* (red)
**[R: research-dashboards §4.5]**.
**Question it answers.** *"Where are the holes, and which one is worth fixing first?"*

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ CLARITY ▸ GAPS                                                          [ ← LEDGER ]         │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ PART 1 — WHAT WE DON'T KNOW ABOUT OUR OWN DATA                    (blue = our metadata gap)  │
│                                                                                              │
│  GAP CO-OCCURRENCE — do our blind spots cluster?     [missingno nullity-correlation, 6×6]    │
│           noOwner noJoin  noCode  stale  noFresh  empty                                      │
│  noOwner    ■      ▓       ▓       ░      ▒        ▒     ■ +0.8..1.0  ▓ +0.5  ▒ +0.2  ░ ~0   │
│  noJoin     ▓      ■       ▓       ▒      ▓        █                                          │
│  noCode     ▓      ▓       ■       ▓      ▒        ▓     A dark block = a whole abandoned    │
│  stale      ░      ▒       ▓       ■      ░        ░     region of the schema, surfaced as   │
│  noFresh    ▒      ▓       ▒       ░      ■        ▓     one shape rather than 300 rows.     │
│  empty      ▒      █       ▓       ░      ▓        ■                                          │
│                                                                                              │
│  BY DOMAIN — where the metadata thins out (bars, not a donut: length is rank-2 encoding)     │
│  platform/ops     ███████████████████░░░░░  76% complete   215 obj                            │
│  ai + pipeline    ████████████░░░░░░░░░░░░  51%             85 obj                            │
│  story + consent  ██████░░░░░░░░░░░░░░░░░░  26%  ⚠ lowest   49 obj                            │
│  …                                                                                            │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ PART 2 — OPPORTUNITY QUEUE                          (red = the data is broken or unreached)  │
│ Ranked by rows-at-stake ÷ effort. Every row carries the measurement that proves it.          │
│                                                                                              │
│ ┌────┬──────────────────────────────────────────────┬──────────┬─────┬────────────────────┐  │
│ │ ⬤  │ WHAT                                          │ AT STAKE │ EFF │ STATE              │  │
│ ├────┼──────────────────────────────────────────────┼──────────┼─────┼────────────────────┤  │
│ │ ⛔ │ 67K GrantConnect awards point at real ABNs    │  67,000  │  S  │ [ OPEN ] [ DOING ] │  │
│ │    │ absent from gs_entities                        │   rows   │     │                    │  │
│ │    │ evidence: recipient_abn 99.97% present in abr_registry (n=8,879) but only 76.4%      │  │
│ │    │ in gs_entities. Every sampled ABN was 11 chars — an ingestion gap, not formatting.    │  │
│ │    │ action: one bulk INSERT from abr_registry for the missing ABNs.                       │  │
│ ├────┼──────────────────────────────────────────────┼──────────┼─────┼────────────────────┤  │
│ │ ⛔ │ 3 board matviews return 4 / 2 / 1 rows         │  39,757  │  S  │ [ OPEN ]           │  │
│ │    │ mv_board_contractor_links · mv_board_donor_links · mv_multi_board_persons            │  │
│ │    │ evidence: mv_board_interlocks carries 39,757 with matching columns. Broken join.      │  │
│ ├────┼──────────────────────────────────────────────┼──────────┼─────┼────────────────────┤  │
│ │ ⛔ │ 2 disadvantage matviews refresh EMPTY nightly  │       —  │  S  │ [ OPEN ]           │  │
│ │    │ mv_funding_by_disadvantage 1 row (should be 10 deciles) · mv_indigenous… 0 rows       │  │
│ ├────┼──────────────────────────────────────────────┼──────────┼─────┼────────────────────┤  │
│ │ ▲  │ mv_charity_network — the director-links       │ 351,455  │  M  │ [ OPEN ]           │  │
│ │    │ surface you asked for, already built, read by nothing                                 │  │
│ ├────┼──────────────────────────────────────────────┼──────────┼─────┼────────────────────┤  │
│ │ ▲  │ procurement_alerts — 53,223 donor↔contractor  │  53,223  │  M  │ [ OPEN ]           │  │
│ │    │ crossover findings, outbox empty, never delivered anywhere                            │  │
│ ├────┼──────────────────────────────────────────────┼──────────┼─────┼────────────────────┤  │
│ │ ▲  │ qld_watchhouse_snapshot_rows unpublished      │   8,488  │  S  │ [ OPEN ]           │  │
│ │    │ 63 facilities, near-daily, First Nations + custody-duration. Nothing public in       │  │
│ │    │ Australia has this shape. AIHW is quarterly and state-level.                          │  │
│ ├────┼──────────────────────────────────────────────┼──────────┼─────┼────────────────────┤  │
│ │ ▲  │ foundation_category_assignments dark          │  42,599  │  M  │ [ OPEN ]           │  │
│ │ ▲  │ community_directory_orgs 9.8% linked          │  76,151  │  L  │ [ OPEN ]           │  │
│ │ ▲  │ 847 ORIC↔ABN duplicate pairs unresolved       │     847  │  M  │ [ OPEN ]           │  │
│ │ ⛔ │ ~30 matviews with no known refresh path        │  ~500K   │  M  │ [ OPEN ]           │  │
│ │ 🗑 │ 14 backup objects · delete after restore check│1,541,951 │  S  │ [ OPEN ]           │  │
│ └────┴──────────────────────────────────────────────┴──────────┴─────┴────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Backing.** `data_inventory_opportunity` (seeded from `lib/clarity/opportunities.ts`, which is
the typed source of truth — the table is the *state* store, the module is the *content*), plus
`v_clarity_ledger` aggregates for Part 1.

The co-occurrence matrix is computed server-side from six boolean columns over 812 rows — six
`corr()` calls or a 15-line JS pass. Inline SVG grid, no library.

**Empty state.** If no opportunities are open: *"Nothing on the queue. That is either very good
news or the queue has not been re-seeded since the last research pass — check
`lib/clarity/opportunities.ts`."*

**Drill-down.** Every opportunity's `relnames[]` renders as chips linking to `/clarity/[object]`.
Status buttons POST to `/api/clarity/opportunity/[key]`.

---

### SCREEN 3 — `/clarity/[object]` · THE OBJECT DOSSIER

**Purpose.** Ben's ask (c) level 1: what one object is, what it joins to, who reads it.
**Question.** *"What is `justice_funding`, exactly, and what can I do with it?"*

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◀ CLARITY   justice_funding                          [KEEP] [SUSPECT] [CRUFT]  ▸ open in SQL │
│ table · JUSTICE + YOUTH DETENTION · core_source · 157,116 rows · 390 MB · written 2 days ago  │
│ GRAIN one funding record: recipient × program × financial year                                │
│ PURPOSE Justice-sector funding to recipient organisations, federal + state + NIAA.             │
│ ⚠ CAVEAT Not purely justice funding. Rows carry source='austender-direct' and                 │
│   measure_kind='contract_value' (e.g. "Pump Repairs"). Filter on topics/source before          │
│   any total. 9,986 rows (6.4%) unlinked to gs_entities; 7,402 (4.7%) have no ABN.              │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ COLUMNS 34 ]  [ JOINS 7 ]  [ CODE 238 ]  [ HISTORY ]  [ SAMPLE ]                            │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ JOINS — measured, not assumed                                                                 │
│  → gs_entities.id      via gs_entity_id  uuid stamp   93.65%  full scan  2026-08-14           │
│  → gs_entities.abn     via recipient_abn abn text     95.3%   full scan                       │
│  → alma_interventions  via alma_intervention_id  FK   —       written by JusticeHub cron      │
│  ← gs_relationships    dataset='justice_funding'      ⚠⚠ 857,798 edges against 157,116 rows.  │
│     ~700,000 edges (82%) reference source records that no longer exist. Any dollar total       │
│     from the edge table is unreconcilable to this source. Verified 2026-08-14.                 │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ COLUMNS                                       nullity ▁▁█▁▁▁▁▂▁▁▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁     │
│  id                uuid      NOT NULL   PK                                                    │
│  recipient_name    text      NOT NULL   ████████████ 100%                                     │
│  recipient_abn     text      NULL       ███████████░  95%                                     │
│  gs_entity_id      uuid      NULL       ███████████░  94%  → gs_entities.id                   │
│  amount_dollars    numeric   NULL       ██████████░░  91%                                     │
│  … virtualise past 60 columns                                                                 │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ ROW COUNT OVER TIME                    ⚠ this table SHRANK 218,022 → 157,116 since April      │
│  250K ┤                                                                                       │
│  200K ┤ ●───●───●                                                                             │
│  150K ┤           ╲──●───●───●───●                                                            │
│       └─Apr──May──Jun──Jul──Aug────                                                           │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ CODE — 238 references                                                                         │
│  civicgraph  96 files   apps/web/src/lib/services/report-service.ts ×9   … [ see all ]        │
│  justicehub 142 files   src/app/api/cron/alma/data-sprint/route.ts  ×3   ⚠ DUAL-WRITE         │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ OPEN IN MAP → ]  [ /ops/health/justice-funding → ]  [ COPY SELECT ]  [ SET DOMAIN ▾ ]        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Backing queries.** One `v_clarity_ledger` row, one `data_inventory_edge` read both directions,
one `data_inventory_column` read, one `data_inventory_code_ref` read, one
`data_inventory_history` read (last 90 days). All small, all indexed. The **SAMPLE** tab is the
only live query and it is lazy — `/api/clarity/object/[name]?sample=1` runs
`SELECT * FROM <ident> LIMIT 5` with the identifier validated against `data_inventory.relname`
(**never string-interpolate an unvalidated name**), and does not run until the tab is opened.

**Loading.** Tabs render server-side; SAMPLE shows `[ LOAD 5 ROWS ]` as a button, not an
auto-fetch. That keeps the page one query and makes the cost of touching a 20M-row table explicit.

**Empty states.** No columns profiled → *"Columns not profiled yet. Matviews are invisible to
information_schema — this reads pg_attribute and runs on the nightly scan."* No code refs →
*"No reference found in either repo. This may be dark data, or it may be reached by a name built
at runtime, which the scanner cannot see."* That second sentence matters: the scan has a known
blind spot and the UI should say so rather than assert absence.

**Drill-down.** Join rows → the joined object's dossier. `OPEN IN MAP` → `/clarity/map?focus=<name>`.
Domain chip → `/clarity/domain/[domain]`. `/ops/health/<slug>` when set — that is where you browse
actual rows; do not rebuild a row browser here.

---

### SCREEN 4 — `/clarity/map` · THE JOIN MAP

**Purpose.** Ben's ask (b) and (c): the shape of the database as one picture.
**Question.** *"How many islands is this, and what makes it one graph?"*

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ CLARITY ▸ MAP                                       [ ← LEDGER ]   ⌕ find an object…          │
├──────────────────┬───────────────────────────────────────────────────────────────────────────┤
│ SHOW             │                                                                           │
│ ▣ declared FK    │              ┌──────────────┐            ● table   ◆ matview               │
│ ▣ uuid stamp     │      ╭────── │ gs_entities  │ ──────╮    size = log10(rows)               │
│ ▣ abn join       │      │  93%  │   609,448    │  99%  │    edge weight = measured match rate │
│ ▢ name join      │      ▼       └──────┬───────┘       ▼                                     │
│ ▢ postcode/LGA   │ ┌──────────┐        │ FK      ┌──────────────┐                            │
│                  │ │ justice_ │  ┌─────┴──────┐  │ organizations│ ← JusticeHub's hub          │
│ NODES            │ │ funding  │  │ gs_relat.  │  │   104,427    │   99.72% bridged            │
│ ▣ core_source    │ │ 157,116  │  │  3,429,184 │  └──────────────┘                            │
│ ▣ derived        │ └──────────┘  └────────────┘                                              │
│ ▢ app_operational│                                                                            │
│ ▢ backup (14)    │   ┌─── ISLANDS (no path to the spine) ────────────────────────────┐        │
│ ▢ empty (88)     │   │  ◇ NDIS district corpus  362,313 rows · service_district text  │        │
│                  │   │    ndis_participants_lga.lga_code is 100% NULL — the bridge    │        │
│ SIZE CAP         │   │    exists as a column and holds nothing                        │        │
│ ├──●────┤ 200    │   │  ◇ ACT CRM island  ~80,673 · entity_identifiers has ZERO ABNs  │        │
│ 50    600        │   │  ◇ money_flows 42,468 · free-text endpoints, no ids            │        │
│                  │   │  ◇ rogs_justice_spending 22,364 · states are COLUMNS not rows  │        │
│ ⚠ 812 nodes will │   └───────────────────────────────────────────────────────────────┘        │
│   hairball.      │                                                                            │
│   Showing top    │                                        [ RENDER FULL GRAPH — slow ]        │
│   200 by         │                                                                            │
│   importance.    │                                                                            │
├──────────────────┴───────────────────────────────────────────────────────────────────────────┤
│ SELECTED ▸ gs_relationships · 3,429,184 rows · 5.63 edges/entity                              │
│ ⚠ year values span 140–2999 · 6,497 grant_opportunities self-loops (97.6%) · ~700K justice   │
│   edges orphaned. Filter source<>target and year BETWEEN 1990 AND 2030 in every view.         │
│ [ dossier → ]  [ browse rows → ]  [ copy SELECT ]                                             │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Node budget: 200 by default, hard cap 600.** The literature puts node-link legibility at
30–150 on screen and says adjacency matrices beat node-link above ~20 nodes on most tasks
**[R: research-visualization §2.2]**. 200 domain-coloured, importance-ranked table nodes is a
constellation, not an analysis tool — and that is the honest job of this screen. **Render the
full 812 only behind an explicit button**, per dbt's "Render Lineage" pattern **[R]**.

**Backing.** `GET /api/clarity/inventory?graph=1` → `{nodes, edges}` from `data_inventory` +
`data_inventory_edge`. **Reuse and fix `/api/data/schema-graph`** rather than adding a second
endpoint — same URL, same contract, correct data.

**Server/client split — this is the CLAUDE.md trap.**

```tsx
// map/page.tsx — SERVER component. No next/dynamic here.
export default async function MapPage() {
  const { nodes, edges } = await getJoinGraph();     // direct DB read
  return <JoinMapClient nodes={nodes} edges={edges} />;
}

// map/join-map-client.tsx
'use client';
import dynamic from 'next/dynamic';                  // legal: we are in a client component
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });
```

**Loading.** `loading.tsx` renders the rail and the legend with an empty canvas and the caption
*"Laying out 200 nodes…"*. Force layout settles in <1 s at this size.

**Empty state.** If `data_inventory_edge` is empty: *"No joins recorded. Run the FK backfill in
migration 20260815000000 and seed the measured implicit joins from
`lib/clarity/seed-edges.ts`."*

**Drill-down.** Node click → selection footer. Double-click → `/clarity/[object]`.

---

### SCREEN 5 — `/clarity/domain/[domain]` · DOMAIN VIEW

Thin. Same `<LedgerClient>` pre-filtered, with a header carrying the domain's blurb, its total
rows, its object count, its worst gap, and a hand-written 2–3 sentence note on what this domain
is *for*. That note is the only prose a human must write in the whole build — 16 paragraphs, not
724 descriptions.

---

## 5. Visualization choices

| View | Library | Why |
|---|---|---|
| The ledger table | **none** — plain HTML `<table>` | Position along a common scale (column edge) + length (inline bar) are Cleveland-McGill's #1 and #2 encodings. A card grid breaks the baseline and costs 4–6× the height **[R]**. 812 rows in plain DOM is fine — no virtualisation. |
| Coverage bars ×6 | **none** — CSS width % | Bigeye's coverage score as a printable scalar plus a bar. A donut would be strictly worse. |
| Domain sparklines ×16 | **none** — inline SVG, ~25 lines | Identical frame across tiles is the whole point of small multiples **[R: Tufte]**. Recharts would drag a client bundle in for 16 decorative glyphs. |
| Coverage matrix glyphs | **none** — text glyphs in table cells | Monte Carlo's `+`-for-absence pattern **[R]**. A `+` is a character, not a chart. |
| Nullity co-occurrence | **none** — inline SVG 6×6 grid | missingno's correlation heatmap at 36 cells. |
| Row-count history | **none** — inline SVG polyline | ~90 points. Recharts is available but is not worth a client boundary here. |
| The join map | **`react-force-graph-2d` ^1.29.1** | **Already installed in grantscope AND JusticeHub** **[V]**. 200 nodes is deep inside its envelope (its own "large" example is ~75k). Already used by `/graph` and `entity/[gsId]/network-graph`. |

**New dependencies required for slices 1–6: ZERO.** That is a deliberate outcome, not luck — the
catalog is a table problem, and the one graph is small enough for the force-graph already in the
repo.

**Honest flags:**
- `nuqs` (typed URL search-param state) would make lens/facet state shareable and RSC-readable
  cleanly **[R: research-visualization §5.4]**. It is **not required** — `useSearchParams` +
  `router.replace`, the pattern JusticeHub's `/explore` already uses, is sufficient at this
  scale. Add it only if slice 6's saved views get painful. Do not add it in slice 1.
- `maplibre-gl` + `pmtiles` + `d3-sankey` are genuinely needed for the **maps and money-flow**
  half of Ben's ask (d) — the hex-tile per-capita map, the bivariate SEIFA×funding choropleth, the
  funder→place Sankey **[R: research-visualization §6.2]**. **None of them belongs in this build.**
  That is slice 7+, it is a different product surface (`/atlas`, `/places`), and it must not delay
  the catalog. Flagging it so nobody thinks it was forgotten.
- `react-force-graph-3d` is installed with **no import anywhere** **[R: verified]**. Remove it in
  slice 5 while you are touching package.json for nothing else.
- **No treemap. No sunburst. No circle packing.** Row counts span 7 orders of magnitude
  (20,006,350 → 1); a row-count treemap is one giant rectangle plus ~700 invisible slivers, and
  area is Cleveland-McGill rank 6 **[R]**.
- **No green.** It is not in the palette, and red/green fails colour-blind readers. The four
  Bauhaus colours carry exactly four meanings (§4.3 of the research, restated here):
  black = fine · **red `#D02020`** = the data is wrong (empty, backup, superseded, broken MV) ·
  **yellow `#F0C020`** = thin or stale · **blue `#1040C0`** = *our* metadata is missing (the `+`).
  Red and blue mean different problems with different fixes. Do not conflate them.

---

## 6. Performance plan

### 6.1 The rule

**No page in `/clarity` may query `gs_entities`, `gs_relationships`, `abr_registry`,
`austender_contracts`, `political_donations`, `asic_companies` or any object over 100K rows.**
Every number on every screen comes from `data_inventory*`, which totals well under 20K rows
across all five tables. This is non-negotiable: the pooler is shared with JusticeHub, Empathy
Ledger, Harvest and Contained, and it has starved before **[MEMORY.md: pooler saturation]**.

### 6.2 Budget per screen

| Screen | Queries | Rows read | Target TTFB |
|---|---|---|---|
| `/clarity` | 1 | 812 | <300 ms |
| `/clarity/gaps` | 2 (ledger aggregate + opportunities) | ~830 | <300 ms |
| `/clarity/[object]` | 5 small indexed reads | <400 | <250 ms |
| `/clarity/map` | 1 | 812 + ~900 edges | <400 ms |
| `/clarity/[object]?sample=1` | 1 lazy, on click | 5 | <2 s, explicitly user-triggered |

### 6.3 Server vs client

- **Server Components by default.** `page.tsx` for all five screens is a Server Component that
  `await`s its reads directly through `getDirectServiceSupabase()`.
- **Exactly two client islands in the whole build**: `<LedgerClient>` (facets/sort/lens/search
  over an in-memory 812-row array) and `<JoinMapClient>` (force-graph host). Everything else —
  header, coverage bars, domain tiles, dossier tabs, gap matrix, opportunity table — is server-rendered.
- **`next/dynamic` never appears in a Server Component.** It appears once, inside
  `join-map-client.tsx`, which is already `"use client"`.
- **`getDirectServiceSupabase()`, not `getServiceSupabase()`.** The latter sniffs the JS call
  stack for `/app/reports/` and returns a stub client that resolves every query to
  `{data:null,count:0}` **[V: `lib/supabase.ts`]**. `/clarity` is not under `/app/reports/` so it
  would be fine today — but use the direct getter so a future route move cannot silently blank the
  page. This exact failure mode is already recorded in memory.
- **Do not route these reads through `exec_sql`.** Use typed `.from('v_clarity_ledger').select()`.
  The 8s statement timeout and the read-only guard are both irrelevant to a 812-row table, and the
  typed path survives the guard changing.

### 6.4 Caching

`export const revalidate = 900` on `/clarity` and `/clarity/map` (15 min). The underlying data
changes once a night; 15 minutes keeps a manual `--fast` refresh visible without a redeploy.
`/clarity/[object]` stays `force-dynamic` — verdict writes must show immediately.

### 6.5 The nightly job

`refresh_data_inventory()` scans ~28M rows (804 exact counts; the 8 objects ≥2M use `reltuples`).
Estimate **60–150 s** [I — not benchmarked]. Run it serially, off-peak, on the same path as
`refresh-views-v2.mjs`. **Do not** put it behind a Vercel cron (`vercel.json` crons are HTTP
requests **[V]**). If the first real run exceeds 5 minutes, raise the exact-count threshold from
2M to 500K and accept `≈` on more rows — the `row_count_exact` flag means the UI stays honest
either way.

---

## 7. Build sequence — vertical tracer bullets

Each slice is independently shippable, each ends with something a human can look at, and none
depends on a later slice.

### SLICE 1 — THE LEDGER · **~2 days** · *this is the right first thing*

**Ships:** `/clarity` renders all 812 objects with real row counts, sizes, freshness, domain,
lifecycle, state, importance ranking, and working facets. Ben can answer "what do we have" the
day it lands.

1. Write + apply `20260815000000_clarity_data_inventory.sql` (§3.2 + §3.3 + FK backfill).
2. `node scripts/seed-clarity-domains.mjs` → `lib/clarity/seed-domains.ts` → apply the seed UPDATE.
3. Run `refresh_data_inventory()` once by hand. Sanity-check three known values against
   `census.csv`: `abr_registry` 20,006,350 · `political_donations` 2,549,483 · `data_catalog` 25.
   If `political_donations` reads 0 you have wired `n_live_tup` by mistake.
4. `lib/clarity/{types,domains,inventory,coverage}.ts`.
5. `app/clarity/{layout,page,ledger-client,loading}.tsx`.
6. `scripts/snapshot-data-inventory.mjs` + `agent_schedules` row.
7. `npx tsc --noEmit` && `npx vitest run` (CLAUDE.md Rule #3).

**Why first.** Nothing renders until the snapshot exists — every other slice reads this table.
And the risk that normally sinks a catalog (nobody writes 724 descriptions) is already retired:
the classification exists and parses **[V]**. Slice 1 is therefore the cheapest slice with the
highest payoff, which is exactly the definition of the right first thing.

### SLICE 2 — THE GAP BOARD · **~1.5 days**

Coverage matrix columns on the ledger (the `+` glyph) + `/clarity/gaps` with the co-occurrence
matrix and the seeded opportunity queue. `lib/clarity/opportunities.ts` written from the wave-1
research findings (the list in Screen 2 is the seed — every entry already has its evidence line).
**Ships:** Ben's ask (e), answered with sized, evidenced, actionable rows.

### SLICE 3 — THE OBJECT DOSSIER · **~2 days**

`/clarity/[object]` with columns (pg_attribute, matview-safe), joins, history sparkline, verdict
buttons, lazy sample. Extend `refresh_data_inventory()` to populate `data_inventory_column`
including `null_pct` for objects under 250K rows.
**Ships:** Ben's ask (c) level 1. This is where the caveats live, so this is where the surface
starts telling the truth about what each number does not contain.

### SLICE 4 — THE JOIN MAP · **~1.5 days**

Seed `data_inventory_edge` with the ~40 measured implicit joins from `join-spine.md` (uuid-stamp
rates, ABN match rates, place paths — all already measured with methods stated). Fix
`/api/data/schema-graph` (drop the TABLE_DOMAIN filter, drop `n_live_tup`). Build
`/clarity/map` + `<JoinMapClient>`.
**Ships:** Ben's ask (b) as a picture, with the four orphan islands visible as islands.

### SLICE 5 — CODE USAGE + CONSOLIDATION · **~1.5 days**

`scripts/scan-code-references.mjs` (both repos, raw-SQL pass included, generated-types excluded),
`owner_app` rollup, the `USED IN CODE` coverage bar and the `neither` facet go live. Then the
cleanup: delete `/architecture`; replace `/mission-control`'s Data Inventory section with a link;
generate `/ops/health`'s `connections` array from `data_inventory_edge`; drop
`react-force-graph-3d`; add a "superseded by /clarity" header to the three stale markdown
inventories.
**Ships:** the dark-data answer — which of the 812 objects nothing reads — plus one fewer lying
surface.

### SLICE 6 — LENSES + SAVED VIEWS · **~1 day**

One layout, eight colour encodings (rows · bytes · freshness · degree · code · gaps · owner ·
kind), URL-addressable, plus `EXTRACT ▾` (CSV / SQL IN-list / open in map). dbt's Lenses pattern:
eight views for the price of one **[R]**.

### SLICE 7+ — THE ANALYTICS HALF · **separate spec, do not scope here**

Ben's ask (d) — the best possible maps and analytics — is a different product surface with
different dependencies (`maplibre-gl`, `pmtiles`, `d3-sankey`, a static hex-tile asset, a nightly
Leiden `community_id`). Its build order is already researched **[R: research-visualization §6.5]**.
Its **first** item should be the proportional-symbol national map, because it needs no boundary
files and sidesteps MAUP entirely. Its prerequisites are slices 1–4 of this spec, because the
analytics half needs to know which objects are trustworthy before it draws anything from them.

**Total for slices 1–6: ~9.5 days.** [I — estimates, not measured.]

---

## 8. Guard rails an engineer must encode, not remember

Every one of these is a measured defect that will silently corrupt a view. Put them in
`lib/clarity/guards.ts` with a test each.

1. `pg_stat_user_tables.n_live_tup` is wrong here. Never read it. **[V]**
2. Matviews are absent from `information_schema.columns` (0 of 98). Read `pg_attribute`. **[V/R]**
3. `gs_relationships.year` spans 140–2999. Always `BETWEEN 1990 AND 2030`. **[R]**
4. `gs_relationships` self-loops: 6,497 in `grant_opportunities` (97.6% of that dataset), 612
   austender, 157 foundation_grantees, 132 aec_donations. Always
   `source_entity_id <> target_entity_id`. **[R]**
5. ~700,000 `gs_relationships` justice edges reference source records that no longer exist. Never
   publish a dollar total from `dataset='justice_funding'` without reconciling. **[R]**
6. `organizations` is ~5% duplicated. Filter `merged_into IS NULL` for counts. **[R]**
7. `upper(canonical_name)` without `trim()` misses the index — a measured 100× latency cliff. The
   index is `upper(trim(canonical_name))`. **[R]**
8. `entity_id` means two different universes: `entity_xref.entity_id → gs_entities.id` but
   `entity_identifiers.entity_id → canonical_entities.id`. A generic resolver crosses the streams
   silently. **[R]**
9. `gs_entity_id` is `uuid` in 17 objects and `text` in 1. Check the type before casting. **[R]**
10. `nz_charities` has a declared FK to `gs_entities` populated on **zero** of 45,192 rows. A
    declared FK is not evidence of a working join — which is exactly why `data_inventory_edge`
    carries `match_rate`. **[R]**
11. NULL `lga_code` on `gs_entities` is a deliberate refusal, not missing data. Check
    `lga_source`. **[MEMORY.md]**
12. Backup and staging objects are 5.4% of all rows. Default the ledger to hide `state IN
    ('backup','staging')` behind a facet that shows the count, so they are *hidden but declared* —
    never silently dropped. **[R]**

---

## 9. What this spec deliberately does not do

- **No new markdown inventory.** Three have been written; all three rotted within five months and
  nothing failed **[R]**. The registry is code with a CI guard, and the numbers are a table.
- **No public surface.** Admin-gated, `.ws` theme, not in nav. If it later earns a public face,
  that is `/giving/sources` widening — a different decision with a consent review.
- **No write-back into the analysed data.** `/clarity` writes only to `data_inventory*`. It never
  edits `gs_entities` or anything it catalogs.
- **No overlap with JusticeHub's data observatory.** That surface catalogs sources and pipelines;
  this one catalogs objects. Confirm the seam with Ben before either grows toward the other.
- **No maps.** Ask (d) is real and researched, and it is slice 7+.

---

## 10. Open questions for Ben — three, and none blocks slice 1

1. **Verdict authority.** Who can mark an object CRUFT? Right now the constraint enforces a
   written reason but any admin can write it. Fine for a two-person team; say so if not.
2. **The 14 backup objects (1,541,951 rows).** Slice 2 will surface them as a one-click
   opportunity. Deleting tracked data is Tier 3 and needs an explicit verb — the button should
   generate the `DROP` statements for a human to run, not run them.
3. **`/mission-control`'s Data Inventory section.** Slice 5 replaces it with a link. Confirm
   nothing else reads its 33-table array first.
