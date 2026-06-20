import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsBuyerPipeline, type BuyerPipelineRow } from '@/lib/services/goods-buyer-pipeline';
import { getGoodsRelationshipPower, type RelationshipPower } from '@/lib/services/goods-relationship-power';
import { getGoodsRelationshipFunding, type RelationshipFunding } from '@/lib/services/goods-relationship-funding';
import { GoodsSubNav } from '../_components/goods-sub-nav';
import { PowerChip } from '../_components/goods-power-chip';
import { FundingChip } from '../_components/goods-funding-chip';
import {
  money, moneyShort, relDays, STAGE_LABEL, bandPill,
} from '@/lib/services/goods-engagement-shared';

/**
 * Goods Command Center — Buyer / Procurement Pipeline.
 * The buyer cohort gets its own first-class surface (Funder Insight + Money's
 * money-IN rollups deliberately exclude buyers). Procurement is kept a SEPARATE
 * track from grant/investment (QBE rule). Modelled on the Funder Insight page.
 * Nav wiring (GoodsSubNav tab) lands separately — kept off here on purpose.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Buyers & Procurement' };
}

function Stat({ label, value, accent, detail }: { label: string; value: string; accent?: boolean; detail?: string }) {
  return (
    <div className={`border-4 ${accent ? 'border-bauhaus-blue bg-link-light' : 'border-bauhaus-black bg-white'} p-3`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
      <div className="mt-1 text-2xl font-black text-bauhaus-black">{value}</div>
      {detail && <div className="mt-1 text-[10px] font-bold text-bauhaus-muted">{detail}</div>}
    </div>
  );
}

/** Due-date label + overdue styling. Past dates render red. */
function dueDate(iso: string | null): { label: string; overdue: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const date = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  if (days < 0) return { label: `due ${date} · ${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { label: `due today (${date})`, overdue: true };
  return { label: `due ${date} · in ${days}d`, overdue: false };
}

function BuyerCard({ r, power, funding }: { r: BuyerPipelineRow; power: RelationshipPower | null; funding: RelationshipFunding | null }) {
  const due = dueDate(r.nextActionDue);
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-bauhaus-black/10 px-3 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-black">{r.name}</span>
          <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-bauhaus-black text-white">
            Buyer
          </span>
          {r.ghlOpportunityId ? (
            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-bauhaus-blue text-white">
              GHL linked
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-bauhaus-canvas text-bauhaus-muted">
              No GHL signal
            </span>
          )}
          <PowerChip power={power} />
          <FundingChip funding={funding} />
        </div>

        <div className="mt-0.5 text-[12px] text-bauhaus-muted">
          {STAGE_LABEL[r.stage]} · last touch {relDays(r.lastTouchAt)}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] font-bold text-bauhaus-black">
          <span><span className="text-bauhaus-blue">Next:</span> {r.nextMove}</span>
          {due && (
            <span
              className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                due.overdue ? 'bg-bauhaus-red text-white' : 'bg-bauhaus-canvas text-bauhaus-black border-2 border-bauhaus-black/30'
              }`}
            >
              {due.label}
            </span>
          )}
        </div>

        {r.notes && <div className="mt-0.5 text-[11px] text-bauhaus-muted">{r.notes}</div>}
      </div>

      <div className="flex flex-col items-end">
        <span className={`px-2 py-0.5 text-[11px] font-black uppercase tracking-widest ${bandPill(r.band)}`}>
          {r.band} {r.warmth}
        </span>
        {r.askAmount != null && r.askAmount > 0 && (
          <span className="mt-0.5 text-[11px] font-black text-bauhaus-blue">{moneyShort(r.askAmount)} open ask</span>
        )}
        {r.totalReceived > 0 && (
          <span className="mt-0.5 text-[10px] font-bold text-bauhaus-muted" title="Manually entered, not Xero">
            {money(r.totalReceived)} rec.
          </span>
        )}
      </div>
    </div>
  );
}

