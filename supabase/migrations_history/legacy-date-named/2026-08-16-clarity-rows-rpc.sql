-- Slice 5: the row viewer's guarded RPC. The reader and the refusal ship together — this function
-- IS both. Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-16-clarity-rows-rpc.sql
--
-- Design (thoughts/shared/plans/clarity-console.md, slice 5):
--   * Enforced HERE, not in the UI — the UI is one query parameter away from being bypassed.
--   * Consent-governed objects refuse their rows with the reason, and instead return a per-flag
--     consent census: for every boolean consent_% column, how many rows said yes / no / nothing.
--     That reads the flags per row (the KNOWN LIMIT in visibility-floor.ts) without shipping a row.
--     There is no flag meaning "browsable by an operator", so browsing is refused wholesale.
--   * The withheld list below MUST match apps/web/src/app/clarity/visibility-floor.ts. This SQL
--     copy is the one that guards rows; the TS copy only renders card copy. If they drift, drift
--     resolves towards consent: add here first, TS second.
--   * Only objects present in clarity_object are reachable (catalogue as allowlist), only in
--     schema public, only row-bearing kinds. Identifiers go through format('%I'); the limit is
--     clamped to [1,50]. Vector columns are excluded from the payload (a 1536-float embedding is
--     not a row anyone reads).

BEGIN;

CREATE OR REPLACE FUNCTION clarity_rows(p_object_key text, p_limit int DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  obj record;
  n int;
  cols text;
  rows jsonb;
  census jsonb;
  flag record;
  yes bigint; no bigint; unrecorded bigint;
BEGIN
  n := least(greatest(coalesce(p_limit, 25), 1), 50);

  SELECT object_key, object_kind, domain, row_count
    INTO obj
    FROM clarity_object
   WHERE object_key = p_object_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not in the catalogue — the catalogue is the allowlist');
  END IF;

  IF obj.object_kind NOT IN ('table', 'matview', 'view') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', format('a %s has no rows to view', obj.object_kind));
  END IF;

  -- The consent refusal. Mirrors visibility-floor.ts (WITHHELD_DOMAIN + WITHHELD_OBJECTS).
  IF obj.domain = 'storytelling_consent'
     OR obj.object_key IN ('story_analysis', 'transcript_analysis', 'tour_stories', 'partner_storytellers_v')
  THEN
    -- Per-flag census over the real rows: every boolean consent_% column, counted three ways.
    -- NULL is "unrecorded", and unrecorded is not consent.
    census := '[]'::jsonb;
    FOR flag IN
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = p_object_key
         AND data_type = 'boolean'
         AND column_name LIKE 'consent\_%'
       ORDER BY ordinal_position
    LOOP
      EXECUTE format(
        'SELECT count(*) FILTER (WHERE %1$I IS TRUE),
                count(*) FILTER (WHERE %1$I IS FALSE),
                count(*) FILTER (WHERE %1$I IS NULL)
           FROM public.%2$I', flag.column_name, p_object_key)
        INTO yes, no, unrecorded;
      census := census || jsonb_build_object(
        'flag', flag.column_name, 'yes', yes, 'no', no, 'unrecorded', unrecorded);
    END LOOP;

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', CASE WHEN obj.domain = 'storytelling_consent'
                     THEN 'consent-governed: filed under storytelling_consent'
                     ELSE 'consent-governed: holds story content or identifies storytellers' END,
      'consent_census', census,
      'row_count', obj.row_count);
  END IF;

  -- The relation must really exist as a row-bearing thing in public. Catalogue rot must fail
  -- closed, not fall through to dynamic SQL against something else.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public' AND c.relname = p_object_key
       AND c.relkind IN ('r', 'p', 'v', 'm'))
  THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'catalogued but not found in the database — the catalogue may be stale');
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = p_object_key
     AND udt_name <> 'vector';

  IF cols IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no readable columns');
  END IF;

  EXECUTE format(
    'SELECT coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT %s FROM public.%I LIMIT %s) t',
    cols, p_object_key, n)
    INTO rows;

  RETURN jsonb_build_object('allowed', true, 'rows', rows, 'limit', n, 'row_count', obj.row_count);
END;
$$;

-- Operator surface only. The service key calls this; nothing browser-held may.
REVOKE ALL ON FUNCTION clarity_rows(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION clarity_rows(text, int) TO service_role;

COMMIT;
