WITH target_pairs AS (
  SELECT * FROM (
    VALUES
      ('justicehub', '8f8704be-d6e8-40f3-b561-ac6630ce5b36'::uuid, 'JusticeHub can be positioned to Minderoo as Indigenous data infrastructure for community-led justice reform, place-based proof, and better allocation decisions.', 'We already have the Minderoo justice/data pitch, JusticeHub product language, and Oonchiumpa / community-exchange material in the repo.', 'Current repo material names Minderoo as a fit but does not yet lock a warm intro path.', 'Multi-year infrastructure support for the JusticeHub / Contained / community-exchange spine.', 'ready', 'partial', 'partial', 'missing', 'partial', ARRAY['Warm introduction to the right Minderoo lead', 'Ask range confirmed for this exact package', 'Condensed Minderoo-ready brief from the full pitch']),
      ('justicehub', '4ee5baca-c898-4318-ae2b-d79b95379cc7'::uuid, 'JusticeHub can support Paul Ramsay Foundation''s justice reinvestment logic with evidence infrastructure, organisation mapping, and exportable decision objects.', 'We already have PRF-specific outreach language and the foundation itself is one of the strongest verified benchmark cases in GrantScope.', 'No warm path has been stored yet; this is still a strategy-first pairing.', 'Data partnership or working-session pathway around one justice reinvestment geography.', 'ready', 'partial', 'partial', 'missing', 'partial', ARRAY['Warm path into the right PRF justice lead', 'One geography-specific PRF demo slice', 'Specific ask shape and commercial range']),
      ('justicehub', 'b9e090e5-1672-48ff-815a-2a6314ebe033'::uuid, 'JusticeHub gives Ian Potter a way to see which Indigenous community-development programs have evidence, local delivery organisations, and funding gaps.', 'We have Ian Potter outreach language and a strong verified foundation profile, but less project-specific packaging than Minderoo or PRF.', 'Relationship path is not yet captured beyond generic outreach.', 'Evidence-led grantmaking support for one place-based or Indigenous community-development slice.', 'ready', 'partial', 'partial', 'missing', 'partial', ARRAY['Named program lead or route in Ian Potter', 'One compact Ian Potter-specific working brief', 'Clear funding ask or pilot frame']),
      ('empathy-ledger', 'd242967e-0e68-4367-9785-06cf0ec7485e'::uuid, 'Empathy Ledger helps Snow move from strategy language to a governed community-evidence view across one real portfolio slice.', 'We already have a Snow one-pager, board memo, Deadly Hearts framing, and a live Snow foundation case in the platform.', 'The route is strategy-rich, but warm relationship detail is still thin in the workspace itself.', 'A 30-minute working session around one Snow slice: RHD/social determinants first, place-based second.', 'ready', 'ready', 'partial', 'partial', 'ready', ARRAY['Named Snow contact path in the workspace', 'Final fixed demo route for the working session', 'Outreach email variant linked directly from the pair']),
      ('farm', '5cb27568-8820-441c-a536-e88b5b4d9cea'::uuid, 'The Farm is one of the cleanest Tim Fairfax fits because it combines Queensland, rural/regional, arts, youth, Indigenous, and community work in one place.', 'The pipeline already calls this a near-perfect fit and the foundation itself is a verified public review case.', 'No relationship path is yet stored beyond the thematic match.', 'Capital works plus first-year programming for residencies, fellowships, and community use.', 'ready', 'partial', 'partial', 'missing', 'ready', ARRAY['Warm intro through arts / Queensland networks', 'Tim Fairfax-specific one-pager', 'First-year budget split between capital and program']),
      ('farm', '3ef014f7-76ea-48e6-932a-7ec133cc5342'::uuid, 'The Farm fits Vincent Fairfax where the work is framed as leadership-through-land, retreat practice, and community arts rather than a venue-only proposition.', 'The current evidence is mainly internal ACT framing; it is strategically coherent but less externally packaged than other pairs.', 'No relationship route has been captured yet.', 'Leadership and community retreat pilot rooted in regenerative land practice and arts.', 'ready', 'partial', 'partial', 'missing', 'partial', ARRAY['Vincent Fairfax-specific framing note', 'Warm path or board overlap', 'Example retreat concept and budget']),
      ('harvest', '6d8356c4-8efb-471f-8bdc-46bdd85d22f1'::uuid, 'Harvest can be positioned to Woolworths as a regenerative supply-chain demonstration with Indigenous partnership, food, and environmental practice in one operating model.', 'The pipeline notes already capture the supply-chain logic and Woolworths is a strong verified foundation case.', 'Relationship path is still missing in the workspace.', 'Demonstration supplier / partnership narrative rather than a generic community grant ask.', 'ready', 'partial', 'partial', 'missing', 'partial', ARRAY['Named Woolworths pathway or comparable partner', 'Sharper Harvest-specific supplier narrative', 'Pilot scope or commercial-philanthropic boundary']),
      ('empathy-ledger', '34ff4c88-d286-4128-a8fc-a505fa304ec9'::uuid, 'Humanitix could fit Empathy Ledger around event-linked impact and social-return reporting, but the case is still more exploratory than proven.', 'There is a good conceptual overlap, but not yet a mature evidence pack.', 'No warm route captured.', 'Small event-impact pilot.', 'partial', 'missing', 'partial', 'missing', 'partial', ARRAY['Concrete pilot design', 'Foundation-specific proof of demand', 'Warm intro or contact path']),
      ('empathy-ledger', 'd6e6dc2d-acd6-48a7-8db8-fd92845ae049'::uuid, 'Brave is a plausible Empathy Ledger pilot around expecting and parenting teens, but it is not yet a broad strategic fit.', 'Only the pipeline note exists today.', 'No relationship path captured.', 'Narrow cohort-specific outcomes pilot.', 'partial', 'missing', 'partial', 'missing', 'missing', ARRAY['Pilot concept note', 'Why Empathy Ledger vs standard reporting', 'Named contact and ask range']),
      ('empathy-ledger', '9a8dcdb4-63a1-44e2-8b61-a7a5ec9eff12'::uuid, 'Australian Rural Leadership Foundation is a capability-building fit for Empathy Ledger rather than a strong core philanthropy pair.', 'Current support is mostly conceptual and pipeline-level.', 'No relationship route captured.', 'Leadership / practitioner capability support rather than a core product ask.', 'partial', 'missing', 'partial', 'missing', 'missing', ARRAY['Clear training-oriented offer', 'Named relationship path', 'Decision on whether this should stay in the saved lane'])
  ) AS t(
    project_slug,
    foundation_id,
    foundation_thesis,
    evidence_summary,
    relationship_path,
    ask_shape,
    fit_status,
    proof_status,
    applicant_status,
    relationship_status,
    ask_status,
    missing_items
  )
)
INSERT INTO org_project_foundation_research (
  org_profile_id,
  org_project_id,
  org_project_foundation_id,
  foundation_thesis,
  evidence_summary,
  relationship_path,
  ask_shape,
  fit_status,
  proof_status,
  applicant_status,
  relationship_status,
  ask_status,
  missing_items,
  updated_at
)
SELECT
  '8b6160a1-7eea-4bd2-8404-71c196381de0'::uuid,
  p.id,
  opf.id,
  tp.foundation_thesis,
  tp.evidence_summary,
  tp.relationship_path,
  tp.ask_shape,
  tp.fit_status,
  tp.proof_status,
  tp.applicant_status,
  tp.relationship_status,
  tp.ask_status,
  tp.missing_items,
  now()
FROM target_pairs tp
JOIN org_projects p
  ON p.slug = tp.project_slug
 AND p.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
JOIN org_project_foundations opf
  ON opf.org_project_id = p.id
 AND opf.foundation_id = tp.foundation_id
ON CONFLICT (org_project_foundation_id)
DO UPDATE SET
  foundation_thesis = EXCLUDED.foundation_thesis,
  evidence_summary = EXCLUDED.evidence_summary,
  relationship_path = EXCLUDED.relationship_path,
  ask_shape = EXCLUDED.ask_shape,
  fit_status = EXCLUDED.fit_status,
  proof_status = EXCLUDED.proof_status,
  applicant_status = EXCLUDED.applicant_status,
  relationship_status = EXCLUDED.relationship_status,
  ask_status = EXCLUDED.ask_status,
  missing_items = EXCLUDED.missing_items,
  updated_at = now();
