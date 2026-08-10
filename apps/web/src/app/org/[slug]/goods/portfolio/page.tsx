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
  type PortfolioDecision,
} from '@/lib/services/goods-investment-portfolio';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  GoodsWorkspaceHeader,
  Metric,
  SectionTitle,
  StatusPill,
} from '../_components/goods-capital-ui';

export const revalidate = 300;

export async function generateMetadata() {
  return {
    title: 'Goods — Investment Portfolio',
    description: 'One row per community pathway: decision, authority, evidence, investment use, money route.',
  };
}

const DECISION_TONE: Record<PortfolioDecision, 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'dark'> = {
  listen: 'neutral',
  scope: 'info',
  'ready to pursue': 'warn',
  submitted: 'dark',
  'funded/delivering': 'good',
  hold: 'bad',
};

function PathwayCard({ pathway }: { pathway: CommunityPathway }) {
  const eligible = isPortfolioEligible(pathway);
  const use = INVESTMENT_USES[pathway.investmentUse];
  return (
    <article className="border-4 border-bauhaus-black bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b-4 border-bauhaus-black bg-bauhaus-canvas px-4 py-3">
        <div>
          <h3 className="text-lg font-black uppercase tracking-widest text-bauhaus-black">{pathway.community}</h3>
          <div className="mt-1 text-[11px] leading-5 text-bauhaus-muted">{pathway.authority}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="neutral">Stage: {STAGE_LABEL[pathway.stage]}</StatusPill>
          <StatusPill tone={DECISION_TONE[pathway.decision]}>{pathway.decision}</StatusPill>
          <StatusPill tone={eligible ? 'good' : 'warn'}>
            {eligible ? 'Investment work OK' : 'Relationship work only'}
          </StatusPill>
        </div>
      </header>

      <div className="grid gap-0 md:grid-cols-3">
        <div className="border-b-2 border-bauhaus-black/15 px-4 py-3 md:border-b-0 md:border-r-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Next community decision</div>
          <p className="mt-1 text-xs leading-5 text-bauhaus-black">{pathway.nextDecision ?? 'None named — nothing to pursue yet.'}</p>
          <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Relationship owner</div>
          <p className="mt-1 text-xs leading-5 text-bauhaus-black">
            {pathway.relationshipOwner ?? <span className="text-bauhaus-red font-bold">Not named</span>}
          </p>
          {pathway.nextActionDue ? (
            <>
              <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Due</div>
              <p className="mt-1 text-xs leading-5 text-bauhaus-black">{pathway.nextActionDue}</p>
            </>
          ) : null}
        </div>

        <div className="border-b-2 border-bauhaus-black/15 px-4 py-3 md:border-b-0 md:border-r-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Evidence already held</div>
          <ul className="mt-1 space-y-1 text-xs leading-5 text-bauhaus-black">
            {pathway.evidenceHeld.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
          <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Evidence this use requires</div>
          <p className="mt-1 text-xs leading-5 text-bauhaus-muted">{use.evidenceRequired}</p>
        </div>

        <div className="px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Investment use</div>
          <p className="mt-1 text-xs font-bold leading-5 text-bauhaus-black">{use.label}</p>
          <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Money route</div>
          <p className="mt-1 text-xs leading-5 text-bauhaus-black">{pathway.moneyRoute}</p>
          <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Suitable capital</div>
          <p className="mt-1 text-xs leading-5 text-bauhaus-muted">{use.suitableCapital}</p>
        </div>
      </div>

      <div className="border-t-4 border-bauhaus-black bg-bauhaus-yellow px-4 py-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black">Do not do yet</div>
        <p className="mt-1 text-xs leading-5 text-bauhaus-black">{pathway.doNotYet}</p>
      </div>

      {pathway.links.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t-2 border-bauhaus-black/15 px-4 py-3">
          {pathway.links.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              className="inline-flex min-h-9 items-center border-2 border-bauhaus-black bg-white px-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
            >
              {link.system}: {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
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
  const listening = pathways.filter((p) => !isPortfolioEligible(p));
  const submitted = pathways.filter((p) => p.decision === 'submitted').length;

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
            One row per community pathway, not one row per grant. Start with the community decision, check the
            relationship, then decide whether investment is appropriate. Only after that does grant, buyer or lender
            work belong on the table.
          </>
        )}
        aside={(
          <div className="border-4 border-white bg-white px-4 py-3 text-bauhaus-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Pathways carrying investment work</div>
            <div className="mt-1 text-3xl font-black tabular-nums">{eligible.length} / {pathways.length}</div>
            <div className="mt-1 text-[10px] font-bold text-bauhaus-muted">Needs a named decision and an owner</div>
          </div>
        )}
      />

      <div className="mx-auto max-w-[1760px] px-4 py-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Community pathways" value={String(pathways.length)} detail="The whole portfolio; one row each" />
          <Metric label="Investment-eligible" value={String(eligible.length)} detail="Named decision + relationship owner" tone="yellow" />
          <Metric label="Listening only" value={String(listening.length)} detail="No application work yet" />
          <Metric label="Submitted" value={String(submitted)} detail="Application in with a funder" tone="dark" />
        </div>

        <div className="mt-8">
          <SectionTitle
            eyebrow="Weekly read"
            title="Community pathways"
            description="A pathway becomes eligible for investment work only when it has both a named next community decision and a relationship owner. Nothing here is an ownership claim, and no CRM stage counts as approval."
          />
          <div className="space-y-4">
            {pathways.map((pathway) => (
              <PathwayCard key={pathway.id} pathway={pathway} />
            ))}
          </div>
        </div>

        <div className="mt-10">
          <SectionTitle
            eyebrow="Six uses"
            title="Investment lenses"
            description="Every investment or opportunity must declare one primary use. This is the field that makes grants useful rather than noisy — if an opportunity cannot fund a named use for a named community or the shared network, it stays outside the portfolio."
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(INVESTMENT_USES).map(([key, use]) => {
              const count = pathways.filter((p) => p.investmentUse === key).length;
              return (
                <div key={key} className="border-4 border-bauhaus-black bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-bauhaus-black">{use.label}</h3>
                    <StatusPill tone={count > 0 ? 'dark' : 'neutral'}>{count} pathway{count === 1 ? '' : 's'}</StatusPill>
                  </div>
                  <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Suitable capital</div>
                  <p className="mt-1 text-xs leading-5 text-bauhaus-black">{use.suitableCapital}</p>
                  <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Evidence required before pursuit</div>
                  <p className="mt-1 text-xs leading-5 text-bauhaus-muted">{use.evidenceRequired}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10">
          <SectionTitle eyebrow="Honesty" title="Known source conflicts" description="Shown here rather than quietly resolved in a number." />
          <ul className="space-y-2">
            {PORTFOLIO_DATA_LIMITS.map((limit) => (
              <li key={limit} className="border-l-4 border-bauhaus-red bg-white px-4 py-3 text-xs leading-5 text-bauhaus-black">
                {limit}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-5 text-bauhaus-muted">
            Readings sourced from <code className="font-mono">thoughts/shared/handoffs/goods-investment-portfolio-alignment-2026-08-10.md</code>,
            which cites the Goods Asset Register decision log. Edit{' '}
            <code className="font-mono">src/lib/services/goods-investment-portfolio.ts</code> to change what this screen says.
          </p>
        </div>
      </div>
    </main>
  );
}
