import { cache } from 'react';
import { existsSync } from 'node:fs';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';

type SyncStatus = 'verified' | 'partial' | 'blocked';

export interface XeroMirrorStatus {
  status: SyncStatus;
  apiConfigured: boolean;
  externalSyncConfigured: boolean;
  externalSyncPath: string | null;
  latestSyncCompletedAt: string | null;
  latestSyncStatus: string | null;
  latestRecordsSynced: number;
  latestRecordsFailed: number;
  invoiceSyncedAt: string | null;
  transactionSyncedAt: string | null;
  bankTransactionSyncedAt: string | null;
  bankBalanceSyncedAt: string | null;
  accrecAuthorisedSyncedAt: string | null;
  accpayAuthorisedSyncedAt: string | null;
  note: string;
}

export interface PayablesReconciliationStatus {
  status: SyncStatus;
  proofSource: 'xero_payments';
  totalBills: number;
  totalAuthorised: number;
  exactBankRecMatchCount: number;
  exactBankRecMatchTotal: number;
  unresolvedBillCount: number;
  unresolvedTotal: number;
  latestTransactionSyncAt: string | null;
  latestPaymentSyncAt: string | null;
  note: string;
}

export interface MailboxCrmStatus {
  status: SyncStatus;
  latestExtractAt: string;
  latestConnectorCheckAt: string;
  mailbox: string;
  funderOrgsReviewed: number;
  buyerInvestorOrgsReviewed: number;
  currentCandidateMessages: string;
  currentSignalSummary: string;
  limitation: string;
  sourcePaths: string[];
}

export interface OrgVerificationStatus {
  xero: XeroMirrorStatus;
  payables: PayablesReconciliationStatus;
  mailbox: MailboxCrmStatus;
}

interface XeroSyncRow {
  status: string | null;
  completed_at: string | null;
  started_at: string | null;
  records_synced: number | null;
  records_failed: number | null;
}

interface XeroInvoiceFreshnessRow {
  synced_at: string | null;
}

interface BankTransactionRow {
  synced_at: string | null;
}

interface BankAccountRow {
  balance_updated_at: string | null;
}

interface PayablesProofAggregateRow {
  total_bills: number | string | null;
  total_authorised: number | string | null;
  exact_match_count: number | string | null;
  exact_match_total: number | string | null;
  payment_count: number | string | null;
  latest_payment_sync_at: string | null;
}

const DEFAULT_ACT_GLOBAL_INFRA_DIR = '/Users/benknight/Code/act-global-infrastructure';

function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function latestIso(rows: Array<{ synced_at?: string | null; balance_updated_at?: string | null }>, key: 'synced_at' | 'balance_updated_at'): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    const value = row[key] ?? null;
    if (!value) continue;
    if (!latest || new Date(value).getTime() > new Date(latest).getTime()) latest = value;
  }
  return latest;
}

function hasXeroApiEnv(): boolean {
  return Boolean(
    process.env.XERO_CLIENT_ID
      && process.env.XERO_CLIENT_SECRET
      && (process.env.XERO_REFRESH_TOKEN || process.env.XERO_TOKEN_SET),
  );
}

function externalXeroSyncPath(): string | null {
  const actDir = process.env.ACT_GLOBAL_INFRA_DIR || DEFAULT_ACT_GLOBAL_INFRA_DIR;
  const syncPath = `${actDir}/scripts/sync-xero-to-supabase.mjs`;
  return existsSync(syncPath) ? syncPath : null;
}

