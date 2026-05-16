import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';

export type FunderCategory =
  | 'philanthropic'
  | 'community_controlled'
  | 'government'
  | 'commercial'
  | 'civil_society'
  | 'other';

export interface IncomeByFunderRow {
  funder_name: string;
  funder_category: FunderCategory;
  relationship_score: number | null;
  paid_invoice_count: number;
  auth_invoice_count: number;
  draft_invoice_count: number;
  paid_total: number;
  auth_total: number;
  draft_total: number;
  first_paid_date: string | null;
  last_paid_date: string | null;
  project_codes: string[] | null;
  longest_outstanding_days: number | null;
}

export interface IncomeByProjectRow {
  project_code: string;
  paid_invoice_count: number;
  paid_total: number;
  auth_total: number;
  draft_total: number;
  distinct_funders: number;
  first_paid_date: string | null;
  last_paid_date: string | null;
}

export interface IncomeCategorySummary {
  category: FunderCategory;
  funder_count: number;
  paid_total: number;
  auth_total: number;
}

export interface OrgIncomeData {
  byFunder: IncomeByFunderRow[];
  byProject: IncomeByProjectRow[];
  byCategory: IncomeCategorySummary[];
  totals: {
    paid_total: number;
    auth_total: number;
    draft_total: number;
    funder_count: number;
    paid_invoice_count: number;
    outstanding_count: number;
  };
}

/**
 * Lifetime income lens for an org. Currently sole-trader Xero (Nicholas
 * Marchesi) is the only book of business in `xero_invoices` — the Pty Ltd
 * (ABN PENDING) hasn't invoiced yet. So this resolves only for ACT slugs.
 *
 * Reads from views v_act_income_by_funder + v_act_income_by_project
 * (migration 20260516000020). Those views handle the funder-context join
 * and the funder_category derivation.
 */
export const getOrgIncomeHistory = cache(async function getOrgIncomeHistory(
  slug: string,
): Promise<OrgIncomeData | null> {
  if (!isActSlug(slug)) return null;

  const supabase = getServiceSupabase();

  const [funderRes, projectRes] = await Promise.all([
    supabase
      .from('v_act_income_by_funder')
      .select('*')
      .order('paid_total', { ascending: false, nullsFirst: false }),
    supabase
      .from('v_act_income_by_project')
      .select('*')
      .order('paid_total', { ascending: false, nullsFirst: false }),
  ]);

  const byFunder = (funderRes.data ?? []).map(normaliseFunder);
  const byProject = (projectRes.data ?? []).map(normaliseProject);

  const byCategoryMap = new Map<FunderCategory, IncomeCategorySummary>();
  for (const row of byFunder) {
    const existing = byCategoryMap.get(row.funder_category) ?? {
      category: row.funder_category,
      funder_count: 0,
      paid_total: 0,
      auth_total: 0,
    };
    existing.funder_count += 1;
    existing.paid_total += row.paid_total;
    existing.auth_total += row.auth_total;
    byCategoryMap.set(row.funder_category, existing);
  }
  const byCategory = Array.from(byCategoryMap.values()).sort(
    (a, b) => b.paid_total - a.paid_total,
  );

  const totals = byFunder.reduce(
    (acc, row) => {
      acc.paid_total += row.paid_total;
      acc.auth_total += row.auth_total;
      acc.draft_total += row.draft_total;
      acc.paid_invoice_count += row.paid_invoice_count;
      acc.outstanding_count += row.auth_invoice_count + row.draft_invoice_count;
      return acc;
    },
    {
      paid_total: 0,
      auth_total: 0,
      draft_total: 0,
      funder_count: byFunder.length,
      paid_invoice_count: 0,
      outstanding_count: 0,
    },
  );

  return { byFunder, byProject, byCategory, totals };
});

function normaliseFunder(row: Record<string, unknown>): IncomeByFunderRow {
  return {
    funder_name: String(row.funder_name ?? ''),
    funder_category: (row.funder_category ?? 'other') as FunderCategory,
    relationship_score:
      row.relationship_score == null ? null : Number(row.relationship_score),
    paid_invoice_count: Number(row.paid_invoice_count ?? 0),
    auth_invoice_count: Number(row.auth_invoice_count ?? 0),
    draft_invoice_count: Number(row.draft_invoice_count ?? 0),
    paid_total: Number(row.paid_total ?? 0),
    auth_total: Number(row.auth_total ?? 0),
    draft_total: Number(row.draft_total ?? 0),
    first_paid_date: (row.first_paid_date as string | null) ?? null,
    last_paid_date: (row.last_paid_date as string | null) ?? null,
    project_codes: (row.project_codes as string[] | null) ?? null,
    longest_outstanding_days:
      row.longest_outstanding_days == null
        ? null
        : Number(row.longest_outstanding_days),
  };
}

function normaliseProject(row: Record<string, unknown>): IncomeByProjectRow {
  return {
    project_code: String(row.project_code ?? ''),
    paid_invoice_count: Number(row.paid_invoice_count ?? 0),
    paid_total: Number(row.paid_total ?? 0),
    auth_total: Number(row.auth_total ?? 0),
    draft_total: Number(row.draft_total ?? 0),
    distinct_funders: Number(row.distinct_funders ?? 0),
    first_paid_date: (row.first_paid_date as string | null) ?? null,
    last_paid_date: (row.last_paid_date as string | null) ?? null,
  };
}

export const CATEGORY_LABELS: Record<FunderCategory, string> = {
  philanthropic: 'Philanthropic',
  community_controlled: 'Community-controlled',
  government: 'Government',
  commercial: 'Commercial',
  civil_society: 'Civil society',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<FunderCategory, string> = {
  philanthropic: 'bg-bauhaus-blue text-white',
  community_controlled: 'bg-bauhaus-red text-white',
  government: 'bg-gray-700 text-white',
  commercial: 'bg-bauhaus-yellow text-bauhaus-black',
  civil_society: 'bg-green-600 text-white',
  other: 'bg-gray-300 text-bauhaus-black',
};
