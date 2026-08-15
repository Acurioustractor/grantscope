-- =====================================================================================
-- CivicGraph Clarity — catalog refresh (part 2 of 2)
--
-- NOT APPLIED. Apply with psql (gsql.mjs -c mangles $$ dollar-quoting):
--
--   cd /Users/benknight/Code/grantscope && source .env && \
--   PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000100_clarity_refresh_function.sql
--
-- Requires 20260815000000_clarity_catalog_schema.sql first.
--
-- ---------------------------------------------------------------------------
-- WHY THIS CANNOT RUN THROUGH THE APP — verified, not assumed, 2026-08-14:
--
--  1. apps/web/src/lib/supabase.ts:13 blocks rpc('exec'|'execute_sql'|'exec_agent_sql')
--     outright, and :117-124 admits rpc('exec_sql') only for SELECT/WITH.
--     NOTE: `SELECT clarity_refresh()` PASSES that guard. The guard is not the blocker.
--  2. The blocker is the timeout. Measured: anon statement_timeout = 3s,
--     authenticated = 8s, authenticator = 8s. exec_sql is granted only to
--     {postgres, service_role}, and PostgREST reaches service_role through
--     authenticator, so it inherits 8s. `SELECT pg_sleep(10)` through
--     scripts/gsql.mjs returns "canceling statement due to statement timeout".
--  3. A function cannot escape that. `WITH t AS (SELECT set_config(
--     'statement_timeout','0',true)) SELECT pg_sleep(11) FROM t` is STILL cancelled:
--     the timer is armed once, at statement start. A SET inside the statement is
--     too late. The `SET statement_timeout = 0` below is therefore correct for
--     pg_cron/psql invocation and useless as an escape hatch.
--  4. Measured full-sweep cost: 806 exact counts = 92.7s, 633 freshness probes
--     = 53.4s. ~2.5 min for the relation pass. Nowhere near 8s.
--
--  => Invoke from psql or pg_cron. Not from vercel.json crons (HTTP), not from
--     the RPC path. Same lane as refresh-views-v2.mjs.
--
-- ---------------------------------------------------------------------------
-- THE BUG IN BUILD-SPEC.md §3.3, PROVEN THIS SESSION:
--
--     BEGIN
--       SET LOCAL statement_timeout = '6s';
--       EXECUTE format('SELECT max(%I) FROM public.%I', ...) INTO v_last;
--     EXCEPTION WHEN query_canceled THEN v_probe := 'timeout';
--     END;
--
--  This guard is a NO-OP. Test run against this instance:
--     SET statement_timeout=0;
--     DO $t$ BEGIN
--       BEGIN SET LOCAL statement_timeout='1s'; PERFORM pg_sleep(4);
--             RAISE NOTICE 'not cancelled';
--       EXCEPTION WHEN query_canceled THEN RAISE NOTICE 'cancelled'; END;
--     END $t$;
--  -> NOTICE: not cancelled.   (elapsed 4.4s)
--
--  statement_timeout is armed by start_xact_command() at the top of the client
--  command. Changing the GUC inside a running statement does not re-arm the timer.
--  So a single max() over an unindexed column on a 20M-row table would hang the
--  whole nightly job with no protection at all.
--
--  FIX APPLIED HERE: bound the probe by COST, not by time.
--    probe max(col) only when the column has a leading btree index (index scan,
--    microseconds) OR the relation is under p_fresh_scan_max rows.
--    Everything else records 'deferred_too_large' and is picked up by the weekly
--    runner, which issues one statement per object and therefore CAN arm a timeout.
--  Measured effect: of 633 relations with a freshness column, exactly 2 exceeded
--  a 1.5s probe (abr_registry 20,006,350 rows; acnc_ais 360,488). Only 59 of the
--  633 have a leading index on the chosen column, so the size rule does the work.
-- =====================================================================================

