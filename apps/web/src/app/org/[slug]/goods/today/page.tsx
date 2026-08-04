import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import {
  getGoodsCapitalWorkspace,
  money,
  moneyRange,
} from '@/lib/services/goods-capital-workspace';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  DataModeBanner,
  EmptyState,
  formatWorkspaceDate,
  GoodsWorkspaceHeader,
  Metric,
  SectionTitle,
  StatusPill,
} from '../_components/goods-capital-ui';
import { GoodsMatterReviewForm } from '../_components/goods-matter-review-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return {
    title: 'Goods — Today',
    description: 'The bounded leader desk for GOODS capital, promises, evidence and decisions.',
  };
}

export default async function GoodsTodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ matter?: string }>;
}) {
  const { slug } = await params;
  const { matter: requestedMatter } = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug)
    ? ACT_FAST_PROFILE
    : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const workspace = await getGoodsCapitalWorkspace();
  const selected = workspace.attention.find((item) => item.matter.slug === requestedMatter)
    ?? workspace.attention[0]
    ?? null;

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <GoodsWorkspaceHeader
        slug={slug}
        orgName={profile.name}
        active="today"
        eyebrow="Leader desk · five matters maximum"
        title="Today"
        description={(
          <>
            Work what requires judgment, not an endless prospect list. Obligations and campaign truth come first;
            every action remains evidence-backed and human-approved.
          </>
        )}
        aside={(
          <div className="border-4 border-white bg-white px-4 py-3 text-bauhaus-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Written commitments</div>
            <div className="mt-1 text-4xl font-black tabular-nums">{money(workspace.summary.committedAud)}</div>
            <div className="mt-1 text-[10px] font-bold text-bauhaus-muted">{workspace.summary.signedCommitmentCount} evidence-backed</div>
          </div>
        )}
      />

      <div className="mx-auto max-w-7xl px-4 py-6">
        <DataModeBanner warning={workspace.dataWarning} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Capital required" value={moneyRange(workspace.summary.needMinAud, workspace.summary.needMaxAud)} detail="Five concrete cost blocks" tone="blue" />
          <Metric label="CRM targets" value={money(workspace.summary.targetAud)} detail={`${money(workspace.summary.unallocatedTargetAud)} is not allocated to a cost block`} />
          <Metric label="Committed" value={money(workspace.summary.committedAud)} detail="Accepted amount + letter or executed agreement only" tone="yellow" />
          <Metric label="Attention queue" value={String(workspace.attention.length)} detail="Bounded to five matters; an empty slot is valid" tone="dark" />
        </div>

        <div className="mt-8">
          <SectionTitle
            eyebrow="Observe → verify → decide → act → learn"
            title="What needs understanding now"
            description="Selected by explicit due dates, obligations, evidence gaps and the QBE truth conflict. No warmth, prestige or donation score is used."
          />

          {workspace.attention.length === 0 ? (
            <EmptyState title="The weekly queue is clear">
              Nothing currently meets an explicit attention condition. That is a valid result; the system should not manufacture work.
            </EmptyState>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
              <div className="space-y-3">
                {workspace.attention.map((item, index) => {
                  const isSelected = selected?.matter.slug === item.matter.slug;
                  const query = new URLSearchParams({ matter: item.matter.slug }).toString();
                  return (
                    <article key={item.matter.id} className={`border-4 bg-white ${isSelected ? 'border-bauhaus-blue shadow-[6px_6px_0_0_var(--bauhaus-black)]' : 'border-bauhaus-black'}`}>
                      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone={item.trigger === 'promise_overdue' ? 'bad' : item.trigger === 'truth_reset' ? 'warn' : 'info'}>{index + 1}. {item.triggerLabel}</StatusPill>
                            <span className="text-[10px] font-bold text-bauhaus-muted">Due {formatWorkspaceDate(item.dueAt)}</span>
                          </div>
                          <h3 className="mt-3 text-lg font-black text-bauhaus-black">{item.matter.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-bauhaus-muted">{item.matter.whyNow}</p>
                          {item.route?.nextAction ? (
                            <div className="mt-3 border-l-4 border-bauhaus-blue bg-link-light px-3 py-2 text-xs leading-5">
                              <strong>Next factual move:</strong> {item.route.nextAction}
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.matter.evidenceGaps.slice(0, 3).map((gap) => <StatusPill key={gap} tone="warn">? {gap}</StatusPill>)}
                            {item.matter.evidenceGaps.length > 3 ? <StatusPill>+{item.matter.evidenceGaps.length - 3} unknowns</StatusPill> : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                          <Link href={`/org/${slug}/goods/today?${query}`} className={`inline-flex min-h-11 items-center justify-center border-2 px-3 text-[10px] font-black uppercase tracking-widest ${isSelected ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-canvas'}`}>
                            {isSelected ? 'Selected' : 'Review'}
                          </Link>
                          <Link href={`/org/${slug}/goods/matters/${item.matter.slug}`} className="inline-flex min-h-11 items-center justify-center border-2 border-bauhaus-black bg-white px-3 text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-canvas">
                            Full matter
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <aside className="xl:sticky xl:top-24 xl:self-start">
                {selected ? (
                  <GoodsMatterReviewForm
                    slug={slug}
                    matter={selected.matter}
                    route={selected.route}
                    orgProfileId={profile.id}
                    latestDecision={selected.latestDecision}
                    compact
                  />
                ) : null}
              </aside>
            </div>
          )}
        </div>

        <div className="mt-8 border-4 border-bauhaus-black bg-white p-5">
          <SectionTitle title="Operating rhythm" description="The interface supports a small, repeatable practice rather than another reporting burden." />
          <div className="grid gap-3 md:grid-cols-5">
            {[
              ['Monday', 'Refresh official evidence; do not create work automatically.'],
              ['Tuesday', '75-minute desk: decide the five-or-fewer matters.'],
              ['During week', 'One or two prepared conversations; listen before classifying.'],
              ['Friday', 'Complete, renegotiate or release every due promise.'],
              ['Monthly', 'Review capital blocks and change one evidence rule at most.'],
            ].map(([day, practice]) => (
              <div key={day} className="border-2 border-bauhaus-black bg-bauhaus-canvas p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{day}</div>
                <p className="mt-1 text-xs leading-5 text-bauhaus-muted">{practice}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
