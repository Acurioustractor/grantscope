export type GoodsEvidenceStatus =
  | 'verified'
  | 'workpaper'
  | 'modelled'
  | 'community-confirmation'
  | 'open'
  | 'retired';

export interface GoodsEvidenceClaim {
  label: string;
  value: string;
  status: GoodsEvidenceStatus;
  note: string;
}

export interface GoodsRoadStop {
  number: number;
  place: string;
  title: string;
  truth: string;
}

export interface GoodsPublicStage {
  id: 'yarn' | 'shape' | 'resource' | 'deliver' | 'transfer' | 'grow';
  label: string;
  line: string;
  holds: string;
}

export interface GoodsPlacePathway {
  id: 'oonchiumpa' | 'utopia' | 'tennant-creek' | 'palm-island';
  name: string;
  country: string;
  stage: GoodsPublicStage['id'];
  relationship: string;
  whatWeHeard: string;
  currentShape: string;
  modules: string[];
  proof: GoodsEvidenceClaim[];
  capital: {
    label: string;
    value: string;
    status: GoodsEvidenceStatus;
    note: string;
  };
  operating: {
    value: string;
    status: GoodsEvidenceStatus;
    note: string;
  };
  nextDecision: string;
  questions: [string, string];
  caution: string;
}

export interface GoodsMoneyDoor {
  id: 'give' | 'buy' | 'invest';
  label: string;
  verb: string;
  recipient: string;
  paysFor: string;
  proofBeforeMore: string;
}

export interface GoodsForm {
  id: 'maker' | 'public-good' | 'community-enterprise';
  label: string;
  legalState: string;
  holds: string;
  receives: string;
  status: GoodsEvidenceStatus;
}

export const GOODS_NORTH_STAR =
  'The goal was never a bigger Goods. It is a community that can collect the plastic, make the goods, and come to own the making.';

export const GOODS_MODEL_AS_OF = '28 July 2026';

export const GOODS_ROAD: GoodsRoadStop[] = [
  {
    number: 1,
    place: 'Kalgoorlie',
    title: 'The bed disappeared into the tent',
    truth: 'Gloria Turner showed that usefulness is understood in use, before it becomes a metric.',
  },
  {
    number: 2,
    place: 'Tennant Creek',
    title: 'Who gets asked?',
    truth: 'A product pathway begins with relationship and authority, not with a site template.',
  },
  {
    number: 3,
    place: 'Tennant Creek',
    title: 'A machine received a name',
    truth: 'Dianne Stokes named Pakkimjalki Kari. Language and story are part of what the work holds.',
  },
  {
    number: 4,
    place: 'Palm Island',
    title: 'The sea entered the price',
    truth: 'Freight, access and local decisions are not footnotes to a unit-cost cell.',
  },
  {
    number: 5,
    place: 'Utopia Homelands',
    title: 'Arrival was not the ending',
    truth: 'Delivery matters, but the deeper question is what capability and control stay after the truck leaves.',
  },
  {
    number: 6,
    place: 'Maningrida and the farm',
    title: 'Capability was proven',
    truth: 'A real pressed-bed run exists. Sustained time, yield and cost still need to be measured.',
  },
  {
    number: 7,
    place: 'Oonchiumpa',
    title: 'The hands changed',
    truth: 'Young people built beds. The next test is whether making, contracts and decisions can move too.',
  },
  {
    number: 8,
    place: 'The gap',
    title: 'The product has proof. Transfer does not yet.',
    truth: '540 beds have gone out across 11 served communities, but no community yet owns the full making.',
  },
];

export const GOODS_PUBLIC_STAGES: GoodsPublicStage[] = [
  {
    id: 'yarn',
    label: 'Yarn',
    line: 'Community names what would be useful and what is already strong.',
    holds: 'The agenda',
  },
  {
    id: 'shape',
    label: 'Shape',
    line: 'Choose together only the pieces the community actually wants.',
    holds: 'The design',
  },
  {
    id: 'resource',
    label: 'Resource',
    line: 'Price the work and confirm roles, contracts and the intended owner.',
    holds: 'The terms',
  },
  {
    id: 'deliver',
    label: 'Deliver',
    line: 'Install, train, make locally and solve the problems that show up.',
    holds: 'The making',
  },
  {
    id: 'transfer',
    label: 'Transfer',
    line: 'Customers, contracts, revenue, knowledge and decisions move to the agreed owner.',
    holds: 'The enterprise',
  },
  {
    id: 'grow',
    label: 'Grow',
    line: 'Community-approved evidence and surplus strengthen what comes next.',
    holds: 'The story and surplus',
  },
];

