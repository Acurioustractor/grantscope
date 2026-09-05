-- ============================================================================
-- GOODS INTELLIGENCE LAYER
-- ============================================================================
-- The full data model for Goods on Country supply chain intelligence.
-- Covers: communities → products → supply routes → procurement → lifecycle
--
-- Design principle (SpaceX/Goods): atoms are cheap, process is pricey.
-- This schema captures the process cost — freight, procurement overhead,
-- lifecycle failure — so we can systematically eliminate it.
-- ============================================================================

-- ============================================================================
-- 1. GOODS_COMMUNITIES — Every remote community in Australia
-- ============================================================================
-- Replaces hardcoded COMMUNITY_SEEDS. Covers all states, not just NT.
-- Links to postcode_geo for coordinates and gs_entities for local orgs.

CREATE TABLE IF NOT EXISTS goods_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  community_name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  state TEXT NOT NULL,
  postcode TEXT,
  lga_name TEXT,
  lga_code TEXT,

  -- Geography
  region_label TEXT,                       -- Human label: "East Arnhem", "APY Lands", "Cape York"
  service_region TEXT,                     -- Service delivery region
  land_council TEXT,                       -- Relevant land council (NT/SA/WA)
  remoteness TEXT NOT NULL DEFAULT 'Remote Australia',
  latitude NUMERIC,
  longitude NUMERIC,

  -- Demographics (populated by agent)
  estimated_population INTEGER,
  estimated_households INTEGER,
  indigenous_population_pct NUMERIC,

  -- Goods demand signals
  priority TEXT NOT NULL DEFAULT 'background'
    CHECK (priority IN ('background', 'monitor', 'warm', 'active', 'lead')),
  signal_type TEXT NOT NULL DEFAULT 'none'
    CHECK (signal_type IN ('none', 'exact', 'regional_hub', 'homelands_cluster', 'island_cluster', 'inferred')),
  signal_source TEXT,                      -- What triggered the signal: "goods_asset_data", "partner_referral", "tender_match"
  demand_beds INTEGER NOT NULL DEFAULT 0,
  demand_washers INTEGER NOT NULL DEFAULT 0,
  demand_fridges INTEGER NOT NULL DEFAULT 0,
  demand_mattresses INTEGER NOT NULL DEFAULT 0,

  -- Existing deployment
  assets_deployed INTEGER NOT NULL DEFAULT 0,
  assets_active INTEGER NOT NULL DEFAULT 0,
  assets_overdue INTEGER NOT NULL DEFAULT 0,
  latest_checkin_date TIMESTAMPTZ,

  -- Local procurement landscape (denormalized for fast reads)
  known_buyer_name TEXT,                   -- Primary procurement buyer (e.g., "Outback Stores")
  buyer_entity_count INTEGER NOT NULL DEFAULT 0,
  store_count INTEGER NOT NULL DEFAULT 0,
  health_service_count INTEGER NOT NULL DEFAULT 0,
  housing_org_count INTEGER NOT NULL DEFAULT 0,
  council_count INTEGER NOT NULL DEFAULT 0,
  community_controlled_org_count INTEGER NOT NULL DEFAULT 0,
  total_local_entities INTEGER NOT NULL DEFAULT 0,

  -- Funding flowing in
  total_govt_contract_value NUMERIC,       -- austender contracts to local entities
  total_justice_funding NUMERIC,           -- justice funding to local entities
  total_foundation_grants NUMERIC,         -- foundation grants to local area

  -- NDIS (for washing machine / assistive tech angle)
  ndis_provider_count INTEGER,
  ndis_thin_market BOOLEAN DEFAULT false,

  -- Supply chain
  nearest_staging_hub TEXT,                -- Nearest freight staging point
  freight_corridor TEXT,                   -- "Darwin-Katherine", "Alice Springs-APY", etc.
  estimated_freight_cost_per_kg NUMERIC,   -- $/kg to deliver here
  last_mile_method TEXT,                   -- "road", "barge", "charter_flight"

  -- Proof / narrative
  proof_line TEXT,                          -- One-line evidence statement
  story TEXT,                              -- Community story for proposals
  youth_employment_angle TEXT,             -- Youth jobs narrative

  -- Metadata
  data_quality_score NUMERIC DEFAULT 0,    -- 0-100, how complete the profile is
  last_profiled_at TIMESTAMPTZ,
  last_agent_run_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (community_name, state)
);

