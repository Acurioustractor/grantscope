import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getOrgProfileBySlug,
  getOrgProjectBySlug,
  getOrgProjectSummaries,
  getOrgFoundationPortfolio,
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
  money,
} from '@/lib/services/org-dashboard-service';
import { Section } from '../../_components/ui';
import { ProjectCards } from '../../_components/project-cards';
import { ProjectFoundationsClient } from '../../_components/project-foundations-client';
import {
  ProjectCapitalRoutesSection,
  ProjectOperatingQueueSection,
  ProjectDecisionBriefSection,
  ProjectPressurePointsSection,
  ProjectProcurementRoutesSection,
} from '../../_components/project-decision-surfaces';
import {
  KeyStats,
  LeadershipSection,
  FundingSection,
  FundingTimelineSection,
  ProgramsSection,
  AlmaSection,
  PipelineSection,
  MatchedGrantsSection,
  ContactsSection,
  ContractsSection,
  EcosystemSection,
  PeerOrgsSection,
  DashboardFooter,
} from '../../_components/org-sections';

export const revalidate = 3600;

function latestTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return Math.max(...timestamps);
}

function formatDateLabel(value: number | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function ProjectDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, projectSlug } = await params;
  const sp = await searchParams;
  const fundingYearFilter = typeof sp.fy === 'string' ? sp.fy : undefined;

  const profile = await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const project = await getOrgProjectBySlug(profile.id, projectSlug);
  if (!project) notFound();

  // Use project's ABN if it has its own, otherwise fall back to org ABN
  const abn = project.abn || profile.abn;

  // Get child projects for this project
  const allProjectSummaries = await getOrgProjectSummaries(profile.id);
  const childProjects = allProjectSummaries
    .flatMap(p => [p, ...p.children])
    .filter(p => p.parent_project_id === project.id);

  const [
    fundingByProgram,
    fundingByYear,
    fundingYears,
    contracts,
    almaInterventions,
    entity,
    programs,
    pipeline,
    foundationPortfolio,
    contacts,
    leadership,
    matchedGrants,
    peerOrgs,
  ] = await Promise.all([
    abn ? getOrgFundingByProgram(abn, fundingYearFilter) : null,
    abn ? getOrgFundingByYear(abn) : null,
    abn ? getOrgFundingYears(abn) : [],
    abn ? getOrgContracts(abn) : null,
    abn ? getOrgAlmaInterventions(abn) : null,
    abn ? getOrgEntity(abn) : null,
    getOrgPrograms(profile.id, project.id),
    getOrgPipeline(profile.id, project.id),
    getOrgFoundationPortfolio(profile.id),
    getOrgContacts(profile.id, project.id),
    getOrgLeadership(profile.id, project.id),
    getMatchedGrantOpportunities(profile.id, profile.org_type, null),
    abn ? getOrgPeerOrgs(abn) : [],
  ]);

  const projectFoundationPortfolio = foundationPortfolio.filter((row) => row.project.slug === projectSlug);

  const localEcosystem = entity && abn
    ? await getOrgLocalEcosystem(abn, entity.postcode, entity.lga_name)
    : null;

  const totalFunding = fundingByProgram?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const totalContracts = contracts?.reduce((s, r) => s + Number(r.value), 0) ?? 0;
  const recentFunding = fundingByYear
    ?.filter(r => r.financial_year >= '2021-22')
    .reduce((s, r) => s + Number(r.total), 0) ?? 0;

  const projectPath = `/org/${slug}/${projectSlug}`;
  const procurementRouteCount = Array.isArray(project.metadata?.procurement_routes)
    ? project.metadata.procurement_routes.length
    : 0;
  const foundationCount = projectFoundationPortfolio.length;
  const capitalRouteCount = pipeline.filter((item) => item.funder_type === 'foundation' || item.funder_type === 'government').length;
  const contactCount = contacts.length;
  const referenceSections = [
    childProjects.length > 0 ? 'Sub-projects' : null,
    leadership.length > 0 ? 'Leadership' : null,
    fundingByProgram && fundingByProgram.length > 0 ? 'Funding' : null,
    fundingByYear && fundingByYear.length > 0 ? 'Funding timeline' : null,
    programs.length > 0 ? 'Programs' : null,
    almaInterventions && almaInterventions.length > 0 ? 'ALMA' : null,
    matchedGrants.length > 0 ? 'Matched grants' : null,
    contracts && contracts.length > 0 ? 'Contracts' : null,
    localEcosystem ? 'Ecosystem' : null,
    peerOrgs.length > 0 ? 'Peer orgs' : null,
  ].filter((value): value is string => Boolean(value));
  const referenceSectionCount = referenceSections.length;
  const workspaceFreshness = {
    project: formatDateLabel(latestTimestamp([project.updated_at])),
    pipeline: formatDateLabel(latestTimestamp(pipeline.map((item) => item.updated_at))),
    foundations: formatDateLabel(latestTimestamp(projectFoundationPortfolio.map((row) => row.updated_at))),
  };
  const dueFoundationTouches = projectFoundationPortfolio.filter((row) => {
    if (!row.next_touch_at) return false;
    return new Date(row.next_touch_at).getTime() <= Date.now();
  }).length;
  const dueFoundationLead =
    [...projectFoundationPortfolio]
      .filter((row) => row.next_touch_at && new Date(row.next_touch_at).getTime() <= Date.now())
      .sort(
        (left, right) =>
          new Date(left.next_touch_at || '9999-12-31').getTime() - new Date(right.next_touch_at || '9999-12-31').getTime(),
      )[0] ?? null;
  const activeFoundationLead =
    [...projectFoundationPortfolio]
      .filter((row) => ['approached', 'meeting', 'proposal'].includes(row.engagement_status))
      .sort((left, right) => {
        const touchDelta =
          new Date(left.next_touch_at || '9999-12-31').getTime() - new Date(right.next_touch_at || '9999-12-31').getTime();
        if (touchDelta !== 0) return touchDelta;
        return (right.fit_score ?? -1) - (left.fit_score ?? -1);
      })[0] ?? null;
  const activeFoundationConversations = projectFoundationPortfolio.filter((row) =>
    ['approached', 'meeting', 'proposal'].includes(row.engagement_status),
  ).length;
  const capitalDeadlinesSoon = pipeline.filter((item) => {
    if (!['foundation', 'government'].includes(item.funder_type || '') || !item.deadline) return false;
    const then = new Date(item.deadline).getTime();
    return then >= Date.now() && then <= Date.now() + 30 * 24 * 60 * 60 * 1000;
  }).length;
  const capitalDeadlineLead =
    [...pipeline]
      .filter((item) => {
        if (!['foundation', 'government'].includes(item.funder_type || '') || !item.deadline) return false;
        const then = new Date(item.deadline).getTime();
        return then >= Date.now() && then <= Date.now() + 30 * 24 * 60 * 60 * 1000;
      })
      .sort(
        (left, right) =>
          new Date(left.deadline || '9999-12-31').getTime() - new Date(right.deadline || '9999-12-31').getTime(),
      )[0] ?? null;
  const procurementDeadlinesSoon = pipeline.filter((item) => {
    if (!['commercial', 'corporate', 'government', 'partner'].includes(item.funder_type || '') || !item.deadline) return false;
    const then = new Date(item.deadline).getTime();
    return then >= Date.now() && then <= Date.now() + 30 * 24 * 60 * 60 * 1000;
  }).length;
  const procurementDeadlineLead =
    [...pipeline]
      .filter((item) => {
        if (!['commercial', 'corporate', 'government', 'partner'].includes(item.funder_type || '') || !item.deadline) return false;
        const then = new Date(item.deadline).getTime();
        return then >= Date.now() && then <= Date.now() + 30 * 24 * 60 * 60 * 1000;
      })
      .sort(
        (left, right) =>
          new Date(left.deadline || '9999-12-31').getTime() - new Date(right.deadline || '9999-12-31').getTime(),
      )[0] ?? null;
  const readinessGapCount = Array.isArray(project.metadata?.readiness_gaps)
    ? project.metadata.readiness_gaps.length
    : 0;
  const recommendedFocus =
    dueFoundationTouches > 0
      ? {
          summary: dueFoundationLead
            ? `Foundation follow-up first: ${dueFoundationLead.foundation.name} is due now.`
            : `Foundation follow-up first: ${dueFoundationTouches} touch${dueFoundationTouches === 1 ? '' : 'es'} is due now.`,
          href: dueFoundationLead ? `/foundations/${dueFoundationLead.foundation.id}` : '#project-foundations',
          label: dueFoundationLead ? 'Open foundation' : 'Open foundation board',
          lane: 'foundations',
          external: false,
        }
      : capitalDeadlinesSoon > 0
        ? {
            summary: capitalDeadlineLead
              ? `Capital timing first: ${capitalDeadlineLead.name} has a near-term deadline.`
              : `Capital timing first: ${capitalDeadlinesSoon} route${capitalDeadlinesSoon === 1 ? '' : 's'} has a near-term deadline.`,
            href: capitalDeadlineLead?.grant_opportunity_id
              ? `/grants/${capitalDeadlineLead.grant_opportunity_id}`
              : '#project-capital-routes',
            label: capitalDeadlineLead?.grant_opportunity_id ? 'Open grant' : 'Open capital lane',
            lane: 'capital',
            external: false,
          }
        : procurementDeadlinesSoon > 0
          ? {
              summary: procurementDeadlineLead
                ? `Buyer timing first: ${procurementDeadlineLead.name} is time-sensitive.`
                : `Buyer timing first: ${procurementDeadlinesSoon} procurement path${procurementDeadlinesSoon === 1 ? '' : 's'} is time-sensitive.`,
              href: procurementDeadlineLead?.grant_opportunity_id
                ? `/grants/${procurementDeadlineLead.grant_opportunity_id}`
                : '#project-procurement-routes',
              label: procurementDeadlineLead?.grant_opportunity_id ? 'Open grant' : 'Open procurement lane',
              lane: 'procurement',
              external: false,
            }
          : readinessGapCount > 0
            ? {
                summary: `Readiness first: ${readinessGapCount} strategic blocker${readinessGapCount === 1 ? '' : 's'} is still open in the brief.`,
                href: '#project-decision-brief',
                label: 'Open decision brief',
                lane: 'decision-brief',
                external: false,
              }
            : activeFoundationConversations > 0
              ? {
                  summary: activeFoundationLead
                    ? `Relationship momentum first: ${activeFoundationLead.foundation.name} is already active.`
                    : `Relationship momentum first: ${activeFoundationConversations} foundation conversation${activeFoundationConversations === 1 ? '' : 's'} is already active.`,
                  href: activeFoundationLead
                    ? `/foundations/${activeFoundationLead.foundation.id}`
                    : '#project-foundations',
                  label: activeFoundationLead ? 'Open foundation' : 'Open foundation board',
                  lane: 'foundations',
                  external: false,
                }
              : {
                  summary: 'Use the queue first, then move into the strongest active capital or procurement lane.',
                  href: '#project-operating-queue',
                  label: 'Open queue',
                  lane: 'queue',
                  external: false,
                };
  const quickLinks = [
    {
      key: 'queue',
      href: '#project-operating-queue',
      label: 'Queue',
      hot: dueFoundationTouches > 0 || capitalDeadlinesSoon > 0 || procurementDeadlinesSoon > 0,
    },
    {
      key: 'capital',
      href: '#project-capital-routes',
      label: `Capital ${capitalRouteCount}`,
      hot: capitalDeadlinesSoon > 0,
    },
    {
      key: 'decision-brief',
      href: '#project-decision-brief',
      label: 'Decision Brief',
      hot: false,
    },
    {
      key: 'procurement',
      href: '#project-procurement-routes',
      label: `Procurement ${procurementRouteCount}`,
      hot: procurementDeadlinesSoon > 0,
    },
    {
      key: 'foundations',
      href: '#project-foundations',
      label: `Foundations ${foundationCount}`,
      hot: dueFoundationTouches > 0 || activeFoundationConversations > 0,
    },
    {
      key: 'pipeline',
      href: '#project-pipeline',
      label: `Pipeline ${pipeline.length}`,
      hot: capitalDeadlinesSoon > 0 || procurementDeadlinesSoon > 0,
    },
    {
      key: 'contacts',
      href: '#project-contacts',
      label: `Contacts ${contactCount}`,
      hot: false,
    },
    {
      key: 'reference',
      href: '#project-reference',
      label: `Reference ${referenceSectionCount}`,
      hot: false,
    },
  ];
  const stickyQuickLinks = quickLinks.filter((link) => {
    if (['queue', 'capital', 'procurement', 'foundations', 'pipeline'].includes(link.key)) {
      return true;
    }

    return link.key === recommendedFocus.lane;
  });
  const recommendedActionDuplicatesLane = stickyQuickLinks.some((link) => link.href === recommendedFocus.href);
  const showStickyQbeButton =
    !(recommendedFocus.external && recommendedFocus.href === 'https://www.goodsoncountry.com/admin/qbe-program');

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-start justify-between">
            <div>
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                <Link href={`/org/${slug}`} className="hover:text-white transition-colors">
                  {profile.name}
                </Link>
                <span>&rsaquo;</span>
                <span className="text-white font-bold">{project.name}</span>
              </nav>
              <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red mb-1">
                {project.category ? `${project.category} — ` : ''}Project Dashboard
              </p>
              <h1 className="text-3xl font-black uppercase tracking-wider">
                {project.name}
              </h1>
              {project.description && (
                <p className="mt-2 text-sm text-gray-400 max-w-2xl">{project.description}</p>
              )}
              {abn && (
                <p className="mt-2 text-lg text-gray-300">
                  {`ABN ${abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}`}
                  {project.abn && project.abn !== profile.abn && ' (project entity)'}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Link
                href={`/graph?org=${encodeURIComponent(slug)}&project=${encodeURIComponent(projectSlug)}`}
                className="px-4 py-2 bg-bauhaus-blue text-white font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-colors"
              >
                Funding Matches
              </Link>
              <Link
                href={`/org/${slug}`}
                className="text-sm text-gray-400 hover:text-white underline"
              >
                &larr; {profile.name}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        <KeyStats
          totalFunding={totalFunding}
          recentFunding={recentFunding}
          totalContracts={totalContracts}
          contractCount={contracts?.length ?? 0}
          almaCount={almaInterventions?.length ?? 0}
          profile={profile}
          entity={entity}
        />

        <section className="border-4 border-bauhaus-black bg-white p-3 md:p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-red">
            Project Workspace
          </div>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                {workspaceFreshness.project ? (
                  <span className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black">
                    Brief {workspaceFreshness.project}
                  </span>
                ) : null}
                {workspaceFreshness.pipeline ? (
                  <span className="border-2 border-bauhaus-blue/25 bg-link-light px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-blue">
                    Pipeline {workspaceFreshness.pipeline}
                  </span>
                ) : null}
                {workspaceFreshness.foundations ? (
                  <span className="border-2 border-money/30 bg-money-light px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-money">
                    Foundations {workspaceFreshness.foundations}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-2 text-lg font-black uppercase tracking-tight text-bauhaus-black">
                Goods working lanes
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                Use this as the compiled brief, then move into QBE Program, Goods Workspace, or the relevant board when you need to act.
              </p>
            </div>
            <div className="w-full max-w-xl border-2 border-bauhaus-blue/25 bg-link-light px-3 py-3 lg:w-[30rem]">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue">
                Recommended focus
              </div>
              <p className="mt-1 text-sm font-medium leading-relaxed text-bauhaus-black">
                {recommendedFocus.summary}
              </p>
              {recommendedFocus.external ? (
                <a
                  href={recommendedFocus.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex border-2 border-bauhaus-blue/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                >
                  {recommendedFocus.label}
                </a>
              ) : (
                <a
                  href={recommendedFocus.href}
                  className="mt-3 inline-flex border-2 border-bauhaus-blue/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                >
                  {recommendedFocus.label}
                </a>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://www.goodsoncountry.com/admin/qbe-program"
              target="_blank"
              rel="noreferrer"
              className="border-2 border-money bg-money-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-money transition-colors hover:border-money hover:bg-money hover:text-white"
            >
              Open QBE Program
            </a>
            <Link
              href="/social-enterprises"
              className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
            >
              Open Goods Workspace
            </Link>
            <a
              href="#project-reference"
              className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
            >
              Open Reference Signals
            </a>
          </div>
        </section>

        <div className="sticky top-0 z-20 border-4 border-bauhaus-black bg-white/95 p-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
              Jump to
            </span>
            {stickyQuickLinks.map((link) => (
              <a
                key={`sticky-${link.href}`}
                href={link.href}
                className={`border-2 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors ${
                  recommendedFocus.lane === link.key
                    ? 'border-bauhaus-blue/25 bg-link-light text-bauhaus-blue hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white'
                    : link.hot
                    ? 'border-bauhaus-red/25 bg-bauhaus-red/5 text-bauhaus-red hover:border-bauhaus-red hover:bg-bauhaus-red hover:text-white'
                    : 'border-bauhaus-black/15 bg-bauhaus-canvas text-bauhaus-black hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white'
                }`}
              >
                {link.label}
              </a>
            ))}
            {!recommendedActionDuplicatesLane ? (
              recommendedFocus.external ? (
                <a
                  href={recommendedFocus.href}
                  target="_blank"
                  rel="noreferrer"
                  className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                >
                  {recommendedFocus.label}
                </a>
              ) : (
                <a
                  href={recommendedFocus.href}
                  className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                >
                  {recommendedFocus.label}
                </a>
              )
            ) : null}
            {showStickyQbeButton ? (
              <a
                href="https://www.goodsoncountry.com/admin/qbe-program"
                target="_blank"
                rel="noreferrer"
                className="border-2 border-money bg-money-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-money transition-colors hover:border-money hover:bg-money hover:text-white"
              >
                QBE Program
              </a>
            ) : null}
          </div>
        </div>

        <ProjectPressurePointsSection
          project={project}
          pipeline={pipeline}
          foundationPortfolio={projectFoundationPortfolio}
        />

        <div id="project-operating-queue" className="scroll-mt-24">
          <ProjectOperatingQueueSection
            project={project}
            pipeline={pipeline}
            foundationPortfolio={projectFoundationPortfolio}
          />
        </div>

        <div id="project-capital-routes" className="scroll-mt-24">
          <ProjectCapitalRoutesSection
            foundationPortfolio={projectFoundationPortfolio}
            pipeline={pipeline}
          />
        </div>

        <div id="project-decision-brief" className="scroll-mt-24">
          <ProjectDecisionBriefSection project={project} />
        </div>

        <div id="project-procurement-routes" className="scroll-mt-24">
          <ProjectProcurementRoutesSection project={project} pipeline={pipeline} />
        </div>

        <div id="project-pipeline" className="scroll-mt-24">
          <PipelineSection pipeline={pipeline} orgSlug={slug} orgProfileId={profile.id} />
        </div>

        <div id="project-foundations" className="scroll-mt-24">
          <ProjectFoundationsClient
            orgProfileId={profile.id}
            projectId={project.id}
            projectName={project.name}
          />
        </div>

        <div id="project-contacts" className="scroll-mt-24">
          <ContactsSection contacts={contacts} />
        </div>

        <details id="project-reference" className="border-4 border-bauhaus-black bg-white scroll-mt-24" open={false}>
          <summary className="cursor-pointer list-none px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-bauhaus-red">
                  Reference Signals
                </div>
                <h2 className="mt-1 text-xl font-black uppercase tracking-tight text-bauhaus-black">
                  Background context and linked evidence
                </h2>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                  Keep the Goods operating lanes above as the main working surface. Open this when you need funding history, programs, contracts, ecosystem context, or discovery-side reference material.
                </p>
                {referenceSections.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {referenceSections.slice(0, 5).map((label) => (
                      <span
                        key={label}
                        className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black"
                      >
                        {label}
                      </span>
                    ))}
                    {referenceSections.length > 5 ? (
                      <span className="border-2 border-bauhaus-black/15 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-muted">
                        +{referenceSections.length - 5} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black">
                {referenceSectionCount} sections
              </div>
            </div>
          </summary>
          <div className="border-t-4 border-bauhaus-black px-4 py-6 space-y-8">
            {/* Child projects */}
            {childProjects.length > 0 && (
              <Section title="Sub-Projects">
                <ProjectCards projects={childProjects} orgSlug={slug} parentSlug={projectSlug} />
              </Section>
            )}

            <LeadershipSection leadership={leadership} />

            <FundingSection
              fundingByProgram={fundingByProgram}
              totalFunding={totalFunding}
              fundingYears={fundingYears}
              fundingYearFilter={fundingYearFilter}
              slug={`${slug}/${projectSlug}`}
            />

            <FundingTimelineSection fundingByYear={fundingByYear} />

            <ProgramsSection programs={programs} />

            <AlmaSection interventions={almaInterventions} />

            <MatchedGrantsSection matchedGrants={matchedGrants} orgProfileId={profile.id} />

            <ContractsSection contracts={contracts} />

            <EcosystemSection localEcosystem={localEcosystem} entity={entity} slug={slug} />

            <PeerOrgsSection peerOrgs={peerOrgs} />
          </div>
        </details>

        <DashboardFooter profileName={profile.name} />
      </div>
    </main>
  );
}
