import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';

export const GOODS_NETWORK_PROJECT_ID = '01359765-a88c-4ac2-8e4d-c40beb01c299';

export type GoodsNetworkLane = 'qbe_anchor' | 'capital' | 'production' | 'capability' | 'support';
export type GoodsInterestEvidenceForm =
  | 'direct_message'
  | 'user_reported'
  | 'program_participant'
  | 'crm_contacted'
  | 'public_research';

export interface GoodsNetworkEvidence {
  label: string;
  url: string;
  detail: string;
}

export interface GoodsNetworkPathway {
  id: string;
  displayName: string;
  relationshipType: string;
  stage: string;
  lane: GoodsNetworkLane;
  priority: number;
  evidenceForm: GoodsInterestEvidenceForm;
  evidenceSummary: string;
  qbeRelevance: string;
  guardrail: string;
  nextAction: string | null;
  nextActionDue: string | null;
  officialEvidence: GoodsNetworkEvidence[];
}

export interface GoodsNetworkPerson {
  id: string;
  name: string;
  role: string | null;
  organisation: string | null;
  contactType: string;
  linkedinUrl: string | null;
  summary: string;
  expertise: string[];
  nextAction: string | null;
  lastContactedAt: string | null;
  relationshipId: string;
  relationshipType: string;
  stage: string;
  lane: GoodsNetworkLane;
  evidenceForm: GoodsInterestEvidenceForm;
  evidenceSummary: string;
  qbeRelevance: string;
  guardrail: string;
}

export interface GoodsNetworkSnapshot {
  people: GoodsNetworkPerson[];
  pathways: GoodsNetworkPathway[];
  dataSource: 'database' | 'evidence_safe_seed';
  dataWarning: string | null;
}

type RawRow = Record<string, unknown>;

function asRecord(value: unknown): RawRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RawRow : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function asEvidenceForm(value: unknown): GoodsInterestEvidenceForm {
  return ['direct_message', 'user_reported', 'program_participant', 'crm_contacted', 'public_research'].includes(String(value))
    ? value as GoodsInterestEvidenceForm
    : 'public_research';
}

function asLane(value: unknown): GoodsNetworkLane {
  return ['qbe_anchor', 'capital', 'production', 'capability', 'support'].includes(String(value))
    ? value as GoodsNetworkLane
    : 'support';
}

function evidenceRows(value: unknown): GoodsNetworkEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    const label = asString(row.label);
    const url = asString(row.url);
    if (!label || !url) return [];
    return [{ label, url, detail: asString(row.detail) ?? 'Official source attached.' }];
  });
}

export function decodeGoodsNetworkPathway(row: RawRow): GoodsNetworkPathway {
  const refs = asRecord(row.source_refs);
  const interest = asRecord(refs.interestEvidence);
  return {
    id: String(row.id),
    displayName: asString(refs.networkDisplayName) ?? String(row.display_name ?? 'Unnamed pathway'),
    relationshipType: String(row.relationship_type ?? 'supporter'),
    stage: String(row.stage ?? 'researching'),
    lane: asLane(refs.networkLane),
    priority: Number(refs.networkPriority ?? 99),
    evidenceForm: asEvidenceForm(interest.form),
    evidenceSummary: asString(interest.summary) ?? 'No relationship evidence summary is attached.',
    qbeRelevance: asString(refs.qbeRelevance) ?? 'QBE relevance has not been assessed.',
    guardrail: asString(refs.guardrail) ?? 'Do not record a commitment without written evidence.',
    nextAction: asString(row.next_action),
    nextActionDue: asString(row.next_action_due),
    officialEvidence: evidenceRows(refs.officialEvidence),
  };
}