export const GOODS_PLACE_PATHWAYS: GoodsPlacePathway[] = [
  {
    id: 'oonchiumpa',
    name: 'Oonchiumpa',
    country: 'Mparntwe / Alice Springs, NT',
    stage: 'resource',
    relationship: 'Oonchiumpa leadership and project team with Goods on Country',
    whatWeHeard:
      'Young people have already assembled beds. Oonchiumpa has shaped a facility and youth pathway, with local making and control as the direction.',
    currentShape: 'A complete production pathway, built in stages and held against an agreed ownership destination.',
    modules: ['Equipment', 'Place', 'Skills', 'People', 'Systems', 'Enterprise', 'Money', 'Story + evidence'],
    proof: [
      {
        label: 'Activity',
        value: 'Young people built Stretch Beds',
        status: 'verified',
        note: 'The practical build and delivery activity is documented.',
      },
      {
        label: 'Direction',
        value: 'Community-controlled production',
        status: 'community-confirmation',
        note: 'The direction is developed. Final legal and selling arrangements are not settled.',
      },
    ],
    capital: {
      label: 'Selected production modules + site base',
      value: '$95.8K–$142.5K',
      status: 'modelled',
      note: '$63,967–$78,467 of modules plus a $31,800–$64,000 site base. Internal scenario range, not a quote.',
    },
    operating: {
      value: '$79.3K / year before a line supervisor',
      status: 'workpaper',
      note: 'Bare production block only. Community support and wraparound costs remain separate.',
    },
    nextDecision: 'Agree the operator, final scope, seller arrangement and ownership path before a funder-ready ask is treated as real.',
    questions: [
      'Who should hold the machines, customer contracts and margin at the first operating milestone?',
      'Who pays and employs the line supervisor while capability is transferred?',
    ],
    caution: 'The intended community enterprise is not yet a settled legal form, and the seller-of-record remains open.',
  },
  {
    id: 'utopia',
    name: 'Utopia Homelands',
    country: 'Urapuntja, NT',
    stage: 'shape',
    relationship: 'Jane Wilson and Urapuntja Aboriginal Corporation',
    whatWeHeard:
      '147 Stretch Beds are confirmed in community. The next working request is a shredder, not a complete factory.',
    currentShape: 'Collection and shredding first, with any later production pathway chosen separately.',
    modules: ['Equipment', 'Skills', 'People', 'Systems', 'Story + evidence'],
    proof: [
      {
        label: 'Product use',
        value: '147 Stretch Beds',
        status: 'verified',
        note: 'Current canonical community count.',
      },
      {
        label: 'First module',
        value: 'Shredder pathway',
        status: 'community-confirmation',
        note: 'A working request to confirm with Jane and Urapuntja.',
      },
    ],
    capital: {
      label: 'Collection + shredder modules',
      value: '$24.8K–$39.3K + site base',
      status: 'modelled',
      note: 'The site base is deliberately unresolved until place, power, storage and operator needs are known.',
    },
    operating: {
      value: '$51.0K / year before a line supervisor',
      status: 'workpaper',
      note: 'Includes the $35,000 site floor and $16,043 module share. The old $16,043 total was incomplete.',
    },
    nextDecision: 'Confirm what a shredder would enable, who would operate it, and what support Urapuntja wants.',
    questions: [
      'Who will operate and maintain the shredder, and where will it safely live?',
      'What feedstock and collection arrangement already exists, and is a baler actually wanted?',
    ],
    caution: 'A complete facility would outrun the request currently on the table.',
  },
  {
    id: 'tennant-creek',
    name: 'Tennant Creek',
    country: 'Warumungu Country, NT',
    stage: 'yarn',
    relationship: 'Our Community Shed and Tennant Creek Youth Centre',
    whatWeHeard:
      'There is deep product history, an existing shed and youth-centre relationship. The current people, site and partner roles need to be reconfirmed.',
    currentShape: 'Begin with one small build, repair or production activity through an existing base.',
    modules: ['Products', 'Equipment', 'Skills', 'People', 'Systems', 'Enterprise'],
    proof: [
      {
        label: 'Existing base',
        value: 'Community Shed + Youth Centre',
        status: 'verified',
        note: 'The organisations and earlier pathway are documented.',
      },
      {
        label: 'Current mandate',
        value: 'Needs reconfirmation',
        status: 'open',
        note: 'An earlier proposal is evidence of history, not current consent.',
      },
    ],
    capital: {
      label: 'Known production modules',
      value: '$59.0K + unagreed base',
      status: 'modelled',
      note: 'The partner-supplied base cannot be subtracted until the partner says what it will provide.',
    },
    operating: {
      value: '$75.7K / year before a line supervisor',
      status: 'workpaper',
      note: 'Scenario allocation for the selected production modules, not a partner-approved budget.',
    },
    nextDecision: 'Choose one small operational pilot before revisiting a full production pathway.',
    questions: [
      'What do the Shed and Youth Centre still want, and who has authority to decide now?',
      'Which place, people, insurance, power and tools are genuinely available?',
    ],
    caution: 'The previous proposal and quote cannot be treated as a present request.',
  },
  {
    id: 'palm-island',
    name: 'Palm Island',
    country: 'Manbarra Country, QLD',
    stage: 'yarn',
    relationship: 'Council-led introduction',
    whatWeHeard:
      'Goods has relationships and delivery history, but no current community capability audit or production request.',
    currentShape: 'Governance and listening before any plant or product pathway is proposed.',
    modules: ['Story + evidence'],
    proof: [
      {
        label: 'Relationship',
        value: 'Existing Goods connections',
        status: 'verified',
        note: 'A relationship is not the same thing as a mandate.',
      },
      {
        label: 'Production request',
        value: 'None confirmed',
        status: 'open',
        note: 'No plant option should be presented as a community request.',
      },
    ],
    capital: {
      label: 'Plant and equipment',
      value: 'Not priced',
      status: 'open',
      note: 'The right first investment is governance and scoping, not machinery.',
    },
    operating: {
      value: 'Governance work is unpriced',
      status: 'open',
      note: '$0 in the old model meant a missing cost line. It did not mean the work was free.',
    },
    nextDecision: 'Confirm the right people, decision process and first listening conversation.',
    questions: [
      'Who should be in the first conversation, and how does Council want the decision held?',
      'What is already strong, useful and community-led before Goods suggests anything?',
    ],
    caution: 'Any factory figure here would manufacture certainty that the relationship does not yet hold.',
  },
];

