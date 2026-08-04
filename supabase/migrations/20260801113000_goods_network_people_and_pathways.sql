-- GOODS people and QBE-aligned pathway map.
--
-- Evidence rules preserved here:
--   * a direct message or user-reported interest is not an ask;
--   * an ask is not a commitment;
--   * a production or capability pathway is not external capital;
--   * private correspondence is stored only as a privacy-safe summary.

BEGIN;

ALTER TABLE public.org_contacts
  ADD COLUMN IF NOT EXISTS goods_relationship_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.org_contacts'::regclass
      AND conname = 'org_contacts_goods_relationship_id_fkey'
  ) THEN
    ALTER TABLE public.org_contacts
      ADD CONSTRAINT org_contacts_goods_relationship_id_fkey
      FOREIGN KEY (goods_relationship_id)
      REFERENCES public.goods_relationships(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_org_contacts_goods_relationship
  ON public.org_contacts (goods_relationship_id)
  WHERE goods_relationship_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_contacts_goods_relationship_name
  ON public.org_contacts (
    org_profile_id,
    project_id,
    goods_relationship_id,
    (lower(btrim(name)))
  )
  WHERE goods_relationship_id IS NOT NULL;

COMMENT ON COLUMN public.org_contacts.goods_relationship_id IS
  'Optional link from a person to the specific GOODS institutional pathway they can help move. A link does not imply endorsement, an ask or a commitment.';

-- -------------------------------------------------------------------------
-- New institutional pathways. Interest evidence and official evidence are
-- deliberately different fields so public research cannot masquerade as a
-- human signal.
-- -------------------------------------------------------------------------

INSERT INTO public.goods_relationships (
  relationship_type,
  display_name,
  entity_id,
  stage,
  target_stage,
  alignment_score,
  last_touch_at,
  next_action,
  next_action_due,
  source_refs,
  notes,
  warmth_computed
)
VALUES
  (
    'impact_investor',
    'The Wyatt Trust — Catalytic Local Investment Fund (CLIF)',
    (SELECT id FROM public.gs_entities WHERE abn = '57292556081' ORDER BY canonical_name LIMIT 1),
    'in_conversation',
    'proposal',
    75,
    NULL,
    'Hold an anti-pitch qualification call with Gavin: confirm South Australian nexus, remaining fund capacity, borrower, use, terms, timing and QBE-usable evidence.',
    '2026-08-05',
    jsonb_build_object(
      'goodsNetwork', true,
      'networkDisplayName', 'The Wyatt Trust / CLIF',
      'networkLane', 'capital',
      'networkPriority', 10,
      'profileUrl', 'https://www.linkedin.com/in/gavin-reid-9b76005a/',
      'interestEvidence', jsonb_build_object(
        'form', 'user_reported',
        'asOf', '2026-08-01',
        'summary', 'Ben reports that Gavin Reid is interested in exploring investment. No ask, amount, terms or commitment is evidenced.',
        'privacy', 'public_summary'
      ),
      'qbeRelevance', 'Potential patient debt for equipment or working capital if the South Australian eligibility test is genuine.',
      'guardrail', 'Interest is not an ask or commitment; CLIF was already 90% subscribed when Wyatt published its April 2026 update.',
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'Wyatt CLIF 2026', 'url', 'https://www.wyatt.org.au/what-we-do/stories/investing-to-catalyse-local-impact-clif/', 'detail', 'Official fund scope, relational process, average loan and current capacity context.'),
        jsonb_build_object('label', 'Wyatt team', 'url', 'https://www.wyatt.org.au/who-we-are/board-and-team/', 'detail', 'Official team page identifies Gavin Reid as Investment Specialist.')
      )
    ),
    'Reported human interest plus a verified patient-capital route. South Australian eligibility, fund capacity and all transaction terms remain open.',
    0
  ),
  (
    'production_partner',
    'Northern Territory Department of Corrections — prisoner-led production pathway',
    NULL,
    'in_conversation',
    'proposal',
    90,
    '2026-08-01T18:21:00+08:00',
    'Hold the scoping call and document workshop capability, training, safety, fair pay, consent, quality, intellectual property, costing and a small pilot path.',
    '2026-08-03',
    jsonb_build_object(
      'goodsNetwork', true,
      'networkDisplayName', 'NT Department of Corrections',
      'networkLane', 'production',
      'networkPriority', 20,
      'profileUrl', 'https://www.linkedin.com/in/bodiegreen/',
      'interestEvidence', jsonb_build_object(
        'form', 'direct_message',
        'asOf', '2026-08-01',
        'summary', 'Bodie directly offered capacity and possible capability to explore production through prisoner-led industry areas and proposed a call.',
        'privacy', 'private_message_safely_summarised'
      ),
      'qbeRelevance', 'Could lower the cost and risk of the measured production run and strengthen the justice-employment proof; it is not external capital.',
      'guardrail', 'No production commitment exists. Any pathway must evidence voluntary fair work, accredited training, safety, quality and community authority.',
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'NT industries, skills and employment', 'url', 'https://corrections.nt.gov.au/corrections/industries-skills-employment-initiative', 'detail', 'Official three-year plan for training, industry partnerships and employment pathways.'),
        jsonb_build_object('label', 'Correctional industries and private business', 'url', 'https://nt.gov.au/law/prisons/correctional-industries-and-private-business', 'detail', 'Official pathway for NT businesses to explore correctional-industry partnerships.')
      )
    ),
    'Direct inbound production interest, safely summarised. Capability, commercial terms and participant safeguards require a scoped written pathway.',
    0
  ),
  (
    'supporter',
    'Origin Energy Foundation — skills and community pathway',
    (SELECT id FROM public.gs_entities WHERE abn = '49008720429' ORDER BY canonical_name LIMIT 1),
    'in_conversation',
    'proposal',
    55,
    NULL,
    'Ask Tania to name the actual pathway: Foundation grant, professional volunteering, in-kind support, investment, or an introduction.',
    '2026-08-06',
    jsonb_build_object(
      'goodsNetwork', true,
      'networkDisplayName', 'Origin Energy Foundation',
      'networkLane', 'support',
      'networkPriority', 30,
      'profileUrl', 'https://www.linkedin.com/in/tania-carlos-37839a77/',
      'interestEvidence', jsonb_build_object(
        'form', 'user_reported',
        'asOf', '2026-08-01',
        'summary', 'Ben reports that Tania Carlos is interested. The instrument, authority, amount and next forum are not yet evidenced.',
        'privacy', 'public_summary'
      ),
      'qbeRelevance', 'Best public fit is education, skills, professional volunteering or in-kind support; a direct capital role is unverified.',
      'guardrail', 'Do not describe Origin Foundation interest as investment until Tania confirms the mechanism and authority.',
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'Origin Foundation', 'url', 'https://www.originfoundation.org.au/who-we-are', 'detail', 'Official education focus and grant, volunteering, matched-giving and in-kind support model.'),
        jsonb_build_object('label', 'Origin Foundation knowledge hub', 'url', 'https://www.originfoundation.org.au/knowledge-hub', 'detail', 'Official site identifies Tania as Senior Manager of Specialist Programs and Volunteering.')
      )
    ),
    'Reported human interest. The public Foundation remit supports education and volunteering; a capital instrument has not been identified.',
    0
  ),
  (
    'production_partner',
    'Charles Darwin University — corrections training pathway',
    (SELECT id FROM public.gs_entities WHERE abn = '54093513649' ORDER BY canonical_name LIMIT 1),
    'researching',
    'contacted',
    80,
    NULL,
    'Ask Bodie whether CDU should join the first capability call as the accredited training and quality partner.',
    '2026-08-07',
    jsonb_build_object(
      'goodsNetwork', true,
      'networkDisplayName', 'Charles Darwin University',
      'networkLane', 'production',
      'networkPriority', 40,
      'interestEvidence', jsonb_build_object(
        'form', 'public_research',
        'asOf', '2026-08-01',
        'summary', 'No GOODS conversation is recorded. CDU is an official NT Corrections training partner and a logical next introduction.'
      ),
      'qbeRelevance', 'Could turn production into an accredited training and employment pathway, strengthening execution evidence rather than capital.',
      'guardrail', 'Research target only; no interest, permission or production commitment has been claimed.',
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'Katherine work camp', 'url', 'https://corrections.nt.gov.au/corrections/new-work-camps', 'detail', 'Official NT page confirms CDU educators and Corrections industry officers will deliver training.'),
        jsonb_build_object('label', 'CDU training partnership', 'url', 'https://www.cdu.edu.au/news/rural-vocational-training-facility-support-rehabilitation-education', 'detail', 'Official CDU page describes the vocational training partnership with the NT Government.')
      )
    ),
    'Officially verified training adjacency only. Seek an introduction through Bodie before treating CDU as engaged.',
    0
  ),
  (
    'funder',
    'Impact Investing Australia — SEDI 2026–27',
    (SELECT id FROM public.gs_entities WHERE abn = '67168178827' ORDER BY canonical_name LIMIT 1),
    'researching',
    'contacted',
    70,
    NULL,
    'Verify the applying entity and trading tests, then cost a capability package before lodging a SEDI EOI.',
    '2026-08-04',
    jsonb_build_object(
      'goodsNetwork', true,
      'networkDisplayName', 'Impact Investing Australia / SEDI',
      'networkLane', 'capability',
      'networkPriority', 50,
      'interestEvidence', jsonb_build_object(
        'form', 'public_research',
        'asOf', '2026-08-01',
        'summary', 'A current rolling grant route has been verified; no EOI or application is recorded.'
      ),
      'qbeRelevance', 'Could pay for the model, legal structure, contracts and impact evidence needed to unlock investment; likely not QBE external capital itself.',
      'guardrail', 'Up to $120K is a program ceiling, not a GOODS target or award.',
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'SEDI 2026–27', 'url', 'https://impactinvestingaustralia.com/looking-for-funding-or-investors/', 'detail', 'Official eligibility and rolling EOI route for capability grants.'),
        jsonb_build_object('label', 'DSS SEDI', 'url', 'https://www.dss.gov.au/social-impact-investing/social-enterprise-development-initiative', 'detail', 'Official Commonwealth overview of the current program and supported capability services.')
      )
    ),
    'Verified current capability route. No EOI, target, application or award is recorded.',
    0
  )
