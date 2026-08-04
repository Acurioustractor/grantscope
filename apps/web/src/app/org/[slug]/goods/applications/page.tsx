import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getGoodsCapitalWorkspace, money } from '@/lib/services/goods-capital-workspace';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  DataModeBanner,
  GoodsWorkspaceHeader,
  Metric,
  SectionTitle,
  StatusPill,
} from '../_components/goods-capital-ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Applications', description: 'Evidence-gated grant and finance application rooms for GOODS.' };
}

export default async function GoodsApplicationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();
  const workspace = await getGoodsCapitalWorkspace();
  const totalPassed = workspace.applications.reduce((sum, application) => sum + application.readyGateCount, 0);
  const totalGates = workspace.applications.reduce((sum, application) => sum + application.gates.length, 0);
  const submitted = workspace.applications.filter((application) => ['submitted', 'due_diligence', 'decided'].includes(application.route.applicationState)).length;

  // Deadline-first: grants are deadline-driven, not stage-driven. Soonest decision
  // deadline leads; routes with no known deadline sink to the end.
  const applications = [...workspace.applications].sort((a, b) => {
    const ta = a.route.decisionDueAt ? new Date(a.route.decisionDueAt).getTime() : Infinity;
    const tb = b.route.decisionDueAt ? new Date(b.route.decisionDueAt).getTime() : Infinity;
    return ta - tb;
  });
  const daysTo = (iso: string | null): number | null => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000);
  };

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <GoodsWorkspaceHeader
        slug={slug}
        orgName={profile.name}
        active="applications"
        eyebrow="Eligibility · full cost · evidence · submission"
        title="Applications"
        description="Each room is a real grant, finance or capital route. The six hard gates make weak routes visible before GOODS spends a fortnight drafting them."
      />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <DataModeBanner warning={workspace.dataWarning} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Route rooms" value={String(workspace.applications.length)} detail="One per current capital target" tone="blue" />
          <Metric label="Hard gates passed" value={`${totalPassed}/${totalGates}`} detail="Thematic fit cannot override a blocker" />
          <Metric label="Ready" value={String(workspace.summary.readyApplicationCount)} detail="All six gates must pass" tone="yellow" />
          <Metric label="Submitted" value={String(submitted)} detail="Explicit application state only" tone="dark" />
        </div>

        <div className="mt-8">
          <SectionTitle
            eyebrow="Production rooms"
            title="Current routes"
            description="Drafts and attachments stay in Notion or Drive. This surface owns current facts, hard gates, allocations, evidence references and the next action."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {applications.map((application) => {
              const { matter, route, gates } = application;
              const pct = Math.round((application.readyGateCount / gates.length) * 100);
              const days = daysTo(route.decisionDueAt);
              return (
                <article key={route.id} className="flex flex-col border-4 border-bauhaus-black bg-white">
                  <div className="p-5">
                    <div className="flex flex-wrap gap-2">
                      {days != null && (
                        <StatusPill tone={days < 0 ? 'bad' : days <= 14 ? 'warn' : 'neutral'}>
                          {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'due today' : `${days}d to deadline`}
                        </StatusPill>
                      )}
                      <StatusPill tone="info">{route.applicationState.replaceAll('_', ' ')}</StatusPill>
                      <StatusPill tone={application.blockedGateCount ? 'bad' : application.readyGateCount === gates.length ? 'good' : 'warn'}>{application.readyGateCount}/{gates.length} gates</StatusPill>
                      <StatusPill tone={route.askMadeAt ? 'good' : 'neutral'}>{route.askMadeAt ? 'Ask made' : 'Target only'}</StatusPill>
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black">{matter.counterpartyName}</h2>
                        <p className="mt-1 text-xs leading-5 text-bauhaus-muted">{route.namedRoute ?? 'No named route verified'}</p>
                      </div>
                      <div className="shrink-0 text-2xl font-black text-bauhaus-blue">{money(route.targetAmountAud)}</div>
                    </div>

                    <div className="mt-4 h-4 overflow-hidden border-2 border-bauhaus-black bg-bauhaus-canvas"><div className={`h-full ${application.blockedGateCount ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {gates.map((gate) => (
                        <div key={gate.key} className={`border px-2 py-2 ${gate.state === 'pass' ? 'border-emerald-300 bg-emerald-50' : gate.state === 'blocked' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`} title={gate.detail}>
                          <div className="text-[9px] font-black uppercase tracking-wider">{gate.label}</div>
                          <div className={`mt-1 text-[9px] font-black uppercase ${gate.state === 'pass' ? 'text-emerald-800' : gate.state === 'blocked' ? 'text-red-800' : 'text-amber-800'}`}>{gate.state}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="border-2 border-bauhaus-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Recipient</div><div className="mt-1 font-bold leading-5">{route.legalRecipientName ?? 'Unknown'}</div></div>
                      <div className="border-2 border-bauhaus-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Allocated use</div><div className="mt-1 font-bold leading-5">{application.allocations.length ? application.allocations.map((allocation) => money(allocation.proposedAmountAud)).join(', ') : 'None'}</div></div>
                    </div>
                  </div>
                  <div className="mt-auto border-t-2 border-bauhaus-black bg-bauhaus-canvas p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Next move</div>
                    <p className="mt-1 min-h-10 text-xs leading-5 text-bauhaus-muted">{route.nextAction ?? 'No owned next action.'}</p>
                    <Link href={`/org/${slug}/goods/applications/${route.routeCode}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center border-2 border-bauhaus-black bg-bauhaus-black px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-blue">Open application room</Link>
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
