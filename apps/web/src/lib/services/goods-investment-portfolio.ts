/**
 * Goods Investment Portfolio — one row per community pathway, not one row per grant.
 *
 * Source of truth for the readings below:
 *   thoughts/shared/handoffs/goods-investment-portfolio-alignment-2026-08-10.md
 * which in turn cites the Goods Asset Register STRATEGY.md / DECISIONS.md and
 * scripts/funding-profiles/goods-on-country.json.
 *
 * This lives in code, not markdown, so the stage vocabulary and the "do not do
 * yet" guards cannot drift away from the screen that renders them. A pathway is
 * eligible for investment work ONLY when it has a named next community decision
 * AND a relationship owner — `isPortfolioEligible()` enforces that, it is not a
 * label someone can type.
 */

/** Goods decision-log stage vocabulary. Ordered listen -> deliver. */
export type PathwayStage = 'yarn' | 'shape' | 'resource' | 'deliver';

/** Decision status for the weekly portfolio read (handoff column 9). */
export type PortfolioDecision =
  | 'listen'
  | 'scope'
  | 'ready to pursue'
  | 'submitted'
  | 'funded/delivering'
  | 'hold';

/** The six investment uses. Every opportunity must declare exactly one. */
export type InvestmentUse =
  | 'relationship-and-scoping'
  | 'community-wraparound'
  | 'production-equipment'
  | 'measured-production-run'
  | 'buyer-delivery'
  | 'shared-network';

export const INVESTMENT_USES: Record<InvestmentUse, {
  label: string;
  suitableCapital: string;
  evidenceRequired: string;
}> = {
  'relationship-and-scoping': {
    label: 'Community relationship & scoping',
    suitableCapital: 'Grant, philanthropy',
    evidenceRequired: 'Named conversation, relationship owner, scope question, community-controlled next step',
  },
  'community-wraparound': {
    label: 'Community wraparound',
    suitableCapital: 'Grant, donation, philanthropic support',
    evidenceRequired: 'Participant/support design, delivery partner, cost centre separated from product making',
  },
  'production-equipment': {
    label: 'Product making / production equipment',
    suitableCapital: 'Repayable capital, productive-asset finance, order-backed pre-purchase',
    evidenceRequired: 'Asset owner, repayment source, buyer or order pathway, release gates',
  },
  'measured-production-run': {
    label: 'Measured production run',
    suitableCapital: 'Grant, catalytic funding',
    evidenceRequired: '50-bed measurement plan, cost capture, learning/reporting plan',
  },
  'buyer-delivery': {
    label: 'Buyer delivery / procurement',
    suitableCapital: 'Purchase order, pre-purchase, contract',
    evidenceRequired: 'Product bundle, price, freight, warranty/support, contracting party',
  },
  'shared-network': {
    label: 'Shared Goods network',
    suitableCapital: 'Grant, philanthropy, shared-service revenue',
    evidenceRequired: 'Explicit network costs: design, quality, training, back office, field travel',
  },
};

export type PathwayLink = { label: string; href: string; system: 'GrantScope' | 'Notion' | 'GHL' | 'Repo' };

export type CommunityPathway = {
  id: string;
  /** Community name first, colonial or administrative name in brackets where used. */
  community: string;
  stage: PathwayStage;
  decision: PortfolioDecision;
  /** Relationship and authority state, in plain words. */
  authority: string;
  /** Null when nobody is named — this is what blocks portfolio eligibility. */
  relationshipOwner: string | null;
  /** Null when there is no current named community decision. */
  nextDecision: string | null;
  nextActionDue: string | null;
  /** Evidence already held: asset/service history, request, invoice/order, partner artefact. */
  evidenceHeld: string[];
  investmentUse: InvestmentUse;
  moneyRoute: string;
  /** Hard eligibility blocks and things not to claim yet. */
  doNotYet: string;
  links: PathwayLink[];
};

/**
 * Stage and authority readings come from the Goods decision log via the
 * 2026-08-10 alignment handoff. No community site is currently eligible for an
 * ownership claim, and CRM stage is never treated as approval.
 */
