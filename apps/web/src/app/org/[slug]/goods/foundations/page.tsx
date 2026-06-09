import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsFoundationTargets } from '@/lib/services/goods-foundation-targets';
import { GoodsSubNav } from '../_components/goods-sub-nav';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Foundation Targets' };
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`border-4 ${accent ? 'border-bauhaus-blue bg-link-light' : 'border-bauhaus-black bg-white'} p-3`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
      <div className="mt-1 text-2xl font-black text-bauhaus-black">{value}</div>
    </div>
  );
}

function compactMoney(n: number | null): string {
  if (!n || n <= 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export default async function GoodsFoundationsPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const { filter } = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const bridgedOnly = filter === 'bridged';
  const { targets, summary } = await getGoodsFoundationTargets({ bridgedOnly });

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods/funnel`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Foundations</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Foundation Targets</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            The next philanthropy targets Goods isn&apos;t yet engaged with — ranked by
            <strong className="text-white"> theme-fit</strong> (Indigenous / enterprise / remote-regional / housing),
            a <strong className="text-white">warm board-bridge</strong> (a director you already share with one), DGR status
            and giving capacity. Drawn from {summary.total.toLocaleString('en-AU')} fit foundations across the 11K in CivicGraph.
          </p>
          <GoodsSubNav slug={slug} active="foundations" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Fit targets" value={summary.total.toLocaleString('en-AU')} accent />
          <Stat label="Warm bridges" value={String(summary.bridged)} accent />
          <Stat label="DGR-endorsed" value={String(summary.dgr)} />
          <Stat label="Showing" value={String(targets.length)} />
        </div>

        {/* filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/org/${slug}/goods/foundations`}
            className={`border-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${!bridgedOnly ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/30 bg-white text-bauhaus-black hover:border-bauhaus-black'}`}
          >
            Top fit
          </Link>
          <Link
            href={`/org/${slug}/goods/foundations?filter=bridged`}
            className={`border-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${bridgedOnly ? 'border-bauhaus-blue bg-bauhaus-blue text-white' : 'border-bauhaus-black/30 bg-white text-bauhaus-black hover:border-bauhaus-black'}`}
          >
            Warm bridge only {summary.bridged > 0 && <span className={bridgedOnly ? 'text-bauhaus-yellow' : 'text-bauhaus-muted'}>{summary.bridged}</span>}
          </Link>
        </div>

        {targets.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted">
            No targets{bridgedOnly ? ' with a warm bridge' : ''} yet.
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black bg-white">
            {targets.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-start gap-x-4 gap-y-1 border-b border-bauhaus-black/10 px-3 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black">{t.name}</span>
                    {t.hasDgr && (
                      <span className="bg-bauhaus-yellow px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-bauhaus-black">DGR</span>
                    )}
                    {t.matchedThemes.map((m) => (
                      <span key={m} className="bg-bauhaus-canvas px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">
                        {m.replace(/[-_]/g, ' ')}
                      </span>
                    ))}
                  </div>
                  {t.hasBridge && t.connector && (
                    <div className="mt-1 text-[12px]">
                      <span className="font-bold text-bauhaus-blue">Warm bridge:</span>{' '}
                      via <span className="font-bold">{t.connector}</span>
                      {t.bridgedOrg && <> — also boards <span className="font-bold">{t.bridgedOrg}</span>, which you&apos;re engaged with</>}
                    </div>
                  )}
                  {t.geographicFocus.length > 0 && (
                    <div className="mt-0.5 text-[11px] text-bauhaus-muted">{t.geographicFocus.slice(0, 4).join(' · ')}</div>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-lg font-black">{compactMoney(t.givingAnnual)}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">giving/yr</span>
                  {(t.grantMin || t.grantMax) && (
                    <span className="mt-0.5 text-[10px] text-bauhaus-muted">
                      grants {compactMoney(t.grantMin)}–{compactMoney(t.grantMax)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          Net-new targets only — foundations already in the warmth registry are excluded. Ranked by theme-fit +
          board-bridge (<code>v_goods_foundation_targets</code>, same 2&ndash;15 board collision gate as Warm Intros) + DGR +
          giving. Next: a one-click &ldquo;track&rdquo; to drop a target into the warmth map.
        </div>
      </div>
    </main>
  );
}
