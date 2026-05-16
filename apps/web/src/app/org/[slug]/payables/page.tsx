import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { ACT_FAST_PROFILE, isActSlug } from '@/lib/services/fast-local-org';
import { getOrgPayablesTriage } from '@/lib/services/org-payables-service';
import { PayablesKanban } from './payables-kanban';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payables triage — Org',
  description: 'Drag-to-triage authorised bills across decision states.',
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default async function PayablesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const profile = (await getOrgProfileBySlug(slug)) ?? (isActSlug(slug) ? ACT_FAST_PROFILE : null);
  if (!profile) notFound();

  const data = await getOrgPayablesTriage(slug);

  if (!data) {
    return (
      <main className="min-h-screen bg-gray-50 text-bauhaus-black">
        <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
          <div className="mx-auto max-w-7xl px-4 py-8">
            <p className="text-sm font-black uppercase tracking-widest text-bauhaus-red">Payables triage</p>
            <h1 className="text-3xl font-black uppercase tracking-wider">{profile.name}</h1>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="border-4 border-bauhaus-black bg-white p-8">
            <p className="text-sm text-bauhaus-muted">No payables triage configured for this org (Xero ACCPAY data lives under sole-trader ABN only).</p>
            <Link href={`/org/${slug}`} className="mt-4 inline-block border-2 border-bauhaus-black bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas">Back to dashboard</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-bauhaus-red">Payables triage</p>
              <h1 className="text-3xl font-black uppercase tracking-wider">{profile.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-300">
                Triage <span className="font-mono">xero_invoices</span> ACCPAY bills (status=AUTHORISED) across 7 decision states.
                Each move writes to <span className="font-mono">act_payable_decisions</span>. Oldest bills surface first.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <Link
                  href={`/org/${slug}`}
                  className="border border-white/20 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
                >
                  Dashboard
                </Link>
                <Link
                  href={`/org/${slug}/pipeline`}
                  className="border border-white/20 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
                >
                  Grant pipeline
                </Link>
              </div>
              <div className="text-[11px] font-mono text-gray-300 text-right">
                {data.totals.bill_count} bills · {fmtMoney(data.totals.total)} total · {fmtMoney(data.totals.overdue_60d_total)} overdue 60d+ ({data.totals.overdue_60d_count} bills)
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-8">
        <PayablesKanban cards={data.cards} totals={data.totals} />
      </div>
    </main>
  );
}
