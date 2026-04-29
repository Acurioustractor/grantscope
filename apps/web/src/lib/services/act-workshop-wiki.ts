import type { WikiSupportIndex } from '@/lib/services/wiki-support-index';

export type WorkshopAreaId =
  | 'vision-ambition'
  | 'social-objective-impact'
  | 'business-model'
  | 'financial-performance'
  | 'strategy-risk'
  | 'process-technology'
  | 'governance-reporting'
  | 'people-organisation'
  | 'legal-structure'
  | 'investors-capital';

export type WorkshopArea = {
  id: WorkshopAreaId;
  label: string;
  question: string;
  sharedStrength: string;
  projectSlugs: string[];
  sourceRoles: string[];
  templates: string[];
  nextAction: string;
};

export const WORKSHOP_AREAS: WorkshopArea[] = [
  {
    id: 'vision-ambition',
    label: 'Vision and ambition',
    question: 'Does the organisation have a clear overall vision, including the path for how to get there?',
    sharedStrength:
      'Use the ACT operational thesis and project-code map as the shared spine: each project should connect to a clear ambition, proof base, and next move.',
    projectSlugs: ['civicgraph', 'goods', 'justicehub', 'empathy-ledger'],
    sourceRoles: ['operating-system', 'project-code-map', 'project-map'],
    templates: ['one-page ambition map', 'project lane brief', 'funder narrative spine'],
    nextAction: 'Write one sentence for each project: what changes, who benefits, what proof exists, and what support is needed next.',
  },
  {
    id: 'social-objective-impact',
    label: 'Social objective and impact',
    question: 'Can the organisation articulate the social problem being addressed and the gaps in the current system?',
    sharedStrength:
      'Use CivicGraph, JusticeHub, ALMA, Empathy Ledger, and Goods field evidence together: data shows the gap, stories make it legible, projects show the response.',
    projectSlugs: ['civicgraph', 'justicehub', 'goods', 'empathy-ledger', 'picc'],
    sourceRoles: ['operating-system', 'goods-evidence', 'asset-evidence'],
    templates: ['problem-gap-proof table', 'theory of change note', 'impact evidence register'],
    nextAction: 'Tag every impact claim to a project, evidence source, confidence level, and funder-facing wording.',
  },
  {
    id: 'business-model',
    label: 'Business model clarity',
    question: 'Can the organisation clearly articulate its business model?',
    sharedStrength:
      'Separate the shared service model from project delivery: ACT provides intelligence, systems, story, design, pipeline, CRM, and application capability across multiple project lanes.',
    projectSlugs: ['goods', 'civicgraph', 'justicehub'],
    sourceRoles: ['procurement-scale-plan', 'market-research', 'operating-system'],
    templates: ['revenue lane map', 'contract strategy canvas', 'shared service offer menu'],
    nextAction: 'Turn each route into a lane: grants, foundations, procurement, subscriptions, services, capital, or partnership.',
  },
  {
    id: 'financial-performance',
    label: 'Financial performance',
    question: 'Is the organisation financially sustainable?',
    sharedStrength:
      'The finance/project-code system already links spend, receipts, R&D evidence, delivery costs, and project strategy. Use that as the application-ready financial narrative.',
    projectSlugs: ['goods', 'civicgraph', 'justicehub'],
    sourceRoles: ['finance-map', 'operating-system', 'grant-application'],
    templates: ['use-of-funds table', 'unit economics note', 'grant budget evidence pack'],
    nextAction: 'For each priority project, capture current spend, next 12 month need, likely revenue route, and evidence still missing.',
  },
  {
    id: 'strategy-risk',
    label: 'Strategy and risk',
    question: 'Is there a clearly defined strategic planning process and risk management process?',
    sharedStrength:
      'Use pipeline status, foundation boards, source frontier review, GHL follow-ups, and project codes as one operating rhythm rather than separate lists.',
    projectSlugs: ['goods', 'civicgraph', 'justicehub', 'empathy-ledger'],
    sourceRoles: ['operating-system', 'knowledge-system', 'project-map'],
    templates: ['decision register', 'risk and blocker board', '90-day support plan'],
    nextAction: 'Convert every open opportunity into a decision: pursue, park, source more evidence, assign owner, or send to GHL.',
  },
  {
    id: 'process-technology',
    label: 'Process and technology maturity',
    question: 'Are fit for purpose and efficient processes and supporting technology/systems in place?',
    sharedStrength:
      'CivicGraph, GrantScope, GHL, Goods asset register, ACT wiki, and source frontier can form one loop: discover, qualify, evidence, act, follow up, learn.',
    projectSlugs: ['civicgraph', 'goods', 'empathy-ledger'],
    sourceRoles: ['technology-system', 'knowledge-system', 'repo-map'],
    templates: ['systems map', 'data flow checklist', 'GHL handoff template'],
    nextAction: 'Document what each system owns, what it mirrors, and what should never be duplicated there.',
  },
  {
    id: 'governance-reporting',
    label: 'Governance, data and reporting',
    question: 'Is the organisation well governed, with the right skilled board and reporting rhythm?',
    sharedStrength:
      'Use entity intelligence, contact relationships, project codes, source provenance, and evidence packs to make governance observable and reportable.',
    projectSlugs: ['civicgraph', 'justicehub', 'goods'],
    sourceRoles: ['operating-system', 'technology-system', 'knowledge-system'],
    templates: ['governance evidence pack', 'board skills map', 'monthly reporting template'],
    nextAction: 'List the governance decisions that funders will ask about and tag the source that answers each one.',
  },
  {
    id: 'people-organisation',
    label: 'People and organisation',
    question: 'Does the organisation optimise structure, capabilities, staffing, partners, and volunteers to deliver the vision?',
    sharedStrength:
      'Use the GHL CRM, CivicGraph contacts, foundation boards, partners, and project ownership to show who can help move each project.',
    projectSlugs: ['goods', 'civicgraph', 'justicehub', 'picc'],
    sourceRoles: ['knowledge-system', 'project-map', 'operating-system'],
    templates: ['relationship map', 'role and owner table', 'partner follow-up sequence'],
    nextAction: 'For each project, tag the best next people: funder, buyer, advisor, community partner, technical support, and owner.',
  },
  {
    id: 'legal-structure',
    label: 'Legal structure',
    question: 'Does the organisation legal structure enable delivery of its strategic objectives and vision?',
    sharedStrength:
      'Use the ACT company identity, project entity map, Goods vehicle options, DGR pathways, partner structures, and IP/licensing choices as one structure conversation.',
    projectSlugs: ['goods', 'civicgraph', 'justicehub'],
    sourceRoles: ['operating-system', 'project-code-map', 'grant-application'],
    templates: ['entity option memo', 'applicant vehicle table', 'IP and licence note'],
    nextAction: 'For every funding or contract route, decide the applicant, contracting party, delivery partner, and governance proof required.',
  },
  {
    id: 'investors-capital',
    label: 'Investors and capital',
    question: 'Is the organisation seeking to raise capital and ready for impact investment?',
    sharedStrength:
      'Use the foundation board, capital routes, procurement opportunities, Goods scale plan, and CivicGraph evidence layer to build investable asks instead of generic fundraising.',
    projectSlugs: ['goods', 'civicgraph'],
    sourceRoles: ['foundation-review', 'procurement-scale-plan', 'market-research', 'grant-application'],
    templates: ['capital stack', 'foundation approach brief', 'contract-to-capital pathway'],
    nextAction: 'Define the ask, use of funds, proof, repayment or impact logic, and next relationship move for each capital route.',
  },
];

