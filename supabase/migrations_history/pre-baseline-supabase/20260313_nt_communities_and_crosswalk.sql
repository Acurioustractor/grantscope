-- GrantScope: NT community reference layer and buyer/service crosswalk
-- Seeds the official NT remote community baseline plus Goods-specific service clusters.

CREATE TABLE IF NOT EXISTS nt_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_name TEXT NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  state TEXT NOT NULL DEFAULT 'NT',
  region_label TEXT,
  service_region TEXT,
  land_council TEXT,
  postcode TEXT,
  remoteness TEXT NOT NULL DEFAULT 'Remote',
  is_official_remote_community BOOLEAN NOT NULL DEFAULT true,
  goods_focus_priority TEXT NOT NULL DEFAULT 'background',
  goods_signal_name TEXT,
  goods_signal_type TEXT NOT NULL DEFAULT 'none',
  known_buyer_name TEXT,
  demand_beds INTEGER NOT NULL DEFAULT 0,
  demand_washers INTEGER NOT NULL DEFAULT 0,
  proof_line TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nt_communities_priority_check CHECK (
    goods_focus_priority IN ('background', 'monitor', 'lead')
  ),
  CONSTRAINT nt_communities_signal_type_check CHECK (
    goods_signal_type IN ('none', 'exact', 'regional_service_hub', 'homelands_cluster', 'island_cluster')
  )
);

CREATE INDEX IF NOT EXISTS idx_nt_communities_official
  ON nt_communities(is_official_remote_community);

CREATE INDEX IF NOT EXISTS idx_nt_communities_service_region
  ON nt_communities(service_region);

CREATE INDEX IF NOT EXISTS idx_nt_communities_goods_focus
  ON nt_communities(goods_focus_priority);

CREATE INDEX IF NOT EXISTS idx_nt_communities_aliases
  ON nt_communities
  USING GIN (aliases);

DROP TRIGGER IF EXISTS nt_communities_updated_at ON nt_communities;