CREATE INDEX idx_goods_communities_state ON goods_communities(state);
CREATE INDEX idx_goods_communities_priority ON goods_communities(priority);
CREATE INDEX idx_goods_communities_postcode ON goods_communities(postcode);
CREATE INDEX idx_goods_communities_remoteness ON goods_communities(remoteness);
CREATE INDEX idx_goods_communities_signal ON goods_communities(signal_type) WHERE signal_type != 'none';
CREATE INDEX idx_goods_communities_aliases ON goods_communities USING GIN (aliases);

-- ============================================================================
-- 2. GOODS_PRODUCTS — Product catalog with economics
-- ============================================================================
-- The "idiot index" lives here: material_cost_aud / typical_delivered_cost
-- Every product Goods makes or could make, with full cost breakdown.

CREATE TABLE IF NOT EXISTS goods_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  slug TEXT NOT NULL UNIQUE,               -- "stretch-bed", "id-washing-machine", "fridge-remote"
  name TEXT NOT NULL,
  category TEXT NOT NULL                   -- "bed", "washer", "fridge", "mattress"
    CHECK (category IN ('bed', 'washer', 'fridge', 'mattress', 'furniture', 'appliance', 'other')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'prototype', 'discontinued', 'planned')),

  -- Bill of materials
  bom_description TEXT,                    -- Human-readable BOM
  material_cost_aud NUMERIC,               -- Raw materials cost
  manufacturing_cost_aud NUMERIC,          -- Labour + factory cost
  wholesale_price_aud NUMERIC,             -- What Goods charges
  typical_retail_price_aud NUMERIC,        -- What incumbents charge for equivalent
  typical_delivered_cost_remote NUMERIC,   -- Total cost delivered to remote community (incumbent)

  -- The idiot index: how much of the price is process, not atoms
  -- Calculated: typical_delivered_cost_remote / material_cost_aud
  -- A ratio of 10 means 90% of the cost is process overhead
  idiot_index NUMERIC GENERATED ALWAYS AS (
    CASE WHEN material_cost_aud > 0 AND typical_delivered_cost_remote > 0
      THEN ROUND(typical_delivered_cost_remote / material_cost_aud, 1)
      ELSE NULL
    END
  ) STORED,

  -- Goods advantage: our delivered cost vs incumbent
  goods_delivered_cost_remote NUMERIC,     -- What it costs Goods to deliver to remote
  cost_advantage_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN typical_delivered_cost_remote > 0 AND goods_delivered_cost_remote > 0
      THEN ROUND(100.0 * (1.0 - goods_delivered_cost_remote / typical_delivered_cost_remote), 1)
      ELSE NULL
    END
  ) STORED,

  -- Lifecycle
  expected_lifespan_months INTEGER,        -- Design lifespan
  warranty_months INTEGER,
  mean_time_to_failure_months INTEGER,     -- From field data
  common_failure_modes TEXT[],
  maintenance_interval_months INTEGER,

  -- Physical
  weight_kg NUMERIC,
  volume_m3 NUMERIC,                       -- For freight costing
  flat_packable BOOLEAN DEFAULT false,
  assembly_time_minutes INTEGER,

  -- Specs
  specs JSONB DEFAULT '{}'::JSONB,         -- Flexible product specs

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. GOODS_SUPPLY_ROUTES — How things get to communities
-- ============================================================================
-- Each route: origin → staging → last-mile → community
-- Cost modelling per route lets us optimize procurement.

CREATE TABLE IF NOT EXISTS goods_supply_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Route definition
  community_id UUID REFERENCES goods_communities(id) ON DELETE CASCADE,
  route_name TEXT NOT NULL,                -- "Darwin-Katherine-Tennant Creek road"
  is_primary BOOLEAN DEFAULT false,

  -- Legs
  origin_city TEXT NOT NULL,               -- "Melbourne", "Darwin"
  staging_hub TEXT,                        -- "Alice Springs depot", "Darwin warehouse"
  last_mile_origin TEXT,                   -- Where last-mile starts
  last_mile_method TEXT                    -- "road", "barge", "charter_flight", "mail_plane"
    CHECK (last_mile_method IN ('road', 'barge', 'charter_flight', 'mail_plane', 'mixed')),

  -- Cost model
  freight_cost_per_kg NUMERIC,
  freight_cost_per_m3 NUMERIC,
  minimum_order_cost NUMERIC,              -- Minimum freight charge
  typical_lead_time_days INTEGER,
  seasonal_access TEXT,                    -- "year_round", "dry_season_only", "wet_season_restricted"
    CHECK (seasonal_access IN ('year_round', 'dry_season_only', 'wet_season_restricted')),

  -- Per-product delivered cost (calculated by agent)
  delivered_cost_per_bed NUMERIC,
  delivered_cost_per_washer NUMERIC,
  delivered_cost_per_fridge NUMERIC,

  -- Reliability
  reliability_score NUMERIC,               -- 0-100
  notes TEXT,

  -- Metadata
  last_costed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goods_supply_routes_community ON goods_supply_routes(community_id);

