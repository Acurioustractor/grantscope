// Desk feed for cultivated People (CONTEXT.md: Person; ADR 0002 — GHL owns
// the state, surfaces read the Supabase mirror, never GHL live). Eligibility
// per #152: next action / watch review-by ≤ 7 days away or past.
//
// The mirror table (`act_people`) ships with the /people surface build
// (#154). Until it exists this feed returns [] — the desk renders honestly
// with zero person rows rather than faking any.
import { getServiceSupabase } from '@/lib/supabase';

export type DeskPerson = {
  id: string;
  name: string;
  /** Next action / watch text, plain words. */
  nextAction: string;
  /** Days until review-by; negative = past. Always dated (enforced at minting). */
  dueDays: number;
  /** Warm-via holder; null when warmth is direct. */
  via: string | null;
  warmth: string | null;
  ghlContactId: string | null;
  lastSyncedAt: string | null;
};

type Row = {
  id: string;
  name: string;
  next_action: string | null;
  review_by: string | null;
  warm_via: string | null;
  warmth: string | null;
  ghl_contact_id: string | null;
  last_synced_at: string | null;
};

export async function getDeskPeople(orgProfileId: string): Promise<DeskPerson[]> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('act_people')
    .select('id, name, next_action, review_by, warm_via, warmth, ghl_contact_id, last_synced_at')
    .eq('org_profile_id', orgProfileId);
  if (error) return []; // mirror not built yet (#154)

  const out: DeskPerson[] = [];
  for (const r of (data ?? []) as Row[]) {
    if (!r.review_by || !r.next_action) continue;
    const t = new Date(`${r.review_by}T00:00:00`).getTime();
    if (Number.isNaN(t)) continue;
    const dueDays = Math.ceil((t - Date.now()) / 86_400_000);
    if (dueDays > 7) continue;
    out.push({
      id: r.id,
      name: r.name,
      nextAction: r.next_action,
      dueDays,
      via: r.warm_via,
      warmth: r.warmth,
      ghlContactId: r.ghl_contact_id,
      lastSyncedAt: r.last_synced_at,
    });
  }
  return out;
}