ON CONFLICT (dedupe_key) DO UPDATE SET
  entity_id = COALESCE(EXCLUDED.entity_id, public.goods_relationships.entity_id),
  stage = EXCLUDED.stage,
  target_stage = EXCLUDED.target_stage,
  alignment_score = EXCLUDED.alignment_score,
  last_touch_at = CASE
    WHEN EXCLUDED.last_touch_at IS NULL THEN public.goods_relationships.last_touch_at
    ELSE GREATEST(public.goods_relationships.last_touch_at, EXCLUDED.last_touch_at)
  END,
  next_action = EXCLUDED.next_action,
  next_action_due = EXCLUDED.next_action_due,
  source_refs = public.goods_relationships.source_refs || EXCLUDED.source_refs,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Existing QBE and White Box rows are reconciled in place so GHL IDs and
-- relationship history remain intact.
UPDATE public.goods_relationships
SET
  next_action = 'Get the exact Stage 2 deadline, acceptable external-capital evidence and legal-recipient rule confirmed in writing.',
  next_action_due = '2026-08-03',
  source_refs = source_refs || jsonb_build_object(
    'goodsNetwork', true,
    'networkDisplayName', 'QBE Foundation / Catalysing Impact',
    'networkLane', 'qbe_anchor',
    'networkPriority', 0,
    'interestEvidence', jsonb_build_object('form', 'program_participant', 'asOf', '2026-08-01', 'summary', 'A Curious Tractor is a confirmed 2026 cohort participant; Stage 2 has not been awarded.'),
    'qbeRelevance', 'This is the anchor: a typical $150K-$400K Stage 2 grant may build on external capital secured.',
    'guardrail', 'Program participation is not a Stage 2 award. Exact evidence and timing still need written confirmation.',
    'officialEvidence', jsonb_build_array(
      jsonb_build_object('label', 'Catalysing Impact 2026', 'url', 'https://www.socialimpacthub.org/catalysing-impact', 'detail', 'Official program page describing the two-stage capital model.'),
      jsonb_build_object('label', '2026 cohort', 'url', 'https://www.socialimpacthub.org/news/social-impact-hub-and-qbe-foundation-announce-the-2026-catalysing-impact-cohort-and-up-to-11m-in-grants', 'detail', 'Official announcement naming A Curious Tractor in the 2026 cohort.')
    )
  ),
  updated_at = now()
