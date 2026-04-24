-- Canonical applicant entities for the ACT umbrella org.
-- Keeps the umbrella org profile stable while making legal vehicle choice explicit.

UPDATE org_applicant_entities
SET
  name = 'A Kind Tractor Ltd',
  notes = 'Existing charity-side legal vehicle. Use when a not-for-profit or charity structure is required. This sits under the A Curious Tractor operating umbrella.',
  updated_at = now()
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND name = 'A Curious Tractor Ltd'
  AND NOT EXISTS (
    SELECT 1
    FROM org_applicant_entities existing
    WHERE existing.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
      AND existing.name = 'A Kind Tractor Ltd'
  );

DELETE FROM org_applicant_entities
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND name = 'A Curious Tractor Ltd'
  AND EXISTS (
    SELECT 1
    FROM org_applicant_entities existing
    WHERE existing.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
      AND existing.name = 'A Kind Tractor Ltd'
  );

INSERT INTO org_applicant_entities (
  org_profile_id,
  name,
  entity_type,
  status,
  abn,
  linked_gs_entity_id,
  is_default,
  notes,
  updated_at
)
VALUES (
  '8b6160a1-7eea-4bd2-8404-71c196381de0',
  'A Kind Tractor Ltd',
  'charity',
  'active',
  '73669029341',
  '0f4a9330-4147-4540-b710-a8fb110e2a13',
  false,
  'Existing charity-side legal vehicle. Use when a not-for-profit or charity structure is required. This sits under the A Curious Tractor operating umbrella.',
  now()
)
ON CONFLICT (org_profile_id, name)
DO UPDATE SET
  entity_type = EXCLUDED.entity_type,
  status = EXCLUDED.status,
  abn = EXCLUDED.abn,
  linked_gs_entity_id = EXCLUDED.linked_gs_entity_id,
  is_default = EXCLUDED.is_default,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO org_applicant_entities (
  org_profile_id,
  name,
  entity_type,
  status,
  abn,
  linked_gs_entity_id,
  is_default,
  notes,
  updated_at
)
VALUES (
  '8b6160a1-7eea-4bd2-8404-71c196381de0',
  'A Curious Tractor Pty Ltd (pending)',
  'pending_company',
  'pending',
  null,
  null,
  true,
  'Preferred operating/applicant vehicle for most ACT work once the Pty registration is complete. Replace the name, ABN, and graph link when registration lands.',
  now()
)
ON CONFLICT (org_profile_id, name)
DO UPDATE SET
  entity_type = EXCLUDED.entity_type,
  status = EXCLUDED.status,
  abn = EXCLUDED.abn,
  linked_gs_entity_id = EXCLUDED.linked_gs_entity_id,
  is_default = EXCLUDED.is_default,
  notes = EXCLUDED.notes,
  updated_at = now();

UPDATE org_project_foundations opf
SET applicant_entity_id = ae.id
FROM org_applicant_entities ae,
     org_projects p
WHERE ae.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND ae.name = 'A Curious Tractor Pty Ltd (pending)'
  AND p.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND p.id = opf.org_project_id
  AND opf.applicant_entity_id IS NULL;

DELETE FROM org_applicant_entities
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND name = 'A Curious Tractor Ltd';
