import { getServiceSupabase } from '@/lib/supabase';

/**
 * Goods 3-pipeline funnel — the management cockpit. One need, two funding routes,
 * one delivery, in beds / washing machines / $.
 *
 *   NEED      ← goods_communities (curated priority slice: active + lead)
 *   ORDERED   ← GHL Buyer Pipeline      (best-effort; degrades to 0 if GHL env absent)
 *   FUNDED    ← GHL Supporter Journey   (best-effort)
 *   DELIVERED ← Goods v2 assets sync    (cited constant — different DB)
 *   GAP       = NEED − DELIVERED
 *
 * The 3 GHL pipelines keep their own (12 / 10 / 4) operational stages; this view
 * collapses them to a shared 5-stage spine for legibility. Stage→spine is matched
 * by NAME so it survives GHL stage renames.
 *
 * Plan: act-infra thoughts/shared/plans/2026-05-28-goods-three-pipeline-operating-model.md
 */

const GHL_API_URL = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const PIPELINES = {
  buyer:     { id: 'FjMyJM3YzWQFmKqR9fur', label: 'Procurement — Buyer Pipeline', role: 'ordered' as const },
  supporter: { id: 'JvBFYpVpyKsw899lkFgj', label: 'Support — Supporter Journey', role: 'funded' as const },
  demand:    { id: 'UQsrmuqzxMSdCTklxEcG', label: 'Need — Demand Register', role: 'need' as const },
};
const BEDS_FIELD = 'mi9ZW3KLhmpcez14cNbx';
const WASHERS_FIELD = 'UtxtfnyEd6p1epMEJ0b2';

// DELIVERED — physical goods delivered to date. Source: Goods v2 `assets`
// (project cwsyhpiuepvdjtxaozwf) via sync-goods-impact-rollups.mjs — a different DB
// than this app reaches, so carried as a cited constant.
export const DELIVERED = { beds: 520, washers: 41, source: 'Goods v2 assets sync, 2026-05-27' };

export const SPINE = ['identified', 'qualified', 'committed', 'delivering', 'closed', 'dead'] as const;
export type SpineStage = (typeof SPINE)[number];
export const SPINE_LABELS: Record<SpineStage, string> = {
  identified: 'Identified', qualified: 'Qualified', committed: 'Committed',
  delivering: 'Delivering', closed: 'Closed', dead: 'Dead',
};

function spineOf(stageName: string): SpineStage {
  const s = (stageName || '').toLowerCase();
  if (/lapsed|declined|parked|dormant|lost|not yet|out of scope/.test(s)) return 'dead';
  if (/paid|invoiced|steward|renew/.test(s)) return 'closed';
  if (/deliver/.test(s)) return 'delivering';
  if (/proposed|negotiat|committed|ask made|converted/.test(s)) return 'committed';
  if (/conversation|qualified|scoped|cultivat|matched|assessment/.test(s)) return 'qualified';
  return 'identified'; // outreach, first contact, identified, signal, new
}

export type SpineCell = { n: number; beds: number; washers: number; value: number };
export type PipelineFunnel = {
  key: string;
  label: string;
  role: 'need' | 'ordered' | 'funded';
  total: number;
  beds: number;
  washers: number;
  value: number;
  spine: Record<SpineStage, SpineCell>;
};
export type GoodsRelationship = {
  id: string;
  pipeline: 'demand' | 'buyer' | 'supporter';
  pipelineLabel: string;
  name: string;
  organisation: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  spineStage: SpineStage;
  beds: number;
  washers: number;
  value: number;
  updatedAt: string | null;
  owner: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  communicationStatus: 'reply evidenced' | 'contact recorded' | 'no communication evidence';
  lastContactAt: string | null;
  sourceUrl: string | null;
  supporterUpdates: boolean;
  updateReadiness: 'consent evidenced' | 'consent needed' | 'operational only';
  updateTopics: string[];
  charityRelated: boolean;
  entityRoutes: Array<'commercial procurement' | 'charity/public benefit' | 'First Nations governance'>;
  vehicleStatus: 'clear' | 'shared role' | 'vehicle decision needed';
  deckStatus: 'shared' | 'ready' | 'needed';
  attention: 'overdue' | 'waiting' | 'ready' | 'unassigned';
  priorityScore: number;
  priorityReasons: string[];
  dataQualityScore: number;
  dataQualityIssues: string[];
  nextMove: string;
};
export type GoodsFunnel = {
  generatedAt: string;
  ghlConnected: boolean;
  need: { beds: number; washers: number; communities: number };
  addressable: { beds: number; washers: number; communities: number };
  ordered: { beds: number; washers: number; value: number };
  funded: { beds: number; washers: number; value: number };
  delivered: typeof DELIVERED;
  gap: { beds: number; washers: number };
  pipelines: PipelineFunnel[];
  relationships: GoodsRelationship[];
};