-- ============================================================================
-- 4. GOODS_PROCUREMENT_ENTITIES — Who buys for each community
-- ============================================================================
-- Links gs_entities (CivicGraph) to goods_communities.
-- These are the stores, health services, housing orgs that procure goods.

CREATE TABLE IF NOT EXISTS goods_procurement_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  community_id UUID REFERENCES goods_communities(id) ON DELETE CASCADE,
  entity_id UUID,                          -- FK to gs_entities.id (not enforced, cross-system)
  gs_id TEXT,                              -- gs_entities.gs_id for display

  -- Entity details (denormalized for workspace)
  entity_name TEXT NOT NULL,
  abn TEXT,
  entity_type TEXT,                         -- "indigenous_corp", "charity", "company"
  buyer_role TEXT NOT NULL                  -- What they do in the community
    CHECK (buyer_role IN ('store', 'health_service', 'housing_provider', 'council',
                          'education', 'aged_care', 'disability_service', 'land_council',
                          'art_centre', 'community_org', 'government', 'other')),

  -- Procurement intelligence
  procurement_method TEXT                   -- How they buy
    CHECK (procurement_method IN ('direct', 'tender', 'panel', 'grant_funded', 'unknown')),
  estimated_annual_spend NUMERIC,          -- On goods in our categories
  current_supplier TEXT,                    -- Who they buy from now
  contract_cycle TEXT,                      -- "annual", "biennial", "ad_hoc"

  -- Relationship
  relationship_status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (relationship_status IN ('prospect', 'contacted', 'warm', 'active', 'customer', 'churned')),
  contact_surface TEXT,                     -- How to reach them
  last_contact_date TIMESTAMPTZ,

  -- Goods fit
  product_fit TEXT[],                       -- ["bed", "washer", "fridge"]
  fit_score NUMERIC,                        -- 0-100 relevance score
  next_action TEXT,

  -- CivicGraph enrichment
  govt_contract_count INTEGER,
  govt_contract_value NUMERIC,
  is_community_controlled BOOLEAN DEFAULT false,
  website TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goods_procurement_entities_community ON goods_procurement_entities(community_id);
CREATE INDEX idx_goods_procurement_entities_gs_id ON goods_procurement_entities(gs_id);
CREATE INDEX idx_goods_procurement_entities_abn ON goods_procurement_entities(abn);
CREATE INDEX idx_goods_procurement_entities_role ON goods_procurement_entities(buyer_role);
CREATE INDEX idx_goods_procurement_entities_status ON goods_procurement_entities(relationship_status);

-- ============================================================================
-- 5. GOODS_ASSET_LIFECYCLE — Synced from Goods Supabase
-- ============================================================================
-- Mirror of Goods asset data with lifecycle analytics.
-- Synced by goods-lifecycle-sync agent.

CREATE TABLE IF NOT EXISTS goods_asset_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- From Goods
  goods_asset_id TEXT NOT NULL UNIQUE,     -- assets.unique_id from Goods DB
  product_slug TEXT,                        -- Maps to goods_products.slug
  community_id UUID REFERENCES goods_communities(id),

  -- Identity
  asset_name TEXT,
  product_type TEXT,                        -- "Basket Bed", "ID Washing Machine", "Stretch Bed"
  community_name TEXT NOT NULL,
  household TEXT,

  -- Lifecycle
  deployed_at TIMESTAMPTZ,
  last_checkin_at TIMESTAMPTZ,
  last_ticket_at TIMESTAMPTZ,
  current_status TEXT DEFAULT 'active'
    CHECK (current_status IN ('active', 'needs_repair', 'damaged', 'missing', 'replaced', 'end_of_life')),

  -- Age analysis
  age_months INTEGER GENERATED ALWAYS AS (
    CASE WHEN deployed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (NOW() - deployed_at)) / 2592000  -- seconds in 30 days
      ELSE NULL
    END
  ) STORED,
  months_since_checkin INTEGER GENERATED ALWAYS AS (
    CASE WHEN last_checkin_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (NOW() - last_checkin_at)) / 2592000
      ELSE NULL
    END
  ) STORED,
  is_overdue BOOLEAN GENERATED ALWAYS AS (
    last_checkin_at IS NULL OR last_checkin_at < NOW() - INTERVAL '6 months'
  ) STORED,

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
  replacement_product_slug TEXT,           -- What to replace it with

  -- Metadata
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goods_asset_lifecycle_community ON goods_asset_lifecycle(community_id);
CREATE INDEX idx_goods_asset_lifecycle_status ON goods_asset_lifecycle(current_status);
CREATE INDEX idx_goods_asset_lifecycle_overdue ON goods_asset_lifecycle(is_overdue) WHERE is_overdue = true;
CREATE INDEX idx_goods_asset_lifecycle_replacement ON goods_asset_lifecycle(needs_replacement) WHERE needs_replacement = true;

