import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';

export const GOODS_PROJECT_CODE = 'ACT-GD';
export const GOODS_CAPITAL_MODEL_AS_OF = '2026-08-01';
export const GOODS_QBE_PUBLIC_SOURCE = 'https://www.socialimpacthub.org/catalysing-impact';

export type GoodsMatterState = 'open' | 'closed';
export type GoodsApplicationState =
  | 'researching'
  | 'concept'
  | 'invited'
  | 'drafting'
  | 'ready'
  | 'submitted'
  | 'due_diligence'
  | 'decided'
  | 'withdrawn'
  | 'closed';
export type GoodsCommitmentState =
  | 'none'
  | 'proposed'
  | 'offered'
  | 'accepted'
  | 'fulfilled'
  | 'changed'
  | 'declined'
  | 'released'
  | 'contested';
export type GoodsCommitmentEvidence = 'none' | 'verbal' | 'email' | 'letter' | 'executed_agreement';
export type GoodsMatchAssessment = 'unknown' | 'eligible' | 'ineligible';
export type GoodsEligibilityState = 'unknown' | 'conditional' | 'eligible' | 'ineligible';
export type GoodsGateState = 'pass' | 'check' | 'blocked';

export interface GoodsOfficialEvidence {
  label: string;
  url: string;
  checkedAt: string | null;
  detail: string;
}

export interface GoodsCapitalBlock {
  id: string;
  code: string;
  name: string;
  purpose: string;
  amountMinAud: number;
  amountMaxAud: number;
  receivingEntityKind: 'charity' | 'company';
  receivingEntityName: string;
  allowedInstruments: string[];
  state: 'active' | 'funded' | 'paused' | 'closed';
  sourceRefs: Record<string, unknown>;
  sortOrder: number;
}

export interface GoodsFundingMatter {
  id: string;
  slug: string;
  title: string;
  counterpartyName: string;
  counterpartyEntityId: string | null;
  purpose: string;
  state: GoodsMatterState;
  whyNow: string | null;
  currentLearningQuestion: string | null;
  evidenceGaps: string[];
  authorityState: string;
  communityAuthorityRef: string | null;
  officialSourceUrl: string | null;
  sourceRefs: Record<string, unknown>;
  nextReviewAt: string | null;
  openedAt: string;
  closedAt: string | null;
}

export interface GoodsFundingRoute {
  id: string;
  matterId: string;
  routeCode: string;
  routeType: string;
  namedRoute: string | null;
  legalRecipientName: string | null;
  legalRecipientBasis: string | null;
  eligibilityState: GoodsEligibilityState;
  instrumentLabel: string | null;
  targetAmountAud: number | null;
  askMadeAt: string | null;
  applicationState: GoodsApplicationState;
  commitmentState: GoodsCommitmentState;
  commitmentAmountAud: number | null;
  commitmentEvidenceForm: GoodsCommitmentEvidence;
  commitmentEvidenceRef: string | null;
  matchAssessment: GoodsMatchAssessment;
  matchAssessmentReason: string | null;
  officialSourceUrl: string | null;
  officialSourceCheckedAt: string | null;
  decisionDueAt: string | null;
  submittedAt: string | null;
  ghlOpportunityId: string | null;
  notionUrl: string | null;
  applicationUrl: string | null;
  nextAction: string | null;
  nextActionOwner: string | null;
  nextActionDue: string | null;
  evidenceGaps: string[];
  sourceRefs: Record<string, unknown>;
}

export interface GoodsRouteAllocation {
  id: string;
  routeId: string;
  capitalBlockId: string;
  proposedAmountAud: number | null;
  acceptedAmountAud: number | null;
  restrictions: string | null;
  allocationEvidenceRef: string | null;
}

export interface GoodsDecisionMemory {
  id: string;
  sourceRef: string;
  decision: string;
  reason: string | null;
  createdAt: string;
  supersedesId: string | null;
  judgment: {
    whatChanged?: string;
    nextMove?: string;
    nextLearningQuestion?: string;
    revisitAt?: string;
    commitment?: Record<string, unknown>;
  };
}

export interface GoodsLearningEvent {
  id: string;
  decisionId: string | null;
  title: string;
  summary: string;
  signalKind: string;
  happenedAt: string | null;
  actorName: string | null;
  organisation: string | null;
  metadata: Record<string, unknown>;
}

export interface GoodsCapitalBlockCoverage extends GoodsCapitalBlock {
  targetedAud: number;
  offeredAud: number;
  committedAud: number;
  receivedAud: number;
  remainingMinAud: number;
  remainingMaxAud: number;
  allocations: Array<{
    allocation: GoodsRouteAllocation;
    route: GoodsFundingRoute;
    matter: GoodsFundingMatter;
  }>;
}

export interface GoodsApplicationGate {
  key: 'current' | 'route' | 'use' | 'entity' | 'authority' | 'timing';
  label: string;
  state: GoodsGateState;
  detail: string;
}

export interface GoodsApplicationRoom {
  matter: GoodsFundingMatter;
  route: GoodsFundingRoute;
  allocations: GoodsRouteAllocation[];
  gates: GoodsApplicationGate[];
  readyGateCount: number;
  blockedGateCount: number;
}

export type GoodsAttentionTrigger =
  | 'truth_reset'
  | 'promise_overdue'
  | 'action_due'
  | 'review_due'
  | 'evidence_gap';

export interface GoodsAttentionMatter {
  matter: GoodsFundingMatter;
  route: GoodsFundingRoute | null;
  trigger: GoodsAttentionTrigger;
  triggerLabel: string;
  dueAt: string | null;
  latestDecision: GoodsDecisionMemory | null;
}

export interface GoodsCounterpartyDossier {
  matter: GoodsFundingMatter;
  route: GoodsFundingRoute | null;
  catalogueThemes: string[];
  catalogueGeography: string | null;
  officialEvidence: GoodsOfficialEvidence[];
  activeUnknowns: string[];
  openPromises: GoodsLearningEvent[];
  lastReviewedAt: string | null;
}

export interface GoodsCapitalWorkspace {
  generatedAt: string;
  asOf: string;
  dataSource: 'database' | 'evidence_safe_seed';
  dataWarning: string | null;
  blocks: GoodsCapitalBlock[];
  matters: GoodsFundingMatter[];
  routes: GoodsFundingRoute[];
  allocations: GoodsRouteAllocation[];
  decisions: GoodsDecisionMemory[];
  events: GoodsLearningEvent[];
  coverage: GoodsCapitalBlockCoverage[];
  applications: GoodsApplicationRoom[];
  dossiers: GoodsCounterpartyDossier[];
  attention: GoodsAttentionMatter[];
  summary: {
    needMinAud: number;
    needMaxAud: number;
    targetAud: number;
    askMadeAud: number;
    offeredAud: number;
    committedAud: number;
    receivedAud: number;
    allocatedTargetAud: number;
    unallocatedTargetAud: number;
    signedCommitmentCount: number;
    openMatterCount: number;
    readyApplicationCount: number;
  };
}

const BUTTERFLY = 'The Butterfly Movement Ltd (Item 1 DGR + PBI, ABN 22 155 132 684)';
const ACT_PTY = 'A Curious Tractor Pty Ltd (t/a Goods on Country)';

