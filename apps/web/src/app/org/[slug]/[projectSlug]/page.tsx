import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectWorkspaceCopy, isGoodsProject } from '@/lib/project-workspace';
import {
  ACT_FAST_PROFILE,
  fastProjectFromWiki,
  isActSlug,
  shouldUseFastLocalOrg,
} from '@/lib/services/fast-local-org';
import {
  goodsCapitalRows,
  goodsGovernanceRows,
  goodsImpactRows,
  goodsOperatingFacts,
  goodsOperatingOutputs,
  goodsPeopleRows,
  goodsRiskRows,
  goodsRoadmap,
  goodsSourceDocuments,
  goodsSupportRoutes,
  goodsSystemsRows,
} from '@/lib/services/goods-operating-system';
import { getWikiSupportIndex, getWikiSupportProject, wikiSupportSourceSlug } from '@/lib/services/wiki-support-index';
import { getWikiSupportFrontierQueue } from '@/lib/services/wiki-support-frontier';
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
  type OrgProfile,
  type OrgProject,
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
  projectOptionsFromSummaries,
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

function FastProjectDashboard({
  profile,
  project,
  slug,
  projectSlug,
}: {
  profile: OrgProfile;
  project: OrgProject;
  slug: string;
  projectSlug: string;
}) {
  const goodsProject = isGoodsProject(project);
  const workspaceCopy = getProjectWorkspaceCopy(project);
  const wikiSupportProject = getWikiSupportProject(projectSlug);
  const routes = wikiSupportProject?.routes ?? [];
  const actions = wikiSupportProject?.support_actions.slice(0, 4) ?? [];
  const wikiSourceHrefByLabel = new Map(
    getWikiSupportIndex().source_inventory
      .filter((source) => source.exists)
      .map((source) => [source.label, `/org/${slug}/wiki/sources/${wikiSupportSourceSlug(source)}`]),
  );
  const fastRouteHref = (routeType: string) => {
    if (routeType === 'grant') {
      return `/grants?type=open_opportunity&sort=closing_asc&project=${encodeURIComponent(projectSlug)}&quality=ready`;
    }
    if (routeType === 'procurement') return '#project-procurement-routes';
    if (routeType === 'foundation') return '#project-foundations';
    if (routeType === 'capital') return '#project-capital-routes';
    return '#project-pipeline';
  };

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">
              {profile.name}
            </Link>
            <span>/</span>
            <span className="text-white">{project.name}</span>
          </nav>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-bauhaus-red">Fast project view</p>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-wider">{project.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">
                {workspaceCopy.description}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {goodsProject ? (
                <Link
                  href={`/org/${slug}/wiki/goods-operating-system`}
                  className="border border-bauhaus-red bg-bauhaus-red px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
                >
                  Goods OS wiki
                </Link>
              ) : null}
              <Link
                href={`/org/${slug}/${projectSlug}?full=1`}
                className="border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
              >
                Full data view
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {goodsProject ? (
          <section id="goods-readiness" className="scroll-mt-24 border-4 border-bauhaus-black bg-white p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Goods operating system</p>
                <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Use the packaged strategy first</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                  This fast view avoids blocking on the full evidence dashboard. Open the wiki for the stable strategy,
                  source pack, impact model, routes, risks, governance, people, systems, and capital stack.
                </p>
              </div>
              <Link
                href="/grants?type=open_opportunity&sort=closing_asc&project=goods&quality=ready"
                className="w-fit border border-bauhaus-black bg-bauhaus-black px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-red"
              >
                Goods grant feed
              </Link>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {goodsOperatingFacts.map((fact) => (
                <div key={fact.label} className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-2xl font-black tabular-nums text-bauhaus-black">{fact.value}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{fact.label}</div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">{fact.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {goodsOperatingOutputs.slice(0, 4).map((item) => (
                <Link
                  key={item.label}
                  href={`/org/${slug}/wiki/goods-operating-system#strategy`}
                  className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
                >
                  <div className="text-sm font-black text-bauhaus-black">{item.label}</div>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-600">{item.output}</p>
                </Link>
              ))}
            </div>
            <div className="mt-5 border-t border-gray-200 pt-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Evidence library</p>
                  <h3 className="mt-1 text-xl font-black text-bauhaus-black">Open proof without loading the full dashboard</h3>
                  <p className="mt-2 max-w-3xl text-xs leading-relaxed text-gray-600">
                    Use these when you need source-backed language, proof, budget context, route logic, or a follow-up angle.
                  </p>
                </div>
                <Link
                  href={`/org/${slug}/wiki/goods-operating-system#sources`}
                  className="w-fit border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
                >
                  All source proof
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {goodsSourceDocuments.slice(0, 4).map((doc) => {
                  const href = wikiSourceHrefByLabel.get(doc.source);
                  const content = (
                    <>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 text-sm font-black text-bauhaus-black">{doc.label}</div>
                        <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                          {doc.output}
                        </span>
                      </div>
                      <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-500">{doc.kind}</div>
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-600">{doc.bestFor}</p>
                    </>
                  );

                  return href ? (
                    <Link
                      key={doc.label}
                      href={href}
                      className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={doc.label} className="border border-gray-200 bg-gray-50 p-4">
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        <section id="project-routes" className="scroll-mt-24 border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Project routes</p>
              <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Open the next working lane</h2>
            </div>
            <Link
              href={`/org/${slug}/wiki/workshop-alignment`}
              className="w-fit border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
            >
              Workshop OS
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {routes.length > 0 ? routes.map((route) => (
              <Link
                key={`${route.type}-${route.label}`}
                href={fastRouteHref(route.type)}
                className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
              >
                <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                  {route.type}
                </span>
                <div className="mt-2 text-sm font-black text-bauhaus-black">{route.label}</div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-600">{route.why}</p>
              </Link>
            )) : (
              <Link
                href={`/grants?type=open_opportunity&sort=closing_asc&project=${encodeURIComponent(projectSlug)}&quality=ready`}
                className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
              >
                <div className="text-sm font-black text-bauhaus-black">Project grant feed</div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  Open the matched opportunities without loading the full project evidence dashboard.
                </p>
              </Link>
            )}
          </div>
        </section>

        {goodsProject ? (
          <>
            <section id="project-procurement-routes" className="scroll-mt-24 border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Procurement lane</p>
                  <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Package Goods as a buyer-ready offer</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                    Keep procurement separate from grants: product, buyer need, delivery shape, price evidence,
                    contracting party, and proof should be clear before outreach.
                  </p>
                </div>
                <Link
                  href={`/org/${slug}/wiki/goods-operating-system#routes`}
                  className="w-fit border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
                >
                  Route model
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-black text-bauhaus-black">Buyer routes</div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">
                    {goodsRoadmap.find((row) => row.stage.includes('Procurement'))?.now}
                  </p>
                </div>
                <div className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-black text-bauhaus-black">Offer shape</div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">
                    {goodsSupportRoutes.find((row) => row.lane === 'Procurement')?.use}
                  </p>
                </div>
                <div className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-black text-bauhaus-black">Readiness risk</div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">
                    {goodsRiskRows.find((row) => row.risk === 'Procurement readiness')?.response}
                  </p>
                </div>
              </div>
            </section>

            <section id="project-foundations" className="scroll-mt-24 border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Foundation lane</p>
                  <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Use proof for relationship-led asks</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                    Foundation work should start with fit, relationship path, proof, vehicle, and next touch, not a generic list.
                  </p>
                </div>
                <Link
                  href={`/org/${slug}/contacts`}
                  className="w-fit border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
                >
                  Contact board
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-black text-bauhaus-black">Foundation fit</div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">
                    {goodsSupportRoutes.find((row) => row.lane === 'Foundations')?.use}
                  </p>
                </div>
                {goodsImpactRows.slice(0, 2).map((row) => (
                  <div key={row.signal} className="border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-black text-bauhaus-black">{row.signal}</div>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600">{row.evidence}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="project-capital-routes" className="scroll-mt-24 border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Capital lane</p>
                  <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Named capital routes and proof needs</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                    Each route needs a specific ask, use of funds, proof requirement, and relationship move.
                  </p>
                </div>
                <Link
                  href={`/org/${slug}/wiki/goods-operating-system#capital`}
                  className="w-fit border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
                >
                  Capital stack
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {goodsCapitalRows.map((row) => (
                  <div key={row.source} className="border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-black text-bauhaus-black">{row.source}</div>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600">
                      <span className="font-black text-bauhaus-black">Ask/use:</span> {row.ask}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600">
                      <span className="font-black text-bauhaus-black">Proof:</span> {row.proof}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {actions.length > 0 ? (
          <section id="project-pipeline" className="scroll-mt-24 border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Run next</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {actions.map((action) => (
                <Link
                  key={action.id}
                  href={action.grant_finder_href}
                  className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
                >
                  <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                    {action.route_type}
                  </span>
                  <div className="mt-2 text-sm font-black text-bauhaus-black">{action.title}</div>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-600">{action.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
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
  const fastNavigation = shouldUseFastLocalOrg(typeof sp.full === 'string' ? sp.full : undefined);

  if (fastNavigation && isActSlug(slug)) {
    const wikiSupportProject = getWikiSupportProject(projectSlug);
    return (
      <FastProjectDashboard
        profile={ACT_FAST_PROFILE}
        project={fastProjectFromWiki(projectSlug, wikiSupportProject)}
        slug="act"
        projectSlug={wikiSupportProject?.slug ?? projectSlug}
      />
    );
  }

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
    projectPipeline,
    orgPipeline,
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
    getOrgPipeline(profile.id),
    getOrgFoundationPortfolio(profile.id),
    getOrgContacts(profile.id, project.id),
    getOrgLeadership(profile.id, project.id),
    getMatchedGrantOpportunities(profile.id, profile.org_type, null),
    abn ? getOrgPeerOrgs(abn) : [],
  ]);

  const projectFoundationPortfolio = foundationPortfolio.filter((row) => row.project.slug === projectSlug);
  const projectPipelineKeywords = Array.from(
    new Set(
      [
        project.name,
        project.slug,
        project.code,
        ...(Array.isArray(project.metadata?.funding_tags)
          ? project.metadata.funding_tags.filter((value): value is string => typeof value === 'string')
          : []),
        ...(Array.isArray(project.metadata?.support_keywords)
          ? project.metadata.support_keywords.filter((value): value is string => typeof value === 'string')
          : []),
      ]
        .map((value) => value?.toLowerCase().trim())
        .filter((value): value is string => Boolean(value && value.length >= 3)),
    ),
  );
  const relevantUnassignedPipeline = orgPipeline.filter((item) => {
    if (item.project_id === project.id) return true;
    if (item.project_id) return false;
    const haystack = `${item.name} ${item.funder ?? ''} ${item.grant_name ?? ''} ${item.grant_provider ?? ''} ${item.notes ?? ''}`.toLowerCase();
    return projectPipelineKeywords.some((keyword) => haystack.includes(keyword));
  });
  const pipeline = [
    ...new Map([...projectPipeline, ...relevantUnassignedPipeline].map((item) => [item.id, item])).values(),
  ];

  const localEcosystem = entity && abn
    ? await getOrgLocalEcosystem(abn, entity.postcode, entity.lga_name)
    : null;

  const totalFunding = fundingByProgram?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const totalContracts = contracts?.reduce((s, r) => s + Number(r.value), 0) ?? 0;
  const recentFunding = fundingByYear
    ?.filter(r => r.financial_year >= '2021-22')
    .reduce((s, r) => s + Number(r.total), 0) ?? 0;

  const projectPath = `/org/${slug}/${projectSlug}`;
  const goodsProject = isGoodsProject(project);
  const wikiSupportIndex = getWikiSupportIndex();
  const wikiSupportProject = getWikiSupportProject(projectSlug);
  const wikiSourceHrefByLabel = new Map(
    wikiSupportIndex.source_inventory
      .filter((source) => source.exists)
      .map((source) => [source.label, `/org/${slug}/wiki/sources/${wikiSupportSourceSlug(source)}`]),
  );
  const wikiSupportFrontierQueue = wikiSupportProject
    ? await getWikiSupportFrontierQueue(wikiSupportProject.slug, 8)
    : null;
  const workspaceCopy = getProjectWorkspaceCopy(project);
  const projectProcurementRoutes = Array.isArray(project.metadata?.procurement_routes)
    ? project.metadata.procurement_routes.length
    : 0;
  const wikiProcurementRoutes = wikiSupportProject?.routes.filter((route) => route.type === 'procurement').length ?? 0;
  const procurementPipelineSignals = pipeline.filter((item) => {
    const haystack = `${item.funder_type ?? ''} ${item.funder ?? ''} ${item.funder_entity_name ?? ''} ${item.name} ${item.notes ?? ''}`.toLowerCase();
    return ['commercial', 'corporate', 'partner'].includes(item.funder_type || '') ||
      /\b(procurement|contract|tender|buyer|supplier|corporate)\b/.test(haystack);
  }).length;
  const procurementRouteCount = Math.max(projectProcurementRoutes, wikiProcurementRoutes, procurementPipelineSignals);
  const pipelineFoundationSignals = pipeline.filter((item) => {
    const haystack = `${item.funder_type ?? ''} ${item.funder ?? ''} ${item.funder_entity_name ?? ''} ${item.name} ${item.grant_provider ?? ''} ${item.notes ?? ''}`.toLowerCase();
    return item.funder_type === 'foundation' ||
      /\b(foundation|philanthropy|philanthropic|trust)\b/.test(haystack);
  }).length;
  const foundationCount = Math.max(projectFoundationPortfolio.length, pipelineFoundationSignals, foundationPortfolio.length);
  const wikiCapitalRoutes = wikiSupportProject?.routes.filter((route) =>
    ['capital', 'foundation', 'grant'].includes(route.type),
  ).length ?? 0;
  const capitalRouteCount = Math.max(
    pipeline.filter((item) => {
      const haystack = `${item.funder_type ?? ''} ${item.funder ?? ''} ${item.funder_entity_name ?? ''} ${item.name} ${item.grant_provider ?? ''} ${item.notes ?? ''}`.toLowerCase();
      return ['foundation', 'government'].includes(item.funder_type || '') ||
        Boolean(item.grant_opportunity_id) ||
        /\b(grant|foundation|trust|philanthropy|fellowship|capital|fund)\b/.test(haystack);
    }).length,
    wikiCapitalRoutes,
    foundationCount,
  );
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
    wikiSupportProject ? 'Wiki support index' : null,
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
    ...(wikiSupportProject
      ? [
          {
            key: 'support-index',
            href: '#wiki-support-index',
            label: `Wiki routes ${wikiSupportProject.routes.length}`,
            hot: false,
          },
        ]
      : []),
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
    goodsProject &&
    !(recommendedFocus.external && recommendedFocus.href === 'https://www.goodsoncountry.com/admin/qbe-program');
  const wikiRouteHref = (routeType: string) => {
    if (routeType === 'procurement') return '#project-procurement-routes';
    if (routeType === 'foundation') return '#project-foundations';
    if (routeType === 'capital') return '#project-capital-routes';
    if (routeType === 'systems') return '#project-pipeline';
    return `/grants?type=open_opportunity&sort=closing_asc&project=${encodeURIComponent(projectSlug)}&quality=ready`;
  };

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

        <section className="border-2 border-bauhaus-black bg-white shadow-sm">
          <div className="border-b-2 border-bauhaus-black bg-bauhaus-canvas px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-red">Project support flow</p>
                <h2 className="mt-1 text-xl font-black uppercase tracking-wider text-bauhaus-black">
                  Work the project from decision to next action
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                  This is the supported project experience. Start with the recommended focus, then move through queue,
                  capital or procurement routes, foundations, pipeline, contacts, and reference signals.
                </p>
              </div>
              <Link
                href={`/org/${slug}`}
                className="shrink-0 border-2 border-bauhaus-black bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
              >
                Organisation workspace
              </Link>
            </div>
          </div>
          <div className="grid gap-2 p-5 md:grid-cols-2 xl:grid-cols-6">
            {[
              { label: 'Focus', href: recommendedFocus.href, detail: recommendedFocus.label },
              { label: 'Queue', href: '#project-operating-queue', detail: 'Strongest live moves' },
              { label: goodsProject ? 'Goods routes' : 'Capital', href: goodsProject ? '#project-procurement-routes' : '#project-capital-routes', detail: goodsProject ? `${procurementRouteCount} procurement` : `${capitalRouteCount} capital` },
              { label: 'Foundations', href: '#project-foundations', detail: `${foundationCount} signals` },
              { label: 'Pipeline', href: '#project-pipeline', detail: `${pipeline.length} tracked` },
              ...(wikiSupportProject
                ? [{ label: 'Wiki routes', href: '#wiki-support-index', detail: `${wikiSupportProject.routes.length} source-backed` }]
                : []),
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="border border-gray-200 bg-gray-50 p-3 hover:border-bauhaus-blue hover:bg-link-light/40 transition-colors"
              >
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{item.label}</div>
                <div className="mt-2 text-sm font-black text-bauhaus-black">{item.detail}</div>
              </a>
            ))}
          </div>
        </section>

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
                {workspaceCopy.heading}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-bauhaus-muted">
                {workspaceCopy.description}
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
            {goodsProject ? (
              <>
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
              </>
            ) : (
              <>
                <Link
                  href="/tracker"
                  className="border-2 border-money bg-money-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-money transition-colors hover:border-money hover:bg-money hover:text-white"
                >
                  Open Grant Tracker
                </Link>
                <Link
                  href={`/graph?org=${encodeURIComponent(slug)}&project=${encodeURIComponent(projectSlug)}`}
                  className="border-2 border-bauhaus-blue/25 bg-link-light px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-blue transition-colors hover:border-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                >
                  Open Funding Matches
                </Link>
              </>
            )}
            <a
              href="#project-reference"
              className="border-2 border-bauhaus-black/15 bg-bauhaus-canvas px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-colors hover:border-bauhaus-black hover:bg-bauhaus-black hover:text-white"
            >
              Open Reference Signals
            </a>
          </div>
        </section>

        {goodsProject ? (
          <section id="goods-readiness" className="scroll-mt-24 border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-blue">
                    Goods strategic operating system
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-bauhaus-black">
                    The Goods wiki, strategy, evidence pack, and support routes
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                    This is the working strategic layer for Goods. It packages what already exists into reusable
                    material for grants, foundations, procurement, production, governance, finance, and investment.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/org/${slug}/wiki/goods-operating-system`}
                    className="border border-bauhaus-blue bg-link-light px-4 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
                  >
                    Goods OS wiki
                  </Link>
                  <Link
                    href="/grants?type=open_opportunity&sort=closing_asc&project=goods&quality=ready"
                    className="border border-bauhaus-black bg-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-bauhaus-red"
                  >
                    Goods grant feed
                  </Link>
                  <a
                    href="https://www.goodsoncountry.com/admin/qbe-program"
                    target="_blank"
                    rel="noreferrer"
                    className="border border-gray-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
                  >
                    QBE program
                  </a>
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-b border-gray-200 p-5 md:grid-cols-2 xl:grid-cols-4">
              {goodsOperatingFacts.map((fact) => (
                <div key={fact.label} className="bg-gray-50 p-4">
                  <div className="text-2xl font-black tabular-nums text-bauhaus-black">{fact.value}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{fact.label}</div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600">{fact.detail}</p>
                </div>
              ))}
            </div>

            <div className="border-b border-gray-200 p-5">
              <div className="mb-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                  Reusable strategic outputs
                </div>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">
                  These are written as operating assets, not workshop prompts. Use them directly in applications,
                  foundation briefs, investor conversations, procurement offers, and board notes.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {goodsOperatingOutputs.map((item) => (
                  <article key={item.label} className="border border-gray-200 bg-gray-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{item.label}</div>
                    <p className="mt-2 text-sm leading-relaxed text-bauhaus-black">{item.output}</p>
                    <p className="mt-3 text-xs leading-relaxed text-gray-600">
                      <span className="font-black text-bauhaus-black">Use:</span> {item.use}
                    </p>
                    <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Source: {item.source}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="grid gap-4 border-b border-gray-200 p-5 lg:grid-cols-[1fr_1fr]">
              <div className="border border-gray-200 bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Funder roadmap</div>
                <div className="mt-3 space-y-2">
                  {goodsRoadmap.map((stage) => (
                    <div key={stage.stage} className="border border-gray-200 bg-gray-50 p-3">
                      <div className="text-sm font-black text-bauhaus-black">{stage.stage}</div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-700">{stage.now}</p>
                      <p className="mt-2 text-xs leading-relaxed text-gray-600">
                        <span className="font-black text-bauhaus-black">Operating use:</span> {stage.operatingUse}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-gray-200 bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Support routes</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {goodsSupportRoutes.map((route) => (
                    <a
                      key={route.lane}
                      href={route.nextSurface}
                      className="border border-gray-200 bg-gray-50 p-3 hover:border-bauhaus-blue hover:bg-link-light/40"
                    >
                      <div className="text-sm font-black text-bauhaus-black">{route.lane}</div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">{route.use}</p>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200 p-5">
              <div className="mb-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                  Impact dashboard spine
                </div>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">
                  These rows turn the Goods story into measurable evidence that can be reused across grants,
                  foundations, and procurement reporting.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {goodsImpactRows.map((row) => (
                  <div key={row.signal} className="border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-black text-bauhaus-black">{row.signal}</div>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600">
                      <span className="font-black text-bauhaus-black">Evidence:</span> {row.evidence}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600">
                      <span className="font-black text-bauhaus-black">Measure:</span> {row.metric}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 border-b border-gray-200 p-5 lg:grid-cols-[1fr_1fr]">
              <div className="border border-gray-200 bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                  Risk register
                </div>
                <div className="mt-3 space-y-2">
                  {goodsRiskRows.map((row) => (
                    <div key={row.risk} className="border border-gray-200 bg-gray-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-black text-bauhaus-black">{row.risk}</div>
                        <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                          {row.owner}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-gray-600">{row.response}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-gray-200 bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                  Governance and entity map
                </div>
                <div className="mt-3 space-y-2">
                  {goodsGovernanceRows.map((row) => (
                    <div key={row.area} className="border border-gray-200 bg-gray-50 p-3">
                      <div className="text-sm font-black text-bauhaus-black">{row.area}</div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">{row.position}</p>
                      <p className="mt-2 text-xs leading-relaxed text-gray-600">
                        <span className="font-black text-bauhaus-black">Decision frame:</span> {row.decision}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-b border-gray-200 p-5 lg:grid-cols-[1fr_1fr]">
              <div className="border border-gray-200 bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                  People and relationship map
                </div>
                <div className="mt-3 grid gap-2">
                  {goodsPeopleRows.map((row) => (
                    <div key={row.role} className="border border-gray-200 bg-gray-50 p-3">
                      <div className="text-sm font-black text-bauhaus-black">{row.role}</div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">{row.who}</p>
                      <p className="mt-2 text-xs leading-relaxed text-gray-600">
                        <span className="font-black text-bauhaus-black">Use:</span> {row.use}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-gray-200 bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                  Systems map
                </div>
                <div className="mt-3 grid gap-2">
                  {goodsSystemsRows.map((row) => (
                    <div key={row.system} className="border border-gray-200 bg-gray-50 p-3">
                      <div className="text-sm font-black text-bauhaus-black">{row.system}</div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">
                        <span className="font-black text-bauhaus-black">Owns:</span> {row.owns}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">
                        <span className="font-black text-bauhaus-black">Mirror:</span> {row.mirror}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200 p-5">
              <div className="mb-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                  Capital stack
                </div>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">
                  Each source has a clear ask, use of funds, and proof requirement so capital work can progress without
                  becoming a generic fundraising list.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {goodsCapitalRows.map((row) => (
                  <div key={row.source} className="border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-black text-bauhaus-black">{row.source}</div>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600">
                      <span className="font-black text-bauhaus-black">Ask/use:</span> {row.ask}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600">
                      <span className="font-black text-bauhaus-black">Proof:</span> {row.proof}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5">
              <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                    Evidence library
                  </div>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">
                    These are not generic files. They are source-backed building blocks for grant text, procurement
                    offers, foundation briefs, board notes, capital asks, and CRM follow-up.
                  </p>
                </div>
                <Link
                  href={`/org/${slug}/wiki/goods-operating-system#sources`}
                  className="w-fit border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
                >
                  Goods evidence library
                </Link>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {goodsSourceDocuments.map((doc) => {
                  const href = wikiSourceHrefByLabel.get(doc.source);
                  const content = (
                    <>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 text-sm font-black text-bauhaus-black">{doc.label}</div>
                        <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                          {doc.output}
                        </span>
                      </div>
                      <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        {doc.kind}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-gray-600">{doc.use}</p>
                      <p className="mt-2 text-xs leading-relaxed text-bauhaus-black">
                        <span className="font-black">Best use:</span> {doc.bestFor}
                      </p>
                    </>
                  );
                  return href ? (
                    <Link
                      key={doc.label}
                      href={href}
                      className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={doc.label} className="border border-gray-200 bg-gray-50 p-4">
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {wikiSupportProject ? (
          <section id="wiki-support-index" className="scroll-mt-24 border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-red">Wiki support index</p>
                  <h2 className="mt-1 text-2xl font-black text-bauhaus-black">
                    Source-backed routes for {wikiSupportProject.name}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                    {wikiSupportProject.summary} Use these routes to tune GrantScope searches, add public sources, and move real support work into the project pipeline.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                  <span className="border border-gray-200 bg-gray-50 px-3 py-2 text-bauhaus-black">
                    {wikiSupportProject.routes.length} routes
                  </span>
                  <span className="border border-gray-200 bg-gray-50 px-3 py-2 text-bauhaus-black">
                    {wikiSupportProject.source_documents.length} sources
                  </span>
                </div>
              </div>
            </div>

            {wikiSupportProject.support_actions.length > 0 ? (
              <div className="border-b border-gray-200 p-5">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Run next</div>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">
                      Start with these scans. They convert the source pack into GrantScope searches and public-source discovery terms.
                    </p>
                  </div>
                  <Link
                    href={`/grants?type=open_opportunity&sort=closing_asc&project=${encodeURIComponent(projectSlug)}&quality=ready`}
                    className="w-fit text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red"
                  >
                    Project feed
                  </Link>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {wikiSupportProject.support_actions.slice(0, 4).map((action) => (
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
                          {action.priority}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-black text-bauhaus-black">{action.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600">{action.summary}</p>
                      {action.source_discovery_queries[0] ? (
                        <div className="mt-2 line-clamp-1 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                          {action.source_discovery_queries[0]}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {action.search_terms.slice(0, 3).map((term) => (
                          <span key={term} className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                            {term}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {wikiSupportFrontierQueue && wikiSupportFrontierQueue.rows.length > 0 ? (
              <div className="border-b border-gray-200 p-5">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Source review queue</div>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">
                      {wikiSupportFrontierQueue.total} disabled frontier candidate{wikiSupportFrontierQueue.total === 1 ? '' : 's'} exist for this project. Open a search, find the public source page, then promote the real URL.
                    </p>
                  </div>
                  <Link
                    href="/reports/grant-frontier"
                    className="w-fit text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-red"
                  >
                    Frontier report
                  </Link>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {wikiSupportFrontierQueue.rows.slice(0, 4).map((row) => (
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
                      <div className="mt-2 line-clamp-2 text-sm font-black text-bauhaus-black">{row.query}</div>
                      <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Manual review
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 border-b border-gray-200 p-5 lg:grid-cols-2">
              {wikiSupportProject.routes.map((route) => (
                <a
                  key={`${route.type}-${route.label}`}
                  href={wikiRouteHref(route.type)}
                  className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                      {route.type}
                    </span>
                    <span className="text-sm font-black text-bauhaus-black">{route.label}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{route.why}</p>
                  <div className="mt-3 text-xs leading-relaxed text-gray-700">
                    <span className="font-black text-bauhaus-black">Next:</span> {route.next_action}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {route.search_terms.slice(0, 6).map((term) => (
                      <span key={term} className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                        {term}
                      </span>
                    ))}
                  </div>
                </a>
              ))}
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[1fr_0.9fr]">
              <div className="border border-gray-200 bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black">Evidence to reuse</div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {wikiSupportProject.evidence.length > 0 ? wikiSupportProject.evidence.map((item) => (
                    <div key={item.label} className="bg-gray-50 p-3">
                      <div className="text-sm font-black text-bauhaus-black">{item.label}</div>
                      <div className="mt-1 text-xs font-black uppercase tracking-wider text-bauhaus-blue">{item.value}</div>
                      <p className="mt-2 text-xs leading-relaxed text-gray-600">{item.detail}</p>
                    </div>
                  )) : (
                    <p className="text-sm leading-relaxed text-gray-600">
                      No structured evidence items yet. The route terms still help widen grant, foundation, and procurement discovery.
                    </p>
                  )}
                </div>
              </div>

              <div className="border border-gray-200 bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Readiness gaps</div>
                <div className="mt-3 space-y-2">
                  {wikiSupportProject.readiness_gaps.map((gap) => (
                    <div key={gap} className="flex items-start gap-2 text-xs leading-relaxed text-gray-700">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-bauhaus-red" />
                      <span>{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

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
            project={project}
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
                  {workspaceCopy.referenceDescription}
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

            <MatchedGrantsSection
              matchedGrants={matchedGrants}
              orgProfileId={profile.id}
              projectOptions={projectOptionsFromSummaries(allProjectSummaries)}
              defaultProjectId={project.id}
            />

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
