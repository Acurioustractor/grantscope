-- Per-recommendation decision log. UI writes here when an admin clicks
-- Apply / Pass / Watch on /ops/grant-recommendations. Separate from
-- saved_grants (which is the /tracker user-facing Kanban) because
-- alma_funding_opportunities is a different table from canonical grants.

CREATE TABLE IF NOT EXISTS act_grant_recommendation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  project_code text NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES alma_funding_opportunities(id) ON DELETE CASCADE,

  decision text NOT NULL CHECK (decision IN (
    'pursuing','watching','passed','applied','submitted','won','lost'
  )),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  notes text,

  -- Optional handoff to Notion / GHL once decided
  notion_page_id text,
  ghl_opportunity_id text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (project_code, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_agr_decisions_project_decision
  ON act_grant_recommendation_decisions (project_code, decision);
CREATE INDEX IF NOT EXISTS idx_agr_decisions_decided_at
  ON act_grant_recommendation_decisions (decided_at DESC);

COMMENT ON TABLE act_grant_recommendation_decisions IS
  'Admin decisions on ACT grant recommendations. One row per (project, opportunity). UI writes; Notion sync (P7) reads.';
