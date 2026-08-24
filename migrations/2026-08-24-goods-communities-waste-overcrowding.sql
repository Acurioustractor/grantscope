-- Goods communities: waste-supply + ABS overcrowding + external identifier layers
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-24-goods-communities-waste-overcrowding.sql
--
-- Why: the circular-material model (community waste -> community-owned production -> beds)
-- needs per-community waste supply and measured overcrowding alongside the existing
-- modelled demand fields. Every new fact-bearing column pairs with a *_source column so
-- rows carry provenance (honesty-label discipline from the Goods register).
-- demand_beds stays what it is: population-MODELLED need, never to be presented as demand.

ALTER TABLE goods_communities
  -- external identifiers (shared place layer)
  ADD COLUMN IF NOT EXISTS bushtel_id            text,
  ADD COLUMN IF NOT EXISTS bushtel_url           text,
  ADD COLUMN IF NOT EXISTS abs_iloc_code         text,  -- ABS Indigenous Location (ILOC) 2021
  ADD COLUMN IF NOT EXISTS abs_sal_code          text,  -- ABS Suburb/Locality 2021

  -- measured overcrowding (ABS Census, per-community grain; NULL until ingested with a source)
  ADD COLUMN IF NOT EXISTS occupied_dwellings          integer,
  ADD COLUMN IF NOT EXISTS overcrowded_dwellings       integer,
  ADD COLUMN IF NOT EXISTS overcrowded_pct             numeric(5,2),
  ADD COLUMN IF NOT EXISTS additional_bedrooms_needed  integer,
  ADD COLUMN IF NOT EXISTS persons_per_dwelling        numeric(5,2),
  ADD COLUMN IF NOT EXISTS overcrowding_source         text,
  ADD COLUMN IF NOT EXISTS overcrowding_as_at          date,

  -- waste / feedstock supply
  ADD COLUMN IF NOT EXISTS est_plastic_waste_tpa   numeric(10,2),  -- tonnes/yr generated (modelled)
  ADD COLUMN IF NOT EXISTS plastic_collected_tpa   numeric(10,2),  -- tonnes/yr actually collected
  ADD COLUMN IF NOT EXISTS cds_depot_distance_km   numeric(7,1),
  ADD COLUMN IF NOT EXISTS landfill_distance_km    numeric(7,1),
  ADD COLUMN IF NOT EXISTS waste_collection_operator text,
  ADD COLUMN IF NOT EXISTS waste_stockpile_flag    boolean,
  ADD COLUMN IF NOT EXISTS waste_notes             text,
  ADD COLUMN IF NOT EXISTS waste_source            text,
  ADD COLUMN IF NOT EXISTS waste_as_at             date;

COMMENT ON COLUMN goods_communities.demand_beds IS
  'Population-MODELLED bed need (est_population-derived). Modelled need, never demand. Real demand lives in signal_type/signal_source rows and the Goods register.';
COMMENT ON COLUMN goods_communities.overcrowded_dwellings IS
  'ABS Census measured figure at community (ILOC/SAL) grain. NULL = not yet ingested; do not substitute NT-wide aggregates onto community rows.';
COMMENT ON COLUMN goods_communities.est_plastic_waste_tpa IS
  'Modelled tonnes/yr of plastic waste generated locally. Usable HDPE/PP after sorting is a fraction of this; never present as feedstock.';
