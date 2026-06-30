import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsReasonsToReachOut } from '@/lib/services/goods-life-events';
import { type Freshness, type LifeEventCard } from '@/lib/services/goods-life-events-shared';
import { GoodsSubNav } from '../_components/goods-sub-nav';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Signals' };
}

const FRESH_TONE: Record<Freshness, string> = {
  new: 'bg-bauhaus-red text-white',
  recent: 'bg-bauhaus-blue text-white',
  'on-record': 'bg-bauhaus-canvas text-bauhaus-muted',
};

const FRESH_LABEL: Record<Freshness, string> = {
  new: 'New',
  recent: 'Recent',
  'on-record': 'On record',
};

function SignalCard({ slug, c }: { slug: string; c: LifeEventCard }) {
  return (
    <div className="flex items-stretch gap-0 border-4 border-bauhaus-black bg-white">
      <div
        className={`w-2 shrink-0 ${c.freshness === 'new' ? 'bg-bauhaus-red' : c.freshness === 'recent' ? 'bg-bauhaus-blue' : 'bg-bauhaus-black/20'}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-black text-bauhaus-black">{c.supporterName}</span>
          <span className="bg-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
            {c.relationshipType}
          </span>
          <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${FRESH_TONE[c.freshness]}`}>
            {FRESH_LABEL[c.freshness]}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[15px] font-black uppercase tracking-wide text-bauhaus-black">{c.headline}</span>
          {c.when && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-bauhaus-muted">{c.when}</span>
          )}
        </div>
        <div className="mt-1 text-[13px] leading-snug text-bauhaus-black/80">{c.detail}</div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-bauhaus-black/10 pt-1.5">
          <span className="text-[10px] uppercase tracking-widest text-bauhaus-muted">{c.kindLabel}</span>
          <span className="text-[10px] text-bauhaus-muted">·</span>
          <span className="text-[10px] uppercase tracking-widest text-bauhaus-muted">{c.source}</span>
          {c.otherSignals > 0 && (
            <Link
              href={`/org/${slug}/goods/timeline`}
              className="ml-auto text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
            >
              +{c.otherSignals} more {c.otherSignals === 1 ? 'signal' : 'signals'} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function GoodsSignalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const { data, fetchError } = await getGoodsReasonsToReachOut();
  const { cards, summary } = data;

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Signals</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Reasons to reach out</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            Fresh signals from the public record we already hold. When a supporter&apos;s organisation files a new
            ACNC return, wins a government contract, or receives justice funding, that is a timely, honest reason to
            make contact. The strongest reason per supporter, freshest first.
          </p>
          <GoodsSubNav slug={slug} active="signals" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {fetchError && (
          <div className="mb-4 border-2 border-bauhaus-red bg-bauhaus-red px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white">
            Live data unavailable ({fetchError})
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-[12px] font-black uppercase tracking-widest text-bauhaus-black">
            {summary.supporters} {summary.supporters === 1 ? 'supporter' : 'supporters'} with a signal
          </span>
          <span className="text-[12px] font-bold uppercase tracking-widest text-bauhaus-red">{summary.fresh} new</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">
            {summary.feeds.acnc_filing} ACNC · {summary.feeds.gov_contract} contracts · {summary.feeds.justice_funding} justice
          </span>
        </div>

        <div className="mb-6 border-4 border-bauhaus-black bg-bauhaus-yellow p-3 text-[12px] leading-snug">
          <span className="font-black uppercase tracking-widest">Honest by source.</span> Every figure traces to a dated
          public record. ACNC filings lag, so the latest return on file can be a year or more old and is labelled the
          latest return, never breaking news. Government contracts carry real start dates and lead the feed when fresh.
        </div>

        {cards.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted">
            No public-record signals computed yet. The feed needs entity-linked Goods supporters with an ABN.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {cards.map((c) => <SignalCard key={`${c.relId}-${c.kind}`} slug={slug} c={c} />)}
          </div>
        )}

        {cards.length < summary.supporters && (
          <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">
            Showing the freshest {cards.length} of {summary.supporters}. Older filings on record are not shown.
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={`/org/${slug}/goods/timeline`}
            className="border-2 border-bauhaus-black bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
          >
            See the full dated record → Timeline
          </Link>
          <Link
            href={`/org/${slug}/goods/insight`}
            className="border-2 border-bauhaus-black bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
          >
            Decode the GHL signal → Funder Insight
          </Link>
          <Link
            href={`/org/${slug}/goods/engagement`}
            className="border-2 border-bauhaus-black bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
          >
            Act on it → Warmth Map
          </Link>
        </div>

        <div className="mt-8 border-4 border-bauhaus-black bg-white p-4 text-xs text-bauhaus-muted">
          Computed live from <code className="bg-bauhaus-canvas px-1">v_goods_life_events</code>: the most recent ACNC
          filing, government contract, and justice-funding record for each entity-linked Goods supporter. One card per
          supporter, the freshest reason first. Sources: ACNC Annual Information Statements, AusTender, the justice
          funding ledger.
        </div>
      </div>
    </main>
  );
}
