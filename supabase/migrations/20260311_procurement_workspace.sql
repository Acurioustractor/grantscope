-- Procurement workspace tables
-- Purpose: persist team-scoped tender shortlists and workflow runs so
-- Tender Intelligence can operate as a real procurement workspace.

CREATE TABLE IF NOT EXISTS procurement_shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_profile_id, name)
);

CREATE TABLE IF NOT EXISTS procurement_shortlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id uuid NOT NULL REFERENCES procurement_shortlists(id) ON DELETE CASCADE,
  supplier_key text NOT NULL,
  gs_id text,
  supplier_abn text,
  supplier_name text NOT NULL,
  entity_type text,
  state text,
  postcode text,
  remoteness text,
  lga_name text,
  seifa_irsd_decile integer,
  latest_revenue numeric,
  is_community_controlled boolean NOT NULL DEFAULT false,
  contract_count integer NOT NULL DEFAULT 0,
  contract_total_value numeric NOT NULL DEFAULT 0,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  decision_tag text,
  added_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shortlist_id, supplier_key)
);

CREATE TABLE IF NOT EXISTS procurement_workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid REFERENCES org_profiles(id) ON DELETE SET NULL,
  shortlist_id uuid REFERENCES procurement_shortlists(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_type text NOT NULL CHECK (workflow_type IN ('discover', 'enrich', 'pack', 'compliance')),
  workflow_status text NOT NULL CHECK (workflow_status IN ('completed', 'failed')),
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  records_scanned integer NOT NULL DEFAULT 0,
  records_changed integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_shortlists_org
  ON procurement_shortlists(org_profile_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_shortlist_items_shortlist
  ON procurement_shortlist_items(shortlist_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_shortlist_items_decision
  ON procurement_shortlist_items(shortlist_id, decision_tag);

CREATE INDEX IF NOT EXISTS idx_procurement_workflow_runs_org
  ON procurement_workflow_runs(org_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_workflow_runs_user
  ON procurement_workflow_runs(user_id, created_at DESC);

ALTER TABLE procurement_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_shortlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_procurement_shortlists_manage" ON procurement_shortlists;
CREATE POLICY "org_procurement_shortlists_manage" ON procurement_shortlists
  FOR ALL
  USING (
    org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "org_procurement_shortlist_items_manage" ON procurement_shortlist_items;
CREATE POLICY "org_procurement_shortlist_items_manage" ON procurement_shortlist_items
  FOR ALL
  USING (
    shortlist_id IN (
      SELECT id
      FROM procurement_shortlists
      WHERE org_profile_id IN (
        SELECT id FROM org_profiles WHERE user_id = auth.uid()
        UNION
        SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    shortlist_id IN (
      SELECT id
      FROM procurement_shortlists
      WHERE org_profile_id IN (
        SELECT id FROM org_profiles WHERE user_id = auth.uid()
        UNION
        SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "org_procurement_workflow_runs_select" ON procurement_workflow_runs;
CREATE POLICY "org_procurement_workflow_runs_select" ON procurement_workflow_runs
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "org_procurement_workflow_runs_insert" ON procurement_workflow_runs;
CREATE POLICY "org_procurement_workflow_runs_insert" ON procurement_workflow_runs
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR org_profile_id IN (
      SELECT id FROM org_profiles WHERE user_id = auth.uid()
      UNION
      SELECT org_profile_id FROM org_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS procurement_shortlists_updated_at ON procurement_shortlists;
CREATE TRIGGER procurement_shortlists_updated_at
  BEFORE UPDATE ON procurement_shortlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS procurement_shortlist_items_updated_at ON procurement_shortlist_items;
CREATE TRIGGER procurement_shortlist_items_updated_at
  BEFORE UPDATE ON procurement_shortlist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS procurement_workflow_runs_updated_at ON procurement_workflow_runs;
CREATE TRIGGER procurement_workflow_runs_updated_at
  BEFORE UPDATE ON procurement_workflow_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
