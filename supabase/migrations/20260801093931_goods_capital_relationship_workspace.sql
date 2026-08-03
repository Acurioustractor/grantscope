-- GOODS capital and relationship workspace.
--
-- This is deliberately a matter-and-evidence model, not a replacement CRM:
--   * a discovery signal is not a funding matter;
--   * a target amount is not an ask made;
--   * an ask is not a commitment;
--   * a written commitment is not cash received;
--   * relationship quality is never represented by a score or pipeline stage.

BEGIN;

CREATE TABLE IF NOT EXISTS public.goods_capital_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid REFERENCES public.org_profiles(id) ON DELETE CASCADE,
  project_code text NOT NULL DEFAULT 'ACT-GD',
  code text NOT NULL,
  name text NOT NULL,
  purpose text NOT NULL,
  amount_min_aud numeric NOT NULL CHECK (amount_min_aud >= 0),
  amount_max_aud numeric NOT NULL CHECK (amount_max_aud >= amount_min_aud),
  receiving_entity_kind text NOT NULL
    CHECK (receiving_entity_kind IN ('charity', 'company')),
  receiving_entity_name text NOT NULL,
  allowed_instruments text[] NOT NULL DEFAULT '{}',
  target_by date,
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'funded', 'paused', 'closed')),
  source_refs jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_refs) = 'object'),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_code, code)
);

COMMENT ON TABLE public.goods_capital_blocks IS
  'The concrete GOODS uses of capital. Amounts are requirements, not pipeline or commitments.';

CREATE TABLE IF NOT EXISTS public.goods_funding_matters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid REFERENCES public.org_profiles(id) ON DELETE CASCADE,
  project_code text NOT NULL DEFAULT 'ACT-GD',
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  counterparty_name text NOT NULL,
  counterparty_entity_id uuid REFERENCES public.gs_entities(id) ON DELETE SET NULL,
  purpose text NOT NULL,
  state text NOT NULL DEFAULT 'open'
    CHECK (state IN ('open', 'closed')),
  why_now text,
  current_learning_question text,
  evidence_gaps text[] NOT NULL DEFAULT '{}',
  authority_state text NOT NULL DEFAULT 'unknown'
    CHECK (authority_state IN ('not_required', 'unknown', 'asserted', 'evidenced', 'confirmed', 'contested', 'expired')),
  community_authority_ref text,
  protection_floor text NOT NULL DEFAULT 'internal',
  source_opportunity_id uuid REFERENCES public.act_opportunity_observatory(id) ON DELETE SET NULL,
  official_source_url text,
  source_refs jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_refs) = 'object'),
  next_review_at timestamptz,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state = 'closed') = (closed_at IS NOT NULL))
);

COMMENT ON TABLE public.goods_funding_matters IS
  'A bounded GOODS matter involving real parties and a concrete question. Open/closed is not a relationship stage.';

