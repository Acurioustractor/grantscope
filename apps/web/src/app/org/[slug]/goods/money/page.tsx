import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import { getGoodsMoney } from '@/lib/services/goods-money';
import { getGoodsTranches } from '@/lib/services/goods-tranches';
import {
  money, moneyShort, REL_TYPE_LABEL, STAGE_LABEL, warmthBand, bandPill, nextBestAction, relDays,
  BUTTERFLY_DGR,
} from '@/lib/services/goods-engagement-shared';
import { ScrapeMoreButton } from './scrape-more-button';
import { GoodsSubNav } from '../_components/goods-sub-nav';
import { ClaimChip } from '../_components/claim-chip';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Money: Received & Available' };
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

function deadlineLabel(iso: string | null): string {
  if (!iso) return 'Rolling / no deadline';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const date = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  if (days <= 0) return `Closed ${date}`;
  if (days <= 30) return `${date} · ${days}d left`;
  return date;
}

const STATUS_TINT: Record<string, string> = {
  paid: 'bg-bauhaus-blue text-white',
  authorised: 'bg-bauhaus-yellow text-bauhaus-black',
  sent: 'bg-white text-bauhaus-black border-2 border-bauhaus-black/30',
  draft: 'bg-white text-bauhaus-muted border-2 border-bauhaus-black/30',
};

