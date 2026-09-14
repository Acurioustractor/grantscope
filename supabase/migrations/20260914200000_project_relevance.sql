-- Fit scores for the five ACT projects other than Goods (which already has
-- goods_relevance_score/signals). One jsonb column keyed by project id, e.g.
--   {"justicehub": {"score": 60, "signals": {...}, "scored_at": "..."},
--    "farm": {"score": 10, ...}, "tag_changes": {"justicehub": {...}}}
-- Written by scripts/score-project-relevance.mjs (scripts/lib/project-relevance.mjs).
-- Mirrors the goods_relevance_score/signals/scored_at pattern; a single jsonb column
-- instead of five score columns because these are read together (the desk triage
-- widening in act-one-desk.ts) and never filtered/sorted individually in SQL.
BEGIN;

alter table public.grant_opportunities
  add column if not exists project_relevance jsonb not null default '{}'::jsonb,
  add column if not exists project_relevance_scored_at timestamptz;

comment on column public.grant_opportunities.project_relevance is
  'Fit score + signals per ACT project (justicehub/empathy-ledger/harvest/farm/contained). Goods uses goods_relevance_score instead. Written by scripts/score-project-relevance.mjs.';

COMMIT;
