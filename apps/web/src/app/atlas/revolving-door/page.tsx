import Link from 'next/link';
import { listRevolvingDoor } from '@/lib/atlas/revolving-door';
import { money } from '@/lib/atlas/format';

export const revalidate = 3600;

export const metadata = {
  title: 'Revolving Door Explorer — CivicGraph Atlas',
  description:
    'Australian entities active across lobbying, political donations, government contracts, and government funding. Ranked by revolving-door score.',
};

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
const VECTORS = [
  { key: 'lobbies', label: 'Lobbies' },
  { key: 'donates', label: 'Donates' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'receives_funding', label: 'Funded' },
] as const;

type SearchParams = { state?: string; vector?: string; min?: string };

export default async function RevolvingDoorAtlasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const stateFilter = params.state && STATES.includes(params.state) ? params.state : null;
  const vectorFilter = (VECTORS.find((v) => v.key === params.vector)?.key ?? null) as
    | 'lobbies' | 'donates' | 'contracts' | 'receives_funding' | null;
  const minVectors = params.min ? Math.max(2, Math.min(4, Number(params.min) || 2)) : null;

  const rows = await listRevolvingDoor({ limit: 100, state: stateFilter, vector: vectorFilter, minVectors });

  const buildHref = (next: Partial<SearchParams>) => {
    const merged: SearchParams = { ...params, ...next };
    const qs = new URLSearchParams();
    if (merged.state) qs.set('state', merged.state);
    if (merged.vector) qs.set('vector', merged.vector);
    if (merged.min) qs.set('min', merged.min);
    const s = qs.toString();
    return s ? `/atlas/revolving-door?${s}` : '/atlas/revolving-door';
  };

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/atlas" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Atlas
        </Link>

        <header className="mt-4 mb-10 border-b-4 border-bauhaus-black pb-8">
          <div className="inline-block bg-bauhaus-blue text-white px-3 py-1 text-xs font-black uppercase tracking-widest mb-4">
            CivicGraph Atlas · v1
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-bauhaus-black leading-none">
            Revolving<br />Door
          </h1>
          <p className="mt-6 text-lg font-medium text-bauhaus-black max-w-3xl leading-relaxed">
            Entities active across two or more influence vectors: lobbying the federal register,
            donating to political parties, holding government contracts, and receiving government
            funding. Higher score = more vectors and larger dollar footprint.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-widest">
            <Link
              href="/atlas/revolving-door/methodology"
              className="border-2 border-bauhaus-black px-4 py-2 hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Methodology
            </Link>
            <a
              href="/api/v1/public/revolving-door?limit=100"
              className="border-2 border-bauhaus-black px-4 py-2 hover:bg-bauhaus-blue hover:text-white transition-colors"
            >
              JSON download
            </a>
          </div>
        </header>

        <section className="mb-8">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">Filter by vector</div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildHref({ vector: undefined })}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black ${vectorFilter === null ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black'}`}
            >
              All
            </Link>
            {VECTORS.map((v) => (
              <Link
                key={v.key}
                href={buildHref({ vector: v.key })}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black ${vectorFilter === v.key ? 'bg-bauhaus-red text-white border-bauhaus-red' : 'bg-white text-bauhaus-black'}`}
              >
                {v.label}
              </Link>
            ))}
          </div>

          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mt-6 mb-3">Filter by state</div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildHref({ state: undefined })}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black ${stateFilter === null ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black'}`}
            >
              All
            </Link>
            {STATES.map((s) => (
              <Link
                key={s}
                href={buildHref({ state: s })}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black ${stateFilter === s ? 'bg-bauhaus-black text-white' : 'bg-white text-bauhaus-black'}`}
              >
                {s}
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white border-4 border-bauhaus-black shadow-[8px_8px_0_0_#121212] overflow-x-auto">
          <div className="bg-bauhaus-black text-white px-4 py-3">
            <h2 className="text-sm font-black uppercase tracking-widest">Top 100 entities by revolving-door score</h2>
          </div>
          <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="border-b-2 border-bauhaus-black bg-bauhaus-canvas">
                <th className="text-left px-3 py-2 font-black uppercase text-[11px] tracking-widest">#</th>
                <th className="text-left px-3 py-2 font-black uppercase text-[11px] tracking-widest">Entity</th>
                <th className="text-left px-3 py-2 font-black uppercase text-[11px] tracking-widest">ABN</th>
                <th className="text-left px-3 py-2 font-black uppercase text-[11px] tracking-widest">State</th>
                <th className="text-center px-3 py-2 font-black uppercase text-[11px] tracking-widest">Vectors</th>
                <th className="text-right px-3 py-2 font-black uppercase text-[11px] tracking-widest">Donations</th>
                <th className="text-right px-3 py-2 font-black uppercase text-[11px] tracking-widest">Contracts</th>
                <th className="text-right px-3 py-2 font-black uppercase text-[11px] tracking-widest">Funding</th>
                <th className="text-right px-3 py-2 font-black uppercase text-[11px] tracking-widest">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 font-medium text-bauhaus-muted">
                    No entities match these filters.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.gs_id} className="border-b border-bauhaus-black/15 hover:bg-bauhaus-canvas/50">
                  <td className="px-3 py-2 font-black text-bauhaus-muted">{i + 1}</td>
                  <td className="px-3 py-2 font-bold">
                    <Link href={`/atlas/revolving-door/${r.gs_id}`} className="text-bauhaus-blue hover:underline">
                      {r.canonical_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.abn ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.state ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex gap-1">
                      <VectorBadge active={r.lobbies} label="L" tooltip="Lobbies" />
                      <VectorBadge active={r.donates} label="D" tooltip="Donates" />
                      <VectorBadge active={r.contracts} label="C" tooltip="Contracts" />
                      <VectorBadge active={r.receives_funding} label="F" tooltip="Receives funding" />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{r.total_donated > 0 ? money(r.total_donated) : '—'}</td>
                  <td className="px-3 py-2 text-right">{r.total_contracts > 0 ? money(r.total_contracts) : '—'}</td>
                  <td className="px-3 py-2 text-right">{r.total_funded > 0 ? money(r.total_funded) : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-block px-2 py-0.5 font-black text-white bg-bauhaus-red">
                      {r.revolving_door_score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="mt-10 text-xs text-bauhaus-muted font-medium">
          Source: <code className="font-mono">mv_revolving_door</code> · built from AusTender, AEC,
          justice funding, and federal lobbying register. Updated nightly.
        </footer>
      </div>
    </div>
  );
}

function VectorBadge({ active, label, tooltip }: { active: boolean; label: string; tooltip: string }) {
  return (
    <span
      title={tooltip}
      className={`inline-block w-5 h-5 text-[10px] font-black border border-bauhaus-black text-center leading-[18px] ${active ? 'bg-bauhaus-red text-white' : 'bg-bauhaus-canvas text-bauhaus-muted/40'}`}
    >
      {label}
    </span>
  );
}
