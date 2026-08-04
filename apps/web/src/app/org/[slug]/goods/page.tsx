import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, fastProjectFromWiki, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getWikiSupportProject } from '@/lib/services/wiki-support-index';
import { getGoodsFunnel } from '@/lib/services/goods-funnel';
import { getGoodsMoney } from '@/lib/services/goods-money';
import { getGoodsBuyerPipeline } from '@/lib/services/goods-buyer-pipeline';
import { getGoodsChannels } from '@/lib/services/goods-channels';
import { GoodsSubNav, type GoodsTab } from './_components/goods-sub-nav';
import { ActProjectFieldMapScreen } from '../[projectSlug]/act-project-field-map';

/**
 * Goods Command Center — the front door (G1).
 * A "start here" index: one-glance state of the workspace (need / delivered / gap,
 * money received + in play, buyers in pipeline) reusing the same services the tabs
 * use, then signposts into the high-value destinations. Degrades gracefully — a
 * failed service shows a dash, never 500s the page (shared DB can saturate).
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return {
    title: 'Goods — Command Center',
    description: 'The Goods field map: needs, relationships, procurement, funding, invitations, and proof in one ACT workspace.',
  };
}

const money = (n: number | null | undefined) => `$${Math.round(n || 0).toLocaleString('en-AU')}`;
const moneyShort = (n: number | null | undefined) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
};
const num = (n: number | null | undefined) => (n || 0).toLocaleString('en-AU');

/** A headline summary cell — big value, small label, optional sub. */
function Cell({ value, label, sub, accent }: { value: string; label: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`border-4 ${accent ? 'border-bauhaus-blue bg-link-light' : 'border-bauhaus-black bg-white'} p-3`}>
      <div className="text-2xl font-black leading-none text-bauhaus-black">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] font-bold text-bauhaus-muted">{sub}</div>}
    </div>
  );
}