WHERE relationship_type = 'funder'
  AND display_name = 'QBE Foundation';

UPDATE public.goods_relationships
SET
  alignment_score = 80,
  next_action = 'Book an eligibility call and verify the borrower, trading and employment tests, security, timing and QBE-usable evidence before submitting a SELF EOI.',
  next_action_due = '2026-08-04',
  source_refs = source_refs || jsonb_build_object(
    'goodsNetwork', true,
    'networkDisplayName', 'White Box SELF',
    'networkLane', 'capital',
    'networkPriority', 60,
    'interestEvidence', jsonb_build_object('form', 'crm_contacted', 'asOf', '2026-08-01', 'summary', 'The GHL relationship is marked contacted. No SELF EOI, eligibility decision, terms or commitment is attached.'),
    'qbeRelevance', 'The $100K-$500K patient-loan range can cover equipment or working capital if every public eligibility test passes.',
    'guardrail', 'The current ACT/Butterfly structure is not yet verified as an eligible SELF borrower, and the process can take about three months.',
    'officialEvidence', jsonb_build_array(
      jsonb_build_object('label', 'Social Enterprise Loan Fund', 'url', 'https://whiteboxenterprises.com.au/innovate/self/', 'detail', 'Official loan range, pricing, term, eligibility and application process.')
    )
  ),
  notes = 'GHL contact signal plus a verified named loan route. Public borrower, trading, employment and evidence tests still require a formal eligibility check.',
  updated_at = now()
