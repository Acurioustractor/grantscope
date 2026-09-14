import { getServiceSupabase } from '@/lib/supabase';

/** The private ACT grants desk: every live grant from the public corpus (grant_opportunities) and ACT's
 *  private SmartyGrants rounds (act_private_grant_rounds), soonest close first. The private table is service
 *  role only and its rows must never reach a page without the admin gate in /org/[slug]/grants/page.tsx. */

export const LIVE_STATUSES = ['open', 'ongoing', 'upcoming'] as const;

export type DeskOrigin = 'public' | 'act-private';

export interface DeskSourceRow {
  id: string;
  name: string;
  provider: string | null;
  status: string | null;
  closes_at: string | null;
  deadline: string | null;
  amount_min: number | null;
  amount_max: number | null;
  geography: string | null;
  url: string | null;
  source: string | null;
}

export interface DeskGrant {
  id: string;
  origin: DeskOrigin;
  name: string;
  provider: string | null;
  closeDate: string | null;
  daysToClose: number | null;
  amountMin: number | null;
  amountMax: number | null;
  geography: string | null;
  url: string | null;
  source: string | null;
}

const DAY = 86_400_000;

function normUrl(url: string | null): string | null {
  if (!url) return null;
  return url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/** Pure: filter to live, dedupe by URL (public row wins), sort soonest close first, undated last. */
export function buildDesk(
  publicRows: DeskSourceRow[],
  privateRows: DeskSourceRow[],
  today: Date = new Date(),
): DeskGrant[] {
  const todayIso = today.toISOString().slice(0, 10);
  const todayMs = Date.parse(`${todayIso}T00:00:00Z`);
  const seen = new Set<string>();
  const out: DeskGrant[] = [];

  const take = (rows: DeskSourceRow[], origin: DeskOrigin) => {
    for (const r of rows) {
      if (!r.status || !(LIVE_STATUSES as readonly string[]).includes(r.status)) continue;
      const closeDate = r.closes_at ?? r.deadline ?? null;
      if (closeDate && closeDate.slice(0, 10) < todayIso) continue;
      const key = normUrl(r.url);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      out.push({
        id: r.id,
        origin,
        name: r.name,
        provider: r.provider,
        closeDate,
        daysToClose: closeDate ? Math.round((Date.parse(`${closeDate.slice(0, 10)}T00:00:00Z`) - todayMs) / DAY) : null,
        amountMin: r.amount_min,
        amountMax: r.amount_max,
        geography: r.geography,
        url: r.url,
        source: r.source,
      });
    }
  };
  take(publicRows, 'public');
  take(privateRows, 'act-private');

  return out.sort((a, b) => {
    if (a.closeDate && b.closeDate) return a.closeDate.localeCompare(b.closeDate) || a.name.localeCompare(b.name);
    if (a.closeDate) return -1;
    if (b.closeDate) return 1;
    return a.name.localeCompare(b.name);
  });
}

const COLUMNS = 'id, name, provider, status, closes_at, deadline, amount_min, amount_max, geography, url, source';
const PAGE = 1000;

async function fetchLive(table: 'grant_opportunities' | 'act_private_grant_rounds'): Promise<DeskSourceRow[]> {
  const db = getServiceSupabase();
  const rows: DeskSourceRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(COLUMNS)
      .in('status', [...LIVE_STATUSES])
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`act grants desk (${table}): ${error.message}`);
    rows.push(...((data ?? []) as DeskSourceRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function getActGrantsDesk(): Promise<{ grants: DeskGrant[]; generatedAt: string }> {
  const [publicRows, privateRows] = await Promise.all([
    fetchLive('grant_opportunities'),
    fetchLive('act_private_grant_rounds'),
  ]);
  return { grants: buildDesk(publicRows, privateRows), generatedAt: new Date().toISOString() };
}
