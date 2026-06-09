import { getServiceSupabase } from '@/lib/supabase';
import {
  assembleTimelines,
  nameKey,
  type SupporterInput,
  type TimelineLifeEvent,
  type TimelineXeroInvoice,
  type TimelineFeed,
} from './goods-timeline-shared';

/**
 * Goods on Country — Fused relationship timeline fetch.
 * Pulls the three feeds we own and hands them to the pure assembler:
 *   - goods_relationships: the supporter, current stage, real last touch (GHL).
 *   - v_goods_life_events: ACNC filings / contracts / justice (the public record).
 *   - xero_invoices (ACT-GD, ACCREC): invoices issued, matched by normalised name.
 * Email is deferred (privacy), so it is absent by design. No fabricated rows.
 */

type RelRow = {
  id: string;
  display_name: string | null;
  relationship_type: string | null;
  warmth_display: number | null;
  stage: string | null;
  last_touch_at: string | null;
};

type LifeRow = {
  rel_id: string;
  kind: TimelineLifeEvent['kind'];
  event_date: string | null;
  event_fy: string | null;
  amount: number | string | null;
  label: string | null;
};

type XeroRow = {
  contact_name: string | null;
  invoice_number: string | null;
  date: string | null;
  total: number | string | null;
  status: string | null;
};

const EMPTY: TimelineFeed = { timelines: [], summary: { shown: 0, withFusion: 0, total: 0 } };

function num(v: number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

export async function getGoodsTimelines(asOf: Date = new Date()): Promise<TimelineFeed> {
  try {
    const supabase = getServiceSupabase();
    const [relResult, lifeResult, xeroResult] = await Promise.all([
      supabase
        .from('goods_relationships')
        .select('id, display_name, relationship_type, warmth_display, stage, last_touch_at'),
      supabase.from('v_goods_life_events').select('rel_id, kind, event_date, event_fy, amount, label'),
      supabase
        .from('xero_invoices')
        .select('contact_name, invoice_number, date, total, status')
        .eq('project_code', 'ACT-GD')
        .eq('type', 'ACCREC')
        .not('status', 'in', '(DELETED,VOIDED)'),
    ]);

    if (relResult.error) {
      console.error('[goods-timeline] relationships query failed:', relResult.error.message);
      return EMPTY;
    }

    const supporters: SupporterInput[] = ((relResult.data as RelRow[] | null) ?? []).map((r) => ({
      relId: r.id,
      name: r.display_name ?? 'Unnamed supporter',
      relationshipType: r.relationship_type ?? 'supporter',
      warmth: Number(r.warmth_display) || 0,
      stage: r.stage,
      lastTouchAt: r.last_touch_at,
    }));

    // Public-record events grouped by supporter.
    const lifeByRel = new Map<string, TimelineLifeEvent[]>();
    for (const r of (lifeResult.data as LifeRow[] | null) ?? []) {
      const list = lifeByRel.get(r.rel_id) ?? [];
      list.push({ kind: r.kind, eventDate: r.event_date, eventFy: r.event_fy, amount: num(r.amount), label: r.label });
      lifeByRel.set(r.rel_id, list);
    }

    // Xero invoices matched to a supporter by normalised exact name.
    const relByName = new Map<string, string>();
    for (const s of supporters) {
      const k = nameKey(s.name);
      if (k && !relByName.has(k)) relByName.set(k, s.relId);
    }
    const xeroByRel = new Map<string, TimelineXeroInvoice[]>();
    for (const x of (xeroResult.data as XeroRow[] | null) ?? []) {
      const relId = relByName.get(nameKey(x.contact_name));
      if (!relId) continue;
      const list = xeroByRel.get(relId) ?? [];
      list.push({ invoiceNumber: x.invoice_number, date: x.date, total: num(x.total), status: x.status });
      xeroByRel.set(relId, list);
    }

    // minEvents=2: the Timeline surface is for fused, multi-event histories.
    // Single-event supporters are covered by Signals (record) and the Warmth Map (GHL).
    return assembleTimelines(supporters, lifeByRel, xeroByRel, asOf, 15, 8, 2);
  } catch (e) {
    console.error('[goods-timeline] unexpected:', e);
    return EMPTY;
  }
}
