-- =====================================================================================
-- CivicGraph Clarity — catalog schema (part 1 of 2: DDL)
--
-- NOT APPLIED. Apply with psql (gsql.mjs -c mangles $$ dollar-quoting):
--
--   cd /Users/benknight/Code/grantscope && source .env && \
--   PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000000_clarity_catalog_schema.sql
--
-- WHAT THIS CATALOGUES (measured 2026-08-14, direct psql):
--   714 tables + 98 materialized views + 212 regular views = 1,024 relations
--   410 pg_proc rows (409 distinct names) = the RPC / trigger surface
--   -------------------------------------------------------------------
--   1,433 objects.  BUILD-SPEC.md seeded 812.  That is the whole point of this file.
--
-- FACTS THIS SCHEMA IS BUILT AROUND (each verified this session, not assumed):
--   * pg_stat_user_tables.n_live_tup is BROKEN here: political_donations -> 0
--     (actual 2,549,483), data_catalog -> 0 (actual 25), gs_entities -> 558,781
--     (actual 609,448). Never read it.
--   * pg_class.reltuples is TRUSTWORTHY at the top: all 6 objects >= 2M rows are
--     within 0.26% of exact. It is wrong only on truncated staging tables
--     (stg_ratio_winners: reltuples 15,353, actual 0) -> hence is_estimate.
--   * information_schema.columns does not cover materialized views (0 of 98).
--     Column introspection MUST read pg_attribute.
--   * Only 1 of 98 materialized views carries a timestamp column. Matview freshness
--     cannot come from a column probe; it comes from mv_refresh_log.
--   * 451 of 1,024 relations are readable by the `anon` role once RLS is resolved.
--     Exposure is a first-class catalog column, not a footnote.
-- =====================================================================================

BEGIN;

-- ------------------------------------------------------------------ enums
DO $enum$ BEGIN
  CREATE TYPE clarity_object_kind AS ENUM ('table','matview','view','function');
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

