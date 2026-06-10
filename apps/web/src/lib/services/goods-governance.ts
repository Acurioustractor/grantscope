import { getServiceSupabase } from '@/lib/supabase';
import {
  parseGovernanceNotes,
  rollupLadder,
  BELONGING_RUNGS,
  type Advisor,
  type GovernanceMember,
  type GovernanceStatus,
  type SupporterLadder,
} from './goods-governance-shared';
import { moneyShort } from './goods-engagement-shared';

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
  // Added by migration 2026060912xxxx (appointed_at/term_ends_at/identifies_indigenous).
  // The migration is written but NOT YET APPLIED, so these may be undefined on the row.
  // We read with select('*') and coerce missing fields with `?? null` (never list them
  // in an explicit .select(), which would 400 against the live schema until applied).
  appointed_at?: string | null;
  term_ends_at?: string | null;
  identifies_indigenous?: boolean | null;
};

// Continuing co-owners first, then transitioning, then anything else; stable by name.
const STATUS_ORDER: Record<GovernanceStatus, number> = {
  continuing: 0,
  incoming: 1,
  transitioning: 2,
  unknown: 3,
};

export async function getGoodsGovernance(): Promise<{ members: GovernanceMember[]; fetchError: string | null }> {
  try {
    const supabase = getServiceSupabase();
    // select('*') on purpose: the appointed_at / term_ends_at / identifies_indigenous
    // columns are added by a migration that is not yet applied. Listing them explicitly
    // would 400 against the live schema; with '*' they simply arrive as undefined and
    // we coerce them to null below.
    const { data, error } = await supabase
      .from('org_contacts')
      .select('*')
      .eq('org_profile_id', ORG_ID)
      .eq('project_id', PROJECT_ID)
      .eq('contact_type', 'governance')
      .order('name');

    if (error) {
      console.error('[goods-governance] query failed:', error.message);
      return { members: [], fetchError: error.message };
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
          appointedAt: r.appointed_at ?? null,
          termEndsAt: r.term_ends_at ?? null,
          identifiesIndigenous: r.identifies_indigenous ?? null,
        };
      })
      .sort((a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name),
      );

    return { members, fetchError: null };
  } catch (e) {
    console.error('[goods-governance] unexpected:', e);
    return { members: [], fetchError: e instanceof Error ? e.message : 'unexpected error' };
  }
}

type AdvisorRow = {
  id: string;
  name: string;
  role: string | null;
  organisation: string | null;
  linkedin_url: string | null;
  // Added by migration 20260610030000_goods_advisory_circle (contact_type CHECK +
  // these columns). The migration is written but NOT YET APPLIED, so these may be
  // undefined on the row; we read with select('*') and coerce missing fields.
  expertise?: string[] | null;
  last_contacted_at?: string | null;
  engagement_ask?: string | null;
};

export interface AdvisorsResult {
  advisors: Advisor[];
  fetchError: string | null;
}

/**
 * Goods on Country — Advisory Circle (QBE Diagnostic Area 07: advisers are never a board).
 *
 * Reads org_contacts (contact_type='advisory', same ACT org + Goods project scope as
 * the board). This must degrade gracefully TODAY: the migration that adds 'advisory' to
 * the contact_type CHECK (and the expertise/last_contacted_at/engagement_ask columns) is
 * not yet applied. Until it is, no row can carry contact_type='advisory', so the query
 * returns zero rows — that is the normal pre-migration state, NOT an error. We only set
 * fetchError when Postgres actually errors; select('*') keeps the not-yet-added columns
 * from 400-ing and we coerce them to []/null.
 */
export async function getGoodsAdvisors(): Promise<AdvisorsResult> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('org_contacts')
      .select('*')
      .eq('org_profile_id', ORG_ID)
      .eq('project_id', PROJECT_ID)
      .eq('contact_type', 'advisory')
      .order('name');

    if (error) {
      console.error('[goods-governance] advisors query failed:', error.message);
      return { advisors: [], fetchError: error.message };
    }

    const advisors = ((data as AdvisorRow[] | null) ?? []).map((r): Advisor => ({
      id: r.id,
      name: r.name,
      role: r.role,
      organisation: r.organisation,
      linkedinUrl: r.linkedin_url,
      expertise: Array.isArray(r.expertise)
        ? r.expertise.filter((e): e is string => typeof e === 'string')
        : [],
      lastContactedAt: r.last_contacted_at ?? null,
      engagementAsk: r.engagement_ask ?? null,
    }));

    return { advisors, fetchError: null };
  } catch (e) {
    console.error('[goods-governance] advisors unexpected:', e);
    return { advisors: [], fetchError: e instanceof Error ? e.message : 'unexpected error' };
  }
}