WHERE relationship_type = 'funder'
  AND display_name = 'White Box SELF — social enterprise loan pathway';

-- -------------------------------------------------------------------------
-- Three named people. No private phone, email or verbatim correspondence is
-- copied to this public-facing model.
-- -------------------------------------------------------------------------

WITH context AS (
  SELECT
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1) AS org_profile_id,
    (SELECT id FROM public.org_projects WHERE code = 'ACT-GD' LIMIT 1) AS project_id
),
contact_rows (
  name,
  role,
  organisation,
  contact_type,
  linkedin_url,
  notes,
  last_contacted_at,
  linked_entity_id,
  expertise,
  engagement_ask,
  relationship_type,
  relationship_name
) AS (
  VALUES
    (
      'Gavin Reid',
      'Investment Specialist',
      'The Wyatt Trust',
      'funder',
      'https://www.linkedin.com/in/gavin-reid-9b76005a/',
      'Ben reports current interest in exploring investment. Wyatt role and CLIF pathway are publicly verified; no ask, amount, terms, eligibility decision or commitment is recorded.',
      NULL::timestamptz,
      (SELECT id FROM public.gs_entities WHERE abn = '57292556081' ORDER BY canonical_name LIMIT 1),
      ARRAY['impact investing', 'patient capital', 'social enterprise', 'financial modelling']::text[],
      'Confirm South Australian eligibility, remaining CLIF capacity, likely borrower, use, terms, timing and QBE evidence.',
      'impact_investor',
      'The Wyatt Trust — Catalytic Local Investment Fund (CLIF)'
    ),
    (
      'Bodie Green',
      'Assistant Commissioner; Operational Reform',
      'Northern Territory Department of Corrections',
      'partner',
      'https://www.linkedin.com/in/bodiegreen/',
      'Direct inbound interest: Bodie offered capacity and possible capability to explore bed production through prisoner-led industry areas. No production commitment or commercial terms exist yet.',
      '2026-08-01T18:21:00+08:00'::timestamptz,
      NULL::uuid,
      ARRAY['correctional industries', 'operational reform', 'production pathways', 'justice employment']::text[],
      'Schedule the scoping call and document workshop capability, training, safeguards, quality, costing and a pilot path.',
      'production_partner',
      'Northern Territory Department of Corrections — prisoner-led production pathway'
    ),
    (
      'Tania Carlos',
      'Senior Manager, Specialist Programs and Volunteering',
      'Origin Energy Foundation',
      'funder',
      'https://www.linkedin.com/in/tania-carlos-37839a77/',
      'Ben reports current interest. Tania’s Origin Foundation role and public education and volunteering remit are verified; the mechanism, authority, amount and next step are not.',
      NULL::timestamptz,
      (SELECT id FROM public.gs_entities WHERE abn = '49008720429' ORDER BY canonical_name LIMIT 1),
      ARRAY['community investment', 'First Nations engagement', 'education philanthropy', 'corporate volunteering']::text[],
      'Clarify whether the pathway is a Foundation grant, professional volunteering, in-kind support, investment, or an introduction.',
      'supporter',
      'Origin Energy Foundation — skills and community pathway'
    )
),
resolved AS (
  SELECT
    c.*,
    r.id AS goods_relationship_id,
    context.org_profile_id,
    context.project_id
  FROM contact_rows c
  CROSS JOIN context
  JOIN public.goods_relationships r
    ON r.relationship_type = c.relationship_type
   AND lower(btrim(r.display_name)) = lower(btrim(c.relationship_name))
)
INSERT INTO public.org_contacts (
  org_profile_id,
  project_id,
  name,
  role,
  organisation,
  contact_type,
  linkedin_url,
  notes,
  last_contacted_at,
  linked_entity_id,
  expertise,
  engagement_ask,
  goods_relationship_id
)
SELECT
  org_profile_id,
  project_id,
  name,
  role,
  organisation,
  contact_type,
  linkedin_url,
  notes,
  last_contacted_at,
  linked_entity_id,
  expertise,
  engagement_ask,
  goods_relationship_id