export const GOODS_CAPITAL_BLOCK_SEED: GoodsCapitalBlock[] = [
  {
    id: 'block-measured-run',
    code: 'measured-run',
    name: 'Measured 50-bed run',
    purpose: 'A timed and fully costed production run that proves delivered cost and throughput.',
    amountMinAud: 60_000,
    amountMaxAud: 80_000,
    receivingEntityKind: 'charity',
    receivingEntityName: BUTTERFLY,
    allowedInstruments: ['grant'],
    state: 'active',
    sourceRefs: { source: 'GOODS funder search brief', asOf: GOODS_CAPITAL_MODEL_AS_OF },
    sortOrder: 10,
  },
  {
    id: 'block-operating-cover',
    code: 'operating-cover',
    name: 'Operating cover',
    purpose: 'Full-cost operating cover while bed volume and earned revenue increase.',
    amountMinAud: 110_000,
    amountMaxAud: 165_000,
    receivingEntityKind: 'charity',
    receivingEntityName: BUTTERFLY,
    allowedInstruments: ['grant', 'unrestricted_grant'],
    state: 'active',
    sourceRefs: { source: 'GOODS funder search brief', asOf: GOODS_CAPITAL_MODEL_AS_OF },
    sortOrder: 20,
  },
  {
    id: 'block-servicing-scoping',
    code: 'servicing-scoping',
    name: 'Servicing and site scoping',
    purpose: 'Service existing deployments and scope the first on-Country manufacturing site.',
    amountMinAud: 5_000,
    amountMaxAud: 8_000,
    receivingEntityKind: 'charity',
    receivingEntityName: BUTTERFLY,
    allowedInstruments: ['grant', 'in_kind'],
    state: 'active',
    sourceRefs: { source: 'GOODS funder search brief', asOf: GOODS_CAPITAL_MODEL_AS_OF },
    sortOrder: 30,
  },
  {
    id: 'block-equipment',
    code: 'equipment',
    name: 'Production equipment',
    purpose: 'Press line, shredder and CNC router required for repeatable production capacity.',
    amountMinAud: 112_000,
    amountMaxAud: 222_000,
    receivingEntityKind: 'company',
    receivingEntityName: ACT_PTY,
    allowedInstruments: ['repayable_finance', 'equipment_finance', 'catalytic_capital'],
    state: 'active',
    sourceRefs: { source: 'GOODS funder search brief', asOf: GOODS_CAPITAL_MODEL_AS_OF },
    sortOrder: 40,
  },
  {
    id: 'block-working-capital',
    code: 'working-capital',
    name: 'Working capital',
    purpose: 'Order-backed or patient working capital derived from actual debtor behaviour.',
    amountMinAud: 80_000,
    amountMaxAud: 145_000,
    receivingEntityKind: 'company',
    receivingEntityName: ACT_PTY,
    allowedInstruments: ['repayable_finance', 'working_capital', 'catalytic_capital'],
    state: 'active',
    sourceRefs: { source: 'GOODS funder search brief', asOf: GOODS_CAPITAL_MODEL_AS_OF },
    sortOrder: 50,
  },
];

type MatterSeed = Omit<GoodsFundingMatter, 'id' | 'openedAt' | 'closedAt'> & {
  route?: Omit<GoodsFundingRoute, 'id' | 'matterId'>;
};

function evidence(
  label: string,
  url: string,
  detail: string,
): GoodsOfficialEvidence {
  return { label, url, checkedAt: GOODS_CAPITAL_MODEL_AS_OF, detail };
}

