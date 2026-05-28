import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getFundingDesertByLga,
  getTopRecipientsForLga,
  slugToLgaState,
  listFundingDeserts,
} from '@/lib/atlas/funding-deserts';
import { money, moneyFull, num, decile, desertColor } from '@/lib/atlas/format';

export const revalidate = 3600;

type Params = { lga: string };

async function resolveLgaFromSlug(slug: string) {
  const parsed = slugToLgaState(slug);
  if (!parsed) return null;
  // Find an LGA in that state whose slugified name matches.
  const { rows } = await listFundingDeserts({ limit: 5000, state: parsed.state, sort: 'desert_score' });
  const match = rows.find((r) => {
    const candidate = r.lga_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return candidate === parsed.lgaSlug;
  });
  return match ?? null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { lga } = await params;
  const match = await resolveLgaFromSlug(lga);
  if (!match) return { title: 'LGA not found — CivicGraph Atlas' };
  return {
    title: `${match.lga_name}, ${match.state} — Funding Desert Profile — CivicGraph`,
    description: `Desert score ${match.desert_score.toFixed(0)} · ${money(match.total_funding)} total funding · ${num(match.indexed_entities)} indexed entities.`,
    openGraph: {
      title: `${match.lga_name}, ${match.state} — Funding Desert Profile`,
      description: `Desert score ${match.desert_score.toFixed(0)} · SEIFA ${decile(match.avg_irsd_decile)} · ${money(match.total_funding)} funding`,
    },
  };
}

export default async function LgaDeepPage({ params }: { params: Promise<Params> }) {
  const { lga: slug } = await params;
  const match = await resolveLgaFromSlug(slug);
  if (!match) notFound();

  const [profile, recipients] = await Promise.all([
    getFundingDesertByLga(match.lga_name, match.state),
    getTopRecipientsForLga(match.lga_name, match.state, 10),
  ]);

  const row = profile ?? match;
  const perEntity = row.indexed_entities > 0 ? row.total_funding / row.indexed_entities : null;

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/atlas/funding-deserts"
          className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black"
        >
          &larr; Funding Deserts Atlas
        </Link>

        <header className="mt-4 mb-10 border-b-4 border-bauhaus-black pb-8">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">
            {row.state} · {row.remoteness_modal ?? 'Mixed remoteness'}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-bauhaus-black leading-none">
            {row.lga_name}
          </h1>
          <div className="mt-4 inline-flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest">Desert score</span>
            <span
              className="inline-block px-3 py-1 font-black text-white text-xl"
              style={{ backgroundColor: desertColor(row.desert_score) }}
            >
              {row.desert_score.toFixed(0)}
            </span>
            <span className="text-xs font-medium text-bauhaus-muted">/ 200</span>
          </div>
        </header>

        {/* KPI cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <KpiCard label="Total funding" value={money(row.total_funding)} subtext={moneyFull(row.total_funding)} />
          <KpiCard label="Indexed entities" value={num(row.indexed_entities)} subtext={`${num(row.community_controlled_entities)} community-controlled`} />
          <KpiCard label="SEIFA IRSD" value={decile(row.avg_irsd_decile)} subtext={`min ${decile(row.min_irsd_decile)}`} />
          <KpiCard label="Funding / entity" value={perEntity !== null ? money(perEntity) : '—'} subtext={`${num(row.postcode_count)} postcodes`} />
        </section>

        {/* Funding mix */}
        <section className="mb-10 bg-white border-4 border-bauhaus-black p-6 shadow-[8px_8px_0_0_#121212]">
          <h2 className="text-sm font-black uppercase tracking-widest mb-4">Funding by source</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <FundingRow label="Procurement (AusTender)" amount={row.procurement_dollars} total={row.total_funding} color="#1040C0" />
            <FundingRow label="Justice funding" amount={row.justice_dollars} total={row.total_funding} color="#D02020" />
            <FundingRow label="Political donations" amount={row.donation_dollars} total={row.total_funding} color="#F0C020" />
          </div>
        </section>

        {/* Top recipients */}
        <section className="mb-10 bg-white border-4 border-bauhaus-black shadow-[8px_8px_0_0_#121212]">
          <div className="bg-bauhaus-black text-white px-4 py-3">
            <h2 className="text-sm font-black uppercase tracking-widest">Top entities (latest revenue)</h2>
          </div>
          <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="border-b-2 border-bauhaus-black bg-bauhaus-canvas">
                <th className="text-left px-3 py-2 font-black uppercase text-[11px] tracking-widest">Entity</th>
                <th className="text-left px-3 py-2 font-black uppercase text-[11px] tracking-widest">Type</th>
                <th className="text-left px-3 py-2 font-black uppercase text-[11px] tracking-widest">ABN</th>
                <th className="text-right px-3 py-2 font-black uppercase text-[11px] tracking-widest">Latest revenue</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 font-medium text-bauhaus-muted">
                    No indexed entities with revenue data in this LGA.
                  </td>
                </tr>
              )}
              {recipients.map((r) => (
                <tr key={r.gs_id} className="border-b border-bauhaus-black/15 hover:bg-bauhaus-canvas/50">
                  <td className="px-3 py-2 font-bold">
                    <Link href={`/entity/${r.gs_id}`} className="text-bauhaus-blue hover:underline">
                      {r.canonical_name}
                    </Link>
                    {r.is_community_controlled && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest bg-bauhaus-yellow border border-bauhaus-black">
                        Community
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-bauhaus-muted">{r.entity_type ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.abn ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Cite + download */}
        <section className="mt-10 bg-white border-4 border-bauhaus-black p-6">
          <h2 className="text-sm font-black uppercase tracking-widest mb-3">Cite + download</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <a
              href={`/api/v1/public/funding-deserts?lga=${encodeURIComponent(row.lga_name)}&state=${row.state}`}
              className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue hover:text-white"
            >
              JSON
            </a>
            <Link
              href="/atlas/funding-deserts/methodology"
              className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Methodology
            </Link>
          </div>
          <p className="text-xs font-medium text-bauhaus-muted leading-relaxed">
            CivicGraph (2026). {row.lga_name}, {row.state} — Funding Desert Profile.
            Retrieved from https://civicgraph.au/atlas/funding-deserts/{slug}
          </p>
        </section>
      </div>
    </div>
  );
}

function KpiCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="bg-white border-4 border-bauhaus-black p-5 shadow-[8px_8px_0_0_#121212]">
      <div className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
      <div className="mt-2 text-3xl font-black text-bauhaus-black" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {subtext && <div className="mt-1 text-xs font-medium text-bauhaus-muted">{subtext}</div>}
    </div>
  );
}

function FundingRow({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="border-2 border-bauhaus-black p-4">
      <div className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">{label}</div>
      <div className="text-2xl font-black" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(amount)}</div>
      <div className="mt-3 h-2 bg-bauhaus-canvas border border-bauhaus-black/30">
        <div className="h-full" style={{ backgroundColor: color, width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="mt-1 text-xs font-medium text-bauhaus-muted">{pct.toFixed(1)}% of total</div>
    </div>
  );
}
