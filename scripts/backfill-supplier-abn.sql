-- Backfill supplier_abn on austender_contracts
-- Strategy: 6 passes with progressive normalization
-- Run via: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f scripts/backfill-supplier-abn.sql
--
-- Pass 1: Self-join (same supplier_name exists elsewhere with ABN)
-- Pass 2: ABR normalized (expand P/L -> PTY LIMITED, LTD -> LIMITED)
-- Pass 3: ABR deep-normalized (strip all suffixes + parentheticals)
-- Pass 4: gs_entities deep-normalized
-- Pass 5a: ABR + &amp; decode + abbreviation expansion
-- Pass 5b: ABR + &amp; decode + deep normalization
-- Pass 6: Aggressive normalization (strip all periods, &amp;, T/A, suffixes)
--
-- Results (2026-03-27):
--   Before: 76,055 missing (9.61%)
--   After:  54,491 missing (6.89%)
--   Resolved: 21,564 rows across ~5,100 distinct supplier names
--   Remaining: mostly international suppliers, junk placeholders, and ambiguous names

-- Increase statement timeout for this session (large joins)
SET statement_timeout = '300s';

-- Record starting state
DO $$
DECLARE
  v_missing BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_missing FROM austender_contracts WHERE supplier_abn IS NULL OR supplier_abn = '';
  RAISE NOTICE '[BEFORE] Missing supplier_abn: %', v_missing;
END $$;

---------------------------------------------------------------
-- PASS 1: Self-join — same supplier_name exists with an ABN elsewhere
-- Use the most-frequent ABN per UPPER(TRIM(supplier_name)) to handle duplicates
---------------------------------------------------------------

DO $$
DECLARE
  v_count BIGINT;
BEGIN
  RAISE NOTICE '[PASS 1] Self-join: matching supplier_name against rows with ABN...';

  -- Create temp lookup: for each normalized supplier name, pick the ABN
  -- that appears most often (resolves ambiguity)
  CREATE TEMP TABLE _pass1_lookup AS
  WITH ranked AS (
    SELECT
      UPPER(TRIM(supplier_name)) AS uname,
      supplier_abn,
      COUNT(*) AS cnt,
      ROW_NUMBER() OVER (
        PARTITION BY UPPER(TRIM(supplier_name))
        ORDER BY COUNT(*) DESC
      ) AS rn
    FROM austender_contracts
    WHERE supplier_abn IS NOT NULL AND supplier_abn != ''
      AND supplier_name IS NOT NULL AND supplier_name != ''
    GROUP BY UPPER(TRIM(supplier_name)), supplier_abn
  )
  SELECT uname, supplier_abn
  FROM ranked
  WHERE rn = 1;

  CREATE INDEX ON _pass1_lookup (uname);

  UPDATE austender_contracts ac
  SET supplier_abn = lk.supplier_abn,
      updated_at = NOW()
  FROM _pass1_lookup lk
  WHERE UPPER(TRIM(ac.supplier_name)) = lk.uname
    AND (ac.supplier_abn IS NULL OR ac.supplier_abn = '');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[PASS 1] Updated % rows via self-join', v_count;

  DROP TABLE _pass1_lookup;
END $$;

---------------------------------------------------------------
-- PASS 2: ABR match with name normalization
-- Expand abbreviations in supplier_name to match ABR's full-form names
-- ABR uses: PTY LIMITED, PTY LTD, LIMITED (never P/L or LTD alone at end)
---------------------------------------------------------------

DO $$
DECLARE
  v_count BIGINT;