export function buildGoodsNetworkSnapshot(input: {
  contactRows: RawRow[];
  relationshipRows: RawRow[];
  dataSource?: GoodsNetworkSnapshot['dataSource'];
  dataWarning?: string | null;
}): GoodsNetworkSnapshot {
  const pathways = input.relationshipRows
    .map(decodeGoodsNetworkPathway)
    .sort((left, right) => left.priority - right.priority || left.displayName.localeCompare(right.displayName));
  const pathwayById = new Map(pathways.map((pathway) => [pathway.id, pathway]));
  const people = input.contactRows.flatMap<GoodsNetworkPerson>((row) => {
    const relationshipId = asString(row.goods_relationship_id);
    const pathway = relationshipId ? pathwayById.get(relationshipId) : null;
    if (!relationshipId || !pathway) return [];
    return [{
      id: String(row.id),
      name: String(row.name ?? 'Unnamed contact'),
      role: asString(row.role),
      organisation: asString(row.organisation),
      contactType: String(row.contact_type ?? 'partner'),
      linkedinUrl: asString(row.linkedin_url),
      summary: asString(row.notes) ?? pathway.evidenceSummary,
      expertise: asStrings(row.expertise),
      nextAction: asString(row.engagement_ask) ?? pathway.nextAction,
      lastContactedAt: asString(row.last_contacted_at),
      relationshipId,
      relationshipType: pathway.relationshipType,
      stage: pathway.stage,
      lane: pathway.lane,
      evidenceForm: pathway.evidenceForm,
      evidenceSummary: pathway.evidenceSummary,
      qbeRelevance: pathway.qbeRelevance,
      guardrail: pathway.guardrail,
    }];
  }).sort((left, right) => {
    const laneOrder: Record<GoodsNetworkLane, number> = { production: 0, capital: 1, support: 2, capability: 3, qbe_anchor: 4 };
    return laneOrder[left.lane] - laneOrder[right.lane] || left.name.localeCompare(right.name);
  });

  return {
    people,
    pathways,
    dataSource: input.dataSource ?? 'database',
    dataWarning: input.dataWarning ?? null,
  };
}

