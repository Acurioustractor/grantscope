-- Slice 2 — THE BOARD. The question registry.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000300_clarity_question_registry.sql
--
-- Rollback:
--   DROP VIEW IF EXISTS v_clarity_board;
--   DROP TABLE IF EXISTS clarity_answer, clarity_question_ingredient, clarity_sentinel, clarity_question;
--   DROP TYPE IF EXISTS clarity_question_state, clarity_form_kind, clarity_publishable,
--                       clarity_honest_at, clarity_effort;
--
-- Two fixes carried in from judge-build, both load-bearing:
--   1. clarity_question_ingredient's PRIMARY KEY takes a COLUMN LIST, not an expression. The
--      original `PRIMARY KEY (question_slug, object_key, coalesce(join_key,''))` fails at parse
--      and would have blocked the whole slice. join_key is NOT NULL DEFAULT '' instead.
--   2. 'draft' is a state, so the cross-section matrix can mint questions later without
--      inventing a lifecycle.
--
-- The design rule this table exists to enforce: a claim may not ship without its caveat, its
-- deterministic exclusion filter, and the exact sentence the UI is allowed to render. Those are
-- NOT NULL columns, not conventions.

BEGIN;

CREATE TYPE clarity_question_state AS ENUM
  ('draft','answered','contested','unanswerable','refused','retired');
CREATE TYPE clarity_form_kind AS ENUM
  ('scalar','ranked_bar','stacked_three','matrix','timeseries','refused');
CREATE TYPE clarity_publishable AS ENUM ('public','shareable','internal');
CREATE TYPE clarity_honest_at AS ENUM
  ('national','state','lga','postcode','facility','entity','person_block','abn','none');
CREATE TYPE clarity_effort AS ENUM ('S','M','L');

CREATE TABLE clarity_question (
  slug                 text PRIMARY KEY,
  stub                 text NOT NULL,       -- 2-4 words, uppercase in the UI
  question             text NOT NULL,       -- the sentence, sentence case
  subject              text NOT NULL,       -- JUSTICE MONEY CHARITY POWER PLACE EVIDENCE HOUSE
  state                clarity_question_state NOT NULL,
  form                 clarity_form_kind      NOT NULL,
  honest_at            clarity_honest_at      NOT NULL,
  publishable          clarity_publishable    NOT NULL DEFAULT 'internal',
  defamation_sensitive boolean NOT NULL DEFAULT false,
  verification_stamp   text CHECK (verification_stamp IN ('verified','unverified','pilot')),

  -- the four things a claim may never ship without
  caveat               text NOT NULL CHECK (length(btrim(caveat)) > 20),
  exclusions           text NOT NULL,       -- the DETERMINISTIC filter, printed in the caption
  claim_phrasing       text NOT NULL,       -- the sentence the UI is allowed to render
  forbidden_phrasing   text[] NOT NULL DEFAULT '{}',

  -- the executable half
  answer_sql           text,                -- returns ONE jsonb payload row
  rows_sql             text,                -- must accept LIMIT/OFFSET
  coverage_sql         text,                -- returns (numerator, denominator, label)
  refuses_when         text,
  live_rerun_ok        boolean NOT NULL DEFAULT false,   -- set by the runner from measured ms
  measured_ms          integer,

  -- blocked questions
  blocked_by           text[] NOT NULL DEFAULT '{}',     -- clarity_object.object_key
  blocked_by_metric    text REFERENCES clarity_gap_metric(metric_key),
  unlocks_questions    text[] NOT NULL DEFAULT '{}',
  unlock_effort        clarity_effort,
  unlock_note          text,
  unlock_dollars       numeric,
  licence_note         text,
  uniqueness           numeric NOT NULL DEFAULT 0.5 CHECK (uniqueness BETWEEN 0 AND 1),
  uniqueness_basis     text,                -- WHY we believe no public source does this

  surface              text,                -- '/atlas', '/graph', or null = unlanded
  reach_score          numeric,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  -- a question is either executable or explicitly blocked. Never silently neither.
  CONSTRAINT executable_or_blocked CHECK (
    (state IN ('answered','contested') AND answer_sql IS NOT NULL)
    OR (state IN ('unanswerable','refused') AND array_length(blocked_by,1) >= 1)
    OR state IN ('draft','retired')
  ),
  -- a blocked question must state what unblocking costs
  CONSTRAINT blocked_has_a_price CHECK (
    state NOT IN ('unanswerable','refused')
    OR (unlock_effort IS NOT NULL AND unlock_note IS NOT NULL)
  )
);

CREATE TABLE clarity_question_ingredient (
  question_slug text NOT NULL REFERENCES clarity_question(slug) ON DELETE CASCADE,
  object_key    text NOT NULL,
  join_key      text NOT NULL DEFAULT '',
  role          text NOT NULL CHECK (role IN ('spine','fact','reference','filter','denominator')),
  is_binding    boolean NOT NULL DEFAULT false,
  measured_pct  numeric,
  measured_at   timestamptz,
  PRIMARY KEY (question_slug, object_key, join_key)
);

-- Exactly one binding ingredient per question. Without this, a question with a 94% join and a
-- 12.9% join renders the 94% and the coverage line becomes a flattering lie.
CREATE UNIQUE INDEX clarity_one_binding
  ON clarity_question_ingredient (question_slug) WHERE is_binding;

CREATE TABLE clarity_answer (
  id             bigserial PRIMARY KEY,
  question_slug  text NOT NULL REFERENCES clarity_question(slug) ON DELETE CASCADE,
  computed_at    timestamptz NOT NULL DEFAULT now(),
  ok             boolean NOT NULL,
  error_text     text,
  payload        jsonb,          -- the form's data; shape declared per form kind
  headline       text,           -- '85.1%'
  headline_sub   text,           -- '662 of 778 organisations'
  headline_num   numeric,        -- machine-comparable, for drift detection
  coverage_num   numeric,
  coverage_den   numeric,
  coverage_label text,
  sentinel_flags jsonb NOT NULL DEFAULT '{}',
  row_count      bigint,
  duration_ms    integer
);
CREATE INDEX clarity_answer_latest ON clarity_answer (question_slug, computed_at DESC);

CREATE TABLE clarity_sentinel (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  description text NOT NULL,
  probe_sql   text NOT NULL,     -- returns (tripped bool, n bigint, share numeric, detail jsonb)
  severity    text NOT NULL CHECK (severity IN ('block','warn')),
  applies_to  text[] NOT NULL DEFAULT '{}'   -- question slugs; empty = global
);

CREATE VIEW v_clarity_board WITH (security_invoker = true) AS
SELECT q.*, a.headline, a.headline_sub, a.headline_num, a.coverage_num, a.coverage_den,
       a.coverage_label, a.computed_at, a.ok, a.error_text, a.sentinel_flags, a.duration_ms
  FROM clarity_question q
  LEFT JOIN LATERAL (SELECT * FROM clarity_answer x
                      WHERE x.question_slug = q.slug ORDER BY x.computed_at DESC LIMIT 1) a ON true
 WHERE q.state <> 'retired';

GRANT SELECT ON v_clarity_board TO service_role;

COMMIT;