-- ============================================================================
-- 6. GOODS_PROCUREMENT_SIGNALS — Auto-generated procurement opportunities
-- ============================================================================
-- When assets age out, when demand signals emerge, when funding opens —
-- the system generates procurement signals that flow to the workspace.

CREATE TABLE IF NOT EXISTS goods_procurement_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What triggered this signal
  signal_type TEXT NOT NULL
    CHECK (signal_type IN (
      'asset_end_of_life',        -- Asset needs replacement
      'demand_unmet',             -- Community has demand but no deployed assets
      'tender_match',             -- AusTender/state tender matches
      'grant_opened',             -- Relevant grant opened
      'buyer_reorder',            -- Known buyer reorder cycle
      'community_request',        -- Direct community request
      'ndis_thin_market',         -- NDIS thin market opportunity
      'agent_discovered'          -- Agent found an opportunity
    )),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- Links
  community_id UUID REFERENCES goods_communities(id),
  asset_id UUID REFERENCES goods_asset_lifecycle(id),
  product_id UUID REFERENCES goods_products(id),
  buyer_entity_id UUID REFERENCES goods_procurement_entities(id),

  -- Signal details
  title TEXT NOT NULL,
  description TEXT,
  estimated_value NUMERIC,
  estimated_units INTEGER,
  products_needed TEXT[],                   -- ["bed", "washer"]

  -- Funding match
  matched_grant_ids TEXT[],                 -- grant_opportunities.id matches
  matched_foundation_ids TEXT[],            -- foundations.id matches
  funding_confidence TEXT                   -- "confirmed", "likely", "possible"
    CHECK (funding_confidence IN ('confirmed', 'likely', 'possible', 'none')),

  -- Action tracking
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'actioned', 'won', 'lost', 'expired', 'dismissed')),
  assigned_to TEXT,
  action_notes TEXT,
  actioned_at TIMESTAMPTZ,

  -- GHL/CRM sync
  ghl_contact_id TEXT,
  ghl_synced_at TIMESTAMPTZ,

  -- Metadata
  source_agent TEXT,                        -- Which agent generated this
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goods_procurement_signals_community ON goods_procurement_signals(community_id);
CREATE INDEX idx_goods_procurement_signals_status ON goods_procurement_signals(status);
CREATE INDEX idx_goods_procurement_signals_priority ON goods_procurement_signals(priority);
CREATE INDEX idx_goods_procurement_signals_type ON goods_procurement_signals(signal_type);
CREATE INDEX idx_goods_procurement_signals_new ON goods_procurement_signals(created_at DESC) WHERE status = 'new';

-- ============================================================================
-- 7. MATERIALIZED VIEW — Community intelligence summary
-- ============================================================================
-- Fast read for the goods-workspace. Refreshed by agent.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_goods_community_intelligence AS
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

  -- Demand
  gc.demand_beds,
  gc.demand_washers,
  gc.demand_fridges,
  gc.demand_mattresses,
  (gc.demand_beds + gc.demand_washers + gc.demand_fridges + gc.demand_mattresses) AS total_demand_units,

  -- Deployed
  gc.assets_deployed,
  gc.assets_active,
  gc.assets_overdue,

  -- Local ecosystem
  gc.buyer_entity_count,
  gc.community_controlled_org_count,
  gc.total_local_entities,
  gc.total_govt_contract_value,

  -- Supply chain
  gc.nearest_staging_hub,
  gc.freight_corridor,
  gc.estimated_freight_cost_per_kg,
  gc.last_mile_method,

  -- Active signals
  (SELECT COUNT(*) FROM goods_procurement_signals gps
   WHERE gps.community_id = gc.id AND gps.status = 'new') AS active_signals,

  -- Procurement entities
  (SELECT COUNT(*) FROM goods_procurement_entities gpe
   WHERE gpe.community_id = gc.id AND gpe.relationship_status IN ('warm', 'active', 'customer')) AS warm_buyers,

  -- Lifecycle
  (SELECT COUNT(*) FROM goods_asset_lifecycle gal
   WHERE gal.community_id = gc.id AND gal.needs_replacement = true) AS assets_needing_replacement,

  -- Data quality
  gc.data_quality_score,
  gc.last_profiled_at,
  gc.proof_line

