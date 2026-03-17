import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getOrgProfileBySlug,
  getOrgProjectBySlug,
  getOrgProjectSummaries,
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
    getOrgContacts(profile.id, project.id),
    getOrgLeadership(profile.id, project.id),
    getMatchedGrantOpportunities(profile.id, profile.org_type, null),
    abn ? getOrgPeerOrgs(abn) : [],
  ]);

  const localEcosystem = entity && abn
    ? await getOrgLocalEcosystem(abn, entity.postcode, entity.lga_name)
    : null;

  const totalFunding = fundingByProgram?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const totalContracts = contracts?.reduce((s, r) => s + Number(r.value), 0) ?? 0;
  const recentFunding = fundingByYear
    ?.filter(r => r.financial_year >= '2021-22')
    .reduce((s, r) => s + Number(r.total), 0) ?? 0;

  const projectPath = `/org/${slug}/${projectSlug}`;

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
            <Link
              href={`/org/${slug}`}
              className="text-sm text-gray-400 hover:text-white underline"
            >
              &larr; {profile.name}
            </Link>
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

        <PipelineSection pipeline={pipeline} orgSlug={slug} orgProfileId={profile.id} />

        <MatchedGrantsSection matchedGrants={matchedGrants} orgProfileId={profile.id} />

        <ContactsSection contacts={contacts} />

        <ContractsSection contracts={contracts} />

        <EcosystemSection localEcosystem={localEcosystem} entity={entity} slug={slug} />

        <PeerOrgsSection peerOrgs={peerOrgs} />

        <DashboardFooter profileName={profile.name} />
      </div>
    </main>
  );
}
