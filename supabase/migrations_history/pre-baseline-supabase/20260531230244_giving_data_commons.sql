-- Australian Giving Data Commons public metadata and correction flow.

ALTER TABLE data_catalog
  ADD COLUMN IF NOT EXISTS public_export boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS licence text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_owner text,
  ADD COLUMN IF NOT EXISTS collection_method text,
  ADD COLUMN IF NOT EXISTS update_cadence text,
  ADD COLUMN IF NOT EXISTS public_caveat text;

CREATE INDEX IF NOT EXISTS idx_data_catalog_public_export
  ON data_catalog(public_export)
  WHERE public_export = true;

CREATE OR REPLACE VIEW v_data_catalog_latest AS
SELECT DISTINCT ON (dc.table_name)
  dc.table_name,
  dc.domain,
  dc.owner_team,
  dc.description,
  dc.source_of_truth,
  dc.pii_level,
  dc.sla_hours,
  dc.freshness_key,
  dc.provenance_field,
  dc.confidence_field,
  dc.active,
  dcs.snapshot_at,
  dcs.row_count,
  dcs.freshness_hours,
  dcs.provenance_coverage_pct,
  dcs.confidence_coverage_pct,
  dc.public_export,
  dc.licence,
  dc.source_url,
  dc.source_owner,
  dc.collection_method,
  dc.update_cadence,
  dc.public_caveat
FROM data_catalog dc
LEFT JOIN data_catalog_snapshots dcs ON dcs.table_name = dc.table_name
ORDER BY dc.table_name, dcs.snapshot_at DESC NULLS LAST;

UPDATE data_catalog
SET public_export = false
WHERE table_name IN (
  'ghl_contacts',
  'ghl_opportunities',
  'ghl_sync_log',
  'procurement_shortlists',
  'procurement_shortlist_items',
  'procurement_tasks',
  'procurement_workflow_runs'
);

INSERT INTO data_catalog (
  table_name,
  domain,
  owner_team,
  description,
  source_of_truth,
  pii_level,
  sla_hours,
  freshness_key,
  provenance_field,
  confidence_field,
  public_export,
  licence,
  source_url,
  source_owner,
  collection_method,
  update_cadence,
  public_caveat
)
VALUES
  (
    'foundation_programs',
    'funding',
    'funding',
    'Public foundation program and application pathway records.',
    true,
    'none',
    72,
    'scraped_at',
    'url',
    null,
    true,
    'Publisher website terms and CivicGraph compiled metadata.',
    'https://www.civicgraph.au/foundations',
    'Foundation publishers and CivicGraph extraction layer',
    'Public website crawl and program extraction.',
    'Daily to weekly during active crawl windows.',
    'Open status can lag publisher changes. Use the publisher page as the decision record.'
  ),
  (
    'mv_funding_by_postcode',
    'place',
    'graph',
    'Postcode-level public funding, place and community-control aggregation.',
    true,
    'none',
    168,
    null,
    null,
    null,
    true,
    'Mixed public-source licences. Check underlying datasets before reuse.',
    'https://www.civicgraph.au/places',
    'ABS-style reference sources, public funder datasets and CivicGraph aggregation layer',
    'Public source aggregation by postcode.',
    'Weekly after graph refresh.',
    'Postcodes are blunt geography and need local interpretation.'
  )
ON CONFLICT (table_name) DO UPDATE SET
  domain = EXCLUDED.domain,
  owner_team = EXCLUDED.owner_team,
  description = EXCLUDED.description,
  source_of_truth = EXCLUDED.source_of_truth,
  pii_level = EXCLUDED.pii_level,
  sla_hours = EXCLUDED.sla_hours,
  freshness_key = EXCLUDED.freshness_key,
  provenance_field = EXCLUDED.provenance_field,
  confidence_field = EXCLUDED.confidence_field,
  public_export = EXCLUDED.public_export,
  licence = EXCLUDED.licence,
  source_url = EXCLUDED.source_url,
  source_owner = EXCLUDED.source_owner,
  collection_method = EXCLUDED.collection_method,
  update_cadence = EXCLUDED.update_cadence,
  public_caveat = EXCLUDED.public_caveat,
  updated_at = now();

