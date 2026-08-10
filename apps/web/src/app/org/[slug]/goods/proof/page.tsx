import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsProof } from '@/lib/services/goods-proof';
import { getGoodsCostEvidence } from '@/lib/services/goods-cost-evidence';
import { getGoodsTranches } from '@/lib/services/goods-tranches';
import { trackLabel } from '@/lib/services/goods-tranches-shared';
import { money as moneyExact, moneyShort } from '@/lib/services/goods-engagement-shared';
import {
  canonical,
  CLAIM_LABEL_MEANINGS,
  reconciliationNote,
  type ClaimLabel,
} from '@/lib/services/goods-canonical-numbers';
import { COST_STORY_HEADLINE } from '@/lib/services/goods-pitch-content';
import { GoodsSubNav } from '../_components/goods-sub-nav';
import { ClaimChip } from '../_components/claim-chip';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Proof Pack' };
}

const n = (v: number) => v.toLocaleString('en-AU');
// Compact money for stat call-outs — shared canonical formatter.
const money = moneyShort;

// Short month-year for tranche date spans (e.g. "Jan 2026").
function monthYear(iso: string | null): string {
  if (!iso) return 'undated';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'undated';
  return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

function dateSpan(earliest: string | null, latest: string | null): string {
  const a = monthYear(earliest);
  const b = monthYear(latest);
  return a === b ? a : `${a} to ${b}`;
}

function Big({ value, label, sub, accent, claim }: { value: string; label: string; sub?: string; accent?: 'red' | 'blue' | 'yellow'; claim?: ClaimLabel }) {
  const border = accent === 'red' ? 'border-bauhaus-red' : accent === 'blue' ? 'border-bauhaus-blue' : accent === 'yellow' ? 'border-bauhaus-yellow' : 'border-bauhaus-black';
  return (
    <div className={`border-4 ${border} bg-white p-4`}>
      <div className="text-3xl font-black text-bauhaus-black">{value}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</span>
        {claim && <ClaimChip label={claim} />}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-bauhaus-muted">{sub}</div>}
    </div>
  );
}

const LEGEND_ORDER: ClaimLabel[] = ['verified', 'modelled', 'target', 'future'];

function ClaimLegend() {
  return (
    <div className="border-4 border-bauhaus-black bg-white px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
        Claim taxonomy (QBE Diagnostic Area 01/04)
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
        {LEGEND_ORDER.map((label) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <ClaimChip label={label} />
            <span className="text-[11px] font-bold text-bauhaus-black">{CLAIM_LABEL_MEANINGS[label]}</span>
          </span>
        ))}
      </div>
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

  const [proof, costEvidence, tranches] = await Promise.all([
    getGoodsProof(),
    getGoodsCostEvidence(),
    getGoodsTranches(),
  ]);
  const { impact, commercial, fundingQuantum, deliveredAgeDays, deliveredStale, links, fetchError } = proof;
  // Production + freight cost bands — the honest planning estimate (not audited).
  const productionRow = costEvidence.unitEstimateRows.find((r) => r.label === 'Production range');
  const freightRows = costEvidence.unitEstimateRows.filter((r) => /road|barge|remote/i.test(r.label));

  // Current Goods Asset Register canon leads the page.
  const deployedBeds = canonical('deployed_bed_units');
  const stretchBeds = canonical('stretch_beds_deployed');
  const basketBeds = canonical('basket_beds_deployed');
  const washersInCommunity = canonical('washers_in_community');
  const servedCommunities = canonical('served_communities');
  const distinctCommunities = canonical('distinct_communities_touched');
  const stretchDesignMass = canonical('stretch_design_mass_kg');

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-[1760px] px-4 py-8">
          <nav className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Proof Pack</span>
          </nav>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-xl font-black uppercase tracking-widest">Proof Pack</h1>
            <div className="print:hidden"><PrintButton /></div>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            The evidence we already hold, assembled for two audiences — <strong className="text-white">impact</strong> for
            philanthropy and <strong className="text-white">commercial scale</strong> for lenders. Every figure is sourced;
            asset truth links out to the live Asset Register. Nothing here is invented.
          </p>
          <div className="print:hidden">
            <GoodsSubNav slug={slug} active="proof" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1760px] space-y-10 px-4 py-8">
        <ClaimLegend />
        {fetchError && (
          <div className="border-4 border-bauhaus-red bg-bauhaus-red px-4 py-2 text-[12px] font-black uppercase tracking-widest text-white print:hidden">
            Live data unavailable ({fetchError}). Figures below may be incomplete.
          </div>
        )}
        {deliveredStale && (
          <div className="border-4 border-bauhaus-yellow bg-bauhaus-yellow px-4 py-2 text-[12px] font-black uppercase tracking-widest text-bauhaus-black">
            Asset figures are {deliveredAgeDays} days old. Recheck the Goods Asset Register canon.
          </div>
        )}
        {/* ---------------- IMPACT ---------------- */}
        <section>
          <SectionHead
            kicker="For philanthropy"
            title="Impact"
            blurb="What the giving supports on Country: deployed beds and washers in community, against the curated demand still unmet. The gap is the ask."
          />
          {/* Current canonical figures, with computed design mass labelled. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Big value={n(Number(deployedBeds.value))} label="Beds deployed" sub={`as of ${deployedBeds.asOf}`} accent="red" claim={deployedBeds.claimLabel} />
            <Big value={n(Number(servedCommunities.value))} label="Communities served" sub={`${distinctCommunities.value} distinct touched`} claim={servedCommunities.claimLabel} />
            <Big value={n(Number(stretchDesignMass.value))} label="kg Stretch design mass" sub="177 × 20 kg; not weighbridge data" accent="red" claim={stretchDesignMass.claimLabel} />
            <Big value={`${impact.pctBedsMet}%`} label="Of bed demand met" sub={`${n(impact.bedsGap)} beds still unmet`} accent="yellow" claim="verified" />
          </div>

          {/* Composition and the manual washer ruling. */}
          <div className="mt-3 border-4 border-bauhaus-yellow bg-white p-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                What the total contains
              </span>
              <span className="text-lg font-black text-bauhaus-black">
                {n(Number(stretchBeds.value))} Stretch + {n(Number(basketBeds.value))} Basket · {n(Number(washersInCommunity.value))} washers in community
              </span>
              <span className="text-[11px] font-bold text-bauhaus-muted">as of {deployedBeds.asOf}</span>
              <ClaimChip label={deployedBeds.claimLabel} />
            </div>
            <p className="mt-2 border-l-4 border-bauhaus-yellow bg-bauhaus-yellow/40 px-3 py-2 text-[12px] font-bold text-bauhaus-black">
              The 22-washer figure is Ben&apos;s manual per-community ruling. It is not yet row-derived because
              10 stale register rows still await restatusing. The 3,540 kg figure is calculated design mass,
              not a weighbridge or measured waste-diversion total.
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.1fr]">
            <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black/70">The gap = the opportunity</span>
                <ClaimChip label="verified" />
              </div>
              <div className="mt-1 text-2xl font-black text-bauhaus-black">{n(impact.bedsGap)} beds · {n(impact.washersGap)} washers</div>
              <p className="mt-1 text-[13px] text-bauhaus-black">
                still needed across {n(impact.communitiesActive)} active and lead communities
                (demand {n(impact.bedsDemand)} beds · {n(impact.washersDemand)} washers).
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-bauhaus-black/60">
                Source: goods_communities live
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
            <Big value={money(commercial.lifetimeReceived)} label="Lifetime received" sub="Registry total (manually entered)" accent="blue" claim="modelled" />
            <Big value={n(commercial.committedFunders)} label="Committed funders" sub={`${n(commercial.fundersEngaged)} engaged (excl. declined)`} accent="blue" />
            <Big value={n(commercial.buyersEngaged)} label="Buyers engaged" />
            <Big value={n(commercial.buyersAdvancing)} label="Buyers advancing / committed" />
          </div>

          {/* Track split — philanthropy / repayable / procurement never lumped */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border-4 border-bauhaus-black bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Philanthropy (grant)</div>
              <div className="mt-1 text-2xl font-black">{money(commercial.philanthropy.lifetimeReceived)}</div>
              <div className="mt-0.5 text-[11px] text-bauhaus-muted">{n(commercial.philanthropy.committedCount)} committed</div>
            </div>
            <div className="border-4 border-bauhaus-black bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Repayable / investment</div>
              <div className="mt-1 text-2xl font-black">{money(commercial.investment.lifetimeReceived)}</div>
              <div className="mt-0.5 text-[11px] text-bauhaus-muted">{n(commercial.investment.committedCount)} committed</div>
            </div>
            <div className="border-4 border-bauhaus-black bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Procurement</div>
              <div className="mt-1 text-2xl font-black">{money(commercial.procurement.lifetimeReceived)}</div>
              <div className="mt-0.5 text-[11px] text-bauhaus-muted">{n(commercial.procurement.committedCount)} committed</div>
            </div>
          </div>

          <div className="mt-4 border-4 border-bauhaus-black bg-white p-4">
            <p className="text-[13px] text-bauhaus-black">
              <strong>{moneyExact(commercial.lifetimeReceived)}</strong> received to date across {n(commercial.committedFunders)} committed
              funders, with {n(commercial.buyersAdvancing)} buyer{commercial.buyersAdvancing === 1 ? '' : 's'} advancing — the
              delivery trajectory and order book a repayable-finance partner underwrites against.
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-bauhaus-muted">
              <ClaimChip label="modelled" /> Manually entered registry total. The Xero-verified paid figure is {moneyExact(650910.79)}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/org/${slug}/goods/money`}
                className="inline-flex items-center gap-2 border-2 border-bauhaus-black bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
              >
                Money detail →
              </Link>
            </div>
            {/* Internal-only links — authenticated admin paths, kept apart so they
                never get shared in a funder artifact. */}
            <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-3 print:hidden">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Internal — do not share with funders</div>
              <div className="mt-1.5">
                <LinkOut href={links.qbeCockpit} label="QBE Program" note="internal bid cockpit (admin)" />
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- WHERE THE MONEY WENT ---------------- */}
        <section id="tranches">
          <SectionHead
            kicker="Tranche traceability"
            title="Where the money went"
            blurb="Every dollar received as a dated tranche, traced to the funder who sent it. These rows are derived from paid Xero ACT-GD invoices, so each total is verified, not modelled."
          />
          {tranches.fetchError && (
            <div className="mb-3 border-4 border-bauhaus-red bg-bauhaus-red px-4 py-2 text-[12px] font-black uppercase tracking-widest text-white print:hidden">
              Tranche register unavailable ({tranches.fetchError}). Funder rows below may be incomplete.
            </div>
          )}

          {/* Track totals — philanthropy and procurement never lumped together. */}
          {tranches.byTrack.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-3">
              {tranches.byTrack.map((t) => (
                <div key={t.track} className="border-4 border-bauhaus-black bg-white px-4 py-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                    {trackLabel(t.track)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-xl font-black">{moneyExact(t.total)}</span>
                    <ClaimChip label="verified" />
                  </div>
                  <div className="text-[11px] font-bold text-bauhaus-muted">
                    {n(t.count)} tranche{t.count === 1 ? '' : 's'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Per-funder rows. */}
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="flex items-center justify-between border-b-4 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
              <span>Funder</span>
              <span>Received (verified)</span>
            </div>
            {tranches.byFunder.length === 0 ? (
              <div className="px-3 py-4 text-sm text-bauhaus-muted">No tranches loaded.</div>
            ) : (
              tranches.byFunder.map((f) => (
                <div
                  key={f.funderName}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-bauhaus-black/10 px-3 py-2.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-black">{f.funderName}</span>
                    <span className="ml-2 inline-block bg-bauhaus-canvas px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">
                      {trackLabel(f.track)}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-bauhaus-muted">
                    {n(f.count)} tranche{f.count === 1 ? '' : 's'} · {dateSpan(f.earliestDate, f.latestDate)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-28 text-right font-black">{moneyExact(f.total)}</span>
                    <ClaimChip label="verified" />
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Honest allocation strip — computed live, never hardcoded. */}
          <div className="mt-3 border-4 border-bauhaus-yellow bg-bauhaus-yellow p-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black/70">
                Allocation still to come
              </span>
              <ClaimChip label="future" />
            </div>
            <p className="mt-1 text-[13px] font-bold text-bauhaus-black">
              {n(tranches.allocationStats.allocated)} of {n(tranches.allocationStats.total)} tranches are allocated to
              specific deployments yet. Allocation curation is the next step. Until then dollars trace to funders, not to
              communities.
            </p>
          </div>

          <div className="mt-2 text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">
            Source: goods_tranches, derived from Xero paid ACT-GD invoices.
          </div>
        </section>

        {/* ---------------- COST PER OUTCOME ---------------- */}
        <section>
          <SectionHead
            kicker="Planning estimates, not audited actuals"
            title="Cost per outcome"
            blurb="What a bed costs to produce and land, as a planning band. These are estimates from the Goods cost register, not audited delivered actuals. Treat as a range."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="border-4 border-bauhaus-black bg-white p-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Production</span>
                <ClaimChip label="modelled" />
              </div>
              <div className="mt-1 text-3xl font-black">{moneyExact(550)}&ndash;{moneyExact(650)} <span className="text-base font-bold text-bauhaus-muted">/ bed</span></div>
              <div className="mt-1 text-[11px] text-bauhaus-muted">
                {productionRow ? productionRow.basis : 'Goods cost register, before route freight, warranty, support or margin.'}
              </div>
            </div>
            <div className="border-4 border-bauhaus-black bg-white">
              <div className="border-b-2 border-bauhaus-black/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                Plus route freight band
              </div>
              {freightRows.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-bauhaus-muted">Freight estimates not loaded.</div>
              ) : (
                freightRows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between border-b border-bauhaus-black/10 px-3 py-2 text-[12px] last:border-b-0">
                    <span className="font-bold">{r.label}</span>
                    <span className="font-black">{r.value}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="mt-2 text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">
            Planning estimates, not audited actuals.
          </div>
        </section>

        {/* ---------------- UNIT ECONOMICS ---------------- */}
        <section>
          <SectionHead
            kicker="The cost ladder QBE asks for"
            title="Unit economics"
            blurb="The headline rows of the delivered unit cost, from today's fabricated bed to the in-house transition and the volume curve. The full cost story and capital architecture live on the Pitch page."
          />
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="grid grid-cols-[1fr_auto] gap-x-4 border-b-4 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted sm:grid-cols-[1.4fr_1.4fr_auto]">
              <span>Claim</span>
              <span className="hidden sm:block">Number</span>
              <span className="text-right">Label</span>
            </div>
            {COST_STORY_HEADLINE.map((r) => (
              <div
                key={r.claim}
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-bauhaus-black/10 px-3 py-2.5 last:border-b-0 sm:grid-cols-[1.4fr_1.4fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <span className="font-black">{r.claim}</span>
                  <div className="mt-0.5 text-[11px] text-bauhaus-muted">{r.source}</div>
                </div>
                <div className="font-black text-bauhaus-black">{r.number}</div>
                <div className="text-right">
                  <ClaimChip label={r.claimLabel} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted">
              Decision band: ≥25% scale · 15 to 24% workable · 5 to 14% red flag · &lt;5% stop.
            </span>
            <Link
              href={`/org/${slug}/goods/pitch`}
              className="inline-flex items-center gap-2 border-2 border-bauhaus-black bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
            >
              Full cost story + capital architecture →
            </Link>
          </div>
        </section>

        {/* ---------------- FUNDING QUANTUM ---------------- */}
        <section>
          <SectionHead
            kicker="The size of the ask"
            title="Funding quantum"
            blurb="What it would take to close the unmet bed gap, at the $600 midpoint planning cost. This is an estimate, expressed as a range."
          />
          <div className="border-4 border-bauhaus-yellow bg-bauhaus-yellow p-5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black/70">Closing the gap (estimate)</span>
              <ClaimChip label="modelled" />
            </div>
            <div className="mt-1 text-5xl font-black leading-none text-bauhaus-black">
              ≈ {moneyExact(fundingQuantum.mid)}
            </div>
            <p className="mt-2 text-[13px] font-bold text-bauhaus-black">
              {n(fundingQuantum.bedsGap)} beds still unmet × {moneyExact(600)} midpoint.
              Range {moneyExact(fundingQuantum.low)}&ndash;{moneyExact(fundingQuantum.high)}
              ({moneyExact(550)}&ndash;{moneyExact(650)} per bed). Estimate only, excludes route freight and warranty.
            </p>
          </div>
        </section>

        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          <strong>Provenance.</strong> Asset figures are the Goods Asset Register canon checked {deployedBeds.asOf}:
          540 deployed beds = 177 Stretch + 363 Basket; 11 communities served and 12 distinct touched; 22 washers in
          community under Ben&apos;s manual ruling. The 3,540 kg Stretch figure is 177 × 20 kg design mass, not a
          weighbridge measurement. Demand = the curated active+lead slice of <code>goods_communities</code>.
          Money received = the Goods relationship registry
          (<code>total_received_aud</code>), manually entered. No figure on this page is invented.
          <div className="mt-2 font-bold">Reconciliation: {reconciliationNote}</div>
        </div>
      </div>
    </main>
  );
}