FROM resolved
WHERE org_profile_id IS NOT NULL
  AND project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.org_contacts existing
    WHERE existing.org_profile_id = resolved.org_profile_id
      AND existing.project_id = resolved.project_id
      AND lower(btrim(existing.name)) = lower(btrim(resolved.name))
  );

WITH contact_rows (
  name,
  role,
  organisation,
  contact_type,
  linkedin_url,
  notes,
  last_contacted_at,
  linked_entity_id,
  expertise,
  engagement_ask,
  relationship_type,
  relationship_name
) AS (
  VALUES
    ('Gavin Reid', 'Investment Specialist', 'The Wyatt Trust', 'funder', 'https://www.linkedin.com/in/gavin-reid-9b76005a/', 'Ben reports current interest in exploring investment. Wyatt role and CLIF pathway are publicly verified; no ask, amount, terms, eligibility decision or commitment is recorded.', NULL::timestamptz, (SELECT id FROM public.gs_entities WHERE abn = '57292556081' ORDER BY canonical_name LIMIT 1), ARRAY['impact investing', 'patient capital', 'social enterprise', 'financial modelling']::text[], 'Confirm South Australian eligibility, remaining CLIF capacity, likely borrower, use, terms, timing and QBE evidence.', 'impact_investor', 'The Wyatt Trust — Catalytic Local Investment Fund (CLIF)'),
    ('Bodie Green', 'Assistant Commissioner; Operational Reform', 'Northern Territory Department of Corrections', 'partner', 'https://www.linkedin.com/in/bodiegreen/', 'Direct inbound interest: Bodie offered capacity and possible capability to explore bed production through prisoner-led industry areas. No production commitment or commercial terms exist yet.', '2026-08-01T18:21:00+08:00'::timestamptz, NULL::uuid, ARRAY['correctional industries', 'operational reform', 'production pathways', 'justice employment']::text[], 'Schedule the scoping call and document workshop capability, training, safeguards, quality, costing and a pilot path.', 'production_partner', 'Northern Territory Department of Corrections — prisoner-led production pathway'),
    ('Tania Carlos', 'Senior Manager, Specialist Programs and Volunteering', 'Origin Energy Foundation', 'funder', 'https://www.linkedin.com/in/tania-carlos-37839a77/', 'Ben reports current interest. Tania’s Origin Foundation role and public education and volunteering remit are verified; the mechanism, authority, amount and next step are not.', NULL::timestamptz, (SELECT id FROM public.gs_entities WHERE abn = '49008720429' ORDER BY canonical_name LIMIT 1), ARRAY['community investment', 'First Nations engagement', 'education philanthropy', 'corporate volunteering']::text[], 'Clarify whether the pathway is a Foundation grant, professional volunteering, in-kind support, investment, or an introduction.', 'supporter', 'Origin Energy Foundation — skills and community pathway')
)
UPDATE public.org_contacts existing
SET
  role = c.role,
  organisation = c.organisation,
  contact_type = c.contact_type,
  linkedin_url = c.linkedin_url,
  notes = c.notes,
  last_contacted_at = COALESCE(c.last_contacted_at, existing.last_contacted_at),
  linked_entity_id = COALESCE(c.linked_entity_id, existing.linked_entity_id),
  expertise = c.expertise,
  engagement_ask = c.engagement_ask,
  goods_relationship_id = relationship.id,
  updated_at = now()
