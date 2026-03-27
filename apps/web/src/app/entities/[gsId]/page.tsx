import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { safeOptionalCount, safeOptionalData } from '@/lib/optional-data';
import { notFound } from 'next/navigation';
import { getEntityProcurementMemberships } from '@/app/api/tender-intelligence/_lib/procurement-workspace';
import { getProofPack } from '@/lib/governed-proof/presentation';
import type { Metadata } from 'next';

import { EntityHeader } from './_components/entity-header';
import { TabShell } from './_components/tab-shell';
import { OverviewTab } from './_components/overview-tab';
import { MoneyTab } from './_components/money-tab';
import { NetworkTab } from './_components/network-tab';
import { EvidenceTab } from './_components/evidence-tab';
import { getShortlistIdFromPath, hasDisabilitySignal, districtLabel, validNdisDistrict } from './_lib/formatters';
import { formatMoney } from './_lib/formatters';
import type {
  Entity, MvEntityStats, AcncYear,
  FoundationEnrichment, FoundationProgram, CharityEnrichment,
  SocialEnterpriseEnrichment, NdisSupplyRow, NdisConcentrationRow,
  AlmaIntervention, PlaceGeo, SeifaData, GovernedProofBundle,
  EntityEnrichment, WorkspaceContext, PersonRole,
} from './_lib/types';

export const revalidate = 300; // ISR: 5 min

export async function generateMetadata({ params }: { params: Promise<{ gsId: string }> }): Promise<Metadata> {
  const { gsId } = await params;
  const supabase = getServiceSupabase();
  const { data: entity } = await supabase.from('gs_entities').select('canonical_name, entity_type').eq('gs_id', gsId).single();
  if (!entity) return { title: 'Entity Not Found | CivicGraph' };

  const { data: stats } = await supabase.from('mv_gs_entity_stats').select('total_relationships, total_outbound_amount, total_inbound_amount').eq('gs_id', gsId).single();

  const totalAmount = (stats?.total_outbound_amount ?? 0) + (stats?.total_inbound_amount ?? 0);
  const description = `${entity.entity_type} | ${(stats?.total_relationships ?? 0).toLocaleString()} relationships | ${formatMoney(totalAmount)}`;

  return {
    title: `${entity.canonical_name} | CivicGraph`,
    description,
    openGraph: {
      title: `${entity.canonical_name} | CivicGraph`,
      description,
      type: 'profile',
    },
  };
}