UPDATE data_catalog
SET
  public_export = true,
  licence = CASE table_name
    WHEN 'gs_entities' THEN 'Mixed public-source licences. Check source record before reuse.'
    WHEN 'gs_relationships' THEN 'Mixed public-source licences. Check source record before reuse.'
    WHEN 'foundations' THEN 'Mixed public-source licences. Check foundation source page before reuse.'
    WHEN 'grant_opportunities' THEN 'Mixed source licences. Check the source URL before reuse.'
    WHEN 'political_donations' THEN 'AEC public disclosure data. Check AEC terms before reuse.'
    WHEN 'austender_contracts' THEN 'AusTender public data terms. Check source URL before reuse.'
    ELSE COALESCE(licence, 'CivicGraph compiled metadata. Check source row before reuse.')
  END,
  source_url = CASE table_name
    WHEN 'gs_entities' THEN 'https://www.civicgraph.au/giving/sources'
    WHEN 'gs_relationships' THEN 'https://www.civicgraph.au/giving/sources'
    WHEN 'foundations' THEN 'https://www.acnc.gov.au/charity/charities'
    WHEN 'grant_opportunities' THEN 'https://www.civicgraph.au/grants'
    WHEN 'political_donations' THEN 'https://www.aec.gov.au/parties_and_representatives/financial_disclosure/'
    WHEN 'austender_contracts' THEN 'https://www.tenders.gov.au/'
    ELSE COALESCE(source_url, 'https://www.civicgraph.au/giving/sources')
  END,
  source_owner = CASE table_name
    WHEN 'gs_entities' THEN 'Source agencies and CivicGraph resolution layer'
    WHEN 'gs_relationships' THEN 'Source agencies and CivicGraph resolution layer'
    WHEN 'foundations' THEN 'ACNC, foundation publishers and CivicGraph profiling layer'
    WHEN 'grant_opportunities' THEN 'Grant publishers and CivicGraph extraction layer'
    WHEN 'political_donations' THEN 'Australian Electoral Commission'
    WHEN 'austender_contracts' THEN 'Australian Government AusTender'
    ELSE COALESCE(source_owner, owner_team)
  END,
  collection_method = CASE table_name
    WHEN 'gs_entities' THEN 'Public registers, public datasets, source crawling and deterministic entity resolution.'
    WHEN 'gs_relationships' THEN 'Cross-source joins, ABN matching and public-source graph construction.'
    WHEN 'foundations' THEN 'Public register import plus public website/profile enrichment.'
    WHEN 'grant_opportunities' THEN 'Public source crawl, normalisation and deduplication.'
    WHEN 'political_donations' THEN 'Public disclosure import and normalisation.'
    WHEN 'austender_contracts' THEN 'Public procurement data import and normalisation.'
    ELSE COALESCE(collection_method, 'Compiled from public CivicGraph dataset metadata.')
  END,
  update_cadence = CASE table_name
    WHEN 'gs_entities' THEN 'Daily to weekly by source.'
    WHEN 'gs_relationships' THEN 'Daily to weekly by source.'
    WHEN 'foundations' THEN 'Weekly crawl, manual correction queue.'
    WHEN 'grant_opportunities' THEN 'Daily to weekly by source.'
    WHEN 'political_donations' THEN 'Annual disclosure cycle, refreshed after releases.'
    WHEN 'austender_contracts' THEN 'Daily to weekly.'
    ELSE COALESCE(update_cadence, 'Nightly or source-dependent.')
  END,
  public_caveat = CASE table_name
    WHEN 'gs_entities' THEN 'Entity resolution is probabilistic where no ABN or source identifier exists.'
    WHEN 'gs_relationships' THEN 'Absence of an edge does not prove absence of a relationship.'
    WHEN 'foundations' THEN 'Giving values and openness signals are directional public-record measures.'
    WHEN 'grant_opportunities' THEN 'Deadlines and eligibility can change after capture.'
    WHEN 'political_donations' THEN 'Donation records reflect disclosure thresholds and source publication rules.'
    WHEN 'austender_contracts' THEN 'Contract values can include amendments and may not equal cash paid in a single year.'
    ELSE COALESCE(public_caveat, 'Read with source-specific caveats.')
  END,
  updated_at = now()
WHERE table_name IN (
  'gs_entities',
  'gs_relationships',
  'foundations',
  'foundation_programs',
  'grant_opportunities',
  'mv_funding_by_postcode',
  'political_donations',
  'austender_contracts'
);

CREATE TABLE IF NOT EXISTS data_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  target_id text,
  claim_url text,
  submitter_name text NOT NULL,
  submitter_email text NOT NULL,
  submitter_org text,
  requested_change text NOT NULL,
  evidence_url text,
  evidence_text text,
  right_of_reply boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'accepted', 'rejected', 'published_reply', 'closed')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT data_corrections_target_check CHECK (
    target_id IS NOT NULL OR claim_url IS NOT NULL
  )
);

ALTER TABLE data_corrections ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_data_corrections_status_created
  ON data_corrections(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_corrections_target
  ON data_corrections(target_type, target_id)
  WHERE target_id IS NOT NULL;

CREATE OR REPLACE FUNCTION data_corrections_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_data_corrections_updated_at ON data_corrections;
CREATE TRIGGER trg_data_corrections_updated_at
  BEFORE UPDATE ON data_corrections
  FOR EACH ROW
  EXECUTE FUNCTION data_corrections_touch_updated_at();

COMMENT ON TABLE data_corrections IS
  'Correction and right-of-reply submissions for the public Australian Giving Data Commons.';

COMMENT ON COLUMN data_corrections.right_of_reply IS
  'True when the submitter is lodging a response to a public claim rather than only correcting a field.';