const SEED_PATHWAYS: RawRow[] = [
  {
    id: 'network-qbe', relationship_type: 'funder', display_name: 'QBE Foundation', stage: 'contacted',
    next_action: 'Get the exact Stage 2 deadline, acceptable external-capital evidence and legal-recipient rule confirmed in writing.', next_action_due: '2026-08-03',
    source_refs: { goodsNetwork: true, networkDisplayName: 'QBE Foundation / Catalysing Impact', networkLane: 'qbe_anchor', networkPriority: 0, interestEvidence: { form: 'program_participant', summary: 'A Curious Tractor is a confirmed 2026 cohort participant; Stage 2 has not been awarded.' }, qbeRelevance: 'This is the anchor: a typical $150K-$400K Stage 2 grant may build on external capital secured.', guardrail: 'Program participation is not a Stage 2 award. Exact evidence and timing still need written confirmation.', officialEvidence: [{ label: 'Catalysing Impact 2026', url: 'https://www.socialimpacthub.org/catalysing-impact', detail: 'Official program page describing the two-stage capital model.' }] },
  },
  {
    id: 'network-wyatt', relationship_type: 'impact_investor', display_name: 'The Wyatt Trust — Catalytic Local Investment Fund (CLIF)', stage: 'in_conversation',
    next_action: 'Hold an anti-pitch qualification call with Gavin: confirm SA nexus, capacity, borrower, use, terms, timing and QBE-usable evidence.', next_action_due: '2026-08-05',
    source_refs: { goodsNetwork: true, networkDisplayName: 'The Wyatt Trust / CLIF', networkLane: 'capital', networkPriority: 10, interestEvidence: { form: 'user_reported', summary: 'Ben reports that Gavin Reid is interested in exploring investment. No ask, amount, terms or commitment is evidenced.' }, qbeRelevance: 'Potential patient debt for equipment or working capital if the South Australian eligibility test is genuine.', guardrail: 'Interest is not an ask or commitment; CLIF was already 90% subscribed when Wyatt published its April 2026 update.', officialEvidence: [{ label: 'Wyatt CLIF 2026', url: 'https://www.wyatt.org.au/what-we-do/stories/investing-to-catalyse-local-impact-clif/', detail: 'Official fund scope, relational process, average loan and current capacity context.' }] },
  },
  {
    id: 'network-bodie', relationship_type: 'production_partner', display_name: 'Northern Territory Department of Corrections — prisoner-led production pathway', stage: 'in_conversation',
    next_action: 'Hold the scoping call and document workshop capability, training, safety, pay, consent, quality, IP, costing and a small pilot path.', next_action_due: '2026-08-03',
    source_refs: { goodsNetwork: true, networkDisplayName: 'NT Department of Corrections', networkLane: 'production', networkPriority: 20, interestEvidence: { form: 'direct_message', summary: 'Bodie directly offered capacity and possible capability to explore production through prisoner-led industry areas and proposed a call.' }, qbeRelevance: 'Could lower the cost and risk of the measured production run and strengthen the justice-employment proof; it is not external capital.', guardrail: 'No production commitment exists. Any pathway must evidence voluntary fair work, accredited training, safety, quality and community authority.', officialEvidence: [{ label: 'NT industries, skills and employment', url: 'https://corrections.nt.gov.au/corrections/industries-skills-employment-initiative', detail: 'Official three-year plan for training, industry partnerships and employment pathways.' }] },
  },
  {
    id: 'network-origin', relationship_type: 'supporter', display_name: 'Origin Energy Foundation — skills and community pathway', stage: 'in_conversation',
    next_action: 'Ask Tania to name the actual pathway: Foundation grant, professional volunteering, in-kind support, investment, or an introduction.', next_action_due: '2026-08-06',
    source_refs: { goodsNetwork: true, networkDisplayName: 'Origin Energy Foundation', networkLane: 'support', networkPriority: 30, interestEvidence: { form: 'user_reported', summary: 'Ben reports that Tania Carlos is interested. The instrument, authority, amount and next forum are not yet evidenced.' }, qbeRelevance: 'Best public fit is education, skills, professional volunteering or in-kind support; a direct capital role is unverified.', guardrail: 'Do not describe Origin Foundation interest as investment until Tania confirms the mechanism and authority.', officialEvidence: [{ label: 'Origin Foundation', url: 'https://www.originfoundation.org.au/who-we-are', detail: 'Official education focus and grant, volunteering, matched-giving and in-kind support model.' }] },
  },
  {
    id: 'network-cdu', relationship_type: 'production_partner', display_name: 'Charles Darwin University — corrections training pathway', stage: 'researching',
    next_action: 'Ask Bodie whether CDU should join the first capability call as the accredited training and quality partner.', next_action_due: '2026-08-07',
    source_refs: { goodsNetwork: true, networkDisplayName: 'Charles Darwin University', networkLane: 'production', networkPriority: 40, interestEvidence: { form: 'public_research', summary: 'No GOODS conversation is recorded. CDU is an official NT Corrections training partner and a logical next introduction.' }, qbeRelevance: 'Could turn production into an accredited training and employment pathway, strengthening execution evidence rather than capital.', guardrail: 'Research target only; no interest, permission or production commitment has been claimed.', officialEvidence: [{ label: 'Katherine training partnership', url: 'https://corrections.nt.gov.au/corrections/new-work-camps', detail: 'Official NT page confirms CDU educators and corrections industry officers will deliver training.' }] },
  },
  {
    id: 'network-sedi', relationship_type: 'funder', display_name: 'Impact Investing Australia — SEDI 2026–27', stage: 'researching',
    next_action: 'Verify the applying entity and trading tests, then cost a capability package before lodging an EOI.', next_action_due: '2026-08-04',
    source_refs: { goodsNetwork: true, networkDisplayName: 'Impact Investing Australia / SEDI', networkLane: 'capability', networkPriority: 50, interestEvidence: { form: 'public_research', summary: 'A current rolling grant route has been verified; no EOI or application is recorded.' }, qbeRelevance: 'Could pay for the model, legal structure, contracts and impact evidence needed to unlock investment; likely not QBE external capital itself.', guardrail: 'Up to $120K is a program ceiling, not a GOODS target or award.', officialEvidence: [{ label: 'SEDI 2026–27', url: 'https://impactinvestingaustralia.com/looking-for-funding-or-investors/', detail: 'Official eligibility and rolling EOI route for capability grants.' }] },
  },
  {
    id: 'network-white-box', relationship_type: 'funder', display_name: 'White Box SELF — social enterprise loan pathway', stage: 'contacted',
    next_action: 'Book an eligibility call and verify the borrower, trading/employment tests, security, timing and QBE-usable evidence before EOI.', next_action_due: '2026-08-04',
    source_refs: { goodsNetwork: true, networkDisplayName: 'White Box SELF', networkLane: 'capital', networkPriority: 60, interestEvidence: { form: 'crm_contacted', summary: 'The GHL relationship is marked contacted. No SELF EOI, eligibility decision, terms or commitment is attached.' }, qbeRelevance: 'The $100K-$500K patient-loan range can cover equipment or working capital if every public eligibility test passes.', guardrail: 'The current ACT/Butterfly structure is not yet verified as an eligible SELF borrower, and the process can take about three months.', officialEvidence: [{ label: 'Social Enterprise Loan Fund', url: 'https://whiteboxenterprises.com.au/innovate/self/', detail: 'Official loan range, pricing, term, eligibility and application process.' }] },
  },
];

