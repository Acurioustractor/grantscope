// The People surface reads (spec: docs/specs/people-surface-ux-spec.md).
// Everything here hits the Supabase mirror (`act_people`) or CivicGraph —
// never GHL live (ADR 0002). Writes live in act-people-ghl.ts + the API route.
import { getServiceSupabase } from '@/lib/supabase';
import { ghlContactUrl } from '@/lib/ghl-links';

export const WARMTH_VALUES = ['hot', 'warm', 'steady', 'cooling', 'cold'] as const;
export type Warmth = (typeof WARMTH_VALUES)[number];

export const ROLE_TYPES = ['works_at', 'board_of', 'decides_for', 'opens_into'] as const;
export type RoleType = (typeof ROLE_TYPES)[number];

export const ROLE_LABEL: Record<RoleType, string> = {
  works_at: 'works at',
  board_of: 'board of',
  decides_for: 'decides for',
  opens_into: 'opens into',
};

export type PersonRole = {
  id: string;
  roleType: RoleType;
  orgName: string;
  orgRef: string | null;
};

export type ActPerson = {
  id: string;
  name: string;
  warmth: Warmth | null;
  warmVia: string | null;
  owner: string | null;
  nextAction: string | null;
  reviewBy: string | null;
  /** Days until review-by; negative = past; null = dateless (released). */
  dueDays: number | null;
  lastTouchAt: string | null;
  lastSyncedAt: string | null;
  /** Mirrored fact older than 24h (existing data-trust rule). */
  stale: boolean;
  ghlContactId: string;
  ghlUrl: string | null;
  roles: PersonRole[];
};

const WARMTH_RANK: Record<string, number> = { hot: 0, warm: 1, steady: 2, cooling: 3, cold: 4 };