BEGIN
  RAISE NOTICE '[PASS 2] ABR match: normalizing names and matching against abr_registry...';

  -- Build a temp table of distinct unresolved supplier names,
  -- normalized to match ABR naming conventions
  CREATE TEMP TABLE _pass2_candidates AS
  SELECT DISTINCT
    UPPER(TRIM(supplier_name)) AS original_uname,
    -- Normalize: expand P/L -> PTY LIMITED, PTY LTD -> PTY LIMITED, LTD -> LIMITED
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              UPPER(TRIM(supplier_name)),
              ' P/L$',                  ' PTY LIMITED'),
            ' P/L ',                    ' PTY LIMITED '),
          ' PTY LTD$',                  ' PTY LIMITED'),
        ' PTY LTD ',                    ' PTY LIMITED '),
      ' LTD$',                          ' LIMITED'
    )) AS normalized_name
  FROM austender_contracts
  WHERE (supplier_abn IS NULL OR supplier_abn = '')
    AND supplier_name IS NOT NULL AND supplier_name != ''
    AND LENGTH(TRIM(supplier_name)) >= 4
    AND UPPER(TRIM(supplier_name)) NOT IN ('AUD', 'FMS ACCOUNT', 'SEE MORE INFO SECTION BELOW')
    AND UPPER(TRIM(supplier_name)) NOT LIKE '%CONFIDENTIAL%'
    AND UPPER(TRIM(supplier_name)) NOT LIKE '%DMOJSF%';

  CREATE INDEX ON _pass2_candidates (normalized_name);

  -- Match against ABR: for each candidate, find active ABR entry with exact match
  -- on normalized name. Skip if multiple ABNs match (ambiguous).
  CREATE TEMP TABLE _pass2_lookup AS
  WITH abr_matches AS (
    SELECT
      c.original_uname,
      a.abn,
      ROW_NUMBER() OVER (PARTITION BY c.original_uname ORDER BY a.abn) AS rn,
      COUNT(*) OVER (PARTITION BY c.original_uname) AS match_count
    FROM _pass2_candidates c
    JOIN abr_registry a
      ON UPPER(a.entity_name) = c.normalized_name
      AND a.status = 'Active'
  )
  SELECT original_uname, abn
  FROM abr_matches
  WHERE rn = 1 AND match_count = 1;  -- Only unambiguous matches

  CREATE INDEX ON _pass2_lookup (original_uname);

  RAISE NOTICE '[PASS 2] Found % unambiguous ABR matches', (SELECT COUNT(*) FROM _pass2_lookup);

  UPDATE austender_contracts ac
  SET supplier_abn = lk.abn,
      updated_at = NOW()
  FROM _pass2_lookup lk
  WHERE UPPER(TRIM(ac.supplier_name)) = lk.original_uname
    AND (ac.supplier_abn IS NULL OR ac.supplier_abn = '');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[PASS 2] Updated % rows via ABR normalized match', v_count;

  DROP TABLE _pass2_candidates;
  DROP TABLE _pass2_lookup;
END $$;

---------------------------------------------------------------
-- PASS 3: ABR match with deeper normalization
-- Strip ALL suffixes (PTY, LTD, LIMITED, P/L, INC, CORP, etc.)
-- and parenthesized content, then match against similarly stripped ABR names
-- Only for remaining unresolved records
---------------------------------------------------------------

DO $$
DECLARE
  v_count BIGINT;
