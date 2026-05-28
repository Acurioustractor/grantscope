import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';

export type FunderTemperature = 'WARM' | 'TEPID' | 'LIGHT' | 'COLD';

export interface FoundationWatchlistItem {
  /** Stable id — uses funder_name lowercased as key */
  key: string;
  funder_name: string;
  /** Reason this surfaces: pipeline_pin (in org_pipeline.foundation), paid (Xero history), both */
  presence: 'pipeline' | 'paid' | 'both';
  project_codes: string[];
  temperature: FunderTemperature;
  relationship_score: number | null;
  /** Lifetime $ paid via Xero (PAID invoices only) */
  paid_total: number;
  /** Authorised but unpaid */
  auth_total: number;
  /** Last paid date (ISO) */
  last_paid_date: string | null;
  /** Total $ annual giving from foundations master, if known */
  annual_giving: number | null;
  /** Thematic focus from funder_context_snapshot OR foundations master */
  thematic_focus: string[];
  /** Geographic focus */
  geographic_focus: string[];
  /** Number of grantee contacts on record */
  contacts_count: number;
  /** Up to 3 recent grantees (for context strip) */
  recent_grantees: string[];
  /** Currently open foundation_programs count */
  open_programs_count: number;
  /** Website if known */
  website: string | null;
  /** Days since most recent contact (Xero or other) */
  days_since_last_touch: number | null;
}

export interface FoundationWatchlistData {
  items: FoundationWatchlistItem[];
  totals: {
    funders: number;
    paid_lifetime: number;
    warm: number;
    tepid: number;
    light: number;
    cold: number;
  };
}

function temperatureFromScore(score: number | null): FunderTemperature {
  if (score == null) return 'COLD';
  if (score >= 50) return 'WARM';
  if (score >= 20) return 'TEPID';
  if (score > 0) return 'LIGHT';
  return 'COLD';
}

function normalize(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.max(0, Math.floor((Date.now() - d) / 86_400_000));
}

interface PipelineFoundationRow {
  funder: string | null;
  project_code: string | null;
}
interface IncomeRow {
  funder_name: string;
  paid_total: number | null;
  auth_total: number | null;
  last_paid_date: string | null;
  project_codes: string[] | null;
}
interface ContextRow {
  funder_name: string;
  annual_giving: number | null;
  thematic_focus: string[] | null;
  geographic_focus: string[] | null;
  website: string | null;
  contacts_count: number | null;
  recent_grantees: string[] | null;
  most_recent_contact_at: string | null;
  foundation_id: string | null;
  abn: string | null;
}