CREATE TABLE IF NOT EXISTS public.goods_funding_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.goods_funding_matters(id) ON DELETE CASCADE,
  route_code text NOT NULL UNIQUE,
  route_type text NOT NULL
    CHECK (route_type IN ('grant', 'matched_grant', 'repayable_finance', 'equipment_finance', 'working_capital', 'procurement', 'in_kind', 'other')),
  named_route text,
  legal_recipient_name text,
  legal_recipient_basis text,
  eligibility_state text NOT NULL DEFAULT 'unknown'
    CHECK (eligibility_state IN ('unknown', 'conditional', 'eligible', 'ineligible')),
  instrument_label text,
  target_amount_aud numeric CHECK (target_amount_aud IS NULL OR target_amount_aud >= 0),
  ask_made_at timestamptz,
  application_state text NOT NULL DEFAULT 'concept'
    CHECK (application_state IN ('researching', 'concept', 'invited', 'drafting', 'ready', 'submitted', 'due_diligence', 'decided', 'withdrawn', 'closed')),
  commitment_state text NOT NULL DEFAULT 'none'
    CHECK (commitment_state IN ('none', 'proposed', 'offered', 'accepted', 'fulfilled', 'changed', 'declined', 'released', 'contested')),
  commitment_amount_aud numeric CHECK (commitment_amount_aud IS NULL OR commitment_amount_aud >= 0),
  commitment_evidence_form text NOT NULL DEFAULT 'none'
    CHECK (commitment_evidence_form IN ('none', 'verbal', 'email', 'letter', 'executed_agreement')),
  commitment_evidence_ref text,
  match_assessment text NOT NULL DEFAULT 'unknown'
    CHECK (match_assessment IN ('unknown', 'eligible', 'ineligible')),
  match_assessment_reason text,
  official_source_url text,
  official_source_checked_at timestamptz,
  decision_due_at timestamptz,
  submitted_at timestamptz,
  ghl_opportunity_id text,
  notion_url text,
  application_url text,
  next_action text,
  next_action_owner text,
  next_action_due date,
  evidence_gaps text[] NOT NULL DEFAULT '{}',
  source_refs jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_refs) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    commitment_state = 'none'
    OR commitment_amount_aud IS NOT NULL
  ),
  CHECK (
    commitment_evidence_form = 'none'
    OR commitment_evidence_ref IS NOT NULL
  )
);

COMMENT ON TABLE public.goods_funding_routes IS
  'A grant, finance, procurement or other capital route. Target, ask, commitment evidence and cash remain separate facts.';

CREATE TABLE IF NOT EXISTS public.goods_route_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.goods_funding_routes(id) ON DELETE CASCADE,
  capital_block_id uuid NOT NULL REFERENCES public.goods_capital_blocks(id) ON DELETE CASCADE,
  proposed_amount_aud numeric CHECK (proposed_amount_aud IS NULL OR proposed_amount_aud >= 0),
  accepted_amount_aud numeric CHECK (accepted_amount_aud IS NULL OR accepted_amount_aud >= 0),
  restrictions text,
  allocation_evidence_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, capital_block_id)
);

COMMENT ON TABLE public.goods_route_allocations IS
  'Explicit many-to-many allocation of a funding route to GOODS capital blocks. Unallocated targets never cover a block.';

-- Xero-backed tranches remain the cash source of truth. This nullable link lets
-- a received tranche be attributed to a current route without duplicating cash.
ALTER TABLE IF EXISTS public.goods_tranches
  ADD COLUMN IF NOT EXISTS funding_route_id uuid;

DO $$
BEGIN
  IF to_regclass('public.goods_tranches') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.goods_tranches'::regclass
        AND conname = 'goods_tranches_funding_route_id_fkey'
    )
  THEN
    ALTER TABLE public.goods_tranches
      ADD CONSTRAINT goods_tranches_funding_route_id_fkey
      FOREIGN KEY (funding_route_id)
      REFERENCES public.goods_funding_routes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_goods_capital_blocks_project
  ON public.goods_capital_blocks (project_code, state, sort_order);
CREATE INDEX IF NOT EXISTS idx_goods_funding_matters_attention
  ON public.goods_funding_matters (project_code, state, next_review_at);
CREATE INDEX IF NOT EXISTS idx_goods_funding_matters_counterparty
  ON public.goods_funding_matters (counterparty_entity_id)
  WHERE counterparty_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goods_funding_routes_matter
  ON public.goods_funding_routes (matter_id, application_state);
CREATE INDEX IF NOT EXISTS idx_goods_funding_routes_action
  ON public.goods_funding_routes (next_action_due)
  WHERE next_action IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goods_funding_routes_ghl
  ON public.goods_funding_routes (ghl_opportunity_id)
  WHERE ghl_opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goods_route_allocations_block
  ON public.goods_route_allocations (capital_block_id);
