-- A receipt for every value a model writes into a JusticeHub table.
--
-- Counted 2026-09-24: 87 JusticeHub files call a model and write its output straight into tables
-- the public site reads, with nothing recording which values came from a model, which model, or
-- what it read. Justice Matrix case facts were filled "from training knowledge" when a page came
-- back empty; program costs were saved with their source thrown away. Neither can be traced now.
--
-- JusticeHub's src/lib/ai/model-write.ts (fillFromModel) is the one way model output is saved from
-- here on. It writes one row here per field BEFORE it writes the value, and writes no value whose
-- receipt fails. A receipt says: this table, this record, this field, this value, written by this
-- job, answered by this provider and model, from these URLs. read_from may not be empty, so the
-- database itself refuses a receipt with no source.
--
-- Service role only. Nothing here is granted to anon or authenticated; RLS is on with no policies.
--
-- Asked for by Ben 2026-09-24 (plan step 2, "one way to save model output").
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260924104850_model_writes_receipts.sql
-- Then regenerate JusticeHub's src/types/database.types.ts.
-- Undo: DROP TABLE public.model_writes; (nothing else references it)

BEGIN;

CREATE TABLE IF NOT EXISTS public.model_writes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  text        NOT NULL,
  record_id   text        NOT NULL,
  field       text        NOT NULL,
  value       jsonb,
  job         text        NOT NULL,
  provider    text        NOT NULL,
  model       text        NOT NULL,
  read_from   text[]      NOT NULL CHECK (cardinality(read_from) > 0),
  written_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_writes_record_idx ON public.model_writes (table_name, record_id);
CREATE INDEX IF NOT EXISTS model_writes_job_idx ON public.model_writes (job, written_at DESC);

ALTER TABLE public.model_writes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.model_writes FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.model_writes TO service_role;

COMMENT ON TABLE public.model_writes IS
  'One row per field a model wrote into a JusticeHub table, written before the value by fillFromModel (JusticeHub src/lib/ai/model-write.ts). Service role only.';

COMMIT;
