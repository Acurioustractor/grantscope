import Link from 'next/link';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type FunderCategory,
  type OrgIncomeData,
} from '@/lib/services/org-income-service';

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

export function IncomeHistorySection({
  income,
  slug,
}: {
  income: OrgIncomeData | null;
  slug: string;
}) {
  if (!income || income.totals.paid_total === 0) return null;

  const { byFunder, byCategory, byProject, totals } = income;
  const topFunders = byFunder.slice(0, 12);
  const overdueOver60 = byFunder.filter(
    (f) => f.longest_outstanding_days != null && f.longest_outstanding_days >= 60,
  );

  return (
    <section id="income-history" className="scroll-mt-24">
      <div className="border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black bg-bauhaus-black px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
              Income History
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-wider text-white">
              Lifetime book of business
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-gray-300">
              From <span className="font-mono">xero_invoices</span> (sole-trader ABN 21591780066, Nicholas Marchesi).
              Pty Ltd cuts over 30 June 2026 — new tranches from that date will appear here once invoiced from ACN 697 347 676.
            </p>
          </div>
          <Link
            href={`/org/${slug}/pipeline`}
            className="w-fit border border-white/30 bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-red"
          >
            Pipeline kanban →
          </Link>
        </div>

        {/* Top stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b-4 border-bauhaus-black">
          <div className="border-r-4 border-bauhaus-black px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Paid lifetime</div>
            <div className="text-2xl font-black tabular-nums text-bauhaus-black">{fmtMoney(totals.paid_total)}</div>
            <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">{totals.paid_invoice_count} invoices</div>
          </div>
          <div className="border-r-4 border-bauhaus-black px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Authorised (A/R)</div>
            <div className="text-2xl font-black tabular-nums text-bauhaus-yellow">{fmtMoney(totals.auth_total)}</div>
            <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">awaiting payment</div>
          </div>
          <div className="border-r-4 border-bauhaus-black px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Draft</div>
            <div className="text-2xl font-black tabular-nums text-bauhaus-muted">{fmtMoney(totals.draft_total)}</div>
            <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">not yet sent</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Counterparties</div>
            <div className="text-2xl font-black tabular-nums text-bauhaus-black">{totals.funder_count}</div>
            <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">distinct payers all-time</div>
          </div>
        </div>

        {/* Category split */}
        <div className="border-b-4 border-bauhaus-black px-5 py-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-3">
            By funder category (paid lifetime)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {byCategory.map((cat) => (
              <div
                key={cat.category}
                className="border-2 border-bauhaus-black p-2"
              >
                <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${CATEGORY_COLORS[cat.category as FunderCategory]}`}>
                  {CATEGORY_LABELS[cat.category as FunderCategory]}
                </span>
                <div className="text-lg font-black tabular-nums mt-1">{fmtMoney(cat.paid_total)}</div>
                <div className="text-[10px] font-mono text-bauhaus-muted">
                  {cat.funder_count} {cat.funder_count === 1 ? 'funder' : 'funders'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-project income */}
        {byProject.length > 0 && (
          <div className="border-b-4 border-bauhaus-black px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-3">
              By project code (paid lifetime)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                    <th className="text-left py-1 pr-2">Project</th>
                    <th className="text-right py-1 px-2">Paid</th>
                    <th className="text-right py-1 px-2">Authorised</th>
                    <th className="text-right py-1 px-2">Invoices</th>
                    <th className="text-right py-1 px-2">Funders</th>
                    <th className="text-right py-1 pl-2">Last paid</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {byProject.map((p) => (
                    <tr key={p.project_code} className="border-b border-bauhaus-black/10">
                      <td className="py-1.5 pr-2 font-black uppercase tracking-wider text-bauhaus-black">{p.project_code}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{fmtMoney(p.paid_total)}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-bauhaus-muted">{fmtMoney(p.auth_total)}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-bauhaus-muted">{p.paid_invoice_count}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-bauhaus-muted">{p.distinct_funders}</td>
                      <td className="text-right py-1.5 pl-2 text-bauhaus-muted">{fmtDate(p.last_paid_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top funders */}
        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
              Top funders / clients (by paid)
            </div>
            <div className="text-[10px] font-mono text-bauhaus-muted">
              showing {topFunders.length} of {totals.funder_count}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                  <th className="text-left py-1 pr-2">Funder</th>
                  <th className="text-left py-1 px-2">Category</th>
                  <th className="text-right py-1 px-2">Paid</th>
                  <th className="text-right py-1 px-2">Outstanding</th>
                  <th className="text-left py-1 px-2">Projects</th>
                  <th className="text-right py-1 pl-2">Last paid</th>
                </tr>
              </thead>
              <tbody>
                {topFunders.map((f) => (
                  <tr key={f.funder_name} className="border-b border-bauhaus-black/10 align-top">
                    <td className="py-2 pr-2 font-black text-bauhaus-black leading-tight">
                      {f.funder_name}
                      {f.relationship_score != null && (
                        <span className="ml-2 text-[9px] font-mono text-bauhaus-muted">
                          score {f.relationship_score}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${CATEGORY_COLORS[f.funder_category]}`}>
                        {CATEGORY_LABELS[f.funder_category]}
                      </span>
                    </td>
                    <td className="text-right py-2 px-2 font-mono tabular-nums font-black">
                      {fmtMoney(f.paid_total)}
                      <div className="text-[10px] font-normal text-bauhaus-muted">{f.paid_invoice_count} inv</div>
                    </td>
                    <td className="text-right py-2 px-2 font-mono">
                      {f.auth_total > 0 ? (
                        <span className={f.longest_outstanding_days != null && f.longest_outstanding_days > 60 ? 'text-bauhaus-red font-black' : 'text-bauhaus-muted'}>
                          {fmtMoney(f.auth_total)}
                          {f.longest_outstanding_days != null && f.longest_outstanding_days > 0 && (
                            <div className="text-[10px] font-normal">{f.longest_outstanding_days}d</div>
                          )}
                        </span>
                      ) : (
                        <span className="text-bauhaus-muted">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono text-[10px] text-bauhaus-muted">
                      {(f.project_codes ?? []).join(', ') || '—'}
                    </td>
                    <td className="text-right py-2 pl-2 text-[10px] font-mono text-bauhaus-muted">
                      {fmtDate(f.last_paid_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {byFunder.length > topFunders.length && (
            <div className="mt-3 text-[10px] font-mono text-bauhaus-muted">
              + {byFunder.length - topFunders.length} more counterparties (total ${fmtMoney(byFunder.slice(topFunders.length).reduce((s, f) => s + f.paid_total, 0))})
            </div>
          )}

          {overdueOver60.length > 0 && (
            <div className="mt-4 border-l-4 border-bauhaus-red bg-bauhaus-red/5 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1">
                Outstanding {'>'} 60 days ({overdueOver60.length})
              </div>
              <div className="text-xs space-y-0.5">
                {overdueOver60.map((f) => (
                  <div key={f.funder_name} className="flex justify-between">
                    <span className="text-bauhaus-black">{f.funder_name}</span>
                    <span className="font-mono text-bauhaus-red font-black">
                      {fmtMoney(f.auth_total)} · {f.longest_outstanding_days}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