DO $enum$ BEGIN
  CREATE TYPE clarity_lifecycle AS ENUM (
    'core_source',      -- ingested from a named external source
    'derived',          -- computed from other objects (most matviews)
    'crosswalk',        -- identifier resolution between universes
    'app_operational',  -- powers a product surface / workflow state
    'staging',          -- transient, feeding a migration or dedup lane
    'backup',           -- dated point-in-time snapshot, restorable, not live
    'superseded',       -- replaced by a newer object that still coexists
    'scaffold_empty',   -- declared but never populated
    'lens',             -- a regular view: a saved question, not stored data
    'routine'           -- a function/procedure
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

DO $enum$ BEGIN
  CREATE TYPE clarity_probe AS ENUM ('ok','no_column','deferred_too_large','timeout','error','not_applicable');
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

DO $enum$ BEGIN
  CREATE TYPE clarity_verdict AS ENUM ('keep','suspect','cruft');
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

DO $enum$ BEGIN
  CREATE TYPE clarity_ref_class AS ENUM ('app','script','migration','db_function','view_lineage','trigger');
EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

-- ------------------------------------------------------------------ the ledger
-- One row per object in the WHOLE public schema: relation OR routine.
-- object_key is stable: relname for relations, 'proname(identity args)' for routines,
-- so the 1 overloaded name in pg_proc does not collide.
CREATE TABLE IF NOT EXISTS clarity_object (
  object_key          text PRIMARY KEY,
  object_name         text NOT NULL,
  object_kind         clarity_object_kind NOT NULL,
  oid                 oid,                       -- current oid; changes on rebuild, do not key on it

  -- ---- size. Exact below the threshold, reltuples above, always flagged.
  row_count           bigint,
  row_count_is_estimate boolean NOT NULL DEFAULT false,
  row_count_probe     clarity_probe NOT NULL DEFAULT 'not_applicable',
  row_count_ms        integer,
  bytes               bigint NOT NULL DEFAULT 0,  -- pg_total_relation_size; 0 for views/functions
  column_count        integer,
  nullable_columns    integer,

  -- ---- structure
  fk_out              integer NOT NULL DEFAULT 0,   -- declared FKs this object owns
  fk_in               integer NOT NULL DEFAULT 0,   -- declared FKs pointing at it
  lineage_out         integer NOT NULL DEFAULT 0,   -- base relations this view/matview reads
  lineage_in          integer NOT NULL DEFAULT 0,   -- views/matviews built on top of it
  join_out            integer NOT NULL DEFAULT 0,   -- curated implicit joins (clarity_edge)
  join_in             integer NOT NULL DEFAULT 0,
  degree              integer GENERATED ALWAYS AS
                        (fk_out + fk_in + lineage_out + lineage_in + join_out + join_in) STORED,

  -- ---- freshness
  freshness_column    text,          -- auto-picked from clarity_freshness_candidate
  freshness_source    text CHECK (freshness_source IN
                        ('column','mv_refresh_log','cron','none')) DEFAULT 'none',
  last_write_at       timestamptz,
  freshness_probe     clarity_probe NOT NULL DEFAULT 'no_column',
  freshness_ms        integer,

  -- ---- routines only (null for relations)
  routine_language    text,
  routine_kind        text CHECK (routine_kind IN ('trigger','security_definer','plain')),
  routine_returns     text,
  routine_volatility  char(1),
  routine_src_bytes   integer,
  trigger_attachments integer NOT NULL DEFAULT 0,   -- how many triggers actually use it

  -- ---- exposure / governance. Measured, not asserted.
  rls_enabled         boolean NOT NULL DEFAULT false,
  policy_count        integer NOT NULL DEFAULT 0,
  anon_grant          boolean NOT NULL DEFAULT false,
  anon_open_policies  integer NOT NULL DEFAULT 0,
  anon_readable       boolean NOT NULL DEFAULT false,   -- grant AND (rls off OR an open SELECT policy)
  authenticated_grant boolean NOT NULL DEFAULT false,
  security_invoker    boolean,                          -- views: false => runs with owner rights
  security_definer    boolean,                          -- functions
  anon_execute        boolean,                          -- functions

  -- ---- classification. Seeded from the 2026-08-14 inventory shards, then editable.
  domain              text,
  lifecycle           clarity_lifecycle,
  grain               text,
  purpose             text,
  caveat              text,
  join_keys           text,

  -- ---- Ben's decision 1: the ACT private-business cluster leaves this database.
  -- Flagged, not deleted, and the flag records WHY so it stays auditable.
  act_business        boolean NOT NULL DEFAULT false,
  act_business_source text CHECK (act_business_source IN ('canonical_d14','name_rule','manual')),

  -- ---- usage. File-level counts. Raw hit counts are useless: justice_funding
  -- scores 3,293 hits inside ONE bulk-INSERT ingest .sql file.
  refs_app            integer NOT NULL DEFAULT 0,   -- distinct files under apps/web/src or JusticeHub/src
  refs_script         integer NOT NULL DEFAULT 0,
  refs_migration      integer NOT NULL DEFAULT 0,
  refs_db_function    integer NOT NULL DEFAULT 0,   -- pg_proc.prosrc mentions -- NEVER scanned before
  owner_app           text CHECK (owner_app IN ('civicgraph','justicehub','both','neither'))
                        NOT NULL DEFAULT 'neither',

  -- ---- derived state + rank
  state               text,           -- live | tiny | empty | staging | backup | superseded
  importance          numeric(8,4) NOT NULL DEFAULT 0,

  -- ---- human, optional. A 'cruft' call needs a written reason or it becomes noise.
  verdict             clarity_verdict,
  verdict_reason      text,
  verdict_by          text,
  verdict_at          timestamptz,

  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  refreshed_at        timestamptz NOT NULL DEFAULT now(),
  missing_since       timestamptz,    -- set, not deleted, when the object disappears

  CONSTRAINT clarity_object_cruft_needs_reason
    CHECK (verdict IS DISTINCT FROM 'cruft'
           OR (verdict_reason IS NOT NULL AND btrim(verdict_reason) <> '')),
  -- A drop verdict is illegal while anything still reads it. This is the rule the
  -- 2026-08-14 pass broke: 19 objects were marked DROP while live code wrote to them.
  CONSTRAINT clarity_object_no_cruft_while_referenced
    CHECK (verdict IS DISTINCT FROM 'cruft'
           OR (refs_app = 0 AND refs_script = 0 AND refs_db_function = 0 AND lineage_in = 0))
);

CREATE INDEX IF NOT EXISTS idx_clarity_object_kind       ON clarity_object(object_kind);
CREATE INDEX IF NOT EXISTS idx_clarity_object_domain     ON clarity_object(domain);
CREATE INDEX IF NOT EXISTS idx_clarity_object_lifecycle  ON clarity_object(lifecycle);
CREATE INDEX IF NOT EXISTS idx_clarity_object_importance ON clarity_object(importance DESC);
CREATE INDEX IF NOT EXISTS idx_clarity_object_state      ON clarity_object(state);
CREATE INDEX IF NOT EXISTS idx_clarity_object_act        ON clarity_object(act_business) WHERE act_business;
CREATE INDEX IF NOT EXISTS idx_clarity_object_name_trgm  ON clarity_object USING gin (object_name extensions.gin_trgm_ops);

-- ------------------------------------------------------------------ freshness candidates
-- Editable priority list. Lives in a table so adding a column name is a one-row
-- insert, not a function redeploy.
CREATE TABLE IF NOT EXISTS clarity_freshness_candidate (
  column_name text PRIMARY KEY,
  priority    integer NOT NULL,
  note        text
);
INSERT INTO clarity_freshness_candidate (column_name, priority) VALUES
  ('updated_at',1),('created_at',2),('snapshot_at',3),('scraped_at',4),('last_seen',5),
  ('fetched_at',6),('inserted_at',7),('ingested_at',8),('synced_at',9),('imported_at',10),
  ('recorded_at',11),('collected_at',12),('published_at',13),('extracted_at',14),
  ('processed_at',15),('started_at',16),('run_at',17),('captured_at',18),('crawled_at',19),
  ('harvested_at',20),('observed_at',21),('last_updated',22),('event_time',23),
  ('occurred_at',24),('last_refreshed',25),('refreshed_at',26)
ON CONFLICT (column_name) DO NOTHING;

-- ------------------------------------------------------------------ columns
-- Reads pg_attribute, so materialized views are covered. information_schema.columns
-- returns nothing for all 98 of them.
CREATE TABLE IF NOT EXISTS clarity_column (
  object_key   text NOT NULL REFERENCES clarity_object(object_key) ON DELETE CASCADE,
  ordinal      integer NOT NULL,
  column_name  text NOT NULL,
  data_type    text NOT NULL,
  is_nullable  boolean NOT NULL,
  is_pk        boolean NOT NULL DEFAULT false,
  is_indexed   boolean NOT NULL DEFAULT false,
  is_vector    boolean NOT NULL DEFAULT false,
  vector_dim   integer,
  null_pct     numeric(6,2),      -- null until profiled
  distinct_est numeric,           -- pg_stats.n_distinct, null when unavailable
  profiled_at  timestamptz,
  PRIMARY KEY (object_key, ordinal)
);
CREATE INDEX IF NOT EXISTS idx_clarity_column_name ON clarity_column(column_name);
CREATE INDEX IF NOT EXISTS idx_clarity_column_vec  ON clarity_column(object_key) WHERE is_vector;

-- ------------------------------------------------------------------ the join graph
-- Declared FKs are NOT the spine here: the largest objects carry none, and the top
-- FK target is a 17-row users table. So this holds THREE mechanisms:
--   fk            - a real pg_constraint
--   view_lineage  - pg_depend: this view/matview reads that base (695 edges today)
--   <the rest>    - curated implicit joins, each with a MEASURED match rate
CREATE TABLE IF NOT EXISTS clarity_edge (
  id                bigserial PRIMARY KEY,
  src_object        text NOT NULL,
  src_column        text,
  tgt_object        text NOT NULL,
  tgt_column        text,
  mechanism         text NOT NULL CHECK (mechanism IN
                      ('fk','view_lineage','uuid_stamp','abn','acn','name','postcode',
                       'lga','icn','gs_id','other')),
  declared          boolean NOT NULL DEFAULT false,
  -- Absence is a measurement. match_rate 0.000 on a declared-looking key is the
  -- single most useful cell in this whole catalog.
  match_rate        numeric(6,3),
  match_numerator   bigint,
  match_denominator bigint,
  match_method      text,            -- 'full scan' | 'LIMIT n=50000' | 'TABLESAMPLE ...'
  match_measured_at timestamptz,
  note              text,
  -- NULLS NOT DISTINCT (PG15+, this instance is 17.6) is REQUIRED: view_lineage rows
  -- carry NULL columns, and under default UNIQUE semantics NULLs never conflict, so
  -- every nightly refresh would re-insert all 695 lineage edges.
  UNIQUE NULLS NOT DISTINCT (src_object, src_column, tgt_object, tgt_column, mechanism)
);
CREATE INDEX IF NOT EXISTS idx_clarity_edge_src ON clarity_edge(src_object);
CREATE INDEX IF NOT EXISTS idx_clarity_edge_tgt ON clarity_edge(tgt_object);
CREATE INDEX IF NOT EXISTS idx_clarity_edge_broken ON clarity_edge(match_rate)
  WHERE match_rate IS NOT NULL AND match_rate < 0.5;

-- ------------------------------------------------------------------ code references
-- File-level, classified. 'migration' is deliberately its own class: a table whose
-- only reference is the DDL that created it is NOT in use, and conflating the two
-- is exactly how 19 live tables ended up on a DROP list.
CREATE TABLE IF NOT EXISTS clarity_code_ref (
  id         bigserial PRIMARY KEY,
  object_key text NOT NULL,
  ref_class  clarity_ref_class NOT NULL,
  repo       text NOT NULL CHECK (repo IN ('civicgraph','justicehub','database')),
  file_path  text NOT NULL,        -- for db_function refs: the function's object_key
  hits       integer NOT NULL DEFAULT 1,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_key, ref_class, repo, file_path)
);
CREATE INDEX IF NOT EXISTS idx_clarity_code_ref_obj ON clarity_code_ref(object_key);