const GOODS_MATTER_SEED_INPUT: MatterSeed[] = [
  {
    slug: 'qbe-stage-2-truth-reset',
    title: 'Confirm the QBE Stage 2 capital rule and exact deadline',
    counterpartyName: 'QBE Foundation / Social Impact Hub',
    counterpartyEntityId: null,
    purpose: 'Establish one written campaign fact record before any external matched-capital claim is made.',
    state: 'open',
    whyNow: 'The public page confirms the cohort and typical $150K-$400K Stage 2 grants, while the exact private deadline and acceptable commitment evidence remain unverified.',
    currentLearningQuestion: 'What exact evidence, timing and legal-recipient conditions will QBE accept for the GOODS Stage 2 application?',
    evidenceGaps: [
      'Exact Stage 2 closing date is not confirmed in writing',
      'Acceptable commitment-letter wording is not confirmed in writing',
      'Whether each proposed instrument is match-eligible is unknown',
    ],
    authorityState: 'not_required',
    communityAuthorityRef: null,
    officialSourceUrl: GOODS_QBE_PUBLIC_SOURCE,
    sourceRefs: {
      officialEvidence: [
        evidence(
          'Catalysing Impact 2026',
          GOODS_QBE_PUBLIC_SOURCE,
          'Public page confirms the two-stage model and typical Stage 2 catalytic grants of $150K-$400K linked to external funding secured.',
        ),
      ],
      privateBrief: 'Late September 2026 and dollar-for-dollar matching await written program confirmation.',
    },
    nextReviewAt: '2026-08-03T01:00:00.000Z',
  },
  {
    slug: 'sefa-300k',
    title: 'SEFA $300K repayable-capital target',
    counterpartyName: 'Social Enterprise Finance Australia (SEFA)',
    counterpartyEntityId: null,
    purpose: 'Explore patient equipment and working-capital finance without treating a CRM target as a lender commitment.',
    state: 'open',
    whyNow: 'The $300K target is in GHL, but the named product, terms, current thread and QBE treatment are not verified.',
    currentLearningQuestion: 'Is there a direct SEFA facility that can cover $300K, given the public Backing the Bold pathway was capped at $200K and closed on 31 July?',
    evidenceGaps: ['Named $300K facility', 'Repayment terms and security', 'Company migration treatment', 'Capital-block allocation'],
    authorityState: 'not_required',
    communityAuthorityRef: null,
    officialSourceUrl: 'https://www.sefapartnerships.org.au/programs/backing-the-bold',
    sourceRefs: {
      catalogue: { themes: ['social enterprise', 'community', 'housing', 'Indigenous'], geography: 'Australia' },
      officialEvidence: [
        evidence('Backing the Bold', 'https://www.sefapartnerships.org.au/programs/backing-the-bold', 'Public route offered support and access to loans up to $200K; the national intake closed 31 July 2026.'),
        evidence('SEFA Partnerships', 'https://www.sefapartnerships.org.au/', 'Public mission supports impact-led organisations with flexible finance, capability and connections.'),
      ],
    },
    nextReviewAt: '2026-08-04T01:00:00.000Z',
    route: {
      routeCode: 'sefa-300k-route',
      routeType: 'repayable_finance',
      namedRoute: null,
      legalRecipientName: ACT_PTY,
      legalRecipientBasis: 'Repayable capital belongs in the operating company; current trading migration must be disclosed.',
      eligibilityState: 'unknown',
      instrumentLabel: 'Patient or concessional debt — exact product and terms unknown',
      targetAmountAud: 300_000,
      askMadeAt: null,
      applicationState: 'researching',
      commitmentState: 'none',
      commitmentAmountAud: null,
      commitmentEvidenceForm: 'none',
      commitmentEvidenceRef: null,
      matchAssessment: 'unknown',
      matchAssessmentReason: 'QBE treatment of the proposed debt instrument is not confirmed in writing.',
      officialSourceUrl: 'https://www.sefapartnerships.org.au/programs/backing-the-bold',
      officialSourceCheckedAt: GOODS_CAPITAL_MODEL_AS_OF,
      decisionDueAt: null,
      submittedAt: null,
      ghlOpportunityId: 'hBRVkCMhT93215aqTRRr',
      notionUrl: null,
      applicationUrl: null,
      nextAction: 'Open the direct-capital thread and obtain the named facility, ticket, terms, recipient requirements and decision timetable in writing.',
      nextActionOwner: 'Ben',
      nextActionDue: '2026-08-04',
      evidenceGaps: ['Named facility', 'Terms and security', 'Trading-entity treatment', 'Block allocation', 'QBE match treatment'],
      sourceRefs: { targetSource: 'Six GHL asks brief, 1 August 2026', askMade: 'unknown' },
    },
  },
  {
    slug: 'snow-150k',
    title: 'Snow Foundation $150K grant target',
    counterpartyName: 'The Snow Foundation',
    counterpartyEntityId: null,
    purpose: 'Test whether existing support can become a clearly allocated full-cost grant and, separately, acceptable QBE commitment evidence.',
    state: 'open',
    whyNow: 'A $150K target is in GHL. Existing and historical Snow support must remain separate from this new target.',
    currentLearningQuestion: 'Which current GOODS cost block would Snow support, through which legal grant route, and what written evidence could it provide?',
    evidenceGaps: ['Current ask status', 'Funding-block allocation', 'QBE match treatment', 'Decision timing'],
    authorityState: 'unknown',
    communityAuthorityRef: null,
    officialSourceUrl: 'https://www.snowfoundation.org.au/grants/faqs/',
    sourceRefs: {
      catalogue: { themes: ['community', 'First Nations', 'systems change'], geography: 'Canberra, NSW and selected national initiatives' },
      officialEvidence: [
        evidence('Snow strategy', 'https://www.snowfoundation.org.au/news/our-path-forward-introducing-our-new-strategy-to-grow-impact-and-back-community-led-change/', 'Snow describes a long-term, community-led and trust-based approach.'),
        evidence('Snow grant FAQs', 'https://www.snowfoundation.org.au/grants/faqs/', 'National initiatives are targeted and aligned new initiatives should be discussed with the team.'),
      ],
    },
    nextReviewAt: '2026-08-05T01:00:00.000Z',
    route: grantRoute({
      routeCode: 'snow-150k-route',
      targetAmountAud: 150_000,
      namedRoute: 'Existing relationship / new grant route — exact stream to confirm',
      eligibilityState: 'conditional',
      officialSourceUrl: 'https://www.snowfoundation.org.au/grants/faqs/',
      ghlOpportunityId: 'ZzPJCLAq3nkAo0bG7ot3',
      nextAction: 'Confirm the new $150K purpose and ask status separately from prior Snow support, then request acceptable written commitment wording if invited.',
      nextActionDue: '2026-08-05',
      evidenceGaps: ['Ask status', 'Named funding stream', 'Block allocation', 'Decision timing', 'QBE match treatment'],
    }),
  },
  {
    slug: 'tim-fairfax-150k',
    title: 'Tim Fairfax Family Foundation $150K grant target',
    counterpartyName: 'Tim Fairfax Family Foundation',
    counterpartyEntityId: null,
    purpose: 'Explore invitation-only multi-year operating support for regional and remote Queensland or Northern Territory delivery through the charity.',
    state: 'open',
    whyNow: 'The public strategy supports general operating costs, but only for invited DGR1 charities. Invitation and ask status remain unverified.',
    currentLearningQuestion: 'Is GOODS invited into the Resilience stream, and can the operating-cover block be named without overclaiming current authority or geography?',
    evidenceGaps: ['Invitation status', 'Current ask status', 'Block and geography allocation', 'QBE match treatment'],
    authorityState: 'unknown',
    communityAuthorityRef: null,
    officialSourceUrl: 'https://www.tfff.org.au/funding-strategy/',
    sourceRefs: {
      catalogue: { themes: ['regional development', 'resilience', 'leadership', 'community'], geography: 'Queensland and Northern Territory' },
      officialEvidence: [
        evidence('TFFF funding strategy', 'https://www.tfff.org.au/funding-strategy/', 'The Resilience stream provides multi-year general operating support in regional and remote QLD/NT. Applications are invitation-only and require ACNC registration plus Item 1 DGR status.'),
      ],
    },
    nextReviewAt: '2026-08-05T01:00:00.000Z',
    route: grantRoute({
      routeCode: 'tim-fairfax-150k-route',
      targetAmountAud: 150_000,
      namedRoute: 'TFFF Resilience stream — invitation status to confirm',
      eligibilityState: 'conditional',
      instrumentLabel: 'Multi-year general operating support grant',
      officialSourceUrl: 'https://www.tfff.org.au/funding-strategy/',
      ghlOpportunityId: 'ihodM2eQqGW7UlS7WeKp',
      nextAction: 'Verify invitation status and whether TFFF would consider the operating-cover block through Butterfly.',
      nextActionDue: '2026-08-05',
      evidenceGaps: ['Invitation status', 'Ask status', 'Block and geography allocation', 'Decision timing', 'QBE match treatment'],
    }),
  },
  {
    slug: 'white-box-150k',
    title: 'White Box $150K finance target',
    counterpartyName: 'White Box Enterprises / White Box Finance',
    counterpartyEntityId: null,
    purpose: 'Test the named Social Enterprise Loan Fund (SELF) as patient finance for GOODS equipment or working capital without assuming the current legal structure is eligible.',
    state: 'open',
    whyNow: 'SELF expressions of interest are open and the published $100K-$500K loan range covers the $150K target, but the public tests include PBI/DGR status, trading history, trading revenue and employment-pathway evidence.',
    currentLearningQuestion: 'Can one current GOODS entity satisfy every SELF eligibility test and borrow for the operating activity that will repay the loan?',
    evidenceGaps: ['Qualifying legal recipient', 'Two-year social-enterprise operating history', 'Trading-revenue tests', 'Employment-pathway evidence', 'Current EOI or ask evidence', 'Capital-block allocation'],
    authorityState: 'not_required',
    communityAuthorityRef: null,
    officialSourceUrl: 'https://whiteboxenterprises.com.au/innovate/self/',
    sourceRefs: {
      catalogue: { themes: ['social enterprise', 'finance', 'employment'], geography: 'Australia' },
      officialEvidence: [
        evidence('Social Enterprise Loan Fund (SELF)', 'https://whiteboxenterprises.com.au/innovate/self/', 'EOIs are open for $100K-$500K patient loans at 6.5%-9.5% for up to seven years. Public eligibility includes legal-entity, trading, employment and evidence tests; this page is not evidence that GOODS passes them.'),
      ],
    },
    nextReviewAt: '2026-08-04T01:00:00.000Z',
    route: {
      routeCode: 'white-box-150k-route',
      routeType: 'repayable_finance',
      namedRoute: 'Social Enterprise Loan Fund (SELF)',
      legalRecipientName: 'The Butterfly Movement Ltd — only if verified as the qualifying trading social enterprise',
      legalRecipientBasis: 'SELF publicly requires a qualifying not-for-profit or Indigenous business with PBI/DGR status plus trading, revenue and employment-pathway evidence. The current GOODS operating structure has not been verified against every test.',
      eligibilityState: 'conditional',
      instrumentLabel: 'Patient loan: $100K-$500K, 6.5%-9.5%, up to seven years',
      targetAmountAud: 150_000,
      askMadeAt: null,
      applicationState: 'researching',
      commitmentState: 'none',
      commitmentAmountAud: null,
      commitmentEvidenceForm: 'none',
      commitmentEvidenceRef: null,
      matchAssessment: 'unknown',
      matchAssessmentReason: 'SELF is repayable finance, but QBE has not confirmed whether an EOI, conditional approval or executed SELF loan would satisfy its external-capital evidence rule.',
      officialSourceUrl: 'https://whiteboxenterprises.com.au/innovate/self/',
      officialSourceCheckedAt: GOODS_CAPITAL_MODEL_AS_OF,
      decisionDueAt: null,
      submittedAt: null,
      ghlOpportunityId: '6qJmhAM3a01JJcI6Krg9',
      notionUrl: null,
      applicationUrl: null,
      nextAction: 'Book an eligibility call before submitting an EOI; verify the borrower, trading tests, workforce evidence, security, three-month timing and whether White Box can provide QBE-usable conditional evidence.',
      nextActionOwner: 'Ben',
      nextActionDue: '2026-08-04',
      evidenceGaps: ['Qualifying borrower', 'Trading history and revenue', 'Employment-pathway evidence', 'Security and repayment capacity', 'EOI status', 'Block allocation', 'QBE match treatment'],
      sourceRefs: { targetSource: 'Six GHL asks brief, 1 August 2026', askMade: 'unknown', publicLoanRangeAud: [100_000, 500_000], publicRateRange: '6.5%-9.5%', publicTerm: 'up to seven years' },
    },
  },
  {
    slug: 'wyatt-clif-conversation',
    title: 'Qualify The Wyatt Trust CLIF conversation',
    counterpartyName: 'The Wyatt Trust',
    counterpartyEntityId: null,
    purpose: 'Explore patient debt for production equipment or working capital through a relationship-led conversation with Gavin Reid, without turning reported interest into an ask or commitment.',
    state: 'open',
    whyNow: 'Ben reports current interest from Gavin Reid. Wyatt publicly describes a structure-agnostic South Australian patient-capital fund with an average loan of about $150K, but the fund was already 90% subscribed in April 2026.',
    currentLearningQuestion: 'Is GOODS genuinely eligible as a South Australian business or operation, is CLIF capacity still available, and what evidence would Wyatt need to consider a facility?',
    evidenceGaps: ['South Australian eligibility and operating nexus', 'Remaining CLIF capacity', 'Borrower and use of funds', 'Ticket, terms and security', 'Current ask evidence', 'QBE match treatment'],
    authorityState: 'not_required',
    communityAuthorityRef: null,
    officialSourceUrl: 'https://www.wyatt.org.au/what-we-do/stories/investing-to-catalyse-local-impact-clif/',
    sourceRefs: {
      catalogue: { themes: ['patient capital', 'people and planet', 'local enterprise', 'impact investing'], geography: 'South Australia' },
      interestEvidence: { form: 'user_reported', asOf: GOODS_CAPITAL_MODEL_AS_OF, summary: 'Ben reports that Gavin is interested in exploring investment. No ask, amount, terms or commitment has been evidenced.' },
      officialEvidence: [
        evidence('Wyatt CLIF 2026', 'https://www.wyatt.org.au/what-we-do/stories/investing-to-catalyse-local-impact-clif/', 'CLIF is structure-agnostic patient capital for South Australian businesses. It starts with a conversation, has an average loan of about $150K, and was 90% subscribed when published in April 2026.'),
        evidence('Wyatt team', 'https://www.wyatt.org.au/who-we-are/board-and-team/', 'Wyatt identifies Gavin Reid as Investment Specialist supporting its Investment Committee and impact outcomes.'),
      ],
    },
    nextReviewAt: '2026-08-05T01:00:00.000Z',
    route: {
      routeCode: 'wyatt-clif-route',
      routeType: 'repayable_finance',
      namedRoute: 'The Wyatt Trust Catalytic Local Investment Fund (CLIF)',
      legalRecipientName: ACT_PTY,
      legalRecipientBasis: 'A company can be eligible because CLIF is structure agnostic, but the business must satisfy the fund’s South Australian focus and due diligence.',
      eligibilityState: 'conditional',
      instrumentLabel: 'Patient or concessional debt — amount and terms not requested',
      targetAmountAud: null,
      askMadeAt: null,
      applicationState: 'concept',
      commitmentState: 'none',
      commitmentAmountAud: null,
      commitmentEvidenceForm: 'none',
      commitmentEvidenceRef: null,
      matchAssessment: 'unknown',
      matchAssessmentReason: 'No ask or facility exists, and QBE has not ruled on what CLIF evidence would count.',
      officialSourceUrl: 'https://www.wyatt.org.au/what-we-do/stories/investing-to-catalyse-local-impact-clif/',
      officialSourceCheckedAt: GOODS_CAPITAL_MODEL_AS_OF,
      decisionDueAt: null,
      submittedAt: null,
      ghlOpportunityId: null,
      notionUrl: null,
      applicationUrl: null,
      nextAction: 'Send Gavin the existing model and hold an anti-pitch qualification call: confirm SA nexus, current fund capacity, borrower, use, likely terms, timing and what could be documented for QBE.',
      nextActionOwner: 'Ben',
      nextActionDue: '2026-08-05',
      evidenceGaps: ['South Australian eligibility', 'Remaining fund capacity', 'Borrower and use', 'Terms and security', 'Ask status', 'QBE match treatment'],
      sourceRefs: { interestEvidence: 'user_reported', askMade: 'no', targetAmountAud: null },
    },
  },
  {
    slug: 'sedi-capability-2026-27',
    title: 'Test the 2026–27 SEDI capability grant',
    counterpartyName: 'Impact Investing Australia / Department of Social Services',
    counterpartyEntityId: null,
    purpose: 'Fund the financial model, investment readiness, contracting, legal structure and impact measurement needed to unlock capital, rather than misclassifying capability support as production cash.',
    state: 'open',
    whyNow: 'The 2026–27 round is open on a rolling basis until funds are exhausted, with grants up to $120K for eligible social enterprises to purchase capability-building services.',
    currentLearningQuestion: 'Does the current GOODS entity pass the trading-revenue and direct-benefit tests, and which costed capability package would most directly unlock the QBE capital raise?',
    evidenceGaps: ['Eligible applying entity', 'More than $50K annual trading revenue', 'Direct entrenched-disadvantage benefit', 'Costed capability providers', 'Funds remaining', 'QBE match treatment'],
    authorityState: 'unknown',
    communityAuthorityRef: null,
    officialSourceUrl: 'https://impactinvestingaustralia.com/looking-for-funding-or-investors/',
    sourceRefs: {
      catalogue: { themes: ['social enterprise', 'investment readiness', 'financial management', 'impact measurement'], geography: 'Australia' },
      officialEvidence: [
        evidence('SEDI 2026–27 grants', 'https://impactinvestingaustralia.com/looking-for-funding-or-investors/', 'Rolling grants of up to $120K support eligible social enterprises to purchase capability services. Public tests include Australian operation, direct benefit for people experiencing disadvantage and more than $50K annual trading revenue.'),
        evidence('Department of Social Services SEDI', 'https://www.dss.gov.au/social-impact-investing/social-enterprise-development-initiative', 'DSS confirms 2026–27 applications opened on 8 May 2026 and can support business planning, financial management, legal work, contract negotiation, outcomes measurement and access to finance.'),
      ],
    },
    nextReviewAt: '2026-08-04T01:00:00.000Z',
    route: {
      routeCode: 'sedi-capability-2026-27-route',
      routeType: 'grant',
      namedRoute: 'SEDI 2026–27 Capability Building Grants',
      legalRecipientName: 'A Curious Tractor Pty Ltd or The Butterfly Movement Ltd — verify the qualifying social enterprise before EOI',
      legalRecipientBasis: 'SEDI can support for-profit or non-profit social enterprises, but the applicant must itself satisfy the trading, direct-benefit and scale-readiness tests.',
      eligibilityState: 'conditional',
      instrumentLabel: 'Capability-building grant up to $120K — no GOODS target set',
      targetAmountAud: null,
      askMadeAt: null,
      applicationState: 'researching',
      commitmentState: 'none',
      commitmentAmountAud: null,
      commitmentEvidenceForm: 'none',
      commitmentEvidenceRef: null,
      matchAssessment: 'unknown',
      matchAssessmentReason: 'SEDI buys capability services and is not itself equipment or working capital; QBE must confirm whether it has any external-capital relevance.',
      officialSourceUrl: 'https://impactinvestingaustralia.com/looking-for-funding-or-investors/',
      officialSourceCheckedAt: GOODS_CAPITAL_MODEL_AS_OF,
      decisionDueAt: null,
      submittedAt: null,
      ghlOpportunityId: null,
      notionUrl: null,
      applicationUrl: 'https://impactinvestingaustralia.com/looking-for-funding-or-investors/',
      nextAction: 'Run a 30-minute eligibility check, choose the applying entity and cost a provider package for the model, legal structure, contracts and impact evidence before lodging an EOI.',
      nextActionOwner: 'Ben',
      nextActionDue: '2026-08-04',
      evidenceGaps: ['Applying entity', 'Trading revenue', 'Direct-benefit evidence', 'Provider scope and budget', 'Funds remaining', 'QBE treatment'],
      sourceRefs: { discoveredAt: GOODS_CAPITAL_MODEL_AS_OF, publicMaximumAud: 120_000, targetAmountAud: null, askMade: 'no' },
    },
  },
  {
    slug: 'minderoo-100k',
    title: 'Minderoo Foundation $100K grant target',
    counterpartyName: 'Minderoo Foundation',
    counterpartyEntityId: null,
    purpose: 'Test a concrete partner-led route without treating broad plastics or First Nations language as program fit.',
    state: 'open',
    whyNow: 'Minderoo uses grants and impact investing, but its sustainable-materials page explicitly excludes downstream recycling and waste-management projects.',
    currentLearningQuestion: 'Which current Minderoo mission owns this conversation, and what specific GOODS block is inside that mission?',
    evidenceGaps: ['Named program or sponsor', 'Current ask status', 'Public downstream-recycling fit tension', 'QBE match treatment'],
    authorityState: 'unknown',
    communityAuthorityRef: null,
    officialSourceUrl: 'https://www.minderoo.org/our-approach/',
    sourceRefs: {
      catalogue: { themes: ['community', 'First Nations', 'environment', 'impact investing'], geography: 'Australia and international' },
      officialEvidence: [
        evidence('Minderoo approach', 'https://www.minderoo.org/our-approach/', 'Minderoo describes a partner-led approach using collaboration, grants and impact investing.'),
        evidence('Changing plastic for good', 'https://www.minderoo.org/resources/changing-plastic-for-good/', 'The public investment focus explicitly excludes downstream recycling, waste management and end-of-life treatment.'),
      ],
    },
    nextReviewAt: '2026-08-06T01:00:00.000Z',
    route: grantRoute({
      routeCode: 'minderoo-100k-route',
      targetAmountAud: 100_000,
      namedRoute: null,
      eligibilityState: 'unknown',
      instrumentLabel: 'Grant or catalytic support — exact instrument unknown',
      officialSourceUrl: 'https://www.minderoo.org/our-approach/',
      ghlOpportunityId: 'zQZWXJyILdvzwm8OACPr',
      nextAction: 'Identify the internal mission and sponsor before refining the ask; do not use downstream recycling as the public fit argument.',
      nextActionDue: '2026-08-06',
      evidenceGaps: ['Named program or sponsor', 'Instrument', 'Ask status', 'Block allocation', 'Fit tension', 'QBE match treatment'],
    }),
  },
  {
    slug: 'centrecorp-75k',
    title: 'Centrecorp Foundation $75K grant target',
    counterpartyName: 'Centrecorp Foundation',
    counterpartyEntityId: null,
    purpose: 'Clarify whether the current ask is a grant, a bed purchase or a blended route, and separate it from historical paid support.',
    state: 'open',
    whyNow: 'The foundation supports Aboriginal people in Central Australia. Historical funding and older proposal amounts must not be counted as the new $75K target.',
    currentLearningQuestion: 'What is the current $75K instrument, use, decision forum and written-evidence path?',
    evidenceGaps: ['Grant-versus-procurement instrument', 'Current ask status', 'Funding-block allocation', 'Decision date and QBE treatment'],
    authorityState: 'unknown',
    communityAuthorityRef: null,
    officialSourceUrl: 'https://www.centrecorpfoundation.com.au/',
    sourceRefs: {
      catalogue: { themes: ['Aboriginal education', 'employment', 'health and welfare', 'housing', 'culture'], geography: 'Central Australia' },
      officialEvidence: [
        evidence('Centrecorp Foundation', 'https://www.centrecorpfoundation.com.au/', 'The foundation describes monthly board consideration and support intended to benefit Aboriginal people in Central Australia; requests can come from individuals or organisations.'),
      ],
    },
    nextReviewAt: '2026-08-07T01:00:00.000Z',
    route: grantRoute({
      routeCode: 'centrecorp-75k-route',
      targetAmountAud: 75_000,
      namedRoute: 'Centrecorp organisational request — current instrument to confirm',
      eligibilityState: 'unknown',
      instrumentLabel: 'Grant or procurement — classification unresolved',
      legalRecipientBasis: 'Use Butterfly only if this is philanthropy; a bed purchase must remain procurement/revenue.',
      officialSourceUrl: 'https://www.centrecorpfoundation.com.au/',
      ghlOpportunityId: 'TUpPBR3c76JeuksojRz1',
      nextAction: 'Reconcile the new $75K target against the older $106,150 proposal and historical paid support; confirm grant versus purchase and the next board path.',
      nextActionDue: '2026-08-07',
      evidenceGaps: ['Instrument classification', 'Ask status', 'Block allocation', 'Decision timing', 'QBE match treatment'],
    }),
  },
];