export const getFoundationWatchlistData = cache(async function getFoundationWatchlistData(
  slug: string,
): Promise<FoundationWatchlistData | null> {
  if (!isActSlug(slug)) return null;

  const supabase = getServiceSupabase();

  const [pipelineRes, incomeRes, contextRes] = await Promise.all([
    supabase
      .from('org_pipeline')
      .select('funder, project_code')
      .eq('opportunity_type', 'foundation'),
    supabase
      .from('v_act_income_by_funder')
      .select('funder_name, paid_total, auth_total, last_paid_date, project_codes')
      .gt('paid_total', 0),
    supabase
      .from('funder_context_snapshot')
      .select(
        'funder_name, annual_giving, thematic_focus, geographic_focus, website, contacts_count, recent_grantees, most_recent_contact_at, foundation_id, abn',
      ),
  ]);

  const pipeline = (pipelineRes.data ?? []) as PipelineFoundationRow[];
  const incomeRows = (incomeRes.data ?? []) as IncomeRow[];
  const contexts = (contextRes.data ?? []) as ContextRow[];

  // Build context lookup
  const contextByFunder = new Map<string, ContextRow>();
  for (const c of contexts) {
    contextByFunder.set(normalize(c.funder_name), c);
  }

  // Pull open foundation_programs by foundation_id
  const foundationIds = contexts.map((c) => c.foundation_id).filter((id): id is string => Boolean(id));
  const programsByFoundationId = new Map<string, number>();
  if (foundationIds.length > 0) {
    const { data: programs } = await supabase
      .from('foundation_programs')
      .select('foundation_id, status')
      .in('foundation_id', foundationIds)
      .eq('status', 'open');
    for (const p of (programs ?? []) as Array<{ foundation_id: string; status: string }>) {
      programsByFoundationId.set(p.foundation_id, (programsByFoundationId.get(p.foundation_id) ?? 0) + 1);
    }
  }

  // Merge: build a single set of funders from pipeline + income
  type Bag = {
    funder_name: string;
    presence: 'pipeline' | 'paid' | 'both';
    project_codes: Set<string>;
    paid_total: number;
    auth_total: number;
    last_paid_date: string | null;
  };
  const merged = new Map<string, Bag>();

  for (const row of pipeline) {
    if (!row.funder) continue;
    const key = normalize(row.funder);
    const existing = merged.get(key) || {
      funder_name: row.funder,
      presence: 'pipeline' as const,
      project_codes: new Set<string>(),
      paid_total: 0,
      auth_total: 0,
      last_paid_date: null,
    };
    if (row.project_code) existing.project_codes.add(row.project_code);
    merged.set(key, existing);
  }

  for (const row of incomeRows) {
    const key = normalize(row.funder_name);
    const existing = merged.get(key);
    const paid = Number(row.paid_total ?? 0);
    const auth = Number(row.auth_total ?? 0);
    if (existing) {
      existing.presence = existing.presence === 'pipeline' ? 'both' : existing.presence;
      existing.paid_total = paid;
      existing.auth_total = auth;
      existing.last_paid_date = row.last_paid_date;
      for (const pc of row.project_codes ?? []) existing.project_codes.add(pc);
    } else {
      const bag: Bag = {
        funder_name: row.funder_name,
        presence: 'paid',
        project_codes: new Set<string>(row.project_codes ?? []),
        paid_total: paid,
        auth_total: auth,
        last_paid_date: row.last_paid_date,
      };
      merged.set(key, bag);
    }
  }

  // Build final items with context enrichment
  const items: FoundationWatchlistItem[] = [];
  for (const [key, bag] of merged.entries()) {
    const ctx = contextByFunder.get(key);
    const score = ctx ? null : null; // funder_context_snapshot doesn't expose score directly; v_act has it
    // Recompute score from paid_total signal (lightweight derivation when no relationship_score available)
    let derivedScore: number | null = null;
    if (bag.paid_total >= 100_000) derivedScore = 70;
    else if (bag.paid_total >= 10_000) derivedScore = 45;
    else if (bag.paid_total > 0) derivedScore = 25;
    else if (bag.presence === 'pipeline') derivedScore = 5;
    else derivedScore = 0;

    const lastTouch = ctx?.most_recent_contact_at ?? bag.last_paid_date ?? null;

    items.push({
      key,
      funder_name: bag.funder_name,
      presence: bag.presence,
      project_codes: Array.from(bag.project_codes),
      temperature: temperatureFromScore(score ?? derivedScore),
      relationship_score: derivedScore,
      paid_total: bag.paid_total,
      auth_total: bag.auth_total,
      last_paid_date: bag.last_paid_date,
      annual_giving: ctx?.annual_giving ?? null,
      thematic_focus: ctx?.thematic_focus ?? [],
      geographic_focus: ctx?.geographic_focus ?? [],
      contacts_count: ctx?.contacts_count ?? 0,
      recent_grantees: (ctx?.recent_grantees ?? []).slice(0, 3),
      open_programs_count: ctx?.foundation_id ? (programsByFoundationId.get(ctx.foundation_id) ?? 0) : 0,
      website: ctx?.website ?? null,
      days_since_last_touch: daysSince(lastTouch),
    });
  }

  // Sort: warm first, then by paid_total desc
  items.sort((a, b) => {
    const tempOrder: Record<FunderTemperature, number> = { WARM: 0, TEPID: 1, LIGHT: 2, COLD: 3 };
    if (tempOrder[a.temperature] !== tempOrder[b.temperature]) {
      return tempOrder[a.temperature] - tempOrder[b.temperature];
    }
    return b.paid_total - a.paid_total;
  });

  const totals = {
    funders: items.length,
    paid_lifetime: items.reduce((sum, i) => sum + i.paid_total, 0),
    warm: items.filter((i) => i.temperature === 'WARM').length,
    tepid: items.filter((i) => i.temperature === 'TEPID').length,
    light: items.filter((i) => i.temperature === 'LIGHT').length,
    cold: items.filter((i) => i.temperature === 'COLD').length,
  };

  return { items, totals };
});
