import { getServiceSupabase } from '@/lib/supabase';

export type GoodsInvoiceMoneyRow = {
  group: string;
  name: string;
  amount: string;
  status: string;
  owner: string;
  next: string;
  sourceSystem: 'xero';
  invoiceNumber: string;
  contact: string;
  issueDate: string;
  dueDate: string;
  paidDate: string;
  amountDue: string;
  amountPaid: string;
  direction: 'income';
  source: string;
};

export type GoodsFinanceSource = {
  label: string;
  status: 'live' | 'empty' | 'error';
  detail: string;
};

export type GoodsFinanceLedger = {
  moneyRows: GoodsInvoiceMoneyRow[];
  totals: Array<{ label: string; value: string; detail?: string }>;
  source: GoodsFinanceSource;
};

type XeroInvoiceRow = {
  id: string;
  invoice_number: string | null;
  contact_name: string | null;
  status: string | null;
  date: string | null;
  due_date: string | null;
  total: number | string | null;
  amount_due: number | string | null;
  amount_paid: number | string | null;
  fully_paid_date: string | null;
  income_type: string | null;
  reference: string | null;
  synced_at: string | null;
};

type MonthlyFinancialRow = {
  month: string | null;
  fy_ytd_revenue: number | string | null;
  fy_ytd_expenses: number | string | null;
  fy_ytd_net: number | string | null;
};

const PROJECT_CODE = 'ACT-GD';
const PROJECT_LABEL = 'Goods';
const STATUS_ORDER: Record<string, number> = {
  DRAFT: 1,
  SUBMITTED: 2,
  SENT: 3,
  AUTHORISED: 4,
  PAID: 5,
};

function money(value: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  if (Math.abs(value) >= 1000) return `$${Math.round(value / 1000)}K`;
  return money(value);
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'not synced';
  return value;
}