function grantRoute(
  input: Pick<GoodsFundingRoute, 'routeCode' | 'targetAmountAud' | 'namedRoute' | 'eligibilityState' | 'officialSourceUrl' | 'ghlOpportunityId' | 'nextAction' | 'nextActionDue' | 'evidenceGaps'>
    & Partial<Pick<GoodsFundingRoute, 'instrumentLabel' | 'legalRecipientBasis'>>,
): Omit<GoodsFundingRoute, 'id' | 'matterId'> {
  return {
    routeCode: input.routeCode,
    routeType: 'grant',
    namedRoute: input.namedRoute,
    legalRecipientName: BUTTERFLY,
    legalRecipientBasis: input.legalRecipientBasis ?? 'Tax-deductible philanthropy routes through Butterfly.',
    eligibilityState: input.eligibilityState,
    instrumentLabel: input.instrumentLabel ?? 'Non-repayable grant',
    targetAmountAud: input.targetAmountAud,
    askMadeAt: null,
    applicationState: input.namedRoute ? 'concept' : 'researching',
    commitmentState: 'none',
    commitmentAmountAud: null,
    commitmentEvidenceForm: 'none',
    commitmentEvidenceRef: null,
    matchAssessment: 'unknown',
    matchAssessmentReason: 'No current commitment letter or QBE ruling is attached.',
    officialSourceUrl: input.officialSourceUrl,
    officialSourceCheckedAt: GOODS_CAPITAL_MODEL_AS_OF,
    decisionDueAt: null,
    submittedAt: null,
    ghlOpportunityId: input.ghlOpportunityId,
    notionUrl: null,
    applicationUrl: null,
    nextAction: input.nextAction,
    nextActionOwner: 'Ben',
    nextActionDue: input.nextActionDue,
    evidenceGaps: input.evidenceGaps,
    sourceRefs: { targetSource: 'Six GHL asks brief, 1 August 2026', askMade: 'unknown' },
  };
}