/** A "start here" destination card — links into a tab, with a one-line job + live stat. */
function Dest({ slug, tab, title, blurb, stat }: { slug: string; tab: GoodsTab; title: string; blurb: string; stat?: string }) {
  return (
    <Link
      href={`/org/${slug}/goods/${tab}`}
      className="group flex flex-col border-4 border-bauhaus-black bg-white p-4 transition-shadow hover:shadow-[6px_6px_0_0_var(--bauhaus-black)]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-black uppercase tracking-widest text-bauhaus-black">{title}</span>
        <span className="text-bauhaus-blue transition-transform group-hover:translate-x-0.5">→</span>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-bauhaus-muted">{blurb}</p>
      {stat && <div className="mt-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-blue">{stat}</div>}
    </Link>
  );
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
  // The field-map screen is a different design system from the workspace tabs
  // beneath this route — showing it as the hub front door made the workspace
  // feel disconnected (Ben, 2026-08-05). It now renders only for E2E fixtures
  // (which assert on it credential-free) or when explicitly requested.
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

  // Reuse the tabs' own services. allSettled so one saturated query can't 500 the front door.
  const [funnelR, moneyR, buyersR, channelsR] = await Promise.allSettled([
    getGoodsFunnel(),
    getGoodsMoney(),
    getGoodsBuyerPipeline(),
    getGoodsChannels({}),
  ]);
  const f = funnelR.status === 'fulfilled' ? funnelR.value : null;
  const m = moneyR.status === 'fulfilled' ? moneyR.value : null;
  const b = buyersR.status === 'fulfilled' ? buyersR.value : null;
  const ch = channelsR.status === 'fulfilled' ? channelsR.value.summary : null;

  const dash = '—';

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-[1760px] px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <span className="text-white">Goods</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Goods Command Center</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            One workspace for the Goods on Country arm. <strong className="text-white">Work the pipeline</strong> to move
            procurement and funder relationships forward, and <strong className="text-white">show the evidence</strong> to
            prove the work to buyers and funders. Start with the state below, then jump in.
          </p>
          <GoodsSubNav slug={slug} />
        </div>
      </div>

      <div className="mx-auto max-w-[1760px] px-4 py-6">
        {/* ── THE LOOP — demand → channels → capital ──────────────────── */}
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-black">The loop</div>
        <div className="mb-6 grid gap-3 lg:grid-cols-3">
          <Link href={`/org/${slug}/goods/communities`} className="group border-4 border-bauhaus-black bg-white p-4 transition-shadow hover:shadow-[6px_6px_0_0_var(--bauhaus-black)]">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">1 · Demand</div>
            <div className="mt-1 text-3xl font-black tabular-nums">{f ? num(f.gap.beds) : dash}</div>
            <div className="text-[11px] font-bold text-bauhaus-muted">
              bed gap across {f ? num(f.addressable.communities) : dash} addressable communities
            </div>
            <p className="mt-2 text-[13px] leading-snug text-bauhaus-muted">Who needs beds and washers, where, and how urgently.</p>
          </Link>
          <Link href={`/org/${slug}/goods/channels`} className="group border-4 border-bauhaus-black bg-white p-4 transition-shadow hover:shadow-[6px_6px_0_0_var(--bauhaus-black)]">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">2 · Channels</div>
            <div className="mt-1 text-3xl font-black tabular-nums">{ch ? `${num(ch.in_pipeline)} / ${num(ch.total)}` : dash}</div>
            <div className="text-[11px] font-bold text-bauhaus-muted">community-controlled channel orgs engaged</div>
            <p className="mt-2 text-[13px] leading-snug text-bauhaus-muted">Health services, housing logistics, women&apos;s councils and stores that carry goods the last mile.</p>
          </Link>
          <Link href={`/org/${slug}/goods/capital`} className="group border-4 border-bauhaus-black bg-white p-4 transition-shadow hover:shadow-[6px_6px_0_0_var(--bauhaus-black)]">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black">3 · Capital</div>
            <div className="mt-1 text-3xl font-black tabular-nums">{m ? moneyShort(m.pipeline.openAskTotal) : dash}</div>
            <div className="text-[11px] font-bold text-bauhaus-muted">{m ? `in play · ${money(m.lifetimeReceived)} received lifetime` : 'open asks across funders + investors'}</div>
            <p className="mt-2 text-[13px] leading-snug text-bauhaus-muted">Grants, philanthropy and procurement revenue that fund the loop.</p>
          </Link>
        </div>

        {/* ── STATE OF GOODS — one-glance summary ─────────────────────── */}
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-black">State of Goods</div>
        <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Cell
            value={f ? `${num(f.delivered.beds)}` : dash}
            label="Beds deployed"
            sub="On Country to date"
          />
          <Cell
            value={f ? `${num(f.gap.beds)}` : dash}
            label="Bed gap"
            sub="Need not yet met — the ask"
            accent
          />
          <Cell
            value={m ? money(m.lifetimeReceived) : dash}
            label="Received (lifetime)"
            sub="All tracks, registry + Xero"
          />
          <Cell
            value={m ? moneyShort(m.pipeline.openAskTotal) : dash}
            label="In play"
            sub={m ? `${moneyShort(m.pipeline.weightedPipeline)} stage-weighted` : 'Open funder + investor asks'}
            accent
          />
          <Cell
            value={b ? `${num(b.summary.total)}` : dash}
            label="Buyers in pipeline"
            sub={b ? `${b.summary.open} open · procurement track` : 'Procurement track'}
          />
        </div>
        <p className="mb-6 text-[11px] text-bauhaus-muted">
          {f
            ? <>Against an addressable need of {num(f.addressable.beds)} beds across {num(f.addressable.communities)} communities. Procurement (earned revenue) is tracked separately from grant + investment.</>
            : <span className="text-bauhaus-red">Live workspace data is briefly unavailable — figures will populate on refresh.</span>}
        </p>

        {/* ── START HERE — high-value destinations ────────────────────── */}
        <div className="mb-2 mt-8 text-xs font-black uppercase tracking-widest text-bauhaus-black">Work the pipeline</div>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dest
            slug={slug} tab="buyers" title="Buyer Pipeline"
            blurb="Advance procurement deals — warmth, stage, and the next move per buyer."
            stat={b ? `${b.summary.total} buyers · ${b.summary.open} open` : undefined}
          />
          <Dest
            slug={slug} tab="money" title="Money"
            blurb="What Goods has received, what's in play, and what's available to pursue."
            stat={m ? `${money(m.lifetimeReceived)} in · ${moneyShort(m.pipeline.openAskTotal)} in play` : undefined}
          />
          <Dest
            slug={slug} tab="engagement" title="Warmth Map"
            blurb="Every relationship by warmth, with the next action to advance it."
          />
          <Dest
            slug={slug} tab="funnel" title="Funnel"
            blurb="The need-to-delivery model across all three pipelines, on one spine."
            stat={f ? `${num(f.gap.beds)} bed gap` : undefined}
          />
        </div>

        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-black">Show the evidence</div>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Dest
            slug={slug} tab="model" title="Story & model"
            blurb="Start with a real place, then see the evidence, economics, responsibilities, and next decision."
            stat="Place first · model second"
          />
          <Dest
            slug={slug} tab="proof" title="Proof Pack"
            blurb="The evidence we already hold, assembled for philanthropy and lenders. Export-ready."
            stat={f ? `${num(f.delivered.beds)} beds deployed` : undefined}
          />
          <Dest
            slug={slug} tab="pitch" title="Pitch"
            blurb="The canonical, claim-labelled proposition. Every deck and email derives from it."
          />
          <Dest
            slug={slug} tab="foundations" title="Foundations"
            blurb="Aligned foundations and the giving that matches the Goods wheelhouse."
          />
          <Dest
            slug={slug} tab="governance" title="Governance"
            blurb="Board, belonging, and the connection showcase behind the work."
          />
        </div>

        <div className="mt-8 border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          This is the front door to the Goods workspace. The full set of areas is in the two rows above
          (<strong>work the pipeline</strong> and <strong>show the evidence</strong>). Figures here are pulled live from the
          same registries the tabs use — the warmth registry, the finance ledger (Xero is the source of truth for cash),
          and the Goods asset register.
        </div>
      </div>
    </main>
  );
}