export interface GoodsUnitEconomicsInput {
  salePrice?: number;
  currentMarginalCost?: number;
  pressedMarginalCost?: number;
  annualNetworkBlock?: number;
}

export function deriveGoodsUnitEconomics(input: GoodsUnitEconomicsInput = {}) {
  const salePrice = input.salePrice ?? 750;
  const currentMarginalCost = input.currentMarginalCost ?? 684.79;
  const pressedMarginalCost = input.pressedMarginalCost ?? 425.74;
  const annualNetworkBlock = input.annualNetworkBlock ?? 109_500;
  const currentContribution = salePrice - currentMarginalCost;
  const pressedContribution = salePrice - pressedMarginalCost;
  const contributionChange = pressedContribution - currentContribution;

  return {
    salePrice,
    currentMarginalCost,
    pressedMarginalCost,
    currentContribution,
    pressedContribution,
    contributionChange,
    annualNetworkBlock,
    pressedNetworkBreakEvenBeds:
      pressedContribution > 0 ? Math.ceil(annualNetworkBlock / pressedContribution) : null,
  };
}

export const GOODS_UNIT_ECONOMICS = deriveGoodsUnitEconomics();

export const GOODS_COST_CENTRES = [
  {
    id: 'product',
    label: 'Product making',
    amount: '$425.74 modelled marginal cost',
    paidBy: 'Product orders',
    includes: 'Materials, production labour, ordinary packing and product freight assumptions.',
    boundary: 'Must show that each product can carry its own making.',
    status: 'modelled' as const,
  },
  {
    id: 'network',
    label: 'Goods network',
    amount: 'About $109.5K / year',
    paidBy: 'Contribution across product orders, with working capital bridged where needed',
    includes: 'Design, quality, training, buyer work, back office and field relationship travel.',
    boundary: 'Shared across places. It should not be copied into every site budget.',
    status: 'workpaper' as const,
  },
  {
    id: 'wraparound',
    label: 'Community wraparound',
    amount: 'About $300K / year + local program share',
    paidBy: 'Gifts and public-good funding by design',
    includes: 'Employment brokerage, participation, governance, learning and local support.',
    boundary: 'It is not hidden inside a bed price to create a false commercial claim.',
    status: 'workpaper' as const,
  },
];

export const GOODS_FORMS: GoodsForm[] = [
  {
    id: 'maker',
    label: 'Goods. inside A Curious Tractor Pty Ltd',
    legalState: 'Current legal recipient, with seller-of-record during transition still to confirm',
    holds: 'Product design, quality, training, equipment support, buyers, working capital and back office',
    receives: 'Orders and repayable investment',
    status: 'open',
  },
  {
    id: 'public-good',
    label: 'Goods on Country inside The Butterfly Movement Ltd',
    legalState: 'Current charity and DGR recipient',
    holds: 'Relationship work, learning, community participation, evidence and wraparound',
    receives: 'Tax-deductible gifts and public-good funding',
    status: 'verified',
  },
  {
    id: 'community-enterprise',
    label: 'Community production enterprise',
    legalState: 'Intended third form, not yet settled',
    holds: 'Local machinery, making, customer contracts, margin, knowledge and decisions as agreed',
    receives: 'Future local trading revenue and assets as they transfer',
    status: 'open',
  },
];

