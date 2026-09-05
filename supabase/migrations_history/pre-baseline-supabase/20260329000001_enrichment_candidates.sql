-- Enrichment candidates staging table
-- All external enrichment data lands here first, gated by confidence before promotion to production tables.
-- Supports Macrocosmos SN13, future TLSNotary attestations, and any external data source.

CREATE TABLE IF NOT EXISTS enrichment_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES gs_entities(id),
  source text NOT NULL,                    -- 'sn13_gravity', 'sn13_ondemand', 'tlsnotary', 'djinn'
  source_query jsonb,                      -- The query params that produced this result
  platform text,                           -- 'x', 'reddit', 'youtube', 'web'
  raw_data jsonb NOT NULL,                 -- Full response from external source
  extracted_fields jsonb,                  -- Parsed fields: { website_url, social_handle, description, ... }
  confidence numeric(3,2) DEFAULT 0.0,     -- 0.00-1.00, set by scoring logic
  status text DEFAULT 'pending',           -- pending | accepted | rejected | review
  reviewed_by text,                        -- 'auto' or user id
  reviewed_at timestamptz,
  rejection_reason text,
  provenance jsonb,                        -- { retrieved_at, api_version, query_hash, ... }
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ec_entity ON enrichment_candidates(entity_id);
CREATE INDEX idx_ec_status ON enrichment_candidates(status);
CREATE INDEX idx_ec_source ON enrichment_candidates(source);
CREATE INDEX idx_ec_confidence ON enrichment_candidates(confidence) WHERE status = 'pending';

-- View for quick review queue
CREATE OR REPLACE VIEW v_enrichment_review_queue AS
SELECT
  ec.id,
  ec.entity_id,
  e.canonical_name AS entity_name,
  e.entity_type,
  ec.source,
  ec.platform,
  ec.confidence,
  ec.extracted_fields,
  ec.created_at
FROM enrichment_candidates ec
JOIN gs_entities e ON e.id = ec.entity_id
WHERE ec.status = 'pending'
ORDER BY ec.confidence DESC, ec.created_at ASC;
