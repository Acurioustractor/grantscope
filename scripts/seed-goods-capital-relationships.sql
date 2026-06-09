-- Goods Command Center — curated capital + production-partner relationships.
-- Source: Goods Asset Register strategy docs (GO_TO_MARKET_THOUSANDS_2026.md,
--   Catalysing_Impact_Application_DRAFT.md, 2026-05-30-goods-loi-close-plan.md).
-- These are NOT in GHL pipelines and have no feeding table — they are the
-- repayable-finance / impact-investor / production-partner / strategic-buyer
-- relationships from the capital strategy. Stages are a read of the narrative
-- status (refine via the in-app editor). Dollar figures are ASK/LOI size (held
-- in notes), NOT received — so total_received_aud = 0, has_prior_support = false.
-- Idempotent: ON CONFLICT (dedupe_key) DO UPDATE.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 6543 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f scripts/seed-goods-capital-relationships.sql

WITH cap(display_name, relationship_type, stage, alignment_score, last_touch_at, notes, next_action) AS (
  VALUES
  ('Social Enterprise Finance Australia (SEFA)', 'repayable_finance', 'proposal', 80, '2026-05-30'::timestamptz,
   'ASK: $300K concessional working-capital loan (LOI in flight), 4-6%, draw Nov 2026. Contact Joel Bird; term sheet pending (23 comms).',
   'Close the LOI: confirm term sheet + draw schedule'),
  ('Indigenous Business Australia (IBA)', 'repayable_finance', 'researching', 80, NULL,
   'ASK: scale-up loan. IBA mandate funds Indigenous manufacturing; apply once 51% First Nations structure in place (planned Q4 2026).',
   'Confirm 51% structure, then open the IBA application'),
  ('Giant Leap', 'impact_investor', 'researching', 70, NULL,
   'Impact VC; potential fit, warming conversation.',
   'Qualify mandate fit + ticket size'),
  ('Oonchiumpa Bloomfield Family Trust', 'impact_investor', 'committed', 90, NULL,
   'EQUITY: co-founder, 26% stake in the 51% First Nations structure. Alice Springs; cultural advisors at university research rates.',
   'Formalise the shareholders agreement for the 51% structure'),
  ('Aboriginal Investment NT', 'impact_investor', 'in_conversation', 85, NULL,
   'EQUITY: 15% co-investment via the Aboriginal Benefits Account; production-facility co-investment in the 51% structure.',
   'Progress equity terms for the production facility'),
  ('Aboriginal Hostels Limited (AHL)', 'buyer', 'proposal', 85, NULL,
   'Commonwealth body; ~17,000 beds in service, ~2,400/yr replacement cycle. Tennant Creek pilot (20 Stretch Beds); standing-offer panel target Jun 2026.',
   'Convert the Tennant Creek pilot into a standing-offer panel place'),
  ('Outback Stores', 'buyer', 'identified', 75, NULL,
   'Remote retailer ~50+ stores NT/WA/QLD; ~$3M/yr Alice Springs washer market. Pakkimjalki Kari washing-machine line pitch.',
   'Open outreach: pitch the washing-machine line'),
  ('Arnhem Land Progress Aboriginal Corporation (ALPA)', 'production_partner', 'researching', 80, NULL,
   'Dual channel: 30 stores Arnhem Land (retail) + $14M NT housing contractor (fitout). Stretch Bed stock + house-fitout partnership.',
   'Scope the retail + fitout dual-channel partnership'),
  ('WINYA Indigenous Furniture', 'production_partner', 'researching', 75, NULL,
   'Indigenous-owned, Supply Nation; proven model ($950K federal across 36 contracts). Potential collaborator / blueprint.',
   'Explore a collaboration / shared-supply model'),
  ('NACCHO', 'supporter', 'in_conversation', 80, NULL,
   'Peak body (144 ACCHOs); clinical case (scabies to RHD, $1:$6 ROI). Draft specification + 3-ACCHO pilot planned; secondary-buyer endorsement.',
   'Land the peak-body endorsement + confirm the 3-ACCHO pilot')
)
INSERT INTO goods_relationships
  (relationship_type, display_name, stage, alignment_score, last_touch_at,
   total_received_aud, has_prior_support, next_action, warmth_computed, source_refs, notes)
SELECT
  c.relationship_type, c.display_name, c.stage, c.alignment_score, c.last_touch_at,
  0, false, c.next_action,
  goods_compute_warmth(c.stage, c.last_touch_at, 0, c.alignment_score, false, 0),
  jsonb_build_object('source', 'goods_asset_register'),
  c.notes
FROM cap c
ON CONFLICT (dedupe_key) DO UPDATE SET
  stage           = EXCLUDED.stage,
  alignment_score = EXCLUDED.alignment_score,
  last_touch_at   = COALESCE(EXCLUDED.last_touch_at, goods_relationships.last_touch_at),
  next_action     = COALESCE(EXCLUDED.next_action, goods_relationships.next_action),
  notes           = COALESCE(EXCLUDED.notes, goods_relationships.notes),
  warmth_computed = EXCLUDED.warmth_computed,
  source_refs     = goods_relationships.source_refs || EXCLUDED.source_refs,
  updated_at      = now();
