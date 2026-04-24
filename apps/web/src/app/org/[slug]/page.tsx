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
  getOrgFoundationPortfolio,
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
  PhilanthropyPortfolioSection,
  ActionFocusSection,
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

function DashboardBand({
  title,
  kicker,
  description,
  itemCount,
  quickLinks,
  actionLinks,
  stickyQuickLinks = false,
  defaultOpen = false,
  children,
}: {
  title: string;
  kicker: string;
  description: string;
  itemCount: number;
  quickLinks?: Array<{ href: string; label: string }>;
  actionLinks?: Array<{ href: string; label: string; tone?: 'primary' | 'secondary' }>;
  stickyQuickLinks?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const compactStickyMode = stickyQuickLinks;
  return (
    <details className="group border-2 border-bauhaus-black bg-white" open={defaultOpen}>
      <summary className={`list-none cursor-pointer px-5 ${compactStickyMode ? 'py-3' : 'py-4'}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-red">
              {kicker}
            </div>
            <h2 className={`mt-2 font-black uppercase tracking-tight text-bauhaus-black ${compactStickyMode ? 'text-xl' : 'text-2xl'}`}>
              {title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-gray-600">
              {description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="border border-bauhaus-black/15 bg-gray-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
                {itemCount} section{itemCount === 1 ? '' : 's'}
              </span>
              {!compactStickyMode && (
                <>
                  <span className="border border-bauhaus-black/15 bg-gray-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 group-open:hidden">
                    Collapsed
                  </span>
                  <span className="hidden border border-bauhaus-black/15 bg-bauhaus-black px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white group-open:inline-block">
                    Open
                  </span>
                </>
              )}
            </div>
            {quickLinks && quickLinks.length > 0 && !stickyQuickLinks && (
              <div className="mt-3 flex flex-wrap gap-2">
                {quickLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="border border-bauhaus-black/15 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
            {actionLinks && actionLinks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {actionLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className={
                      compactStickyMode
                        ? link.tone === 'primary'
                          ? 'border border-bauhaus-black bg-bauhaus-black px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-white hover:text-bauhaus-black transition-colors'
                          : 'border border-bauhaus-black/15 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors'
                        : link.tone === 'primary'
                          ? 'border-2 border-bauhaus-black bg-bauhaus-black px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-white hover:text-bauhaus-black transition-colors'
                          : 'border border-bauhaus-black/15 bg-gray-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors'
                    }
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          {!compactStickyMode && (
            <span className="mt-1 shrink-0 border-2 border-bauhaus-black px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-black transition-transform group-open:rotate-0">
              <span className="group-open:hidden">Expand</span>
              <span className="hidden group-open:inline">Open</span>
            </span>
          )}
        </div>
      </summary>
      <div className={`border-t-2 border-bauhaus-black px-0 ${compactStickyMode ? 'py-4' : 'py-6'}`}>
        {quickLinks && quickLinks.length > 0 && stickyQuickLinks && (
          <div className="sticky top-3 z-20 mb-4 border-y-2 border-bauhaus-black bg-gray-50 px-5 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                  Jump to
                </span>
                {quickLinks.map((link) => (
                  <a
                    key={`${link.href}-sticky`}
                    href={link.href}
                    className="border border-bauhaus-black/15 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="space-y-8 px-5 md:px-6">{children}</div>
      </div>
    </details>
  );
}

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
  const curatedSectionCount = [
    projectSummaries.length > 0,
    foundationPortfolio.length > 0,
    leadership.length > 0,
    programs.length > 0,
    pipeline.length > 0,
    contacts.length > 0,
  ].filter(Boolean).length;
  const linkedExternalSectionCount = [
    Boolean(fundingDesert),
    Boolean(powerIndex),
    Boolean(revolvingDoor),
    relationships.length > 0,
    boardMembers.length > 0,
    donorCrosslinks.length > 0,
    foundationFunders.length > 0,
    Boolean(fundingByProgram && fundingByProgram.length > 0),
    Boolean(fundingByYear && fundingByYear.length > 0),
    Boolean(almaInterventions && almaInterventions.length > 0),
    Boolean(contracts && contracts.length > 0),
    Boolean(localEcosystem),
    peerOrgs.length > 0,
  ].filter(Boolean).length;
  const heuristicSectionCount = matchedGrants && matchedGrants.length > 0 ? 1 : 0;
  const fundingWorkspaceHref = `/funding-workspace?org=${encodeURIComponent(slug)}`;
  const curatedQuickLinks = [
    projectSummaries.length > 0 ? { href: '#curated-projects', label: 'Projects' } : null,
    foundationPortfolio.length > 0 ? { href: '#curated-philanthropy', label: 'Philanthropy' } : null,
    leadership.length > 0 ? { href: '#curated-leadership', label: 'Leadership' } : null,
    programs.length > 0 ? { href: '#curated-programs', label: 'Programs' } : null,
    pipeline.length > 0 ? { href: '#curated-pipeline', label: 'Pipeline' } : null,
    contacts.length > 0 ? { href: '#curated-network', label: 'Network' } : null,
  ].filter((item): item is { href: string; label: string } => Boolean(item));
  const curatedActionLinks = [
    { href: '/profile', label: 'Edit Profile' as const, tone: 'secondary' as const },
    { href: `/org/${slug}/contacts`, label: 'Open Contacts' as const, tone: 'secondary' as const },
    { href: `/org/${slug}/intelligence`, label: 'Command Center' as const, tone: 'secondary' as const },
    { href: fundingWorkspaceHref, label: 'Funding Matches' as const, tone: 'primary' as const },
  ];

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
                href={fundingWorkspaceHref}
                className="px-4 py-2 bg-bauhaus-blue text-white font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-colors"
              >
                Funding Matches
              </Link>
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

        <ActionFocusSection
          slug={slug}
          fundingWorkspaceHref={fundingWorkspaceHref}
          portfolio={foundationPortfolio}
          pipeline={pipeline}
        />

        <DashboardBand
          kicker="Curated Workspace"
          title="How This Organisation Actually Works"
          description="Manually maintained operating context, pipeline, philanthropy strategy, and relationship surfaces. Use this band first when deciding what ACT should do next."
          itemCount={curatedSectionCount}
          quickLinks={curatedQuickLinks}
          actionLinks={curatedActionLinks}
          stickyQuickLinks
          defaultOpen
        >
          {projectSummaries.length > 0 && (
            <div id="curated-projects">
              <Section title="Projects">
                <ProjectCards projects={projectSummaries} orgSlug={slug} />
              </Section>
            </div>
          )}

          {foundationPortfolio.length > 0 && (
            <div id="curated-philanthropy">
              <PhilanthropyPortfolioSection portfolio={foundationPortfolio} slug={slug} />
            </div>
          )}

          {leadership.length > 0 && (
            <div id="curated-leadership">
              <LeadershipSection leadership={leadership} />
            </div>
          )}

          {programs.length > 0 && (
            <div id="curated-programs">
              <ProgramsSection programs={programs} />
            </div>
          )}

          {pipeline.length > 0 && (
            <div id="curated-pipeline">
              <PipelineSection pipeline={pipeline} orgSlug={slug} orgProfileId={profile.id} />
            </div>
          )}

          {contacts.length > 0 && (
            <div id="curated-network">
              <ContactsSection contacts={contacts} />
            </div>
          )}
        </DashboardBand>

        <DashboardBand
          kicker="Linked External Signals"
          title="What CivicGraph Can Prove From External Data"
          description="ABN-linked registry, funding, governance, relationship, and ecosystem signals. These sections are valuable, but they reflect external linkages rather than the full curated ACT operating picture."
          itemCount={linkedExternalSectionCount}
        >
          <FundingDesertSection fundingDesert={fundingDesert} />

          <PowerScoreSection powerIndex={powerIndex} slug={slug} />

          <RevolvingDoorSection revolvingDoor={revolvingDoor} />

          <RelationshipSummarySection relationships={relationships} slug={slug} />

          <BoardMembersSection boardMembers={boardMembers} />

          <DonorCrosslinksSection donorCrosslinks={donorCrosslinks} />

          <FoundationFundersSection foundationFunders={foundationFunders} />

          <FundingSection
            fundingByProgram={fundingByProgram}
            totalFunding={totalFunding}
            fundingYears={fundingYears}
            fundingYearFilter={fundingYearFilter}
            slug={slug}
          />

          <FundingTimelineSection fundingByYear={fundingByYear} />

          <AlmaSection interventions={almaInterventions} />

          <ContractsSection contracts={contracts} />

          <EcosystemSection localEcosystem={localEcosystem} entity={entity} slug={slug} />

          <PeerOrgsSection peerOrgs={peerOrgs} />
        </DashboardBand>

        <DashboardBand
          kicker="Heuristic Suggestions"
          title="Broad Opportunity Triage"
          description="Machine-ranked suggestions that may be useful to scan, but should be treated as a starting list rather than a portfolio decision surface."
          itemCount={heuristicSectionCount}
        >
          <MatchedGrantsSection matchedGrants={matchedGrants} orgProfileId={profile.id} />
        </DashboardBand>

        <DashboardFooter profileName={profile.name} />
      </div>
    </main>
  );
}