-- ---------------------------------------------------------------------------
-- 1. clarity_refresh() — relations + routines. One round trip. ~2.5 minutes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_refresh(
  p_exact_count_max  bigint  DEFAULT 2000000,   -- exact count(*) below this reltuples
  p_fresh_scan_max   bigint  DEFAULT 2000000,   -- max() seq scan allowed below this
  p_write_history    boolean DEFAULT true
)
RETURNS TABLE (
  objects           integer,
  relations         integer,
  routines          integer,
  exact_counts      integer,
  estimated_counts  integer,
  freshness_ok      integer,
  freshness_deferred integer,
  elapsed_ms        integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
SET statement_timeout = 0          -- correct under pg_cron/psql; does NOT defeat a caller-armed timer
AS $fn$
DECLARE
  rec         record;
  t0          timestamptz := clock_timestamp();
  tprobe      timestamptz;
  n_rel       integer := 0;
  n_fn        integer := 0;
  n_exact     integer := 0;
  n_est       integer := 0;
  n_fresh_ok  integer := 0;
  n_fresh_def integer := 0;
  v_rows      bigint;
  v_est       boolean;
  v_probe     clarity_probe;
  v_ms        integer;
  v_fcol      text;
  v_findexed  boolean;
  v_last      timestamptz;
  v_fprobe    clarity_probe;
  v_fms       integer;
BEGIN
  -- ===================== A. RELATIONS: tables, matviews, views ==============
  FOR rec IN
    SELECT c.oid,
           c.relname,
           (CASE c.relkind WHEN 'r' THEN 'table' WHEN 'm' THEN 'matview' ELSE 'view' END)::clarity_object_kind AS kind,
           c.relkind,
           GREATEST(c.reltuples, 0)::bigint AS est_rows,
           pg_total_relation_size(c.oid)    AS bytes,
           c.relrowsecurity                 AS rls,
           (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS npol,
           (SELECT count(*) FROM pg_policy p
             WHERE p.polrelid = c.oid AND p.polpermissive AND p.polcmd IN ('r','*')
               AND coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') = 'true'
               AND (p.polroles = '{0}'::oid[]
                    OR EXISTS (SELECT 1 FROM unnest(p.polroles) rr
                                WHERE pg_get_userbyid(rr) = 'anon')))::int AS anon_open,
           has_table_privilege('anon', c.oid, 'SELECT')          AS anon_grant,
           has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_grant,
           (c.relkind = 'v' AND EXISTS (SELECT 1 FROM unnest(coalesce(c.reloptions,'{}'::text[]))
                                          o WHERE o = 'security_invoker=true')) AS sec_invoker
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','m','v')
    ORDER BY c.relname
  LOOP
    n_rel := n_rel + 1;

    ------------------------------------------------------------------ row count
    -- n_live_tup is BROKEN on this instance (political_donations -> 0 for
    -- 2,549,483 real rows). reltuples is the router; count(*) is the answer.
    v_ms := NULL;
    IF rec.relkind = 'v' THEN
      -- Views cannot be bounded from inside a function (see header). The runner
      -- counts them one statement at a time, where a timeout can actually fire.
      v_rows := NULL; v_est := false; v_probe := 'deferred_too_large';
    ELSIF rec.est_rows < p_exact_count_max THEN
      tprobe := clock_timestamp();
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I', rec.relname) INTO v_rows;
        v_est := false; v_probe := 'ok'; n_exact := n_exact + 1;
      EXCEPTION WHEN OTHERS THEN
        v_rows := rec.est_rows; v_est := true; v_probe := 'error'; n_est := n_est + 1;
      END;
      v_ms := (extract(epoch FROM clock_timestamp() - tprobe) * 1000)::int;
    ELSE
      -- Measured: all 6 relations >= 2M rows sit within 0.26% of exact.
      v_rows := rec.est_rows; v_est := true; v_probe := 'ok'; n_est := n_est + 1;
    END IF;

    ------------------------------------------------------------------ freshness
    v_fcol := NULL; v_last := NULL; v_fms := NULL; v_findexed := false;

    IF rec.relkind = 'm' THEN
      -- Only 1 of 98 matviews carries a timestamp column. mv_refresh_log is the
      -- only honest source, and it only knows 44 of them.
      SELECT max(l.started_at) INTO v_last
        FROM mv_refresh_log l
       WHERE l.mv_name = rec.relname AND l.status LIKE 'success%';
      v_fprobe := CASE WHEN v_last IS NULL THEN 'no_column' ELSE 'ok' END;
    ELSE
      -- pg_attribute, NOT information_schema: matviews are absent from the latter
      -- (verified: 0 of 98), and this branch also serves views.
      SELECT a.attname,
             EXISTS (SELECT 1 FROM pg_index x
                      WHERE x.indrelid = rec.oid AND x.indkey[0] = a.attnum)
        INTO v_fcol, v_findexed
        FROM pg_attribute a
        JOIN clarity_freshness_candidate f ON f.column_name = a.attname
       WHERE a.attrelid = rec.oid AND a.attnum > 0 AND NOT a.attisdropped
         AND format_type(a.atttypid, NULL) IN
             ('timestamp with time zone','timestamp without time zone','date')
       ORDER BY f.priority
       LIMIT 1;

      IF v_fcol IS NULL THEN
        v_fprobe := 'no_column';
      ELSIF rec.relkind = 'v' THEN
        v_fprobe := 'deferred_too_large';   -- runner's job, same reason as view counts
      ELSIF NOT v_findexed AND rec.est_rows > p_fresh_scan_max THEN
        v_fprobe := 'deferred_too_large';
        n_fresh_def := n_fresh_def + 1;
      ELSE
        tprobe := clock_timestamp();
        BEGIN
          EXECUTE format('SELECT max(%I)::timestamptz FROM public.%I', v_fcol, rec.relname)
            INTO v_last;
          v_fprobe := 'ok'; n_fresh_ok := n_fresh_ok + 1;
        EXCEPTION WHEN OTHERS THEN
          v_fprobe := 'error';
        END;
        v_fms := (extract(epoch FROM clock_timestamp() - tprobe) * 1000)::int;
      END IF;
    END IF;

    ------------------------------------------------------------------ upsert
    INSERT INTO clarity_object AS o (
      object_key, object_name, object_kind, oid,
      row_count, row_count_is_estimate, row_count_probe, row_count_ms, bytes,
      column_count, nullable_columns,
      freshness_column, freshness_source, last_write_at, freshness_probe, freshness_ms,
      rls_enabled, policy_count, anon_grant, anon_open_policies, anon_readable,
      authenticated_grant, security_invoker,
      refreshed_at, missing_since
    ) VALUES (
      rec.relname, rec.relname, rec.kind, rec.oid,
      v_rows, v_est, v_probe, v_ms, rec.bytes,
      (SELECT count(*) FROM pg_attribute a
        WHERE a.attrelid = rec.oid AND a.attnum > 0 AND NOT a.attisdropped),
      (SELECT count(*) FROM pg_attribute a
        WHERE a.attrelid = rec.oid AND a.attnum > 0 AND NOT a.attisdropped AND NOT a.attnotnull),
      v_fcol,
      CASE WHEN rec.relkind = 'm' THEN 'mv_refresh_log'
           WHEN v_fcol IS NOT NULL THEN 'column' ELSE 'none' END,
      v_last, v_fprobe, v_fms,
      rec.rls, rec.npol, rec.anon_grant, rec.anon_open,
      (rec.anon_grant AND (NOT rec.rls OR rec.anon_open > 0)),
      rec.auth_grant,
      CASE WHEN rec.relkind = 'v' THEN rec.sec_invoker ELSE NULL END,
      now(), NULL
    )
    ON CONFLICT (object_key) DO UPDATE SET
      object_kind = EXCLUDED.object_kind,
      oid = EXCLUDED.oid,
      -- a deferred probe must not wipe a value the runner filled in
      row_count = CASE WHEN EXCLUDED.row_count_probe = 'deferred_too_large'
                       THEN o.row_count ELSE EXCLUDED.row_count END,
      row_count_is_estimate = CASE WHEN EXCLUDED.row_count_probe = 'deferred_too_large'
                       THEN o.row_count_is_estimate ELSE EXCLUDED.row_count_is_estimate END,
      row_count_probe = EXCLUDED.row_count_probe,
      row_count_ms = EXCLUDED.row_count_ms,
      bytes = EXCLUDED.bytes,
      column_count = EXCLUDED.column_count,
      nullable_columns = EXCLUDED.nullable_columns,
      freshness_column = EXCLUDED.freshness_column,
      freshness_source = EXCLUDED.freshness_source,
      last_write_at = CASE WHEN EXCLUDED.freshness_probe = 'deferred_too_large'
                       THEN o.last_write_at ELSE EXCLUDED.last_write_at END,
      freshness_probe = EXCLUDED.freshness_probe,
      freshness_ms = EXCLUDED.freshness_ms,
      rls_enabled = EXCLUDED.rls_enabled,
      policy_count = EXCLUDED.policy_count,
      anon_grant = EXCLUDED.anon_grant,
      anon_open_policies = EXCLUDED.anon_open_policies,
      anon_readable = EXCLUDED.anon_readable,
      authenticated_grant = EXCLUDED.authenticated_grant,
      security_invoker = EXCLUDED.security_invoker,
      refreshed_at = now(),
      missing_since = NULL;
  END LOOP;

  -- ===================== B. ROUTINES: the 409 nobody inventoried ============
  FOR rec IN
    SELECT p.oid,
           p.proname,
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS key,
           l.lanname,
           p.prosecdef,
           p.provolatile,
           pg_get_function_result(p.oid) AS rettype,
           length(coalesce(p.prosrc,'')) AS srclen,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
           (SELECT count(*) FROM pg_trigger t
             WHERE t.tgfoid = p.oid AND NOT t.tgisinternal)::int AS trg
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language  l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  LOOP
    n_fn := n_fn + 1;
    INSERT INTO clarity_object AS o (
      object_key, object_name, object_kind, oid,
      row_count_probe, freshness_probe, lifecycle,
      routine_language, routine_kind, routine_returns, routine_volatility,
      routine_src_bytes, trigger_attachments,
      security_definer, anon_execute, authenticated_grant,
      refreshed_at, missing_since
    ) VALUES (
      rec.key, rec.proname, 'function', rec.oid,
      'not_applicable', 'not_applicable', 'routine',
      rec.lanname,
      CASE WHEN rec.rettype = 'trigger' THEN 'trigger'
           WHEN rec.prosecdef THEN 'security_definer' ELSE 'plain' END,
      rec.rettype, rec.provolatile, rec.srclen, rec.trg,
      rec.prosecdef, rec.anon_exec, rec.auth_exec,
      now(), NULL
    )
    ON CONFLICT (object_key) DO UPDATE SET
      oid = EXCLUDED.oid,
      routine_language = EXCLUDED.routine_language,
      routine_kind = EXCLUDED.routine_kind,
      routine_returns = EXCLUDED.routine_returns,
      routine_volatility = EXCLUDED.routine_volatility,
      routine_src_bytes = EXCLUDED.routine_src_bytes,
      trigger_attachments = EXCLUDED.trigger_attachments,
      security_definer = EXCLUDED.security_definer,
      anon_execute = EXCLUDED.anon_execute,
      authenticated_grant = EXCLUDED.authenticated_grant,
      refreshed_at = now(),
      missing_since = NULL;
  END LOOP;

  -- ===================== C. COLUMNS (pg_attribute, covers matviews) =========
  DELETE FROM clarity_column c
   WHERE NOT EXISTS (SELECT 1 FROM pg_class pc JOIN pg_namespace pn ON pn.oid = pc.relnamespace
                      WHERE pn.nspname='public' AND pc.relname = c.object_key);

  INSERT INTO clarity_column (object_key, ordinal, column_name, data_type, is_nullable,
                              is_pk, is_indexed, is_vector, vector_dim)
  SELECT c.relname, a.attnum, a.attname,
         format_type(a.atttypid, a.atttypmod),
         NOT a.attnotnull,
         EXISTS (SELECT 1 FROM pg_index x WHERE x.indrelid=c.oid AND x.indisprimary
                                            AND a.attnum = ANY(x.indkey::int2[])),
         EXISTS (SELECT 1 FROM pg_index x WHERE x.indrelid=c.oid
                                            AND a.attnum = ANY(x.indkey::int2[])),
         (t.typname = 'vector'),
         CASE WHEN t.typname = 'vector' THEN a.atttypmod END
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  JOIN pg_type t      ON t.oid = a.atttypid
  WHERE n.nspname='public' AND c.relkind IN ('r','m','v')
    AND a.attnum > 0 AND NOT a.attisdropped
  ON CONFLICT (object_key, ordinal) DO UPDATE SET
    column_name = EXCLUDED.column_name,
    data_type   = EXCLUDED.data_type,
    is_nullable = EXCLUDED.is_nullable,
    is_pk       = EXCLUDED.is_pk,
    is_indexed  = EXCLUDED.is_indexed,
    is_vector   = EXCLUDED.is_vector,
    vector_dim  = EXCLUDED.vector_dim;

  -- ===================== D. EDGES: declared FKs + view lineage ==============
  INSERT INTO clarity_edge (src_object, src_column, tgt_object, tgt_column,
                            mechanism, declared, note)
  SELECT DISTINCT cl1.relname, att1.attname, cl2.relname, att2.attname,
                  'fk', true, con.conname
  FROM pg_constraint con
  JOIN pg_class cl1      ON con.conrelid  = cl1.oid
  JOIN pg_class cl2      ON con.confrelid = cl2.oid
  JOIN pg_attribute att1 ON att1.attrelid = cl1.oid AND att1.attnum = ANY(con.conkey)
  JOIN pg_attribute att2 ON att2.attrelid = cl2.oid AND att2.attnum = ANY(con.confkey)
  JOIN pg_namespace ns   ON cl1.relnamespace = ns.oid
  WHERE con.contype = 'f' AND ns.nspname = 'public'
  ON CONFLICT DO NOTHING;

  -- pg_depend/pg_rewrite: which views and matviews read which base relations.
  -- 695 edges today. This is the lineage the FK graph cannot see.
  INSERT INTO clarity_edge (src_object, src_column, tgt_object, tgt_column,
                            mechanism, declared)
  SELECT DISTINCT dep.relname, NULL, base.relname, NULL, 'view_lineage', true
  FROM pg_depend d
  JOIN pg_rewrite rw     ON rw.oid = d.objid
  JOIN pg_class dep      ON dep.oid = rw.ev_class
  JOIN pg_class base     ON base.oid = d.refobjid
  JOIN pg_namespace nd   ON nd.oid = dep.relnamespace
  JOIN pg_namespace nb   ON nb.oid = base.relnamespace
  WHERE d.classid = 'pg_rewrite'::regclass AND d.refclassid = 'pg_class'::regclass
    AND nd.nspname='public' AND nb.nspname='public'
    AND dep.oid <> base.oid
    AND dep.relkind IN ('v','m') AND base.relkind IN ('r','m','v')
  ON CONFLICT DO NOTHING;

  -- ===================== E. DEGREES =========================================
  UPDATE clarity_object o SET
    fk_out      = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.src_object=o.object_key AND e.mechanism='fk'),0),
    fk_in       = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.tgt_object=o.object_key AND e.mechanism='fk'),0),
    lineage_out = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.src_object=o.object_key AND e.mechanism='view_lineage'),0),
    lineage_in  = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.tgt_object=o.object_key AND e.mechanism='view_lineage'),0),
    join_out    = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.src_object=o.object_key AND e.mechanism NOT IN ('fk','view_lineage')),0),
    join_in     = coalesce((SELECT count(*) FROM clarity_edge e
                             WHERE e.tgt_object=o.object_key AND e.mechanism NOT IN ('fk','view_lineage')),0)
  WHERE o.object_kind <> 'function';

  -- ===================== F. DB-FUNCTION REFERENCES ==========================
  -- The scan the 2026-08-14 pass never ran: 386,420 characters of pg_proc.prosrc.
  -- 202 relations are referenced ONLY here. Treating them as dark is how 19 live
  -- objects reached a DROP list.
  DELETE FROM clarity_code_ref WHERE ref_class = 'db_function';
  INSERT INTO clarity_code_ref (object_key, ref_class, repo, file_path, hits)
  SELECT r.object_key, 'db_function', 'database', f.key, count(*)::int
  FROM (SELECT object_key, object_name FROM clarity_object WHERE object_kind <> 'function') r
  JOIN (SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS key,
               coalesce(p.prosrc,'') AS src
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public') f
    -- strpos() first: it is a plain substring search and it prunes the 1,024 x 410
    -- pair space before the regex runs. Measured on this instance: regex alone
    -- 103.8s, strpos + regex 3.6s, identical result (586 pairs, 209 relations).
    ON strpos(f.src, r.object_name) > 0
   AND f.src ~ ('(^|[^a-zA-Z0-9_])' || r.object_name || '([^a-zA-Z0-9_]|$)')
  GROUP BY 1,4
  ON CONFLICT DO NOTHING;

  -- triggers: 219 of them on 178 tables, invisible to every FK-based lineage model
  DELETE FROM clarity_code_ref WHERE ref_class = 'trigger';
  INSERT INTO clarity_code_ref (object_key, ref_class, repo, file_path, hits)
  SELECT c.relname, 'trigger', 'database',
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', 1
  FROM pg_trigger t
  JOIN pg_class c     ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p      ON p.oid = t.tgfoid
  WHERE n.nspname='public' AND NOT t.tgisinternal
  ON CONFLICT DO NOTHING;

  UPDATE clarity_object o SET
    refs_db_function = coalesce((SELECT count(*) FROM clarity_code_ref r
                                  WHERE r.object_key=o.object_key
                                    AND r.ref_class IN ('db_function','trigger')),0);

  -- ===================== G. ACT PRIVATE-BUSINESS FLAG (Ben, decision 1) =====
  -- The cluster leaves this database. Until it does, it is flagged so no civic
  -- surface shows it and the /clarity default filter hides it.
  UPDATE clarity_object SET
    act_business = true,
    act_business_source = coalesce(act_business_source, 'name_rule')
  WHERE object_kind <> 'function'
    AND act_business_source IS DISTINCT FROM 'manual'
    AND object_name ~ '^(act_|xero_|ghl_|notion_|receipt|finance_|bank_|email_|gmail_|imessage_|telegram_|memory_|calendar_|communications_|sprint|team_members|project_salary|saas_|goods_|ce_users|ce_metrics)';

  -- A regular view is a saved question, not stored data. Label it once so the
  -- ranking's lifecycle weight has something to read; the shards never classified
  -- any of the 212.
  UPDATE clarity_object SET lifecycle = 'lens'
   WHERE object_kind = 'view' AND lifecycle IS NULL;

  -- ===================== H. STATE ===========================================
  UPDATE clarity_object SET state = CASE
    WHEN object_kind = 'function'                                        THEN 'routine'
    WHEN object_name ~ '_backup(_|$)' OR object_name ~ '^_backup'
         OR object_name ~ '_bak$' OR lifecycle = 'backup'                THEN 'backup'
    WHEN lifecycle = 'superseded'                                        THEN 'superseded'
    WHEN lifecycle = 'staging' OR object_name ~ '^stg_'
         OR object_name ~ '^dedup_' OR object_name ~ '_20[0-9]{6}[a-z]?$' THEN 'staging'
    WHEN row_count IS NULL                                               THEN 'unknown'
    WHEN row_count = 0                                                   THEN 'empty'
    WHEN row_count < 10                                                  THEN 'tiny'
    ELSE 'live' END;

  -- ===================== I. IMPORTANCE ======================================
  PERFORM clarity_score();

  -- ===================== J. HISTORY + single-writer catalog snapshot ========
  IF p_write_history THEN
    INSERT INTO clarity_object_history
      (object_key, object_kind, row_count, row_count_is_estimate, bytes,
       last_write_at, degree, importance)
    SELECT object_key, object_kind, row_count, row_count_is_estimate, bytes,
           last_write_at, degree, importance
    FROM clarity_object WHERE missing_since IS NULL;

    -- data_catalog_snapshots keeps its 25-table provenance series; this makes
    -- clarity_refresh() its only writer so the two cannot disagree.
    INSERT INTO data_catalog_snapshots (table_name, row_count, freshness_hours, notes)
    SELECT dc.table_name, o.row_count,
           CASE WHEN o.last_write_at IS NULL THEN NULL
                ELSE round(extract(epoch FROM now() - o.last_write_at)/3600.0, 2) END,
           'clarity_refresh'
    FROM data_catalog dc
    JOIN clarity_object o ON o.object_key = dc.table_name;
  END IF;

  -- ===================== K. RETIRE, do not delete ===========================
  UPDATE clarity_object o SET missing_since = coalesce(o.missing_since, now())
   WHERE (o.object_kind = 'function'
          AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                           WHERE n.nspname='public'
                             AND p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = o.object_key))
      OR (o.object_kind <> 'function'
          AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                           WHERE n.nspname='public' AND c.relkind IN ('r','m','v')
                             AND c.relname = o.object_key));

  RETURN QUERY SELECT n_rel + n_fn, n_rel, n_fn, n_exact, n_est, n_fresh_ok, n_fresh_def,
                      (extract(epoch FROM clock_timestamp() - t0) * 1000)::int;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. clarity_score() — the ranking. Split out so weights can be retuned without