export default async function EntityDossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ gsId: string }>;
  searchParams: Promise<{ from?: string | string[]; tab?: string }>;
}) {
  const { gsId } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = getServiceSupabase();

  // Return path handling
  const rawReturnPath = Array.isArray(resolvedSearchParams.from)
    ? resolvedSearchParams.from[0]
    : resolvedSearchParams.from;
  const returnHref = rawReturnPath && rawReturnPath.startsWith('/') ? rawReturnPath : '/entities';
  const returnLabel = returnHref.startsWith('/tender-intelligence')
    ? 'Procurement Workspace'
    : returnHref.startsWith('/places/')
      ? 'Place'
      : 'Entity Graph';
  const preferredShortlistId = getShortlistIdFromPath(returnHref);

  // Fetch entity
  const { data: entity } = await supabase
    .from('gs_entities')
    .select('*')
    .eq('gs_id', gsId)
    .single();

  if (!entity) notFound();
  const e = entity as Entity;

  // Fetch MV stats + enrichment data in parallel
  const [
    { data: mvStatsData },
    { data: acncData },
    { data: placeGeoData },
    { data: seifaData },
    { data: foundationData },
    { data: charityData },
    socialEnterpriseResult,
    { data: governedProofData },
    { data: grantData },
  ] = await Promise.all([
    supabase.from('mv_gs_entity_stats').select('*').eq('id', e.id).single(),
    e.abn
      ? supabase
          .from('acnc_ais')
          .select('ais_year, total_revenue, total_expenses, total_assets, net_surplus_deficit, donations_and_bequests, grants_donations_au, grants_donations_intl, employee_expenses, staff_fte, staff_volunteers, charity_size, revenue_from_government')
          .eq('abn', e.abn)
          .order('ais_year', { ascending: false })
      : Promise.resolve({ data: [] }),
    e.postcode
      ? supabase.from('postcode_geo').select('postcode, locality, state, remoteness_2021, lga_name, sa2_code, sa2_name').eq('postcode', e.postcode).limit(1)
      : Promise.resolve({ data: [] }),
    e.postcode
      ? supabase.from('seifa_2021').select('decile_national, score').eq('postcode', e.postcode).eq('index_type', 'IRSD').limit(1)
      : Promise.resolve({ data: [] }),
    e.abn
      ? supabase.from('foundations').select('id, name, description, thematic_focus, geographic_focus, target_recipients, giving_philosophy, application_tips, notable_grants, total_giving_annual, wealth_source, parent_company, board_members, endowment_size, giving_ratio').eq('acnc_abn', e.abn).limit(1)
      : Promise.resolve({ data: [] }),
    e.abn
      ? supabase.from('acnc_charities').select('abn, name, charity_size, pbi, hpc, purposes, beneficiaries, operating_states').eq('abn', e.abn).limit(1)
      : Promise.resolve({ data: [] }),
    (async () => {
      if (e.abn) {
        const { data } = await supabase.from('social_enterprises').select('id, name, org_type, certifications, sector, source_primary, target_beneficiaries, logo_url, business_model, website').eq('abn', e.abn).limit(1);
        if (data && data.length > 0) return { data };
      }
      return supabase.from('social_enterprises').select('id, name, org_type, certifications, sector, source_primary, target_beneficiaries, logo_url, business_model, website').ilike('name', e.canonical_name).limit(1);
    })(),
    e.postcode
      ? supabase.from('governed_proof_bundles').select('*').eq('subject_type', 'place').eq('subject_id', e.postcode).or('promotion_status.eq.partner,promotion_status.eq.public').maybeSingle()
      : Promise.resolve({ data: null }),
    e.abn
      ? supabase.from('gs_relationships').select('id, amount, properties').eq('source_entity_id', e.id).eq('relationship_type', 'grant').order('amount', { ascending: false, nullsFirst: false }).limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  const mvStats = mvStatsData as MvEntityStats | null;
  const foundation = (foundationData || [])[0] as FoundationEnrichment | undefined;
  const charity = (charityData || [])[0] as CharityEnrichment | undefined;
  const socialEnterprise = (socialEnterpriseResult?.data || [])[0] as SocialEnterpriseEnrichment | undefined;
  const placeGeo = (placeGeoData || [])[0] as PlaceGeo | undefined;
  const seifa = (seifaData || [])[0] as SeifaData | undefined;
  const governedProofBundle = governedProofData as GovernedProofBundle | null;

  // Foundation programs
  let foundationPrograms: FoundationProgram[] = [];
  if (foundation?.id) {
    const { data: progData } = await supabase
      .from('foundation_programs')
      .select('id, name, url, description, amount_min, amount_max, deadline, status, categories, program_type, eligibility, application_process')
      .eq('foundation_id', foundation.id)
      .in('status', ['open', 'closed'])
      .order('deadline', { ascending: true, nullsFirst: false });
    foundationPrograms = (progData || []) as FoundationProgram[];
  }

  // ACNC financials dedup
  const acncByYear = new Map<number, AcncYear>();
  for (const row of (acncData || []) as AcncYear[]) {
    const existing = acncByYear.get(row.ais_year);
    if (!existing || (Number(row.total_assets) || 0) > (Number(existing.total_assets) || 0)) {
      acncByYear.set(row.ais_year, row);
    }
  }
  const financialYears = Array.from(acncByYear.values()).sort((a, b) => b.ais_year - a.ais_year);

  // Governed proof
  const governedProofPack = governedProofBundle ? getProofPack(governedProofBundle as never) : null;
  const governedProofStrengths = governedProofPack ? governedProofPack.strengths.slice(0, 2) : [];

  // Justice + ALMA data (for evidence tab indicator)
  const disabilityRelevant =
    hasDisabilitySignal(charity?.beneficiaries) ||
    hasDisabilitySignal(charity?.purposes) ||
    hasDisabilitySignal(socialEnterprise?.target_beneficiaries) ||
    hasDisabilitySignal(socialEnterprise?.sector) ||
    hasDisabilitySignal([e.sector, e.sub_sector, e.description]);

  // NDIS market context
  let ndisStateSupplyTotal: NdisSupplyRow | null = null;
  let ndisStateDistricts: NdisSupplyRow[] = [];
  let ndisStateHotspots: NdisConcentrationRow[] = [];
  let ndisThinDistrictCount = 0;
  let ndisVeryThinDistrictCount = 0;
  let localDisabilityEnterpriseCount = 0;
  let localCommunityControlledCount = 0;
  let ndisSourceLink: string | null = null;

  if (disabilityRelevant && e.state) {
    const [
      { data: ndisStateSupplyData },
      { data: ndisDistrictData },
      { data: ndisConcentrationData },
      { count: disabilityEnterpriseCount },
      { count: communityControlledCount },
    ] = await Promise.all([
      supabase.from('v_ndis_provider_supply_summary').select('report_date, state_code, service_district_name, provider_count').eq('state_code', e.state).eq('service_district_name', 'ALL').limit(1),
      supabase.from('v_ndis_provider_supply_summary').select('report_date, state_code, service_district_name, provider_count').eq('state_code', e.state).neq('service_district_name', 'ALL').neq('service_district_name', 'Other').not('service_district_name', 'ilike', '%Missing%').order('provider_count', { ascending: true }),
      supabase.from('ndis_market_concentration').select('state_code, service_district_name, payment_share_top10_pct, payment_band, source_page_url, source_file_url, source_file_title').eq('state_code', e.state).eq('support_class', 'Core').neq('service_district_name', 'ALL').neq('service_district_name', 'Other').not('service_district_name', 'ilike', '%Missing%').not('payment_share_top10_pct', 'is', null).order('payment_share_top10_pct', { ascending: false }),
      e.postcode ? supabase.from('social_enterprises').select('id', { count: 'exact', head: true }).eq('postcode', e.postcode).overlaps('target_beneficiaries', ['People with disabilities', 'people_with_disability']) : Promise.resolve({ count: 0 }),
      e.postcode ? supabase.from('gs_entities').select('id', { count: 'exact', head: true }).eq('postcode', e.postcode).eq('is_community_controlled', true) : Promise.resolve({ count: 0 }),
    ]);

    ndisStateSupplyTotal = ((ndisStateSupplyData || [])[0] as NdisSupplyRow | undefined) || null;
    ndisStateDistricts = ((ndisDistrictData || []) as NdisSupplyRow[]).filter((row) => validNdisDistrict(row.service_district_name));
    ndisThinDistrictCount = ndisStateDistricts.filter((row) => row.provider_count < 100).length;
    ndisVeryThinDistrictCount = ndisStateDistricts.filter((row) => row.provider_count < 50).length;
    localDisabilityEnterpriseCount = disabilityEnterpriseCount || 0;
    localCommunityControlledCount = communityControlledCount || 0;

    const districtNameByLabel = new Map<string, string>();
    for (const row of ndisStateDistricts) {
      districtNameByLabel.set(districtLabel(row.service_district_name), row.service_district_name);
    }
    const concentrationByDistrict = new Map<string, NdisConcentrationRow>();
    for (const row of (ndisConcentrationData || []) as NdisConcentrationRow[]) {
      if (!validNdisDistrict(row.service_district_name)) continue;
      const normalizedDistrict = districtLabel(row.service_district_name);
      if (!districtNameByLabel.has(normalizedDistrict)) continue;
      const key = `${row.state_code}:${normalizedDistrict}`;
      const current = concentrationByDistrict.get(key);
      if (!current || (row.payment_share_top10_pct || 0) > (current.payment_share_top10_pct || 0)) {
        concentrationByDistrict.set(key, { ...row, service_district_name: districtNameByLabel.get(normalizedDistrict) || normalizedDistrict });
      }
    }
    ndisStateHotspots = Array.from(concentrationByDistrict.values()).sort((a, b) => (b.payment_share_top10_pct || 0) - (a.payment_share_top10_pct || 0)).slice(0, 4);
    ndisSourceLink = ndisStateHotspots.find((row) => row.source_file_url || row.source_page_url)?.source_file_url || ndisStateHotspots.find((row) => row.source_page_url)?.source_page_url || null;
  }

  // JusticeHub cross-system
  interface JHOrg { id: string; name: string; slug: string | null }
  const jhOrgRows = await safeOptionalData(
    supabase.from('organizations').select('id, name, slug').eq('gs_entity_id', e.id).limit(1),
    [] as JHOrg[],
  );
  const jhOrg = jhOrgRows[0];

  let almaInterventionCount = 0;
  let almaEvidenceCount = 0;
  let almaInterventions: AlmaIntervention[] = [];
  if (jhOrg) {
    const [interventions, interventionIds] = await Promise.all([
      safeOptionalData(supabase.from('alma_interventions').select('id, name, type').eq('operating_organization_id', jhOrg.id).order('name'), [] as AlmaIntervention[]),
      safeOptionalData(supabase.from('alma_interventions').select('id').eq('operating_organization_id', jhOrg.id), [] as Array<{ id: string }>),
    ]);
    almaInterventions = interventions;
    almaInterventionCount = almaInterventions.length;
    if (interventionIds.length > 0) {
      almaEvidenceCount = await safeOptionalCount(
        supabase.from('alma_intervention_evidence').select('id', { count: 'exact', head: true }).in('intervention_id', interventionIds.map((row) => row.id)),
      );
    }
  }

  // Postcode entity count
  let postcodeEntityCount = 0;
  if (e.postcode) {
    const { count } = await supabase.from('gs_entities').select('id', { count: 'exact', head: true }).eq('postcode', e.postcode);
    postcodeEntityCount = count || 0;
  }

  // Person roles (board seats, executive roles) — for person entities
  let personRoles: PersonRole[] = [];
  if (e.entity_type === 'person') {
    // Match by person_entity_id first, fall back to normalised name match
    const nameNormalised = e.canonical_name.toUpperCase();
    const { data: rolesData } = await supabase
      .from('person_roles')
      .select('person_name, role_type, company_name, company_abn, properties')
      .or(`person_entity_id.eq.${e.id},person_name_normalised.eq.${nameNormalised}`)
      .order('company_name');
    // Enrich with gs_id for linking
    const roles = (rolesData || []) as Array<PersonRole & { entity_gs_id?: string | null }>;
    if (roles.length > 0) {
      const abns = [...new Set(roles.map((r) => r.company_abn).filter(Boolean))] as string[];
      if (abns.length > 0) {
        const { data: entities } = await supabase
          .from('gs_entities')
          .select('gs_id, abn')
          .in('abn', abns);
        const abnToGsId = new Map((entities || []).map((ent) => [ent.abn, ent.gs_id]));
        for (const r of roles) {
          r.entity_gs_id = r.company_abn ? abnToGsId.get(r.company_abn) || null : null;
        }
      }
      personRoles = roles;
    }
  }

  // Grants
  const grants = (grantData || []) as Array<{ id: string; amount: number | null; properties: Record<string, string | null> }>;

  // Justice funding (for overview tab — only server-side for initial render)
  let justiceFunding: Array<{ id: string; recipient_name: string; recipient_abn: string | null; program_name: string; amount_dollars: number | null; sector: string | null; source: string; financial_year: string | null; location: string | null; project_description: string | null }> = [];
  if (e.abn) {
    const { data } = await supabase.from('justice_funding').select('id, recipient_name, recipient_abn, program_name, amount_dollars, sector, source, financial_year, location, project_description').eq('recipient_abn', e.abn).order('amount_dollars', { ascending: false, nullsFirst: false });
    justiceFunding = data || [];
  } else {
    const { data } = await supabase.from('justice_funding').select('id, recipient_name, recipient_abn, program_name, amount_dollars, sector, source, financial_year, location, project_description').ilike('recipient_name', `%${e.canonical_name.replace(/[%_]/g, '')}%`).order('amount_dollars', { ascending: false, nullsFirst: false }).limit(50);
    justiceFunding = data || [];
  }
  const totalJusticeFunding = justiceFunding.reduce((sum, r) => sum + (r.amount_dollars || 0), 0);

  // Org person roles (board/leadership for non-person entities)
  let orgPersonRoles: Array<{ person_name: string; role_type: string; person_gs_id: string | null }> = [];
  if (e.entity_type !== 'person') {
    const { data: orgRolesData } = await supabase
      .from('person_roles')
      .select('person_name, role_type, person_entity_id')
      .eq('entity_id', e.id)
      .order('role_type')
      .order('person_name');
    if (orgRolesData && orgRolesData.length > 0) {
      const personEntityIds = [...new Set(orgRolesData.map(r => r.person_entity_id).filter(Boolean))] as string[];
      const personGsIdMap = new Map<string, string>();
      if (personEntityIds.length > 0) {
        const { data: personEntities } = await supabase
          .from('gs_entities')
          .select('id, gs_id')
          .in('id', personEntityIds);
        for (const pe of personEntities || []) personGsIdMap.set(pe.id, pe.gs_id);
      }
      orgPersonRoles = orgRolesData.map(r => ({
        person_name: r.person_name,
        role_type: r.role_type,
        person_gs_id: r.person_entity_id ? personGsIdMap.get(r.person_entity_id) || null : null,
      }));
    }
  }

  // Outcome submissions for this entity
  let outcomeSubmissions: Array<{ id: string; program_name: string; reporting_period: string; outcomes: Array<{ metric: string; value: number; unit: string; description?: string }>; narrative: string | null; status: string }> = [];
  {
    const { data: osData } = await supabase
      .from('outcome_submissions')
      .select('id, program_name, reporting_period, outcomes, narrative, status')
      .eq('gs_entity_id', e.gs_id)
      .order('created_at', { ascending: false });
    outcomeSubmissions = (osData || []) as typeof outcomeSubmissions;
  }

  // Political donations (grouped by party/recipient)
  interface DonationRow { donation_to: string; total: number; count: number; years: string[] }
  let politicalDonations: DonationRow[] = [];
  let totalDonations = 0;
  if (e.abn) {
    const { data: donData } = await supabase.rpc('exec_sql', {
      query: `SELECT donation_to, SUM(amount)::bigint as total, COUNT(*)::int as count,
                     array_agg(DISTINCT financial_year ORDER BY financial_year) as years
              FROM political_donations WHERE donor_abn = '${e.abn}'
              GROUP BY donation_to ORDER BY total DESC LIMIT 20`,
    });
    politicalDonations = (donData || []) as DonationRow[];
    totalDonations = politicalDonations.reduce((s, d) => s + (d.total || 0), 0);
  }

  // Lobbying targets
  interface LobbyTarget { target_name: string; target_gs_id: string | null }
  let lobbyingTargets: LobbyTarget[] = [];
  {
    const { data: lobbyData } = await supabase
      .from('gs_relationships')
      .select('target_entity_id')
      .eq('source_entity_id', e.id)
      .eq('relationship_type', 'lobbies_for');
    if (lobbyData && lobbyData.length > 0) {
      const targetIds = lobbyData.map(r => r.target_entity_id);
      const { data: targetEntities } = await supabase
        .from('gs_entities')
        .select('id, canonical_name, gs_id')
        .in('id', targetIds);
      lobbyingTargets = (targetEntities || []).map(t => ({
        target_name: t.canonical_name,
        target_gs_id: t.gs_id,
      }));
    }
  }

  // Top contracts
  interface TopContractRow { title: string; contract_value: number; buyer_name: string; contract_start: string | null; contract_end: string | null }
  let topContracts: TopContractRow[] = [];
  if (e.abn) {
    const { data: contractData } = await supabase
      .from('austender_contracts')
      .select('title, contract_value, buyer_name, contract_start, contract_end')
      .eq('supplier_abn', e.abn)
      .not('contract_value', 'is', null)
      .order('contract_value', { ascending: false })
      .limit(5);
    topContracts = (contractData || []) as TopContractRow[];
  }

  // Shared directors — people who sit on this entity's board AND other boards
  interface SharedDirectorRow { person_name: string; person_gs_id: string | null; shared_entities: Array<{ name: string; gs_id: string | null }> }
  let sharedDirectors: SharedDirectorRow[] = [];
  if (e.entity_type !== 'person' && orgPersonRoles.length > 0) {
    // Get person entity IDs from orgPersonRoles that have gs_ids
    const personGsIds = orgPersonRoles.map(r => r.person_gs_id).filter(Boolean) as string[];
    if (personGsIds.length > 0) {
      const { data: interlockData } = await supabase.rpc('exec_sql', {
        query: `SELECT pr.person_name,
                       pe.gs_id as person_gs_id,
                       json_agg(json_build_object('name', ge2.canonical_name, 'gs_id', ge2.gs_id) ORDER BY ge2.canonical_name) as shared_entities
                FROM person_roles pr
                JOIN gs_entities pe ON pe.gs_id = ANY(ARRAY[${personGsIds.map(id => `'${id}'`).join(',')}])
                  AND pe.id = pr.person_entity_id
                JOIN gs_entities ge2 ON ge2.id = pr.entity_id AND ge2.id != '${e.id}'
                GROUP BY pr.person_name, pe.gs_id
                HAVING COUNT(*) > 0
                ORDER BY COUNT(*) DESC
                LIMIT 10`,
      });
      sharedDirectors = (interlockData || []) as SharedDirectorRow[];
    }
  }

  // Cross-system summary — which data systems mention this entity
  const crossSystems: string[] = [];
  if ((mvStats?.type_breakdown['contract:inbound']?.count ?? 0) > 0 || (mvStats?.type_breakdown['contract:outbound']?.count ?? 0) > 0) crossSystems.push('Procurement');
  if (justiceFunding.length > 0) crossSystems.push('Justice Funding');
  if (totalDonations > 0) crossSystems.push('Political Donations');
  if (lobbyingTargets.length > 0) crossSystems.push('Lobbying');
  if (charity) crossSystems.push('ACNC Charities');
  if (foundation) crossSystems.push('Foundations');
  if (almaInterventionCount > 0) crossSystems.push('ALMA Evidence');
  if (outcomeSubmissions.length > 0) crossSystems.push('Governed Proof');
  if (financialYears.length > 0 && !charity) crossSystems.push('ATO');
  const crossSystemSummary = { systems: crossSystems, count: crossSystems.length };

  // Auth & workspace context
  let isPremium = false;
  let workspaceOrgName: string | null = null;
  let canEditWorkspace = false;
  let workspaceShortlists: Array<{ id: string; name: string; is_default: boolean }> = [];
  let workspaceMemberships: Array<Record<string, unknown>> = [];
  let workspaceTasks: Array<Record<string, unknown>> = [];
  try {
    const supabaseAuth = await createSupabaseServer();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('org_profiles').select('stripe_customer_id').eq('user_id', user.id).single();
      isPremium = !!profile?.stripe_customer_id;
      const workspaceResult = await getEntityProcurementMemberships(supabase, user.id, { gsId, supplierAbn: e.abn, preferredShortlistId });
      workspaceOrgName = workspaceResult.context.profile?.name || null;
      canEditWorkspace = workspaceResult.context.currentUserPermissions?.can_edit_shortlist === true;
      workspaceShortlists = workspaceResult.context.shortlists.map((s) => ({ id: s.id, name: s.name, is_default: s.is_default }));
      workspaceMemberships = workspaceResult.memberships as unknown as Array<Record<string, unknown>>;
      workspaceTasks = workspaceResult.tasks as unknown as Array<Record<string, unknown>>;
    }
  } catch {
    // Not logged in — free tier
  }

  const hasEvidence = almaInterventionCount > 0 || justiceFunding.length > 0;

  const enrichment: EntityEnrichment = {
    foundation, foundationPrograms, charity, socialEnterprise,
    financialYears, placeGeo, seifa, postcodeEntityCount,
    governedProofBundle, governedProofPack, governedProofStrengths,
    justiceFunding, totalJusticeFunding, grants: grants as never,
    jhOrg, almaInterventions, almaInterventionCount, almaEvidenceCount,
    disabilityRelevant,
    ndisStateSupplyTotal, ndisStateDistricts, ndisStateHotspots,
    ndisThinDistrictCount, ndisVeryThinDistrictCount,
    localDisabilityEnterpriseCount, localCommunityControlledCount,
    ndisSourceLink,
    personRoles,
    orgPersonRoles,
    outcomeSubmissions,
    politicalDonations,
    totalDonations,
    lobbyingTargets,
    topContracts,
    sharedDirectors,
    crossSystemSummary,
  };

  const workspace: WorkspaceContext = {
    isPremium, workspaceOrgName, canEditWorkspace,
    workspaceShortlists, workspaceMemberships, workspaceTasks,
  };

  return (
    <div className="max-w-5xl">
      <EntityHeader
        entity={e}
        stats={mvStats}
        charity={charity}
        socialEnterprise={socialEnterprise}
        returnHref={returnHref}
        returnLabel={returnLabel}
      />

      <TabShell
        gsId={e.gs_id}
        defaultTab="overview"
        hasEvidence={hasEvidence}
        entityType={e.entity_type}
        overviewContent={
          <OverviewTab
            entity={e}
            stats={mvStats}
            enrichment={enrichment}
            workspace={workspace}
            preferredShortlistId={preferredShortlistId}
          />
        }
        moneyContent={<MoneyTab gsId={e.gs_id} isPremium={isPremium} />}
        networkContent={<NetworkTab gsId={e.gs_id} />}
        evidenceContent={<EvidenceTab gsId={e.gs_id} isPremium={isPremium} />}
      />
    </div>
  );
}