-- ------------------------------------------------------------------ history
-- Catches the failure nobody caught: justice_funding moved 218,022 -> 157,116 with
-- no alarm. A shrinking table is a signal.
-- Reconciliation: data_catalog_snapshots (1,419 rows, 25 tables, and columns
-- freshness_hours / provenance_coverage_pct / confidence_coverage_pct that a generic
-- sweep cannot compute) STAYS. clarity_object_history is the wide, whole-schema
-- series. clarity_refresh() writes both so there is exactly one writer.
CREATE TABLE IF NOT EXISTS clarity_object_history (
  id            bigserial PRIMARY KEY,
  snapshot_at   timestamptz NOT NULL DEFAULT now(),
  object_key    text NOT NULL,
  object_kind   clarity_object_kind NOT NULL,
  row_count     bigint,
  row_count_is_estimate boolean,
  bytes         bigint,
  last_write_at timestamptz,
  degree        integer,
  importance    numeric(8,4)
);
CREATE INDEX IF NOT EXISTS idx_clarity_hist_obj_time ON clarity_object_history(object_key, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_clarity_hist_time     ON clarity_object_history(snapshot_at DESC);

-- ------------------------------------------------------------------ gap metrics
-- Absence, made executable. Each row carries the SQL that measures it, so the
-- number on the screen and the number in the doc cannot drift.
CREATE TABLE IF NOT EXISTS clarity_gap_metric (
  metric_key    text PRIMARY KEY,
  title         text NOT NULL,
  family        text NOT NULL CHECK (family IN
                  ('coverage','freshness','schedule','usage','join_integrity',
                   'attribution','place','evidence','exposure','definition','countability')),
  question      text NOT NULL,          -- the plain-words question this answers
  numerator_sql text NOT NULL,          -- must return exactly one bigint
  denominator_sql text,                 -- null => the metric is an absolute count
  unit          text NOT NULL DEFAULT 'pct' CHECK (unit IN ('pct','count','rows','bytes')),
  direction     text NOT NULL DEFAULT 'higher_better'
                  CHECK (direction IN ('higher_better','lower_better')),
  target        numeric,                -- the number we are trying to reach
  cost_class    text NOT NULL DEFAULT 'cheap' CHECK (cost_class IN ('cheap','medium','expensive')),
  enabled       boolean NOT NULL DEFAULT true,
  note          text
);

CREATE TABLE IF NOT EXISTS clarity_gap_measurement (
  id           bigserial PRIMARY KEY,
  metric_key   text NOT NULL REFERENCES clarity_gap_metric(metric_key) ON DELETE CASCADE,
  measured_at  timestamptz NOT NULL DEFAULT now(),
  numerator    bigint,
  denominator  bigint,
  value        numeric(12,4),
  duration_ms  integer,
  status       text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','timeout','error')),
  error_text   text
);
CREATE INDEX IF NOT EXISTS idx_clarity_gap_meas ON clarity_gap_measurement(metric_key, measured_at DESC);

-- ------------------------------------------------------------------ metric definitions
-- The answer to "why is this number different on the other page".
-- Today's live instance: justice_funding_clean (a view, 151,866 rows,
-- sector <> 'procurement') vs OPPORTUNITY-MAP's mandatory measure_kind='grant'
-- (126,673 rows). Both are in use. Nothing reconciled them.
CREATE TABLE IF NOT EXISTS clarity_metric_definition (
  definition_key text PRIMARY KEY,
  concept        text NOT NULL,          -- e.g. 'justice funding, cleaned'
  expression     text NOT NULL,          -- the filter/aggregate, verbatim
  source_object  text NOT NULL,
  row_count      bigint,
  measured_at    timestamptz,
  is_canonical   boolean NOT NULL DEFAULT false,
  used_by        text[] NOT NULL DEFAULT '{}',
  rationale      text
);
-- Exactly one canonical definition per concept, enforced.
CREATE UNIQUE INDEX IF NOT EXISTS uq_clarity_metric_canonical
  ON clarity_metric_definition(concept) WHERE is_canonical;

