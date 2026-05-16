import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';

export interface ReceivableInvoice {
  invoice_id: string;
  invoice_number: string | null;
  status: 'AUTHORISED' | 'DRAFT';
  amount_due: number;
  total: number;
  invoice_date: string | null;
  due_date: string | null;
  days_old: number;
  days_overdue: number;
  project_code: string | null;
}

export interface ReceivablePayer {
  payer_name: string;
  invoice_count: number;
  total_due: number;
  oldest_days_old: number;
  oldest_days_overdue: number;
  has_draft: boolean;
  draft_total: number;
  authorised_total: number;
  project_codes: string[];
  /** True if 5+ small invoices that look like recurring billing reconciliation lag */
  is_recurring_pattern: boolean;
  invoices: ReceivableInvoice[];
}

export interface OutstandingReceivablesData {
  payers: ReceivablePayer[];
  totals: {
    payer_count: number;
    invoice_count: number;
    total_due: number;
    draft_total: number;
    authorised_total: number;
    overdue_30d: number;
    overdue_90d: number;
    overdue_180d: number;
  };
  computed_at: string;
}

function daysBetween(from: string | null, to: Date): number {
  if (!from) return 0;
  const d = new Date(from);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((to.getTime() - d.getTime()) / 86_400_000);
}

export const getOrgOutstandingReceivables = cache(async function getOrgOutstandingReceivables(
  slug: string,
): Promise<OutstandingReceivablesData | null> {
  if (!isActSlug(slug)) return null;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('xero_invoices')
    .select('id, invoice_number, status, total, amount_due, date, due_date, contact_name, project_code')
    .eq('type', 'ACCREC')
    .in('status', ['AUTHORISED', 'DRAFT'])
    .gt('amount_due', 0)
    .order('amount_due', { ascending: false })
    .range(0, 999);

  if (error || !data) return null;

  const now = new Date();
  const byPayer = new Map<string, ReceivablePayer>();

  for (const row of data) {
    const payer = String(row.contact_name ?? 'Unknown payer').trim();
    const invoice: ReceivableInvoice = {
      invoice_id: String(row.id),
      invoice_number: (row.invoice_number as string | null) ?? null,
      status: row.status as 'AUTHORISED' | 'DRAFT',
      amount_due: Number(row.amount_due ?? 0),
      total: Number(row.total ?? 0),
      invoice_date: (row.date as string | null) ?? null,
      due_date: (row.due_date as string | null) ?? null,
      days_old: daysBetween(row.date as string | null, now),
      days_overdue: daysBetween(row.due_date as string | null, now),
      project_code: (row.project_code as string | null) ?? null,
    };

    const existing = byPayer.get(payer);
    if (existing) {
      existing.invoices.push(invoice);
      existing.invoice_count += 1;
      existing.total_due += invoice.amount_due;
      existing.oldest_days_old = Math.max(existing.oldest_days_old, invoice.days_old);
      existing.oldest_days_overdue = Math.max(existing.oldest_days_overdue, invoice.days_overdue);
      if (invoice.status === 'DRAFT') {
        existing.has_draft = true;
        existing.draft_total += invoice.amount_due;
      } else {
        existing.authorised_total += invoice.amount_due;
      }
      if (invoice.project_code && !existing.project_codes.includes(invoice.project_code)) {
        existing.project_codes.push(invoice.project_code);
      }
    } else {
      byPayer.set(payer, {
        payer_name: payer,
        invoice_count: 1,
        total_due: invoice.amount_due,
        oldest_days_old: invoice.days_old,
        oldest_days_overdue: invoice.days_overdue,
        has_draft: invoice.status === 'DRAFT',
        draft_total: invoice.status === 'DRAFT' ? invoice.amount_due : 0,
        authorised_total: invoice.status === 'AUTHORISED' ? invoice.amount_due : 0,
        project_codes: invoice.project_code ? [invoice.project_code] : [],
        is_recurring_pattern: false,
        invoices: [invoice],
      });
    }
  }

  // Flag recurring patterns: 5+ invoices, all same amount within $10 of each other, avg < $1000
  for (const payer of byPayer.values()) {
    if (payer.invoice_count >= 5) {
      const amounts = payer.invoices.map((i) => i.amount_due);
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);
      const avg = payer.total_due / payer.invoice_count;
      if (max - min < 10 && avg < 1000) {
        payer.is_recurring_pattern = true;
      }
    }
    // Sort each payer's invoices oldest first (chase oldest)
    payer.invoices.sort((a, b) => b.days_overdue - a.days_overdue);
  }

  const payers = Array.from(byPayer.values()).sort((a, b) => b.total_due - a.total_due);

  const totals = payers.reduce(
    (acc, p) => {
      acc.payer_count += 1;
      acc.invoice_count += p.invoice_count;
      acc.total_due += p.total_due;
      acc.draft_total += p.draft_total;
      acc.authorised_total += p.authorised_total;
      for (const inv of p.invoices) {
        if (inv.days_overdue >= 30) acc.overdue_30d += inv.amount_due;
        if (inv.days_overdue >= 90) acc.overdue_90d += inv.amount_due;
        if (inv.days_overdue >= 180) acc.overdue_180d += inv.amount_due;
      }
      return acc;
    },
    {
      payer_count: 0,
      invoice_count: 0,
      total_due: 0,
      draft_total: 0,
      authorised_total: 0,
      overdue_30d: 0,
      overdue_90d: 0,
      overdue_180d: 0,
    },
  );

  return {
    payers,
    totals,
    computed_at: now.toISOString(),
  };
});