BEGIN
  RAISE NOTICE '[PASS 3] ABR deep-normalized match (strip all suffixes)...';

  -- Deep normalization: strip all corporate suffixes and parenthetical content
  CREATE TEMP TABLE _pass3_candidates AS
  SELECT DISTINCT
    UPPER(TRIM(supplier_name)) AS original_uname,
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    REGEXP_REPLACE(
                      REGEXP_REPLACE(
                        UPPER(TRIM(supplier_name)),
                        '\s*\([^)]*\)\s*', ' ', 'g'),  -- strip (AUSTRALIA) etc.
                      ' T/A .*$', ''),                   -- strip T/A trading-as
                    ' DBA .*$', ''),                      -- strip DBA doing-business-as
                  ' - [A-Z].*$', ''),                     -- strip " - KENT" location suffixes
                '\s+PTY\s+', ' ', 'g'),
              '\s+LTD\.?\s*$', ''),
            '\s+LIMITED\s*$', ''),
          '\s+INC\.?\s*$', ''),
        '\s+P/L\s*$', ''),
      '\s+', ' ', 'g')
    ) AS stripped_name
  FROM austender_contracts
  WHERE (supplier_abn IS NULL OR supplier_abn = '')
    AND supplier_name IS NOT NULL AND supplier_name != ''
    AND LENGTH(TRIM(supplier_name)) >= 6
    AND UPPER(TRIM(supplier_name)) NOT IN ('AUD', 'FMS ACCOUNT', 'SEE MORE INFO SECTION BELOW')
    AND UPPER(TRIM(supplier_name)) NOT LIKE '%CONFIDENTIAL%'
    AND UPPER(TRIM(supplier_name)) NOT LIKE '%DMOJSF%';

  -- Remove candidates whose stripped name is too short (likely junk)
  DELETE FROM _pass3_candidates WHERE LENGTH(stripped_name) < 5;

  CREATE INDEX ON _pass3_candidates (stripped_name);

  RAISE NOTICE '[PASS 3] % candidates after stripping', (SELECT COUNT(*) FROM _pass3_candidates);

  -- Similarly strip ABR names and match
  -- Only match where there's EXACTLY one ABN for that stripped name in ABR
  CREATE TEMP TABLE _pass3_lookup AS
  WITH abr_stripped AS (
    SELECT
      abn,
      TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  UPPER(entity_name),
                  '\s*\([^)]*\)\s*', ' ', 'g'),
                '\s+PTY\s+', ' ', 'g'),
              '\s+LTD\.?\s*$', ''),
            '\s+LIMITED\s*$', ''),
          '\s+INC\.?\s*$', ''),
        '\s+', ' ', 'g')
      ) AS stripped_name
    FROM abr_registry
    WHERE status = 'Active'
      AND entity_name IS NOT NULL
      AND LENGTH(entity_name) >= 5
  ),
  unique_abr AS (
    SELECT stripped_name, MIN(abn) AS abn
    FROM abr_stripped
    GROUP BY stripped_name
    HAVING COUNT(DISTINCT abn) = 1
  )
  SELECT c.original_uname, u.abn
  FROM _pass3_candidates c
  JOIN unique_abr u ON c.stripped_name = u.stripped_name;

  CREATE INDEX ON _pass3_lookup (original_uname);

  RAISE NOTICE '[PASS 3] Found % deep-normalized ABR matches', (SELECT COUNT(*) FROM _pass3_lookup);

  UPDATE austender_contracts ac
  SET supplier_abn = lk.abn,
      updated_at = NOW()
  FROM _pass3_lookup lk
  WHERE UPPER(TRIM(ac.supplier_name)) = lk.original_uname
    AND (ac.supplier_abn IS NULL OR ac.supplier_abn = '');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[PASS 3] Updated % rows via ABR deep-normalized match', v_count;

  DROP TABLE _pass3_candidates;
  DROP TABLE _pass3_lookup;
END $$;

---------------------------------------------------------------
-- PASS 4: gs_entities normalized match
-- For remaining unresolved, match against gs_entities.canonical_name
-- using the same normalization approach
---------------------------------------------------------------

DO $$
DECLARE
  v_count BIGINT;
