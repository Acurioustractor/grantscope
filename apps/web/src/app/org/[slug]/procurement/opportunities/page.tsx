import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { ACT_FAST_PROFILE, isActSlug } from '@/lib/services/fast-local-org';
import { getProcurementBuyersData, type ProcurementBuyer } from '@/lib/services/procurement-buyers-service';
import { getActSurfaceCounts } from '@/lib/services/act-surface-counts';
import { ActSurfaceNav } from '../../_components/act-surface-nav';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Procurement Opportunities — Buyer Prospects',
  description: 'Government buyers procuring ACT-deliverable work (data, intelligence, evaluation, evidence).',
};

const HEAT_CLASSES: Record<ProcurementBuyer['heat'], string> = {
  HOT: 'bg-bauhaus-red text-white',
  WARM: 'bg-bauhaus-yellow text-bauhaus-black',
  COOL: 'bg-gray-300 text-bauhaus-black',
  COLD: 'bg-gray-200 text-bauhaus-muted',
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function ProcurementOpportunitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const profile = (await getOrgProfileBySlug(slug)) ?? (isActSlug(slug) ? ACT_FAST_PROFILE : null);
  if (!profile) notFound();

  const heatParam = typeof sp.heat === 'string' ? sp.heat.toUpperCase() : null;
  const heatFilter =
    heatParam === 'HOT' || heatParam === 'WARM' || heatParam === 'COOL' || heatParam === 'COLD'
      ? (heatParam as ProcurementBuyer['heat'])
      : undefined;

  const minSpendParam = typeof sp.min === 'string' ? Number(sp.min) : null;
  const minSpend = Number.isFinite(minSpendParam) && (minSpendParam ?? 0) > 0 ? (minSpendParam as number) : 50_000;

  const [{ buyers, totals }, counts] = await Promise.all([
    getProcurementBuyersData({ limit: 200, minSpend, heatFilter }),
    getActSurfaceCounts(slug),
  ]);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">
            Procurement
          </p>
          <h1 className="text-2xl font-black uppercase tracking-wider mt-1">
            Buyer Prospects
          </h1>
          <p className="mt-1 text-[11px] font-mono text-gray-300">
            {totals.buyer_count} buyers · {fmtMoney(totals.total_spend)} total relevant spend ·{' '}
            {totals.contracts_total.toLocaleString()} contracts · {totals.hot} hot / {totals.warm} warm / {totals.cool} cool / {totals.cold} cold
          </p>
          <div className="mt-6">
            <ActSurfaceNav slug={slug} current="procurement" counts={counts} />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-4 flex gap-2 flex-wrap text-[10px] font-black uppercase tracking-widest">
          <Link
            href={`/org/${slug}/procurement/opportunities`}
            className={`px-3 py-1.5 border-2 ${!heatFilter ? 'bg-white text-bauhaus-black border-white' : 'text-white border-white hover:bg-white hover:text-bauhaus-black'}`}
          >
            All
          </Link>
          {(['HOT', 'WARM', 'COOL', 'COLD'] as const).map((h) => (
            <Link
              key={h}
              href={`/org/${slug}/procurement/opportunities?heat=${h}`}
              className={`px-3 py-1.5 border-2 ${heatFilter === h ? `${HEAT_CLASSES[h]} border-white` : 'text-white border-white hover:bg-white hover:text-bauhaus-black'}`}
            >
              {h}
            </Link>
          ))}
          <span className="ml-auto text-gray-400 font-mono">min spend ${minSpend.toLocaleString()}</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {buyers.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-12 text-center font-mono text-sm">
            No buyers match the current filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {buyers.map((b) => (
              <BuyerCard key={b.buyer_name} buyer={b} />
            ))}
          </div>
        )}

        <div className="mt-8 text-[10px] font-mono text-bauhaus-muted leading-relaxed">
          <p>
            Source: <code>v_act_procurement_buyers</code> from <code>austender_contracts</code>.
            Filters: contracts ≥$25K, published in last 3 years, title or description matches at
            least one of: data/analytics/dashboard/intelligence/evaluation/evidence/research/mapping/consultation/storytelling/indigenous.
            Buyers shown have ≥2 relevant contracts.
          </p>
          <p className="mt-2">
            Fit score: 40pt recency + 30pt scale + 30pt topic relevance. Heat: HOT (3+ contracts last 6mo) / WARM (3+ last year) / COOL (1+ last year) / COLD (no recent).
          </p>
        </div>
      </div>
    </main>
  );
}

function BuyerCard({ buyer }: { buyer: ProcurementBuyer }) {
  return (
    <article className="border-4 border-bauhaus-black bg-white">
      <header className="border-b-4 border-bauhaus-black p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-black uppercase tracking-wide leading-tight">
            {buyer.buyer_name}
          </h2>
          <div className="flex gap-1 flex-shrink-0">
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${HEAT_CLASSES[buyer.heat]}`}>
              {buyer.heat}
            </span>
            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest tabular-nums bg-bauhaus-black text-white">
              Fit {buyer.fit_score}
            </span>
          </div>
        </div>
      </header>

      <div className="border-b-4 border-bauhaus-black p-4 grid grid-cols-3 gap-3 text-center">
        <Stat label="Spend (3y)" value={fmtMoney(buyer.total_relevant_spend)} highlight />
        <Stat label="Contracts" value={String(buyer.contract_count)} />
        <Stat label="Last yr" value={String(buyer.contracts_last_year)} />
      </div>

      <div className="border-b-4 border-bauhaus-black p-4 grid grid-cols-3 gap-3 text-center">
        <Stat label="Avg $" value={fmtMoney(buyer.avg_contract_value)} />
        <Stat label="Max $" value={fmtMoney(buyer.max_contract_value)} />
        <Stat label="Topic" value={buyer.avg_topic_score.toFixed(1)} />
      </div>

      {buyer.top_categories && (
        <div className="border-b-4 border-bauhaus-black p-4">
          <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
            Top categories
          </div>
          <div className="text-[11px] font-mono leading-relaxed">{buyer.top_categories}</div>
        </div>
      )}

      {buyer.recent_contract_titles && buyer.recent_contract_titles.length > 0 && (
        <div className="p-4">
          <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">
            Recent contracts · last published {fmtDate(buyer.most_recent_contract)}
          </div>
          <ul className="space-y-1 text-[11px] font-mono leading-snug">
            {buyer.recent_contract_titles.slice(0, 3).map((t, i) => (
              <li key={i} className="line-clamp-1" title={t}>
                · {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border-2 border-bauhaus-black p-2">
      <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
      <div className={`text-base font-black tabular-nums mt-0.5 ${highlight ? 'text-bauhaus-red' : ''}`}>
        {value}
      </div>
    </div>
  );
}