async function ghlFetch(path: string) {
  const res = await fetch(`${GHL_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${GHL_API_KEY}`, 'Content-Type': 'application/json', Version: '2021-07-28' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GHL ${path}: ${res.status}`);
  return res.json();
}

function unitOf(opp: any, fieldId: string): number {
  const cf = (opp.customFields || []).find((c: any) => c.id === fieldId);
  // GHL opportunity search returns numeric custom fields under `fieldValueNumber`.
  const v = cf ? (cf.fieldValueNumber ?? cf.fieldValueString ?? cf.field_value ?? cf.value) : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emptySpine(): Record<SpineStage, SpineCell> {
  return Object.fromEntries(SPINE.map(s => [s, { n: 0, beds: 0, washers: 0, value: 0 }])) as Record<SpineStage, SpineCell>;
}

function nextMoveFor(pipeline: GoodsRelationship['pipeline'], stage: SpineStage) {
  if (stage === 'dead') return 'Leave parked unless new evidence arrives.';
  if (stage === 'closed') return pipeline === 'supporter' ? 'Add to supporter updates and steward the relationship.' : 'Confirm delivery, outcomes and the next order.';
  if (stage === 'delivering') return 'Confirm delivery owner, timing and evidence capture.';
  if (stage === 'committed') return pipeline === 'supporter' ? 'Close the commitment and confirm reporting.' : 'Confirm purchase order, quantity and delivery date.';
  if (stage === 'qualified') return pipeline === 'supporter' ? 'Prepare the tailored ask and evidence pack.' : 'Confirm quantity, budget, buyer process and written intent.';
  return 'Confirm the relationship owner and make the first human contact.';
}

async function readPipeline(p: { id: string; label: string; role: 'need' | 'ordered' | 'funded'; key: GoodsRelationship['pipeline'] }) {
  const spine = emptySpine();
  let total = 0, beds = 0, washers = 0, value = 0;
  // Stage map for this pipeline.
  let stageMap = new Map<string, string>();
  try {
    const data = await ghlFetch(`/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`);
    const pl = (data.pipelines || []).find((x: any) => x.id === p.id);
    stageMap = new Map((pl?.stages || []).map((s: any) => [s.id, s.name]));
  } catch { /* leave empty → unknown stages fall to identified */ }
  // Opps (paginated).
  const opps: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const data = await ghlFetch(`/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${p.id}&limit=100&page=${page}`);
    const batch = data.opportunities || [];
    opps.push(...batch);
    if (batch.length < 100) break;
  }
  for (const o of opps) {
    if ((o.status || 'open') !== 'open') continue;
    const b = unitOf(o, BEDS_FIELD), w = unitOf(o, WASHERS_FIELD), v = Number(o.monetaryValue) || 0;
    total++; beds += b; washers += w; value += v;
    const sp = spineOf(stageMap.get(o.pipelineStageId) || '');
    const cell = spine[sp];
    cell.n++; cell.beds += b; cell.washers += w; cell.value += v;
  }
  const funnel: PipelineFunnel = { key: p.key, label: p.label, role: p.role, total, beds, washers, value, spine };
  const relationships: GoodsRelationship[] = opps
    .filter(o => (o.status || 'open') === 'open')
    .map(o => {
      const contact = o.contact || o.relations?.find((relation: any) => relation.objectKey === 'contact') || {};
      const stage = stageMap.get(o.pipelineStageId) || 'Identified';
      const spineStage = spineOf(stage);
      return {
        id: o.id,
        pipeline: p.key,
        pipelineLabel: p.label,
        name: contact.name || contact.contactName || contact.fullName || o.name || 'Unnamed relationship',
        organisation: contact.companyName || null,
        email: contact.email || null,
        phone: contact.phone || null,
        stage,
        spineStage,
        beds: unitOf(o, BEDS_FIELD),
        washers: unitOf(o, WASHERS_FIELD),
        value: Number(o.monetaryValue) || 0,
        updatedAt: o.updatedAt || o.lastStageChangeAt || null,
        owner: o.assignedTo || null,
        nextAction: null,
        nextActionAt: null,
        communicationStatus: 'no communication evidence' as const,
        lastContactAt: null,
        sourceUrl: null,
        supporterUpdates: false,
        updateReadiness: p.key === 'supporter' ? 'consent needed' as const : 'operational only' as const,
        updateTopics: [],
        charityRelated: false,
        entityRoutes: p.key === 'buyer' ? ['commercial procurement'] : [],
        vehicleStatus: p.key === 'buyer' ? 'clear' as const : 'vehicle decision needed' as const,
        deckStatus: 'needed' as const,
        attention: o.assignedTo ? 'ready' as const : 'unassigned' as const,
        priorityScore: 0,
        priorityReasons: [],
        dataQualityScore: 0,
        dataQualityIssues: [],
        nextMove: nextMoveFor(p.key, spineStage),
      };
    });
  return { funnel, relationships };
}

export async function getGoodsFunnel(): Promise<GoodsFunnel> {
  const db = getServiceSupabase();
  const [{ data: needRows }, { data: addrRows }] = await Promise.all([
    db.from('goods_communities').select('demand_beds, demand_washers').in('priority', ['active', 'lead']),
    db.from('goods_communities').select('demand_beds, demand_washers'),
  ]);
  const sum = (rows: any[] | null, col: string) => (rows || []).reduce((a, r) => a + (Number(r[col]) || 0), 0);
  const need = { beds: sum(needRows, 'demand_beds'), washers: sum(needRows, 'demand_washers'), communities: (needRows || []).length };
  const addressable = { beds: sum(addrRows, 'demand_beds'), washers: sum(addrRows, 'demand_washers'), communities: (addrRows || []).length };

  const ghlConnected = Boolean(GHL_API_KEY && GHL_LOCATION_ID);
  let pipelines: PipelineFunnel[] = [];
  let relationships: GoodsRelationship[] = [];
  if (ghlConnected) {
    try {
      const results = await Promise.all([
        readPipeline({ ...PIPELINES.demand, key: 'demand' }),
        readPipeline({ ...PIPELINES.buyer, key: 'buyer' }),
        readPipeline({ ...PIPELINES.supporter, key: 'supporter' }),
      ]);
      pipelines = results.map(result => result.funnel);
      relationships = results.flatMap(result => result.relationships);
    } catch { pipelines = []; }
  }

  if (relationships.length > 0) {
    const emails = relationships.map(row => row.email?.toLowerCase()).filter(Boolean) as string[];
    const opportunityIds = relationships.map(row => row.id);
    const [{ data: contactRows }, { data: gmailRows }, { data: pipelineRows }] = await Promise.all([
      emails.length > 0
        ? db
            .from('ghl_contacts')
            .select('email, tags, engagement_status, last_contact_date')
            .in('email', emails)
        : Promise.resolve({ data: [] }),
      emails.length > 0
        ? db
            .from('opportunity_context_events')
            .select('actor_email, source_url, happened_at')
            .eq('source_system', 'gmail')
            .in('actor_email', emails)
            .order('happened_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      db
        .from('org_pipeline')
        .select('ghl_opportunity_id, owner_name, next_action, next_action_at')
        .in('ghl_opportunity_id', opportunityIds),
    ]);
    const contactByEmail = new Map((contactRows || []).map((row: any) => [String(row.email || '').toLowerCase(), row]));
    const gmailByEmail = new Map<string, any>();
    for (const row of gmailRows || []) {
      const email = String(row.actor_email || '').toLowerCase();
      if (email && !gmailByEmail.has(email)) gmailByEmail.set(email, row);
    }
    const pipelineByOpportunity = new Map((pipelineRows || []).map((row: any) => [String(row.ghl_opportunity_id || ''), row]));
    relationships = relationships.map(row => {
      const key = row.email?.toLowerCase() || '';
      const contact = contactByEmail.get(key);
      const gmail = gmailByEmail.get(key);
      const pipeline = pipelineByOpportunity.get(row.id);
      const tags = (contact?.tags || []).map((tag: string) => tag.toLowerCase());
      const owner = pipeline?.owner_name || row.owner;
      const nextActionAt = pipeline?.next_action_at || null;
      const dueAt = nextActionAt ? new Date(nextActionAt).getTime() : null;
      const isOverdue = dueAt != null && dueAt < Date.now();
      const deckStatus = tags.some((tag: string) => /deck[: -]?(shared|sent)|pitch[: -]?sent/.test(tag))
        ? 'shared' as const
        : tags.some((tag: string) => /deck[: -]?ready|ask[: -]?ready|pitch[: -]?ready/.test(tag))
          ? 'ready' as const
          : 'needed' as const;
      const supporterUpdates = tags.some((tag: string) => /newsletter|supporter|updates/.test(tag));
      const charityRelated = tags.some((tag: string) => /charity|butterfly|nfp|public benefit/.test(tag));
      const firstNationsRelated = tags.some((tag: string) => /first nations|indigenous|aboriginal|community-controlled|acco/.test(tag));
      const entityRoutes = [
        row.pipeline === 'buyer' || tags.some((tag: string) => /buyer|procurement|contract/.test(tag)) ? 'commercial procurement' as const : null,
        charityRelated ? 'charity/public benefit' as const : null,
        firstNationsRelated ? 'First Nations governance' as const : null,
      ].filter(Boolean) as GoodsRelationship['entityRoutes'];
      const updateTopics = [
        row.beds > 0 || tags.some((tag: string) => /bed|housing/.test(tag)) ? 'beds' : null,
        row.washers > 0 || tags.some((tag: string) => /wash/.test(tag)) ? 'washing' : null,
        row.pipeline === 'buyer' || tags.some((tag: string) => /buyer|procurement/.test(tag)) ? 'procurement' : null,
        row.pipeline === 'supporter' ? 'supporter progress' : null,
        tags.some((tag: string) => /community|first nations|indigenous/.test(tag)) ? 'community' : null,
        tags.some((tag: string) => /impact|funder|foundation|capital/.test(tag)) ? 'impact and funding' : null,
      ].filter(Boolean) as string[];
      const attention = !owner ? 'unassigned' as const : isOverdue ? 'overdue' as const : gmail && !pipeline?.next_action ? 'waiting' as const : 'ready' as const;
      const priorityReasons = [
        isOverdue ? 'overdue action' : null,
        !owner ? 'owner missing' : null,
        gmail ? 'reply evidenced' : null,
        row.spineStage === 'qualified' ? 'qualified relationship' : null,
        row.spineStage === 'committed' ? 'commitment stage' : null,
        row.beds + row.washers >= 100 ? 'high-volume demand' : null,
        row.value >= 100000 ? 'high-value opportunity' : null,
        !pipeline?.next_action ? 'next action missing' : null,
      ].filter(Boolean) as string[];
      const priorityScore = Math.min(100,
        (isOverdue ? 25 : 0) +
        (!owner ? 14 : 0) +
        (gmail ? 18 : contact?.last_contact_date ? 8 : 0) +
        (row.spineStage === 'committed' ? 22 : row.spineStage === 'qualified' ? 16 : 4) +
        (row.beds + row.washers >= 100 ? 12 : row.beds + row.washers > 0 ? 6 : 0) +
        (row.value >= 100000 ? 12 : row.value > 0 ? 6 : 0) +
        (!pipeline?.next_action ? 8 : 0)
      );
      return {
        ...row,
        owner,
        nextAction: pipeline?.next_action || null,
        nextActionAt,
        communicationStatus: gmail ? 'reply evidenced' : contact?.last_contact_date ? 'contact recorded' : 'no communication evidence',
        lastContactAt: gmail?.happened_at || contact?.last_contact_date || row.updatedAt,
        sourceUrl: gmail?.source_url || null,
        supporterUpdates,
        updateReadiness: supporterUpdates ? 'consent evidenced' : row.pipeline === 'supporter' ? 'consent needed' : 'operational only',
        updateTopics: [...new Set(updateTopics)],
        charityRelated,
        entityRoutes,
        vehicleStatus: entityRoutes.length > 1 ? 'shared role' : entityRoutes.length === 1 ? 'clear' : 'vehicle decision needed',
        deckStatus,
        attention,
        priorityScore,
        priorityReasons,
      };
    });
    const emailCounts = new Map<string, number>();
    for (const row of relationships) {
      const email = row.email?.toLowerCase();
      if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    }
    relationships = relationships.map(row => {
      const issues = [
        !row.email ? 'email missing' : null,
        row.email && (emailCounts.get(row.email.toLowerCase()) || 0) > 1 ? 'duplicate email relationship' : null,
        !row.owner ? 'owner missing' : null,
        !row.nextAction ? 'next action missing' : null,
        !row.nextActionAt ? 'due date missing' : null,
        row.beds <= 0 && row.washers <= 0 ? 'product quantity unscoped' : null,
        row.communicationStatus === 'no communication evidence' ? 'communication evidence missing' : null,
        row.vehicleStatus === 'vehicle decision needed' ? 'entity route unresolved' : null,
      ].filter(Boolean) as string[];
      return {
        ...row,
        dataQualityIssues: issues,
        dataQualityScore: Math.max(0, Math.round(100 - issues.length * 12.5)),
      };
    });
  }
  const buyer = pipelines.find(p => p.key === 'buyer');
  const supporter = pipelines.find(p => p.key === 'supporter');
  const ordered = { beds: buyer?.beds || 0, washers: buyer?.washers || 0, value: buyer?.value || 0 };
  const funded = { beds: supporter?.beds || 0, washers: supporter?.washers || 0, value: supporter?.value || 0 };
  const gap = { beds: Math.max(0, need.beds - DELIVERED.beds), washers: Math.max(0, need.washers - DELIVERED.washers) };

  return {
    generatedAt: new Date().toISOString(),
    ghlConnected: ghlConnected && pipelines.length > 0,
    need, addressable, ordered, funded, delivered: DELIVERED, gap, pipelines, relationships,
  };
}
