import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsWarmIntros } from '@/lib/services/goods-warm-intros';
import { REL_TYPE_LABEL, type GoodsRelType } from '@/lib/services/goods-engagement-shared';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Warm Intros: who opens which door' };
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`border-4 ${accent ? 'border-bauhaus-blue bg-link-light' : 'border-bauhaus-black bg-white'} p-3`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
      <div className="mt-1 text-2xl font-black text-bauhaus-black">{value}</div>
    </div>
  );
}

function GoodsSubNav({ slug, active }: { slug: string; active: 'engagement' | 'money' | 'intros' }) {
  const tabs: [key: 'engagement' | 'money' | 'intros', label: string][] = [
    ['engagement', 'Warmth Map'],
    ['money', 'Money'],
    ['intros', 'Warm Intros'],
  ];
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {tabs.map(([key, label]) => (
        <Link
          key={key}
          href={`/org/${slug}/goods/${key}`}
          className={`border-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${
            active === key ? 'border-white bg-white text-bauhaus-black' : 'border-white/40 text-white hover:border-white'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export default async function GoodsIntrosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const { targets, summary } = await getGoodsWarmIntros();

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods/funnel`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Warm Intros</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Warm Intros</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            Who can open which door. For every funder and partner Goods is linked to, the
            <strong className="text-white"> board members</strong> who connect you — and where they
            <strong className="text-white"> also sit on a board you&apos;re already engaged with</strong>. Sourced from the
            CivicGraph board-interlock graph (39.7K interlocked people), gated for name-collision noise.
          </p>
          <GoodsSubNav slug={slug} active="intros" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Orgs with a path" value={String(summary.orgsWithIntros)} accent />
          <Stat label="Connectors found" value={String(summary.totalConnectors)} />
          <Stat label="Portfolio bridges" value={String(summary.portfolioBridges)} accent />
          <Stat label="Community-controlled" value={String(summary.communityControlled)} />
        </div>

        {targets.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted">
            No warm-intro paths yet. Link more relationships to graph entities, then refresh the board MVs.
          </div>
        ) : (
          <div className="space-y-4">
            {targets.map((t) => (
              <div key={t.relId} className="border-4 border-bauhaus-black bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-4 border-bauhaus-black px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black uppercase tracking-wide">{t.targetName}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                      {REL_TYPE_LABEL[t.relationshipType as GoodsRelType] ?? t.relationshipType}
                    </span>
                  </div>
                  {t.hasBridge && (
                    <span className="bg-bauhaus-blue px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                      Portfolio bridge
                    </span>
                  )}
                </div>
                <div>
                  {t.connectors.map((c, i) => (
                    <div
                      key={`${c.person}-${i}`}
                      className="flex flex-wrap items-start gap-x-4 gap-y-1 border-b border-bauhaus-black/10 px-3 py-2 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{c.person}</span>
                          <span className="text-[11px] text-bauhaus-muted">{c.role}</span>
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                              c.confidence === 'high'
                                ? 'bg-bauhaus-yellow text-bauhaus-black'
                                : 'bg-white text-bauhaus-muted border border-bauhaus-black/30'
                            }`}
                            title={`On ${c.boardCount} boards`}
                          >
                            {c.confidence === 'high' ? 'strong match' : `${c.boardCount} boards · verify`}
                          </span>
                          {c.communityControlled && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-bauhaus-canvas text-bauhaus-muted">
                              community-controlled
                            </span>
                          )}
                        </div>
                        {c.bridgesToGoods ? (
                          <div className="mt-0.5 text-[12px]">
                            <span className="font-bold text-bauhaus-blue">↔ also boards</span>{' '}
                            <span className="font-bold">{c.bridgesToGoods}</span>
                            <span className="text-bauhaus-muted"> — which you&apos;re already engaged with.</span>
                          </div>
                        ) : c.otherOrgs.length > 0 ? (
                          <div className="mt-0.5 text-[12px] text-bauhaus-muted">
                            also boards: {c.otherOrgs.join(' · ')}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          Connectors are board members shared between a Goods funder/partner and other organisations, from
          <code> mv_board_interlocks</code> + <code>mv_person_entity_network</code>. <strong>Collision gate:</strong> only
          people on 2&ndash;15 boards (generic names false-interlock across dozens). &ldquo;Verify&rdquo; = broader reach,
          sanity-check the person before reaching out. Refreshes with the nightly board MVs.
        </div>
      </div>
    </main>
  );
}