function buildMatterSeed(): { matters: GoodsFundingMatter[]; routes: GoodsFundingRoute[] } {
  const matters: GoodsFundingMatter[] = [];
  const routes: GoodsFundingRoute[] = [];
  for (const [index, seed] of GOODS_MATTER_SEED_INPUT.entries()) {
    const matterId = `matter-${seed.slug}`;
    const { route, ...matter } = seed;
    matters.push({
      ...matter,
      id: matterId,
      openedAt: GOODS_CAPITAL_MODEL_AS_OF,
      closedAt: null,
    });
    if (route) routes.push({ ...route, id: `route-${route.routeCode}`, matterId });
    if (index > 20) break;
  }
  return { matters, routes };
}

const GOODS_MATTER_SEED = buildMatterSeed();
export const GOODS_FUNDING_MATTER_SEED = GOODS_MATTER_SEED.matters;
export const GOODS_FUNDING_ROUTE_SEED = GOODS_MATTER_SEED.routes;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asString = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const asStrings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const asNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function decodeBlock(row: Record<string, unknown>): GoodsCapitalBlock {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    purpose: String(row.purpose),
    amountMinAud: asNumber(row.amount_min_aud),
    amountMaxAud: asNumber(row.amount_max_aud),
    receivingEntityKind: row.receiving_entity_kind === 'company' ? 'company' : 'charity',
    receivingEntityName: String(row.receiving_entity_name),
    allowedInstruments: asStrings(row.allowed_instruments),
    state: (asString(row.state) ?? 'active') as GoodsCapitalBlock['state'],
    sourceRefs: asRecord(row.source_refs),
    sortOrder: asNumber(row.sort_order),
  };
}