function dueDays(reviewBy: string | null): number | null {
  if (!reviewBy) return null;
  const t = new Date(`${reviewBy}T00:00:00`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export async function getActPeople(orgProfileId: string): Promise<ActPerson[]> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('act_people')
    .select(
      'id, name, warmth, warm_via, owner, next_action, review_by, last_touch_at, last_synced_at, ghl_contact_id, act_person_roles(id, role_type, org_name, org_ref)'
    )
    .eq('org_profile_id', orgProfileId);
  if (error) return []; // mirror not migrated yet — surface renders empty, honestly

  const now = Date.now();
  const people = (data ?? []).map((r) => {
    const synced = r.last_synced_at ? new Date(r.last_synced_at).getTime() : null;
    return {
      id: r.id as string,
      name: r.name as string,
      warmth: (r.warmth as Warmth) ?? null,
      warmVia: (r.warm_via as string) ?? null,
      owner: (r.owner as string) ?? null,
      nextAction: (r.next_action as string) ?? null,
      reviewBy: (r.review_by as string) ?? null,
      dueDays: dueDays(r.review_by as string | null),
      lastTouchAt: (r.last_touch_at as string) ?? null,
      lastSyncedAt: (r.last_synced_at as string) ?? null,
      stale: synced == null || now - synced > 24 * 3600_000,
      ghlContactId: r.ghl_contact_id as string,
      ghlUrl: ghlContactUrl(r.ghl_contact_id as string),
      roles: ((r.act_person_roles as unknown as Array<Record<string, unknown>>) ?? []).map((role) => ({
        id: role.id as string,
        roleType: role.role_type as RoleType,
        orgName: role.org_name as string,
        orgRef: (role.org_ref as string) ?? null,
      })),
    } satisfies ActPerson;
  });

  // Ordering (spec §3): next-action due first — overdue, then soonest
  // review-by, then the dateless tail sorted by warmth (warmest first).
  people.sort((a, b) => {
    if (a.dueDays != null && b.dueDays != null) return a.dueDays - b.dueDays;
    if (a.dueDays != null) return -1;
    if (b.dueDays != null) return 1;
    return (WARMTH_RANK[a.warmth ?? ''] ?? 9) - (WARMTH_RANK[b.warmth ?? ''] ?? 9);
  });
  return people;
}

// ---------------------------------------------------------------------------
// Minting candidates ("Not yet people", spec §5): GHL contacts + org_contacts
// rows that aren't minted — one-line signals, never mixed into the list.

export type MintCandidate = {
  /** GHL contact id when the candidate already exists in GHL (→ claim). */
  ghlContactId: string | null;
  name: string;
  detail: string | null;
  source: 'ghl' | 'org_contacts';
};

export async function getMintCandidates(orgProfileId: string, limit = 25): Promise<MintCandidate[]> {
  const db = getServiceSupabase();
  const [minted, ghl, orgContacts] = await Promise.all([
    db.from('act_people').select('ghl_contact_id, name').eq('org_profile_id', orgProfileId),
    db
      .from('ghl_contacts')
      .select('ghl_id, full_name, first_name, last_name, company_name, tags, last_contact_date')
      .not('full_name', 'is', null)
      .order('last_contact_date', { ascending: false, nullsFirst: false })
      .limit(200),
    db
      .from('org_contacts')
      .select('name, role, organisation')
      .eq('org_profile_id', orgProfileId)
      .limit(100),
  ]);

  const mintedIds = new Set((minted.data ?? []).map((m) => m.ghl_contact_id as string));
  const mintedNames = new Set((minted.data ?? []).map((m) => (m.name as string).toLowerCase()));
  const out: MintCandidate[] = [];

  for (const c of ghl.data ?? []) {
    if (out.length >= limit) break;
    const id = c.ghl_id as string | null;
    const name = (c.full_name as string) || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
    if (!id || !name || mintedIds.has(id) || mintedNames.has(name.toLowerCase())) continue;
    // Person-shaped GHL contacts only: the record:person tag when present,
    // else any contact with a real name that isn't tagged as an org record.
    const tags = ((c.tags as string[]) ?? []).map((t) => t.toLowerCase());
    if (tags.includes('record:org')) continue;
    out.push({
      ghlContactId: id,
      name,
      detail: (c.company_name as string) || null,
      source: 'ghl',
    });
  }
  for (const c of orgContacts.data ?? []) {
    if (out.length >= limit) break;
    const name = c.name as string;
    if (!name || mintedNames.has(name.toLowerCase())) continue;
    if (out.some((o) => o.name.toLowerCase() === name.toLowerCase())) continue;
    out.push({
      ghlContactId: null,
      name,
      detail: [c.role, c.organisation].filter(Boolean).join(' · ') || null,
      source: 'org_contacts',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// CivicGraph evidence (spec §4.4): annotations, never state. Read-only, each
// carrying its own freshness signal (the MVs refresh nightly).

export type PersonEvidence = {
  influence: { boardCount: number; financialFootprint: number } | null;
  interlocks: Array<{ entities: string; sharedBoardCount: number }>;
};

export async function getPersonEvidence(name: string): Promise<PersonEvidence> {
  const db = getServiceSupabase();
  const empty: PersonEvidence = { influence: null, interlocks: [] };
  if (!name) return empty;
  try {
    const [influence, interlocks] = await Promise.all([
      db
        .from('mv_person_influence')
        .select('board_count, financial_footprint')
        .ilike('person_name', name)
        .limit(1)
        .maybeSingle(),
      db
        .from('mv_board_interlocks')
        .select('entities, shared_board_count')
        .ilike('person_name', name)
        .limit(5),
    ]);
    return {
      influence: influence.data
        ? {
            boardCount: Number(influence.data.board_count ?? 0),
            financialFootprint: Number(influence.data.financial_footprint ?? 0),
          }
        : null,
      interlocks: (interlocks.data ?? []).map((r) => ({
        entities: Array.isArray(r.entities) ? (r.entities as string[]).join(', ') : String(r.entities ?? ''),
        sharedBoardCount: Number(r.shared_board_count ?? 0),
      })),
    };
  } catch {
    return empty;
  }
}