CREATE TRIGGER nt_communities_updated_at
  BEFORE UPDATE ON nt_communities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO nt_communities (
  community_name,
  aliases,
  region_label,
  service_region,
  land_council,
  postcode,
  is_official_remote_community,
  goods_focus_priority,
  goods_signal_name,
  goods_signal_type,
  known_buyer_name,
  demand_beds,
  demand_washers,
  proof_line,
  notes
)
VALUES
('Milikapiti', ARRAY['Snake Bay'], 'Tiwi Islands', 'Tiwi Islands', 'Tiwi Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Pirlangimpi', ARRAY['Garden Point'], 'Tiwi Islands', 'Tiwi Islands', 'Tiwi Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Wurrumiyanga', ARRAY['Nguiu'], 'Tiwi Islands', 'Tiwi Islands', 'Tiwi Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Angurugu', ARRAY[]::TEXT[], 'Groote Archipelago', 'Groote Archipelago', 'Anindilyakwa Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Umbakumba', ARRAY[]::TEXT[], 'Groote Archipelago', 'Groote Archipelago', 'Anindilyakwa Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Milyakburra', ARRAY['Bickerton Island'], 'Groote Archipelago', 'Groote Archipelago', 'Anindilyakwa Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Galiwinku', ARRAY['Elcho Island'], 'East Arnhem', 'East Arnhem', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Gapuwiyak', ARRAY[]::TEXT[], 'East Arnhem', 'East Arnhem', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Gunyangara', ARRAY['Ski Beach'], 'East Arnhem', 'East Arnhem', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Milingimbi', ARRAY[]::TEXT[], 'East Arnhem', 'East Arnhem', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Ramingining', ARRAY[]::TEXT[], 'East Arnhem', 'East Arnhem', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Yirrkala', ARRAY[]::TEXT[], 'East Arnhem', 'East Arnhem', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Numbulwar', ARRAY[]::TEXT[], 'East Arnhem', 'East Arnhem', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Gunbalanya', ARRAY['Oenpelli'], 'West Arnhem', 'West Arnhem', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Minjilang', ARRAY['Croker Island'], 'West Arnhem', 'West Arnhem', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Warruwi', ARRAY[]::TEXT[], 'West Arnhem', 'West Arnhem', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Maningrida', ARRAY[]::TEXT[], 'West Arnhem', 'West Arnhem', 'Northern Land Council', '0822', TRUE, 'lead', 'Maningrida', 'exact', 'The Arnhem Land Progress Aboriginal Corporation', 30, 15, '24 assets deployed already; the market around homelands, stores, and councils is broader than current output.', NULL),
('Barunga', ARRAY['Bamyili'], 'Katherine & Roper', 'Katherine & Roper', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Beswick', ARRAY['Wugularr'], 'Katherine & Roper', 'Katherine & Roper', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Binjari', ARRAY[]::TEXT[], 'Katherine & Roper', 'Katherine & Roper', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Bulman', ARRAY[]::TEXT[], 'Katherine & Roper', 'Katherine & Roper', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Jilkminggan', ARRAY['Duck Creek'], 'Katherine & Roper', 'Katherine & Roper', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Lajamanu', ARRAY[]::TEXT[], 'Katherine & Roper', 'Katherine & Roper', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Manyallaluk', ARRAY['Eva Valley'], 'Katherine & Roper', 'Katherine & Roper', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Minyerri', ARRAY['Hodgson Downs'], 'Katherine & Roper', 'Katherine & Roper', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Ngukurr', ARRAY[]::TEXT[], 'Katherine & Roper', 'Katherine & Roper', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Rittarangu', ARRAY[]::TEXT[], 'Katherine & Roper', 'Katherine & Roper', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Weemol', ARRAY[]::TEXT[], 'Katherine & Roper', 'Katherine & Roper', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Nauiyu', ARRAY['Daly River'], 'Daly / Wadeye', 'Daly / Wadeye', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Nganmarriyanga', ARRAY['Palumpa'], 'Daly / Wadeye', 'Daly / Wadeye', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Peppimenarti', ARRAY[]::TEXT[], 'Daly / Wadeye', 'Daly / Wadeye', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Wadeye', ARRAY['Port Keats'], 'Daly / Wadeye', 'Daly / Wadeye', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Belyuen', ARRAY['Delissaville'], 'Daly / Wadeye', 'Daly / Wadeye', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Amanbidji', ARRAY['Kildurk'], 'Big Rivers / Victoria River', 'Big Rivers / Victoria River', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Bulla', ARRAY[]::TEXT[], 'Big Rivers / Victoria River', 'Big Rivers / Victoria River', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Daguragu', ARRAY['Wattie Creek'], 'Big Rivers / Victoria River', 'Big Rivers / Victoria River', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Kalkarindji', ARRAY['Wave Hill'], 'Big Rivers / Victoria River', 'Big Rivers / Victoria River', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Pigeon Hole', ARRAY['Nitjpurru'], 'Big Rivers / Victoria River', 'Big Rivers / Victoria River', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Yarralin', ARRAY[]::TEXT[], 'Big Rivers / Victoria River', 'Big Rivers / Victoria River', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Robinson River', ARRAY[]::TEXT[], 'Big Rivers / Victoria River', 'Big Rivers / Victoria River', 'Northern Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Ali Curung', ARRAY[]::TEXT[], 'Barkly', 'Barkly', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Alpurrurulam', ARRAY[]::TEXT[], 'Barkly', 'Barkly', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Ampilatwatja', ARRAY[]::TEXT[], 'Barkly', 'Barkly', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Canteen Creek', ARRAY[]::TEXT[], 'Barkly', 'Barkly', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Tara', ARRAY[]::TEXT[], 'Barkly', 'Barkly', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Wutunugurra', ARRAY[]::TEXT[], 'Barkly', 'Barkly', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Kybrook Farm', ARRAY[]::TEXT[], 'Barkly', 'Barkly', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Amoonguna', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Areyonga', ARRAY['Utju'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Atitjere', ARRAY['Harts Range'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Engawala', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Finke', ARRAY['Aputula'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Haasts Bluff', ARRAY['Ikuntji'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Hermannsburg', ARRAY['Ntaria'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Imangara', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Imanpa', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Kaltukatjara', ARRAY['Docker River'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Kintore', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Laramba', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Mt Liebig', ARRAY['Watiyawanu'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Nturiya', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Nyirripi', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Papunya', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Pmara Jutunta', ARRAY['Six Mile'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Santa Teresa', ARRAY['Ltyentye Apurte'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Titjikala', ARRAY['Maryvale'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Wallace Rockhole', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Willowra', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Wilora', ARRAY['Stirling'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Yuelamu', ARRAY['Mount Allan'], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Yuendumu', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Acacia Larrakia', ARRAY[]::TEXT[], 'Central Australia', 'Central Australia', 'Central Land Council', NULL, TRUE, 'background', NULL, 'none', NULL, 0, 0, NULL, NULL),
('Tennant Creek', ARRAY[]::TEXT[], 'Barkly service hub', 'Barkly service hub', 'Central Land Council', '0860', FALSE, 'lead', 'Tennant Creek', 'regional_service_hub', 'Anyinginyi Health Aboriginal Corporation', 40, 20, '146 tracked assets and repeat demand prove the bed line has a real NT service market.', 'Regional hub and strongest current Goods service proof in the Barkly.'),
('Utopia Homelands', ARRAY[]::TEXT[], 'Central Australia homelands cluster', 'Central Australia homelands cluster', 'Central Land Council', '0872', FALSE, 'lead', 'Utopia Homelands', 'homelands_cluster', 'CENTREBUILD PTY LTD', 107, 0, 'A 107-bed order pathway already exists via Centrebuild/Centrecorp for Utopia Homelands.', 'Homelands cluster rather than a single official community; useful for Goods production planning.'),
('Groote Eylandt', ARRAY[]::TEXT[], 'Groote Archipelago service cluster', 'Groote Archipelago service cluster', 'Anindilyakwa Land Council', '0883', FALSE, 'lead', 'Groote Eylandt', 'island_cluster', 'THE TRUSTEE FOR GROOTE EYLANDT ABORIGINAL TRUST', 500, 300, 'Documented request for 500 mattresses and 300 washing machines makes Groote a flagship demand signal.', 'Service cluster spanning Angurugu, Umbakumba, and Milyakburra.')
ON CONFLICT (community_name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  region_label = EXCLUDED.region_label,
  service_region = EXCLUDED.service_region,
  land_council = EXCLUDED.land_council,
  postcode = EXCLUDED.postcode,
  is_official_remote_community = EXCLUDED.is_official_remote_community,
  goods_focus_priority = EXCLUDED.goods_focus_priority,
  goods_signal_name = EXCLUDED.goods_signal_name,
  goods_signal_type = EXCLUDED.goods_signal_type,
  known_buyer_name = EXCLUDED.known_buyer_name,
  demand_beds = EXCLUDED.demand_beds,
  demand_washers = EXCLUDED.demand_washers,
  proof_line = EXCLUDED.proof_line,
  notes = EXCLUDED.notes,
  updated_at = NOW();

CREATE OR REPLACE VIEW v_nt_community_entity_matches AS
WITH community_patterns AS (
  SELECT
    c.id AS community_id,
    c.community_name,
    c.region_label,
    c.service_region,
    c.land_council,
    c.postcode AS community_postcode,
    c.is_official_remote_community,
    c.goods_focus_priority,
    c.goods_signal_name,
    c.goods_signal_type,
    c.known_buyer_name,
    alias_name,
    '(^|[^a-z0-9])' || regexp_replace(lower(alias_name), '[^a-z0-9]+', '[^a-z0-9]+', 'g') || '([^a-z0-9]|$)' AS alias_regex
  FROM nt_communities c
  CROSS JOIN LATERAL (
    SELECT DISTINCT trim(value) AS alias_name
    FROM unnest(array_prepend(c.community_name, c.aliases)) AS value
    WHERE trim(value) <> ''
  ) aliases
)
SELECT DISTINCT ON (cp.community_id, e.id)
  cp.community_id,
  cp.community_name,
  cp.region_label,
  cp.service_region,
  cp.land_council,
  cp.community_postcode,
  cp.is_official_remote_community,
  cp.goods_focus_priority,
  cp.goods_signal_name,
  cp.goods_signal_type,
  cp.known_buyer_name,
  cp.alias_name,
  e.id AS entity_id,
  e.gs_id,
  e.canonical_name AS entity_name,
  e.abn,
  e.website,
  e.entity_type,
  e.sector,
  e.sub_sector,
  e.postcode AS entity_postcode,
  e.lga_name AS entity_lga_name,
  e.is_community_controlled,
  e.source_count,
  CASE
    WHEN lower(e.canonical_name) = lower(cp.alias_name) THEN 'exact_name'
    WHEN lower(e.canonical_name) = lower(cp.community_name) THEN 'exact_community'
    WHEN lower(e.canonical_name) ~ ('(^|[^a-z0-9])' || regexp_replace(lower(cp.community_name), '[^a-z0-9]+', '[^a-z0-9]+', 'g') || '([^a-z0-9]|$)') THEN 'community_word'
    ELSE 'alias_word'
  END AS match_method,
  (
    CASE
      WHEN lower(e.canonical_name) = lower(cp.community_name) THEN 40
      WHEN lower(e.canonical_name) = lower(cp.alias_name) THEN 36
      WHEN lower(e.canonical_name) ~ ('(^|[^a-z0-9])' || regexp_replace(lower(cp.community_name), '[^a-z0-9]+', '[^a-z0-9]+', 'g') || '([^a-z0-9]|$)') THEN 30
      ELSE 22
    END
    + LEAST(COALESCE(e.source_count, 0), 8)
    + CASE WHEN e.is_community_controlled THEN 8 ELSE 0 END
  ) AS match_score
FROM community_patterns cp
JOIN gs_entities e
  ON e.state = 'NT'
 AND lower(e.canonical_name) ~ cp.alias_regex
ORDER BY cp.community_id, e.id, length(cp.alias_name) DESC, COALESCE(e.source_count, 0) DESC;

CREATE OR REPLACE VIEW v_nt_community_buyer_crosswalk AS
SELECT
  m.community_id,
  m.community_name,
  m.region_label,
  m.service_region,
  m.land_council,
  m.community_postcode,
  m.is_official_remote_community,
  m.goods_focus_priority,
  m.goods_signal_name,
  m.goods_signal_type,
  m.known_buyer_name,
  m.alias_name,
  m.entity_id,
  m.gs_id,
  m.entity_name AS buyer_name,
  m.abn,
  m.website,
  m.entity_type,
  m.sector,
  m.sub_sector,
  m.entity_postcode,
  m.entity_lga_name,
  m.is_community_controlled,
  m.source_count,
  m.match_method,
  m.match_score,
  CASE
    WHEN m.entity_name ~* '(outback stores|store|supermarket|progress)' THEN 'store'
    WHEN m.entity_name ~* '(health|medical|clinic|health board|health service)' THEN 'health'
    WHEN m.entity_name ~* '(housing)' THEN 'housing'
    WHEN m.entity_name ~* '(council|regional council|shire)' THEN 'council'
    ELSE 'other_service'
  END AS buyer_type
FROM v_nt_community_entity_matches m
WHERE m.entity_name ~* '(outback stores|store|supermarket|progress|health|medical|clinic|health board|health service|housing|council|regional council|shire)';

CREATE OR REPLACE VIEW v_nt_community_procurement_summary AS
WITH entity_counts AS (
  SELECT
    community_id,
    COUNT(DISTINCT entity_id) AS entity_match_count,
    COUNT(DISTINCT entity_id) FILTER (WHERE is_community_controlled) AS community_controlled_match_count
  FROM v_nt_community_entity_matches
  GROUP BY community_id
),
buyer_counts AS (
  SELECT
    community_id,
    COUNT(DISTINCT entity_id) AS buyer_match_count,
    COUNT(DISTINCT entity_id) FILTER (WHERE buyer_type = 'store') AS store_count,
    COUNT(DISTINCT entity_id) FILTER (WHERE buyer_type = 'health') AS health_count,
    COUNT(DISTINCT entity_id) FILTER (WHERE buyer_type = 'housing') AS housing_count,
    COUNT(DISTINCT entity_id) FILTER (WHERE buyer_type = 'council') AS council_count,
    COUNT(DISTINCT entity_id) FILTER (WHERE buyer_type = 'other_service') AS other_service_count,
    ARRAY_AGG(buyer_name ORDER BY match_score DESC) AS top_buyer_names
  FROM v_nt_community_buyer_crosswalk
  GROUP BY community_id
)
SELECT
  c.id AS community_id,
  c.community_name,
  c.region_label,
  c.service_region,
  c.land_council,
  c.postcode,
  c.is_official_remote_community,
  c.goods_focus_priority,
  c.goods_signal_name,
  c.goods_signal_type,
  c.known_buyer_name,
  COALESCE(ec.entity_match_count, 0) AS entity_match_count,
  COALESCE(bc.buyer_match_count, 0) AS buyer_match_count,
  COALESCE(bc.store_count, 0) AS store_count,
  COALESCE(bc.health_count, 0) AS health_count,
  COALESCE(bc.housing_count, 0) AS housing_count,
  COALESCE(bc.council_count, 0) AS council_count,
  COALESCE(bc.other_service_count, 0) AS other_service_count,
  COALESCE(ec.community_controlled_match_count, 0) AS community_controlled_match_count,
  COALESCE(bc.top_buyer_names, ARRAY[]::TEXT[]) AS top_buyer_names,
  (c.postcode IS NULL) AS needs_postcode_enrichment,
  (c.goods_signal_name IS NOT NULL OR c.known_buyer_name IS NOT NULL OR c.proof_line IS NOT NULL) AS has_goods_signal
FROM nt_communities c
LEFT JOIN entity_counts ec ON ec.community_id = c.id
LEFT JOIN buyer_counts bc ON bc.community_id = c.id
ORDER BY c.is_official_remote_community DESC, c.community_name;
