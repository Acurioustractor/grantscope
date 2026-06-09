import { getServiceSupabase } from '@/lib/supabase';
import {
  parseGovernanceNotes,
  rollupLadder,
  BELONGING_RUNGS,
  type GovernanceMember,
  type GovernanceStatus,
  type SupporterLadder,
} from './goods-governance-shared';

/**
 * Goods on Country — Governance roster fetch.
 * Reads the Butterfly Movement board from org_contacts (contact_type='governance',
 * scoped to the ACT org + Goods project) and decodes each row's notes payload into
 * a GovernanceMember. Seeded from the wiki by scripts/sync-goods-governance-roster.mjs.
 * These are co-owners, never laddered. See goods-governance-shared.ts.
 */

// Verified IDs (CLAUDE.md / queried 2026-06-09). Same scope as the sync script.
const ORG_ID = '8b6160a1-7eea-4bd2-8404-71c196381de0'; // A Curious Tractor org_profile
const PROJECT_ID = '01359765-a88c-4ac2-8e4d-c40beb01c299'; // ACT-GD (Goods) — org_projects.id (FK target of org_contacts.project_id)

type Row = {
  id: string;
  name: string;
  role: string | null;
  organisation: string | null;
  linkedin_url: string | null;
  notes: string | null;
};

// Continuing co-owners first, then transitioning, then anything else; stable by name.
const STATUS_ORDER: Record<GovernanceStatus, number> = {
  continuing: 0,
  incoming: 1,
  transitioning: 2,
  unknown: 3,
};

export async function getGoodsGovernance(): Promise<{ members: GovernanceMember[] }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('org_contacts')
      .select('id, name, role, organisation, linkedin_url, notes')
      .eq('org_profile_id', ORG_ID)
      .eq('project_id', PROJECT_ID)
      .eq('contact_type', 'governance')
      .order('name');

    if (error) {
      console.error('[goods-governance] query failed:', error.message);
      return { members: [] };
    }

    const members = ((data as Row[] | null) ?? [])
      .map((r): GovernanceMember => {
        const parsed = parseGovernanceNotes(r.notes);
        return {
          id: r.id,
          name: r.name,
          role: r.role,
          organisation: r.organisation,
          linkedinUrl: r.linkedin_url,
          status: parsed.status,
          statusLabel: parsed.statusLabel ?? 'continuing',
          context: parsed.context,
        };
      })
      .sort((a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name),
      );

    return { members };
  } catch (e) {
    console.error('[goods-governance] unexpected:', e);
    return { members: [] };
  }
}

const EMPTY_LADDER: SupporterLadder = {
  rungs: BELONGING_RUNGS.map((r) => ({ tier: r.tier, label: r.label, meaning: r.meaning, count: 0, examples: [] })),
  offLadder: 0,
  total: 0,
};

type LadderRow = {
  display_name: string | null;
  stage: string | null;
  ghl_signal: { tags?: unknown } | null;
};

/**
 * The supporter belonging ladder, made live. Rolls every Goods relationship
 * (funders, buyers, partners, supporters) up into the 5 rungs by stage / tier tag.
 * The board is NOT here (it lives in org_contacts), so co-owners are never laddered.
 */
export async function getSupporterLadder(): Promise<SupporterLadder> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('goods_relationships')
      .select('display_name, stage, ghl_signal');

    if (error) {
      console.error('[goods-governance] ladder query failed:', error.message);
      return EMPTY_LADDER;
    }

    const rows = ((data as LadderRow[] | null) ?? []).map((r) => ({
      stage: r.stage,
      name: r.display_name ?? '',
      tags: Array.isArray(r.ghl_signal?.tags)
        ? (r.ghl_signal!.tags as unknown[]).filter((t): t is string => typeof t === 'string')
        : [],
    }));

    return rollupLadder(rows);
  } catch (e) {
    console.error('[goods-governance] ladder unexpected:', e);
    return EMPTY_LADDER;
  }
}