export const getOrgVerificationStatus = cache(async function getOrgVerificationStatus(
  slug: string,
): Promise<OrgVerificationStatus | null> {
  if (!isActSlug(slug)) return null;

  const supabase = getServiceSupabase();

  const [
    syncRes,
    invoiceRes,
    accrecRes,
    accpayRes,
    transactionLatestRes,
    payablesProofRes,
    bankTransactionRes,
    bankAccountRes,
  ] = await Promise.all([
    supabase
      .from('xero_sync_log')
      .select('status, completed_at, started_at, records_synced, records_failed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(1),
    supabase
      .from('xero_invoices')
      .select('synced_at')
      .order('synced_at', { ascending: false, nullsFirst: false })
      .limit(1),
    supabase
      .from('xero_invoices')
      .select('synced_at')
      .eq('type', 'ACCREC')
      .eq('status', 'AUTHORISED')
      .order('synced_at', { ascending: false, nullsFirst: false })
      .limit(1),
    supabase
      .from('xero_invoices')
      .select('synced_at')
      .eq('type', 'ACCPAY')
      .eq('status', 'AUTHORISED')
      .order('synced_at', { ascending: false, nullsFirst: false })
      .limit(1),
    supabase
      .from('xero_transactions')
      .select('synced_at')
      .order('synced_at', { ascending: false, nullsFirst: false })
      .limit(1),
    supabase.rpc('exec_sql', {
      query: `WITH payment_proof AS (
          SELECT invoice_xero_id, SUM(amount)::numeric AS reconciled_amount
          FROM xero_payments
          WHERE is_reconciled IS TRUE AND invoice_xero_id IS NOT NULL
          GROUP BY invoice_xero_id
        ), bill_proof AS (
          SELECT p.invoice_id, p.total,
            COALESCE(payment_proof.reconciled_amount, 0)::numeric AS reconciled_amount
          FROM v_act_payables_triage p
          LEFT JOIN xero_invoices invoice ON invoice.id = p.invoice_id
          LEFT JOIN payment_proof ON payment_proof.invoice_xero_id = invoice.xero_id
        )
        SELECT
          COUNT(*)::int AS total_bills,
          COALESCE(SUM(total), 0)::numeric AS total_authorised,
          COUNT(*) FILTER (WHERE reconciled_amount >= total - 0.01)::int AS exact_match_count,
          COALESCE(SUM(total) FILTER (WHERE reconciled_amount >= total - 0.01), 0)::numeric AS exact_match_total,
          (SELECT COUNT(*)::int FROM xero_payments) AS payment_count,
          (SELECT MAX(synced_at)::text FROM xero_payments) AS latest_payment_sync_at
        FROM bill_proof`,
    }),
    supabase
      .from('xero_bank_transactions')
      .select('synced_at')
      .order('synced_at', { ascending: false, nullsFirst: false })
      .limit(1),
    supabase
      .from('xero_bank_accounts')
      .select('balance_updated_at')
      .eq('status', 'ACTIVE')
      .order('balance_updated_at', { ascending: false, nullsFirst: false })
      .limit(1),
  ]);

  const latestSync = ((syncRes.data ?? []) as XeroSyncRow[])[0] ?? null;
  const latestInvoice = ((invoiceRes.data ?? []) as XeroInvoiceFreshnessRow[])[0] ?? null;
  const latestAccrec = ((accrecRes.data ?? []) as XeroInvoiceFreshnessRow[])[0] ?? null;
  const latestAccpay = ((accpayRes.data ?? []) as XeroInvoiceFreshnessRow[])[0] ?? null;
  const latestTransaction = ((transactionLatestRes.data ?? []) as XeroInvoiceFreshnessRow[])[0] ?? null;
  const payablesProof = ((payablesProofRes.data ?? []) as PayablesProofAggregateRow[])[0] ?? null;
  const bankTransactionRows = (bankTransactionRes.data ?? []) as BankTransactionRow[];
  const bankAccountRows = (bankAccountRes.data ?? []) as BankAccountRow[];

  const invoiceSyncedAt = latestInvoice?.synced_at ?? null;
  const accrecAuthorisedSyncedAt = latestAccrec?.synced_at ?? null;
  const accpayAuthorisedSyncedAt = latestAccpay?.synced_at ?? null;
  const transactionSyncedAt = latestTransaction?.synced_at ?? null;
  const paymentSyncedAt = payablesProof?.latest_payment_sync_at ?? null;
  const bankTransactionSyncedAt = latestIso(bankTransactionRows, 'synced_at');
  const bankBalanceSyncedAt = latestIso(bankAccountRows, 'balance_updated_at');
  const localApiConfigured = hasXeroApiEnv();
  const externalSync = externalXeroSyncPath();

  const xeroStatus: SyncStatus =
    latestSync?.status === 'completed' && Number(latestSync.records_failed ?? 0) === 0
      ? 'verified'
      : latestSync
        ? 'partial'
        : 'blocked';

  const totalBills = toNumber(payablesProof?.total_bills);
  const totalAuthorised = toNumber(payablesProof?.total_authorised);
  const exactBankRecMatchCount = toNumber(payablesProof?.exact_match_count);
  const exactBankRecMatchTotal = toNumber(payablesProof?.exact_match_total);
  const paymentCount = toNumber(payablesProof?.payment_count);
  const unresolvedTotal = Math.max(0, totalAuthorised - exactBankRecMatchTotal);
  const unresolvedBillCount = Math.max(0, totalBills - exactBankRecMatchCount);

  return {
    xero: {
      status: xeroStatus,
      apiConfigured: localApiConfigured,
      externalSyncConfigured: Boolean(externalSync),
      externalSyncPath: externalSync,
      latestSyncCompletedAt: latestSync?.completed_at ?? latestSync?.started_at ?? null,
      latestSyncStatus: latestSync?.status ?? null,
      latestRecordsSynced: Number(latestSync?.records_synced ?? 0),
      latestRecordsFailed: Number(latestSync?.records_failed ?? 0),
      invoiceSyncedAt,
      transactionSyncedAt,
      bankTransactionSyncedAt,
      bankBalanceSyncedAt,
      accrecAuthorisedSyncedAt,
      accpayAuthorisedSyncedAt,
      note: localApiConfigured
        ? 'Server has Xero API credentials configured; dashboard is reading the Supabase Xero mirror.'
        : externalSync
          ? 'Xero credentials and token rotation live in act-global-infrastructure; GrantScope reads the shared Supabase mirror.'
          : 'No local Xero API credentials are configured here; dashboard verifies the Supabase Xero mirror and sync log.',
    },
    payables: {
      status: paymentCount > 0 ? 'partial' : 'blocked',
      proofSource: 'xero_payments',
      totalBills,
      totalAuthorised,
      exactBankRecMatchCount,
      exactBankRecMatchTotal,
      unresolvedBillCount,
      unresolvedTotal,
      latestTransactionSyncAt: transactionSyncedAt,
      latestPaymentSyncAt: paymentSyncedAt,
      note:
        'Counts only authorised bills fully covered by reconciled Xero Payments rows linked to the same invoice.',
    },
    mailbox: {
      status: 'partial',
      latestExtractAt: '2026-06-11',
      latestConnectorCheckAt: '2026-07-08',
      mailbox: 'benjamin@act.place via Ben mailbox export notes',
      funderOrgsReviewed: 22,
      buyerInvestorOrgsReviewed: 13,
      currentCandidateMessages:
        '50+ candidate funding, grant, invoice, payment, and relationship messages since 2026-06-11 checked via Gmail connector.',
      currentSignalSummary:
        'Current signal sample: FRRR funding referral, Snow grant catch-up accepted, SEFA Queensland invite, and CONTAINED partner handoff.',
      limitation:
        'This is a broad read-only Gmail harvest plus a current spot-check, not a continuous in-app mailbox index. Threads only in Nic or other mailboxes remain outside this source.',
      sourcePaths: [
        'thoughts/shared/analysis/2026-06-11-goods-phase1-gmail-funders.md',
        'thoughts/shared/analysis/2026-06-11-goods-phase1-gmail-buyers.md',
      ],
    },
  };
});
