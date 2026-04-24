-- Seed canonical ACT project -> foundation fit cases into org_project_foundations.
-- This turns existing repo strategy/pitch material into live project-scoped fit rows.

WITH foundation_refs AS (
  SELECT * FROM (
    VALUES
      ('minderoo', '8f8704be-d6e8-40f3-b561-ac6630ce5b36'::uuid),
      ('prf', '4ee5baca-c898-4318-ae2b-d79b95379cc7'::uuid),
      ('ian_potter', 'b9e090e5-1672-48ff-815a-2a6314ebe033'::uuid),
      ('snow', 'd242967e-0e68-4367-9785-06cf0ec7485e'::uuid),
      ('tim_fairfax', '5cb27568-8820-441c-a536-e88b5b4d9cea'::uuid),
      ('vincent_fairfax', '3ef014f7-76ea-48e6-932a-7ec133cc5342'::uuid),
      ('woolworths', '6d8356c4-8efb-471f-8bdc-46bdd85d22f1'::uuid),
      ('humanitix', '34ff4c88-d286-4128-a8fc-a505fa304ec9'::uuid),
      ('brave', 'd6e6dc2d-acd6-48a7-8db8-fd92845ae049'::uuid),
      ('arlf', '9a8dcdb4-63a1-44e2-8b61-a7a5ec9eff12'::uuid)
  ) AS x(foundation_key, foundation_id)
),
project_refs AS (
  SELECT slug, id AS project_id
  FROM org_projects
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND slug IN ('justicehub', 'empathy-ledger', 'farm', 'harvest')
),
default_applicant AS (
  SELECT id AS applicant_entity_id
  FROM org_applicant_entities
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND is_default = true
  LIMIT 1
),
seed_rows AS (
  SELECT * FROM (
    VALUES
      (
        'justicehub',
        'minderoo',
        'priority',
        92,
        'Minderoo is a strong fit for JusticeHub when the work is framed as Indigenous data infrastructure and community-led justice reform. The strongest overlap is Communities: place-based support, evidence-backed alternatives, and infrastructure that helps communities see and shift where money is flowing.',
        'Lead with the hidden-allocation problem and the fact that JusticeHub makes community-led alternatives visible across systems. Frame the ask as infrastructure that powers local proof, community exchanges, and allocation decisions rather than as a standalone research project.',
        'Prepare a tailored outreach brief that links JusticeHub, Contained, and Oonchiumpa examples into one Communities narrative, then request a first conversation with the relevant Minderoo lead.',
        'Seeded from thoughts/shared/pitches/minderoo-foundation.md.'
      ),
      (
        'justicehub',
        'prf',
        'priority',
        90,
        'Paul Ramsay Foundation is a strong JusticeHub fit because the platform can support justice reinvestment decisions with evidence, funding visibility, and delivery-organisation mapping. The clearest overlap is breaking cycles of disadvantage through better allocation intelligence in communities already targeted by justice investment.',
        'Lead with justice reinvestment and the ability to show which organisations in target communities deliver evidence-rated programs, what other funding they receive, and where the critical gaps are. Position JusticeHub as evidence infrastructure for board papers and investment decisions, not as a generic software platform.',
        'Turn the existing PRF outreach language into a 30-minute working session focused on one justice reinvestment geography and one exportable evidence pack.',
        'Seeded from thoughts/outreach/target-buyer-emails.md (Paul Ramsay Foundation section).'
      ),
      (
        'justicehub',
        'ian_potter',
        'priority',
        82,
        'Ian Potter Foundation fits JusticeHub where the work is framed around Indigenous community development, evidence-backed programs, and local delivery capability. JusticeHub can answer the allocation question Ian Potter actually faces: which organisations can deliver, which programs have evidence, and where the gaps remain.',
        'Lead with the ability to answer place-based grantmaking questions quickly: which evidence-rated programs exist in a geography, which organisations can deliver them, and which evidence-backed programs still have no funding. Keep the message grounded in decision support and exportable evidence packs.',
        'Build a concise Ian Potter approach brief around Indigenous community development and one geography-specific evidence scan, then identify the best program lead to open with.',
        'Seeded from thoughts/outreach/target-buyer-emails.md (Ian Potter Foundation section).'
      ),
      (
        'empathy-ledger',
        'snow',
        'priority',
        88,
        'Snow is a strong fit for Empathy Ledger when the work is framed as portfolio intelligence plus governed community evidence. The clearest entry point is the existing RHD and social determinants slice: one live foundation, one live project, one transcript layer, and one community-evidence chain that Snow can inspect rather than only describe.',
        'Do not lead with a generic dashboard pitch. Lead with a working session that makes Snow''s own portfolio more legible across capital, place, grantee network, and community evidence. Position Empathy Ledger as the governed voice layer that turns strategy into something inspectable and usable in board-style discussion.',
        'Use the existing Snow one-pager and board memo to structure a 30-minute working session around the RHD/social determinants slice first, then the ACT/NSW South Coast place-based slice second.',
        'Seeded from thoughts/shared/handoffs/snow-foundation-one-pager.md and snow-foundation-board-memo.md.'
      ),
      (
        'farm',
        'tim_fairfax',
        'priority',
        89,
        'Tim Fairfax is one of the strongest thematic fits for The Farm because the foundation explicitly backs Queensland, rural/regional, arts, Indigenous, community, and youth work. The Farm combines all of those in one place-based offer: cultural programming, residencies, and community gathering grounded in land.',
        'Lead with The Farm as a Queensland-based cultural and community venue where regenerative land practice, Indigenous connection, and arts programming meet. Keep the ask concrete: capital works plus program funding for residencies, fellowships, and shared community use.',
        'Turn the existing Farm arts/community pipeline note into a Tim Fairfax-specific one-pager and outreach brief, with a clear split between capital works and first-year program support.',
        'Seeded from ACT pipeline notes for Tim Fairfax Family Foundation — Farm Arts & Community.'
      ),
      (
        'farm',
        'vincent_fairfax',
        'priority',
        82,
        'Vincent Fairfax fits The Farm where the work is framed as leadership, community, arts, and social justice held together in one place. The Farm can be positioned as a site for emerging leader retreats and interdisciplinary practice rooted in land rather than a conventional venue-only ask.',
        'Lead with leadership-through-land: retreats, reflection, arts, and regenerative practice in one setting. Frame the Farm as a place where new leadership models can be held, not just as infrastructure or events.',
        'Prepare a Vincent Fairfax brief around leadership, community, and arts, with one retreat-style pilot concept and one first-year programming outline.',
        'Seeded from ACT pipeline notes for Vincent Fairfax Family Foundation — Leadership & Arts.'
      ),
      (
        'harvest',
        'woolworths',
        'priority',
        84,
        'Woolworths Group Foundation is a strong Harvest fit because Harvest can be framed as a regenerative supply-chain demonstration grounded in food, community, Indigenous partnerships, and environmental practice. The overlap is not generic agriculture; it is applied supply-chain transition.',
        'Lead with Harvest as a demonstration supplier and regenerative community food model that can make Woolworths'' public commitments tangible. Keep the language operational: food, supply chain, Indigenous partnership, and environmental practice.',
        'Build a Harvest-specific outreach brief that turns the existing regenerative supply-chain note into a concrete partner narrative with one pilot supplier or demonstration pathway.',
        'Seeded from ACT pipeline notes for Woolworths Group Foundation — Regenerative Supply Chain.'
      ),
      (
        'empathy-ledger',
        'humanitix',
        'saved',
        71,
        'Humanitix is a plausible Empathy Ledger fit where the work is framed around event-linked impact, community programs, and social return. The strongest overlap is around storytelling and events that need a credible community-defined outcomes layer rather than generic post-event reporting.',
        'Lead with Empathy Ledger as the layer that helps social-impact events show governed voice, outcomes, and learning rather than vanity metrics. Keep it grounded in one event-linked pilot rather than a broad platform pitch.',
        'Refine the current event-impact concept into a smaller pilot brief before moving this from saved to priority.',
        'Seeded from ACT pipeline note for Humanitix Foundation — Event Impact Program.'
      ),
      (
        'empathy-ledger',
        'brave',
        'saved',
        68,
        'Brave Foundation fits Empathy Ledger where the work is framed around outcomes tracking for expecting and parenting teens. The alignment is credible but more pilot-specific than system-wide, so it should stay as an exploratory case until the use case is tightened.',
        'Lead with a focused teen-parent outcomes pilot, not the whole Empathy Ledger system. Keep the message on community-defined outcomes and practical reporting support for a specific cohort.',
        'Shape a narrow pilot concept around young-parent outcomes tracking and decide whether this should sit in Empathy Ledger directly or alongside a partner project first.',
        'Seeded from ACT pipeline note for Brave Foundation — Supporting Expecting & Parenting Teens.'
      ),
      (
        'empathy-ledger',
        'arlf',
        'saved',
        64,
        'Australian Rural Leadership Foundation is a support fit for Empathy Ledger in a capability-building sense rather than as a core philanthropy match. The overlap is practitioner leadership and impact capability, not the full storytelling and governance stack.',
        'Lead with leadership development for impact measurement practitioners and community-defined outcomes capability, not with a broad product pitch.',
        'Keep this in the saved lane until there is a clearer training or leadership-specific entry point.',
        'Seeded from ACT pipeline notes for Australian Rural Leadership Foundation programs.'
      )
  ) AS s(
    project_slug,
    foundation_key,
    stage,
    fit_score,
    fit_summary,
    message_alignment,
    next_step,
    notes
  )
)
INSERT INTO org_project_foundations (
  org_profile_id,
  org_project_id,
  foundation_id,
  applicant_entity_id,
  stage,
  fit_score,
  fit_summary,
  message_alignment,
  next_step,
  notes,
  updated_at
)
SELECT
  '8b6160a1-7eea-4bd2-8404-71c196381de0'::uuid AS org_profile_id,
  p.project_id,
  f.foundation_id,
  da.applicant_entity_id,
  s.stage,
  s.fit_score,
  s.fit_summary,
  s.message_alignment,
  s.next_step,
  s.notes,
  now()
FROM seed_rows s
JOIN project_refs p
  ON p.slug = s.project_slug
JOIN foundation_refs f
  ON f.foundation_key = s.foundation_key
LEFT JOIN default_applicant da
  ON true
ON CONFLICT (org_project_id, foundation_id)
DO UPDATE SET
  applicant_entity_id = EXCLUDED.applicant_entity_id,
  stage = EXCLUDED.stage,
  fit_score = EXCLUDED.fit_score,
  fit_summary = EXCLUDED.fit_summary,
  message_alignment = EXCLUDED.message_alignment,
  next_step = EXCLUDED.next_step,
  notes = EXCLUDED.notes,
  updated_at = now();
