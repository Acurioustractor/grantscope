import Link from 'next/link';
import { listFundingDeserts, lgaToSlug } from '@/lib/atlas/funding-deserts';
import { money, num, decile, desertColor } from '@/lib/atlas/format';

export const revalidate = 3600;

export const metadata = {
  title: 'Funding Deserts Atlas — CivicGraph',
  description:
    'Which Australian LGAs face structural disadvantage but receive the least funding? National atlas of funding deserts across procurement, justice, and donations.',
  openGraph: {
    title: 'Funding Deserts Atlas — CivicGraph',
    description: 'National atlas of funding deserts across Australian LGAs.',
    type: 'website',
  },
};

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

type SearchParams = { state?: string; sort?: string; remoteness?: string };

export default async function FundingDesertsAtlasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const stateFilter = params.state && STATES.includes(params.state) ? params.state : null;
  const remotenessFilter = params.remoteness ?? null;
  const sort = (['desert_score', 'total_funding', 'indexed_entities'].includes(params.sort ?? '')
    ? (params.sort as 'desert_score' | 'total_funding' | 'indexed_entities')
    : 'desert_score');

  const { rows, totalLgas } = await listFundingDeserts({
    limit: 50,
    state: stateFilter,
    remoteness: remotenessFilter,
    sort,
    order: sort === 'total_funding' ? 'asc' : 'desc',
  });

  const buildHref = (next: Partial<SearchParams>) => {
    const merged: SearchParams = { ...params, ...next };
    const qs = new URLSearchParams();
    if (merged.state) qs.set('state', merged.state);
    if (merged.sort) qs.set('sort', merged.sort);
    if (merged.remoteness) qs.set('remoteness', merged.remoteness);
    const s = qs.toString();
    return s ? `/atlas/funding-deserts?${s}` : '/atlas/funding-deserts';
  };

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/atlas"
          className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black"
        >
          &larr; Atlas
        </Link>

        {/* Hero */}
        <header className="mt-4 mb-10 border-b-4 border-bauhaus-black pb-8">
          <div className="inline-block bg-bauhaus-red text-white px-3 py-1 text-xs font-black uppercase tracking-widest mb-4">
            CivicGraph Atlas · v1
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-bauhaus-black leading-none">
            Funding<br />Deserts
          </h1>
          <p className="mt-6 text-lg font-medium text-bauhaus-black max-w-3xl leading-relaxed">
            Which Australian LGAs face the deepest structural disadvantage but receive
            the least funding? A national atlas covering {totalLgas.toLocaleString()} local government
            areas across procurement, justice, and political donations.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-widest">
            <Link
              href="/atlas/funding-deserts/methodology"
              className="border-2 border-bauhaus-black px-4 py-2 hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Methodology
            </Link>
            <a
              href="/api/v1/public/funding-deserts?limit=100"
              className="border-2 border-bauhaus-black px-4 py-2 hover:bg-bauhaus-blue hover:text-white transition-colors"
            >
              JSON download
            </a>
            <Link
              href="/docs/api"
              className="border-2 border-bauhaus-black px-4 py-2 hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Public API
            </Link>
          </div>
        </header>

        {/* Filters */}
        <section className="mb-8">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">Filter by state</div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildHref({ state: undefined })}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black ${stateFilter === null ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'}`}
            >
              All
            </Link>
            {STATES.map((s) => (
              <Link
                key={s}
                href={buildHref({ state: s })}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black ${stateFilter === s ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'}`}
              >
                {s}
              </Link>
            ))}
          </div>

          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-6 mb-3">Sort by</div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'desert_score', label: 'Desert score' },
                { key: 'total_funding', label: 'Least funding first' },
                { key: 'indexed_entities', label: 'Most entities' },
              ] as const
            ).map((s) => (
              <Link
                key={s.key}
                href={buildHref({ sort: s.key })}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black ${sort === s.key ? 'bg-bauhaus-red text-white border-bauhaus-red' : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'}`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Top 50 table */}
        <section className="bg-white border-4 border-bauhaus-black shadow-[8px_8px_0_0_#121212] overflow-x-auto">
          <div className="bg-bauhaus-black text-white px-4 py-3">
            <h2 className="text-sm font-black uppercase tracking-widest">
              Top 50 Funding Deserts {stateFilter ? `· ${stateFilter}` : '· Australia'}
            </h2>
          </div>
          <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="border-b-2 border-bauhaus-black bg-bauhaus-canvas">
                <th className="text-left px-3 py-2 font-black uppercase text-[11px] tracking-widest">#</th>
                <th className="text-left px-3 py-2 font-black uppercase text-[11px] tracking-widest">LGA</th>
                <th className="text-left px-3 py-2 font-black uppercase text-[11px] tracking-widest">State</th>
                <th className="text-left px-3 py-2 font-black uppercase text-[11px] tracking-widest">Remoteness</th>
                <th className="text-right px-3 py-2 font-black uppercase text-[11px] tracking-widest">SEIFA</th>
                <th className="text-right px-3 py-2 font-black uppercase text-[11px] tracking-widest">Indexed entities</th>
                <th className="text-right px-3 py-2 font-black uppercase text-[11px] tracking-widest">Total funding</th>
                <th className="text-right px-3 py-2 font-black uppercase text-[11px] tracking-widest">Desert score</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 font-medium text-bauhaus-muted">
                    No LGAs match these filters.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                const slug = lgaToSlug(r.lga_name, r.state);
                return (
                  <tr key={slug} className="border-b border-bauhaus-black/15 hover:bg-bauhaus-canvas/50">
                    <td className="px-3 py-2 font-black text-bauhaus-muted">{i + 1}</td>
                    <td className="px-3 py-2 font-bold">
                      <Link href={`/atlas/funding-deserts/${slug}`} className="text-bauhaus-blue hover:underline">
                        {r.lga_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.state}</td>
                    <td className="px-3 py-2 text-xs text-bauhaus-muted">{r.remoteness_modal ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{decile(r.avg_irsd_decile)}</td>
                    <td className="px-3 py-2 text-right">{num(r.indexed_entities)}</td>
                    <td className="px-3 py-2 text-right">{money(r.total_funding)}</td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className="inline-block px-2 py-0.5 font-black text-white"
                        style={{ backgroundColor: desertColor(r.desert_score) }}
                      >
                        {r.desert_score.toFixed(0)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Cite block */}
        <section className="mt-10 bg-white border-4 border-bauhaus-black p-6">
          <h2 className="text-sm font-black uppercase tracking-widest mb-3">Cite this</h2>
          <p className="text-sm font-medium leading-relaxed text-bauhaus-black mb-3">
            CivicGraph (2026). <em>Funding Deserts Atlas: Australian LGA disadvantage vs funding flow</em>. Retrieved from
            https://civicgraph.au/atlas/funding-deserts
          </p>
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">BibTeX</div>
          <pre className="bg-bauhaus-canvas border-2 border-bauhaus-black p-4 text-xs font-mono overflow-x-auto">
{`@misc{civicgraph_funding_deserts_2026,
  author = {CivicGraph},
  title  = {Funding Deserts Atlas},
  year   = {2026},
  url    = {https://civicgraph.au/atlas/funding-deserts}
}`}
          </pre>
        </section>

        <footer className="mt-10 text-xs text-bauhaus-muted font-medium">
          Source: <code className="font-mono">mv_funding_deserts</code> · {totalLgas.toLocaleString()} LGAs ·
          built from ACNC, AusTender, AEC, ATO Tax Transparency, ALMA, and SEIFA 2021. Updated nightly.
        </footer>
      </div>
    </div>
  );
}
