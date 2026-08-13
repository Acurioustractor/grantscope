-- Goods August 2026 grant triage fixes.
--
-- Applied after checking the BFGN August wrap-up against official sources and
-- local GrantScope/GHL/Notion mirrors.

BEGIN;

-- Brisbane City Council confirms Youth Climate Action Fund applications are
-- open until 26 August 2026. The existing GrantScope row carried a stale
-- 2026-07-22 close date from the earlier scrape.
UPDATE grant_opportunities
SET
  deadline = DATE '2026-08-26',
  closes_at = DATE '2026-08-26',
  last_verified_at = now(),
  updated_at = now(),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'august_2026_triage_fix', jsonb_build_object(
      'fixed_at', now(),
      'reason', 'Corrected stale Youth Climate Action Fund close date from official Brisbane City Council page',
      'previous_closes_at', '2026-07-22',
      'verified_source', 'https://www.brisbane.qld.gov.au/community-support-and-safety/grants-and-sponsorship/applying-for-a-grant/youth-climate-action-fund'
    )
  )
WHERE id = '3030c0bb-a97d-4fb1-bf6a-18c4deb8361b';

-- Archive the empty duplicate SEDI First Nations row. The canonical row has
-- provider, official URL, score, verification timestamp, and the active GHL ID.
UPDATE grant_opportunities
SET
  status = 'archived',
  application_status = 'duplicate',
  pipeline_stage = 'archived',
  updated_at = now(),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'duplicate_of', '89e7a97d-6d2d-43d1-8d27-e1d690968702',
    'archived_reason', 'Duplicate empty SEDI First Nations row consolidated during Goods August 2026 grant triage',
    'archived_at', now()
  )
WHERE id = 'db732049-bb83-43ea-902e-26288ab7684e';

COMMIT;