const SEED_CONTACTS: RawRow[] = [
  { id: 'person-bodie', name: 'Bodie Green', role: 'Assistant Commissioner; Operational Reform', organisation: 'Northern Territory Department of Corrections', contact_type: 'partner', linkedin_url: 'https://www.linkedin.com/in/bodiegreen/', notes: 'Direct inbound interest: Bodie offered capacity and possible capability to explore bed production through prisoner-led industry areas. No production commitment or commercial terms exist yet.', last_contacted_at: '2026-08-01T18:21:00+08:00', expertise: ['correctional industries', 'operational reform', 'production pathways', 'justice employment'], engagement_ask: 'Schedule the scoping call and document workshop capability, training, safeguards, quality, costing and a pilot path.', goods_relationship_id: 'network-bodie' },
  { id: 'person-gavin', name: 'Gavin Reid', role: 'Investment Specialist', organisation: 'The Wyatt Trust', contact_type: 'funder', linkedin_url: 'https://www.linkedin.com/in/gavin-reid-9b76005a/', notes: 'Ben reports current interest in exploring investment. Wyatt role and CLIF pathway are publicly verified; no ask, amount, terms, eligibility decision or commitment is recorded.', last_contacted_at: null, expertise: ['impact investing', 'patient capital', 'social enterprise', 'financial modelling'], engagement_ask: 'Confirm South Australian eligibility, remaining CLIF capacity, likely borrower, use, terms, timing and QBE evidence.', goods_relationship_id: 'network-wyatt' },
  { id: 'person-tania', name: 'Tania Carlos', role: 'Senior Manager, Specialist Programs and Volunteering', organisation: 'Origin Energy Foundation', contact_type: 'funder', linkedin_url: 'https://www.linkedin.com/in/tania-carlos-37839a77/', notes: 'Ben reports current interest. Tania’s Origin Foundation role and public education/volunteering remit are verified; the mechanism, authority, amount and next step are not.', last_contacted_at: null, expertise: ['community investment', 'First Nations engagement', 'education philanthropy', 'corporate volunteering'], engagement_ask: 'Clarify whether the pathway is a Foundation grant, professional volunteering, in-kind support, investment, or an introduction.', goods_relationship_id: 'network-origin' },
];

const EVIDENCE_SAFE_SEED = buildGoodsNetworkSnapshot({
  contactRows: SEED_CONTACTS,
  relationshipRows: SEED_PATHWAYS,
  dataSource: 'evidence_safe_seed',
  dataWarning: 'The GOODS people-to-pathway link is unavailable in this environment. Showing the evidence-safe 1 August seed; interest remains separate from asks and commitments.',
});

export const getGoodsNetworkSnapshot = cache(async function getGoodsNetworkSnapshot(): Promise<GoodsNetworkSnapshot> {
  try {
    const db = getServiceSupabase();
    const [contactsResult, relationshipsResult] = await Promise.all([
      db
        .from('org_contacts')
        .select('id, name, role, organisation, contact_type, linkedin_url, notes, last_contacted_at, expertise, engagement_ask, goods_relationship_id')
        .eq('project_id', GOODS_NETWORK_PROJECT_ID)
        .not('goods_relationship_id', 'is', null),
      db
        .from('goods_relationships')
        .select('id, relationship_type, display_name, stage, next_action, next_action_due, source_refs')
        .contains('source_refs', { goodsNetwork: true }),
    ]);
    const error = contactsResult.error ?? relationshipsResult.error;
    if (error) {
      console.error('[goods-network] query failed:', error.message);
      return { ...EVIDENCE_SAFE_SEED, dataWarning: `${EVIDENCE_SAFE_SEED.dataWarning} (${error.message})` };
    }
    return buildGoodsNetworkSnapshot({
      contactRows: (contactsResult.data ?? []) as RawRow[],
      relationshipRows: (relationshipsResult.data ?? []) as RawRow[],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected network load error.';
    console.error('[goods-network] unexpected:', error);
    return { ...EVIDENCE_SAFE_SEED, dataWarning: `${EVIDENCE_SAFE_SEED.dataWarning} (${message})` };
  }
});

export function goodsInterestEvidenceLabel(form: GoodsInterestEvidenceForm): string {
  return {
    direct_message: 'Direct inbound',
    user_reported: 'Interest reported by Ben',
    program_participant: 'Confirmed participant',
    crm_contacted: 'CRM contact signal',
    public_research: 'Research only',
  }[form];
}

export function goodsNetworkLaneLabel(lane: GoodsNetworkLane): string {
  return {
    qbe_anchor: 'QBE anchor',
    capital: 'Capital',
    production: 'Production',
    capability: 'Capability',
    support: 'Support',
  }[lane];
}
