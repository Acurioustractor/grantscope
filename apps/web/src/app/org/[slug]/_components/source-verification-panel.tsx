import type { OrgVerificationStatus } from '@/lib/services/org-verification-service';

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${(abs / 1_000).toFixed(0)}K`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
  return `$${Math.round(abs).toLocaleString()}`;
}

function fmtDateTime(value: string | null): string {
  if (!value) return 'not available';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'not available';
  return d.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusClass(status: 'verified' | 'partial' | 'blocked'): string {
  if (status === 'verified') return 'bg-green-700 text-white';
  if (status === 'partial') return 'bg-bauhaus-yellow text-bauhaus-black';
  return 'bg-bauhaus-red text-white';
}

function StatusPill({
  status,
}: {
  status: 'verified' | 'partial' | 'blocked';
}) {
  return (
    <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(status)}`}>
      {status}
    </span>
  );
}

export function SourceVerificationPanel({
  status,
}: {
  status: OrgVerificationStatus | null;
}) {
  if (!status) return null;

  const matchedPercent = status.payables.totalAuthorised > 0
    ? Math.round((status.payables.exactBankRecMatchTotal / status.payables.totalAuthorised) * 100)
    : 0;

  return (
    <section className="border-4 border-bauhaus-black bg-white">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas px-5 py-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Verification status</p>
        <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Source truth and remaining proof gaps</h2>
      </div>

      <div className="grid gap-0 lg:grid-cols-3">
        <div className="border-b-4 border-bauhaus-black px-5 py-4 lg:border-b-0 lg:border-r-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Xero mirror</div>
            <StatusPill status={status.xero.status} />
          </div>
          <div className="mt-2 text-lg font-black text-bauhaus-black">
            {fmtDateTime(status.xero.latestSyncCompletedAt)}
          </div>
          <div className="mt-1 text-[11px] font-mono leading-relaxed text-bauhaus-muted">
            Last sync log: {status.xero.latestSyncStatus ?? 'unknown'} · {status.xero.latestRecordsFailed} failed.
            Invoices: {fmtDateTime(status.xero.invoiceSyncedAt)}.
          </div>
          <div className="mt-2 text-[11px] leading-relaxed text-gray-600">
            {status.xero.apiConfigured
              ? 'API credentials present on this server.'
              : status.xero.externalSyncConfigured
                ? 'External ACT Xero sync bridge configured; credentials stay in act-global-infrastructure.'
                : 'No local Xero API credentials in this environment.'}
          </div>
        </div>

        <div className="border-b-4 border-bauhaus-black px-5 py-4 lg:border-b-0 lg:border-r-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">A/P payment proof</div>
            <StatusPill status={status.payables.status} />
          </div>
          <div className="mt-2 text-lg font-black text-bauhaus-black">
            {fmtMoney(status.payables.exactBankRecMatchTotal)} matched
          </div>
          <div className="mt-1 text-[11px] font-mono leading-relaxed text-bauhaus-muted">
            {status.payables.exactBankRecMatchCount} of {status.payables.totalBills} bills · {matchedPercent}% of authorised A/P.
            Payment sync: {fmtDateTime(status.payables.latestPaymentSyncAt)}.
          </div>
          <div className="mt-2 text-[11px] leading-relaxed text-gray-600">
            {fmtMoney(status.payables.unresolvedTotal)} still lacks reconciled Xero payment proof in the mirror.
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Gmail CRM harvest</div>
            <StatusPill status={status.mailbox.status} />
          </div>
          <div className="mt-2 text-lg font-black text-bauhaus-black">
            {status.mailbox.funderOrgsReviewed + status.mailbox.buyerInvestorOrgsReviewed} orgs reviewed
          </div>
          <div className="mt-1 text-[11px] font-mono leading-relaxed text-bauhaus-muted">
            Latest saved harvest: {status.mailbox.latestExtractAt} · {status.mailbox.mailbox}.
          </div>
          <div className="mt-2 text-[11px] font-mono leading-relaxed text-bauhaus-muted">
            Spot-check: {status.mailbox.latestConnectorCheckAt} · {status.mailbox.currentCandidateMessages}
          </div>
          <div className="mt-2 text-[11px] leading-relaxed text-gray-600">
            {status.mailbox.currentSignalSummary}
          </div>
          <div className="mt-2 text-[11px] leading-relaxed text-gray-600">
            {status.mailbox.limitation}
          </div>
        </div>
      </div>
    </section>
  );
}