--    re-running the 2.5-minute sweep. Weights justified in clarity-data-layer.md.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_score(
  w_size     numeric DEFAULT 0.20,
  w_bytes    numeric DEFAULT 0.10,
  w_degree   numeric DEFAULT 0.26,
  w_app      numeric DEFAULT 0.18,
  w_pipe     numeric DEFAULT 0.12,
  w_recency  numeric DEFAULT 0.14,
  w_unknown_recency numeric DEFAULT 0.30,
  w_act      numeric DEFAULT 0.50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $fn$
DECLARE
  max_rows  bigint;
  max_bytes bigint;
  n integer;
BEGIN
  SELECT GREATEST(max(row_count), 2), GREATEST(max(bytes), 2)
    INTO max_rows, max_bytes FROM clarity_object WHERE object_kind <> 'function';

  UPDATE clarity_object o SET importance = ROUND((
      -- how much of the estate it is
      w_size  * LEAST(1.0, ln(GREATEST(coalesce(o.row_count,0),1))::numeric / ln(max_rows::numeric))
    + w_bytes * LEAST(1.0, ln(GREATEST(o.bytes,1)+1)::numeric      / ln(max_bytes::numeric + 1))
      -- how central it is
    + w_degree * LEAST(1.0, ln(1 + o.degree)::numeric              / ln(41::numeric))
      -- whether a product surface reads it (distinct FILES, not hits)
    + w_app   * LEAST(1.0, ln(1 + o.refs_app)::numeric             / ln(26::numeric))
      -- whether a pipeline, DB function or downstream view depends on it
    + w_pipe  * LEAST(1.0, ln(1 + o.refs_script + o.refs_db_function + o.lineage_in)::numeric
                                                                   / ln(26::numeric))
      -- whether it is current
    + w_recency * CASE
        WHEN o.last_write_at IS NULL                            THEN w_unknown_recency
        WHEN o.last_write_at > now() - interval '7 days'         THEN 1.00
        WHEN o.last_write_at > now() - interval '30 days'        THEN 0.70
        WHEN o.last_write_at > now() - interval '180 days'       THEN 0.40
        WHEN o.last_write_at > now() - interval '730 days'       THEN 0.20
        ELSE 0.05 END
  )
  -- state penalty: a backup is not important because it is big
  * CASE o.state WHEN 'backup' THEN 0.05 WHEN 'staging' THEN 0.10
                 WHEN 'superseded' THEN 0.15 WHEN 'empty' THEN 0.25
                 WHEN 'tiny' THEN 0.60 ELSE 1.00 END
  -- lifecycle: this is a catalogue of DATA, not of application tables
  * CASE o.lifecycle
      WHEN 'core_source' THEN 1.00 WHEN 'derived' THEN 0.95 WHEN 'crosswalk' THEN 0.95
      WHEN 'app_operational' THEN 0.60 WHEN 'staging' THEN 0.25 WHEN 'backup' THEN 0.10
      WHEN 'superseded' THEN 0.20 WHEN 'scaffold_empty' THEN 0.30
      WHEN 'lens' THEN 0.85 WHEN 'routine' THEN 0.50 ELSE 0.80 END
  -- Ben's decision 1: ACT private business is not civic data
  * CASE WHEN o.act_business THEN w_act ELSE 1.00 END
  , 4)
  WHERE o.missing_since IS NULL;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. clarity_set_probe() — write-back for the runner, which owns the two probes
--    that a single function call cannot bound (view counts, oversized max()).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_set_probe(
  p_object_key text,
  p_kind       text,                -- 'row_count' | 'freshness'
  p_probe      clarity_probe,
  p_rows       bigint DEFAULT NULL,
  p_last_write timestamptz DEFAULT NULL,
  p_ms         integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $fn$
BEGIN
  IF p_kind = 'row_count' THEN
    UPDATE clarity_object
       SET row_count = COALESCE(p_rows, row_count),
           row_count_is_estimate = false,
           row_count_probe = p_probe,
           row_count_ms = p_ms
     WHERE object_key = p_object_key;
  ELSIF p_kind = 'freshness' THEN
    UPDATE clarity_object
       SET last_write_at = COALESCE(p_last_write, last_write_at),
           freshness_probe = p_probe,
           freshness_ms = p_ms
     WHERE object_key = p_object_key;
  ELSE
    RAISE EXCEPTION 'clarity_set_probe: unknown kind %', p_kind;
  END IF;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. clarity_measure_gaps() — runs the registered gap metrics and records them.
--    Each metric's SQL lives in clarity_gap_metric, so the number on the screen
--    and the number in the spec are the same number by construction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_measure_gaps(p_cost_class text DEFAULT NULL)
RETURNS TABLE (metric_key text, value numeric, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_catalog
SET statement_timeout = 0
AS $fn$
DECLARE
  m record; num bigint; den bigint; v numeric; t0 timestamptz; st text; err text;
BEGIN
  FOR m IN SELECT * FROM clarity_gap_metric
            WHERE enabled AND (p_cost_class IS NULL OR cost_class = p_cost_class)
            ORDER BY metric_key
  LOOP
    t0 := clock_timestamp(); num := NULL; den := NULL; v := NULL; st := 'ok'; err := NULL;
    BEGIN
      EXECUTE m.numerator_sql INTO num;
      IF m.denominator_sql IS NOT NULL THEN
        EXECUTE m.denominator_sql INTO den;
        v := CASE WHEN coalesce(den,0) = 0 THEN NULL
                  ELSE round(100.0 * num::numeric / den::numeric, 4) END;
      ELSE
        v := num::numeric;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      st := 'error'; err := SQLERRM;
    END;
    INSERT INTO clarity_gap_measurement
      (metric_key, numerator, denominator, value, duration_ms, status, error_text)
    VALUES (m.metric_key, num, den, v,
            (extract(epoch FROM clock_timestamp()-t0)*1000)::int, st, err);
    metric_key := m.metric_key; value := v; status := st;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION clarity_refresh(bigint,bigint,boolean)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION clarity_score(numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric)
                                                                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION clarity_set_probe(text,text,clarity_probe,bigint,timestamptz,integer)
                                                                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION clarity_measure_gaps(text)               FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION clarity_refresh(bigint,bigint,boolean)   TO service_role;
GRANT  EXECUTE ON FUNCTION clarity_score(numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric)
                                                                    TO service_role;
GRANT  EXECUTE ON FUNCTION clarity_set_probe(text,text,clarity_probe,bigint,timestamptz,integer)
                                                                    TO service_role;
GRANT  EXECUTE ON FUNCTION clarity_measure_gaps(text)               TO service_role;
-- Deliberate contrast: 340 of 410 existing functions are EXECUTE-able by `anon`,
-- three of them SECURITY DEFINER rebuild_* routines. These four are not.