FROM goods_communities gc
ORDER BY gc.priority DESC, gc.community_name;

CREATE UNIQUE INDEX idx_mv_goods_community_intelligence_id ON mv_goods_community_intelligence(id);

-- ============================================================================
-- 8. SEED PRODUCTS
-- ============================================================================

INSERT INTO goods_products (slug, name, category, status, bom_description, material_cost_aud, manufacturing_cost_aud, wholesale_price_aud, typical_retail_price_aud, typical_delivered_cost_remote, goods_delivered_cost_remote, expected_lifespan_months, warranty_months, weight_kg, flat_packable, assembly_time_minutes, common_failure_modes, specs)
VALUES
(
  'stretch-bed',
  'Stretch Bed',
  'bed',
  'active',
  'Recycled HDPE plastic panels (legs) + 2x galvanised steel poles (26.9mm OD × 2.6mm wall) + heavy-duty Australian canvas (sleeping surface)',
  85.00,    -- ~$85 materials (20kg HDPE + steel + canvas)
  165.00,   -- Manufacturing labour + factory
  450.00,   -- Goods wholesale
  NULL,     -- No direct retail equivalent — mattresses are the comparison
  1500.00,  -- Incumbent: mattress + frame delivered remote = ~$1500
  550.00,   -- Goods delivered cost to remote community
  120,      -- 10 year design lifespan
  60,       -- 5 year warranty
  26.0,
  true,
  5,
  ARRAY['canvas wear', 'pole connection loosening'],
  '{"capacity_kg": 200, "dimensions_cm": "188x92x25", "recycled_plastic_kg": 20}'::JSONB
),
(
  'id-washing-machine',
  'Pakkimjalki Kari Washing Machine',
  'washer',
  'prototype',
  'Commercial-grade Speed Queen base + remote-hardened modifications',
  800.00,   -- Speed Queen base + mods materials
  400.00,   -- Assembly + hardening
  2200.00,  -- Goods price
  3500.00,  -- Alice Springs supplier price
  5000.00,  -- Incumbent: delivered + install remote (current market $3M/yr in Alice Springs alone)
  2800.00,  -- Goods delivered + installed
  60,       -- 5 year target
  24,       -- 2 year warranty
  75.0,
  false,
  30,
  ARRAY['drum bearing failure', 'electronic board failure', 'water inlet blockage', 'power surge damage'],
  '{"base_model": "Speed Queen", "hardening": "remote_conditions", "named_by": "Elder Dianne Stokes, Warumungu"}'::JSONB
),
(
  'remote-fridge',
  'Remote Community Fridge',
  'fridge',
  'planned',
  'Commercial-grade fridge with remote hardening (dust, heat, power fluctuation)',
  600.00,
  300.00,
  1800.00,
  2500.00,
  4000.00,  -- Delivered remote by incumbent
  2200.00,  -- Goods target
  84,       -- 7 year target
  24,
  85.0,
  false,
  15,
  ARRAY['compressor failure (heat)', 'power surge damage', 'seal degradation (dust)', 'transport damage'],
  '{"hardening": ["dust_sealed", "voltage_regulation", "heat_rated_45c"]}'::JSONB
),
(
  'remote-mattress',
  'Remote Community Mattress',
  'mattress',
  'planned',
  'High-density foam core with washable, replaceable cover system',
  45.00,
  35.00,
  180.00,
  300.00,
  800.00,   -- Incumbent delivered remote
  280.00,   -- Goods target (pairs with Stretch Bed)
  24,       -- 2 year expected (vs 3 months for cheap incumbent)
  12,
  12.0,
  true,     -- Vacuum packed
  0,
  ARRAY['foam degradation', 'cover damage', 'moisture damage'],
  '{"type": "high_density_foam", "cover": "washable_replaceable", "vacuum_packable": true}'::JSONB
);

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION goods_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'goods_communities', 'goods_products', 'goods_supply_routes',
    'goods_procurement_entities', 'goods_asset_lifecycle', 'goods_procurement_signals'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || tbl || '_updated_at', tbl);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION goods_update_timestamp()',
      'trg_' || tbl || '_updated_at', tbl
    );
  END LOOP;
END $$;

-- ============================================================================
-- 10. REFRESH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_goods_intelligence()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_goods_community_intelligence;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DONE
-- ============================================================================