BEGIN
  RAISE NOTICE '[PASS 4] gs_entities normalized match...';

  CREATE TEMP TABLE _pass4_candidates AS
  SELECT DISTINCT
    UPPER(TRIM(supplier_name)) AS original_uname,
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    UPPER(TRIM(supplier_name)),
                    '\s*\([^)]*\)\s*', ' ', 'g'),
                  ' T/A .*$', ''),
                ' - [A-Z].*$', ''),
              '\s+PTY\s+', ' ', 'g'),
            '\s+LTD\.?\s*$', ''),
          '\s+LIMITED\s*$', ''),
        '\s+P/L\s*$', ''),
      '\s+', ' ', 'g')
    ) AS stripped_name
  FROM austender_contracts
  WHERE (supplier_abn IS NULL OR supplier_abn = '')
    AND supplier_name IS NOT NULL AND supplier_name != ''
    AND LENGTH(TRIM(supplier_name)) >= 6;

  DELETE FROM _pass4_candidates WHERE LENGTH(stripped_name) < 5;
  CREATE INDEX ON _pass4_candidates (stripped_name);

  CREATE TEMP TABLE _pass4_lookup AS
  WITH gs_stripped AS (
    SELECT
      abn,
      TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  UPPER(canonical_name),
                  '\s*\([^)]*\)\s*', ' ', 'g'),
                '\s+PTY\s+', ' ', 'g'),
              '\s+LTD\.?\s*$', ''),
            '\s+LIMITED\s*$', ''),
          '\s+INC\.?\s*$', ''),
        '\s+', ' ', 'g')
      ) AS stripped_name
    FROM gs_entities
    WHERE abn IS NOT NULL AND abn != ''
      AND canonical_name IS NOT NULL
      AND LENGTH(canonical_name) >= 5
  ),
  unique_gs AS (
    SELECT stripped_name, MIN(abn) AS abn
    FROM gs_stripped
    GROUP BY stripped_name
    HAVING COUNT(DISTINCT abn) = 1
  )
  SELECT c.original_uname, u.abn
  FROM _pass4_candidates c
  JOIN unique_gs u ON c.stripped_name = u.stripped_name;

  CREATE INDEX ON _pass4_lookup (original_uname);

  RAISE NOTICE '[PASS 4] Found % gs_entities matches', (SELECT COUNT(*) FROM _pass4_lookup);

  UPDATE austender_contracts ac
  SET supplier_abn = lk.abn,
      updated_at = NOW()
  FROM _pass4_lookup lk
  WHERE UPPER(TRIM(ac.supplier_name)) = lk.original_uname
    AND (ac.supplier_abn IS NULL OR ac.supplier_abn = '');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[PASS 4] Updated % rows via gs_entities normalized match', v_count;

  DROP TABLE _pass4_candidates;
  DROP TABLE _pass4_lookup;
END $$;

---------------------------------------------------------------
-- PASS 5: ABR match with &amp; -> & decoding
-- ABR bulk data has ~713K records with HTML-encoded ampersands
-- Strategy A: light normalization (expand abbreviations) + &amp; decode
-- Strategy B: deep normalization (strip suffixes) + &amp; decode
---------------------------------------------------------------

DO $$
DECLARE
  v_count BIGINT;
BEGIN
  RAISE NOTICE '[PASS 5a] ABR match with &amp; decoding + abbreviation expansion...';

  CREATE TEMP TABLE _pass5a_candidates AS
  SELECT DISTINCT
    UPPER(TRIM(supplier_name)) AS original_uname,
    -- Expand abbreviations AND convert & to &amp; to match ABR
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REPLACE(UPPER(TRIM(supplier_name)), '&', '&AMP;'),
              ' P/L$',                  ' PTY LIMITED'),
            ' P/L ',                    ' PTY LIMITED '),
          ' PTY LTD$',                  ' PTY LIMITED'),
        ' PTY LTD ',                    ' PTY LIMITED '),
      ' LTD$',                          ' LIMITED'
    )) AS amp_normalized
  FROM austender_contracts
  WHERE (supplier_abn IS NULL OR supplier_abn = '')
    AND supplier_name IS NOT NULL AND supplier_name != ''
    AND supplier_name LIKE '%&%'
    AND LENGTH(TRIM(supplier_name)) >= 4;

  CREATE INDEX ON _pass5a_candidates (amp_normalized);

  CREATE TEMP TABLE _pass5a_lookup AS
  WITH abr_matches AS (
    SELECT
      c.original_uname,
      a.abn,
      ROW_NUMBER() OVER (PARTITION BY c.original_uname ORDER BY a.abn) AS rn,
      COUNT(*) OVER (PARTITION BY c.original_uname) AS match_count
    FROM _pass5a_candidates c
    JOIN abr_registry a
      ON UPPER(a.entity_name) = c.amp_normalized
      AND a.status = 'Active'
  )
  SELECT original_uname, abn
  FROM abr_matches
  WHERE rn = 1 AND match_count = 1;

  CREATE INDEX ON _pass5a_lookup (original_uname);

  RAISE NOTICE '[PASS 5a] Found % matches', (SELECT COUNT(*) FROM _pass5a_lookup);

  UPDATE austender_contracts ac
  SET supplier_abn = lk.abn,
      updated_at = NOW()
  FROM _pass5a_lookup lk
  WHERE UPPER(TRIM(ac.supplier_name)) = lk.original_uname
    AND (ac.supplier_abn IS NULL OR ac.supplier_abn = '');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[PASS 5a] Updated % rows via ABR &amp; decoded match', v_count;

  DROP TABLE _pass5a_candidates;
  DROP TABLE _pass5a_lookup;