FROM contact_rows c
JOIN public.goods_relationships relationship
  ON relationship.relationship_type = c.relationship_type
 AND lower(btrim(relationship.display_name)) = lower(btrim(c.relationship_name))
WHERE existing.org_profile_id = (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1)
  AND existing.project_id = (SELECT id FROM public.org_projects WHERE code = 'ACT-GD' LIMIT 1)
  AND lower(btrim(existing.name)) = lower(btrim(c.name));

-- -------------------------------------------------------------------------
-- Two newly verified funding matters. Neither receives a planning target,
-- allocation, ask date or commitment amount in this migration.
-- -------------------------------------------------------------------------

INSERT INTO public.goods_funding_matters (
  org_profile_id,
  project_code,
  slug,
  title,
  counterparty_name,
  counterparty_entity_id,
  purpose,
  why_now,
  current_learning_question,
  evidence_gaps,
  authority_state,
  official_source_url,
  source_refs,
  next_review_at
)
VALUES
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'wyatt-clif-conversation',
    'Qualify The Wyatt Trust CLIF conversation',
    'The Wyatt Trust',
    (SELECT id FROM public.gs_entities WHERE abn = '57292556081' ORDER BY canonical_name LIMIT 1),
    'Explore patient debt for production equipment or working capital through a relationship-led conversation with Gavin Reid, without turning reported interest into an ask or commitment.',
    'Ben reports current interest from Gavin Reid. Wyatt publicly describes a structure-agnostic South Australian patient-capital fund with an average loan of about $150K, but the fund was already 90% subscribed in April 2026.',
    'Is GOODS genuinely eligible as a South Australian business or operation, is CLIF capacity still available, and what evidence would Wyatt need to consider a facility?',
    ARRAY['South Australian eligibility and operating nexus', 'Remaining CLIF capacity', 'Borrower and use of funds', 'Ticket, terms and security', 'Current ask evidence', 'QBE match treatment'],
    'not_required',
    'https://www.wyatt.org.au/what-we-do/stories/investing-to-catalyse-local-impact-clif/',
    jsonb_build_object(
      'catalogue', jsonb_build_object('themes', jsonb_build_array('patient capital', 'people and planet', 'local enterprise', 'impact investing'), 'geography', 'South Australia'),
      'interestEvidence', jsonb_build_object('form', 'user_reported', 'asOf', '2026-08-01', 'summary', 'Ben reports that Gavin is interested in exploring investment. No ask, amount, terms or commitment has been evidenced.'),
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'Wyatt CLIF 2026', 'url', 'https://www.wyatt.org.au/what-we-do/stories/investing-to-catalyse-local-impact-clif/', 'checkedAt', '2026-08-01', 'detail', 'CLIF is structure-agnostic patient capital for South Australian businesses. It starts with a conversation, has an average loan of about $150K, and was 90% subscribed when published in April 2026.'),
        jsonb_build_object('label', 'Wyatt team', 'url', 'https://www.wyatt.org.au/who-we-are/board-and-team/', 'checkedAt', '2026-08-01', 'detail', 'Wyatt identifies Gavin Reid as Investment Specialist supporting its Investment Committee and impact outcomes.')
      )
    ),
    '2026-08-05T09:00:00+08:00'
  ),
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'sedi-capability-2026-27',
    'Test the 2026–27 SEDI capability grant',
    'Impact Investing Australia / Department of Social Services',
    (SELECT id FROM public.gs_entities WHERE abn = '67168178827' ORDER BY canonical_name LIMIT 1),
    'Fund the financial model, investment readiness, contracting, legal structure and impact measurement needed to unlock capital, rather than misclassifying capability support as production cash.',
    'The 2026–27 round is open on a rolling basis until funds are exhausted, with grants up to $120K for eligible social enterprises to purchase capability-building services.',
    'Does the current GOODS entity pass the trading-revenue and direct-benefit tests, and which costed capability package would most directly unlock the QBE capital raise?',
    ARRAY['Eligible applying entity', 'More than $50K annual trading revenue', 'Direct entrenched-disadvantage benefit', 'Costed capability providers', 'Funds remaining', 'QBE match treatment'],
    'unknown',
    'https://impactinvestingaustralia.com/looking-for-funding-or-investors/',
    jsonb_build_object(
      'catalogue', jsonb_build_object('themes', jsonb_build_array('social enterprise', 'investment readiness', 'financial management', 'impact measurement'), 'geography', 'Australia'),
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'SEDI 2026–27 grants', 'url', 'https://impactinvestingaustralia.com/looking-for-funding-or-investors/', 'checkedAt', '2026-08-01', 'detail', 'Rolling grants of up to $120K support eligible social enterprises to purchase capability services. Public tests include Australian operation, direct benefit for people experiencing disadvantage and more than $50K annual trading revenue.'),
        jsonb_build_object('label', 'Department of Social Services SEDI', 'url', 'https://www.dss.gov.au/social-impact-investing/social-enterprise-development-initiative', 'checkedAt', '2026-08-01', 'detail', 'DSS confirms 2026–27 applications opened on 8 May 2026 and can support business planning, financial management, legal work, contract negotiation, outcomes measurement and access to finance.')
      )
    ),
    '2026-08-04T09:00:00+08:00'
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.goods_funding_routes (
  matter_id,
  route_code,
  route_type,
  named_route,
  legal_recipient_name,
  legal_recipient_basis,
  eligibility_state,
  instrument_label,
  target_amount_aud,
  application_state,
  commitment_state,
  commitment_evidence_form,
  match_assessment,
  match_assessment_reason,
  official_source_url,
  official_source_checked_at,
  application_url,
  next_action,
  next_action_owner,
  next_action_due,
  evidence_gaps,
  source_refs
)
VALUES
  (
    (SELECT id FROM public.goods_funding_matters WHERE slug = 'wyatt-clif-conversation'),
    'wyatt-clif-route',
    'repayable_finance',
    'The Wyatt Trust Catalytic Local Investment Fund (CLIF)',
    'A Curious Tractor Pty Ltd (t/a Goods on Country)',
    'A company can be eligible because CLIF is structure agnostic, but the business must satisfy the fund’s South Australian focus and due diligence.',
    'conditional',
    'Patient or concessional debt — amount and terms not requested',
    NULL,
    'concept',
    'none',
    'none',
    'unknown',
    'No ask or facility exists, and QBE has not ruled on what CLIF evidence would count.',
    'https://www.wyatt.org.au/what-we-do/stories/investing-to-catalyse-local-impact-clif/',
    '2026-08-01T09:00:00+08:00',
    NULL,
    'Send Gavin the existing model and hold an anti-pitch qualification call: confirm SA nexus, current fund capacity, borrower, use, likely terms, timing and what could be documented for QBE.',
    'Ben',
    '2026-08-05',
    ARRAY['South Australian eligibility', 'Remaining fund capacity', 'Borrower and use', 'Terms and security', 'Ask status', 'QBE match treatment'],
    jsonb_build_object('interestEvidence', 'user_reported', 'askMade', 'no', 'targetAmountAud', NULL)
  ),
  (
    (SELECT id FROM public.goods_funding_matters WHERE slug = 'sedi-capability-2026-27'),
    'sedi-capability-2026-27-route',
    'grant',
    'SEDI 2026–27 Capability Building Grants',
    'A Curious Tractor Pty Ltd or The Butterfly Movement Ltd — verify the qualifying social enterprise before EOI',
    'SEDI can support for-profit or non-profit social enterprises, but the applicant must itself satisfy the trading, direct-benefit and scale-readiness tests.',
    'conditional',
    'Capability-building grant up to $120K — no GOODS target set',
    NULL,
    'researching',
    'none',
    'none',
    'unknown',
    'SEDI buys capability services and is not itself equipment or working capital; QBE must confirm whether it has any external-capital relevance.',
    'https://impactinvestingaustralia.com/looking-for-funding-or-investors/',
    '2026-08-01T09:00:00+08:00',
    'https://impactinvestingaustralia.com/looking-for-funding-or-investors/',
    'Run a 30-minute eligibility check, choose the applying entity and cost a provider package for the model, legal structure, contracts and impact evidence before lodging an EOI.',
    'Ben',
    '2026-08-04',
    ARRAY['Applying entity', 'Trading revenue', 'Direct-benefit evidence', 'Provider scope and budget', 'Funds remaining', 'QBE treatment'],
    jsonb_build_object('discoveredAt', '2026-08-01', 'publicMaximumAud', 120000, 'targetAmountAud', NULL, 'askMade', 'no')
  )
