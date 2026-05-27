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

async function rollupPipeline(p: { id: string; label: string; role: 'need' | 'ordered' | 'funded'; key: string }): Promise<PipelineFunnel> {
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
  return { key: p.key, label: p.label, role: p.role, total, beds, washers, value, spine };
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
  if (ghlConnected) {
    try {
      pipelines = await Promise.all([
        rollupPipeline({ ...PIPELINES.demand, key: 'demand' }),
        rollupPipeline({ ...PIPELINES.buyer, key: 'buyer' }),
        rollupPipeline({ ...PIPELINES.supporter, key: 'supporter' }),
      ]);
    } catch { pipelines = []; }
  }
  const buyer = pipelines.find(p => p.key === 'buyer');
  const supporter = pipelines.find(p => p.key === 'supporter');
  const ordered = { beds: buyer?.beds || 0, washers: buyer?.washers || 0, value: buyer?.value || 0 };
  const funded = { beds: supporter?.beds || 0, washers: supporter?.washers || 0, value: supporter?.value || 0 };
  const gap = { beds: Math.max(0, need.beds - DELIVERED.beds), washers: Math.max(0, need.washers - DELIVERED.washers) };

  return {
    generatedAt: new Date().toISOString(),
    ghlConnected: ghlConnected && pipelines.length > 0,
    need, addressable, ordered, funded, delivered: DELIVERED, gap, pipelines,
  };
}
