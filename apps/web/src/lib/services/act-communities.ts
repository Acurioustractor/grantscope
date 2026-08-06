// Community records — places ACT is deliberately engaged with (CONTEXT.md;
// docs/specs/community-records-spec.md; ADR 0004). Supabase-native, human-
// minted, expected list size 5–15. The record page is a read surface composed
// of existing state: who we know there, what we owe, what's live, last touch.
import { getServiceSupabase } from '@/lib/supabase';
import type { Obligation } from '@/lib/services/act-obligations';

export type CommunityLinkType = 'in' | 'distributes-into' | 'anchored-in';

export type CommunityLink = {
  id: string;
  subjectType: 'org' | 'person';
  subjectRef: string;
  linkType: CommunityLinkType;
  /** Org links: relationship warmth from goods_relationships when known. */
  warmth: string | null;
  lastTouch: string | null;
};

export type Community = {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
  geo: Record<string, unknown>;
  mintedBy: string | null;
  mintedAt: string;
};

export type CommunityRecord = Community & {
  /** Pane 1 — who we know there. */
  links: CommunityLink[];
  /** Pane 2 — what we owe (open Obligations tagged to this Community). */
  obligations: Obligation[];
  /** Pane 3 — what's live: the distributes-into links are the Channels. */
  channels: CommunityLink[];
  /** Pane 4 — derived max last-touch across the record's state. */
  lastTouch: string | null;
};

type CommunityRow = {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
  geo: Record<string, unknown>;
  minted_by: string | null;
  minted_at: string;
};

function fromRow(r: CommunityRow): Community {
  return { id: r.id, name: r.name, slug: r.slug, notes: r.notes, geo: r.geo ?? {}, mintedBy: r.minted_by, mintedAt: r.minted_at };
}

export async function getCommunities(orgProfileId: string): Promise<Array<Community & { linkCount: number; openObligations: number }>> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('act_communities')
    .select('id, name, slug, notes, geo, minted_by, minted_at')
    .eq('org_profile_id', orgProfileId)
    .order('name');
  if (error) return []; // table not migrated yet
  const communities = ((data ?? []) as CommunityRow[]).map(fromRow);
  if (communities.length === 0) return [];

  const ids = communities.map((c) => c.id);
  const [links, obligations] = await Promise.all([
    db.from('act_community_links').select('community_id').in('community_id', ids),
    db.from('act_obligations').select('community_id').eq('state', 'open').in('community_id', ids),
  ]);
  const linkCounts = new Map<string, number>();
  for (const l of (links.data ?? []) as Array<{ community_id: string }>) linkCounts.set(l.community_id, (linkCounts.get(l.community_id) ?? 0) + 1);
  const oblCounts = new Map<string, number>();
  for (const o of (obligations.data ?? []) as Array<{ community_id: string }>) oblCounts.set(o.community_id, (oblCounts.get(o.community_id) ?? 0) + 1);

  return communities.map((c) => ({ ...c, linkCount: linkCounts.get(c.id) ?? 0, openObligations: oblCounts.get(c.id) ?? 0 }));
}

export async function getCommunityRecord(orgProfileId: string, slug: string): Promise<CommunityRecord | null> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('act_communities')
    .select('id, name, slug, notes, geo, minted_by, minted_at')
    .eq('org_profile_id', orgProfileId)
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  const community = fromRow(data as CommunityRow);

  const [linkRes, oblRes] = await Promise.all([
    db.from('act_community_links').select('id, subject_type, subject_ref, link_type').eq('community_id', community.id).order('link_type'),
    db.from('act_obligations').select('*').eq('community_id', community.id).order('due_date', { ascending: true, nullsFirst: false }),
  ]);

  const linkRows = (linkRes.data ?? []) as Array<{ id: string; subject_type: 'org' | 'person'; subject_ref: string; link_type: CommunityLinkType }>;

  // Org warmth annotation from the Goods relationship registry (best-effort;
  // absence is honest — not every linked Org is in the registry).
  const orgNames = linkRows.filter((l) => l.subject_type === 'org').map((l) => l.subject_ref);
  const warmthByOrg = new Map<string, { warmth: string | null; lastTouch: string | null }>();
  if (orgNames.length > 0) {
    const { data: rels } = await db
      .from('goods_relationships')
      .select('display_name, warmth_display, last_touch_at')
      .in('display_name', orgNames);
    for (const r of (rels ?? []) as Array<{ display_name: string; warmth_display: string | null; last_touch_at: string | null }>) {
      warmthByOrg.set(r.display_name, { warmth: r.warmth_display, lastTouch: r.last_touch_at });
    }
  }

  const links: CommunityLink[] = linkRows.map((l) => ({
    id: l.id,
    subjectType: l.subject_type,
    subjectRef: l.subject_ref,
    linkType: l.link_type,
    warmth: warmthByOrg.get(l.subject_ref)?.warmth ?? null,
    lastTouch: warmthByOrg.get(l.subject_ref)?.lastTouch ?? null,
  }));

  type OblRow = Parameters<typeof mapObligation>[0];
  const obligations = ((oblRes.data ?? []) as OblRow[]).map((r) => mapObligation(r, community));

  const touches = [
    ...links.map((l) => l.lastTouch),
    ...obligations.map((o) => o.dischargedAt ?? o.mintedAt),
  ].filter((t): t is string => Boolean(t)).sort();

  return {
    ...community,
    links,
    obligations: obligations.filter((o) => o.state === 'open'),
    channels: links.filter((l) => l.linkType === 'distributes-into'),
    lastTouch: touches[touches.length - 1] ?? null,
  };
}

function mapObligation(r: {
  id: string; org_profile_id: string; project_code: string; title: string;
  owed_to: 'funder' | 'community'; state: 'open' | 'done' | 'dropped';
  next_action: string | null; due_date: string | null; owner: string | null;
  source_ask_ghl_id: string | null; source_ask_name: string | null;
  promised_to: string | null; artefact_url: string | null; drop_reason: string | null;
  minted_at: string; discharged_at: string | null;
}, community: { id: string; name: string; slug: string }): Obligation {
  const t = r.due_date ? new Date(`${r.due_date}T00:00:00`).getTime() : NaN;
  return {
    id: r.id, orgProfileId: r.org_profile_id, projectCode: r.project_code,
    title: r.title, owedTo: r.owed_to, state: r.state, nextAction: r.next_action,
    dueDate: r.due_date, dueDays: Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000),
    owner: r.owner, sourceAskGhlId: r.source_ask_ghl_id, sourceAskName: r.source_ask_name,
    promisedTo: r.promised_to, artefactUrl: r.artefact_url, dropReason: r.drop_reason,
    mintedAt: r.minted_at, dischargedAt: r.discharged_at,
    communityId: community.id, communityName: community.name, communitySlug: community.slug,
  };
}
