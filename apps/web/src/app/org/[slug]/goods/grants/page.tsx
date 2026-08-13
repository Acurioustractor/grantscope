import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsGrantsTriage } from '@/lib/services/goods-grants-triage';
import { GoodsSubNav } from '../_components/goods-sub-nav';
import { GrantReviewTable } from './grant-review-table';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Grants Triage' };
}

function money(value: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

function relAgo(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

export default async function GoodsGrantsTriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ geo?: string; fit?: string; scope?: string; view?: string; q?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const minFit = sp.fit === 'high' ? 70 : undefined;
  const { grants, summary, sources, fundingBlocks } = await getGoodsGrantsTriage({
      orgProfileId: profile.id,
      geography: sp.geo,
      minFit,
      scope: sp.scope === 'closing' ? 'closing' : 'all',
      view: sp.view === 'review' ? 'review' : sp.view === 'dismissed' ? 'dismissed' : sp.view === 'all' ? 'all' : 'new',
      query: sp.q,
    });

  const base = `/org/${slug}/goods/grants`;
  const href = (patch: Record<string, string | undefined>) => {
    const merged = { q: sp.q, geo: sp.geo, fit: sp.fit, scope: sp.scope, view: sp.view, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const staleSources = sources.filter((s) => s.enabled && s.lastRunAt && Date.now() - new Date(s.lastRunAt).getTime() > 3 * 86_400_000);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-[1760px] px-4 py-8">
          <nav className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Grants Triage</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="text-xl font-black uppercase tracking-widest">Funding</h1><p className="mt-2 text-sm text-gray-300">Review what is new, promote what fits, and record why the rest does not.</p></div>
            <Link href={`/org/${slug}/funding`} className="border-2 border-white px-3 py-2 text-xs font-black uppercase hover:bg-white hover:text-bauhaus-black">All ACT projects</Link>
          </div>
          <GoodsSubNav slug={slug} active="grants" />
        </div>
      </div>

      <div className="mx-auto max-w-[1760px] px-4 py-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Cell label="New to review" value={summary.newTotal} accent />
          <Cell label="In review" value={summary.inReviewTotal} />
          <Cell label="Promoted" value={summary.promotedTotal} />
        </div>

        <section className="border-4 border-bauhaus-black bg-white p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Pill href={href({ view: undefined })} active={!sp.view || sp.view === 'new'} label={`New ${summary.newTotal}`} />
            <Pill href={href({ view: 'review' })} active={sp.view === 'review'} label={`Review ${summary.inReviewTotal}`} />
            <Pill href={href({ view: 'dismissed' })} active={sp.view === 'dismissed'} label={`Dismissed ${summary.dismissedTotal}`} />
            <Pill href={href({ view: 'all' })} active={sp.view === 'all'} label={`All ${summary.liveTotal}`} />
            <span className="mx-1 hidden h-5 border-l-2 border-bauhaus-black sm:block" />
            <Pill href={href({ scope: sp.scope === 'closing' ? undefined : 'closing' })} active={sp.scope === 'closing'} label="Closing 60d" />
            <Pill href={href({ fit: sp.fit === 'high' ? undefined : 'high' })} active={sp.fit === 'high'} label="Fit 70+" />
            <Pill href={href({ geo: sp.geo === 'NT' ? undefined : 'NT' })} active={sp.geo === 'NT'} label="NT" />
            <Pill href={href({ geo: sp.geo === 'National' ? undefined : 'National' })} active={sp.geo === 'National'} label="National" />
          </div>
          <form action={base} className="mt-3 flex gap-2">
            {sp.view && <input type="hidden" name="view" value={sp.view} />}
            <input name="q" defaultValue={sp.q} placeholder="Search opportunity, funder, place or requirement" className="min-h-10 min-w-0 flex-1 border-2 border-bauhaus-black px-3 text-sm" />
            <button className="border-2 border-bauhaus-black bg-bauhaus-black px-4 text-xs font-black uppercase text-white">Search</button>
            {sp.q && <Link href={href({ q: undefined })} className="grid min-h-10 place-items-center border-2 border-bauhaus-black px-3 text-xs font-black uppercase">Clear</Link>}
          </form>
        </section>

        {/* Table */}
        <GrantReviewTable grants={grants} orgProfileId={profile.id} fundingBlocks={fundingBlocks} />
        {grants.length === 300 && (
          <p className="text-[10px] font-bold text-bauhaus-muted">Showing the first 300 — tighten the filters to see the rest.</p>
        )}

        <details className="border-2 border-bauhaus-black bg-white">
          <summary className="cursor-pointer p-3 text-xs font-black uppercase tracking-widest">Coverage, capital need and source health</summary>
          <div className="border-t-2 border-bauhaus-black p-4">
          <div className="flex flex-wrap justify-between gap-3 text-xs"><span>{fundingBlocks.length} Goods funding blocks · {money(fundingBlocks.reduce((sum, block) => sum + Math.max(0, block.amountMaxAud - block.committedAud), 0))} maximum need remaining</span><Link href={`/org/${slug}/goods/capital`} className="font-black uppercase underline">Open capital plan</Link></div>
          <div className="mt-4 text-xs font-black uppercase tracking-widest">Search sources</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((s) => {
              const stale = s.enabled && s.lastRunAt && Date.now() - new Date(s.lastRunAt).getTime() > 3 * 86_400_000;
              return (
                <div key={s.agentId} className={`border-2 p-2 text-[11px] ${!s.enabled ? 'border-gray-300 bg-gray-100 text-gray-500' : stale ? 'border-bauhaus-red bg-red-50' : 'border-bauhaus-black/30'}`}>
                  <div className="font-mono font-black">{s.agentId}</div>
                  <div className="mt-0.5">
                    {s.enabled ? `every ${s.intervalHours}h` : 'disabled'} · last {relAgo(s.lastRunAt)}
                    {s.lastStatus && <span className={s.lastStatus === 'failed' ? ' text-bauhaus-red font-black' : ''}> · {s.lastStatus}{s.lastItemsNew != null ? ` (+${s.lastItemsNew})` : ''}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {staleSources.length > 0 && (
            <p className="mt-2 text-[11px] font-bold text-bauhaus-red">{staleSources.length} enabled source{staleSources.length === 1 ? '' : 's'} haven&apos;t run in 3+ days.</p>
          )}
          <p className="mt-4 text-[11px] text-bauhaus-muted">Live opportunities only. Fit is model-derived and eligibility must be verified. Publishing volume varies by jurisdiction; NT is checked daily and philanthropic programs remain the thinnest source stream.</p>
          </div>
        </details>
      </div>
    </main>
  );
}

function Cell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`border-4 border-bauhaus-black ${accent ? 'bg-bauhaus-yellow' : 'bg-white'} p-3`}>
      <div className="text-2xl font-black tabular-nums">{value.toLocaleString('en-AU')}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-700">{label}</div>
    </div>
  );
}

function Pill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`border-2 ${active ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-canvas'} px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider`}
    >
      {label}
    </Link>
  );
}
