// Obligations — Supabase-native work truth (ADR 0003; delivery spec
// docs/specs/delivery-surfaces-ux-spec.md). The We-owe tab shows the full
// open pool; the desk applies its own thresholds (#152) on top.
import { getServiceSupabase } from '@/lib/supabase';

export type ObligationOwedTo = 'funder' | 'community';
export type ObligationState = 'open' | 'done' | 'dropped';

export type Obligation = {
  id: string;
  orgProfileId: string;
  projectCode: string;
  title: string;
  owedTo: ObligationOwedTo;
  state: ObligationState;
  nextAction: string | null;
  dueDate: string | null;
  /** Days until due; negative = overdue; null = undated. */
  dueDays: number | null;
  owner: string | null;
  sourceAskGhlId: string | null;
  sourceAskName: string | null;
  promisedTo: string | null;
  artefactUrl: string | null;
  dropReason: string | null;
  mintedAt: string;
  dischargedAt: string | null;
  /** Community this is owed to/tagged with (ADR 0004) — null = untagged. */
  communityId: string | null;
  communityName: string | null;
  communitySlug: string | null;
};

export type ObligationPool = {
  open: Obligation[];
  /** Done + Dropped, most recent first (the honest delivery record). */
  closed: Obligation[];
  counts: { open: number; overdue: number; undated: number; doneQuarter: number };
};

type Row = {
  id: string;
  org_profile_id: string;
  project_code: string;
  title: string;
  owed_to: ObligationOwedTo;
  state: ObligationState;
  next_action: string | null;
  due_date: string | null;
  owner: string | null;
  source_ask_ghl_id: string | null;
  source_ask_name: string | null;
  promised_to: string | null;
  artefact_url: string | null;
  drop_reason: string | null;
  minted_at: string;
  discharged_at: string | null;
  community_id?: string | null;
  act_communities?: { name: string; slug: string } | null;
};

function dueDays(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(`${iso}T00:00:00`).getTime();
  return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000);
}

function fromRow(r: Row): Obligation {
  return {
    id: r.id,
    orgProfileId: r.org_profile_id,
    projectCode: r.project_code,
    title: r.title,
    owedTo: r.owed_to,
    state: r.state,
    nextAction: r.next_action,
    dueDate: r.due_date,
    dueDays: dueDays(r.due_date),
    owner: r.owner,
    sourceAskGhlId: r.source_ask_ghl_id,
    sourceAskName: r.source_ask_name,
    promisedTo: r.promised_to,
    artefactUrl: r.artefact_url,
    dropReason: r.drop_reason,
    mintedAt: r.minted_at,
    dischargedAt: r.discharged_at,
    communityId: r.community_id ?? null,
    communityName: r.act_communities?.name ?? null,
    communitySlug: r.act_communities?.slug ?? null,
  };
}

/** Open first (overdue → soonest due → undated newest-minted), then history. */
export async function getObligationPool(orgProfileId: string, projectCode: string): Promise<ObligationPool> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('act_obligations')
    .select('*, act_communities(name, slug)')
    .eq('org_profile_id', orgProfileId)
    .eq('project_code', projectCode)
    .order('minted_at', { ascending: false });
  if (error) throw new Error(`act_obligations read failed: ${error.message}`);

  const all = ((data ?? []) as Row[]).map(fromRow);
  const open = all
    .filter((o) => o.state === 'open')
    .sort((a, b) => {
      if (a.dueDays == null && b.dueDays == null) return b.mintedAt.localeCompare(a.mintedAt);
      if (a.dueDays == null) return 1;
      if (b.dueDays == null) return -1;
      return a.dueDays - b.dueDays;
    });
  const closed = all
    .filter((o) => o.state !== 'open')
    .sort((a, b) => (b.dischargedAt ?? b.mintedAt).localeCompare(a.dischargedAt ?? a.mintedAt));

  const quarterAgo = Date.now() - 90 * 86_400_000;
  return {
    open,
    closed,
    counts: {
      open: open.length,
      overdue: open.filter((o) => o.dueDays != null && o.dueDays < 0).length,
      undated: open.filter((o) => o.dueDays == null).length,
      doneQuarter: closed.filter((o) => o.state === 'done' && o.dischargedAt && new Date(o.dischargedAt).getTime() >= quarterAgo).length,
    },
  };
}

/** Desk feed: open Obligations that earn a desk row (#152 — overdue, due ≤ 30d, or undated). */
export async function getDeskObligations(orgProfileId: string): Promise<Obligation[]> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('act_obligations')
    .select('*')
    .eq('org_profile_id', orgProfileId)
    .eq('state', 'open');
  if (error) throw new Error(`act_obligations read failed: ${error.message}`);
  return ((data ?? []) as Row[])
    .map(fromRow)
    .filter((o) => o.dueDays == null || o.dueDays <= 30);
}
