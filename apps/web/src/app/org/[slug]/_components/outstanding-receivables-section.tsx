import type { OutstandingReceivablesData, ReceivablePayer } from '@/lib/services/org-receivables-service';

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${(abs / 1_000).toFixed(0)}K`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
  return `$${Math.round(abs).toLocaleString()}`;
}

function fmtAge(days: number): string {
  if (days <= 0) return 'not due';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function priorityFlag(payer: ReceivablePayer): { label: string; tone: 'red' | 'amber' | 'blue' | 'green' | 'gray' } | null {
  if (payer.has_draft && payer.draft_total >= 10000) return { label: 'NEEDS TO BE SENT', tone: 'red' };
  // Recurring-pattern wins over age — admin/reconciliation issue, not a chase
  if (payer.is_recurring_pattern) return { label: 'RECONCILIATION LAG', tone: 'blue' };
  if (payer.oldest_days_overdue >= 365) return { label: 'RECOVERY CASE', tone: 'red' };
  if (payer.oldest_days_overdue >= 180) return { label: 'STALE 180d+', tone: 'amber' };
  if (payer.oldest_days_overdue >= 60) return { label: 'CHASE NOW', tone: 'amber' };
  if (payer.oldest_days_overdue <= 0) return { label: 'NOT YET DUE', tone: 'green' };
  return null;
}

const TONE_CLASSES: Record<'red' | 'amber' | 'blue' | 'green' | 'gray', string> = {
  red: 'bg-bauhaus-red text-white',
  amber: 'bg-bauhaus-yellow text-bauhaus-black',
  blue: 'bg-bauhaus-blue text-white',
  green: 'bg-green-600 text-white',
  gray: 'bg-bauhaus-canvas text-bauhaus-black',
};

export function OutstandingReceivablesSection({
  data,
}: {
  data: OutstandingReceivablesData | null;
}) {
  if (!data || data.totals.invoice_count === 0) return null;

  const { payers, totals } = data;

  return (
    <section id="outstanding-receivables" className="scroll-mt-24">
      <div className="border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black bg-bauhaus-black px-5 py-4 text-white">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">
            Outstanding Receivables · Who Owes ACT
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-wider">
            {fmtMoney(totals.total_due)} across {totals.payer_count} payer{totals.payer_count === 1 ? '' : 's'}
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-gray-300">
            Live from <span className="font-mono">xero_invoices</span> ACCREC (AUTHORISED + DRAFT, amount_due&nbsp;&gt;&nbsp;0).
            Grouped by payer, sorted by amount. Flags surface what needs action today.
          </p>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b-4 border-bauhaus-black">
          {([
            ['Total owed', fmtMoney(totals.total_due), `${totals.invoice_count} invoices`, ''],
            ['Approved', fmtMoney(totals.authorised_total), 'AUTHORISED in Xero', 'text-bauhaus-black'],
            ['Draft', fmtMoney(totals.draft_total), 'not yet sent', totals.draft_total > 0 ? 'text-bauhaus-red' : ''],
            ['Overdue 90d+', fmtMoney(totals.overdue_90d), `90d+ past due_date`, totals.overdue_90d > 0 ? 'text-bauhaus-red' : ''],
          ] as const).map(([label, value, sub, color], i) => (
            <div
              key={label}
              className={`px-4 py-3 ${i < 3 ? 'border-r-4 border-bauhaus-black' : ''}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
              <div className={`text-2xl font-black tabular-nums ${color || 'text-bauhaus-black'}`}>{value}</div>
              <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* Per-payer rows */}
        <div className="divide-y-4 divide-bauhaus-black">
          {payers.map((p) => {
            const flag = priorityFlag(p);
            return (
              <details key={p.payer_name} className="group">
                <summary className="cursor-pointer list-none px-5 py-3 hover:bg-bauhaus-canvas transition-colors">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-base font-black uppercase tracking-wider text-bauhaus-black">
                      {p.payer_name}
                    </span>
                    {flag && (
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${TONE_CLASSES[flag.tone]}`}>
                        {flag.label}
                      </span>
                    )}
                    {p.project_codes.map((code) => (
                      <span key={code} className="border border-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-bauhaus-black">
                        {code}
                      </span>
                    ))}
                    <span className="ml-auto flex items-baseline gap-4">
                      <span className="text-[10px] font-mono text-bauhaus-muted">
                        {p.oldest_days_overdue <= 0
                          ? `due in ${Math.abs(p.oldest_days_overdue)}d`
                          : `${fmtAge(p.oldest_days_overdue)} overdue`}
                      </span>
                      <span className="text-[10px] font-mono text-bauhaus-muted">
                        {p.invoice_count} {p.invoice_count === 1 ? 'invoice' : 'invoices'}
                      </span>
                      <span className="text-2xl font-black tabular-nums text-bauhaus-black">
                        {fmtMoney(p.total_due)}
                      </span>
                      <span className="text-[10px] font-black text-bauhaus-muted group-open:rotate-90 transition-transform">▶</span>
                    </span>
                  </div>
                </summary>
                <div className="border-t-2 border-bauhaus-black/20 px-5 py-3 bg-bauhaus-canvas">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-bauhaus-black/30 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                        <th className="text-left py-1 pr-2">Invoice</th>
                        <th className="text-left py-1 px-2">Status</th>
                        <th className="text-left py-1 px-2">Project</th>
                        <th className="text-right py-1 px-2">Amount</th>
                        <th className="text-right py-1 px-2">Issued</th>
                        <th className="text-right py-1 px-2">Due</th>
                        <th className="text-right py-1 pl-2">Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.invoices.map((inv) => (
                        <tr key={inv.invoice_id} className="border-b border-bauhaus-black/10">
                          <td className="py-1 pr-2 font-mono font-black text-bauhaus-black">{inv.invoice_number ?? '—'}</td>
                          <td className="py-1 px-2">
                            <span className={`px-1 py-0.5 text-[9px] font-black uppercase tracking-wider ${inv.status === 'DRAFT' ? 'bg-bauhaus-red text-white' : 'bg-bauhaus-blue text-white'}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-1 px-2 font-mono text-[10px] text-bauhaus-muted">{inv.project_code ?? '—'}</td>
                          <td className="text-right py-1 px-2 font-mono tabular-nums font-black">{fmtMoney(inv.amount_due)}</td>
                          <td className="text-right py-1 px-2 font-mono text-[10px] text-bauhaus-muted">
                            {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                          </td>
                          <td className="text-right py-1 px-2 font-mono text-[10px] text-bauhaus-muted">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                          </td>
                          <td className={`text-right py-1 pl-2 font-mono text-[10px] tabular-nums ${inv.days_overdue >= 90 ? 'text-bauhaus-red font-black' : inv.days_overdue >= 30 ? 'text-bauhaus-black' : 'text-bauhaus-muted'}`}>
                            {inv.days_overdue > 0 ? `${inv.days_overdue}d` : 'not due'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {p.is_recurring_pattern && (
                    <div className="mt-2 border-2 border-bauhaus-blue bg-bauhaus-blue/5 px-3 py-2 text-[11px] text-bauhaus-black">
                      <span className="font-black uppercase tracking-wider text-bauhaus-blue">Reconciliation lag pattern:</span>{' '}
                      {p.invoice_count} weekly-looking invoices, all ~{fmtMoney(p.total_due / p.invoice_count)}. Likely paid via direct deposit but not matched against these AR invoices in Xero. Reconcile against bank feed before chasing.
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
