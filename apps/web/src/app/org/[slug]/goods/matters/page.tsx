import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getGoodsCapitalWorkspace, matterRoute, money } from '@/lib/services/goods-capital-workspace';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  DataModeBanner,
  formatWorkspaceDate,
  GoodsWorkspaceHeader,
  Metric,
  SectionTitle,
  StatusPill,
} from '../_components/goods-capital-ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Matters', description: 'Matter-specific funding and relationship work for GOODS.' };
}

export default async function GoodsMattersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();
  const workspace = await getGoodsCapitalWorkspace();
  const open = workspace.matters.filter((matter) => matter.state === 'open');
  const routed = open.filter((matter) => matterRoute(workspace, matter));
  const unresolved = open.reduce((sum, matter) => sum + matter.evidenceGaps.length, 0);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <GoodsWorkspaceHeader
        slug={slug}
        orgName={profile.name}
        active="matters"
        eyebrow="One real question · the right parties · an owned action"
        title="Matters"
        description="A matter is a bounded piece of work with a funder, expert, buyer or partner. It carries evidence, unknowns, decisions and promises without pretending the whole relationship has one stage."
      />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <DataModeBanner warning={workspace.dataWarning} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Open matters" value={String(open.length)} detail="Open means the question is active" tone="blue" />
          <Metric label="Funding routes" value={String(routed.length)} detail="Six current capital targets" />
          <Metric label="Named unknowns" value={String(unresolved)} detail="Unknown is not silently treated as no" tone="yellow" />
          <Metric label="Written commitments" value={money(workspace.summary.committedAud)} detail="Evidence-gated, not weighted" tone="dark" />
        </div>

        <div className="mt-8">
          <SectionTitle
            eyebrow="Current casework"
            title="Open matters"
            description="Open the full record before acting. Public evidence may justify research; it does not establish permission, access or commitment."
          />
          <div className="space-y-3">
            {open.map((matter) => {
              const route = matterRoute(workspace, matter);
              const latestDecision = workspace.decisions.find((decision) => decision.sourceRef === matter.slug) ?? null;
              return (
                <article key={matter.id} className="border-4 border-bauhaus-black bg-white">
                  <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill tone={matter.slug === 'qbe-stage-2-truth-reset' ? 'warn' : 'info'}>{matter.slug === 'qbe-stage-2-truth-reset' ? 'Truth reset' : route?.routeType.replaceAll('_', ' ') ?? 'Campaign governance'}</StatusPill>
                        <StatusPill>{matter.authorityState === 'not_required' ? 'Authority not required for this question' : `Authority ${matter.authorityState}`}</StatusPill>
                        {latestDecision?.judgment.nextMove ? <StatusPill tone="good">Last move: {latestDecision.judgment.nextMove}</StatusPill> : <StatusPill tone="warn">No human read</StatusPill>}
                      </div>
                      <h2 className="mt-3 text-xl font-black text-bauhaus-black">{matter.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-bauhaus-muted">{matter.purpose}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="border-l-4 border-bauhaus-blue bg-link-light px-3 py-2 text-xs leading-5">
                          <strong>Why now:</strong> {matter.whyNow ?? 'No current trigger recorded.'}
                        </div>
                        <div className="border-l-4 border-bauhaus-black bg-bauhaus-canvas px-3 py-2 text-xs leading-5">
                          <strong>Learning question:</strong> {matter.currentLearningQuestion ?? 'No next question recorded.'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col border-t-2 border-bauhaus-black/20 pt-3 lg:border-l-2 lg:border-t-0 lg:pl-4 lg:pt-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Counterparty</div>
                      <div className="mt-1 text-sm font-black">{matter.counterpartyName}</div>
                      <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Target</div>
                      <div className="mt-1 text-2xl font-black text-bauhaus-blue">{route?.targetAmountAud ? money(route.targetAmountAud) : 'No capital target'}</div>
                      <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Review</div>
                      <div className="mt-1 text-xs font-bold">{formatWorkspaceDate(matter.nextReviewAt)}</div>
                      <Link href={`/org/${slug}/goods/matters/${matter.slug}`} className="mt-auto inline-flex min-h-11 items-center justify-center border-2 border-bauhaus-black bg-bauhaus-black px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-blue">
                        Open matter
                      </Link>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t-2 border-bauhaus-black bg-bauhaus-canvas px-4 py-3">
                    {matter.evidenceGaps.slice(0, 5).map((gap) => <StatusPill key={gap} tone="warn">? {gap}</StatusPill>)}
                    {matter.evidenceGaps.length > 5 ? <StatusPill>+{matter.evidenceGaps.length - 5}</StatusPill> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
