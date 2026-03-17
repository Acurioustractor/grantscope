import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getOrgProfileBySlug,
  getOrgProjectBySlug,
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
} from '../../../_components/org-sections';

export const revalidate = 3600;

export default async function SubProjectDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; projectSlug: string; subSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, projectSlug, subSlug } = await params;
  const sp = await searchParams;
  const fundingYearFilter = typeof sp.fy === 'string' ? sp.fy : undefined;

  const profile = await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const parentProject = await getOrgProjectBySlug(profile.id, projectSlug);
  if (!parentProject) notFound();

  const subProject = await getOrgProjectBySlug(profile.id, subSlug);
  if (!subProject || subProject.parent_project_id !== parentProject.id) notFound();

  const abn = subProject.abn || parentProject.abn || profile.abn;

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
    getOrgPrograms(profile.id, subProject.id),
    getOrgPipeline(profile.id, subProject.id),
    getOrgContacts(profile.id, subProject.id),
    getOrgLeadership(profile.id, subProject.id),
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
                <Link href={`/org/${slug}/${projectSlug}`} className="hover:text-white transition-colors">
                  {parentProject.name}
                </Link>
                <span>&rsaquo;</span>
                <span className="text-white font-bold">{subProject.name}</span>
              </nav>
              <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red mb-1">
                {subProject.category ? `${subProject.category} — ` : ''}Sub-Project Dashboard
              </p>
              <h1 className="text-3xl font-black uppercase tracking-wider">
                {subProject.name}
              </h1>
              {subProject.description && (
                <p className="mt-2 text-sm text-gray-400 max-w-2xl">{subProject.description}</p>
              )}
              {abn && (
                <p className="mt-2 text-lg text-gray-300">
                  {`ABN ${abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}`}
                </p>
              )}
            </div>
            <Link
              href={`/org/${slug}/${projectSlug}`}
              className="text-sm text-gray-400 hover:text-white underline"
            >
              &larr; {parentProject.name}
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

        <LeadershipSection leadership={leadership} />

        <FundingSection
          fundingByProgram={fundingByProgram}
          totalFunding={totalFunding}
          fundingYears={fundingYears}
          fundingYearFilter={fundingYearFilter}
          slug={`${slug}/${projectSlug}/${subSlug}`}
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