CREATE INDEX IF NOT EXISTS idx_goods_tranches_funding_route
  ON public.goods_tranches (funding_route_id)
  WHERE funding_route_id IS NOT NULL;

DROP TRIGGER IF EXISTS goods_capital_blocks_updated_at ON public.goods_capital_blocks;
CREATE TRIGGER goods_capital_blocks_updated_at
  BEFORE UPDATE ON public.goods_capital_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS goods_funding_matters_updated_at ON public.goods_funding_matters;
CREATE TRIGGER goods_funding_matters_updated_at
  BEFORE UPDATE ON public.goods_funding_matters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS goods_funding_routes_updated_at ON public.goods_funding_routes;
CREATE TRIGGER goods_funding_routes_updated_at
  BEFORE UPDATE ON public.goods_funding_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS goods_route_allocations_updated_at ON public.goods_route_allocations;
CREATE TRIGGER goods_route_allocations_updated_at
  BEFORE UPDATE ON public.goods_route_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.goods_capital_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_funding_matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_funding_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_route_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages GOODS capital blocks" ON public.goods_capital_blocks;
CREATE POLICY "Service role manages GOODS capital blocks"
  ON public.goods_capital_blocks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages GOODS funding matters" ON public.goods_funding_matters;
CREATE POLICY "Service role manages GOODS funding matters"
  ON public.goods_funding_matters FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages GOODS funding routes" ON public.goods_funding_routes;
CREATE POLICY "Service role manages GOODS funding routes"
  ON public.goods_funding_routes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages GOODS route allocations" ON public.goods_route_allocations;
CREATE POLICY "Service role manages GOODS route allocations"
  ON public.goods_route_allocations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- -------------------------------------------------------------------------
-- Canonical GOODS capital blocks as at 1 August 2026.
-- -------------------------------------------------------------------------

INSERT INTO public.goods_capital_blocks (
  org_profile_id,
  project_code,
  code,
  name,
  purpose,
  amount_min_aud,
  amount_max_aud,
  receiving_entity_kind,
  receiving_entity_name,
  allowed_instruments,
  state,
  source_refs,
  sort_order
)
VALUES
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'measured-run',
    'Measured 50-bed run',
    'A timed and fully costed production run that proves delivered cost and production throughput.',
    60000,
    80000,
    'charity',
    'The Butterfly Movement Ltd (Item 1 DGR + PBI, ABN 22 155 132 684)',
    ARRAY['grant'],
    'active',
    jsonb_build_object('source', 'GOODS funder search brief', 'asOf', '2026-08-01'),
    10
  ),
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'operating-cover',
    'Operating cover',
    'Full-cost operating cover while bed volume and earned revenue increase.',
    110000,
    165000,
    'charity',
    'The Butterfly Movement Ltd (Item 1 DGR + PBI, ABN 22 155 132 684)',
    ARRAY['grant', 'unrestricted_grant'],
    'active',
    jsonb_build_object('source', 'GOODS funder search brief', 'asOf', '2026-08-01'),
    20
  ),
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'servicing-scoping',
    'Servicing and site scoping',
    'Service existing deployments and scope the first on-Country manufacturing site.',
    5000,
    8000,
    'charity',
    'The Butterfly Movement Ltd (Item 1 DGR + PBI, ABN 22 155 132 684)',
    ARRAY['grant', 'in_kind'],
    'active',
    jsonb_build_object('source', 'GOODS funder search brief', 'asOf', '2026-08-01'),
    30
  ),
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'equipment',
    'Production equipment',
    'Press line, shredder and CNC router required for repeatable production capacity.',
    112000,
    222000,
    'company',
    'A Curious Tractor Pty Ltd (t/a Goods on Country)',
    ARRAY['repayable_finance', 'equipment_finance', 'catalytic_capital'],
    'active',
    jsonb_build_object('source', 'GOODS funder search brief', 'asOf', '2026-08-01'),
    40
  ),
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'working-capital',
    'Working capital',
    'Order-backed or patient working capital derived from actual debtor behaviour.',
    80000,
    145000,
    'company',
    'A Curious Tractor Pty Ltd (t/a Goods on Country)',
    ARRAY['repayable_finance', 'working_capital', 'catalytic_capital'],
    'active',
    jsonb_build_object('source', 'GOODS funder search brief', 'asOf', '2026-08-01'),
    50
  )
