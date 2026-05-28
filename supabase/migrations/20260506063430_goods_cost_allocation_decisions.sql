-- Goods direct-cost allocation decisions.
--
-- This table does not mutate Xero or Dext. It records ACT's treatment of each
-- Goods supplier-bill line so the last-50-bed cost sheet can move from review
-- draft to a finance-backed direct-cost calculation.

CREATE TABLE IF NOT EXISTS goods_cost_allocation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  project_code text NOT NULL DEFAULT 'ACT-GD',
  xero_invoice_id uuid REFERENCES xero_invoices(id) ON DELETE CASCADE,
  invoice_number text,
  line_index integer NOT NULL,
  line_fingerprint text NOT NULL,

  supplier text,
  account_code text,
  account_label text,
  description text,
  line_amount numeric,
  category text,

  decision text NOT NULL DEFAULT 'needs_allocation'
    CHECK (
      decision IN (
        'needs_allocation',
        'include_direct',
        'show_separately',
        'exclude',
        'needs_receipt',
        'needs_review'
      )
    ),
  allocation_scope text NOT NULL DEFAULT 'unallocated'
    CHECK (allocation_scope IN ('unallocated', 'last_50', 'current_batch', 'specific_assets', 'shared_service')),
  batch_ref text,
  asset_refs text[] NOT NULL DEFAULT ARRAY[]::text[],

  notes text,
  decided_by text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT goods_cost_allocation_unique_line UNIQUE (project_code, line_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_goods_cost_allocation_project_decision
  ON goods_cost_allocation_decisions(project_code, decision, allocation_scope, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_goods_cost_allocation_invoice
  ON goods_cost_allocation_decisions(xero_invoice_id, line_index);

CREATE INDEX IF NOT EXISTS idx_goods_cost_allocation_category
  ON goods_cost_allocation_decisions(project_code, category);

ALTER TABLE goods_cost_allocation_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goods_cost_allocation_service" ON goods_cost_allocation_decisions;
CREATE POLICY "goods_cost_allocation_service" ON goods_cost_allocation_decisions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "goods_cost_allocation_authenticated_read" ON goods_cost_allocation_decisions;
CREATE POLICY "goods_cost_allocation_authenticated_read" ON goods_cost_allocation_decisions
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS goods_cost_allocation_updated_at ON goods_cost_allocation_decisions;
CREATE TRIGGER goods_cost_allocation_updated_at
  BEFORE UPDATE ON goods_cost_allocation_decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
