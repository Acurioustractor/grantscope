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

// ============================================================================
// Expense lens — mirror of income for outflows (ACCPAY)
// ============================================================================

export type PayeeCategory =
  | 'manufacturing'
  | 'supplies'
  | 'travel'
  | 'software'
  | 'people_contractors'
  | 'partner_orgs'
  | 'banking_fees'
  | 'utilities_property'
  | 'compliance'
  | 'other';

export interface ExpenseByPayeeRow {
  payee_name: string;
  payee_category: PayeeCategory;
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

export interface ExpenseByProjectRow {
  project_code: string;
  paid_invoice_count: number;
  paid_total: number;
  auth_total: number;
  draft_total: number;
  distinct_payees: number;
  first_paid_date: string | null;
  last_paid_date: string | null;
}

export interface ExpenseCategorySummary {
  category: PayeeCategory;
  payee_count: number;
  paid_total: number;
  auth_total: number;
}

export interface OrgExpenseData {
  byPayee: ExpenseByPayeeRow[];
  byProject: ExpenseByProjectRow[];
  byCategory: ExpenseCategorySummary[];
  totals: {
    paid_total: number;
    auth_total: number;
    draft_total: number;
    payee_count: number;
    paid_invoice_count: number;
    outstanding_count: number;
  };
}

export const getOrgExpenseHistory = cache(async function getOrgExpenseHistory(
  slug: string,
): Promise<OrgExpenseData | null> {
  if (!isActSlug(slug)) return null;

  const supabase = getServiceSupabase();

  const [payeeRes, projectRes] = await Promise.all([
    supabase
      .from('v_act_expense_by_payee')
      .select('*')
      .order('paid_total', { ascending: false, nullsFirst: false }),
    supabase
      .from('v_act_expense_by_project')
      .select('*')
      .order('paid_total', { ascending: false, nullsFirst: false }),
  ]);

  const byPayee = (payeeRes.data ?? []).map(normalisePayee);
  const byProject = (projectRes.data ?? []).map(normaliseExpenseProject);

  const byCategoryMap = new Map<PayeeCategory, ExpenseCategorySummary>();
  for (const row of byPayee) {
    const existing = byCategoryMap.get(row.payee_category) ?? {
      category: row.payee_category,
      payee_count: 0,
      paid_total: 0,
      auth_total: 0,
    };
    existing.payee_count += 1;
    existing.paid_total += row.paid_total;
    existing.auth_total += row.auth_total;
    byCategoryMap.set(row.payee_category, existing);
  }
  const byCategory = Array.from(byCategoryMap.values()).sort(
    (a, b) => b.paid_total - a.paid_total,
  );

  const totals = byPayee.reduce(
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
      payee_count: byPayee.length,
      paid_invoice_count: 0,
      outstanding_count: 0,
    },
  );

  return { byPayee, byProject, byCategory, totals };
});

function normalisePayee(row: Record<string, unknown>): ExpenseByPayeeRow {
  return {
    payee_name: String(row.payee_name ?? ''),
    payee_category: (row.payee_category ?? 'other') as PayeeCategory,
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

function normaliseExpenseProject(row: Record<string, unknown>): ExpenseByProjectRow {
  return {
    project_code: String(row.project_code ?? ''),
    paid_invoice_count: Number(row.paid_invoice_count ?? 0),
    paid_total: Number(row.paid_total ?? 0),
    auth_total: Number(row.auth_total ?? 0),
    draft_total: Number(row.draft_total ?? 0),
    distinct_payees: Number(row.distinct_payees ?? 0),
    first_paid_date: (row.first_paid_date as string | null) ?? null,
    last_paid_date: (row.last_paid_date as string | null) ?? null,
  };
}

export const PAYEE_CATEGORY_LABELS: Record<PayeeCategory, string> = {
  manufacturing: 'Manufacturing',
  supplies: 'Supplies',
  travel: 'Travel',
  software: 'Software',
  people_contractors: 'People / contractors',
  partner_orgs: 'Partner orgs',
  banking_fees: 'Banking / fees',
  utilities_property: 'Utilities / property',
  compliance: 'Compliance',
  other: 'Other',
};

export const PAYEE_CATEGORY_COLORS: Record<PayeeCategory, string> = {
  manufacturing: 'bg-bauhaus-blue text-white',
  supplies: 'bg-bauhaus-yellow text-bauhaus-black',
  travel: 'bg-purple-600 text-white',
  software: 'bg-gray-700 text-white',
  people_contractors: 'bg-bauhaus-red text-white',
  partner_orgs: 'bg-green-600 text-white',
  banking_fees: 'bg-gray-500 text-white',
  utilities_property: 'bg-gray-400 text-white',
  compliance: 'bg-gray-300 text-bauhaus-black',
  other: 'bg-gray-200 text-bauhaus-black',
};

// ============================================================================
// Financial pulse — single-row cash + runway snapshot for the top of /org/act
// ============================================================================

export interface OrgFinancialPulse {
  cash_total: number;
  account_count: number;
  last_balance_sync: string | null;
  burn_30d: number;
  burn_90d: number;
  monthly_burn_avg: number;
  income_30d: number;
  income_90d: number;
  monthly_income_avg: number;
  net_30d: number;
  monthly_net_avg: number;
  runway_months: number | null;
  ar_total: number;
  ar_count: number;
  ar_overdue_60d: number;
  ar_overdue_60d_count: number;
  ap_total: number;
  ap_count: number;
  ap_overdue_60d: number;
  ap_overdue_60d_count: number;
  working_capital: number;
  computed_at: string;
}

export const getOrgFinancialPulse = cache(async function getOrgFinancialPulse(
  slug: string,
): Promise<OrgFinancialPulse | null> {
  if (!isActSlug(slug)) return null;
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('v_act_financial_pulse')
    .select('*')
    .maybeSingle();
  if (error || !data) return null;
  return {
    cash_total: Number(data.cash_total ?? 0),
    account_count: Number(data.account_count ?? 0),
    last_balance_sync: (data.last_balance_sync as string | null) ?? null,
    burn_30d: Number(data.burn_30d ?? 0),
    burn_90d: Number(data.burn_90d ?? 0),
    monthly_burn_avg: Number(data.monthly_burn_avg ?? 0),
    income_30d: Number(data.income_30d ?? 0),
    income_90d: Number(data.income_90d ?? 0),
    monthly_income_avg: Number(data.monthly_income_avg ?? 0),
    net_30d: Number(data.net_30d ?? 0),
    monthly_net_avg: Number(data.monthly_net_avg ?? 0),
    runway_months: data.runway_months == null ? null : Number(data.runway_months),
    ar_total: Number(data.ar_total ?? 0),
    ar_count: Number(data.ar_count ?? 0),
    ar_overdue_60d: Number(data.ar_overdue_60d ?? 0),
    ar_overdue_60d_count: Number(data.ar_overdue_60d_count ?? 0),
    ap_total: Number(data.ap_total ?? 0),
    ap_count: Number(data.ap_count ?? 0),
    ap_overdue_60d: Number(data.ap_overdue_60d ?? 0),
    ap_overdue_60d_count: Number(data.ap_overdue_60d_count ?? 0),
    working_capital: Number(data.working_capital ?? 0),
    computed_at: String(data.computed_at ?? new Date().toISOString()),
  };
});
