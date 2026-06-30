import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsRelationships, summarize } from '@/lib/services/goods-engagement';
import {
  warmthBand, bandFill, bandPill, money, moneyShort,
  REL_TYPE_LABEL, BANDS, TYPES,
  type GoodsRelType, type WarmthBand,
} from '@/lib/services/goods-engagement-shared';
import { RelationshipCard } from './relationship-card';
import { AddPartnerForm } from './add-partner-form';
import { GoodsSubNav } from '../_components/goods-sub-nav';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Engagement & Warmth Map' };
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`border-4 ${accent ? 'border-bauhaus-blue bg-link-light' : 'border-bauhaus-black bg-white'} p-3`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
      <div className="mt-1 text-2xl font-black text-bauhaus-black">{value}</div>
    </div>
  );
}

export default async function GoodsEngagementPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; band?: string }>;
}) {
  const { slug } = await params;
  const { type, band } = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const activeType = (TYPES.includes(type as GoodsRelType) ? type : 'all') as GoodsRelType | 'all';
  const activeBand = (BANDS.includes(band as WarmthBand) ? band : null) as WarmthBand | null;
  // The full set drives the summary + distribution bar; the band filter only narrows the list.
  const allRows = await getGoodsRelationships(activeType === 'all' ? undefined : { type: activeType });
  const summary = summarize(allRows);
  const rows = activeBand ? allRows.filter((r) => warmthBand(r.warmth_display) === activeBand) : allRows;

  // Open-ask pipeline (only meaningful once the ask columns are migrated; skip silently when all null).
  const openAsks = allRows.filter((r) => (r.ask_amount_aud ?? 0) > 0);
  const openAskTotal = openAsks.reduce((s, r) => s + (r.ask_amount_aud ?? 0), 0);

  const typeQs = activeType === 'all' ? '' : `type=${activeType}`;
  const bandHref = (b: WarmthBand) => {
    const qs = [typeQs, activeBand === b ? '' : `band=${b}`].filter(Boolean).join('&');
    return `/org/${slug}/goods/engagement${qs ? `?${qs}` : ''}`;
  };

  const grouped = BANDS.map((band) => ({ band, items: rows.filter((r) => warmthBand(r.warmth_display) === band) }))
    .filter((g) => g.items.length > 0);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Engagement</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Engagement & Warmth Map</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            Everyone Goods is engaged with — funders, investors, finance, production partners and buyers — scored by
            <strong className="text-white"> warmth</strong> (how close we are) with the
            <strong className="text-white"> next best action</strong> to get closer. Hybrid score: computed from stage, recency,
            history and alignment, with manual override.
          </p>
          <GoodsSubNav slug={slug} active="engagement" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* portfolio */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Relationships" value={String(summary.total)} accent />
          <Stat label="Received (lifetime)" value={money(summary.totalReceived)} />
          <Stat label="Active asks" value={String(summary.activeAsks)} />
          <Stat label="Need re-warm (>60d)" value={String(summary.needsReWarm)} accent />
          <Stat label="Champions + Hot" value={String(summary.byBand.Champion + summary.byBand.Hot)} />
        </div>

        {/* warmth distribution — each band links to filter the list by that band */}
        <div className="mb-4 border-4 border-bauhaus-black bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Warmth distribution</span>
            {activeBand && (
              <Link href={bandHref(activeBand)} className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline">
                Clear band filter ×
              </Link>
            )}
          </div>
          <div className="flex h-6 w-full overflow-hidden">
            {BANDS.map((b) => {
              const n = summary.byBand[b];
              const pct = summary.total ? (n / summary.total) * 100 : 0;
              if (!n) return null;
              const isActive = activeBand === b;
              return (
                <Link
                  key={b}
                  href={bandHref(b)}
                  className={`flex items-center justify-center ${bandFill(b)} text-[10px] font-black text-white transition-opacity hover:opacity-80 ${activeBand && !isActive ? 'opacity-40' : ''} ${isActive ? 'ring-2 ring-inset ring-bauhaus-black' : ''}`}
                  style={{ width: `${pct}%` }}
                  title={`${b}: ${n} — click to filter`}
                >
                  {pct > 7 ? `${b} ${n}` : n}
                </Link>
              );
            })}
          </div>
          {openAsks.length > 0 && (
            <div className="mt-2 text-[11px] font-bold text-bauhaus-black">
              Open asks: <span className="font-black text-bauhaus-blue">{moneyShort(openAskTotal)}</span> across {openAsks.length} relationship{openAsks.length === 1 ? '' : 's'}.
            </div>
          )}
        </div>

        {/* type filter + add partner */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {TYPES.map((t) => {
            const active = activeType === t;
            const label = t === 'all' ? 'All' : REL_TYPE_LABEL[t as GoodsRelType];
            const count = t === 'all' ? summary.total : summary.byType.find((x) => x.type === t)?.count ?? 0;
            const bandQs = activeBand ? `band=${activeBand}` : '';
            const typeQs2 = t === 'all' ? '' : `type=${t}`;
            const qs = [typeQs2, bandQs].filter(Boolean).join('&');
            return (
              <Link
                key={t}
                href={`/org/${slug}/goods/engagement${qs ? `?${qs}` : ''}`}
                className={`border-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${active ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/30 bg-white text-bauhaus-black hover:border-bauhaus-black'}`}
              >
                {label} {count > 0 && <span className={active ? 'text-bauhaus-yellow' : 'text-bauhaus-muted'}>{count}</span>}
              </Link>
            );
          })}
          <div className="ml-auto"><AddPartnerForm slug={slug} /></div>
        </div>

        {/* grouped list */}
        {rows.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted">
            No relationships{activeType !== 'all' ? ' of this type' : ''}{activeBand ? ` in the ${activeBand} band` : ''} yet.
            {activeBand && ' Clear the band filter to see the rest.'}
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(({ band, items }) => (
              <div key={band} className="border-4 border-bauhaus-black bg-white">
                <div className="flex items-center justify-between border-b-4 border-bauhaus-black px-3 py-2">
                  <span className={`px-2 py-0.5 text-[11px] font-black uppercase tracking-widest ${bandPill(band)}`}>{band}</span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">{items.length}</span>
                </div>
                <div>{items.map((r) => <RelationshipCard key={r.id} r={r} slug={slug} />)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          Seeded from <code>org_pipeline</code> (ACT-GD deals), <code>saved_foundations</code> and engaged
          <code> goods_procurement_entities</code>; warm-intro paths from the board-interlock graph. Edit any row to set
          stage / warmth override / next action. Plan: <code>thoughts/shared/plans/goods-command-center-2026-06-09.md</code>.
        </div>
      </div>
    </main>
  );
}
