import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getWikiSupportIndex, type WikiSupportIndex } from '@/lib/services/wiki-support-index';
import { getWikiSupportFrontierQueue, type WikiSupportFrontierQueue } from '@/lib/services/wiki-support-frontier';
import { workshopWikiHref } from '@/lib/services/act-workshop-wiki';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { ListPreviewProvider, GrantPreviewTrigger } from '../../components/list-preview';
import {
  getOrgProfileBySlug,
  getOrgFundingByProgram,
  getOrgFundingByYear,
  getOrgFundingYears,
  getOrgContracts,
  getOrgAlmaInterventions,
  getOrgEntity,
  getOrgLocalEcosystem,
  getOrgPrograms,
  getOrgPipeline,
  getOrgContacts,
  getOrgLeadership,
  getMatchedGrantOpportunities,
  getOrgPeerOrgs,
  getOrgProjectSummaries,
  getOrgPowerIndex,
  getOrgRevolvingDoor,
  getOrgRelationshipSummary,
  getOrgFundingDesert,
  getOrgBoardMembers,
  getOrgDonorCrosslinks,
  getOrgFoundationFunders,
  getOrgFoundationPortfolio,
  money,
  type OrgProfile,
  type OrgProjectSummary,
  type OrgPipelineItemWithEntity,
  type MatchedGrant,
} from '@/lib/services/org-dashboard-service';
import { Section } from '../_components/ui';
import { ProjectCards } from '../_components/project-cards';
import {
  KeyStats,
  PowerScoreSection,
  RevolvingDoorSection,
  RelationshipSummarySection,
  FundingDesertSection,
  BoardMembersSection,
  DonorCrosslinksSection,
  FoundationFundersSection,
  LeadershipSection,
  FundingSection,
  FundingTimelineSection,
  ProgramsSection,
  AlmaSection,
  PipelineSection,
  MatchedGrantsSection,
  projectOptionsFromSummaries,
  ContactsSection,
  ContractsSection,
  EcosystemSection,
  PeerOrgsSection,
  DashboardFooter,
} from '../_components/org-sections';

export const revalidate = 3600;