-- ------------------------------------------------------------------ read view
-- Granted to both apps' service roles so JusticeHub can read the catalog of a
-- database it co-owns (411 migrations vs GrantScope's 273).
CREATE OR REPLACE VIEW v_clarity_ledger
WITH (security_invoker = true) AS
SELECT
  o.*,
  dc.owner_team,
  dc.pii_level,
  dc.sla_hours,
  dc.licence,
  dc.public_export,
  dc.public_caveat,
  dc.source_url,
  dc.description                                        AS catalog_description,
  (dc.table_name IS NOT NULL)                           AS catalog_linked,
  (o.domain IS NOT NULL)                                AS has_domain,
  (o.purpose IS NOT NULL AND btrim(o.purpose) <> '')    AS has_purpose,
  (dc.owner_team IS NOT NULL)                           AS has_owner,
  (o.degree > 0)                                        AS has_join,
  (o.refs_app + o.refs_script + o.refs_db_function > 0) AS has_use,
  (o.last_write_at IS NOT NULL
     AND o.last_write_at > now() - interval '30 days')  AS is_fresh,
  (o.anon_readable AND coalesce(dc.pii_level,'') IN ('high','medium')) AS exposure_conflict
FROM clarity_object o
LEFT JOIN data_catalog dc ON dc.table_name = o.object_name;

-- service_role only, and the view is security_invoker so it cannot become one of the
-- 99 anon-readable definer-rights views this catalog exists to count. JusticeHub reads
-- it with its own service key, the same way it reads everything else in this database.
GRANT SELECT ON v_clarity_ledger TO service_role;
GRANT SELECT ON clarity_object, clarity_column, clarity_edge, clarity_code_ref,
                clarity_object_history, clarity_gap_metric, clarity_gap_measurement,
                clarity_metric_definition, clarity_freshness_candidate TO service_role;

ALTER TABLE clarity_object            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_column            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_edge              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_code_ref          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_object_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_gap_metric        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_gap_measurement   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_metric_definition ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only. RLS-on-zero-policy is deliberate here, and it is
-- the same shape as the 215 tables already in that state — the difference is that
-- this one is written down.

COMMIT;
