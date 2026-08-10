import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, fastProjectFromWiki, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getWikiSupportProject } from '@/lib/services/wiki-support-index';
import { getGoodsGrantsTriage } from '@/lib/services/goods-grants-triage';
import { COMMUNITY_PATHWAYS, isPortfolioEligible } from '@/lib/services/goods-investment-portfolio';
import { GoodsSubNav } from './_components/goods-sub-nav';
import { ActProjectFieldMapScreen } from '../[projectSlug]/act-project-field-map';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — This week', description: 'What has a name, an owner and a date against it.' };
}

/** Screens reachable from the rail, kept as a plain list so the front door
 *  stays a worklist rather than a directory of twenty-two tiles. */
/** The merged-away screens. Still live, still reachable — they just lost their
 *  nav slot in the 2026-08-10 cull (26 routes → 8 in the rail). The four killed
 *  ones live in `_archive/2026-08-10-goods-tab-cull/` and are not listed. */
const MORE_SCREENS: ReadonlyArray<readonly [string, string]> = [
  ['today', 'Today'],
  ['matters', 'Matters'],
  ['applications', 'Applications'],
  ['learning', 'Learning'],
  ['engagement', 'Engagement'],
  ['insight', 'Funder insight'],
  ['intros', 'Warm intros'],
  ['signals', 'Signals'],
  ['timeline', 'Timeline'],
  ['campaign', 'Campaign'],
  ['map', 'On the map'],
  ['channels', 'Channels'],
  ['governance', 'Governance'],
];

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export default async function GoodsHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const fastNavigation = shouldUseFastLocalOrg(typeof sp.full === 'string' ? sp.full : undefined);
  const wantFieldMap = process.env.ACT_E2E_FIXTURES === '1' || typeof sp.fieldmap === 'string';
  if (fastNavigation && isActSlug(slug) && wantFieldMap) {
    const wikiProject = getWikiSupportProject('goods');
    return (
      <ActProjectFieldMapScreen
        profile={ACT_FAST_PROFILE}
        project={fastProjectFromWiki('goods', wikiProject)}
        slug="act"
        projectSlug="goods"
      />
    );
  }

  const profile = fastNavigation && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  // Scored Goods fit, not focus_areas overlap. The overlap filter surfaced
  // Screen Territory and Rural Health rounds — noise that made the page a liar
  // (2026-08-10). goods_relevance_score is what Grants Triage ranks on.
  const triageR = await Promise.allSettled([getGoodsGrantsTriage({ minFit: 60, scope: 'closing' })]);
  const triage = triageR[0].status === 'fulfilled' ? triageR[0].value : null;

  // Community first: unowned pathways lead, because naming an owner is the only
  // move that unblocks everything downstream.
  const pathways = [...COMMUNITY_PATHWAYS].sort((a, b) => {
    const aBlocked = a.relationshipOwner ? 1 : 0;
    const bBlocked = b.relationshipOwner ? 1 : 0;
    return aBlocked - bBlocked;
  });
  const unowned = pathways.filter((p) => !p.relationshipOwner);

  // Money with an actual date AND a real fit. Rolling/undated rounds are not
  // this week's work, and a low-fit round is not Goods money at all.
  const closing = (triage?.grants ?? [])
    .map((g) => ({ ...g, days: g.daysToDeadline ?? daysUntil(g.deadline) }))
    .filter((g) => g.days !== null && g.days >= 0 && g.days <= 60 && (g.goodsScore ?? 0) >= 60)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-[1760px] px-4 py-8">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <nav className="flex items-center gap-2 text-[11px] text-white/50">
              <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
              <span aria-hidden="true">/</span>
              <span className="text-white/80">Goods</span>
            </nav>
            <h1 className="text-xl font-black tracking-tight">This week</h1>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
              Name · owner · date, or it is not on this page
            </span>
          </div>
          <GoodsSubNav slug={slug} />
        </div>
      </div>

      <div className="mx-auto max-w-[1480px] px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ---------------------------------------------------------- community */}
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Community</h2>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-300 bg-white">
              {pathways.map((p) => {
                const blocked = !p.relationshipOwner;
                return (
                  <Link
                    key={p.id}
                    href={`/org/${slug}/goods/portfolio`}
                    className="flex items-baseline gap-3 border-t border-slate-200 px-4 py-2.5 text-xs first:border-t-0 hover:bg-slate-50"
                  >
                    <span className="w-40 shrink-0 truncate font-semibold text-slate-900">{p.community}</span>
                    <span className={`w-36 shrink-0 truncate text-[11px] ${blocked ? 'font-bold text-bauhaus-red' : 'text-slate-500'}`}>
                      {blocked ? 'NOBODY OWNS THIS' : p.relationshipOwner}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-700">
                      {blocked ? 'Name an owner' : p.nextDecision}
                    </span>
                  </Link>
                );
              })}
            </div>
            {unowned.length > 0 ? (
              <p className="mt-2 text-xs text-slate-600">
                <span className="font-semibold text-bauhaus-red">{unowned.length} of {pathways.length} have no owner.</span>{' '}
                Until someone is named, no application work on them is real.
              </p>
            ) : null}
          </section>

          {/* -------------------------------------------------------------- money */}
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Money with a date</h2>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-300 bg-white">
              {closing.length === 0 ? (
                <p className="px-4 py-4 text-xs text-slate-600">
                  Nothing scoring 60+ for Goods fit closes in the next 60 days.
                </p>
              ) : (
                closing.map((o) => (
                  <div key={o.id} className="flex items-baseline gap-3 border-t border-slate-200 px-4 py-2.5 text-xs first:border-t-0">
                    <span className={`w-12 shrink-0 font-mono text-[11px] font-bold ${(o.days ?? 99) <= 14 ? 'text-bauhaus-red' : 'text-slate-500'}`}>
                      {o.days}d
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{o.name}</span>
                    <span className="w-32 shrink-0 truncate text-[11px] text-slate-500">{o.provider ?? '—'}</span>
                    <span className="w-10 shrink-0 text-right font-mono text-[11px] text-slate-600">fit {o.goodsScore ?? '—'}</span>
                  </div>
                ))
              )}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Deadline-bearing rounds only. <Link href={`/org/${slug}/goods/grants`} className="underline">Grants triage</Link> holds
              the rolling and undated ones.
            </p>
          </section>
        </div>

        {/* ------------------------------------------------- the honest blocker */}
        <div className="mt-6 rounded-xl border border-bauhaus-red/40 bg-[#fff5f4] px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-bauhaus-red">Why this page is short</div>
          <p className="mt-1 text-xs leading-5 text-slate-800">
            All 125 pipeline rows carry <strong>no owner, no next action and no date</strong> — those columns exist in{' '}
            <code className="font-mono">org_pipeline</code> and are entirely empty. Relationship state lives in GoHighLevel and nothing mirrors it back here, so CivicGraph can
            report scale but cannot tell you the next move. Fixing that mirror is what would make this page long.
          </p>
        </div>

        {/* ------------------------------------------------------------ the rest */}
        <details className="mt-6 rounded-xl border border-slate-300 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-800 hover:bg-slate-50">
            Everything else — {MORE_SCREENS.length} more screens
          </summary>
          <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-3">
            {MORE_SCREENS.map(([path, label]) => (
              <Link
                key={path}
                href={`/org/${slug}/goods/${path}`}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              >
                {label}
              </Link>
            ))}
          </div>
        </details>
      </div>
    </main>
  );
}
