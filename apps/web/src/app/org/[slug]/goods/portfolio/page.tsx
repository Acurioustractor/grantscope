import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import {
  COMMUNITY_PATHWAYS,
  INVESTMENT_USES,
  PORTFOLIO_DATA_LIMITS,
  STAGE_LABEL,
  isPortfolioEligible,
  type CommunityPathway,
} from '@/lib/services/goods-investment-portfolio';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { GoodsWorkspaceHeader } from '../_components/goods-capital-ui';

export const revalidate = 300;

export async function generateMetadata() {
  return {
    title: 'Goods — Investment Portfolio',
    description: 'One line per community pathway: decision, owner, investment use.',
  };
}

/** Short labels for the table. The full sentence lives in the expanded row. */
const USE_SHORT: Record<CommunityPathway['investmentUse'], string> = {
  'relationship-and-scoping': 'Scoping',
  'community-wraparound': 'Wraparound',
  'production-equipment': 'Production kit',
  'measured-production-run': 'Measured run',
  'buyer-delivery': 'Buyer delivery',
  'shared-network': 'Network',
};

const COLS = 'grid grid-cols-[minmax(0,2fr)_84px_minmax(0,1fr)_minmax(0,2.4fr)_120px_20px] items-baseline gap-3';

function PathwayRow({ pathway }: { pathway: CommunityPathway }) {
  const eligible = isPortfolioEligible(pathway);
  const use = INVESTMENT_USES[pathway.investmentUse];
  return (
    <details className="group border-t border-slate-200 first:border-t-0 open:bg-slate-50/60">
      <summary
        className={`${COLS} cursor-pointer list-none px-4 py-3 text-xs hover:bg-slate-50 [&::-webkit-details-marker]:hidden`}
      >
        <span className="min-w-0 truncate font-semibold text-slate-900">{pathway.community}</span>
        <span className="text-[11px] text-slate-500">{STAGE_LABEL[pathway.stage]}</span>
        <span className={`min-w-0 truncate text-[11px] ${pathway.relationshipOwner ? 'text-slate-700' : 'font-semibold text-bauhaus-red'}`}>
          {pathway.relationshipOwner ?? '— not named'}
        </span>
        <span className="min-w-0 truncate text-slate-700">{pathway.nextDecision ?? 'No decision named'}</span>
        <span className="text-[11px] text-slate-500">{USE_SHORT[pathway.investmentUse]}</span>
        <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-90">▸</span>
      </summary>

      <div className="grid gap-5 px-4 pb-5 pt-1 text-xs leading-5 md:grid-cols-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Evidence already held</div>
          <ul className="mt-1 space-y-0.5 text-slate-800">
            {pathway.evidenceHeld.map((item) => <li key={item}>· {item}</li>)}
          </ul>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Authority</div>
          <p className="mt-1 text-slate-700">{pathway.authority}</p>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Money route</div>
          <p className="mt-1 text-slate-800">{pathway.moneyRoute}</p>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{use.label} needs</div>
          <p className="mt-1 text-slate-600">{use.evidenceRequired}</p>
        </div>
        <div>
          <div className="rounded-lg bg-[#fff8df] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">Do not do yet</div>
            <p className="mt-1 text-slate-800">{pathway.doNotYet}</p>
          </div>
          {!eligible ? (
            <p className="mt-2 text-[11px] font-semibold text-bauhaus-red">
              Relationship work only — needs an owner named before any application work.
            </p>
          ) : null}
          {pathway.links.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {pathway.links.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  className="inline-flex min-h-8 items-center rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:border-slate-400"
                >
                  {link.label} →
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </details>
  );
}

export default async function GoodsInvestmentPortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug)
    ? ACT_FAST_PROFILE
    : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const pathways = [...COMMUNITY_PATHWAYS];
  const eligible = pathways.filter(isPortfolioEligible);
  const unowned = pathways.filter((p) => !p.relationshipOwner);
  const emptyLenses = Object.entries(INVESTMENT_USES).filter(
    ([key]) => !pathways.some((p) => p.investmentUse === key),
  );

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <GoodsWorkspaceHeader
        slug={slug}
        orgName={profile.name}
        active="portfolio"
        eyebrow="Community decision → relationship → investment need → opportunity"
        title="Investment portfolio"
        description={(
          <>
            One line per community pathway, not one per grant. {eligible.length} of {pathways.length} carry investment
            work; the rest are relationship work until someone is named against them.
          </>
        )}
      />

      <div className="mx-auto max-w-[1480px] px-6 py-6">
        <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white">
          <div className={`${COLS} border-b border-slate-300 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500`}>
            <span>Community</span>
            <span>Stage</span>
            <span>Owner</span>
            <span>Next community decision</span>
            <span>Use</span>
            <span aria-hidden="true" />
          </div>
          {pathways.map((pathway) => <PathwayRow key={pathway.id} pathway={pathway} />)}
        </div>

        {unowned.length > 0 ? (
          <p className="mt-3 text-xs text-slate-600">
            <span className="font-semibold text-bauhaus-red">{unowned.length} pathways have no relationship owner.</span>{' '}
            Naming one is the only move that unlocks investment work on them.
          </p>
        ) : null}

        <div className="mt-8 space-y-2">
          <details className="rounded-xl border border-slate-300 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-800 hover:bg-slate-50">
              Investment lenses — every opportunity declares one use
              {emptyLenses.length > 0 ? (
                <span className="ml-2 font-normal text-slate-500">
                  ({emptyLenses.length} of 6 have no pathway: {emptyLenses.map(([, u]) => u.label).join(', ')})
                </span>
              ) : null}
            </summary>
            <div className="grid gap-3 border-t border-slate-200 px-4 py-4 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(INVESTMENT_USES).map(([key, use]) => {
                const count = pathways.filter((p) => p.investmentUse === key).length;
                return (
                  <div key={key} className="rounded-lg border border-slate-200 p-3 text-xs leading-5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-900">{use.label}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${count > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                    </div>
                    <p className="mt-1 text-slate-600">{use.suitableCapital}</p>
                    <p className="mt-1 text-slate-500">Needs: {use.evidenceRequired}</p>
                  </div>
                );
              })}
            </div>
          </details>

          <details className="rounded-xl border border-slate-300 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-800 hover:bg-slate-50">
              Known source conflicts
              <span className="ml-2 font-normal text-slate-500">({PORTFOLIO_DATA_LIMITS.length}) — shown, not resolved into a number</span>
            </summary>
            <ul className="space-y-2 border-t border-slate-200 px-4 py-4">
              {PORTFOLIO_DATA_LIMITS.map((limit) => (
                <li key={limit} className="border-l-2 border-bauhaus-red pl-3 text-xs leading-5 text-slate-700">{limit}</li>
              ))}
            </ul>
            <p className="border-t border-slate-200 px-4 py-3 text-[11px] leading-5 text-slate-500">
              Readings from <code className="font-mono">thoughts/shared/handoffs/goods-investment-portfolio-alignment-2026-08-10.md</code>.
              Edit <code className="font-mono">src/lib/services/goods-investment-portfolio.ts</code> to change what this screen says.
            </p>
          </details>
        </div>
      </div>
    </main>
  );
}