const EMPTY_LADDER: SupporterLadder = {
  rungs: BELONGING_RUNGS.map((r) => ({ tier: r.tier, label: r.label, meaning: r.meaning, count: 0, examples: [] })),
  offLadder: 0,
  total: 0,
  unrecognisedTier: 0,
};

export interface SupporterLadderResult {
  ladder: SupporterLadder;
  fetchError: string | null;
}

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
export async function getSupporterLadder(): Promise<SupporterLadderResult> {
  try {
    const supabase = getServiceSupabase();
    // Only the three columns the rollup needs.
    const { data, error } = await supabase
      .from('goods_relationships')
      .select('display_name, stage, ghl_signal');

    if (error) {
      console.error('[goods-governance] ladder query failed:', error.message);
      return { ladder: EMPTY_LADDER, fetchError: error.message };
    }

    const rows = ((data as LadderRow[] | null) ?? []).map((r) => ({
      stage: r.stage,
      name: r.display_name ?? '',
      tags: Array.isArray(r.ghl_signal?.tags)
        ? (r.ghl_signal!.tags as unknown[]).filter((t): t is string => typeof t === 'string')
        : [],
    }));

    return { ladder: rollupLadder(rows), fetchError: null };
  } catch (e) {
    console.error('[goods-governance] ladder unexpected:', e);
    return { ladder: EMPTY_LADDER, fetchError: e instanceof Error ? e.message : 'unexpected error' };
  }
}

export interface FunderReadiness {
  /** Relationships counted as committed funding partners (committed/repeat stage). */
  committedFunders: number;
  /** Lifetime received across ALL Goods relationships, summed from total_received_aud. */
  lifetimeReceived: number;
  /** Pre-formatted compact AUD of lifetimeReceived. */
  lifetimeReceivedShort: string;
  fetchError: string | null;
}

const FUNDER_TYPES = new Set(['funder', 'impact_investor', 'repayable_finance']);
const COMMITTED_STAGES = new Set(['committed', 'repeat']);

type ReadinessRow = {
  relationship_type: string | null;
  stage: string | null;
  total_received_aud: number | string | null;
};

/**
 * Funder due-diligence rollup for the readiness header: how many committed funding
 * partners back Goods, and the lifetime money received across every relationship.
 * Committed = a funder/impact-investor/repayable-finance relationship at the
 * committed or repeat stage. Lifetime received sums total_received_aud across all rows.
 */
export async function getFunderReadiness(): Promise<FunderReadiness> {
  const empty: FunderReadiness = {
    committedFunders: 0,
    lifetimeReceived: 0,
    lifetimeReceivedShort: moneyShort(0),
    fetchError: null,
  };
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('goods_relationships')
      .select('relationship_type, stage, total_received_aud');

    if (error) {
      console.error('[goods-governance] readiness query failed:', error.message);
      return { ...empty, fetchError: error.message };
    }

    let committedFunders = 0;
    let lifetimeReceived = 0;
    for (const r of (data as ReadinessRow[] | null) ?? []) {
      const type = (r.relationship_type ?? '').toLowerCase();
      const stage = (r.stage ?? '').toLowerCase();
      if (FUNDER_TYPES.has(type) && COMMITTED_STAGES.has(stage)) committedFunders += 1;
      const received = typeof r.total_received_aud === 'string' ? Number(r.total_received_aud) : r.total_received_aud;
      if (Number.isFinite(received)) lifetimeReceived += received as number;
    }

    return {
      committedFunders,
      lifetimeReceived,
      lifetimeReceivedShort: moneyShort(lifetimeReceived),
      fetchError: null,
    };
  } catch (e) {
    console.error('[goods-governance] readiness unexpected:', e);
    return { ...empty, fetchError: e instanceof Error ? e.message : 'unexpected error' };
  }
}