function FastOrgDashboard({
  profile,
  slug,
  wikiSupportIndex,
}: {
  profile: OrgProfile;
  slug: string;
  wikiSupportIndex: WikiSupportIndex;
}) {
  const visibleProjects = wikiSupportIndex.projects.slice(0, 8);
  const priorityActions = wikiSupportIndex.support_actions.slice(0, 6);

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-sm font-black uppercase tracking-widest text-bauhaus-red">Fast operating view</p>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-wider">{profile.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-300">
                Instant project navigation from the ACT wiki support index. Open the full data dashboard only when you
                need heavy funding, relationship, contract, and ecosystem evidence.
              </p>
            </div>
            <Link
              href={`/org/${slug}?full=1`}
              className="w-fit border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
            >
              Full data view
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <section className="border-4 border-bauhaus-black bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Start here</p>
              <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Pick the working surface</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/org/${slug}/wiki/goods-operating-system`}
                className="border border-bauhaus-black bg-bauhaus-black px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-red"
              >
                Goods OS
              </Link>
              <Link
                href={`/org/${slug}/wiki/workshop-alignment`}
                className="border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
              >
                Workshop OS
              </Link>
              <Link
                href="/grants?type=open_opportunity&sort=closing_asc"
                className="border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
              >
                Grant finder
              </Link>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleProjects.map((project) => (
              <Link
                key={project.slug}
                href={`/org/${slug}/${project.slug}`}
                className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-bauhaus-black">{project.name}</span>
                  {project.code ? (
                    <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                      {project.code}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-600">{project.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.routes.slice(0, 4).map((route) => (
                    <span
                      key={`${project.slug}-${route.type}-${route.label}`}
                      className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500"
                    >
                      {route.type}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Run next</p>
          <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Source-backed actions</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {priorityActions.map((action) => (
              <Link
                key={action.id}
                href={action.grant_finder_href}
                className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                    {action.route_type}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {action.priority}
                  </span>
                </div>
                <div className="mt-2 text-sm font-black text-bauhaus-black">{action.title}</div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-600">{action.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function OrgSupportHub({
  slug,
  projects,
  pipeline,
  foundationCount,
  contactCount,
  matchedGrants,
  wikiSupportIndex,
  wikiSupportFrontierQueue,
}: {
  slug: string;
  projects: OrgProjectSummary[];
  pipeline: OrgPipelineItemWithEntity[];
  foundationCount: number;
  contactCount: number;
  matchedGrants: MatchedGrant[] | null;
  wikiSupportIndex: WikiSupportIndex;
  wikiSupportFrontierQueue: WikiSupportFrontierQueue;
}) {
  const primaryProjects = projects.slice(0, 6);
  const flatProjects = projects.flatMap((project) => [project, ...project.children]);
  const projectSlugSet = new Set(flatProjects.map((project) => project.slug));
  const indexedProjects = wikiSupportIndex.projects.filter(
    (project) => projectSlugSet.has(project.slug) || project.aliases.some((alias) => projectSlugSet.has(alias)),
  );
  const visibleIndexedProjects = indexedProjects.length > 0 ? indexedProjects : wikiSupportIndex.projects.slice(0, 4);
  const visibleIndexedProjectSlugs = new Set(visibleIndexedProjects.map((project) => project.slug));
  const visibleSupportActions = wikiSupportIndex.support_actions
    .filter((action) => visibleIndexedProjectSlugs.has(action.project_slug))
    .sort((left, right) => {
      const priorityRank = { high: 0, medium: 1, low: 2 };
      return priorityRank[left.priority] - priorityRank[right.priority];
    })
    .slice(0, 4);
  const visibleFrontierRows = wikiSupportFrontierQueue.rows.slice(0, 4);
  const supportRouteTypes = (['procurement', 'foundation', 'grant', 'capital'] as const).map((type) => ({
    type,
    count: wikiSupportIndex.projects.reduce(
      (sum, project) => sum + project.routes.filter((route) => route.type === type).length,
      0,
    ),
  }));
  const grantMatches = matchedGrants ?? [];
  const trackedGrantIds = new Set(pipeline.map((item) => item.grant_opportunity_id).filter(Boolean));
  const newMatches = grantMatches.filter((grant) => !trackedGrantIds.has(grant.id));
  const urgentMatches = newMatches.filter((grant) => {
    const closeDate = grant.deadline ?? grant.closes_at;
    if (!closeDate) return false;
    const days = Math.ceil((new Date(closeDate).getTime() - Date.now()) / 86400000);
    return Number.isFinite(days) && days >= 0 && days <= 45;
  });
  const activePipeline = pipeline.filter((item) => !['won', 'lost', 'declined', 'archived'].includes(item.status));
  const duePipeline = activePipeline.filter((item) => {
    if (!item.deadline) return false;
    const days = Math.ceil((new Date(item.deadline).getTime() - Date.now()) / 86400000);
    return Number.isFinite(days) && days >= 0 && days <= 30;
  });
  const bestMatches = [...newMatches]
    .sort((left, right) => (right.fit_score ?? 0) - (left.fit_score ?? 0))
    .slice(0, 3);
  const projectCount = projects.length;
  const operatingFocus =
    duePipeline.length > 0
      ? {
          title: 'Finish time-sensitive pipeline work',
          detail: `${duePipeline.length} tracked opportunit${duePipeline.length === 1 ? 'y is' : 'ies are'} due within 30 days.`,
          href: '#pipeline',
          label: 'Open pipeline',
        }
      : urgentMatches.length > 0
        ? {
            title: 'Triage urgent new matches',
            detail: `${urgentMatches.length} suggested opportunit${urgentMatches.length === 1 ? 'y closes' : 'ies close'} within 45 days.`,
            href: '#funding-feed',
            label: 'Review feed',
          }
        : newMatches.length > 0
          ? {
              title: 'Review the clean opportunity queue',
              detail: `${newMatches.length} untracked match${newMatches.length === 1 ? '' : 'es'} can be accepted, ignored, or moved into project pipeline.`,
              href: '#funding-feed',
              label: 'Open matches',
            }
          : {
              title: 'Find new opportunities',
              detail: 'Use project lanes and public-source discovery to widen the search without adding noise.',
              href: '/grants?type=open_opportunity&sort=closing_asc&quality=ready',
              label: 'Open grant finder',
            };
  const applicationTasks = [
    { label: 'Project summaries', detail: `${projectCount} lane${projectCount === 1 ? '' : 's'} to keep application-ready`, href: '#projects' },
    { label: 'Pipeline decisions', detail: `${activePipeline.length} active item${activePipeline.length === 1 ? '' : 's'} needing status clarity`, href: '#pipeline' },
    { label: 'Funder relationships', detail: `${foundationCount} foundation signal${foundationCount === 1 ? '' : 's'} and ${contactCount} contact${contactCount === 1 ? '' : 's'}`, href: '#foundation-funders' },
  ];
  const readinessAreas = [
    { id: 'vision-ambition' as const, label: 'Vision and ambition', signal: projectCount > 0 ? `${projectCount} project lanes mapped` : 'Needs narrative' },
    { id: 'social-objective-impact' as const, label: 'Social objective and impact', signal: 'Use project briefs, ALMA, and evidence context' },
    { id: 'business-model' as const, label: 'Business model clarity', signal: 'Separate grants, procurement, earned revenue, and capital' },
    { id: 'financial-performance' as const, label: 'Financial performance', signal: 'Funding history and pipeline value available' },
    { id: 'strategy-risk' as const, label: 'Strategy and risk', signal: activePipeline.length > 0 ? `${activePipeline.length} active decisions` : 'Needs active plan' },
    { id: 'process-technology' as const, label: 'Process and technology', signal: 'CivicGraph, GHL, grant finder, and pipeline can be aligned' },
    { id: 'governance-reporting' as const, label: 'Governance and reporting', signal: 'Use entity, leadership, relationship, and reporting signals' },
    { id: 'people-organisation' as const, label: 'People and organisation', signal: contactCount > 0 ? `${contactCount} contacts mapped` : 'Needs team map' },
    { id: 'legal-structure' as const, label: 'Legal structure', signal: 'ACT company identity now centralised' },
    { id: 'investors-capital' as const, label: 'Investors and capital', signal: foundationCount > 0 ? `${foundationCount} funder signals` : 'Needs capital pathway' },
  ];
  const documentPack = [
    { label: 'Vision, strategy, or business plan', href: workshopWikiHref(slug, 'vision-ambition') },
    { label: 'Revenue, costs, and yearly financial summary', href: workshopWikiHref(slug, 'financial-performance') },
    { label: 'Recent pitch deck or grant application', href: workshopWikiHref(slug, 'social-objective-impact') },
    { label: 'Theory of change or impact measures', href: workshopWikiHref(slug, 'social-objective-impact') },
    { label: 'Constitution, governance docs, or risk register', href: workshopWikiHref(slug, 'governance-reporting') },
    { label: 'Team structure and key delivery roles', href: workshopWikiHref(slug, 'people-organisation') },
  ];

  return (
    <section className="border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-blue">A Curious Tractor operating desk</p>
            <h2 className="mt-1 text-2xl font-black text-bauhaus-black">
              Calm view of opportunities, action, and growth work
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
              Use this top panel to decide what to do next. Search and source expansion sit behind it; the dashboard should only surface work that is ready to act on.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href={operatingFocus.href}
              className="border border-bauhaus-black bg-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-bauhaus-red"
            >
              {operatingFocus.label}
            </Link>
            <Link
              href="/grants?type=open_opportunity&sort=closing_asc&quality=ready"
              className="border border-gray-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
            >
              Find more
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_1fr_1fr]">
        <div className="border-l-4 border-bauhaus-blue bg-link-light/40 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Do next</div>
          <h3 className="mt-2 text-xl font-black text-bauhaus-black">{operatingFocus.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{operatingFocus.detail}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <a href="#funding-feed" className="block bg-white p-3 transition-colors hover:bg-link-light/60">
              <div className="text-lg font-black tabular-nums">{newMatches.length}</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">New matches</div>
            </a>
            <a href="#pipeline" className="block bg-white p-3 transition-colors hover:bg-link-light/60">
              <div className="text-lg font-black tabular-nums">{activePipeline.length}</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">Pipeline</div>
            </a>
            <a href={duePipeline.length > 0 ? '#pipeline' : '#funding-feed'} className="block bg-white p-3 transition-colors hover:bg-link-light/60">
              <div className="text-lg font-black tabular-nums">{urgentMatches.length + duePipeline.length}</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">Time-sensitive</div>
            </a>
          </div>
        </div>

        <div className="border border-gray-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Best opportunities</div>
          <div className="mt-3 space-y-3">
            {bestMatches.length > 0 ? bestMatches.map((grant) => (
              <GrantPreviewTrigger
                key={grant.id}
                grant={{
                  id: grant.id,
                  name: grant.name,
                  provider: grant.provider,
                  description: grant.description,
                  amount_min: grant.amount_min,
                  amount_max: grant.amount_max,
                  closes_at: grant.closes_at ?? grant.deadline,
                  categories: grant.categories ?? grant.focus_areas ?? [],
                  url: grant.url,
                  source: null,
                }}
              >
                <div className="border-b border-gray-100 pb-3 outline-none last:border-0 last:pb-0 hover:text-bauhaus-blue focus-visible:ring-2 focus-visible:ring-bauhaus-blue">
                  <div className="line-clamp-1 text-sm font-black">{grant.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <span>{grant.provider || 'Unknown funder'}</span>
                    {grant.fit_score != null ? <span>{grant.fit_score}% fit</span> : null}
                    <span>{grant.closes_at || grant.deadline ? 'Dated' : 'Ongoing'}</span>
                  </div>
                </div>
              </GrantPreviewTrigger>
            )) : (
              <p className="text-sm leading-relaxed text-gray-600">No clean untracked matches are waiting. Use Find more to widen sources, then return here to triage.</p>
            )}
          </div>
        </div>

        <div className="border border-gray-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black">Application readiness</div>
          <div className="mt-3 space-y-2">
            {applicationTasks.map((task) => (
              <a key={task.label} href={task.href} className="block bg-gray-50 p-3 hover:bg-bauhaus-canvas">
                <div className="text-sm font-black text-bauhaus-black">{task.label}</div>
                <div className="mt-1 text-xs leading-relaxed text-gray-600">{task.detail}</div>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-5 py-5">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Workshop alignment</div>
            <h3 className="mt-1 text-xl font-black text-bauhaus-black">Ten areas to make fundable, governable, and investable</h3>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">
              Use this as the conversation map. Each area should end with evidence, a gap, an owner, and a next action.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={workshopWikiHref(slug)}
              className="w-fit border border-bauhaus-black bg-bauhaus-black px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-red"
            >
              Open wiki doc
            </Link>
            <Link
              href="/start"
              className="w-fit border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
            >
              Capture new notes
            </Link>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="grid gap-2 md:grid-cols-2">
            {readinessAreas.map((area, index) => (
              <a
                key={area.label}
                href={workshopWikiHref(slug, area.id)}
                className="border border-gray-200 bg-gray-50 p-3 hover:border-bauhaus-blue hover:bg-link-light/40"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black tabular-nums text-bauhaus-blue">
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-sm font-black text-bauhaus-black">{area.label}</div>
                    <div className="mt-1 text-xs leading-relaxed text-gray-600">{area.signal}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
          <div className="border border-gray-200 bg-white p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Document pack</div>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Nothing new needs to be created. Drafts are useful because they show where support is needed.
            </p>
            <div className="mt-3 space-y-2">
              {documentPack.map((doc) => (
                <Link key={doc.label} href={doc.href} className="flex items-start gap-2 text-xs leading-relaxed text-gray-700 hover:text-bauhaus-blue">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-bauhaus-blue" />
                  <span>{doc.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div id="wiki-support-index" className="border-t border-gray-200 px-5 py-5">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Wiki support index</div>
            <h3 className="mt-1 text-xl font-black text-bauhaus-black">Turn existing ACT knowledge into support routes</h3>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">
              The index pulls from the ACT wiki, Goods source docs, project codes, and repo map so search can start from what the organisation already knows.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className="border border-gray-200 bg-gray-50 px-3 py-2 text-bauhaus-black">
              {wikiSupportIndex.summary.project_count} projects
            </span>
            <span className="border border-gray-200 bg-gray-50 px-3 py-2 text-bauhaus-black">
              {wikiSupportIndex.summary.route_count} routes
            </span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="grid grid-cols-2 gap-2">
            {supportRouteTypes.map((route) => (
              <Link
                key={route.type}
                href={route.type === 'grant' ? '/grants?type=open_opportunity&sort=closing_asc&quality=ready' : `#${route.type === 'foundation' ? 'foundation-funders' : 'pipeline'}`}
                className="bg-gray-50 p-3 hover:bg-bauhaus-canvas"
              >
                <div className="text-lg font-black tabular-nums text-bauhaus-black">{route.count}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-gray-500">{route.type}</div>
              </Link>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {visibleIndexedProjects.map((project) => {
              const linkedProject = flatProjects.find(
                (orgProject) => orgProject.slug === project.slug || project.aliases.includes(orgProject.slug),
              );
              return (
                <Link
                  key={project.slug}
                  href={linkedProject ? `/org/${slug}/${linkedProject.slug}` : '#wiki-support-index'}
                  className="border border-gray-200 bg-gray-50 p-3 hover:border-bauhaus-blue hover:bg-link-light/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-bauhaus-black">{project.name}</span>
                    {project.code ? (
                      <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                        {project.code}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-600">{project.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <span>{project.routes.length} routes</span>
                    <span>{project.source_documents.length} sources</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {visibleSupportActions.length > 0 ? (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Next support scans</div>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                  These are the first actions generated from the wiki routes. Open one, inspect the matches, then move only useful items into pipeline or GHL.
                </p>
              </div>
              <Link
                href="/grants?type=open_opportunity&sort=closing_asc&quality=ready"
                className="w-fit text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red"
              >
                Open finder
              </Link>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {visibleSupportActions.map((action) => (
                <Link
                  key={action.id}
                  href={action.grant_finder_href}
                  className="border border-gray-200 bg-gray-50 p-3 hover:border-bauhaus-blue hover:bg-link-light/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                      {action.route_type}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {action.project_code || action.project_name}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-black text-bauhaus-black">{action.title}</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600">{action.summary}</p>
                  {action.source_discovery_queries[0] ? (
                    <div className="mt-2 line-clamp-1 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                      {action.source_discovery_queries[0]}
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {visibleFrontierRows.length > 0 ? (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Source review queue</div>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                  {wikiSupportFrontierQueue.total} wiki-derived source searches are waiting for manual review. They are disabled frontier rows until a real public source URL is promoted.
                </p>
              </div>
              <Link
                href="/reports/grant-frontier"
                className="w-fit text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red"
              >
                Grant frontier
              </Link>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {visibleFrontierRows.map((row) => (
                <a
                  key={row.id}
                  href={row.target_url}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-gray-200 bg-gray-50 p-3 hover:border-bauhaus-red hover:bg-bauhaus-canvas"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                      {row.route_type}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      priority {row.priority}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-black text-bauhaus-black">{row.project_name}</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600">{row.query}</p>
                  <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Manual review
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {primaryProjects.length > 0 && (
        <div className="border-t border-gray-200 px-5 py-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Choose a support lane</div>
              <p className="mt-1 text-sm font-medium text-gray-600">
                Pick one lane at a time. Goods is the practical enterprise lane; the others hold justice, data, story, place, and regenerative work.
              </p>
            </div>
            <a href="#projects" className="text-[11px] font-black uppercase tracking-wider text-bauhaus-blue hover:text-bauhaus-red">
              All projects
            </a>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {primaryProjects.map((project) => (
              <Link
                key={project.id}
                href={`/org/${slug}/${project.slug}`}
                className="border border-gray-200 bg-gray-50 p-3 hover:border-bauhaus-blue hover:bg-link-light/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-bauhaus-black">{project.name}</div>
                    {project.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600">{project.description}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-lg font-black text-bauhaus-blue">&rarr;</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  {project.pipeline_count > 0 ? <span>{project.pipeline_count} pipeline</span> : null}
                  {project.pipeline_value > 0 ? <span className="text-green-700">{money(project.pipeline_value)}</span> : null}
                  {project.children.length > 0 ? <span>{project.children.length} sub-projects</span> : null}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 px-5 py-3">
        <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wider">
          <a href="#projects" className="text-bauhaus-blue hover:text-bauhaus-red">Projects</a>
          <span className="text-gray-300">/</span>
          <a href="#funding-feed" className="text-bauhaus-blue hover:text-bauhaus-red">Opportunity feed</a>
          <span className="text-gray-300">/</span>
          <a href="#pipeline" className="text-bauhaus-blue hover:text-bauhaus-red">Pipeline</a>
          <span className="text-gray-300">/</span>
          <Link href={`/org/${slug}/contacts`} className="text-bauhaus-blue hover:text-bauhaus-red">Contacts {contactCount}</Link>
          <span className="text-gray-300">/</span>
          <a href="#foundation-funders" className="text-bauhaus-blue hover:text-bauhaus-red">Foundations {foundationCount}</a>
          <span className="text-gray-300">/</span>
          <a href="#wiki-support-index" className="text-bauhaus-blue hover:text-bauhaus-red">Support index</a>
          <span className="text-gray-300">/</span>
          <Link href="/grants?type=open_opportunity&sort=closing_asc&family=Council+%2F+local" className="text-bauhaus-blue hover:text-bauhaus-red">Find local grants</Link>
          <span className="text-gray-300">/</span>
          <Link href="/grants?type=open_opportunity&sort=closing_asc&project=goods" className="text-bauhaus-blue hover:text-bauhaus-red">Goods feed</Link>
        </div>
      </div>
    </section>
  );
}

export default async function OrgDashboard({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const fundingYearFilter = typeof sp.fy === 'string' ? sp.fy : undefined;
  const fastNavigation = shouldUseFastLocalOrg(typeof sp.full === 'string' ? sp.full : undefined);

  if (fastNavigation && isActSlug(slug)) {
    return (
      <FastOrgDashboard
        profile={ACT_FAST_PROFILE}
        slug="act"
        wikiSupportIndex={getWikiSupportIndex()}
      />
    );
  }

  const profile = await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const abn = profile.abn;

  const [
    fundingByProgram,
    fundingByYear,
    fundingYears,
    contracts,
    almaInterventions,
    entity,
    programs,
    pipeline,
    contacts,
    leadership,
    matchedGrants,
    peerOrgs,
    projectSummaries,
    powerIndex,
    revolvingDoor,
    boardMembers,
    donorCrosslinks,
    foundationFunders,
    foundationPortfolio,
  ] = await Promise.all([
    abn ? getOrgFundingByProgram(abn, fundingYearFilter) : null,
    abn ? getOrgFundingByYear(abn) : null,
    abn ? getOrgFundingYears(abn) : [],
    abn ? getOrgContracts(abn) : null,
    abn ? getOrgAlmaInterventions(abn) : null,
    abn ? getOrgEntity(abn) : null,
    getOrgPrograms(profile.id),
    getOrgPipeline(profile.id),
    getOrgContacts(profile.id),
    getOrgLeadership(profile.id),
    getMatchedGrantOpportunities(profile.id, profile.org_type, null),
    abn ? getOrgPeerOrgs(abn) : [],
    getOrgProjectSummaries(profile.id),
    abn ? getOrgPowerIndex(abn) : null,
    abn ? getOrgRevolvingDoor(abn) : null,
    abn ? getOrgBoardMembers(abn) : [],
    abn ? getOrgDonorCrosslinks(abn) : [],
    abn ? getOrgFoundationFunders(abn) : [],
    getOrgFoundationPortfolio(profile.id),
  ]);

  // Secondary fetches that depend on entity data
  const [localEcosystem, relationships, fundingDesert] = await Promise.all([
    entity && abn
      ? getOrgLocalEcosystem(abn, entity.postcode, entity.lga_name)
      : null,
    entity?.id
      ? getOrgRelationshipSummary(entity.id)
      : [],
    entity?.lga_name
      ? getOrgFundingDesert(entity.lga_name)
      : null,
  ]);

  const totalFunding = fundingByProgram?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const totalContracts = contracts?.reduce((s, r) => s + Number(r.value), 0) ?? 0;
  const recentFunding = fundingByYear
    ?.filter(r => r.financial_year >= '2021-22')
    .reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const wikiSupportIndex = getWikiSupportIndex();
  const wikiSupportFrontierQueue = await getWikiSupportFrontierQueue(undefined, 12);
  const foundationSignalCount = Math.max(foundationFunders.length, foundationPortfolio.length);

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red mb-1">
                CivicGraph Organisation Dashboard
              </p>
              <h1 className="text-3xl font-black uppercase tracking-wider">
                {profile.name}
              </h1>
              <p className="mt-2 text-lg text-gray-300">
                {abn && <>{`ABN ${abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}`} &middot; </>}
                {entity?.is_community_controlled && '100% Aboriginal & Torres Strait Islander community-controlled'}
                {!entity?.is_community_controlled && profile.org_type && profile.org_type}
              </p>
              {profile.description && (
                <p className="mt-2 text-sm text-gray-400 max-w-2xl">{profile.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Link
                href={`/org/${slug}/intelligence`}
                className="px-4 py-2 bg-bauhaus-red text-white font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-colors"
              >
                Command Center
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  href={`/org/${slug}/contacts`}
                  className="text-sm text-gray-400 hover:text-white underline"
                >
                  Contacts
                </Link>
                <Link
                  href="/home"
                  className="text-sm text-gray-400 hover:text-white underline"
                >
                  Dashboard &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        <ListPreviewProvider>
          <OrgSupportHub
            slug={slug}
            projects={projectSummaries}
            pipeline={pipeline}
            foundationCount={foundationSignalCount}
            contactCount={contacts.length}
            matchedGrants={matchedGrants}
            wikiSupportIndex={wikiSupportIndex}
            wikiSupportFrontierQueue={wikiSupportFrontierQueue}
          />
        </ListPreviewProvider>

        <KeyStats
          totalFunding={totalFunding}
          recentFunding={recentFunding}
          totalContracts={totalContracts}
          contractCount={contracts?.length ?? 0}
          almaCount={almaInterventions?.length ?? 0}
          profile={profile}
          entity={entity}
        />

        {/* Intelligence sections */}
        <FundingDesertSection fundingDesert={fundingDesert} />

        <PowerScoreSection powerIndex={powerIndex} slug={slug} />

        <RevolvingDoorSection revolvingDoor={revolvingDoor} />

        <RelationshipSummarySection relationships={relationships} slug={slug} />

        <BoardMembersSection boardMembers={boardMembers} />

        <DonorCrosslinksSection donorCrosslinks={donorCrosslinks} />

        <FoundationFundersSection foundationFunders={foundationFunders} />

        {/* Projects */}
        {projectSummaries.length > 0 && (
          <div id="projects" className="scroll-mt-24">
          <Section title="Projects">
            <ProjectCards projects={projectSummaries} orgSlug={slug} />
          </Section>
          </div>
        )}

        <LeadershipSection leadership={leadership} />

        <FundingSection
          fundingByProgram={fundingByProgram}
          totalFunding={totalFunding}
          fundingYears={fundingYears}
          fundingYearFilter={fundingYearFilter}
          slug={slug}
        />

        <FundingTimelineSection fundingByYear={fundingByYear} />

        <ProgramsSection programs={programs} />

        <AlmaSection interventions={almaInterventions} />

        <PipelineSection pipeline={pipeline} orgSlug={slug} orgProfileId={profile.id} />

        <MatchedGrantsSection
          matchedGrants={matchedGrants}
          orgProfileId={profile.id}
          projectOptions={projectOptionsFromSummaries(projectSummaries)}
        />

        <ContactsSection contacts={contacts} />

        <ContractsSection contracts={contracts} />

        <EcosystemSection localEcosystem={localEcosystem} entity={entity} slug={slug} />

        <PeerOrgsSection peerOrgs={peerOrgs} />

        <DashboardFooter profileName={profile.name} />
      </div>
    </main>
  );
}
