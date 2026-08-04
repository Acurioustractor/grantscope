import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  getGoodsFunderScan,
  WARMTH_LABEL,
  WARMTH_ORDER,
  type FunderScanRow,
  type GhlWarmth,
} from '@/lib/services/goods-funder-scan';
import { GoodsSubNav } from '../../_components/goods-sub-nav';
import { ghlContactUrl } from '@/lib/ghl-links';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Funder Scan' };
}

function money(v: number | null): string {
  if (!v || v <= 0) return '—';
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}

const WARMTH_STYLE: Record<GhlWarmth, string> = {
  hot: 'bg-bauhaus-red text-white',
  warm: 'bg-bauhaus-yellow text-bauhaus-black',
  steady: 'bg-bauhaus-blue text-white',
  cooling: 'bg-bauhaus-canvas text-bauhaus-black border-2 border-bauhaus-black/30',
  cold: 'bg-gray-300 text-gray-700',
  not_in_ghl: 'bg-white text-gray-400 border-2 border-dashed border-gray-300',
};

function WarmthChip({ w }: { w: GhlWarmth }) {
  return (
    <span className={`px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider ${WARMTH_STYLE[w]}`}>
      {WARMTH_LABEL[w]}
    </span>
  );
}

export default async function GoodsFunderScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ warmth?: string; view?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const { rows, summary } = await getGoodsFunderScan();

  const base = `/org/${slug}/goods/foundations/scan`;
  const view = sp.view === 'unworked' ? 'unworked' : sp.view === 'unpushed' ? 'unpushed' : null;
  const warmthFilter = WARMTH_ORDER.includes(sp.warmth as GhlWarmth) ? (sp.warmth as GhlWarmth) : null;

  const shown: FunderScanRow[] =
    view === 'unworked' ? summary.warmButUnworked :
    view === 'unpushed' ? summary.hotButUnpushed :
    warmthFilter ? rows.filter((r) => r.ghlWarmth === warmthFilter) : rows;

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods/foundations`} className="hover:text-white">Foundations</Link>
            <span>/</span>
            <span className="text-white">Scan</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Funder Scan</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            Every foundation in the Goods discovery pipeline with its <strong className="text-white">GHL relationship
            state</strong> alongside. GHL is the system of record — the warmth chip is what GHL says, the stage is what
            discovery says, and the two mismatch views show where they disagree.
          </p>
          <GoodsSubNav slug={slug} active="foundations" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        {/* Warmth cells double as filters */}
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
          {WARMTH_ORDER.map((w) => {
            const active = warmthFilter === w && !view;
            return (
              <Link
                key={w}
                href={active ? base : `${base}?warmth=${w}`}
                className={`border-4 border-bauhaus-black p-3 transition-colors ${active ? 'bg-bauhaus-black text-white' : 'bg-white hover:bg-bauhaus-yellow'}`}
              >
                <div className="text-2xl font-black tabular-nums">{summary.byWarmth[w]}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-widest">{WARMTH_LABEL[w]}</div>
              </Link>
            );
          })}
        </div>

        {/* Mismatch views — the working artifacts */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-black uppercase tracking-wider">View:</span>
          <Link
            href={base}
            className={`border-2 px-2.5 py-1 font-black uppercase tracking-widest ${!view ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/30 bg-white hover:border-bauhaus-black'}`}
          >
            All {summary.total}
          </Link>
          <Link
            href={`${base}?view=unworked`}
            className={`border-2 px-2.5 py-1 font-black uppercase tracking-widest ${view === 'unworked' ? 'border-bauhaus-red bg-bauhaus-red text-white' : 'border-bauhaus-black/30 bg-white hover:border-bauhaus-black'}`}
            title="Warm or hot in GHL but saved/parked in discovery — discovery understates reality"
          >
            Warm but unworked {summary.warmButUnworked.length > 0 && <span className={view === 'unworked' ? 'text-bauhaus-yellow' : 'text-bauhaus-red'}>{summary.warmButUnworked.length}</span>}
          </Link>
          <Link
            href={`${base}?view=unpushed`}
            className={`border-2 px-2.5 py-1 font-black uppercase tracking-widest ${view === 'unpushed' ? 'border-bauhaus-blue bg-bauhaus-blue text-white' : 'border-bauhaus-black/30 bg-white hover:border-bauhaus-black'}`}
            title="High fit in discovery, no GHL contact — the push-next queue"
          >
            Push-next queue {summary.hotButUnpushed.length > 0 && <span className={view === 'unpushed' ? 'text-bauhaus-yellow' : 'text-bauhaus-blue'}>{summary.hotButUnpushed.length}</span>}
          </Link>
          <span className="ml-auto text-[10px] font-bold text-bauhaus-muted">
            {summary.synced}/{summary.total} synced from GHL
          </span>
        </div>

        {/* Table */}
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <Th>Foundation</Th>
                <Th>GHL warmth</Th>
                <Th>Discovery stage</Th>
                <Th align="right">Fit</Th>
                <Th align="right">Giving/yr</Th>
                <Th>Next step</Th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Nothing in this view.</td></tr>
              ) : (
                shown.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 1 ? 'bg-bauhaus-canvas' : ''}>
                    <td className="border-b border-gray-300 px-2 py-1.5 align-top">
                      <span className="font-black">{r.name}</span>
                      {r.ghlEmail && <div className="font-mono text-[10px] text-gray-500">{r.ghlEmail}</div>}
                    </td>
                    <td className="border-b border-gray-300 px-2 py-1.5 align-top">
                      {(() => {
                        const url = ghlContactUrl(r.ghlContactId);
                        return url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" title="Open contact in GHL" className="inline-flex items-center gap-1 hover:opacity-70">
                            <WarmthChip w={r.ghlWarmth} />
                            <span className="font-mono text-[10px] text-bauhaus-blue">↗</span>
                          </a>
                        ) : (
                          <WarmthChip w={r.ghlWarmth} />
                        );
                      })()}
                    </td>
                    <td className="border-b border-gray-300 px-2 py-1.5 align-top font-mono uppercase text-[10px]">{r.stage ?? '—'}</td>
                    <td className="border-b border-gray-300 px-2 py-1.5 align-top text-right font-mono font-black">{r.fitScore ?? '—'}</td>
                    <td className="border-b border-gray-300 px-2 py-1.5 align-top text-right font-mono">{money(r.givingAnnual)}</td>
                    <td className="border-b border-gray-300 px-2 py-1.5 align-top max-w-96">{r.nextStep || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          <p className="font-black uppercase tracking-wider">How to read this</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li><strong>GHL warmth is authoritative</strong> — it comes from the tags on the real contact with the email history. Discovery stage is CivicGraph&apos;s opinion.</li>
            <li><strong>Warm but unworked</strong> is money on the table: a live relationship discovery hasn&apos;t ranked. <strong>Push-next</strong> is the reverse: high-fit prospects nobody has contacted.</li>
            <li><strong>Pushing is deliberate</strong> — work the push-next queue by creating the contact in GHL itself (warmth chips link to synced contacts); there is no one-click push here by design.</li>
            <li>&ldquo;Not in GHL&rdquo; rows were checked against GHL only if synced — run <code className="bg-white px-1">scripts/reconcile-foundations-ghl.mjs</code> after rotating GHL_API_KEY to sync all rows.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`border-b-2 border-bauhaus-black px-2 py-1.5 text-left font-black uppercase tracking-wider text-[10px] ${align === 'right' ? 'text-right' : ''}`}>{children}</th>;
}
