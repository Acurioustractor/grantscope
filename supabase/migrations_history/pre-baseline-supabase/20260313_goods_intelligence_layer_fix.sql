-- Fix: goods_asset_lifecycle (generated columns can't use NOW())
-- and goods_procurement_signals + materialized view that depend on it

-- ============================================================================
-- 5. GOODS_ASSET_LIFECYCLE — Synced from Goods Supabase
-- ============================================================================
-- Age/overdue computed by the sync agent, not generated columns.

CREATE TABLE IF NOT EXISTS goods_asset_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- From Goods
  goods_asset_id TEXT NOT NULL UNIQUE,
  product_slug TEXT,
  community_id UUID REFERENCES goods_communities(id),

  -- Identity
  asset_name TEXT,
  product_type TEXT,
  community_name TEXT NOT NULL,
  household TEXT,

  -- Lifecycle
  deployed_at TIMESTAMPTZ,
  last_checkin_at TIMESTAMPTZ,
  last_ticket_at TIMESTAMPTZ,
  current_status TEXT DEFAULT 'active'
    CHECK (current_status IN ('active', 'needs_repair', 'damaged', 'missing', 'replaced', 'end_of_life')),

  -- Age analysis (computed by sync agent, not generated — NOW() isn't immutable)
  age_months INTEGER,
  months_since_checkin INTEGER,
  is_overdue BOOLEAN DEFAULT false,

  -- Ticket/issue summary
  total_tickets INTEGER NOT NULL DEFAULT 0,
  open_tickets INTEGER NOT NULL DEFAULT 0,
  urgent_tickets INTEGER NOT NULL DEFAULT 0,

  -- IoT data (washers)
  total_cycles INTEGER,
  avg_power_kwh NUMERIC,
  error_count INTEGER NOT NULL DEFAULT 0,

  -- Replacement signal
  needs_replacement BOOLEAN DEFAULT false,
  replacement_reason TEXT,
  replacement_product_slug TEXT,

  -- Metadata
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goods_asset_lifecycle_community ON goods_asset_lifecycle(community_id);
CREATE INDEX IF NOT EXISTS idx_goods_asset_lifecycle_status ON goods_asset_lifecycle(current_status);
CREATE INDEX IF NOT EXISTS idx_goods_asset_lifecycle_overdue ON goods_asset_lifecycle(is_overdue) WHERE is_overdue = true;
CREATE INDEX IF NOT EXISTS idx_goods_asset_lifecycle_replacement ON goods_asset_lifecycle(needs_replacement) WHERE needs_replacement = true;

-- ============================================================================
-- 6. GOODS_PROCUREMENT_SIGNALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS goods_procurement_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  signal_type TEXT NOT NULL
    CHECK (signal_type IN (
      'asset_end_of_life', 'demand_unmet', 'tender_match', 'grant_opened',
      'buyer_reorder', 'community_request', 'ndis_thin_market', 'agent_discovered'
    )),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  community_id UUID REFERENCES goods_communities(id),
  asset_id UUID REFERENCES goods_asset_lifecycle(id),
  product_id UUID REFERENCES goods_products(id),
  buyer_entity_id UUID REFERENCES goods_procurement_entities(id),

  title TEXT NOT NULL,
  description TEXT,
  estimated_value NUMERIC,
  estimated_units INTEGER,
  products_needed TEXT[],

  matched_grant_ids TEXT[],
  matched_foundation_ids TEXT[],
  funding_confidence TEXT
    CHECK (funding_confidence IN ('confirmed', 'likely', 'possible', 'none')),

  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'actioned', 'won', 'lost', 'expired', 'dismissed')),
  assigned_to TEXT,
  action_notes TEXT,
  actioned_at TIMESTAMPTZ,

  ghl_contact_id TEXT,
  ghl_synced_at TIMESTAMPTZ,

  source_agent TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goods_procurement_signals_community ON goods_procurement_signals(community_id);
CREATE INDEX IF NOT EXISTS idx_goods_procurement_signals_status ON goods_procurement_signals(status);
CREATE INDEX IF NOT EXISTS idx_goods_procurement_signals_priority ON goods_procurement_signals(priority);
CREATE INDEX IF NOT EXISTS idx_goods_procurement_signals_type ON goods_procurement_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_goods_procurement_signals_new ON goods_procurement_signals(created_at DESC) WHERE status = 'new';

-- ============================================================================
-- 7. MATERIALIZED VIEW — Community intelligence summary
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_goods_community_intelligence;

CREATE MATERIALIZED VIEW mv_goods_community_intelligence AS
SELECT
  gc.id,
  gc.community_name,
  gc.state,
  gc.postcode,
  gc.region_label,
  gc.remoteness,
  gc.priority,
  gc.estimated_population,
  gc.estimated_households,
  gc.demand_beds,
  gc.demand_washers,
  gc.demand_fridges,
  gc.demand_mattresses,
  (gc.demand_beds + gc.demand_washers + gc.demand_fridges + gc.demand_mattresses) AS total_demand_units,
  gc.assets_deployed,
  gc.assets_active,
  gc.assets_overdue,
  gc.buyer_entity_count,
  gc.community_controlled_org_count,
  gc.total_local_entities,
  gc.total_govt_contract_value,
  gc.nearest_staging_hub,
  gc.freight_corridor,
  gc.estimated_freight_cost_per_kg,
  gc.last_mile_method,
  (SELECT COUNT(*) FROM goods_procurement_signals gps
   WHERE gps.community_id = gc.id AND gps.status = 'new') AS active_signals,
  (SELECT COUNT(*) FROM goods_procurement_entities gpe
   WHERE gpe.community_id = gc.id AND gpe.relationship_status IN ('warm', 'active', 'customer')) AS warm_buyers,
  (SELECT COUNT(*) FROM goods_asset_lifecycle gal
   WHERE gal.community_id = gc.id AND gal.needs_replacement = true) AS assets_needing_replacement,
  gc.data_quality_score,
  gc.last_profiled_at,
  gc.proof_line
FROM goods_communities gc
ORDER BY gc.priority DESC, gc.community_name;

CREATE UNIQUE INDEX idx_mv_goods_community_intelligence_id ON mv_goods_community_intelligence(id);

-- ============================================================================
-- Fix triggers for lifecycle + signals tables
-- ============================================================================

DROP TRIGGER IF EXISTS trg_goods_asset_lifecycle_updated_at ON goods_asset_lifecycle;
CREATE TRIGGER trg_goods_asset_lifecycle_updated_at
  BEFORE UPDATE ON goods_asset_lifecycle
  FOR EACH ROW EXECUTE FUNCTION goods_update_timestamp();

DROP TRIGGER IF EXISTS trg_goods_procurement_signals_updated_at ON goods_procurement_signals;
CREATE TRIGGER trg_goods_procurement_signals_updated_at
  BEFORE UPDATE ON goods_procurement_signals
  FOR EACH ROW EXECUTE FUNCTION goods_update_timestamp();