export const WORKSHOP_TEMPLATES = [
  {
    title: 'Idea to support route',
    use: 'Turn an idea into one of: grant, foundation, procurement, contract, shared service, or capital route.',
    sections: ['problem', 'project tag', 'proof', 'route', 'owner', 'next action'],
  },
  {
    title: 'Contract strategy canvas',
    use: 'Move from broad opportunity to buyer, offer, evidence, delivery shape, and follow-up plan.',
    sections: ['buyer', 'need', 'offer', 'pricing', 'procurement path', 'proof required'],
  },
  {
    title: 'Foundation approach brief',
    use: 'Keep foundation work relationship-led rather than search-led.',
    sections: ['why they fit', 'relationship path', 'ask shape', 'proof', 'vehicle', 'next touch'],
  },
  {
    title: 'Grant application pack',
    use: 'Collect repeatable wording and evidence before writing a grant from scratch.',
    sections: ['summary', 'eligibility', 'budget', 'outcomes', 'evidence', 'attachments'],
  },
  {
    title: 'GHL follow-up handoff',
    use: 'Send only actionable contacts or opportunities into CRM with a clear next move.',
    sections: ['contact', 'project', 'status', 'message angle', 'due date', 'source link'],
  },
];

export function workshopWikiHref(orgSlug: string, areaId?: WorkshopAreaId | 'document-pack' | 'project-tags' | 'templates') {
  return `/org/${orgSlug}/wiki/workshop-alignment${areaId ? `#${areaId}` : ''}`;
}

export function getWorkshopSourceDocuments(index: WikiSupportIndex, roles: string[]) {
  const roleSet = new Set(roles);
  return index.source_inventory.filter((source) => roleSet.has(source.role));
}
