-- entity_xref v2: converted from MV to table with staged population
-- The MV refresh timed out (>5min) because 6 UNION ALL branches each scanned
-- gs_entities (566K rows) + TRADING_NAME unnest from 18.5M ABR rows.
-- Solution: regular table populated in stages by refresh-entity-xref.mjs
--
-- Run: node --env-file=.env scripts/refresh-entity-xref.mjs

DROP MATERIALIZED VIEW IF EXISTS mv_entity_xref;

CREATE TABLE IF NOT EXISTS entity_xref (
    entity_id UUID NOT NULL,
    gs_id TEXT NOT NULL,
    canonical_name TEXT,
    identifier_type TEXT NOT NULL,
    identifier_value TEXT NOT NULL,
    source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_xref_entity_id ON entity_xref (entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_xref_identifier ON entity_xref (identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_entity_xref_value ON entity_xref (identifier_value);
CREATE INDEX IF NOT EXISTS idx_entity_xref_gs_id ON entity_xref (gs_id);