function decodeMatter(row: Record<string, unknown>): GoodsFundingMatter {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    counterpartyName: String(row.counterparty_name),
    counterpartyEntityId: asString(row.counterparty_entity_id),
    purpose: String(row.purpose),
    state: row.state === 'closed' ? 'closed' : 'open',
    whyNow: asString(row.why_now),
    currentLearningQuestion: asString(row.current_learning_question),
    evidenceGaps: asStrings(row.evidence_gaps),
    authorityState: asString(row.authority_state) ?? 'unknown',
    communityAuthorityRef: asString(row.community_authority_ref),
    officialSourceUrl: asString(row.official_source_url),
    sourceRefs: asRecord(row.source_refs),
    nextReviewAt: asString(row.next_review_at),
    openedAt: asString(row.opened_at) ?? GOODS_CAPITAL_MODEL_AS_OF,
    closedAt: asString(row.closed_at),
  };
}

function decodeRoute(row: Record<string, unknown>): GoodsFundingRoute {
  return {
    id: String(row.id),
    matterId: String(row.matter_id),
    routeCode: String(row.route_code),
    routeType: String(row.route_type),
    namedRoute: asString(row.named_route),
    legalRecipientName: asString(row.legal_recipient_name),
    legalRecipientBasis: asString(row.legal_recipient_basis),
    eligibilityState: (asString(row.eligibility_state) ?? 'unknown') as GoodsEligibilityState,
    instrumentLabel: asString(row.instrument_label),
    targetAmountAud: row.target_amount_aud == null ? null : asNumber(row.target_amount_aud),
    askMadeAt: asString(row.ask_made_at),
    applicationState: (asString(row.application_state) ?? 'concept') as GoodsApplicationState,
    commitmentState: (asString(row.commitment_state) ?? 'none') as GoodsCommitmentState,
    commitmentAmountAud: row.commitment_amount_aud == null ? null : asNumber(row.commitment_amount_aud),
    commitmentEvidenceForm: (asString(row.commitment_evidence_form) ?? 'none') as GoodsCommitmentEvidence,
    commitmentEvidenceRef: asString(row.commitment_evidence_ref),
    matchAssessment: (asString(row.match_assessment) ?? 'unknown') as GoodsMatchAssessment,
    matchAssessmentReason: asString(row.match_assessment_reason),
    officialSourceUrl: asString(row.official_source_url),
    officialSourceCheckedAt: asString(row.official_source_checked_at),
    decisionDueAt: asString(row.decision_due_at),
    submittedAt: asString(row.submitted_at),
    ghlOpportunityId: asString(row.ghl_opportunity_id),
    notionUrl: asString(row.notion_url),
    applicationUrl: asString(row.application_url),
    nextAction: asString(row.next_action),
    nextActionOwner: asString(row.next_action_owner),
    nextActionDue: asString(row.next_action_due),
    evidenceGaps: asStrings(row.evidence_gaps),
    sourceRefs: asRecord(row.source_refs),
  };
}

function decodeAllocation(row: Record<string, unknown>): GoodsRouteAllocation {
  return {
    id: String(row.id),
    routeId: String(row.route_id),
    capitalBlockId: String(row.capital_block_id),
    proposedAmountAud: row.proposed_amount_aud == null ? null : asNumber(row.proposed_amount_aud),
    acceptedAmountAud: row.accepted_amount_aud == null ? null : asNumber(row.accepted_amount_aud),
    restrictions: asString(row.restrictions),
    allocationEvidenceRef: asString(row.allocation_evidence_ref),
  };
}

function decodeDecision(row: Record<string, unknown>): GoodsDecisionMemory {
  const judgment = asRecord(row.judgment);
  return {
    id: String(row.id),
    sourceRef: String(row.source_ref),
    decision: String(row.decision),
    reason: asString(row.reason),
    createdAt: asString(row.created_at) ?? GOODS_CAPITAL_MODEL_AS_OF,
    supersedesId: asString(row.supersedes_id),
    judgment: {
      whatChanged: asString(judgment.whatChanged) ?? undefined,
      nextMove: asString(judgment.nextMove) ?? undefined,
      nextLearningQuestion: asString(judgment.nextLearningQuestion) ?? undefined,
      revisitAt: asString(judgment.revisitAt) ?? undefined,
      commitment: Object.keys(asRecord(judgment.commitment)).length ? asRecord(judgment.commitment) : undefined,
    },
  };
}

function decodeEvent(row: Record<string, unknown>): GoodsLearningEvent {
  return {
    id: String(row.id),
    decisionId: asString(row.decision_id),
    title: String(row.title ?? 'Context event'),
    summary: String(row.summary ?? ''),
    signalKind: String(row.signal_kind ?? 'context'),
    happenedAt: asString(row.happened_at),
    actorName: asString(row.actor_name),
    organisation: asString(row.organisation),
    metadata: asRecord(row.metadata),
  };
}

function hasWrittenCommitment(route: GoodsFundingRoute): boolean {
  return ['accepted', 'fulfilled'].includes(route.commitmentState)
    && ['letter', 'executed_agreement'].includes(route.commitmentEvidenceForm)
    && Boolean(route.commitmentEvidenceRef)
    && (route.commitmentAmountAud ?? 0) > 0;
}

function buildCoverage(
  blocks: GoodsCapitalBlock[],
  matters: GoodsFundingMatter[],
  routes: GoodsFundingRoute[],
  allocations: GoodsRouteAllocation[],
  cashByRoute: Map<string, number>,
): GoodsCapitalBlockCoverage[] {
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const matterById = new Map(matters.map((matter) => [matter.id, matter]));

  return blocks.map((block) => {
    const linked = allocations
      .filter((allocation) => allocation.capitalBlockId === block.id)
      .flatMap((allocation) => {
        const route = routeById.get(allocation.routeId);
        const matter = route ? matterById.get(route.matterId) : null;
        return route && matter ? [{ allocation, route, matter }] : [];
      });
    const targetedAud = linked.reduce((sum, item) => sum + (item.allocation.proposedAmountAud ?? 0), 0);
    const offeredAud = linked.reduce((sum, item) =>
      ['offered', 'accepted', 'fulfilled'].includes(item.route.commitmentState)
        ? sum + (item.allocation.acceptedAmountAud ?? 0)
        : sum, 0);
    const committedAud = linked.reduce((sum, item) =>
      hasWrittenCommitment(item.route) ? sum + (item.allocation.acceptedAmountAud ?? 0) : sum, 0);
    const receivedAud = linked.reduce((sum, item) => sum + (cashByRoute.get(item.route.id) ?? 0), 0);
    return {
      ...block,
      targetedAud,
      offeredAud,
      committedAud,
      receivedAud,
      remainingMinAud: Math.max(0, block.amountMinAud - committedAud),
      remainingMaxAud: Math.max(0, block.amountMaxAud - committedAud),
      allocations: linked,
    };
  });
}

function gate(
  key: GoodsApplicationGate['key'],
  label: string,
  state: GoodsGateState,
  detail: string,
): GoodsApplicationGate {
  return { key, label, state, detail };
}

