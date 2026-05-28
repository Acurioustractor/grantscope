import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';

export interface TodayUrgentGrant {
  project_code: string;
  opportunity_id: string;
  opportunity_name: string;
  funder_name: string | null;
  deadline: string;
  days_to_deadline: number;
  fit_score: number;
  max_grant_amount: number | null;
  source_url: string | null;
  application_url: string | null;
  /** Has a decision been recorded yet? */
  has_decision: boolean;
  last_decision: string | null;
}

export interface TodayDecisionEvent {
  project_code: string;
  opportunity_id: string;
  decision: string;
  decided_at: string;
  notes: string | null;
  funder_name: string | null;
  opportunity_name: string | null;
}

export interface TodayWarmFoundation {
  funder_name: string;
  project_codes: string[];
  paid_total: number;
  days_since_last_touch: number | null;
  /** Why this surfaces: cooling | overdue_contact | recent_win */
  reason: 'cooling' | 'overdue_contact' | 'recent_win';
}

export interface TodayHotBuyer {
  buyer_name: string;
  contracts_last_6mo: number;
  total_relevant_spend: number;
  most_recent_contract: string | null;
  recent_titles: string[];
}

export interface ActTodayDigest {
  asOf: string;
  /** Grants closing in <=14 days that don't yet have a decision */
  urgent_grants: TodayUrgentGrant[];
  /** Decisions logged in the last 7 days (progress signal) */
  recent_decisions: TodayDecisionEvent[];
  /** Funders that paid us before but haven't been touched lately */
  warm_foundations: TodayWarmFoundation[];
  /** Procurement buyers actively spending in the last 6 months */
  hot_buyers: TodayHotBuyer[];
  totals: {
    urgent_grant_count: number;
    triage_queue_size: number;
    decisions_last_7d: number;
    cooling_funder_count: number;
    hot_buyer_count: number;
  };
}

interface AlmaOpp {
  id: string;
  name: string | null;
  funder_name: string | null;
}