export const COMMUNITY_PATHWAYS: readonly CommunityPathway[] = [
  {
    id: 'oonchiumpa',
    community: 'Oonchiumpa / Mparntwe (Alice Springs)',
    stage: 'resource',
    decision: 'submitted',
    authority: 'Oonchiumpa leads the REAL consortium; production pathway is active',
    relationshipOwner: 'Nicholas Marchesi',
    nextDecision: 'Keep the submitted facility pathway, governance and seller-of-record logic current',
    nextActionDue: null,
    evidenceHeld: [
      'REAL Innovation Fund application submitted',
      'Consortium governance and seller-of-record work in progress',
    ],
    investmentUse: 'production-equipment',
    moneyRoute: 'REAL Innovation Fund is submitted; other grants or capital only after entity/eligibility checks',
    doNotYet: 'Do not present site pricing as a community-agreed commitment, or treat CRM status as approval.',
    links: [{ label: 'Alice Springs pathway notes', href: '/org/act/goods/communities', system: 'GrantScope' }],
  },
  {
    id: 'utopia',
    community: 'Utopia / Urapuntja',
    stage: 'shape',
    decision: 'scope',
    authority: 'Community pathway is present; intended module is a shredder, not a full facility',
    relationshipOwner: 'Nicholas Marchesi',
    nextDecision: 'Agree the module, operator, place and maintenance arrangement',
    nextActionDue: null,
    evidenceHeld: ['Community pathway conversation recorded in the Goods decision log'],
    investmentUse: 'relationship-and-scoping',
    moneyRoute: 'Small scoping/capability money; later partner-led enterprise route',
    doNotYet: 'Do not force this into a whole-site capital case, or count delivered assets as a current request.',
    links: [{ label: 'Communities hub', href: '/org/act/goods/communities', system: 'GrantScope' }],
  },
  {
    id: 'tennant-creek',
    community: 'Tennant Creek / Wumpurrarni',
    stage: 'yarn',
    decision: 'listen',
    authority: 'Existing relationships, but reconnection is still unresolved',
    relationshipOwner: null,
    nextDecision: 'Send and receive a response to the reconnection conversation; establish what the shed and partners want',
    nextActionDue: null,
    evidenceHeld: ['Prior relationships on record'],
    investmentUse: 'relationship-and-scoping',
    moneyRoute: 'Centrecorp/buyer route only after a real purchase or partner proposition exists',
    doNotYet: 'Do not write a production or capital application before the community direction is current.',
    links: [{ label: 'Network', href: '/org/act/goods/network', system: 'GrantScope' }],
  },
  {
    id: 'palm-island',
    community: 'Palm Island / Bwgcolman',
    stage: 'yarn',
    decision: 'listen',
    authority: 'Council and PICC relationship records exist; no current authorised request is established',
    relationshipOwner: null,
    nextDecision: 'Ask where this sits and what governance work is wanted',
    nextActionDue: null,
    evidenceHeld: ['PICC receivable on the sole trader ($113.3K)', 'Prior delivery and paid non-product work'],
    investmentUse: 'relationship-and-scoping',
    moneyRoute: 'Place-based partner or foundation conversation, after a request exists',
    doNotYet: 'Do not turn prior delivery or paid non-product work into a demand claim.',
    links: [{ label: 'Network', href: '/org/act/goods/network', system: 'GrantScope' }],
  },
  {
    id: 'maningrida',
    community: 'Maningrida',
    stage: 'deliver',
    decision: 'funded/delivering',
    authority: 'Delivery evidence, not a community production site: Homeland School partnership',
    relationshipOwner: 'Nicholas Marchesi',
    nextDecision: 'Capture production-rate cost and operational learning from the measured 40-bed farm-pressed run',
    nextActionDue: null,
    evidenceHeld: ['40-bed farm-pressed run', 'Homeland School partnership'],
    investmentUse: 'measured-production-run',
    moneyRoute: 'Evidence/support funding; buyer proof',
    doNotYet: 'Do not claim a community-owned site, or use this run as measured unit economics.',
    links: [{ label: 'Evidence', href: '/org/act/goods/proof', system: 'GrantScope' }],
  },
];

/**
 * A pathway earns investment work only with BOTH a named next community
 * decision and a relationship owner. Everything else is relationship work.
 */
export function isPortfolioEligible(p: CommunityPathway): boolean {
  return Boolean(p.relationshipOwner) && Boolean(p.nextDecision);
}

/** Known source conflicts — shown on the screen rather than silently resolved. */
export const PORTFOLIO_DATA_LIMITS: readonly string[] = [
  'The asset CSV holds 389 individual records while Goods canon says 540 deployed beds and 22 washers in community. Operational evidence, not the portfolio aggregate.',
  'The REAL pathway is ~$2m over three years in the Goods decision log, but an older GrantScope operating-system row says $1.2m over four years. Use the newer Goods ruling until reconciled.',
  'Partner records and CRM stages support internal coordination only. They do not prove a community request or approval.',
];

export const STAGE_LABEL: Record<PathwayStage, string> = {
  yarn: 'Yarn',
  shape: 'Shape',
  resource: 'Resource',
  deliver: 'Deliver',
};