export function applicationGates(
  matter: GoodsFundingMatter,
  route: GoodsFundingRoute,
  allocations: GoodsRouteAllocation[],
): GoodsApplicationGate[] {
  const checkedAt = route.officialSourceCheckedAt ? new Date(route.officialSourceCheckedAt).getTime() : Number.NaN;
  const isCurrent = Number.isFinite(checkedAt) && checkedAt >= new Date('2026-07-01T00:00:00.000Z').getTime();
  const allocationTotal = allocations.reduce((sum, allocation) => sum + (allocation.proposedAmountAud ?? 0), 0);
  const authorityRequired = matter.authorityState !== 'not_required';

  return [
    gate('current', 'Current reality', isCurrent ? 'pass' : 'blocked', isCurrent
      ? `Official source checked ${route.officialSourceCheckedAt}.`
      : 'A current official source check is required.'),
    gate('route', 'Named route', route.namedRoute ? 'pass' : 'blocked', route.namedRoute ?? 'No named program, facility or decision route is verified.'),
    gate('use', 'Concrete use', allocationTotal > 0 ? 'pass' : 'blocked', allocationTotal > 0
      ? `${money(allocationTotal)} is explicitly allocated to GOODS capital blocks.`
      : 'The target is not allocated to a GOODS capital block.'),
    gate('entity', 'Eligible applicant', route.eligibilityState === 'eligible' ? 'pass' : route.eligibilityState === 'ineligible' ? 'blocked' : 'check',
      route.eligibilityState === 'eligible'
        ? `${route.legalRecipientName ?? 'The recipient'} is verified eligible.`
        : route.eligibilityState === 'conditional'
          ? 'The proposed recipient appears plausible but a route condition remains unverified.'
          : route.eligibilityState === 'ineligible'
            ? 'The proposed recipient is ineligible for this route.'
            : 'Recipient eligibility has not been verified.'),
    gate('authority', 'Community authority', !authorityRequired ? 'pass' : ['evidenced', 'confirmed'].includes(matter.authorityState) ? 'pass' : 'check',
      !authorityRequired
        ? 'No community representation claim is required for the current finance question.'
        : ['evidenced', 'confirmed'].includes(matter.authorityState)
          ? `Authority is ${matter.authorityState}${matter.communityAuthorityRef ? `: ${matter.communityAuthorityRef}` : '.'}`
          : 'Any place, community or First Nations representation in the ask needs an authority reference.'),
    gate('timing', 'Feasible timing', route.decisionDueAt ? 'pass' : 'blocked', route.decisionDueAt
      ? `Decision expected ${route.decisionDueAt}.`
      : 'No evidenced decision date is recorded, so QBE timing cannot be assessed.'),
  ];
}

