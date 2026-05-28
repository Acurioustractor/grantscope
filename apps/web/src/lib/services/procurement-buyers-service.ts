import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';

export interface ProcurementBuyer {
  buyer_name: string;
  contract_count: number;
  total_relevant_spend: number;
  avg_contract_value: number;
  max_contract_value: number;
  most_recent_contract: string | null;
  contracts_last_year: number;
  contracts_last_6mo: number;
  avg_topic_score: number;
  top_categories: string | null;
  recent_contract_titles: string[] | null;
  /** Derived: rough fit_score for ACT — 0–100 */
  fit_score: number;
  /** Derived: heat indicator based on recent activity */
  heat: 'HOT' | 'WARM' | 'COOL' | 'COLD';
}

export interface ProcurementBuyersData {
  buyers: ProcurementBuyer[];
  totals: {
    buyer_count: number;
    total_spend: number;
    contracts_total: number;
    hot: number;
    warm: number;
    cool: number;
    cold: number;
  };
}

interface RawBuyerRow {
  buyer_name: string;
  contract_count: number;
  total_relevant_spend: string | number;
  avg_contract_value: string | number;
  max_contract_value: string | number;
  min_contract_value: string | number;
  most_recent_contract: string | null;
  contracts_last_year: number;
  contracts_last_6mo: number;
  avg_topic_score: string | number;
  top_categories: string | null;
  recent_contract_titles: string[] | null;
}

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function deriveFitScore(row: RawBuyerRow): number {
  // Composite: recency (40) + scale (30) + topic relevance (30)
  const recencyScore = Math.min(40, toNum(row.contracts_last_year) * 4);
  const spend = toNum(row.total_relevant_spend);
  const scaleScore = spend >= 10_000_000 ? 30 : spend >= 1_000_000 ? 25 : spend >= 250_000 ? 18 : spend >= 50_000 ? 10 : 5;
  const topicScore = Math.min(30, Math.round(toNum(row.avg_topic_score) * 15));
  return Math.min(100, recencyScore + scaleScore + topicScore);
}

function deriveHeat(row: RawBuyerRow): ProcurementBuyer['heat'] {
  const last6mo = toNum(row.contracts_last_6mo);
  const lastYear = toNum(row.contracts_last_year);
  if (last6mo >= 3) return 'HOT';
  if (lastYear >= 3) return 'WARM';
  if (lastYear >= 1) return 'COOL';
  return 'COLD';
}

export const getProcurementBuyersData = cache(async function getProcurementBuyersData(
  options: { limit?: number; minSpend?: number; heatFilter?: ProcurementBuyer['heat'] } = {},
): Promise<ProcurementBuyersData> {
  const limit = options.limit ?? 100;
  const minSpend = options.minSpend ?? 0;
  const supabase = getServiceSupabase();

  let query = supabase
    .from('v_act_procurement_buyers')
    .select(
      'buyer_name, contract_count, total_relevant_spend, avg_contract_value, max_contract_value, min_contract_value, most_recent_contract, contracts_last_year, contracts_last_6mo, avg_topic_score, top_categories, recent_contract_titles',
    )
    .order('total_relevant_spend', { ascending: false })
    .limit(limit);

  if (minSpend > 0) query = query.gte('total_relevant_spend', minSpend);

  const { data, error } = await query;
  if (error) {
    console.warn('[procurement-buyers] query error:', error.message);
    return {
      buyers: [],
      totals: { buyer_count: 0, total_spend: 0, contracts_total: 0, hot: 0, warm: 0, cool: 0, cold: 0 },
    };
  }

  const rows = (data ?? []) as RawBuyerRow[];
  let buyers: ProcurementBuyer[] = rows.map((row) => ({
    buyer_name: row.buyer_name,
    contract_count: toNum(row.contract_count),
    total_relevant_spend: toNum(row.total_relevant_spend),
    avg_contract_value: toNum(row.avg_contract_value),
    max_contract_value: toNum(row.max_contract_value),
    most_recent_contract: row.most_recent_contract,
    contracts_last_year: toNum(row.contracts_last_year),
    contracts_last_6mo: toNum(row.contracts_last_6mo),
    avg_topic_score: toNum(row.avg_topic_score),
    top_categories: row.top_categories,
    recent_contract_titles: row.recent_contract_titles,
    fit_score: deriveFitScore(row),
    heat: deriveHeat(row),
  }));

  if (options.heatFilter) {
    buyers = buyers.filter((b) => b.heat === options.heatFilter);
  }

  // Re-sort by fit_score (derived) then by recent activity
  buyers.sort((a, b) => {
    if (b.fit_score !== a.fit_score) return b.fit_score - a.fit_score;
    return b.contracts_last_year - a.contracts_last_year;
  });

  const totals = {
    buyer_count: buyers.length,
    total_spend: buyers.reduce((sum, b) => sum + b.total_relevant_spend, 0),
    contracts_total: buyers.reduce((sum, b) => sum + b.contract_count, 0),
    hot: buyers.filter((b) => b.heat === 'HOT').length,
    warm: buyers.filter((b) => b.heat === 'WARM').length,
    cool: buyers.filter((b) => b.heat === 'COOL').length,
    cold: buyers.filter((b) => b.heat === 'COLD').length,
  };

  return { buyers, totals };
});
