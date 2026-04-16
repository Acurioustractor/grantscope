-- Backfill the remaining PICC funding streams into explicit org_program crosswalks.
-- This extends the first PICC source-link migration with the community-services,
-- health, digital-service, housing, and disability streams that still lacked
-- parent-funder metadata.

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
    RAISE NOTICE 'PICC org_profile missing; skipping program/source-link backfill';
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_picc_program_updates (
    name text,
    system text,
    funding_source text,
    annual_amount_display text,
    reporting_cycle text,
    status text,
    funding_status text,
    sort_order integer
  ) ON COMMIT DROP;

  INSERT INTO tmp_picc_program_updates (
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
    ('Integrated Community Services', 'Community Services', 'Queensland Government', '$18.5M tracked', 'Mixed', 'active', 'secured', 8),
    ('Growing Deadly Families', 'Health', 'Queensland Government', '$428K seed', 'Annual', 'active', 'secured', 9),
    ('Digital Service Centre', 'Economic Dev', 'Queensland Government + Telstra', '$150K seed + operations', 'Annual', 'active', 'secured', 10),
    ('Movember Men''s Health', 'Health', 'Movember Foundation', '$1.9M (multi-yr)', 'Annual', 'active', 'secured', 11),
    ('Social Enterprises (Bakery, Fuel, Mechanics)', 'Enterprise', 'Revenue', 'Self-sustaining', 'Annual', 'active', 'self-funded', 12),
    ('Elders Program & Cultural Knowledge', 'Cultural', 'Cross-program', 'Integrated', 'Ongoing', 'active', 'applied', 13),
    ('Station Precinct Employment Pathways', 'Youth Justice', 'REAL Innovation Fund', '$1.2M (proposed)', 'TBD', 'planned', 'applied', 14),
    ('Housing & Homelessness Services', 'Housing', 'Queensland Government (legacy)', '$968K tracked', 'Historical', 'ended', 'gap', 15),
    ('Disability & Community Mental Health Services', 'Disability', 'Queensland Government (legacy)', '$1.2M tracked', 'Historical', 'ended', 'gap', 16);

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
  FROM tmp_picc_program_updates t
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
  FROM tmp_picc_program_updates t
  WHERE NOT EXISTS (
    SELECT 1
    FROM org_programs op
    WHERE op.org_profile_id = v_org_id
      AND op.name = t.name
  );

  CREATE TEMP TABLE tmp_picc_link_updates (
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

  INSERT INTO tmp_picc_link_updates (
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
      'Integrated Community Services',
      'justice_funding_program',
      'Specialised Services and Supplies',
      'Specialised Services and Supplies',
      'Queensland Government',
      NULL,
      'Department of Children, Youth Justice and Multicultural Affairs',
      NULL,
      NULL,
      'Queensland contract-disclosure rows rolled into an explicit community-services program crosswalk.',
      1
    ),
    (
      'Integrated Community Services',
      'justice_funding_program',
      'Specialised Service and Support',
      'Specialised Service and Support',
      'Queensland Government',
      NULL,
      'Department of Children, Youth Justice and Multicultural Affairs',
      NULL,
      NULL,
      'Queensland contract-disclosure rows rolled into an explicit community-services program crosswalk.',
      2
    ),
    (
      'Integrated Community Services',
      'justice_funding_program',
      'Specialised Services and Support',
      'Specialised Services and Support',
      'Queensland Government',
      NULL,
      'Department of Children, Youth Justice and Multicultural Affairs',
      NULL,
      NULL,
      'Variant spelling preserved so 2022-23 rows resolve to the same program.',
      3
    ),
    (
      'Integrated Community Services',
      'justice_funding_program',
      'Social Inclusion',
      'Social Inclusion',
      'Queensland Government',
      NULL,
      'Queensland community services portfolio (legacy)',
      NULL,
      NULL,
      'Historic community-services grant retained under the same integrated operating program.',
      10
    ),
    (
      'Integrated Community Services',
      'justice_funding_program',
      'Service System Support & Development',
      'Service System Support & Development',
      'Queensland Government',
      NULL,
      'Department of Families, Seniors, Disability Services and Child Safety',
      NULL,
      NULL,
      'QGIP peak-capability support funding crosswalked into the community-services program.',
      20
    ),
    (
      'Growing Deadly Families',
      'justice_funding_program',
      'Primary Care — Growing Deadly Families',
      'Primary Care — Growing Deadly Families',
      'Queensland Government',
      NULL,
      'Department of Families, Seniors, Disability Services and Child Safety',
      NULL,
      NULL,
      'QGIP maternity-services row under the Growing Deadly Families strategy.',
      1
    ),
    (
      'Digital Service Centre',
      'justice_funding_program',
      'Palm Island Digital Service Centre — Digital Services',
      'Palm Island Digital Service Centre — Digital Services',
      'Queensland Government',
      NULL,
      NULL,
      NULL,
      NULL,
      'QGIP establishment funding for the Palm Island Digital Service Centre.',
      1
    ),
    (
      'Housing & Homelessness Services',
      'justice_funding_program',
      'Homelessness Services',
      'Homelessness Services',
      'Queensland Government',
      NULL,
      'Queensland community services portfolio (legacy)',
      NULL,
      NULL,
      'Historic housing/homelessness grant folded into a legacy program card.',
      1
    ),
    (
      'Housing & Homelessness Services',
      'justice_funding_program',
      'Housing & Homelessness Services',
      'Housing & Homelessness Services',
      'Queensland Government',
      NULL,
      'Queensland community services portfolio (legacy)',
      NULL,
      NULL,
      'Historic housing/homelessness grant folded into a legacy program card.',
      2
    ),
    (
      'Housing & Homelessness Services',
      'justice_funding_program',
      'Housing and Homelessness Services',
      'Housing and Homelessness Services',
      'Queensland Government',
      NULL,
      'Queensland community services portfolio (legacy)',
      NULL,
      NULL,
      'Historic housing/homelessness grant folded into a legacy program card.',
      3
    ),
    (
      'Disability & Community Mental Health Services',
      'justice_funding_program',
      'Disability Services',
      'Disability Services',
      'Queensland Government',
      NULL,
      'Queensland community services portfolio (legacy)',
      NULL,
      NULL,
      'Historic disability and community-mental-health grant rolled into a single legacy program.',
      1
    ),
    (
      'Disability & Community Mental Health Services',
      'justice_funding_program',
      'Disability Services (including Community and Mental Health) (excluding Home and Community Care)',
      'Disability Services (including Community and Mental Health) (excluding Home and Community Care)',
      'Queensland Government',
      NULL,
      'Queensland community services portfolio (legacy)',
      NULL,
      NULL,
      'Historic disability and community-mental-health grant rolled into a single legacy program.',
      2
    ),
    (
      'Disability & Community Mental Health Services',
      'justice_funding_program',
      'Disability and Community Mental Health Services and Multicultural Affairs',
      'Disability and Community Mental Health Services and Multicultural Affairs',
      'Queensland Government',
      NULL,
      'Queensland community services portfolio (legacy)',
      NULL,
      NULL,
      'Historic disability and community-mental-health grant rolled into a single legacy program.',
      3
    ),
    (
      'Disability & Community Mental Health Services',
      'justice_funding_program',
      'Disability & Community Mental Health Services (includes MAQ)',
      'Disability & Community Mental Health Services (includes MAQ)',
      'Queensland Government',
      NULL,
      'Queensland community services portfolio (legacy)',
      NULL,
      NULL,
      'Historic disability and community-mental-health grant rolled into a single legacy program.',
      4
    ),
    (
      'Disability & Community Mental Health Services',
      'justice_funding_program',
      'Disability and Community Mental Health Services',
      'Disability and Community Mental Health Services',
      'Queensland Government',
      NULL,
      'Queensland community services portfolio (legacy)',
      NULL,
      NULL,
      'Historic disability and community-mental-health grant rolled into a single legacy program.',
      5
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
  FROM tmp_picc_link_updates t
  JOIN org_programs op
    ON op.org_profile_id = v_org_id
   AND op.name = t.program_name
  ON CONFLICT (org_program_id, source_type, source_key) DO UPDATE SET
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
