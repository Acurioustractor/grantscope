import Link from 'next/link';
import { notFound } from 'next/navigation';
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
  money,
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
  ContactsSection,
  ContractsSection,
  EcosystemSection,
  PeerOrgsSection,
  DashboardFooter,
} from '../_components/org-sections';

export const revalidate = 3600;

export default async function OrgDashboard({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const fundingYearFilter = typeof sp.fy === 'string' ? sp.fy : undefined;

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
          <Section title="Projects">
            <ProjectCards projects={projectSummaries} orgSlug={slug} />
          </Section>
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
