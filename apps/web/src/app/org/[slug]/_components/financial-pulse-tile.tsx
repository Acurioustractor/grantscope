import Link from 'next/link';
import type { OrgFinancialPulse } from '@/lib/services/org-income-service';

function fmtMoney(n: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const sign = opts.sign ? (n > 0 ? '+' : '−') : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

function runwayLabel(months: number | null): { value: string; tone: 'green' | 'yellow' | 'red' | 'gray' } {
  if (months == null) return { value: '—', tone: 'gray' };
  if (months >= 12) return { value: `${months.toFixed(1)}mo`, tone: 'green' };
  if (months >= 6) return { value: `${months.toFixed(1)}mo`, tone: 'yellow' };
  return { value: `${months.toFixed(1)}mo`, tone: 'red' };
}

export function FinancialPulseTile({
  pulse,
  slug,
}: {
  pulse: OrgFinancialPulse | null;
  slug: string;
}) {
  if (!pulse) return null;

  const runway = runwayLabel(pulse.runway_months);
  const runwayColor =
    runway.tone === 'green' ? 'text-green-400'
    : runway.tone === 'yellow' ? 'text-bauhaus-yellow'
    : runway.tone === 'red' ? 'text-bauhaus-red'
    : 'text-gray-400';

  const netColor = pulse.monthly_net_avg >= 0 ? 'text-green-400' : 'text-bauhaus-red';
  const wcColor = pulse.working_capital >= 0 ? 'text-green-400' : 'text-bauhaus-red';

  return (
    <section className="border-4 border-bauhaus-black bg-bauhaus-black text-white">
      <div className="px-5 py-4 border-b-4 border-bauhaus-red flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
            Financial Pulse · Sole-trader Xero
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-wider">
            Where ACT stands right now
          </h2>
          <p className="mt-1 text-[11px] font-mono text-gray-400">
            Cash from {pulse.account_count} ACT bank account{pulse.account_count === 1 ? '' : 's'} · Last sync{' '}
            {pulse.last_balance_sync
              ? new Date(pulse.last_balance_sync).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
              : 'never'}{' '}
            · Computed {new Date(pulse.computed_at).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/org/${slug}?full=1#income-history`}
            className="border border-white/30 bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
          >
            Income →
          </Link>
          <Link
            href={`/org/${slug}?full=1#expense-history`}
            className="border border-white/30 bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
          >
            Expense →
          </Link>
          <Link
            href={`/org/${slug}/pipeline`}
            className="border border-bauhaus-red bg-bauhaus-red px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
          >
            Pipeline →
          </Link>
        </div>
      </div>

      {/* Hero row: cash + runway + monthly net + working capital */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
        <div className="border-r-4 border-bauhaus-red px-5 py-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cash on hand</div>
          <div className="mt-1 text-4xl font-black tabular-nums">{fmtMoney(pulse.cash_total)}</div>
          <div className="mt-1 text-[10px] font-mono text-gray-500">
            {pulse.account_count} active acct{pulse.account_count === 1 ? '' : 's'}
          </div>
        </div>
        <div className="border-r-4 border-bauhaus-red px-5 py-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Runway @ current burn</div>
          <div className={`mt-1 text-4xl font-black tabular-nums ${runwayColor}`}>{runway.value}</div>
          <div className="mt-1 text-[10px] font-mono text-gray-500">
            burn {fmtMoney(pulse.monthly_burn_avg)}/mo (90d avg)
          </div>
        </div>
        <div className="border-r-4 border-bauhaus-red px-5 py-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monthly net (90d avg)</div>
          <div className={`mt-1 text-4xl font-black tabular-nums ${netColor}`}>
            {fmtMoney(pulse.monthly_net_avg, { sign: true })}
          </div>
          <div className="mt-1 text-[10px] font-mono text-gray-500">
            income {fmtMoney(pulse.monthly_income_avg)}/mo
          </div>
        </div>
        <div className="px-5 py-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Working capital</div>
          <div className={`mt-1 text-4xl font-black tabular-nums ${wcColor}`}>
            {fmtMoney(pulse.working_capital, { sign: true })}
          </div>
          <div className="mt-1 text-[10px] font-mono text-gray-500">cash + A/R − A/P</div>
        </div>
      </div>

      {/* Receivables + payables strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t-4 border-bauhaus-red">
        <div className="border-r-4 border-bauhaus-red px-5 py-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">Receivables (A/R)</div>
              <div className="mt-1 text-2xl font-black tabular-nums text-bauhaus-yellow">
                {fmtMoney(pulse.ar_total)}
              </div>
              <div className="text-[10px] font-mono text-gray-500">
                {pulse.ar_count} invoices awaiting payment
              </div>
            </div>
            {pulse.ar_overdue_60d > 0 && (
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Overdue 60d+</div>
                <div className="text-xl font-black tabular-nums text-bauhaus-red">
                  {fmtMoney(pulse.ar_overdue_60d)}
                </div>
                <div className="text-[10px] font-mono text-gray-500">
                  {pulse.ar_overdue_60d_count} to chase
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Payables (A/P)</div>
              <div className="mt-1 text-2xl font-black tabular-nums text-bauhaus-red">
                {fmtMoney(pulse.ap_total)}
              </div>
              <div className="text-[10px] font-mono text-gray-500">
                {pulse.ap_count} bills approved
              </div>
            </div>
            {pulse.ap_overdue_60d > 0 && (
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Overdue 60d+</div>
                <div className="text-xl font-black tabular-nums text-bauhaus-red">
                  {fmtMoney(pulse.ap_overdue_60d)}
                </div>
                <div className="text-[10px] font-mono text-gray-500">
                  {pulse.ap_overdue_60d_count} stale bills
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