ON CONFLICT (route_code) DO NOTHING;

-- Reconcile the existing White Box funding matter with the now-verified SELF
-- route without creating an ask, allocation or commitment.
UPDATE public.goods_funding_matters
SET
  purpose = 'Test the named Social Enterprise Loan Fund (SELF) as patient finance for GOODS equipment or working capital without assuming the current legal structure is eligible.',
  why_now = 'SELF expressions of interest are open and the published $100K-$500K loan range covers the $150K target, but the public tests include PBI/DGR status, trading history, trading revenue and employment-pathway evidence.',
  current_learning_question = 'Can one current GOODS entity satisfy every SELF eligibility test and borrow for the operating activity that will repay the loan?',
  evidence_gaps = ARRAY['Qualifying legal recipient', 'Two-year social-enterprise operating history', 'Trading-revenue tests', 'Employment-pathway evidence', 'Current EOI or ask evidence', 'Capital-block allocation'],
  official_source_url = 'https://whiteboxenterprises.com.au/innovate/self/',
  source_refs = source_refs || jsonb_build_object(
    'catalogue', jsonb_build_object('themes', jsonb_build_array('social enterprise', 'finance', 'employment'), 'geography', 'Australia'),
    'officialEvidence', jsonb_build_array(
      jsonb_build_object('label', 'Social Enterprise Loan Fund (SELF)', 'url', 'https://whiteboxenterprises.com.au/innovate/self/', 'checkedAt', '2026-08-01', 'detail', 'EOIs are open for $100K-$500K patient loans at 6.5%-9.5% for up to seven years. Public eligibility includes legal-entity, trading, employment and evidence tests; this page is not evidence that GOODS passes them.')
    )
  ),
  next_review_at = '2026-08-04T09:00:00+08:00',
  updated_at = now()