export default async function GoodsMoneyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  // This page surfaces invoice-level Xero detail — gate to an authenticated
  // super-admin in production; fast-local dev keeps it open (mirrors the write
  // actions' requireWriteAccess and the org layout's fast-local bypass).
  if (!shouldUseFastLocalOrg()) {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) redirect(`/login?next=${encodeURIComponent(`/org/${slug}/goods/money`)}`);
    if (!isAdminEmail(user.email)) redirect(`/org/${slug}/goods/engagement`);
  }

  const [m, tranches] = await Promise.all([getGoodsMoney(), getGoodsTranches()]);
  const totalValue = (label: string) => m.ledger.totals.find((t) => t.label === label)?.value ?? '$0';
  const invoiceRows = m.ledger.moneyRows.slice(0, 8);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Money</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Money — Received &amp; Available</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            What Goods has <strong className="text-white">received</strong> (Xero income, lifetime support), what&apos;s
            <strong className="text-white"> in play</strong> (open funder / investor / finance conversations), and what&apos;s
            <strong className="text-white"> available to pursue</strong> (the live discovery engine, matched to the Goods
            wheelhouse). Real figures only — Xero, the warmth registry, and scraped open opportunities.
          </p>
          <GoodsSubNav slug={slug} active="money" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {m.fetchError && (
          <div className="mb-4 border-4 border-bauhaus-red bg-bauhaus-red px-4 py-2 text-[12px] font-black uppercase tracking-widest text-white">
            Live data unavailable ({m.fetchError}). Figures below may be incomplete.
          </div>
        )}

        {/* ── PRIMARY CALL-OUT: pipeline in play ──────────────────────── */}
        <div className="mb-3 border-4 border-bauhaus-blue bg-link-light p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
            Pipeline in play · open funder + investor asks
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-5xl font-black leading-none text-bauhaus-black">{moneyShort(m.pipeline.openAskTotal)}</span>
            <span className="text-sm font-black uppercase tracking-widest text-bauhaus-muted">total</span>
            <span className="text-3xl font-black leading-none text-bauhaus-blue">{moneyShort(m.pipeline.weightedPipeline)}</span>
            <span className="text-sm font-black uppercase tracking-widest text-bauhaus-muted">expected (stage-weighted)</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="border-2 border-bauhaus-black bg-white px-2 py-0.5">
              Grants {moneyShort(m.pipeline.grant.openAskTotal)} ask · {moneyShort(m.pipeline.grant.weightedPipeline)} expected
            </span>
            <span className="border-2 border-bauhaus-black bg-white px-2 py-0.5">
              Investment {moneyShort(m.pipeline.investment.openAskTotal)} ask · {moneyShort(m.pipeline.investment.weightedPipeline)} expected
            </span>
          </div>
          {/* Procurement = EARNED revenue. Shown as a separate line, never folded
              into the money-IN pipeline above (QBE rule: keep tracks separate). */}
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t-2 border-bauhaus-black/10 pt-2 text-[11px] font-bold">
            <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Separate track</span>
            <span className="border-2 border-bauhaus-blue bg-white px-2 py-0.5 text-bauhaus-blue">
              Procurement {moneyShort(m.pipeline.procurement.lifetimeReceived)} received · {moneyShort(m.pipeline.procurement.openAskTotal)} open ask
              {m.pipeline.procurement.count > 0 && <> · {m.pipeline.procurement.count} buyer{m.pipeline.procurement.count === 1 ? '' : 's'}</>}
            </span>
            <Link href={`/org/${slug}/goods/buyers`} className="text-bauhaus-blue underline hover:no-underline">
              Buyer pipeline →
            </Link>
          </div>
          <div className="mt-2 text-[10px] font-bold text-bauhaus-muted">
            Expected = each open ask multiplied by its stage close-probability. Grant, investment and procurement dollars
            are kept separate — procurement is earned revenue and is never added into the money-IN pipeline above. Ask
            amounts are entered in the warmth registry and may be incomplete until every conversation is sized.
          </div>
        </div>

        {/* secondary stat row */}
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Received (lifetime)" value={money(m.lifetimeReceived)} accent detail="Warmth registry, manually entered" />
          <Stat label="Paid (Xero ACT-GD)" value={totalValue('Paid invoices')} detail="Source of truth" />
          <Stat label="Due / chase" value={totalValue('Due / chase')} />
          <Stat label="Open money asks" value={String(m.openAsks.length)} accent />
          <Stat label="Matched opportunities" value={String(m.matchedPoolCount)} detail={`${m.opportunities.length} shown`} />
        </div>

        {/* ── RECONCILIATION STRIP ────────────────────────────────────── */}
        <div className="mb-4 border-4 border-bauhaus-black bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Xero paid</div>
                <ClaimChip label="verified" />
              </div>
              <div className="text-xl font-black">{money(m.reconciliation.xeroPaid)}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Registry received</div>
                <ClaimChip label="modelled" />
              </div>
              <div className="text-xl font-black">{money(m.reconciliation.registryReceived)}</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Delta</div>
              <div className={`text-xl font-black ${m.reconciliation.delta === 0 ? 'text-bauhaus-black' : 'text-bauhaus-red'}`}>
                {money(m.reconciliation.delta)}
              </div>
            </div>
          </div>
          <p className="mt-1 text-[11px] font-bold text-bauhaus-muted">
            Registry figure is manually entered; Xero is the source of truth. Delta: {money(m.reconciliation.delta)}.
          </p>
          <p className="mt-2 border-t-2 border-bauhaus-black/10 pt-2 text-[12px] font-bold text-bauhaus-black">
            Tranche register: {String(tranches.allocationStats.total)} Xero-verified tranches across{' '}
            {String(tranches.byFunder.length)} funders.{' '}
            <Link href={`/org/${slug}/goods/proof#tranches`} className="text-bauhaus-blue underline hover:no-underline">
              See the Proof Pack.
            </Link>
          </p>
        </div>

        {/* ── BUTTERFLY DGR CALLOUT ───────────────────────────────────── */}
        <div className="mb-6 border-4 border-bauhaus-yellow bg-bauhaus-yellow p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black/70">Tax-deductible route</div>
          <p className="mt-1 text-[13px] font-bold text-bauhaus-black">
            Tax-deductible donations route through {BUTTERFLY_DGR.name} (ABN {BUTTERFLY_DGR.abn}) — Item 1 DGR + PBI since 2012.
            Philanthropic money never routes to ACT Pty.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-widest">
            <a href={BUTTERFLY_DGR.abrUrl} target="_blank" rel="noopener noreferrer" className="border-2 border-bauhaus-black bg-white px-2 py-1 hover:bg-bauhaus-black hover:text-white">
              Verify on ABR ↗
            </a>
            <a href={BUTTERFLY_DGR.acncUrl} target="_blank" rel="noopener noreferrer" className="border-2 border-bauhaus-black bg-white px-2 py-1 hover:bg-bauhaus-black hover:text-white">
              ACNC register ↗
            </a>
          </div>
        </div>

        {/* ── RECEIVED ────────────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
            Received · Xero income (ACT-GD)
          </h2>
          <div className="border-4 border-bauhaus-black bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-4 border-bauhaus-black px-3 py-2 text-[11px] font-bold">
              <span
                className={`px-2 py-0.5 font-black uppercase tracking-widest ${
                  m.ledger.source.status === 'live'
                    ? 'bg-bauhaus-blue text-white'
                    : m.ledger.source.status === 'error'
                      ? 'bg-bauhaus-red text-white'
                      : 'bg-white text-bauhaus-muted border-2 border-bauhaus-black/30'
                }`}
              >
                {m.ledger.source.status}
              </span>
              <span className="text-bauhaus-muted">{m.ledger.source.detail}</span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-bauhaus-black/10 sm:grid-cols-4">
              {m.ledger.totals.map((t) => (
                <div key={t.label} className="bg-white p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{t.label}</div>
                  <div className="mt-1 text-xl font-black text-bauhaus-black">{t.value}</div>
                  {t.detail && <div className="mt-1 text-[10px] font-bold text-bauhaus-muted">{t.detail}</div>}
                </div>
              ))}
            </div>
            {invoiceRows.length > 0 && (
              <div className="border-t-4 border-bauhaus-black">
                {invoiceRows.map((r, i) => (
                  <div
                    key={`${r.invoiceNumber}-${i}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-bauhaus-black/10 px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 font-bold">{r.name}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                        STATUS_TINT[r.group] ?? 'bg-white text-bauhaus-muted border-2 border-bauhaus-black/30'
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="w-20 text-right font-black">{r.amount}</span>
                  </div>
                ))}
                {m.ledger.moneyRows.length > invoiceRows.length && (
                  <div className="px-3 py-2 text-[11px] font-bold text-bauhaus-muted">
                    + {m.ledger.moneyRows.length - invoiceRows.length} more ACT-GD invoices in Xero.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── IN PLAY ─────────────────────────────────────────────────── */}
        <section className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">
              In play · open money conversations
            </h2>
            <Link
              href={`/org/${slug}/goods/engagement`}
              className="text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
            >
              Full warmth map →
            </Link>
          </div>
          {m.openAsks.length === 0 ? (
            <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted">
              No open funder / investor / finance conversations advancing right now. Warm one up from the map.
            </div>
          ) : (
            <div className="border-4 border-bauhaus-black bg-white">
              {m.openAsks.map((r) => {
                const band = warmthBand(r.warmth_display);
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-bauhaus-black/10 px-3 py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black">{r.display_name}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                          {REL_TYPE_LABEL[r.relationship_type]}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-bauhaus-muted">
                        {STAGE_LABEL[r.stage]}
                        {r.target_stage ? ` → ${r.target_stage}` : ''} · last touch {relDays(r.last_touch_at)}
                      </div>
                      <div className="mt-1 text-sm">
                        <span className="font-bold text-bauhaus-blue">Next:</span> {nextBestAction(r)}
                      </div>
                      {r.notes && <div className="mt-0.5 text-[11px] text-bauhaus-muted">{r.notes}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 text-[11px] font-black uppercase tracking-widest ${bandPill(band)}`}>
                        {band} {r.warmth_display}
                      </span>
                      {Number(r.total_received_aud) > 0 && (
                        <span className="text-[11px] font-bold text-bauhaus-muted">{money(r.total_received_aud)} before</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── AVAILABLE ───────────────────────────────────────────────── */}
        <section className="mb-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">
              Available to pursue · discovery engine
            </h2>
            <ScrapeMoreButton agentId={m.scrapeAgentId} label={m.scrapeAgentLabel} />
          </div>
          <p className="mb-3 text-[12px] text-bauhaus-muted">
            <strong className="text-bauhaus-black">{m.matchedPoolCount.toLocaleString('en-AU')}</strong> open opportunities
            match the Goods wheelhouse (Indigenous / enterprise / remote-regional / regenerative focus areas), soonest
            deadline first. &ldquo;Scrape more&rdquo; queues the {m.scrapeAgentLabel} agent via Mission Control.
          </p>
          {m.opportunities.length === 0 ? (
            <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted">
              No matched open opportunities loaded. Queue a scrape, or widen the focus filter.
            </div>
          ) : (
            <div className="border-4 border-bauhaus-black bg-white">
              {m.opportunities.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-start gap-x-4 gap-y-1 border-b border-bauhaus-black/10 px-3 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-black">
                      {o.url ? (
                        <a href={o.url} target="_blank" rel="noopener noreferrer" className="hover:text-bauhaus-blue hover:underline">
                          {o.name}
                        </a>
                      ) : (
                        o.name
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-bauhaus-muted">
                      {(() => {
                        const isTender = /tender|procure|austender|contract/i.test(o.sourceType ?? '');
                        return (
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                              isTender ? 'bg-bauhaus-blue text-white' : 'bg-bauhaus-yellow text-bauhaus-black'
                            }`}
                          >
                            {isTender ? 'Tender' : 'Grant'}
                          </span>
                        );
                      })()}
                      <span>{o.funder ?? 'Unknown funder'} · {deadlineLabel(o.deadline)}</span>
                    </div>
                    {o.focusAreas.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {o.focusAreas.map((f) => (
                          <span
                            key={f}
                            className="bg-bauhaus-canvas px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted"
                          >
                            {f.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {o.amountLabel && <span className="w-24 text-right text-lg font-black">{o.amountLabel}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-black uppercase tracking-widest">
            <Link href="/mission-control" className="text-bauhaus-blue hover:underline">Mission Control →</Link>
            <Link href="/opportunities" className="text-bauhaus-blue hover:underline">Full opportunity engine →</Link>
          </div>
        </section>

        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          Received = real Xero ACT-GD income invoices (<code>xero_invoices</code>) + lifetime support in the warmth registry.
          Available = <code>alma_funding_opportunities</code> matched on Goods focus areas. Nothing here is fabricated.
          Plan: <code>thoughts/shared/plans/goods-command-center-2026-06-09.md</code>.
        </div>
      </div>
    </main>
  );
}
