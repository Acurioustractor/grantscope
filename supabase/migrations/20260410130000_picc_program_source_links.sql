-- Add program-level funding status plus reusable source-link crosswalks for org dashboards.
-- This is the missing layer between recipient-side justice_funding rows and
-- canonical parent funder / awarding-body metadata.

ALTER TABLE org_programs
  ADD COLUMN IF NOT EXISTS funding_status text NOT NULL DEFAULT 'gap';

ALTER TABLE org_programs
  DROP CONSTRAINT IF EXISTS org_programs_funding_status_check;

ALTER TABLE org_programs
  ADD CONSTRAINT org_programs_funding_status_check
  CHECK (funding_status IN ('secured', 'applied', 'upcoming', 'prospect', 'gap', 'self-funded'));

UPDATE org_programs
SET funding_status = CASE
  WHEN funding_status IS NOT NULL THEN funding_status
  WHEN status = 'active' THEN 'secured'
  WHEN status = 'planned' THEN 'prospect'
  ELSE 'gap'
END
WHERE funding_status IS NULL;

CREATE TABLE IF NOT EXISTS org_program_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_program_id uuid NOT NULL REFERENCES org_programs(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (
    source_type IN ('justice_funding_program', 'alma_intervention', 'contract_buyer', 'pipeline_item')
  ),
  source_key text NOT NULL,
  source_label text,
  parent_funder_name text,
  parent_funder_entity_id uuid REFERENCES gs_entities(id) ON DELETE SET NULL,
  funder_name text,
  funder_entity_id uuid REFERENCES gs_entities(id) ON DELETE SET NULL,
  funder_abn text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_program_source_links_unique UNIQUE (org_program_id, source_type, source_key)
);

CREATE INDEX IF NOT EXISTS idx_org_program_source_links_program
  ON org_program_source_links(org_program_id, source_type, sort_order);

CREATE INDEX IF NOT EXISTS idx_org_program_source_links_type_key
  ON org_program_source_links(source_type, source_key);

DROP TRIGGER IF EXISTS org_program_source_links_updated_at ON org_program_source_links;
CREATE TRIGGER org_program_source_links_updated_at
  BEFORE UPDATE ON org_program_source_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE org_program_source_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_program_source_links_select ON org_program_source_links;
CREATE POLICY org_program_source_links_select
  ON org_program_source_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM org_programs op
      WHERE op.id = org_program_source_links.org_program_id
        AND user_can_access_org(op.org_profile_id)
    )
  );

DROP POLICY IF EXISTS org_program_source_links_insert ON org_program_source_links;
CREATE POLICY org_program_source_links_insert
  ON org_program_source_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM org_programs op
      WHERE op.id = org_program_source_links.org_program_id
        AND user_can_access_org(op.org_profile_id)
    )
  );

DROP POLICY IF EXISTS org_program_source_links_update ON org_program_source_links;
CREATE POLICY org_program_source_links_update
  ON org_program_source_links
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM org_programs op
      WHERE op.id = org_program_source_links.org_program_id
        AND user_can_access_org(op.org_profile_id)
    )
  );

DROP POLICY IF EXISTS org_program_source_links_delete ON org_program_source_links;
CREATE POLICY org_program_source_links_delete
  ON org_program_source_links
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM org_programs op
      WHERE op.id = org_program_source_links.org_program_id
        AND user_can_access_org(op.org_profile_id)
    )
  );

