import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';
import type { PayeeCategory } from '@/lib/services/org-income-service';

export type PayableDecision =
  | 'undecided'
  | 'pay_now'
  | 'scheduled'
  | 'dispute'
  | 'write_off'
  | 'chase_supplier'
  | 'paid';

export const PAYABLE_DECISION_COLUMNS: PayableDecision[] = [
  'undecided',
  'pay_now',
  'scheduled',
  'chase_supplier',
  'dispute',
  'write_off',
  'paid',
];

export type AgeBucket =
  | 'this_week'
  | 'within_30d'
  | '30_to_60d'
  | '60_to_90d'
  | '90_to_180d'
  | 'over_180d';

export const AGE_BUCKET_ORDER: AgeBucket[] = [
  'this_week',
  'within_30d',
  '30_to_60d',
  '60_to_90d',
  '90_to_180d',
  'over_180d',
];

export interface PayableCard {
  key: string;
  invoice_id: string;
  invoice_number: string | null;
  payee_name: string;
  payee_category: PayeeCategory;
  project_code: string | null;
  invoice_date: string;
  due_date: string | null;
  total: number;
  amount_due: number;
  days_old: number;
  age_bucket: AgeBucket;
  reference: string | null;
  decision: PayableDecision;
  decided_at: string | null;
  notes: string | null;
}

export interface OrgPayablesData {
  cards: PayableCard[];
  totals: {
    total: number;
    bill_count: number;
    decided_count: number;
    overdue_60d_count: number;
    overdue_60d_total: number;
  };
}

interface RawPayableRow {
  invoice_id: string;
  invoice_number: string | null;
  payee_name: string;
  payee_category: string;
  project_code: string | null;
  invoice_date: string;
  due_date: string | null;
  total: number;
  amount_due: number;
  days_old: number;
  age_bucket: string;
  reference: string | null;
}

interface RawPayableDecision {
  invoice_id: string;
  decision: string;
  decided_at: string;
  notes: string | null;
}

function isPayableDecision(s: string): s is PayableDecision {
  return PAYABLE_DECISION_COLUMNS.includes(s as PayableDecision);
}

function isAgeBucket(s: string): s is AgeBucket {
  return AGE_BUCKET_ORDER.includes(s as AgeBucket);
}

export const getOrgPayablesTriage = cache(async function getOrgPayablesTriage(
  slug: string,
): Promise<OrgPayablesData | null> {
  if (!isActSlug(slug)) return null;
  const supabase = getServiceSupabase();

  const [billsRes, decisionsRes] = await Promise.all([
    supabase
      .from('v_act_payables_triage')
      .select('*')
      .order('days_old', { ascending: false }),
    supabase
      .from('act_payable_decisions')
      .select('invoice_id, decision, decided_at, notes'),
  ]);

  const bills = (billsRes.data ?? []) as RawPayableRow[];
  const decisions = (decisionsRes.data ?? []) as RawPayableDecision[];
  const decisionByInvoice = new Map<string, RawPayableDecision>();
  for (const d of decisions) decisionByInvoice.set(d.invoice_id, d);

  const cards: PayableCard[] = bills.map((b) => {
    const d = decisionByInvoice.get(b.invoice_id);
    const decision: PayableDecision = d && isPayableDecision(d.decision) ? d.decision : 'undecided';
    const bucket: AgeBucket = isAgeBucket(b.age_bucket) ? b.age_bucket : 'over_180d';
    return {
      key: b.invoice_id,
      invoice_id: b.invoice_id,
      invoice_number: b.invoice_number,
      payee_name: b.payee_name,
      payee_category: (b.payee_category ?? 'other') as PayeeCategory,
      project_code: b.project_code,
      invoice_date: b.invoice_date,
      due_date: b.due_date,
      total: Number(b.total ?? 0),
      amount_due: Number(b.amount_due ?? 0),
      days_old: Number(b.days_old ?? 0),
      age_bucket: bucket,
      reference: b.reference,
      decision,
      decided_at: d?.decided_at ?? null,
      notes: d?.notes ?? null,
    };
  });

  const totals = cards.reduce(
    (acc, c) => {
      acc.total += c.total;
      acc.bill_count += 1;
      if (c.decision !== 'undecided') acc.decided_count += 1;
      if (c.days_old >= 60) {
        acc.overdue_60d_count += 1;
        acc.overdue_60d_total += c.total;
      }
      return acc;
    },
    { total: 0, bill_count: 0, decided_count: 0, overdue_60d_count: 0, overdue_60d_total: 0 },
  );

  return { cards, totals };
});

export const DECISION_LABELS: Record<PayableDecision, string> = {
  undecided: 'Undecided',
  pay_now: 'Pay now',
  scheduled: 'Scheduled',
  chase_supplier: 'Chase supplier',
  dispute: 'Dispute',
  write_off: 'Write off',
  paid: 'Paid',
};

export const DECISION_COLORS: Record<PayableDecision, string> = {
  undecided: 'bg-bauhaus-black text-white',
  pay_now: 'bg-bauhaus-red text-white',
  scheduled: 'bg-bauhaus-blue text-white',
  chase_supplier: 'bg-bauhaus-yellow text-bauhaus-black',
  dispute: 'bg-purple-600 text-white',
  write_off: 'bg-gray-400 text-white',
  paid: 'bg-green-600 text-white',
};

export const AGE_BUCKET_LABELS: Record<AgeBucket, string> = {
  this_week: 'This week',
  within_30d: '< 30 days',
  '30_to_60d': '30–60 days',
  '60_to_90d': '60–90 days',
  '90_to_180d': '90–180 days',
  over_180d: 'Over 180 days',
};

export const AGE_BUCKET_COLORS: Record<AgeBucket, string> = {
  this_week: 'bg-bauhaus-canvas text-bauhaus-black',
  within_30d: 'bg-gray-200 text-bauhaus-black',
  '30_to_60d': 'bg-bauhaus-yellow text-bauhaus-black',
  '60_to_90d': 'bg-bauhaus-yellow text-bauhaus-black',
  '90_to_180d': 'bg-bauhaus-red text-white',
  over_180d: 'bg-bauhaus-red text-white',
};