END $$;

DO $$
DECLARE
  v_count BIGINT;
BEGIN
  RAISE NOTICE '[PASS 5b] ABR deep-normalized match with &amp; decoding...';

  CREATE TEMP TABLE _pass5b_candidates AS
  SELECT DISTINCT
    UPPER(TRIM(supplier_name)) AS original_uname,
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    REGEXP_REPLACE(
                      REGEXP_REPLACE(
                        UPPER(TRIM(supplier_name)),
                        '\s*\([^)]*\)\s*', ' ', 'g'),
                      ' T/A .*$', ''),
                    ' DBA .*$', ''),
                  ' - [A-Z].*$', ''),
                '\s+PTY\s+', ' ', 'g'),
              '\s+LTD\.?\s*$', ''),
            '\s+LIMITED\s*$', ''),
          '\s+INC\.?\s*$', ''),
        '\s+P/L\s*$', ''),
      '\s+', ' ', 'g')
    ) AS stripped_name
  FROM austender_contracts
  WHERE (supplier_abn IS NULL OR supplier_abn = '')
    AND supplier_name IS NOT NULL AND supplier_name != ''
    AND LENGTH(TRIM(supplier_name)) >= 6;

  DELETE FROM _pass5b_candidates WHERE LENGTH(stripped_name) < 5;
  CREATE INDEX ON _pass5b_candidates (stripped_name);

  -- Match against ABR names with &amp; decoded, deep-stripped
  -- Only use ABR records that actually have &amp; (optimizes scan)
  CREATE TEMP TABLE _pass5b_lookup AS
  WITH abr_stripped AS (
    SELECT
      abn,
      TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REPLACE(UPPER(entity_name), '&AMP;', '&'),
                  '\s*\([^)]*\)\s*', ' ', 'g'),
                '\s+PTY\s+', ' ', 'g'),
              '\s+LTD\.?\s*$', ''),
            '\s+LIMITED\s*$', ''),
          '\s+INC\.?\s*$', ''),
        '\s+', ' ', 'g')
      ) AS stripped_name
    FROM abr_registry
    WHERE status = 'Active'
      AND entity_name LIKE '%&amp;%'
      AND LENGTH(entity_name) >= 5
  ),
  unique_abr AS (
    SELECT stripped_name, MIN(abn) AS abn
    FROM abr_stripped
    GROUP BY stripped_name
    HAVING COUNT(DISTINCT abn) = 1
  )
  SELECT c.original_uname, u.abn
  FROM _pass5b_candidates c
  JOIN unique_abr u ON c.stripped_name = u.stripped_name;

  CREATE INDEX ON _pass5b_lookup (original_uname);

  RAISE NOTICE '[PASS 5b] Found % deep-normalized &amp; matches', (SELECT COUNT(*) FROM _pass5b_lookup);

  UPDATE austender_contracts ac
  SET supplier_abn = lk.abn,
      updated_at = NOW()
  FROM _pass5b_lookup lk
  WHERE UPPER(TRIM(ac.supplier_name)) = lk.original_uname
    AND (ac.supplier_abn IS NULL OR ac.supplier_abn = '');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[PASS 5b] Updated % rows via ABR deep-normalized &amp; match', v_count;

  DROP TABLE _pass5b_candidates;
  DROP TABLE _pass5b_lookup;
END $$;

---------------------------------------------------------------
-- PASS 6: Aggressive normalization against ABR
-- Strip ALL punctuation (periods), &amp; decode, T/A, DBA,
-- location suffixes, and all corporate suffixes.
-- Matches on business name core only.
---------------------------------------------------------------

DO $$
DECLARE
  v_count BIGINT;
