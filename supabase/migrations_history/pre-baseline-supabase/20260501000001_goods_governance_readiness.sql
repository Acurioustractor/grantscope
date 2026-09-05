-- ============================================================================
-- GOODS GOVERNANCE READINESS
-- ============================================================================
-- Structured readiness source for Goods applicant, contracting, governance,
-- benefit-share, IP/licence, insurance, banking, and co-contribution decisions.
-- The cockpit reads this table as a blocker surface before promoting high-value
-- grants, capital, or procurement opportunities.
-- ============================================================================

CREATE TABLE IF NOT EXISTS goods_governance_readiness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  readiness_key text NOT NULL UNIQUE,
  area text NOT NULL,
  status text NOT NULL DEFAULT 'gap'
    CHECK (status IN ('ready', 'partial', 'gap', 'blocked', 'unknown')),
  priority text NOT NULL DEFAULT 'high'
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),

  decision text,
  position text,
  owner text,
  next_action text,
  blocker text,

  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  opportunity_lanes text[] NOT NULL DEFAULT ARRAY[]::text[],

  public_visibility text NOT NULL DEFAULT 'internal'
    CHECK (public_visibility IN ('public', 'internal', 'community_approval_required', 'private')),
  reviewed_at timestamptz,
  due_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goods_governance_readiness_status
  ON goods_governance_readiness(status, priority);

CREATE INDEX IF NOT EXISTS idx_goods_governance_readiness_lanes
  ON goods_governance_readiness USING gin(opportunity_lanes);

CREATE INDEX IF NOT EXISTS idx_goods_governance_readiness_reviewed
  ON goods_governance_readiness(reviewed_at DESC NULLS LAST);

ALTER TABLE goods_governance_readiness ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goods_governance_readiness_service" ON goods_governance_readiness;
CREATE POLICY "goods_governance_readiness_service" ON goods_governance_readiness
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "goods_governance_readiness_authenticated_read" ON goods_governance_readiness;
CREATE POLICY "goods_governance_readiness_authenticated_read" ON goods_governance_readiness
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS goods_governance_readiness_updated_at ON goods_governance_readiness;
CREATE TRIGGER goods_governance_readiness_updated_at
  BEFORE UPDATE ON goods_governance_readiness
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO goods_governance_readiness (
  readiness_key,
  area,
  status,
  priority,
  decision,
  position,
  owner,
  next_action,
  blocker,
  evidence_refs,
  source_refs,
  opportunity_lanes,
  public_visibility
)
VALUES
  (
    'act-shared-service-role',
    'ACT shared service role',
    'ready',
    'high',
    'Use ACT for infrastructure, evidence systems, CRM, finance tagging, application writing, and reporting support.',
    'ACT remains the shared service, evidence, systems, CRM, finance-tagging, and application capability layer.',
    'ACT shared service',
    'Keep this role clear in every grant, buyer, and capital brief.',
    NULL,
    '[{"label":"ACT Operational Thesis","detail":"Shared service model and project-code spine"}]'::jsonb,
    '[{"source":"ACT wiki","ref":"Goods operating system"}]'::jsonb,
    ARRAY['grant','foundation','procurement','capital','systems'],
    'public'
  ),
  (
    'goods-vehicle-and-applicant',
    'Goods vehicle, applicant, and contracting party',
    'gap',
    'critical',
    'Choose who applies, who contracts, who owns the offer, and how community benefit is recorded.',
    'Goods needs a First Nations-driven operating pathway: community-governed model, co-op, formal partner-governance model, or future First Nations-owned vehicle.',
    'Governance / legal',
    'Write a one-page entity option memo before promoting any major grant, procurement, or capital ask.',
    'Applicant, contracting party, bank, insurance, and authority are not yet one structured decision.',
    '[{"label":"Goods governance rows","detail":"Vehicle decision is named but unresolved"}]'::jsonb,
    '[{"source":"ACT wiki","ref":"Goods governance"}]'::jsonb,
    ARRAY['grant','procurement','capital','systems'],
    'internal'
  ),
  (
    'community-benefit-share',
    'Community benefit and profit-share',
    'partial',
    'critical',
    'Tie benefit-share to reporting cadence, project codes, and community authority.',
    'The 40 percent community profit-share narrative gives funders a clear accountability and redistribution story.',
    'Governance / community authority',
    'Convert the benefit-share narrative into reporting fields and a funder-safe commitment note.',
    'Benefit-share logic exists as narrative but not yet as reporting proof.',
    '[{"label":"Goods impact rows","detail":"First Nations-driven community benefit"}]'::jsonb,
    '[{"source":"ACT wiki","ref":"Goods impact model"}]'::jsonb,
    ARRAY['foundation','capital','procurement','evidence'],
    'community_approval_required'
  ),
  (
    'ip-licence-and-data',
    'IP, licence, data, and story permissions',
    'gap',
    'critical',
    'Distinguish system IP, product design, community story, data, and operating brand permissions.',
    'ACT/Goods should distinguish system IP, product design, community story, data, and operating brand permissions.',
    'Governance / legal',
    'Attach an IP/licence and data-use note to major funder, investor, and buyer asks.',
    'The current cockpit does not yet separate public proof, internal proof, and community-approved proof.',
    '[{"label":"Goods source documents","detail":"Asset register, product proof, story and source pack"}]'::jsonb,
    '[{"source":"ACT wiki","ref":"Goods source documents"}]'::jsonb,
    ARRAY['foundation','capital','procurement','evidence'],
    'internal'
  ),
  (
    'insurance-bank-and-compliance',
    'Insurance, banking, compliance, and authority',
    'gap',
    'critical',
    'Confirm insurance, bank account, ABN/GST path, contracting authority, and compliance proof before high-value promotion.',
    'Large opportunities fail late when entity, bank, insurance, co-contribution, IP, and governance proof are unresolved.',
    'Operations / finance',
    'Create a one-row readiness proof pack for bank, insurance, ABN/GST, authority, and required attachments.',
    'Finance and compliance readiness is not yet structured beside the opportunity pipeline.',
    '[{"label":"ACT Project Codes","detail":"Finance map for spend, receipts, Dext/Xero, R&D evidence, and reporting"}]'::jsonb,
    '[{"source":"ACT wiki","ref":"ACT Project Codes"}]'::jsonb,
    ARRAY['grant','capital','procurement','systems'],
    'internal'
  )
ON CONFLICT (readiness_key) DO UPDATE SET
  area = EXCLUDED.area,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  decision = EXCLUDED.decision,
  position = EXCLUDED.position,
  owner = EXCLUDED.owner,
  next_action = EXCLUDED.next_action,
  blocker = EXCLUDED.blocker,
  evidence_refs = EXCLUDED.evidence_refs,
  source_refs = EXCLUDED.source_refs,
  opportunity_lanes = EXCLUDED.opportunity_lanes,
  public_visibility = EXCLUDED.public_visibility,
  updated_at = now();