function buildApplications(
  matters: GoodsFundingMatter[],
  routes: GoodsFundingRoute[],
  allocations: GoodsRouteAllocation[],
): GoodsApplicationRoom[] {
  const matterById = new Map(matters.map((matter) => [matter.id, matter]));
  return routes.flatMap((route) => {
    const matter = matterById.get(route.matterId);
    if (!matter) return [];
    const routeAllocations = allocations.filter((allocation) => allocation.routeId === route.id);
    const gates = applicationGates(matter, route, routeAllocations);
    return [{
      matter,
      route,
      allocations: routeAllocations,
      gates,
      readyGateCount: gates.filter((item) => item.state === 'pass').length,
      blockedGateCount: gates.filter((item) => item.state === 'blocked').length,
    }];
  });
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function latestDecisionFor(matter: GoodsFundingMatter, decisions: GoodsDecisionMemory[]): GoodsDecisionMemory | null {
  return decisions
    .filter((decision) => decision.sourceRef === matter.slug)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

export function selectGoodsAttention(
  matters: GoodsFundingMatter[],
  routes: GoodsFundingRoute[],
  decisions: GoodsDecisionMemory[],
  events: GoodsLearningEvent[],
  now = new Date(),
): GoodsAttentionMatter[] {
  const nowTime = now.getTime();
  const sevenDays = nowTime + 7 * 86_400_000;
  const eventByDecision = new Map<string, GoodsLearningEvent[]>();
  for (const event of events) {
    if (!event.decisionId) continue;
    const values = eventByDecision.get(event.decisionId) ?? [];
    values.push(event);
    eventByDecision.set(event.decisionId, values);
  }

  type AttentionCandidate = GoodsAttentionMatter & { priority: number };
  const candidates = matters
    .map<AttentionCandidate | null>((matter) => {
    if (matter.state === 'closed') return null;
    const route = routes.find((candidate) => candidate.matterId === matter.id) ?? null;
    const latestDecision = latestDecisionFor(matter, decisions);
    if (latestDecision?.judgment.nextMove === 'close') return null;

    const linkedEvents = latestDecision ? eventByDecision.get(latestDecision.id) ?? [] : [];
    const overduePromise = linkedEvents.find((event) => {
      const due = parseTime(asString(event.metadata.dueAt));
      const state = asString(event.metadata.state);
      return due !== null && due <= nowTime && !['fulfilled', 'released', 'declined'].includes(state ?? '');
    });
    if (overduePromise) {
      return { matter, route, trigger: 'promise_overdue', triggerLabel: 'GOODS promise overdue', dueAt: asString(overduePromise.metadata.dueAt), latestDecision, priority: 0 };
    }

    if (matter.slug === 'qbe-stage-2-truth-reset') {
      return { matter, route, trigger: 'truth_reset', triggerLabel: 'Campaign truth reset', dueAt: matter.nextReviewAt, latestDecision, priority: 1 };
    }

    const actionDue = parseTime(route?.nextActionDue);
    if (route?.nextAction && actionDue !== null && actionDue <= sevenDays) {
      return { matter, route, trigger: 'action_due', triggerLabel: actionDue <= nowTime ? 'Action overdue' : 'Action due this week', dueAt: route.nextActionDue, latestDecision, priority: actionDue <= nowTime ? 2 : 3 };
    }

    const revisitAt = parseTime(latestDecision?.judgment.revisitAt ?? matter.nextReviewAt);
    if (revisitAt !== null && revisitAt <= nowTime) {
      return { matter, route, trigger: 'review_due', triggerLabel: 'Human review due', dueAt: latestDecision?.judgment.revisitAt ?? matter.nextReviewAt, latestDecision, priority: 4 };
    }

    if (!latestDecision && matter.evidenceGaps.length > 0) {
      return { matter, route, trigger: 'evidence_gap', triggerLabel: 'Named evidence gap', dueAt: matter.nextReviewAt, latestDecision, priority: 5 };
    }
    return null;
  })
    .filter((candidate): candidate is AttentionCandidate => candidate !== null);

  return candidates
    .sort((left, right) => left.priority - right.priority
      || (parseTime(left.dueAt) ?? Number.POSITIVE_INFINITY) - (parseTime(right.dueAt) ?? Number.POSITIVE_INFINITY)
      || left.matter.title.localeCompare(right.matter.title))
    .slice(0, 5)
    .map(({ priority: _priority, ...item }) => item);
}

function officialEvidenceFrom(matter: GoodsFundingMatter): GoodsOfficialEvidence[] {
  const rows = matter.sourceRefs.officialEvidence;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((value) => {
    const row = asRecord(value);
    const label = asString(row.label);
    const url = asString(row.url);
    if (!label || !url) return [];
    return [{
      label,
      url,
      checkedAt: asString(row.checkedAt),
      detail: asString(row.detail) ?? 'No evidence note recorded.',
    }];
  });
}

function buildDossiers(
  matters: GoodsFundingMatter[],
  routes: GoodsFundingRoute[],
  events: GoodsLearningEvent[],
): GoodsCounterpartyDossier[] {
  return matters.map((matter) => {
    const route = routes.find((candidate) => candidate.matterId === matter.id) ?? null;
    const catalogue = asRecord(matter.sourceRefs.catalogue);
    const officialEvidence = officialEvidenceFrom(matter);
    const openPromises = events.filter((event) => {
      const beneficiary = `${event.organisation ?? ''} ${asString(event.metadata.beneficiary) ?? ''}`.toLowerCase();
      const counterparty = matter.counterpartyName.toLowerCase().split(/[(/]/)[0].trim();
      const state = asString(event.metadata.state);
      return beneficiary.includes(counterparty) && !['fulfilled', 'released', 'declined'].includes(state ?? '');
    });
    return {
      matter,
      route,
      catalogueThemes: asStrings(catalogue.themes),
      catalogueGeography: asString(catalogue.geography),
      officialEvidence,
      activeUnknowns: Array.from(new Set([...matter.evidenceGaps, ...(route?.evidenceGaps ?? [])])),
      openPromises,
      lastReviewedAt: officialEvidence.map((item) => item.checkedAt).filter(Boolean).sort().at(-1) ?? null,
    };
  });
}

async function loadPersistedModel(): Promise<{
  blocks: GoodsCapitalBlock[];
  matters: GoodsFundingMatter[];
  routes: GoodsFundingRoute[];
  allocations: GoodsRouteAllocation[];
  cashByRoute: Map<string, number>;
  error: string | null;
}> {
  const db = getServiceSupabase();
  const [blocksResult, mattersResult, routesResult, allocationsResult, tranchesResult] = await Promise.all([
    db.from('goods_capital_blocks').select('*').eq('project_code', GOODS_PROJECT_CODE).order('sort_order'),
    db.from('goods_funding_matters').select('*').eq('project_code', GOODS_PROJECT_CODE).order('next_review_at'),
    db.from('goods_funding_routes').select('*').order('next_action_due'),
    db.from('goods_route_allocations').select('*'),
    db.from('goods_tranches').select('funding_route_id, amount_aud').not('funding_route_id', 'is', null),
  ]);
  const structuralError = blocksResult.error ?? mattersResult.error ?? routesResult.error ?? allocationsResult.error;
  if (structuralError) {
    return {
      blocks: GOODS_CAPITAL_BLOCK_SEED,
      matters: GOODS_FUNDING_MATTER_SEED,
      routes: GOODS_FUNDING_ROUTE_SEED,
      allocations: [],
      cashByRoute: new Map(),
      error: structuralError.message,
    };
  }

  const cashByRoute = new Map<string, number>();
  if (!tranchesResult.error) {
    for (const row of (tranchesResult.data ?? []) as Array<Record<string, unknown>>) {
      const routeId = asString(row.funding_route_id);
      if (routeId) cashByRoute.set(routeId, (cashByRoute.get(routeId) ?? 0) + asNumber(row.amount_aud));
    }
  }
  return {
    blocks: ((blocksResult.data ?? []) as Array<Record<string, unknown>>).map(decodeBlock),
    matters: ((mattersResult.data ?? []) as Array<Record<string, unknown>>).map(decodeMatter),
    routes: ((routesResult.data ?? []) as Array<Record<string, unknown>>).map(decodeRoute),
    allocations: ((allocationsResult.data ?? []) as Array<Record<string, unknown>>).map(decodeAllocation),
    cashByRoute,
    error: null,
  };
}

async function loadMemory(matterSlugs: string[]): Promise<{
  decisions: GoodsDecisionMemory[];
  events: GoodsLearningEvent[];
}> {
  if (matterSlugs.length === 0) return { decisions: [], events: [] };
  const db = getServiceSupabase();
  const { data: decisionRows, error: decisionError } = await db
    .from('opportunity_decisions')
    .select('*')
    .eq('project_code', GOODS_PROJECT_CODE)
    .in('source_ref', matterSlugs)
    .order('created_at', { ascending: false });
  if (decisionError || !decisionRows) return { decisions: [], events: [] };
  const decisions = (decisionRows as Array<Record<string, unknown>>).map(decodeDecision);
  const decisionIds = decisions.map((decision) => decision.id);
  if (decisionIds.length === 0) return { decisions, events: [] };

  const { data: eventRows, error: eventError } = await db
    .from('opportunity_context_events')
    .select('*')
    .in('decision_id', decisionIds)
    .order('happened_at', { ascending: false });
  return {
    decisions,
    events: eventError || !eventRows ? [] : (eventRows as Array<Record<string, unknown>>).map(decodeEvent),
  };
}

export function buildGoodsCapitalWorkspace(input: {
  blocks: GoodsCapitalBlock[];
  matters: GoodsFundingMatter[];
  routes: GoodsFundingRoute[];
  allocations: GoodsRouteAllocation[];
  decisions?: GoodsDecisionMemory[];
  events?: GoodsLearningEvent[];
  cashByRoute?: Map<string, number>;
  dataSource?: GoodsCapitalWorkspace['dataSource'];
  dataWarning?: string | null;
  now?: Date;
}): GoodsCapitalWorkspace {
  const decisions = input.decisions ?? [];
  const events = input.events ?? [];
  const cashByRoute = input.cashByRoute ?? new Map<string, number>();
  const coverage = buildCoverage(input.blocks, input.matters, input.routes, input.allocations, cashByRoute);
  const applications = buildApplications(input.matters, input.routes, input.allocations);
  const targetAud = input.routes.reduce((sum, route) => sum + (route.targetAmountAud ?? 0), 0);
  const askMadeAud = input.routes.reduce((sum, route) => route.askMadeAt ? sum + (route.targetAmountAud ?? 0) : sum, 0);
  const offeredAud = input.routes.reduce((sum, route) =>
    ['offered', 'accepted', 'fulfilled'].includes(route.commitmentState) ? sum + (route.commitmentAmountAud ?? 0) : sum, 0);
  const committedAud = input.routes.reduce((sum, route) => hasWrittenCommitment(route) ? sum + (route.commitmentAmountAud ?? 0) : sum, 0);
  const receivedAud = Array.from(cashByRoute.values()).reduce((sum, amount) => sum + amount, 0);
  const allocatedTargetAud = input.allocations.reduce((sum, allocation) => sum + (allocation.proposedAmountAud ?? 0), 0);
  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    asOf: GOODS_CAPITAL_MODEL_AS_OF,
    dataSource: input.dataSource ?? 'database',
    dataWarning: input.dataWarning ?? null,
    blocks: input.blocks,
    matters: input.matters,
    routes: input.routes,
    allocations: input.allocations,
    decisions,
    events,
    coverage,
    applications,
    dossiers: buildDossiers(input.matters, input.routes, events),
    attention: selectGoodsAttention(input.matters, input.routes, decisions, events, input.now),
    summary: {
      needMinAud: input.blocks.reduce((sum, block) => sum + block.amountMinAud, 0),
      needMaxAud: input.blocks.reduce((sum, block) => sum + block.amountMaxAud, 0),
      targetAud,
      askMadeAud,
      offeredAud,
      committedAud,
      receivedAud,
      allocatedTargetAud,
      unallocatedTargetAud: Math.max(0, targetAud - allocatedTargetAud),
      signedCommitmentCount: input.routes.filter(hasWrittenCommitment).length,
      openMatterCount: input.matters.filter((matter) => matter.state === 'open').length,
      readyApplicationCount: applications.filter((application) => application.readyGateCount === application.gates.length).length,
    },
  };
}

export const getGoodsCapitalWorkspace = cache(async function getGoodsCapitalWorkspace(): Promise<GoodsCapitalWorkspace> {
  const model = await loadPersistedModel();
  const memory = await loadMemory(model.matters.map((matter) => matter.slug));
  return buildGoodsCapitalWorkspace({
    ...model,
    ...memory,
    dataSource: model.error ? 'evidence_safe_seed' : 'database',
    dataWarning: model.error
      ? 'The GOODS capital workspace migration is not applied in this environment. Showing the evidence-safe 1 August seed; recorded targets remain unallocated and uncommitted.'
      : null,
  });
});

export function money(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function moneyRange(min: number, max: number): string {
  return min === max ? money(min) : `${money(min)}–${money(max)}`;
}

export function matterRoute(
  workspace: GoodsCapitalWorkspace,
  matter: GoodsFundingMatter,
): GoodsFundingRoute | null {
  return workspace.routes.find((route) => route.matterId === matter.id) ?? null;
}

export function matterBySlug(
  workspace: GoodsCapitalWorkspace,
  slug: string,
): GoodsFundingMatter | null {
  return workspace.matters.find((matter) => matter.slug === slug) ?? null;
}

export function applicationByRouteCode(
  workspace: GoodsCapitalWorkspace,
  routeCode: string,
): GoodsApplicationRoom | null {
  return workspace.applications.find((application) => application.route.routeCode === routeCode) ?? null;
}
