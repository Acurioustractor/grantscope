-- Organisation Formation Journey
-- Adds org_status and auspice_org_name to org_profiles
-- org_status tracks where an org is in their formation journey:
--   exploring: figuring out what they want to be
--   pre_formation: know what they want, working towards it
--   auspiced: operating under another org's ABN
--   incorporated: has own ABN and legal structure

BEGIN;

ALTER TABLE org_profiles
  ADD COLUMN IF NOT EXISTS org_status text DEFAULT 'incorporated',
  ADD COLUMN IF NOT EXISTS auspice_org_name text;

-- Add check constraint for valid statuses
ALTER TABLE org_profiles
  ADD CONSTRAINT chk_org_status
  CHECK (org_status IN ('exploring', 'pre_formation', 'auspiced', 'incorporated'));

-- Auto-set status for existing orgs: ABN present → incorporated, else → exploring
UPDATE org_profiles
SET org_status = CASE
  WHEN abn IS NOT NULL AND abn != '' THEN 'incorporated'
  ELSE 'exploring'
END
WHERE org_status IS NULL OR org_status = 'incorporated';

-- Update JusticeHub to exploring (if it exists)
UPDATE org_profiles
SET org_status = 'exploring'
WHERE LOWER(name) LIKE '%justicehub%';

COMMIT;