export const GOODS_MONEY_DOORS: GoodsMoneyDoor[] = [
  {
    id: 'give',
    label: 'Give',
    verb: 'Buy the time',
    recipient: 'The Butterfly Movement Ltd',
    paysFor: 'Relationship, participation, governance, learning, evidence and wraparound.',
    proofBeforeMore: 'Community-approved account of what was asked, done, learned and still unresolved.',
  },
  {
    id: 'buy',
    label: 'Buy or order',
    verb: 'Prove the product',
    recipient: 'Goods. trading recipient, seller-of-record to be confirmed',
    paysFor: 'Beds, making, ordinary delivery and contribution to the shared Goods network.',
    proofBeforeMore: 'Signed or authorised demand, delivered product, quality record and real contribution.',
  },
  {
    id: 'invest',
    label: 'Invest repayably',
    verb: 'Bridge the work',
    recipient: 'A Curious Tractor Pty Ltd, subject to agreed terms',
    paysFor: 'Order-backed working capital, measured production and selected productive assets.',
    proofBeforeMore: 'A measured run, clear repayment source, agreed asset owner and release milestones.',
  },
];

export const GOODS_DECISION_GATES = [
  {
    label: 'Demand',
    question: 'Which beds are signed, authorised or contracted at $750?',
    why: 'A modelled need is not a purchase order. The 1,000-bed question remains a question until a buyer commits.',
    status: 'open' as const,
  },
  {
    label: 'Production',
    question: 'Does the modelled $425.74 cost survive a full measured run?',
    why: 'The next run should record labour time, yield, offcut, energy, quality and throughput.',
    status: 'modelled' as const,
  },
  {
    label: 'Responsibility',
    question: 'Who employs the operator and carries warranty, depreciation and maintenance?',
    why: 'These lines were missing or unresolved in the financial-model conversation.',
    status: 'open' as const,
  },
  {
    label: 'Transfer',
    question: 'Who will sell, own the assets and hold the margin at each milestone?',
    why: 'The third form is the destination of the work, not a company box that can be assumed in advance.',
    status: 'open' as const,
  },
];

export const GOODS_CLAIM_LEDGER: GoodsEvidenceClaim[] = [
  {
    label: 'Historical Goods carve-out',
    value: '$713,827 FY2026 revenue; 89% grant-funded',
    status: 'verified',
    note: 'The revenue carve-out is accountant-signed. It proves activity, not commercial bed demand.',
  },
  {
    label: 'Sale price',
    value: '$750 per Stretch Bed',
    status: 'verified',
    note: 'Current quoted sale price.',
  },
  {
    label: 'Operational proof',
    value: '540 beds, 22 washers, 11 served communities',
    status: 'verified',
    note: 'Canonical operational ruling as at 25 July 2026.',
  },
  {
    label: 'Current marginal cost',
    value: '$684.79 per bed',
    status: 'workpaper',
    note: 'A traceable costing workpaper, not audited actual cost.',
  },
  {
    label: 'Pressed marginal cost',
    value: '$425.74 per bed',
    status: 'modelled',
    note: 'Must be tested through a fully measured production run.',
  },
  {
    label: 'Central break-even',
    value: 'About 338 pressed beds / year',
    status: 'modelled',
    note: 'Only covers the $109,500 shared Goods network block at modelled pressed contribution.',
  },
  {
    label: 'Capital stack',
    value: '$0 signed match-eligible capital today',
    status: 'verified',
    note: 'The $300K SEFA, $400K QBE and $500K philanthropy lines in the entity workbook are placeholders, not commitments.',
  },
  {
    label: 'Spreadsheet growth curve',
    value: '400 → 8,600 beds / year',
    status: 'retired',
    note: 'Capacity-driven auto-build scenario with no demand constraint. Useful for stress-testing machinery, not as an investment claim.',
  },
  {
    label: 'Site break-even',
    value: '234–529 beds / year',
    status: 'modelled',
    note: 'Scenario range driven mainly by who pays the line supervisor. It is not a promise.',
  },
  {
    label: 'Old site shortcut',
    value: '75–100 beds / year',
    status: 'retired',
    note: 'Based on a $24,000 rent line being mistaken for a full operating block.',
  },
  {
    label: 'Generic site price',
    value: '$90K–$123K',
    status: 'retired',
    note: 'Replaced by place-specific modules, site-base decisions and governance costs.',
  },
];
