import { getServiceSupabase } from '@/lib/supabase';
import type { GoodsRelType } from '@/lib/services/goods-engagement-shared';

/**
 * Goods Command Center — Warm-Intro Engine (the connective spine).
 * Reads v_goods_warm_intros (board-member connectors into each entity-linked
 * Goods relationship, with the board_count 2..15 collision gate already applied).
 * Groups by target org, bands confidence, ranks the strongest doors first.
 * Plan: thoughts/shared/plans/goods-command-center-2026-06-09.md
 */

export type WarmIntroConnector = {
  person: string;
  role: string;
  boardCount: number;
  interlockScore: number;
  communityControlled: boolean;
  otherOrgs: string[];
  bridgesToGoods: string | null;
  confidence: 'high' | 'medium';
};

export type WarmIntroTarget = {
  relId: string;
  targetName: string;
  relationshipType: GoodsRelType;
  warmth: number;
  connectors: WarmIntroConnector[];
  hasBridge: boolean;
};

export type WarmIntroSummary = {
  orgsWithIntros: number;
  totalConnectors: number;
  portfolioBridges: number;
  communityControlled: number;
};

type ViewRow = {
  rel_id: string;
  target_name: string;
  relationship_type: GoodsRelType;
  warmth_display: number;
  person: string;
  role_type: string | null;
  board_count: number;
  interlock_score: number | null;
  connects_community_controlled: boolean;
  other_orgs: string[] | null;
  bridges_to_goods: string | null;
};

const MAX_CONNECTORS_PER_TARGET = 5;

function prettyRole(role: string | null): string {
  if (!role) return 'connected';
  return role.replace(/_/g, ' ');
}

// bridgesToGoods first, then community-controlled, then raw interlock reach.
function connectorRank(c: WarmIntroConnector): number {
  return (c.bridgesToGoods ? 1_000_000 : 0) + (c.communityControlled ? 100_000 : 0) + (c.interlockScore || 0);
}

export async function getGoodsWarmIntros(): Promise<{
  targets: WarmIntroTarget[];
  summary: WarmIntroSummary;
}> {
  const empty = {
    targets: [] as WarmIntroTarget[],
    summary: { orgsWithIntros: 0, totalConnectors: 0, portfolioBridges: 0, communityControlled: 0 },
  };
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('v_goods_warm_intros')
      .select('*')
      .order('interlock_score', { ascending: false, nullsFirst: false });
    if (error) {
      console.error('[goods-warm-intros] query failed:', error.message);
      return empty;
    }

    const rows = (data ?? []) as ViewRow[];
    const byTarget = new Map<string, WarmIntroTarget>();
    const seenPerson = new Map<string, Set<string>>(); // relId -> person names (dedupe)

    for (const r of rows) {
      let t = byTarget.get(r.rel_id);
      if (!t) {
        t = {
          relId: r.rel_id,
          targetName: r.target_name,
          relationshipType: r.relationship_type,
          warmth: r.warmth_display,
          connectors: [],
          hasBridge: false,
        };
        byTarget.set(r.rel_id, t);
        seenPerson.set(r.rel_id, new Set());
      }
      const seen = seenPerson.get(r.rel_id)!;
      if (seen.has(r.person)) continue; // same person via multiple role/source rows
      seen.add(r.person);

      t.connectors.push({
        person: r.person,
        role: prettyRole(r.role_type),
        boardCount: Number(r.board_count) || 0,
        interlockScore: Number(r.interlock_score) || 0,
        communityControlled: !!r.connects_community_controlled,
        otherOrgs: (r.other_orgs ?? []).filter((o) => o && o !== r.target_name),
        bridgesToGoods: r.bridges_to_goods,
        confidence: Number(r.board_count) <= 6 ? 'high' : 'medium',
      });
      if (r.bridges_to_goods) t.hasBridge = true;
    }

    const targets = [...byTarget.values()]
      .map((t) => ({
        ...t,
        connectors: t.connectors.sort((a, b) => connectorRank(b) - connectorRank(a)).slice(0, MAX_CONNECTORS_PER_TARGET),
      }))
      // strongest doors first: portfolio bridges, then connector depth, then warmth
      .sort((a, b) => {
        if (a.hasBridge !== b.hasBridge) return a.hasBridge ? -1 : 1;
        if (a.connectors.length !== b.connectors.length) return b.connectors.length - a.connectors.length;
        return b.warmth - a.warmth;
      });

    const summary: WarmIntroSummary = {
      orgsWithIntros: targets.length,
      totalConnectors: rows.length,
      portfolioBridges: targets.filter((t) => t.hasBridge).length,
      communityControlled: rows.filter((r) => r.connects_community_controlled).length,
    };

    return { targets, summary };
  } catch (e) {
    console.error('[goods-warm-intros] unexpected:', e);
    return empty;
  }
}