export const getActTodayDigest = cache(async function getActTodayDigest(
  slug: string,
): Promise<ActTodayDigest | null> {
  if (!isActSlug(slug)) return null;
  const supabase = getServiceSupabase();

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const fortnightIso = new Date(today.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  const sevenDaysAgoIso = new Date(today.getTime() - 7 * 86_400_000).toISOString();

  const [recsRes, decisionsAllRes, decisionsRecentRes, incomeRes, contextRes, buyersRes] = await Promise.all([
    // Grants closing in <=14 days
    supabase
      .from('act_grant_recommendations')
      .select('project_code, opportunity_id, opportunity_name, funder_name, deadline, fit_score, max_grant_amount, source_url, application_url')
      .gte('deadline', todayIso)
      .lte('deadline', fortnightIso)
      .order('deadline', { ascending: true })
      .range(0, 999),
    // All decisions (for dedup against urgent)
    supabase
      .from('act_grant_recommendation_decisions')
      .select('project_code, opportunity_id, decision, decided_at')
      .range(0, 9999),
    // Recent decisions (last 7 days)
    supabase
      .from('act_grant_recommendation_decisions')
      .select('project_code, opportunity_id, decision, decided_at, notes')
      .gte('decided_at', sevenDaysAgoIso)
      .order('decided_at', { ascending: false })
      .range(0, 99),
    // Paid funders with last touch info
    supabase
      .from('v_act_income_by_funder')
      .select('funder_name, paid_total, last_paid_date, project_codes')
      .gt('paid_total', 1000),
    // Funder context for last contact date
    supabase
      .from('funder_context_snapshot')
      .select('funder_name, most_recent_contact_at'),
    // Hot procurement buyers
    supabase
      .from('v_act_procurement_buyers')
      .select('buyer_name, contracts_last_6mo, total_relevant_spend, most_recent_contract, recent_contract_titles')
      .gte('contracts_last_6mo', 3)
      .order('contracts_last_6mo', { ascending: false })
      .limit(8),
  ]);

  // Build decision lookup for urgent dedup
  const allDecisions = (decisionsAllRes.data ?? []) as Array<{
    project_code: string; opportunity_id: string; decision: string; decided_at: string;
  }>;
  const decisionByKey = new Map<string, { decision: string; decided_at: string }>();
  for (const d of allDecisions) {
    decisionByKey.set(`${d.project_code}|${d.opportunity_id}`, { decision: d.decision, decided_at: d.decided_at });
    const oppKey = d.opportunity_id;
    if (!decisionByKey.has(`*|${oppKey}`)) {
      decisionByKey.set(`*|${oppKey}`, { decision: d.decision, decided_at: d.decided_at });
    }
  }

  // Urgent grants: dedup by opportunity_id (best fit_score wins), filter to undecided
  const urgentByOpp = new Map<string, TodayUrgentGrant>();
  for (const r of recsRes.data ?? []) {
    if (!r.deadline) continue;
    const days = Math.ceil((new Date(r.deadline).getTime() - today.getTime()) / 86_400_000);
    if (days < 0) continue;
    const existing = urgentByOpp.get(r.opportunity_id);
    if (existing && existing.fit_score >= r.fit_score) continue;
    const decisionForPair = decisionByKey.get(`${r.project_code}|${r.opportunity_id}`);
    const decisionForOpp = decisionByKey.get(`*|${r.opportunity_id}`);
    const has_decision = Boolean(decisionForPair || decisionForOpp);
    if (has_decision && (decisionForPair?.decision !== 'watching' && decisionForOpp?.decision !== 'watching')) {
      continue; // Skip if there's a non-watching decision (passed/pursuing/etc.)
    }
    urgentByOpp.set(r.opportunity_id, {
      project_code: r.project_code,
      opportunity_id: r.opportunity_id,
      opportunity_name: r.opportunity_name,
      funder_name: r.funder_name,
      deadline: r.deadline,
      days_to_deadline: days,
      fit_score: r.fit_score,
      max_grant_amount: r.max_grant_amount,
      source_url: r.source_url,
      application_url: r.application_url,
      has_decision,
      last_decision: decisionForPair?.decision ?? decisionForOpp?.decision ?? null,
    });
  }
  const urgent_grants = Array.from(urgentByOpp.values()).sort((a, b) => a.days_to_deadline - b.days_to_deadline).slice(0, 8);

  // Triage queue size (strong-fit undecided across the whole pool)
  // We approximate via decisions table: count distinct opp_ids with no decision
  // is expensive; use a quick heuristic from already-fetched data.
  // Better: a quick range query for strong-fit count.
  const { data: strongFitData } = await supabase
    .from('act_grant_recommendations')
    .select('opportunity_id')
    .eq('is_strong_fit', true)
    .or(`deadline.is.null,deadline.gte.${todayIso}`)
    .range(0, 9999);
  const strongFitIds = new Set((strongFitData ?? []).map((r) => r.opportunity_id));
  for (const d of allDecisions) strongFitIds.delete(d.opportunity_id);
  const triage_queue_size = strongFitIds.size;

  // Recent decisions: enrich with opportunity context
  const recentDecisions = (decisionsRecentRes.data ?? []) as Array<{
    project_code: string; opportunity_id: string; decision: string; decided_at: string; notes: string | null;
  }>;
  const recentOppIds = recentDecisions.map((d) => d.opportunity_id);
  const oppLookup = new Map<string, AlmaOpp>();
  if (recentOppIds.length > 0) {
    const { data: oppMeta } = await supabase
      .from('alma_funding_opportunities')
      .select('id, name, funder_name')
      .in('id', recentOppIds);
    for (const o of (oppMeta ?? []) as AlmaOpp[]) {
      oppLookup.set(o.id, o);
    }
  }
  const recent_decisions: TodayDecisionEvent[] = recentDecisions.map((d) => {
    const meta = oppLookup.get(d.opportunity_id);
    return {
      ...d,
      opportunity_name: meta?.name ?? null,
      funder_name: meta?.funder_name ?? null,
    };
  });

  // Warm foundations needing a nudge: paid > $1K AND no contact in 90+ days
  const income = (incomeRes.data ?? []) as Array<{
    funder_name: string; paid_total: number | string; last_paid_date: string | null; project_codes: string[] | null;
  }>;
  const context = (contextRes.data ?? []) as Array<{ funder_name: string; most_recent_contact_at: string | null }>;
  const lastTouchByFunder = new Map<string, string | null>();
  for (const c of context) {
    lastTouchByFunder.set(c.funder_name.toLowerCase(), c.most_recent_contact_at);
  }

  const warm_foundations: TodayWarmFoundation[] = [];
  for (const row of income) {
    const lastTouchIso = lastTouchByFunder.get(row.funder_name.toLowerCase()) ?? row.last_paid_date;
    const days = lastTouchIso
      ? Math.floor((today.getTime() - new Date(lastTouchIso).getTime()) / 86_400_000)
      : null;
    const paid = typeof row.paid_total === 'string' ? parseFloat(row.paid_total) : row.paid_total;
    let reason: TodayWarmFoundation['reason'] | null = null;
    if (days != null) {
      if (days >= 180) reason = 'cooling';
      else if (days >= 90 && paid >= 10_000) reason = 'overdue_contact';
      else if (days <= 30) reason = 'recent_win';
    }
    if (!reason) continue;
    warm_foundations.push({
      funder_name: row.funder_name,
      project_codes: row.project_codes ?? [],
      paid_total: paid,
      days_since_last_touch: days,
      reason,
    });
  }
  warm_foundations.sort((a, b) => {
    const order = { cooling: 0, overdue_contact: 1, recent_win: 2 };
    if (order[a.reason] !== order[b.reason]) return order[a.reason] - order[b.reason];
    return b.paid_total - a.paid_total;
  });
  const top_warm = warm_foundations.slice(0, 6);

  // Hot buyers
  const buyersRaw = (buyersRes.data ?? []) as Array<{
    buyer_name: string; contracts_last_6mo: number; total_relevant_spend: string | number;
    most_recent_contract: string | null; recent_contract_titles: string[] | null;
  }>;
  const hot_buyers: TodayHotBuyer[] = buyersRaw.map((b) => ({
    buyer_name: b.buyer_name,
    contracts_last_6mo: Number(b.contracts_last_6mo),
    total_relevant_spend: typeof b.total_relevant_spend === 'string' ? parseFloat(b.total_relevant_spend) : b.total_relevant_spend,
    most_recent_contract: b.most_recent_contract,
    recent_titles: (b.recent_contract_titles ?? []).slice(0, 2),
  }));

  return {
    asOf: today.toISOString(),
    urgent_grants,
    recent_decisions,
    warm_foundations: top_warm,
    hot_buyers,
    totals: {
      urgent_grant_count: urgent_grants.length,
      triage_queue_size,
      decisions_last_7d: recent_decisions.length,
      cooling_funder_count: warm_foundations.filter((f) => f.reason === 'cooling').length,
      hot_buyer_count: buyersRaw.length,
    },
  };
});