DROP POLICY IF EXISTS org_program_source_links_service ON org_program_source_links;
CREATE POLICY org_program_source_links_service
  ON org_program_source_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id
  INTO v_org_id
  FROM org_profiles
  WHERE abn = '14640793728'
  ORDER BY created_at
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'PICC org_profile missing; skipping org_program and source-link seed';
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_picc_programs (
    name text,
    system text,
    funding_source text,
    annual_amount_display text,
    reporting_cycle text,
    status text,
    funding_status text,
    sort_order integer
  ) ON COMMIT DROP;

  INSERT INTO tmp_picc_programs (
    name,
    system,
    funding_source,
    annual_amount_display,
    reporting_cycle,
    status,
    funding_status,
    sort_order
  )
  VALUES
    ('Bwgcolman Healing Service', 'Health', 'NIAA 1.3 Safety & Wellbeing', '$4.8M', 'Annual (Jun)', 'active', 'secured', 1),
    ('Family Support Services', 'Families', 'QLD DCSSDS', '~$2.5M', 'Quarterly', 'active', 'secured', 2),
    ('Child Protection Placement', 'Child Protection', 'QLD DCSSDS', '~$1.2M', 'Quarterly', 'active', 'secured', 3),
    ('Making Decisions in Our Way', 'Child Protection', 'QLD DCSSDS', '$211K', 'Annual', 'active', 'secured', 4),
    ('DFV Services', 'DFV', 'QLD DCSSDS', '~$1.0M', 'Quarterly', 'active', 'secured', 5),
    ('Women''s Healing Service', 'Women', 'QLD DCSSDS', '~$500K', 'Quarterly', 'active', 'secured', 6),
    ('Young Offender Support', 'Youth Justice', 'QLD DCYJMA', '$340K', 'Quarterly', 'active', 'secured', 7),
    ('Digital Service Centre', 'Economic Dev', 'Telstra', 'Self-sustaining', 'Annual', 'active', 'self-funded', 8),
    ('Movember Men''s Health', 'Health', 'Movember Foundation', '$1.9M (multi-yr)', 'Annual', 'active', 'secured', 9),
    ('Social Enterprises (Bakery, Fuel, Mechanics)', 'Enterprise', 'Revenue', 'Self-sustaining', 'Annual', 'active', 'self-funded', 10),
    ('Elders Program & Cultural Knowledge', 'Cultural', 'Cross-program', 'Integrated', 'Ongoing', 'active', 'applied', 11),
    ('Station Precinct Employment Pathways', 'Youth Justice', 'REAL Innovation Fund', '$1.2M (proposed)', 'TBD', 'planned', 'applied', 12);

  UPDATE org_programs op
  SET
    system = t.system,
    funding_source = t.funding_source,
    annual_amount_display = t.annual_amount_display,
    reporting_cycle = t.reporting_cycle,
    status = t.status,
    funding_status = t.funding_status,
    sort_order = t.sort_order,
    updated_at = now()
  FROM tmp_picc_programs t
  WHERE op.org_profile_id = v_org_id
    AND op.name = t.name;

  INSERT INTO org_programs (
    org_profile_id,
    name,
    system,
    funding_source,
    annual_amount_display,
    reporting_cycle,
    status,
    funding_status,
    sort_order
  )
  SELECT
    v_org_id,
    t.name,
    t.system,
    t.funding_source,
    t.annual_amount_display,
    t.reporting_cycle,
    t.status,
    t.funding_status,
    t.sort_order
  FROM tmp_picc_programs t
  WHERE NOT EXISTS (
    SELECT 1
    FROM org_programs op
    WHERE op.org_profile_id = v_org_id
      AND op.name = t.name
  );

  CREATE TEMP TABLE tmp_picc_links (
    program_name text,
    source_type text,
    source_key text,
    source_label text,
    parent_funder_name text,
    parent_funder_entity_id uuid,
    funder_name text,
    funder_entity_id uuid,
    funder_abn text,
    notes text,
    sort_order integer
  ) ON COMMIT DROP;

  INSERT INTO tmp_picc_links (
    program_name,
    source_type,
    source_key,
    source_label,
    parent_funder_name,
    parent_funder_entity_id,
    funder_name,
    funder_entity_id,
    funder_abn,
    notes,
    sort_order
  )
  VALUES
    (
      'Bwgcolman Healing Service',
      'justice_funding_program',
      'NIAA 1.3 - Safety and Wellbeing',
      'NIAA 1.3 - Safety and Wellbeing',
      'National Indigenous Australians Agency',
      (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-c778ae1a72bb46888a614711b6ed5f21' LIMIT 1),
      'National Indigenous Australians Agency',
      (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-c778ae1a72bb46888a614711b6ed5f21' LIMIT 1),
      NULL,
      'Federal parent funder and awarding body resolved directly in CivicGraph.',
      1
    ),
    (
      'Bwgcolman Healing Service',
      'alma_intervention',
      'PICC Safety and Wellbeing Program (NIAA 1.3)',
      'PICC Safety and Wellbeing Program (NIAA 1.3)',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      10
    ),
    (
      'Bwgcolman Healing Service',
      'contract_buyer',
      'James Cook University',
      'James Cook University',
      'James Cook University',
      (SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-46253211955' LIMIT 1),
      'James Cook University',
      (SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-46253211955' LIMIT 1),
      '46253211955',
      'Contract buyer link for the health/training partnership.',
      20
    ),
    (
      'Family Support Services',
      'justice_funding_program',
      'Families',
      'Families',
      'Queensland Government',
      NULL,
      'Department of Families, Seniors, Disability Services and Child Safety',
      NULL,
      NULL,
      'Program stream currently requires manual department naming because CivicGraph does not hold the parent hierarchy.',
      1
    ),
    (
      'Child Protection Placement',
      'justice_funding_program',
      'Child Protection - Placement Services',
      'Child Protection - Placement Services',
      'Queensland Government',
      NULL,
      'Department of Families, Seniors, Disability Services and Child Safety',
      NULL,
      NULL,
      NULL,
      1
    ),
    (
      'Child Protection Placement',
      'justice_funding_program',
      'Child Safety',
      'Child Safety',
      'Queensland Government',
      NULL,
      'Department of Child Safety, Youth and Women',
      (SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-75563721098' LIMIT 1),
      '75563721098',
      'Historic department naming retained where that is the entity available in CivicGraph.',
      2
    ),
    (
      'Child Protection Placement',
      'justice_funding_program',
      'Child Safety Services',
      'Child Safety Services',
      'Queensland Government',
      NULL,
      'Department of Child Safety, Youth and Women',
      (SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-75563721098' LIMIT 1),
      '75563721098',
      'Historic department naming retained where that is the entity available in CivicGraph.',
      3
    ),
    (
      'Child Protection Placement',
      'alma_intervention',
      'PICC Child Protection Placement Services',
      'PICC Child Protection Placement Services',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      10
    ),
    (
      'Making Decisions in Our Way',
      'justice_funding_program',
      'Making Decisions in Our Way (Delegated Authority Support Services)',
      'Making Decisions in Our Way (Delegated Authority Support Services)',
      'Queensland Government',
      NULL,
      'Department of Families, Seniors, Disability Services and Child Safety',
      NULL,
      NULL,
      NULL,
      1
    ),
    (
      'Making Decisions in Our Way',
      'alma_intervention',
      'PICC Making Decisions in Our Way',
      'PICC Making Decisions in Our Way',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      10
    ),
    (
      'DFV Services',
      'justice_funding_program',
      'Domestic and Family Violence',
      'Domestic and Family Violence',
      'Queensland Government',
      NULL,
      'Department of Families, Seniors, Disability Services and Child Safety',
      NULL,
      NULL,
      NULL,
      1
    ),
    (
      'DFV Services',
      'justice_funding_program',
      'Keeping Women Safe from Violence Grants',
      'Keeping Women Safe from Violence Grants',
      'Queensland Government',
      NULL,
      'Department of Families, Seniors, Disability Services and Child Safety',
      NULL,
      NULL,
      NULL,
      2
    ),
    (
      'DFV Services',
      'justice_funding_program',
      'DFV Rent Assist Brokerage Grants',
      'DFV Rent Assist Brokerage Grants',
      'Queensland Government',
      NULL,
      'Department of Families, Seniors, Disability Services and Child Safety',
      NULL,
      NULL,
      NULL,
      3
    ),
    (
      'DFV Services',
      'alma_intervention',
      'PICC Domestic and Family Violence Services',
      'PICC Domestic and Family Violence Services',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      10
    ),
    (
      'Women''s Healing Service',
      'justice_funding_program',
      'Women',
      'Women',
      'Queensland Government',
      NULL,
      'Department of Families, Seniors, Disability Services and Child Safety',
      NULL,
      NULL,
      NULL,
      1
    ),
    (
      'Young Offender Support',
      'justice_funding_program',
      'Young Offender Support Service',
      'Young Offender Support Service',
      'Queensland Government',
      NULL,
      'Department of Justice and Attorney-General',
      (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-b8ab114db1458236a78c4d9ae9c3c49d' LIMIT 1),
      NULL,
      NULL,
      1
    ),
    (
      'Young Offender Support',
      'justice_funding_program',
      'Community and Youth Justice Services and Aboriginal and Torres Strait Islander Services',
      'Community and Youth Justice Services and Aboriginal and Torres Strait Islander Services',
      'Queensland Government',
      NULL,
      'Department of Justice and Attorney-General',
      (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-b8ab114db1458236a78c4d9ae9c3c49d' LIMIT 1),
      NULL,
      NULL,
      2
    ),
    (
      'Young Offender Support',
      'justice_funding_program',
      'Community & Youth Justice Services & Aboriginal & Torres Strait Islander Services',
      'Community & Youth Justice Services & Aboriginal & Torres Strait Islander Services',
      'Queensland Government',
      NULL,
      'Department of Justice and Attorney-General',
      (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-b8ab114db1458236a78c4d9ae9c3c49d' LIMIT 1),
      NULL,
      NULL,
      3
    ),
    (
      'Young Offender Support',
      'justice_funding_program',
      'Community, Youth Justice Services and Women',
      'Community, Youth Justice Services and Women',
      'Queensland Government',
      NULL,
      'Department of Justice and Attorney-General',
      (SELECT id FROM gs_entities WHERE gs_id = 'AU-GOV-b8ab114db1458236a78c4d9ae9c3c49d' LIMIT 1),
      NULL,
      NULL,
      4
    ),
    (
      'Young Offender Support',
      'alma_intervention',
      'PICC Young Offender Support Service',
      'PICC Young Offender Support Service',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      10
    ),
    (
      'Elders Program & Cultural Knowledge',
      'alma_intervention',
      'PICC Elders Program and Cultural Knowledge',
      'PICC Elders Program and Cultural Knowledge',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      10
    ),
    (
      'Elders Program & Cultural Knowledge',
      'pipeline_item',
      'ILA "Voices on Country"',
      'ILA "Voices on Country"',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      20
    ),
    (
      'Station Precinct Employment Pathways',
      'pipeline_item',
      'REAL Innovation Fund EOI',
      'REAL Innovation Fund EOI',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      20
    );

  DELETE FROM org_program_source_links sl
  USING org_programs op
  WHERE sl.org_program_id = op.id
    AND op.org_profile_id = v_org_id
    AND NOT EXISTS (
      SELECT 1
      FROM tmp_picc_links t
      WHERE t.program_name = op.name
        AND t.source_type = sl.source_type
        AND t.source_key = sl.source_key
    );

  INSERT INTO org_program_source_links (
    org_program_id,
    source_type,
    source_key,
    source_label,
    parent_funder_name,
    parent_funder_entity_id,
    funder_name,
    funder_entity_id,
    funder_abn,
    notes,
    sort_order
  )
  SELECT
    op.id,
    t.source_type,
    t.source_key,
    t.source_label,
    t.parent_funder_name,
    t.parent_funder_entity_id,
    t.funder_name,
    t.funder_entity_id,
    t.funder_abn,
    t.notes,
    t.sort_order
  FROM tmp_picc_links t
  JOIN org_programs op
    ON op.org_profile_id = v_org_id
   AND op.name = t.program_name
  ON CONFLICT (org_program_id, source_type, source_key)
  DO UPDATE SET
    source_label = EXCLUDED.source_label,
    parent_funder_name = EXCLUDED.parent_funder_name,
    parent_funder_entity_id = EXCLUDED.parent_funder_entity_id,
    funder_name = EXCLUDED.funder_name,
    funder_entity_id = EXCLUDED.funder_entity_id,
    funder_abn = EXCLUDED.funder_abn,
    notes = EXCLUDED.notes,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
END $$;