export default async function GoodsBuyersPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const { filter } = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const [{ rows, summary, fetchError }, powerMap, fundingMap] = await Promise.all([
    getGoodsBuyerPipeline(),
    getGoodsRelationshipPower(),
    getGoodsRelationshipFunding(),
  ]);
  const openOnly = filter === 'open';
  const shown = openOnly ? rows.filter((r) => r.isOpen) : rows;

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods/funnel`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Buyers &amp; Procurement</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Buyers &amp; Procurement</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            The buyer side of Goods — councils, agencies and organisations buying product or contracting work.
            This is the <strong className="text-white">procurement track</strong>, kept separate from grants and
            investment (revenue earned, not money given). Each buyer shows warmth, stage, lifetime revenue, the open
            ask, GHL link, and the next move to advance the deal.
          </p>
          <div className="print:hidden">
            <GoodsSubNav slug={slug} active="buyers" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {fetchError && (
          <div className="mb-4 border-4 border-bauhaus-red bg-bauhaus-red px-4 py-2 text-[12px] font-black uppercase tracking-widest text-white">
            Live data unavailable ({fetchError}). Figures below may be incomplete.
          </div>
        )}

        {/* ── PROCUREMENT-TRACK SUMMARY HEADER ────────────────────────── */}
        <div className="mb-3 border-4 border-bauhaus-blue bg-link-light p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
            Procurement track · earned revenue, kept separate from grant + investment
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-5xl font-black leading-none text-bauhaus-black">{moneyShort(summary.totalReceived)}</span>
            <span className="text-sm font-black uppercase tracking-widest text-bauhaus-muted">received (lifetime)</span>
            <span className="text-3xl font-black leading-none text-bauhaus-blue">{moneyShort(summary.openAskTotal)}</span>
            <span className="text-sm font-black uppercase tracking-widest text-bauhaus-muted">open asks</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="border-2 border-bauhaus-black bg-white px-2 py-0.5">
              {summary.total} buyer{summary.total === 1 ? '' : 's'} · {summary.open} open
            </span>
            <span className="border-2 border-bauhaus-black bg-white px-2 py-0.5">
              Expected (stage-weighted) {moneyShort(summary.weightedPipeline)}
            </span>
          </div>
        </div>

        {/* secondary stat row */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Buyers" value={String(summary.total)} accent />
          <Stat label="Open conversations" value={String(summary.open)} />
          <Stat label="Revenue received" value={money(summary.totalReceived)} detail="Warmth registry, manually entered" />
          <Stat label="With GHL link" value={`${summary.withGhl}/${summary.total}`} />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/org/${slug}/goods/buyers`}
            className={`border-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${!openOnly ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/30 bg-white text-bauhaus-black hover:border-bauhaus-black'}`}
          >
            All buyers
          </Link>
          <Link
            href={`/org/${slug}/goods/buyers?filter=open`}
            className={`border-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${openOnly ? 'border-bauhaus-blue bg-bauhaus-blue text-white' : 'border-bauhaus-black/30 bg-white text-bauhaus-black hover:border-bauhaus-black'}`}
          >
            Open only {summary.open > 0 && <span className={openOnly ? 'text-bauhaus-yellow' : 'text-bauhaus-blue'}>{summary.open}</span>}
          </Link>
        </div>

        {shown.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted">
            {summary.total === 0
              ? 'No buyer relationships yet. Add buyers to the warmth registry to build the procurement pipeline.'
              : openOnly ? 'No open procurement conversations — every buyer is committed, dormant, or closed.' : 'No buyers to show.'}
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black bg-white">
            {shown.map((r) => <BuyerCard key={r.id} r={r} power={powerMap.get(r.id) ?? null} funding={fundingMap.get(r.id) ?? null} />)}
          </div>
        )}

        <div className="mt-8 border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          Buyers are <code>goods_relationships</code> rows with <code>relationship_type=&apos;buyer&apos;</code>. Procurement
          revenue is the <strong>earned</strong> track — never mixed into grant or investment totals. Warmth, stage and
          next-move are computed the same way as the rest of the warmth map; ask amounts and lifetime revenue are entered in
          the registry (Xero is the source of truth for cash received).
        </div>
      </div>
    </main>
  );
}