ON CONFLICT (project_code, code) DO UPDATE SET
  name = EXCLUDED.name,
  purpose = EXCLUDED.purpose,
  amount_min_aud = EXCLUDED.amount_min_aud,
  amount_max_aud = EXCLUDED.amount_max_aud,
  receiving_entity_kind = EXCLUDED.receiving_entity_kind,
  receiving_entity_name = EXCLUDED.receiving_entity_name,
  allowed_instruments = EXCLUDED.allowed_instruments,
  source_refs = EXCLUDED.source_refs,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- -------------------------------------------------------------------------
-- One truth-reset matter plus the six $925K GHL targets. These are targets,
-- not proof that an ask was sent or a commitment made. No allocations are
-- seeded: each target must be explicitly tied to a capital block by a human.
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
    'qbe-stage-2-truth-reset',
    'Confirm the QBE Stage 2 capital rule and exact deadline',
    'QBE Foundation / Social Impact Hub',
    NULL,
    'Establish one written campaign fact record before any external matched-capital claim is made.',
    'The public 2026 page confirms GOODS is in the cohort and says Stage 2 grants are typically $150K-$400K linked to external funding secured, but the exact private deadline and acceptable commitment evidence remain unverified.',
    'What exact evidence, timing and legal-recipient conditions will QBE accept for the GOODS Stage 2 application?',
    ARRAY[
      'Exact Stage 2 closing date is not confirmed in writing',
      'Acceptable commitment-letter wording is not confirmed in writing',
      'Whether each proposed instrument is match-eligible is unknown'
    ],
    'not_required',
    'https://www.socialimpacthub.org/catalysing-impact',
    jsonb_build_object(
      'officialEvidence', jsonb_build_array(
        jsonb_build_object(
          'label', 'Catalysing Impact 2026',
          'url', 'https://www.socialimpacthub.org/catalysing-impact',
          'checkedAt', '2026-08-01',
          'detail', 'Public page confirms the two-stage model and typical Stage 2 catalytic grants of $150K-$400K linked to external funding secured.'
        )
      ),
      'privateBrief', 'Late September 2026 and dollar-for-dollar matching are internal claims awaiting written program confirmation.'
    ),
    '2026-08-03T09:00:00+08:00'
  ),
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'sefa-300k',
    'SEFA $300K repayable-capital target',
    'Social Enterprise Finance Australia (SEFA)',
    (SELECT id FROM public.gs_entities WHERE abn = '20611058185' ORDER BY canonical_name LIMIT 1),
    'Explore patient equipment and working-capital finance for the company without treating a CRM target as a lender commitment.',
    'The $300K target is in GHL, but the named product, amount, lending entity, current thread and QBE treatment are not verified.',
    'Is there a direct SEFA facility that can cover $300K, given the public Backing the Bold pathway was capped at $200K and closed on 31 July?',
    ARRAY[
      'Named $300K SEFA product or direct facility is not verified',
      'Repayment terms and security are unknown',
      'Company migration and trading-history treatment need lender confirmation',
      'No capital-block allocation has been approved'
    ],
    'not_required',
    'https://www.sefapartnerships.org.au/programs/backing-the-bold',
    jsonb_build_object(
      'catalogue', jsonb_build_object('themes', jsonb_build_array('social enterprise', 'community', 'housing', 'Indigenous'), 'geography', 'Australia'),
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'Backing the Bold', 'url', 'https://www.sefapartnerships.org.au/programs/backing-the-bold', 'checkedAt', '2026-08-01', 'detail', 'Public route offered support and access to loans up to $200K; the national intake closed 31 July 2026.'),
        jsonb_build_object('label', 'SEFA Partnerships', 'url', 'https://www.sefapartnerships.org.au/', 'checkedAt', '2026-08-01', 'detail', 'Public mission supports impact-led organisations with flexible finance, capability and connections.')
      )
    ),
    '2026-08-04T09:00:00+08:00'
  ),
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'snow-150k',
    'Snow Foundation $150K grant target',
    'The Snow Foundation',
    (SELECT id FROM public.gs_entities WHERE abn = '49411415493' ORDER BY canonical_name LIMIT 1),
    'Test whether existing support can become a clearly allocated full-cost grant and, separately, acceptable QBE commitment evidence.',
    'A $150K target is in GHL. Existing and historical Snow support must remain separate from this new target.',
    'Which current GOODS cost block would Snow support, through which legal grant route, and what written evidence could it provide?',
    ARRAY[
      'Current $150K ask status is not evidenced',
      'Funding-block allocation is not agreed',
      'QBE match eligibility is not confirmed',
      'Decision timing is unknown'
    ],
    'unknown',
    'https://www.snowfoundation.org.au/news/our-path-forward-introducing-our-new-strategy-to-grow-impact-and-back-community-led-change/',
    jsonb_build_object(
      'catalogue', jsonb_build_object('themes', jsonb_build_array('community', 'First Nations', 'systems change'), 'geography', 'Canberra, NSW and selected national initiatives'),
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'Snow strategy', 'url', 'https://www.snowfoundation.org.au/news/our-path-forward-introducing-our-new-strategy-to-grow-impact-and-back-community-led-change/', 'checkedAt', '2026-08-01', 'detail', 'Snow describes a long-term, community-led and trust-based approach.'),
        jsonb_build_object('label', 'Snow grant FAQs', 'url', 'https://www.snowfoundation.org.au/grants/faqs/', 'checkedAt', '2026-08-01', 'detail', 'National initiatives are targeted and organisations are encouraged to discuss aligned new initiatives with the team.')
      )
    ),
    '2026-08-05T09:00:00+08:00'
  ),
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'tim-fairfax-150k',
    'Tim Fairfax Family Foundation $150K grant target',
    'Tim Fairfax Family Foundation',
    (SELECT id FROM public.gs_entities WHERE abn = '62124526760' ORDER BY canonical_name LIMIT 1),
    'Explore invitation-only multi-year operating support for regional and remote Queensland or Northern Territory delivery through the charity.',
    'The public strategy explicitly supports general operating costs, but only for invited DGR1 charities. The invitation and the specific $150K route must be evidenced.',
    'Is GOODS invited into the Resilience stream, and can the operating-cover block be named without overclaiming current authority or geography?',
    ARRAY[
      'Invitation status is not evidenced',
      'Current $150K ask status is not evidenced',
      'Funding-block and geography allocation are not agreed',
      'QBE match eligibility is not confirmed'
    ],
    'unknown',
    'https://www.tfff.org.au/funding-strategy/',
    jsonb_build_object(
      'catalogue', jsonb_build_object('themes', jsonb_build_array('regional development', 'resilience', 'leadership', 'community'), 'geography', 'Queensland and Northern Territory'),
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'TFFF funding strategy', 'url', 'https://www.tfff.org.au/funding-strategy/', 'checkedAt', '2026-08-01', 'detail', 'The Resilience stream provides multi-year general operating support in regional and remote QLD/NT. Applications are invitation-only and require ACNC registration plus Item 1 DGR status.')
      )
    ),
    '2026-08-05T09:00:00+08:00'
  ),
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'white-box-150k',
    'White Box $150K finance target',
    'White Box Enterprises / White Box Finance',
    (SELECT id FROM public.gs_entities WHERE abn = '99627169073' ORDER BY canonical_name LIMIT 1),
    'Clarify whether White Box is an adviser, arranger, lender or funding pathway for GOODS equipment or working capital.',
    'The public service helps social enterprises source suitable finance; it does not itself verify a $150K funding commitment.',
    'Who would actually provide the $150K, on what terms, and which GOODS company capital block would it fund?',
    ARRAY[
      'Funding counterparty and instrument are not verified',
      'Repayment terms and security are unknown',
      'Current $150K ask status is not evidenced',
      'No capital-block allocation has been approved'
    ],
    'not_required',
    'https://whiteboxenterprises.com.au/strengthen/finance/',
    jsonb_build_object(
      'catalogue', jsonb_build_object('themes', jsonb_build_array('social enterprise', 'finance', 'employment'), 'geography', 'Australia'),
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'White Box Finance', 'url', 'https://whiteboxenterprises.com.au/strengthen/finance/', 'checkedAt', '2026-08-01', 'detail', 'White Box describes tailored support to understand needs and source appropriate capital; the public page is not evidence that White Box itself will fund GOODS.')
      )
    ),
    '2026-08-06T09:00:00+08:00'
  ),
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'minderoo-100k',
    'Minderoo Foundation $100K grant target',
    'Minderoo Foundation',
    (SELECT id FROM public.gs_entities WHERE abn = '24819440618' ORDER BY canonical_name LIMIT 1),
    'Test a concrete partner-led route without treating broad plastics or First Nations language as program fit.',
    'Minderoo publicly uses grants and impact investing, but its sustainable-materials investment page explicitly excludes downstream recycling and waste-management projects.',
    'Which current Minderoo mission owns this conversation, and what specific GOODS block is inside that mission?',
    ARRAY[
      'Named Minderoo program or internal sponsor is not verified',
      'Current $100K ask status is not evidenced',
      'The public downstream-recycling exclusion creates a fit tension',
      'QBE match eligibility is not confirmed'
    ],
    'unknown',
    'https://www.minderoo.org/our-approach/',
    jsonb_build_object(
      'catalogue', jsonb_build_object('themes', jsonb_build_array('community', 'First Nations', 'environment', 'impact investing'), 'geography', 'Australia and international'),
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'Minderoo approach', 'url', 'https://www.minderoo.org/our-approach/', 'checkedAt', '2026-08-01', 'detail', 'Minderoo describes a partner-led approach using collaboration, grants and impact investing.'),
        jsonb_build_object('label', 'Changing plastic for good', 'url', 'https://www.minderoo.org/resources/changing-plastic-for-good/', 'checkedAt', '2026-08-01', 'detail', 'The public investment focus is upstream sustainable-material alternatives and explicitly excludes downstream recycling, waste management and end-of-life treatment.')
      )
    ),
    '2026-08-06T09:00:00+08:00'
  ),
  (
    (SELECT id FROM public.org_profiles WHERE slug = 'act' LIMIT 1),
    'ACT-GD',
    'centrecorp-75k',
    'Centrecorp Foundation $75K grant target',
    'Centrecorp Foundation',
    (SELECT id FROM public.gs_entities WHERE abn = '31136052796' ORDER BY canonical_name LIMIT 1),
    'Clarify whether the current ask is a grant, a bed purchase or a blended route, and separate it from historical paid support.',
    'The public foundation supports Aboriginal people in Central Australia and accepts requests from organisations. Existing historical funding and older proposal amounts must not be counted as the new $75K target.',
    'What is the current $75K instrument, use, decision forum and written-evidence path?',
    ARRAY[
      'Grant-versus-procurement instrument is not confirmed',
      'Current $75K ask status is not evidenced',
      'Funding-block allocation is not agreed',
      'Decision date and QBE match eligibility are unknown'
    ],
    'unknown',
    'https://www.centrecorpfoundation.com.au/',
    jsonb_build_object(
      'catalogue', jsonb_build_object('themes', jsonb_build_array('Aboriginal education', 'employment', 'health and welfare', 'housing', 'culture'), 'geography', 'Central Australia'),
      'officialEvidence', jsonb_build_array(
        jsonb_build_object('label', 'Centrecorp Foundation', 'url', 'https://www.centrecorpfoundation.com.au/', 'checkedAt', '2026-08-01', 'detail', 'The foundation describes monthly board consideration and support intended to benefit Aboriginal people in Central Australia; requests can come from individuals or organisations.')
      )
    ),
    '2026-08-07T09:00:00+08:00'
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
  ghl_opportunity_id,
  next_action,
  next_action_owner,
  next_action_due,
  evidence_gaps,
  source_refs
)
VALUES
  (
    (SELECT id FROM public.goods_funding_matters WHERE slug = 'sefa-300k'),
    'sefa-300k-route',
    'repayable_finance',
    NULL,
    'A Curious Tractor Pty Ltd (t/a Goods on Country)',
    'Repayable capital belongs in the operating company; current trading migration must be disclosed.',
    'unknown',
    'Patient or concessional debt — exact product and terms unknown',
    300000,
    'researching',
    'none',
    'none',
    'unknown',
    'QBE treatment of the proposed debt instrument is not confirmed in writing.',
    'https://www.sefapartnerships.org.au/programs/backing-the-bold',
    '2026-08-01T09:00:00+08:00',
    'hBRVkCMhT93215aqTRRr',
    'Open the direct-capital thread and obtain the named facility, ticket, terms, recipient requirements and decision timetable in writing.',
    'Ben',
    '2026-08-04',
    ARRAY['Named facility', 'Terms and security', 'Trading-entity treatment', 'Block allocation', 'QBE match treatment'],
    jsonb_build_object('targetSource', 'Six GHL asks brief, 1 August 2026', 'askMade', 'unknown')
  ),
  (
    (SELECT id FROM public.goods_funding_matters WHERE slug = 'snow-150k'),
    'snow-150k-route',
    'grant',
    'Existing relationship / new grant route — exact stream to confirm',
    'The Butterfly Movement Ltd (Item 1 DGR + PBI, ABN 22 155 132 684)',
    'Tax-deductible philanthropy routes through Butterfly.',
    'conditional',
    'Non-repayable grant',
    150000,
    'concept',
    'none',
    'none',
    'unknown',
    'No current commitment letter or QBE ruling is attached.',
    'https://www.snowfoundation.org.au/grants/faqs/',
    '2026-08-01T09:00:00+08:00',
    'ZzPJCLAq3nkAo0bG7ot3',
    'Confirm the new $150K purpose and ask status separately from prior Snow support, then request acceptable written commitment wording if invited.',
    'Ben',
    '2026-08-05',
    ARRAY['Ask status', 'Named funding stream', 'Block allocation', 'Decision timing', 'QBE match treatment'],
    jsonb_build_object('targetSource', 'Six GHL asks brief, 1 August 2026', 'askMade', 'unknown')
  ),
  (
    (SELECT id FROM public.goods_funding_matters WHERE slug = 'tim-fairfax-150k'),
    'tim-fairfax-150k-route',
    'grant',
    'TFFF Resilience stream — invitation status to confirm',
    'The Butterfly Movement Ltd (Item 1 DGR + PBI, ABN 22 155 132 684)',
    'The public strategy requires an ACNC-registered Item 1 DGR recipient.',
    'conditional',
    'Multi-year general operating support grant',
    150000,
    'concept',
    'none',
    'none',
    'unknown',
    'Invitation, ask status and QBE treatment are not evidenced.',
    'https://www.tfff.org.au/funding-strategy/',
    '2026-08-01T09:00:00+08:00',
    'ihodM2eQqGW7UlS7WeKp',
    'Verify invitation status and whether TFFF would consider the operating-cover block through Butterfly.',
    'Ben',
    '2026-08-05',
    ARRAY['Invitation status', 'Ask status', 'Block and geography allocation', 'Decision timing', 'QBE match treatment'],
    jsonb_build_object('targetSource', 'Six GHL asks brief, 1 August 2026', 'askMade', 'unknown')
  ),
  (
    (SELECT id FROM public.goods_funding_matters WHERE slug = 'white-box-150k'),
    'white-box-150k-route',
    'other',
    'White Box Finance support / capital pathway — actual funding counterparty to confirm',
    'A Curious Tractor Pty Ltd (t/a Goods on Country)',
    'Any repayable facility for production belongs in the operating company.',
    'unknown',
    'Finance advice, arrangement or facility — role unknown',
    150000,
    'researching',
    'none',
    'none',
    'unknown',
    'The public page describes capital-sourcing support, not a White Box commitment or QBE-eligible instrument.',
    'https://whiteboxenterprises.com.au/strengthen/finance/',
    '2026-08-01T09:00:00+08:00',
    '6qJmhAM3a01JJcI6Krg9',
    'Ask White Box to name its role, the actual capital provider, likely instrument, terms, ticket and decision path.',
    'Ben',
    '2026-08-06',
    ARRAY['Capital provider', 'White Box role', 'Instrument and terms', 'Ask status', 'Block allocation', 'QBE match treatment'],
    jsonb_build_object('targetSource', 'Six GHL asks brief, 1 August 2026', 'askMade', 'unknown')
  ),
  (
    (SELECT id FROM public.goods_funding_matters WHERE slug = 'minderoo-100k'),
    'minderoo-100k-route',
    'grant',
    NULL,
    'The Butterfly Movement Ltd (Item 1 DGR + PBI, ABN 22 155 132 684)',
    'The route is currently framed as philanthropy; confirm the actual Minderoo instrument and contracting entity.',
    'unknown',
    'Grant or catalytic support — exact instrument unknown',
    100000,
    'researching',
    'none',
    'none',
    'unknown',
    'No named program, ask evidence or QBE ruling is attached.',
    'https://www.minderoo.org/our-approach/',
    '2026-08-01T09:00:00+08:00',
    'zQZWXJyILdvzwm8OACPr',
    'Identify the internal mission and sponsor before refining the ask; do not use downstream recycling as the public fit argument.',
    'Ben',
    '2026-08-06',
    ARRAY['Named program or sponsor', 'Instrument', 'Ask status', 'Block allocation', 'Fit tension', 'QBE match treatment'],
    jsonb_build_object('targetSource', 'Six GHL asks brief, 1 August 2026', 'askMade', 'unknown')
  ),
  (
    (SELECT id FROM public.goods_funding_matters WHERE slug = 'centrecorp-75k'),
    'centrecorp-75k-route',
    'grant',
    'Centrecorp organisational request — current instrument to confirm',
    'The Butterfly Movement Ltd (Item 1 DGR + PBI, ABN 22 155 132 684)',
    'Use Butterfly only if this is philanthropy; a bed purchase must remain procurement/revenue.',
    'unknown',
    'Grant or procurement — classification unresolved',
    75000,
    'researching',
    'none',
    'none',
    'unknown',
    'The current instrument, new ask evidence and QBE treatment are not confirmed.',
    'https://www.centrecorpfoundation.com.au/',
    '2026-08-01T09:00:00+08:00',
    'TUpPBR3c76JeuksojRz1',
    'Reconcile the new $75K target against the older $106,150 proposal and historical paid support; confirm grant versus purchase and the next board path.',
    'Ben',
    '2026-08-07',
    ARRAY['Instrument classification', 'Ask status', 'Block allocation', 'Decision timing', 'QBE match treatment'],
    jsonb_build_object('targetSource', 'Six GHL asks brief, 1 August 2026', 'askMade', 'unknown')
  )
ON CONFLICT (route_code) DO NOTHING;

COMMIT;