BEGIN
  RAISE NOTICE '[PASS 6] Aggressive normalization (strip periods, &amp;, T/A)...';

  CREATE TEMP TABLE _pass6_candidates AS
  SELECT DISTINCT
    UPPER(TRIM(supplier_name)) AS original_uname,
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    REGEXP_REPLACE(
                      REGEXP_REPLACE(
                        REGEXP_REPLACE(
                          REGEXP_REPLACE(
                            UPPER(TRIM(supplier_name)),
                            '\.', '', 'g'),
                          '&AMP;', '&', 'g'),
                        '\s*\([^)]*\)\s*', ' ', 'g'),
                      '\s+T/A\s*.*$', ''),
                    '\s+DBA\s+.*$', ''),
                  '\s+-\s+[A-Z].*$', ''),
                '\s+-\s+AUD\s*$', ''),
              '\s+PTY\s+', ' ', 'g'),
            '\s+LTD\s*$', ''),
          '\s+LIMITED\s*$', ''),
        '\s+P/L\s*$', ''),
      '\s+', ' ', 'g')
    ) AS canonical_name
  FROM austender_contracts
  WHERE (supplier_abn IS NULL OR supplier_abn = '')
    AND supplier_name IS NOT NULL AND supplier_name != ''
    AND LENGTH(TRIM(supplier_name)) >= 6
    AND UPPER(TRIM(supplier_name)) NOT IN ('AUD', 'FMS ACCOUNT', 'SEE MORE INFO SECTION BELOW')
    AND UPPER(TRIM(supplier_name)) NOT LIKE '%CONFIDENTIAL%'
    AND UPPER(TRIM(supplier_name)) NOT LIKE '%DMOJSF%';

  DELETE FROM _pass6_candidates WHERE LENGTH(canonical_name) < 5;
  CREATE INDEX ON _pass6_candidates (canonical_name);

  RAISE NOTICE '[PASS 6] % candidates', (SELECT COUNT(*) FROM _pass6_candidates);

  CREATE TEMP TABLE _pass6_abr AS
  SELECT
    abn,
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    UPPER(entity_name),
                    '\.', '', 'g'),
                  '&AMP;', '&', 'g'),
                '\s*\([^)]*\)\s*', ' ', 'g'),
              '\s+PTY\s+', ' ', 'g'),
            '\s+LTD\s*$', ''),
          '\s+LIMITED\s*$', ''),
        '\s+P/L\s*$', ''),
      '\s+', ' ', 'g')
    ) AS canonical_name
  FROM abr_registry
  WHERE status = 'Active'
    AND entity_name IS NOT NULL
    AND LENGTH(entity_name) >= 5;

  CREATE INDEX ON _pass6_abr (canonical_name);

  CREATE TEMP TABLE _pass6_lookup AS
  WITH unique_abr AS (
    SELECT canonical_name, MIN(abn) AS abn
    FROM _pass6_abr
    GROUP BY canonical_name
    HAVING COUNT(DISTINCT abn) = 1
  )
  SELECT c.original_uname, u.abn
  FROM _pass6_candidates c
  JOIN unique_abr u ON c.canonical_name = u.canonical_name;

  CREATE INDEX ON _pass6_lookup (original_uname);

  RAISE NOTICE '[PASS 6] Found % matches', (SELECT COUNT(*) FROM _pass6_lookup);

  UPDATE austender_contracts ac
  SET supplier_abn = lk.abn,
      updated_at = NOW()
  FROM _pass6_lookup lk
  WHERE UPPER(TRIM(ac.supplier_name)) = lk.original_uname
    AND (ac.supplier_abn IS NULL OR ac.supplier_abn = '');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[PASS 6] Updated % rows', v_count;

  DROP TABLE _pass6_candidates;
  DROP TABLE _pass6_abr;
  DROP TABLE _pass6_lookup;
END $$;

---------------------------------------------------------------
-- Final count
---------------------------------------------------------------

DO $$
DECLARE
  v_missing BIGINT;
  v_total BIGINT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE supplier_abn IS NULL OR supplier_abn = '')
  INTO v_total, v_missing
  FROM austender_contracts;
  RAISE NOTICE '[AFTER] Total: %, Missing: % (%.2f%%)', v_total, v_missing, ROUND((v_missing::numeric / v_total * 100), 2);
END $$;
