-- Prevent CRM-synced tracker rows from landing with null grant lifecycle status.

CREATE OR REPLACE FUNCTION grant_opportunities_apply_ghl_sync_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source = 'ghl_sync' AND NEW.status IS NULL THEN
    NEW.status := 'unknown';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grant_opportunities_ghl_sync_status_guard ON grant_opportunities;

CREATE TRIGGER grant_opportunities_ghl_sync_status_guard
  BEFORE INSERT OR UPDATE OF source, status
  ON grant_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION grant_opportunities_apply_ghl_sync_status();

UPDATE grant_opportunities
SET status = 'unknown'
WHERE source = 'ghl_sync'
  AND status IS NULL;
