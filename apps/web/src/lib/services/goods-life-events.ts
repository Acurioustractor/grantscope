import { getServiceSupabase } from '@/lib/supabase';
import {
  pickReasonsToReachOut,
  type RawLifeEvent,
  type LifeEventKind,
  type ReasonsToReachOut,
} from './goods-life-events-shared';

/**
 * Goods on Country — Life-event signals fetch ("reasons to reach out").
 * Reads v_goods_life_events (most-recent public-record event per entity-linked
 * Goods supporter, migration 20260609120000) and hands it to the pure presenter,
 * which ranks the freshest reason per supporter and writes honest card copy.
 * The moat: we own these feeds. No new ingestion, no email, no privacy weight.
 */

type ViewRow = {
  rel_id: string;
  display_name: string | null;
  relationship_type: string | null;
  warmth_display: number | null;
  kind: LifeEventKind;
  event_date: string | null;
  event_fy: string | null;
  amount: number | string | null;
  amount2: number | string | null;
  period_to: string | null;
  label: string | null;
};

const EMPTY: ReasonsToReachOut = {
  cards: [],
  summary: { supporters: 0, fresh: 0, feeds: { acnc_filing: 0, gov_contract: 0, justice_funding: 0 } },
};

function num(v: number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

export async function getGoodsReasonsToReachOut(asOf: Date = new Date()): Promise<ReasonsToReachOut> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.from('v_goods_life_events').select('*');
    if (error) {
      console.error('[goods-life-events] query failed:', error.message);
      return EMPTY;
    }
    const raws: RawLifeEvent[] = ((data as ViewRow[] | null) ?? []).map((r) => ({
      relId: r.rel_id,
      supporterName: r.display_name ?? 'Unnamed supporter',
      relationshipType: r.relationship_type ?? 'supporter',
      warmth: Number(r.warmth_display) || 0,
      kind: r.kind,
      eventDate: r.event_date,
      eventFy: r.event_fy,
      amount: num(r.amount),
      amount2: num(r.amount2),
      periodTo: r.period_to,
      label: r.label,
    }));
    // Show the full ranked feed (one card per supporter, ~71 max). Freshest
    // reasons lead; older ACNC filings still surface lower rather than being
    // hidden under the fresh contract wins.
    return pickReasonsToReachOut(raws, asOf, 80);
  } catch (e) {
    console.error('[goods-life-events] unexpected:', e);
    return EMPTY;
  }
}