WHERE slug = 'white-box-150k';

UPDATE public.goods_funding_routes
SET
  route_type = 'repayable_finance',
  named_route = 'Social Enterprise Loan Fund (SELF)',
  legal_recipient_name = 'The Butterfly Movement Ltd — only if verified as the qualifying trading social enterprise',
  legal_recipient_basis = 'SELF publicly requires a qualifying not-for-profit or Indigenous business with PBI/DGR status plus trading, revenue and employment-pathway evidence. The current GOODS operating structure has not been verified against every test.',
  eligibility_state = 'conditional',
  instrument_label = 'Patient loan: $100K-$500K, 6.5%-9.5%, up to seven years',
  match_assessment = 'unknown',
  match_assessment_reason = 'SELF is repayable finance, but QBE has not confirmed whether an EOI, conditional approval or executed SELF loan would satisfy its external-capital evidence rule.',
  official_source_url = 'https://whiteboxenterprises.com.au/innovate/self/',
  official_source_checked_at = '2026-08-01T09:00:00+08:00',
  application_url = 'https://whiteboxenterprises.com.au/innovate/self/',
  next_action = 'Book an eligibility call before submitting an EOI; verify the borrower, trading tests, workforce evidence, security, three-month timing and whether White Box can provide QBE-usable conditional evidence.',
  next_action_due = '2026-08-04',
  evidence_gaps = ARRAY['Qualifying borrower', 'Trading history and revenue', 'Employment-pathway evidence', 'Security and repayment capacity', 'EOI status', 'Block allocation', 'QBE match treatment'],
  source_refs = source_refs || jsonb_build_object('publicLoanRangeAud', jsonb_build_array(100000, 500000), 'publicRateRange', '6.5%-9.5%', 'publicTerm', 'up to seven years'),
  updated_at = now()
WHERE route_code = 'white-box-150k-route';

UPDATE public.goods_relationships
SET warmth_computed = public.goods_compute_warmth(
  stage,
  last_touch_at,
  total_received_aud,
  alignment_score,
  has_prior_support,
  advocacy_score
)
WHERE source_refs @> '{"goodsNetwork": true}'::jsonb;

COMMIT;