function daysFromToday(date: string | null | undefined) {
  if (!date) return null;
  const due = new Date(`${date}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function invoiceGroup(status: string, amountDue: number, amountPaid: number) {
  if (status === 'DRAFT') return 'draft';
  if (status === 'SUBMITTED' || status === 'SENT') return 'sent';
  if (status === 'PAID' || (amountPaid > 0 && amountDue === 0)) return 'paid';
  if (status === 'AUTHORISED') return 'authorised';
  return 'check';
}

function invoiceStatus(row: XeroInvoiceRow) {
  const status = (row.status || 'DRAFT').toUpperCase();
  const amountDue = toNumber(row.amount_due);
  const amountPaid = toNumber(row.amount_paid);
  if (status === 'PAID' || (amountPaid > 0 && amountDue === 0)) return 'paid in Xero';
  if (status === 'DRAFT') return 'draft';
  if (status === 'SUBMITTED' || status === 'SENT') return 'sent';
  if (status === 'AUTHORISED') {
    const overdue = daysFromToday(row.due_date);
    return overdue && overdue > 0 ? `authorised ${overdue}d` : 'authorised';
  }
  return status.toLowerCase();
}

function invoiceNext(row: XeroInvoiceRow) {
  const status = (row.status || 'DRAFT').toUpperCase();
  const amountDue = toNumber(row.amount_due);
  const amountPaid = toNumber(row.amount_paid);
  const paidDate = dateLabel(row.fully_paid_date);
  if (status === 'PAID' || (amountPaid > 0 && amountDue === 0)) {
    return `Paid ${money(amountPaid || toNumber(row.total))}. Paid date: ${paidDate}.`;
  }
  if (status === 'DRAFT') {
    return toNumber(row.total) === 0
      ? 'Zero-dollar draft. Void, fix, or leave out of the money story.'
      : 'Draft only. Send, void, or reissue before chasing.';
  }
  if (status === 'AUTHORISED') {
    const overdue = daysFromToday(row.due_date);
    return overdue && overdue > 0
      ? `Still due ${money(amountDue)}. ${overdue} days overdue. Chase, confirm paid, or write off.`
      : `Still due ${money(amountDue)}. Confirm paid or chase.`;
  }
  return `Check Xero status ${status}.`;
}

function invoiceName(row: XeroInvoiceRow) {
  const number = row.invoice_number || 'No invoice number';
  const contact = row.contact_name || 'Unknown contact';
  return `${number} · ${contact}`;
}

function invoiceOwner(row: XeroInvoiceRow) {
  const contact = (row.contact_name || '').toLowerCase();
  if (contact.includes('snow') || contact.includes('centrecorp') || contact.includes('rotary')) return 'Ben';
  if (contact.includes('ingkerreke') || contact.includes('julalikari') || contact.includes('malala') || contact.includes('shed')) return 'Goods / ACT';
  return PROJECT_LABEL;
}

function rowFromInvoice(row: XeroInvoiceRow): GoodsInvoiceMoneyRow {
  const status = (row.status || 'DRAFT').toUpperCase();
  const amountDue = toNumber(row.amount_due);
  const amountPaid = toNumber(row.amount_paid);
  const total = toNumber(row.total);
  const group = invoiceGroup(status, amountDue, amountPaid);
  const invoiceNumber = row.invoice_number || 'missing';
  const contact = row.contact_name || 'Unknown contact';

  return {
    group,
    name: invoiceName(row),
    amount: money(total),
    status: invoiceStatus(row),
    owner: invoiceOwner(row),
    next: invoiceNext(row),
    sourceSystem: 'xero',
    invoiceNumber,
    contact,
    issueDate: dateLabel(row.date),
    dueDate: dateLabel(row.due_date),
    paidDate: dateLabel(row.fully_paid_date),
    amountDue: money(amountDue),
    amountPaid: money(amountPaid),
    direction: 'income',
    source: row.income_type || row.reference || 'Xero ACT-GD income invoice',
  };
}

function defaultTotals(source: GoodsFinanceSource): GoodsFinanceLedger {
  return {
    moneyRows: [],
    totals: [
      { label: 'Paid invoices', value: '$0', detail: 'No Xero rows loaded.' },
      { label: 'Due / chase', value: '$0', detail: 'No authorised receivables loaded.' },
      { label: 'Draft / fix', value: '$0', detail: 'No draft invoices loaded.' },
      { label: 'Invoice rows', value: '0', detail: source.detail },
    ],
    source,
  };
}

export async function getGoodsFinanceLedger(): Promise<GoodsFinanceLedger> {
  const supabase = getServiceSupabase();

  try {
    const [invoiceResult, monthlyResult] = await Promise.all([
      supabase
        .from('xero_invoices')
        .select('id, invoice_number, contact_name, status, date, due_date, total, amount_due, amount_paid, fully_paid_date, income_type, reference, synced_at')
        .eq('project_code', PROJECT_CODE)
        .eq('type', 'ACCREC')
        .not('status', 'in', '(DELETED,VOIDED)')
        .order('date', { ascending: false }),
      supabase
        .from('project_monthly_financials')
        .select('month, fy_ytd_revenue, fy_ytd_expenses, fy_ytd_net')
        .eq('project_code', PROJECT_CODE)
        .order('month', { ascending: false })
        .limit(1),
    ]);

    if (invoiceResult.error) {
      return defaultTotals({
        label: 'Xero invoices',
        status: 'error',
        detail: invoiceResult.error.message,
      });
    }

    const invoices = ((invoiceResult.data || []) as XeroInvoiceRow[]).sort((a, b) => {
      const as = STATUS_ORDER[(a.status || '').toUpperCase()] ?? 9;
      const bs = STATUS_ORDER[(b.status || '').toUpperCase()] ?? 9;
      if (as !== bs) return as - bs;
      return toNumber(b.total) - toNumber(a.total);
    });

    if (invoices.length === 0) {
      return defaultTotals({
        label: 'Xero invoices',
        status: 'empty',
        detail: `No ${PROJECT_CODE} income invoices are currently available in xero_invoices.`,
      });
    }

    const paidTotal = invoices.reduce((sum, row) => sum + toNumber(row.amount_paid), 0);
    const dueTotal = invoices.reduce((sum, row) => sum + toNumber(row.amount_due), 0);
    const draftTotal = invoices
      .filter((row) => (row.status || '').toUpperCase() === 'DRAFT')
      .reduce((sum, row) => sum + toNumber(row.total), 0);
    const latestSync = invoices
      .map((row) => row.synced_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    const monthly = ((monthlyResult.data || []) as MonthlyFinancialRow[])[0];

    const totals = [
      {
        label: 'Paid invoices',
        value: compactMoney(paidTotal),
        detail: `${invoices.filter((row) => (row.status || '').toUpperCase() === 'PAID').length} ACT-GD income invoices marked paid in Xero.`,
      },
      {
        label: 'Due / chase',
        value: compactMoney(dueTotal),
        detail: `${invoices.filter((row) => toNumber(row.amount_due) > 0).length} income invoices still showing amount due.`,
      },
      {
        label: 'Draft / fix',
        value: compactMoney(draftTotal),
        detail: `${invoices.filter((row) => (row.status || '').toUpperCase() === 'DRAFT').length} draft income invoices. Not chaseable until sent.`,
      },
      {
        label: 'Invoice rows',
        value: String(invoices.length),
        detail: `ACT-GD ACCREC rows. Last Xero sync: ${latestSync ? latestSync.slice(0, 10) : 'not synced'}.`,
      },
      {
        label: 'FY26 revenue',
        value: compactMoney(toNumber(monthly?.fy_ytd_revenue)),
        detail: monthly?.month ? `Project monthly ledger as at ${monthly.month.slice(0, 10)}.` : 'No monthly ledger row loaded.',
      },
      {
        label: 'FY26 spend',
        value: compactMoney(toNumber(monthly?.fy_ytd_expenses)),
        detail: monthly?.month ? `Xero-backed ACT-GD expense allocation as at ${monthly.month.slice(0, 10)}.` : 'No monthly ledger row loaded.',
      },
      {
        label: 'FY26 net',
        value: compactMoney(toNumber(monthly?.fy_ytd_net)),
        detail: 'Revenue minus expenses in project_monthly_financials.',
      },
      {
        label: 'Project code',
        value: PROJECT_CODE,
        detail: 'Only real Xero income invoices tagged to Goods are shown in the invoice ledger.',
      },
    ];

    return {
      moneyRows: invoices.map(rowFromInvoice),
      totals,
      source: {
        label: 'Xero invoices',
        status: 'live',
        detail: `${invoices.length} real ${PROJECT_CODE} income invoices loaded from xero_invoices. Paid dates show only when Xero sync has fully_paid_date.`,
      },
    };
  } catch (error) {
    return defaultTotals({
      label: 'Xero invoices',
      status: 'error',
      detail: error instanceof Error ? error.message : 'Unknown Xero ledger load error.',
    });
  }
}
