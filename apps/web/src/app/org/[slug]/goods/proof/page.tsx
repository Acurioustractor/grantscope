import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsProof } from '@/lib/services/goods-proof';
import { GoodsSubNav } from '../_components/goods-sub-nav';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Proof Pack' };
}

const n = (v: number) => v.toLocaleString('en-AU');
function money(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function Big({ value, label, sub, accent }: { value: string; label: string; sub?: string; accent?: 'red' | 'blue' | 'yellow' }) {
  const border = accent === 'red' ? 'border-bauhaus-red' : accent === 'blue' ? 'border-bauhaus-blue' : accent === 'yellow' ? 'border-bauhaus-yellow' : 'border-bauhaus-black';
  return (
    <div className={`border-4 ${border} bg-white p-4`}>
      <div className="text-3xl font-black text-bauhaus-black">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-bauhaus-muted">{sub}</div>}
    </div>
  );
}

function SectionHead({ kicker, title, blurb }: { kicker: string; title: string; blurb: string }) {
  return (
    <div className="mb-4 border-l-8 border-bauhaus-black pl-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{kicker}</div>
      <h2 className="text-2xl font-black uppercase tracking-widest text-bauhaus-black">{title}</h2>
      <p className="mt-1 max-w-2xl text-[13px] text-bauhaus-black">{blurb}</p>
    </div>
  );
}

function LinkOut({ href, label, note }: { href: string; label: string; note: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 border-2 border-bauhaus-black bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
    >
      {label} <span className="font-bold normal-case tracking-normal text-bauhaus-muted">↗ {note}</span>
    </a>
  );
}

export default async function GoodsProofPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const { impact, commercial, links } = await getGoodsProof();

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods/funnel`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Proof Pack</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Proof Pack</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            The evidence we already hold, assembled for two audiences — <strong className="text-white">impact</strong> for
            philanthropy and <strong className="text-white">commercial scale</strong> for lenders. Every figure is sourced;
            asset truth links out to the live Asset Register. Nothing here is invented.
          </p>
          <GoodsSubNav slug={slug} active="proof" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8">
        {/* ---------------- IMPACT ---------------- */}
        <section>
          <SectionHead
            kicker="For philanthropy"
            title="Impact"
            blurb="What the giving delivers on Country — beds and washers in homes, against the curated demand still unmet. The gap is the ask."
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Big value={n(impact.bedsDelivered)} label="Beds delivered" sub={`as of ${impact.deliveredAsOf}`} accent="red" />
            <Big value={n(impact.washersDelivered)} label="Washers delivered" accent="red" />
            <Big value={n(impact.communitiesActive)} label="Active / lead communities" />
            <Big value={`${impact.pctBedsMet}%`} label="Of bed demand met" sub={`${n(impact.bedsGap)} beds still unmet`} accent="yellow" />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.1fr]">
            <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black/70">The gap = the opportunity</div>
              <div className="mt-1 text-2xl font-black text-bauhaus-black">{n(impact.bedsGap)} beds · {n(impact.washersGap)} washers</div>
              <p className="mt-1 text-[13px] text-bauhaus-black">
                still needed across {n(impact.communitiesActive)} active and lead communities
                (demand {n(impact.bedsDemand)} beds · {n(impact.washersDemand)} washers).
              </p>
              <div className="mt-3">
                <LinkOut href={links.assetRegister} label="Asset Register" note="live bed/asset truth" />
              </div>
            </div>

            <div className="border-4 border-bauhaus-black bg-white">
              <div className="border-b-2 border-bauhaus-black/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                Top demand — where the next beds go
              </div>
              {impact.topCommunities.length === 0 ? (
                <div className="px-3 py-3 text-sm text-bauhaus-muted">No community demand loaded.</div>
              ) : (
                impact.topCommunities.map((c) => (
                  <div key={`${c.name}-${c.state}`} className="flex items-center justify-between border-b border-bauhaus-black/10 px-3 py-2 last:border-b-0">
                    <span className="font-bold">{c.name} <span className="text-[11px] font-normal text-bauhaus-muted">{c.state}</span></span>
                    <span className="font-black">{n(c.beds)} <span className="text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">beds</span></span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ---------------- COMMERCIAL SCALE ---------------- */}
        <section>
          <SectionHead
            kicker="For lenders"
            title="Commercial scale"
            blurb="The trading story that underwrites repayment — money already received, committed funders, and buyers in the pipeline."
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Big value={money(commercial.lifetimeReceived)} label="Lifetime received" sub="Xero-reconciled registry" accent="blue" />
            <Big value={n(commercial.committedFunders)} label="Committed funders" sub={`${n(commercial.fundersEngaged)} engaged`} accent="blue" />
            <Big value={n(commercial.buyersEngaged)} label="Buyers engaged" />
            <Big value={n(commercial.buyersAdvancing)} label="Buyers advancing / committed" />
          </div>
          <div className="mt-4 border-4 border-bauhaus-black bg-white p-4">
            <p className="text-[13px] text-bauhaus-black">
              <strong>{money(commercial.lifetimeReceived)}</strong> received to date across {n(commercial.committedFunders)} committed
              funders, with {n(commercial.buyersAdvancing)} buyer{commercial.buyersAdvancing === 1 ? '' : 's'} advancing — the
              delivery trajectory and order book a repayable-finance partner underwrites against.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkOut href={links.qbeCockpit} label="QBE Program" note="bid cockpit" />
              <Link
                href={`/org/${slug}/goods/money`}
                className="inline-flex items-center gap-2 border-2 border-bauhaus-black bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
              >
                Money detail →
              </Link>
            </div>
          </div>
        </section>

        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          <strong>Provenance.</strong> Delivered (beds/washers) = Goods v2 assets sync, as of {impact.deliveredAsOf} (link out to the
          Asset Register for live counts). Demand = the curated active+lead slice of <code>goods_communities</code>. Money received =
          the Goods relationship registry (<code>total_received_aud</code>), which reconciles to the Xero ACT-GD ledger. No figure on
          this page is invented.
        </div>
      </div>
    </main>
  );
}
