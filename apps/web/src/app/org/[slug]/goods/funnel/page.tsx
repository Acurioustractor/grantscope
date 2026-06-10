import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsFunnel, SPINE, SPINE_LABELS, type PipelineFunnel } from '@/lib/services/goods-funnel';
import { GoodsSubNav } from '../_components/goods-sub-nav';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods Funnel — need · procurement · support' };
}

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('en-AU')}`;
const num = (n: number) => (n || 0).toLocaleString('en-AU');

function Stat({ label, beds, washers, value, accent }: { label: string; beds?: number | null; washers?: number | null; value?: number | null; accent?: boolean }) {
  return (
    <div className={`border-4 ${accent ? 'border-bauhaus-blue bg-link-light' : 'border-bauhaus-black bg-white'} p-3`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-bauhaus-black">
        {beds != null && <span className="text-lg font-black">{num(beds)} <span className="text-xs font-bold">beds</span></span>}
        {washers != null && <span className="text-sm font-black">{num(washers)} <span className="text-[10px] font-bold">wash</span></span>}
        {value != null && <span className="text-sm font-black text-bauhaus-blue">{money(value)}</span>}
      </div>
    </div>
  );
}

function FunnelColumn({ p }: { p: PipelineFunnel }) {
  const max = Math.max(1, ...SPINE.filter(s => s !== 'dead').map(s => p.spine[s].n));
  return (
    <div className="border-4 border-bauhaus-black bg-white p-3">
      <div className="mb-2">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black">{p.label}</div>
        <div className="text-[11px] text-bauhaus-muted">
          {p.total} open · {p.beds ? `${num(p.beds)} beds · ` : ''}{p.washers ? `${num(p.washers)} wash · ` : ''}{p.value ? money(p.value) : '$0'}
        </div>
      </div>
      <div className="space-y-1">
        {SPINE.map(s => {
          const c = p.spine[s];
          const isDead = s === 'dead';
          const w = isDead ? 0 : Math.round((c.n / max) * 100);
          return (
            <div key={s} className="flex items-center gap-2 text-[11px]">
              <div className="w-16 shrink-0 font-bold uppercase tracking-wide text-bauhaus-muted">{SPINE_LABELS[s]}</div>
              <div className="relative h-5 flex-1 bg-bauhaus-canvas">
                {!isDead && c.n > 0 && <div className="absolute inset-y-0 left-0 bg-bauhaus-blue/70" style={{ width: `${Math.max(w, 6)}%` }} />}
                <div className="absolute inset-0 flex items-center px-1.5 font-black text-bauhaus-black">
                  {c.n > 0 ? (
                    <span>{c.n}{c.beds ? ` · ${num(c.beds)}b` : ''}{c.washers ? ` · ${num(c.washers)}w` : ''}{c.value ? ` · ${money(c.value)}` : ''}</span>
                  ) : <span className="text-bauhaus-muted">—</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function GoodsFunnelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const f = await getGoodsFunnel();

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/wiki/goods-operating-system`} className="hover:text-white">Goods OS</Link>
            <span>/</span>
            <span className="text-white">Funnel</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Goods Funnel</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            One need, two funding routes, one delivery, in beds, washing machines and dollars. A community <strong className="text-white">need</strong> is met by a buyer who <strong className="text-white">pays</strong> (procurement) or a funder who <strong className="text-white">donates</strong> (support), both ending in <strong className="text-white">delivery</strong>.
          </p>
          <GoodsSubNav slug={slug} active="funnel" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Cockpit */}
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-black">Cockpit — curated priority slice (active + lead)</div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label={`Need (${f.need.communities} communities)`} beds={f.need.beds} washers={f.need.washers} accent />
          <Stat label="Ordered (Buyer)" beds={f.ordered.beds} washers={f.ordered.washers} value={f.ordered.value} />
          <Stat label="Funded (Supporter)" beds={f.funded.beds} washers={f.funded.washers} value={f.funded.value} />
          <Stat label="Delivered" beds={f.delivered.beds} washers={f.delivered.washers} />
          <Stat label="Gap (need − delivered)" beds={f.gap.beds} washers={f.gap.washers} accent />
        </div>
        <p className="mb-6 text-[11px] text-bauhaus-muted">
          Addressable demand (all {num(f.addressable.communities)} communities): {num(f.addressable.beds)} beds · {num(f.addressable.washers)} washers.
          Delivered is a cited constant — {f.delivered.source}.
          {!f.ghlConnected && <span className="text-bauhaus-red"> · GHL not connected in this environment — Ordered/Funded show 0.</span>}
        </p>

        {/* Funnel by pipeline, collapsed to the 5-stage spine */}
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-black">Pipelines — collapsed to the 5-stage spine</div>
        <div className="grid gap-3 lg:grid-cols-3">
          {f.pipelines.length === 0 ? (
            <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted lg:col-span-3">
              No live pipeline data (GHL not connected here). The cockpit above still shows need, delivered and gap from the data model.
            </div>
          ) : (
            f.pipelines.map(p => <FunnelColumn key={p.key} p={p} />)
          )}
        </div>

        <div className="mt-8 border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          The 3 GHL pipelines keep their own operational stages (Buyer 12 · Supporter 10 · Demand 4); this view collapses them to a shared spine by stage name. Need comes from <code>goods_communities</code> (the Demand Register tracks relationships, not quantities). As deals get scoped — beds/washers set on their GHL opps — Ordered/Funded fill in and the Gap closes.
        </div>
      </div>
    </main>
  );
}
