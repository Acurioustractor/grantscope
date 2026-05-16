import {
  PAYEE_CATEGORY_COLORS,
  PAYEE_CATEGORY_LABELS,
  type OrgExpenseData,
  type PayeeCategory,
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

export function ExpenseHistorySection({
  expense,
  netByProject,
}: {
  expense: OrgExpenseData | null;
  /** Optional join with income byProject so each row shows net = income - expense. */
  netByProject?: Map<string, { paid_income: number; paid_expense: number; net: number }>;
}) {
  if (!expense || expense.totals.paid_total === 0) return null;

  const { byPayee, byCategory, byProject, totals } = expense;
  const topPayees = byPayee.slice(0, 15);

  return (
    <section id="expense-history" className="scroll-mt-24">
      <div className="border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
            Expense History
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-wider text-bauhaus-black">
            Where the money goes
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-bauhaus-muted">
            From <span className="font-mono">xero_invoices</span> ACCPAY (supplier bills). Paired with income for net-position by project.
          </p>
        </div>

        {/* Top stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b-4 border-bauhaus-black">
          <div className="border-r-4 border-bauhaus-black px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Paid lifetime</div>
            <div className="text-2xl font-black tabular-nums text-bauhaus-black">{fmtMoney(totals.paid_total)}</div>
            <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">{totals.paid_invoice_count} invoices</div>
          </div>
          <div className="border-r-4 border-bauhaus-black px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Authorised (A/P)</div>
            <div className="text-2xl font-black tabular-nums text-bauhaus-red">{fmtMoney(totals.auth_total)}</div>
            <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">bills awaiting payment</div>
          </div>
          <div className="border-r-4 border-bauhaus-black px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Draft</div>
            <div className="text-2xl font-black tabular-nums text-bauhaus-muted">{fmtMoney(totals.draft_total)}</div>
            <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">not yet entered</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Payees</div>
            <div className="text-2xl font-black tabular-nums text-bauhaus-black">{totals.payee_count}</div>
            <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">distinct suppliers all-time</div>
          </div>
        </div>

        {/* Category split */}
        <div className="border-b-4 border-bauhaus-black px-5 py-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-3">
            By payee category (paid lifetime)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {byCategory.map((cat) => (
              <div
                key={cat.category}
                className="border-2 border-bauhaus-black p-2"
              >
                <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${PAYEE_CATEGORY_COLORS[cat.category as PayeeCategory]}`}>
                  {PAYEE_CATEGORY_LABELS[cat.category as PayeeCategory]}
                </span>
                <div className="text-lg font-black tabular-nums mt-1">{fmtMoney(cat.paid_total)}</div>
                <div className="text-[10px] font-mono text-bauhaus-muted">
                  {cat.payee_count} {cat.payee_count === 1 ? 'payee' : 'payees'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-project net position (income vs expense) */}
        {byProject.length > 0 && (
          <div className="border-b-4 border-bauhaus-black px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-3">
              {netByProject ? 'Net position by project (income − expense, paid only)' : 'By project (paid expense)'}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                    <th className="text-left py-1 pr-2">Project</th>
                    {netByProject && <th className="text-right py-1 px-2">Income</th>}
                    <th className="text-right py-1 px-2">Expense</th>
                    {netByProject && <th className="text-right py-1 px-2">Net</th>}
                    <th className="text-right py-1 px-2">Bills</th>
                    <th className="text-right py-1 pl-2">Last paid</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {byProject.map((p) => {
                    const net = netByProject?.get(p.project_code);
                    return (
                      <tr key={p.project_code} className="border-b border-bauhaus-black/10">
                        <td className="py-1.5 pr-2 font-black uppercase tracking-wider text-bauhaus-black">{p.project_code}</td>
                        {netByProject && (
                          <td className="text-right py-1.5 px-2 tabular-nums text-bauhaus-muted">
                            {net && net.paid_income > 0 ? fmtMoney(net.paid_income) : '—'}
                          </td>
                        )}
                        <td className="text-right py-1.5 px-2 tabular-nums text-bauhaus-black">{fmtMoney(p.paid_total)}</td>
                        {netByProject && (
                          <td className={`text-right py-1.5 px-2 tabular-nums font-black ${
                            net && net.net > 0 ? 'text-green-700' : net && net.net < 0 ? 'text-bauhaus-red' : 'text-bauhaus-muted'
                          }`}>
                            {net ? (net.net >= 0 ? `+${fmtMoney(net.net)}` : `−${fmtMoney(-net.net)}`) : '—'}
                          </td>
                        )}
                        <td className="text-right py-1.5 px-2 tabular-nums text-bauhaus-muted">{p.paid_invoice_count}</td>
                        <td className="text-right py-1.5 pl-2 text-bauhaus-muted">{fmtDate(p.last_paid_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top payees */}
        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
              Top payees (by paid)
            </div>
            <div className="text-[10px] font-mono text-bauhaus-muted">
              showing {topPayees.length} of {totals.payee_count}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                  <th className="text-left py-1 pr-2">Payee</th>
                  <th className="text-left py-1 px-2">Category</th>
                  <th className="text-right py-1 px-2">Paid</th>
                  <th className="text-right py-1 px-2">Bills</th>
                  <th className="text-left py-1 px-2">Projects</th>
                  <th className="text-right py-1 pl-2">Last paid</th>
                </tr>
              </thead>
              <tbody>
                {topPayees.map((p) => (
                  <tr key={p.payee_name} className="border-b border-bauhaus-black/10 align-top">
                    <td className="py-2 pr-2 font-black text-bauhaus-black leading-tight">
                      {p.payee_name}
                    </td>
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${PAYEE_CATEGORY_COLORS[p.payee_category]}`}>
                        {PAYEE_CATEGORY_LABELS[p.payee_category]}
                      </span>
                    </td>
                    <td className="text-right py-2 px-2 font-mono tabular-nums font-black">
                      {fmtMoney(p.paid_total)}
                    </td>
                    <td className="text-right py-2 px-2 font-mono text-[10px] text-bauhaus-muted tabular-nums">
                      {p.paid_invoice_count}
                    </td>
                    <td className="py-2 px-2 font-mono text-[10px] text-bauhaus-muted">
                      {(p.project_codes ?? []).join(', ') || '—'}
                    </td>
                    <td className="text-right py-2 pl-2 text-[10px] font-mono text-bauhaus-muted">
                      {fmtDate(p.last_paid_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {byPayee.length > topPayees.length && (
            <div className="mt-3 text-[10px] font-mono text-bauhaus-muted">
              + {byPayee.length - topPayees.length} more payees (total {fmtMoney(byPayee.slice(topPayees.length).reduce((s, p) => s + p.paid_total, 0))})
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
