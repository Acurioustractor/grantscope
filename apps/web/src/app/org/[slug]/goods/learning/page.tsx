import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getGoodsCapitalWorkspace } from '@/lib/services/goods-capital-workspace';
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

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Learning', description: 'Append-only decisions, promises, outcomes and model learning for GOODS.' };
}

export default async function GoodsLearningPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();
  const workspace = await getGoodsCapitalWorkspace();
  const superseding = workspace.decisions.filter((decision) => Boolean(decision.supersedesId)).length;
  const promiseEvents = workspace.events.filter((event) => event.signalKind.includes('commitment') || event.signalKind.includes('return'));
  const outcomeEvents = workspace.events.filter((event) => event.signalKind.includes('outcome') || event.signalKind.includes('completed'));

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <GoodsWorkspaceHeader
        slug={slug}
        orgName={profile.name}
        active="learning"
        eyebrow="Episodes · promises · outcomes · rule changes"
        title="Learning"
        description="Keep the old case visible, attribute interpretations, and change the model only when real work exposes a missing distinction. No silent scoring or model-weight changes."
      />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <DataModeBanner warning={workspace.dataWarning} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Human reads" value={String(workspace.decisions.length)} detail="Append-only matter judgments" tone="blue" />
          <Metric label="Superseding reads" value={String(superseding)} detail="Earlier cases remain visible" />
          <Metric label="Promises & returns" value={String(promiseEvents.length)} detail="Directional, owned and dated" tone="yellow" />
          <Metric label="Observed outcomes" value={String(outcomeEvents.length)} detail="Activity is not treated as impact" tone="dark" />
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(330px,0.8fr)]">
          <section>
            <SectionTitle
              eyebrow="Prior-case memory"
              title="What changed"
              description="Human reads are attached to a real matter. New evidence can supersede a decision without erasing the earlier judgment."
            />
            {workspace.decisions.length === 0 ? (
              <EmptyState title="No matter reviews yet">
                Start from <Link href={`/org/${slug}/goods/today`} className="font-black text-bauhaus-blue underline">Today</Link>. Record only what changed, the next move, a learning question, and any real promise or return.
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {workspace.decisions.map((decision) => {
                  const matter = workspace.matters.find((candidate) => candidate.slug === decision.sourceRef);
                  return (
                    <article key={decision.id} className="border-4 border-bauhaus-black bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone="info">{decision.judgment.nextMove ?? decision.decision}</StatusPill>
                        {decision.supersedesId ? <StatusPill tone="good">Supersedes prior read</StatusPill> : null}
                        <span className="text-[10px] font-bold text-bauhaus-muted">{formatWorkspaceDate(decision.createdAt)}</span>
                      </div>
                      <h3 className="mt-3 text-base font-black">{matter?.title ?? decision.sourceRef}</h3>
                      <p className="mt-2 text-sm leading-6 text-bauhaus-muted">{decision.judgment.whatChanged ?? decision.reason ?? 'No material-delta note was captured.'}</p>
                      {decision.judgment.nextLearningQuestion ? (
                        <div className="mt-3 border-l-4 border-bauhaus-blue bg-link-light px-3 py-2 text-xs leading-5"><strong>Next question:</strong> {decision.judgment.nextLearningQuestion}</div>
                      ) : null}
                      {matter ? <Link href={`/org/${slug}/goods/matters/${matter.slug}`} className="mt-3 inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-widest text-bauhaus-blue underline">Open the full matter →</Link> : null}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-8">
              <SectionTitle title="Promises, returns and outcomes" description="These are events, not relationship stages." />
              {workspace.events.length === 0 ? (
                <EmptyState title="No linked events yet">A promise appears only when someone explicitly made one. An outcome appears only when something observable happened.</EmptyState>
              ) : (
                <div className="space-y-2">
                  {workspace.events.map((event) => (
                    <article key={event.id} className="border-2 border-bauhaus-black bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2"><StatusPill>{event.signalKind.replaceAll('_', ' ')}</StatusPill><span className="text-[10px] text-bauhaus-muted">{formatWorkspaceDate(event.happenedAt)}</span></div>
                      <div className="mt-2 text-sm font-black">{event.title}</div>
                      <p className="mt-1 text-xs leading-5 text-bauhaus-muted">{event.summary}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="border-4 border-bauhaus-black bg-white p-5">
              <SectionTitle title="Monthly model review" description="Finish with one decision and one durable pattern, not a larger backlog." />
              <ol className="space-y-3">
                {[
                  'Read a small set of full cases, including one that went nowhere.',
                  'Name repeated evidence gaps, unkept promises and missing roles.',
                  'Choose one thing to stop, one thing to start and one proof target.',
                  'Change one prompt, queue rule or evidence rule at most.',
                  'Record which cases justified the change and when it will be reviewed.',
                ].map((item, index) => (
                  <li key={item} className="flex gap-3 text-xs leading-5 text-bauhaus-muted"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bauhaus-black text-[10px] font-black text-white">{index + 1}</span><span>{item}</span></li>
                ))}
              </ol>
            </section>

            <section className="border-4 border-bauhaus-black bg-bauhaus-yellow p-5">
              <SectionTitle title="Quarterly counterparty reflection" />
              <ul className="space-y-2 text-xs leading-5 text-bauhaus-muted">
                <li>Did our preparation and follow-through help?</li>
                <li>Did we represent your priorities accurately?</li>
                <li>Was correction or withdrawal straightforward?</li>
                <li>What should we stop collecting or assuming?</li>
                <li>Can more of the work now be handed over?</li>
              </ul>
            </section>

            <section className="border-4 border-bauhaus-black bg-bauhaus-black p-5 text-white">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/55">Never optimise for</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Warmth score', 'Contact count', 'Email recency', 'Board proximity', 'Institutional prestige', 'Weighted pipeline', 'Machine sentiment'].map((metric) => <span key={metric} className="border border-white/30 bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider">{metric}</span>)}
              </div>
              <p className="mt-4 text-xs leading-5 text-white/70">Measure truthful block coverage, written commitments, full-cost recovery, promises fulfilled, delivery evidence and attributed significance instead.</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
