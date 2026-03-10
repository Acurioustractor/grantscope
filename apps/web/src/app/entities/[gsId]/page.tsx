import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CommunityEvidence } from './impact-stories';

export const dynamic = 'force-dynamic';

interface Entity {
  id: string;
  gs_id: string;
  entity_type: string;
  canonical_name: string;
  abn: string | null;
  acn: string | null;
  description: string | null;
  website: string | null;
  state: string | null;
  postcode: string | null;
  sector: string | null;
  sub_sector: string | null;
  tags: string[];
  source_datasets: string[];
  source_count: number;
  confidence: string;
  latest_revenue: number | null;
  latest_assets: number | null;
  latest_tax_payable: number | null;
  financial_year: string | null;
  is_community_controlled: boolean | null;
}

interface JusticeFundingRecord {
  id: string;
  recipient_name: string;
  recipient_abn: string | null;
  program_name: string;
  amount_dollars: number | null;
  sector: string | null;
  source: string;
  financial_year: string | null;
  location: string | null;
  project_description: string | null;
}

interface PlaceContext {
  postcode: string;
  locality: string | null;
  state: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  seifa_irsd_score: number | null;
  entity_count: number;
}

interface Relationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  amount: number | null;
  year: number | null;
  dataset: string;
  confidence: string;
  properties: Record<string, string | null>;
  start_date: string | null;
  end_date: string | null;
}

interface ConnectedEntity {
  id: string;
  gs_id: string;
  canonical_name: string;
  entity_type: string;
}

function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function entityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    charity: 'Charity',
    foundation: 'Foundation',
    company: 'Company',
    government_body: 'Government Body',
    indigenous_corp: 'Indigenous Corporation',
    political_party: 'Political Party',
    social_enterprise: 'Social Enterprise',
    trust: 'Trust',
    person: 'Person',
    unknown: 'Unknown',
  };
  return labels[type] || type;
}

function entityTypeBadge(type: string) {
  const styles: Record<string, string> = {
    charity: 'border-money bg-money-light text-money',
    foundation: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
    company: 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-black',
    government_body: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black',
    indigenous_corp: 'border-bauhaus-red bg-error-light text-bauhaus-red',
    political_party: 'border-bauhaus-red bg-error-light text-bauhaus-red',
    social_enterprise: 'border-money bg-money-light text-money',
  };
  return styles[type] || 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
}

function confidenceBadge(c: string) {
  if (c === 'registry') return { cls: 'border-money bg-money-light text-money', label: 'Registry' };
  if (c === 'verified') return { cls: 'border-bauhaus-blue bg-link-light text-bauhaus-blue', label: 'Verified' };
  if (c === 'reported') return { cls: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black', label: 'Reported' };
  return { cls: 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted', label: c };
}

function relTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    donation: 'Political Donation',
    contract: 'Government Contract',
    grant: 'Grant',
    subsidiary_of: 'Subsidiary Of',
    charity_link: 'Charity Link',
    registered_as: 'Registered As',
    lobbies_for: 'Lobbies For',
    member_of: 'Member Of',
    ownership: 'Ownership',
    directorship: 'Directorship',
    program_funding: 'Program Funding',
    tax_record: 'Tax Record',
    listed_as: 'Listed As',
  };
  return labels[type] || type.replace(/_/g, ' ');
}

function datasetLabel(ds: string): string {
  const labels: Record<string, string> = {
    acnc: 'ACNC',
    foundations: 'Foundations',
    oric: 'ORIC',
    austender: 'AusTender',
    aec_donations: 'AEC Donations',
    ato_tax: 'ATO Tax',
    asx: 'ASX',
    social_enterprises: 'Social Enterprises',
    modern_slavery: 'Modern Slavery Register',
    lobbying_register: 'Lobbying Register',
  };
  return labels[ds] || ds;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function EntityDossierPage({ params }: { params: Promise<{ gsId: string }> }) {
  const { gsId } = await params;
  const supabase = getServiceSupabase();

  const { data: entity } = await supabase
    .from('gs_entities')
    .select('*')
    .eq('gs_id', gsId)
    .single();

  if (!entity) notFound();
  const e = entity as Entity;

  // Check auth status for premium gating
  let isPremium = false;
  try {
    const supabaseAuth = await createSupabaseServer();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('org_profiles')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single();
      isPremium = !!profile?.stripe_customer_id;
    }
  } catch {
    // Not logged in — free tier
  }

  // Fetch relationships, ACNC financials, grants, justice funding, place context, and cross-system data in parallel
  const [
    { data: outbound },
    { data: inbound },
    { data: acncData },
    { data: grantData },
    { data: justiceFundingData },
    { data: placeGeoData },
    { data: seifaData },
    { data: foundationData },
    { data: foundationProgramsData },
    { data: charityData },
    { data: socialEnterpriseData },
    { data: jhOrgData },
  ] = await Promise.all([
    supabase
      .from('gs_relationships')
      .select('*')
      .eq('source_entity_id', e.id)
      .order('amount', { ascending: false, nullsFirst: false }),
    supabase
      .from('gs_relationships')
      .select('*')
      .eq('target_entity_id', e.id)
      .order('amount', { ascending: false, nullsFirst: false }),
    // ACNC Annual Information Statements (if entity has ABN)
    e.abn
      ? supabase
          .from('acnc_ais')
          .select('ais_year, total_revenue, total_expenses, total_assets, net_surplus_deficit, donations_and_bequests, grants_donations_au, grants_donations_intl, employee_expenses, staff_fte, staff_volunteers, charity_size, revenue_from_government')
          .eq('abn', e.abn)
          .order('ais_year', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Grant opportunities offered by this entity (if foundation)
    e.abn
      ? supabase
          .from('gs_relationships')
          .select('id, amount, properties')
          .eq('source_entity_id', e.id)
          .eq('relationship_type', 'grant')
          .order('amount', { ascending: false, nullsFirst: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    // Justice funding received (cross-platform — JusticeHub data in same Supabase)
    e.abn
      ? supabase
          .from('justice_funding')
          .select('id, recipient_name, recipient_abn, program_name, amount_dollars, sector, source, financial_year, location, project_description')
          .eq('recipient_abn', e.abn)
          .order('amount_dollars', { ascending: false, nullsFirst: false })
      : supabase
          .from('justice_funding')
          .select('id, recipient_name, recipient_abn, program_name, amount_dollars, sector, source, financial_year, location, project_description')
          .ilike('recipient_name', `%${e.canonical_name.replace(/[%_]/g, '')}%`)
          .order('amount_dollars', { ascending: false, nullsFirst: false })
          .limit(50),
    // Place context — postcode geo
    e.postcode
      ? supabase
          .from('postcode_geo')
          .select('postcode, locality, state, remoteness_2021, lga_name')
          .eq('postcode', e.postcode)
          .limit(1)
      : Promise.resolve({ data: [] }),
    // SEIFA disadvantage index
    e.postcode
      ? supabase
          .from('seifa_2021')
          .select('decile_national, score')
          .eq('postcode', e.postcode)
          .eq('index_type', 'IRSD')
          .limit(1)
      : Promise.resolve({ data: [] }),
    // Foundation enrichment (if entity has ABN matching a foundation)
    e.abn
      ? supabase
          .from('foundations')
          .select('id, name, description, thematic_focus, geographic_focus, target_recipients, giving_philosophy, application_tips, notable_grants, total_giving_annual, wealth_source, parent_company, board_members, endowment_size, giving_ratio')
          .eq('acnc_abn', e.abn)
          .limit(1)
      : Promise.resolve({ data: [] }),
    // Foundation programs — fetched after Promise.all using foundation ID
    Promise.resolve({ data: [] }),
    // Charity enrichment (ACNC register data)
    e.abn
      ? supabase
          .from('acnc_charities')
          .select('abn, name, charity_size, pbi, hpc, purposes, beneficiaries, operating_states')
          .eq('abn', e.abn)
          .limit(1)
      : Promise.resolve({ data: [] }),
    // Social enterprise enrichment (try ABN first, then name)
    (async () => {
      if (e.abn) {
        const { data } = await supabase
          .from('social_enterprises')
          .select('id, name, org_type, certifications, sector, source_primary, target_beneficiaries, logo_url, business_model, website')
          .eq('abn', e.abn)
          .limit(1);
        if (data && data.length > 0) return { data };
      }
      return supabase
        .from('social_enterprises')
        .select('id, name, org_type, certifications, sector, source_primary, target_beneficiaries, logo_url, business_model, website')
        .ilike('name', e.canonical_name)
        .limit(1);
    })(),
    // JusticeHub organization (cross-system bridge)
    supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('gs_entity_id', e.id)
      .limit(1),
  ]);

  // Process enrichment data
  interface FoundationEnrichment {
    id: string;
    name: string;
    description: string | null;
    thematic_focus: string[];
    geographic_focus: string[];
    target_recipients: string[];
    giving_philosophy: string | null;
    application_tips: string | null;
    notable_grants: string[] | null;
    total_giving_annual: number | null;
    wealth_source: string | null;
    parent_company: string | null;
    board_members: string[] | null;
    endowment_size: number | null;
    giving_ratio: number | null;
  }
  const foundation = (foundationData || [])[0] as FoundationEnrichment | undefined;

  // Fetch foundation programs if we found a foundation
  interface FoundationProgram {
    id: string;
    name: string;
    url: string | null;
    description: string | null;
    amount_min: number | null;
    amount_max: number | null;
    deadline: string | null;
    status: string;
    categories: string[];
    program_type: string | null;
    eligibility: string | null;
    application_process: string | null;
  }
  let foundationPrograms: FoundationProgram[] = [];
  if (foundation?.id) {
    const { data: progData } = await supabase
      .from('foundation_programs')
      .select('id, name, url, description, amount_min, amount_max, deadline, status, categories, program_type, eligibility, application_process')
      .eq('foundation_id', foundation.id)
      .eq('status', 'active')
      .order('deadline', { ascending: true, nullsFirst: false });
    foundationPrograms = (progData || []) as FoundationProgram[];
  }

  interface CharityEnrichment {
    abn: string;
    name: string;
    charity_size: string | null;
    pbi: boolean | null;
    hpc: boolean | null;
    purposes: string[] | null;
    beneficiaries: string[] | null;
    operating_states: string[] | null;
  }
  const charity = (charityData || [])[0] as CharityEnrichment | undefined;

  interface SocialEnterpriseEnrichment {
    id: string;
    name: string;
    org_type: string | null;
    certifications: string[] | null;
    sector: string[] | null;
    source_primary: string | null;
    target_beneficiaries: string[] | null;
    logo_url: string | null;
    business_model: string | null;
    website: string | null;
  }
  const socialEnterprise = (socialEnterpriseData || [])[0] as SocialEnterpriseEnrichment | undefined;

  // JusticeHub cross-system data
  interface JHOrg { id: string; name: string; slug: string }
  const jhOrg = (jhOrgData || [])[0] as JHOrg | undefined;

  // ALMA evidence chain: entity → JH org → interventions → evidence
  let almaInterventionCount = 0;
  let almaEvidenceCount = 0;
  interface AlmaIntervention { id: string; name: string; type: string }
  let almaInterventions: AlmaIntervention[] = [];
  if (jhOrg) {
    const [{ data: interventions }, { count: evidenceCount }] = await Promise.all([
      supabase
        .from('alma_interventions')
        .select('id, name, type')
        .eq('operating_organization_id', jhOrg.id)
        .order('name'),
      supabase
        .from('alma_intervention_evidence')
        .select('id', { count: 'exact', head: true })
        .in('intervention_id',
          (await supabase
            .from('alma_interventions')
            .select('id')
            .eq('operating_organization_id', jhOrg.id)
          ).data?.map((i: { id: string }) => i.id) || []
        ),
    ]);
    almaInterventions = (interventions || []) as AlmaIntervention[];
    almaInterventionCount = almaInterventions.length;
    almaEvidenceCount = evidenceCount || 0;
  }

  // Deduplicate ACNC financials by year (keep richest record)
  interface AcncYear {
    ais_year: number;
    total_revenue: number | null;
    total_expenses: number | null;
    total_assets: number | null;
    net_surplus_deficit: number | null;
    donations_and_bequests: number | null;
    grants_donations_au: number | null;
    grants_donations_intl: number | null;
    employee_expenses: number | null;
    staff_fte: number | null;
    staff_volunteers: number | null;
    charity_size: string | null;
    revenue_from_government: number | null;
  }
  const acncByYear = new Map<number, AcncYear>();
  for (const row of (acncData || []) as AcncYear[]) {
    const existing = acncByYear.get(row.ais_year);
    if (!existing || (Number(row.total_assets) || 0) > (Number(existing.total_assets) || 0)) {
      acncByYear.set(row.ais_year, row);
    }
  }
  const financialYears = Array.from(acncByYear.values()).sort((a, b) => b.ais_year - a.ais_year);
  const grants = (grantData || []) as Relationship[];
  const justiceFunding = (justiceFundingData || []) as JusticeFundingRecord[];
  const totalJusticeFunding = justiceFunding.reduce((sum, r) => sum + (r.amount_dollars || 0), 0);

  // Build place context
  const placeGeo = (placeGeoData || [])[0] as { postcode: string; locality: string; state: string; remoteness_2021: string; lga_name: string | null } | undefined;
  const seifa = (seifaData || [])[0] as { decile_national: number; score: number } | undefined;

  // Count entities in same postcode (for place context card)
  let postcodeEntityCount = 0;
  if (e.postcode) {
    const { count } = await supabase
      .from('gs_entities')
      .select('id', { count: 'exact', head: true })
      .eq('postcode', e.postcode);
    postcodeEntityCount = count || 0;
  }

  const allRels = [...(outbound || []), ...(inbound || [])] as Relationship[];

  // Collect all connected entity IDs and fetch their names
  const connectedIds = new Set<string>();
  for (const r of allRels) {
    connectedIds.add(r.source_entity_id);
    connectedIds.add(r.target_entity_id);
  }
  connectedIds.delete(e.id);

  const connectedMap = new Map<string, ConnectedEntity>();
  if (connectedIds.size > 0) {
    const ids = Array.from(connectedIds);
    // Fetch in batches of 100
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data } = await supabase
        .from('gs_entities')
        .select('id, gs_id, canonical_name, entity_type')
        .in('id', chunk);
      for (const ce of (data || [])) {
        connectedMap.set(ce.id, ce as ConnectedEntity);
      }
    }
  }

  // Group relationships by type
  const donations = allRels.filter(r => r.relationship_type === 'donation');
  const contracts = allRels.filter(r => r.relationship_type === 'contract');
  const otherRels = allRels.filter(r => !['donation', 'contract'].includes(r.relationship_type));

  const totalDonated = donations.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalContractValue = contracts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const isDonorContractor = donations.length > 0 && contracts.length > 0;

  // Get connected entity name helper
  const getName = (id: string) => connectedMap.get(id)?.canonical_name || 'Unknown';
  const getGsId = (id: string) => connectedMap.get(id)?.gs_id || '';

  const badge = confidenceBadge(e.confidence);

  return (
    <div className="max-w-5xl">
      <Link href="/entities" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Entity Graph
      </Link>

      {/* Header */}
      <div className="mt-4 mb-6">
        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">{e.canonical_name}</h1>
          {isDonorContractor && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-red bg-error-light text-bauhaus-red uppercase tracking-widest whitespace-nowrap">
              Donor-Contractor
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${entityTypeBadge(e.entity_type)}`}>
            {entityTypeLabel(e.entity_type)}
          </span>
          <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${badge.cls}`}>
            {badge.label}
          </span>
          {charity?.pbi && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-money bg-money-light text-money uppercase tracking-widest">
              PBI
            </span>
          )}
          {charity?.hpc && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue uppercase tracking-widest">
              HPC
            </span>
          )}
          {socialEnterprise && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-money bg-money-light text-money uppercase tracking-widest">
              Social Enterprise
            </span>
          )}
          {e.abn && (
            <span className="text-xs font-bold text-bauhaus-muted">ABN {e.abn}</span>
          )}
          {e.state && (
            <span className="text-xs font-bold text-bauhaus-muted">{e.state}</span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="p-4 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Relationships</div>
          <div className="text-2xl font-black text-bauhaus-black">{allRels.length.toLocaleString()}</div>
        </div>
        <div className="p-4 border-b-2 sm:border-b-0 sm:border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Data Sources</div>
          <div className="text-2xl font-black text-bauhaus-black">{e.source_count}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">
            {donations.length > 0 ? 'Political Donations' : 'Revenue'}
          </div>
          <div className="text-2xl font-black text-bauhaus-black">
            {donations.length > 0 ? formatMoney(totalDonated) : formatMoney(e.latest_revenue)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">
            {contracts.length > 0 ? 'Contract Value' : 'Tax Payable'}
          </div>
          <div className="text-2xl font-black text-bauhaus-black">
            {contracts.length > 0 ? formatMoney(totalContractValue) : formatMoney(e.latest_tax_payable)}
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2">
          {/* Description */}
          {e.description && (
            <Section title="About">
              <p className="text-bauhaus-muted leading-relaxed font-medium">{e.description}</p>
            </Section>
          )}

          {/* Foundation: Giving Philosophy */}
          {foundation?.giving_philosophy && (
            <Section title="Giving Philosophy">
              <p className="text-bauhaus-muted leading-relaxed font-medium">{foundation.giving_philosophy}</p>
              {foundation.wealth_source && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Wealth Source:</span>
                  <span className="text-sm font-bold text-bauhaus-black">{foundation.wealth_source}</span>
                </div>
              )}
              {foundation.parent_company && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Parent:</span>
                  <span className="text-sm font-bold text-bauhaus-black">{foundation.parent_company}</span>
                </div>
              )}
            </Section>
          )}

          {/* Foundation: Tips for Applicants */}
          {foundation?.application_tips && (
            <Section title="Tips for Applicants">
              <p className="text-bauhaus-muted leading-relaxed font-medium">{foundation.application_tips}</p>
            </Section>
          )}

          {/* Foundation: Programs & Opportunities */}
          {foundationPrograms.length > 0 && (
            <Section title={`Programs & Opportunities (${foundationPrograms.length})`}>
              <div className="space-y-0">
                {foundationPrograms.map((p) => (
                  <div key={p.id} className="py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-bold text-bauhaus-blue hover:underline truncate block">
                            {p.name}
                          </a>
                        ) : (
                          <div className="font-bold text-bauhaus-black truncate">{p.name}</div>
                        )}
                        <div className="text-[11px] text-bauhaus-muted font-medium mt-0.5">
                          {p.program_type && <span>{p.program_type} &middot; </span>}
                          {p.categories?.length > 0 && <span>{p.categories.join(', ')} &middot; </span>}
                          {p.deadline && <span>Closes {p.deadline}</span>}
                        </div>
                      </div>
                      {(p.amount_min || p.amount_max) && (
                        <div className="text-right ml-4 shrink-0">
                          <div className="font-black text-bauhaus-black">
                            {p.amount_min && p.amount_max
                              ? `${formatMoney(p.amount_min)}-${formatMoney(p.amount_max)}`
                              : formatMoney(p.amount_max || p.amount_min)}
                          </div>
                        </div>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-xs text-bauhaus-muted font-medium mt-1 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Foundation: Notable Grants */}
          {foundation?.notable_grants && foundation.notable_grants.length > 0 && (
            <Section title="Notable Grants">
              <ul className="space-y-1">
                {foundation.notable_grants.map((g, i) => (
                  <li key={i} className="text-sm text-bauhaus-muted font-medium flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-bauhaus-blue mt-2 shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Political Donations */}
          {donations.length > 0 && (
            <Section title={`Political Donations (${donations.length})`}>
              <div className="space-y-0">
                {/* Aggregate by party */}
                {(() => {
                  const byParty = new Map<string, { name: string; gsId: string; total: number; count: number; years: Set<number> }>();
                  for (const d of donations) {
                    const otherId = d.source_entity_id === e.id ? d.target_entity_id : d.source_entity_id;
                    const name = getName(otherId);
                    const existing = byParty.get(name) || { name, gsId: getGsId(otherId), total: 0, count: 0, years: new Set() };
                    existing.total += d.amount || 0;
                    existing.count++;
                    if (d.year) existing.years.add(d.year);
                    byParty.set(name, existing);
                  }
                  const sorted = Array.from(byParty.values()).sort((a, b) => b.total - a.total);
                  const display = isPremium ? sorted : sorted.slice(0, 3);
                  const items = display.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                      <div>
                        {p.gsId ? (
                          <Link href={`/entities/${p.gsId}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="font-bold text-bauhaus-black">{p.name}</span>
                        )}
                        <div className="text-[11px] text-bauhaus-muted font-medium">
                          {p.count} donation{p.count !== 1 ? 's' : ''} &middot; {Array.from(p.years).sort().join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-bauhaus-black">{formatMoney(p.total)}</div>
                      </div>
                    </div>
                  ));
                  if (!isPremium && sorted.length > 3) {
                    items.push(
                      <div key="unlock" className="mt-3 text-center">
                        <Link href="/pricing" className="inline-block px-4 py-2 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-blue transition-colors">
                          + {sorted.length - 3} more — Unlock Full Dossier
                        </Link>
                      </div>
                    );
                  }
                  return items;
                })()}
              </div>
            </Section>
          )}

          {/* Government Contracts */}
          {contracts.length > 0 && (
            <Section title={`Government Contracts (${contracts.length})`}>
              <div className="space-y-0">
                {contracts.slice(0, isPremium ? 20 : 5).map((c, i) => {
                  const otherId = c.source_entity_id === e.id ? c.target_entity_id : c.source_entity_id;
                  return (
                    <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                      <div className="flex-1 min-w-0">
                        {getGsId(otherId) ? (
                          <Link href={`/entities/${getGsId(otherId)}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue truncate block">
                            {c.properties?.buyer_name || c.properties?.supplier_name || getName(otherId)}
                          </Link>
                        ) : (
                          <span className="font-bold text-bauhaus-black truncate block">
                            {c.properties?.buyer_name || c.properties?.supplier_name || getName(otherId)}
                          </span>
                        )}
                        <div className="text-[11px] text-bauhaus-muted font-medium">
                          {c.properties?.category && <span>{c.properties.category} &middot; </span>}
                          {c.year && <span>{c.year}</span>}
                          {c.properties?.procurement_method && <span> &middot; {c.properties.procurement_method}</span>}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-black text-bauhaus-black">{formatMoney(c.amount)}</div>
                      </div>
                    </div>
                  );
                })}
                {contracts.length > (isPremium ? 20 : 5) && (
                  isPremium ? (
                    <div className="text-xs font-bold text-bauhaus-muted mt-3">
                      + {contracts.length - 20} more contracts
                    </div>
                  ) : (
                    <div className="mt-3 text-center">
                      <Link href="/pricing" className="inline-block px-4 py-2 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-blue transition-colors">
                        + {contracts.length - 5} more — Unlock Full Dossier
                      </Link>
                    </div>
                  )
                )}
              </div>
            </Section>
          )}

          {/* Grant Programs */}
          {grants.length > 0 && (
            <Section title={`Grant Programs (${grants.length})`}>
              <div className="space-y-0">
                {grants.map((g, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-bauhaus-black truncate">
                        {g.properties?.grant_name || 'Unnamed Program'}
                      </div>
                      <div className="text-[11px] text-bauhaus-muted font-medium">
                        {g.properties?.categories && <span>{g.properties.categories} &middot; </span>}
                        {g.properties?.closes_at && <span>Closes {g.properties.closes_at}</span>}
                      </div>
                    </div>
                    {g.amount && (
                      <div className="text-right ml-4">
                        <div className="font-black text-bauhaus-black">{formatMoney(g.amount)}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Justice Funding */}
          {justiceFunding.length > 0 && (
            isPremium ? (
              <Section title={`Justice Funding (${justiceFunding.length} records — ${formatMoney(totalJusticeFunding)})`}>
                {/* Year-by-year breakdown */}
                {(() => {
                  const byYear = new Map<string, { total: number; records: JusticeFundingRecord[] }>();
                  for (const jf of justiceFunding) {
                    const yr = jf.financial_year || 'Unknown';
                    const existing = byYear.get(yr) || { total: 0, records: [] };
                    existing.total += jf.amount_dollars || 0;
                    existing.records.push(jf);
                    byYear.set(yr, existing);
                  }
                  const sorted = Array.from(byYear.entries()).sort((a, b) => b[0].localeCompare(a[0]));
                  return sorted.map(([year, data]) => (
                    <div key={year} className="mb-4">
                      <div className="flex items-center justify-between py-2 border-b-2 border-bauhaus-black/10">
                        <span className="text-xs font-black text-bauhaus-black uppercase tracking-widest">{year}</span>
                        <span className="font-black text-bauhaus-black">{formatMoney(data.total)}</span>
                      </div>
                      {data.records.map((jf, i) => (
                        <div key={i} className="flex items-center justify-between py-2 pl-4 border-b border-bauhaus-black/5 last:border-b-0">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-bauhaus-black text-sm truncate">{jf.program_name}</div>
                            <div className="text-[11px] text-bauhaus-muted font-medium">
                              {jf.sector && <span className="capitalize">{jf.sector.replace(/_/g, ' ')}</span>}
                              {jf.source && <span> &middot; {jf.source.replace(/_/g, ' ')}</span>}
                              {jf.location && <span> &middot; {jf.location}</span>}
                            </div>
                          </div>
                          {jf.amount_dollars && (
                            <div className="text-right ml-4">
                              <div className="font-black text-bauhaus-black">{formatMoney(jf.amount_dollars)}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ));
                })()}
                {/* Sector breakdown */}
                {(() => {
                  const bySector = new Map<string, number>();
                  for (const jf of justiceFunding) {
                    const sec = jf.sector || 'other';
                    bySector.set(sec, (bySector.get(sec) || 0) + (jf.amount_dollars || 0));
                  }
                  const sorted = Array.from(bySector.entries()).sort((a, b) => b[1] - a[1]);
                  return (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {sorted.map(([sector, total]) => (
                        <div key={sector} className="bg-bauhaus-canvas p-3">
                          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest capitalize">{sector.replace(/_/g, ' ')}</div>
                          <div className="text-lg font-black text-bauhaus-black">{formatMoney(total)}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Section>
            ) : (
              <Section title={`Justice Funding (${justiceFunding.length} records)`}>
                <div className="relative">
                  <div className="blur-sm pointer-events-none select-none">
                    {justiceFunding.slice(0, 3).map((jf, i) => (
                      <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5">
                        <div className="font-bold text-bauhaus-black">{jf.program_name}</div>
                        <div className="font-black text-bauhaus-black">{formatMoney(jf.amount_dollars)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Link href="/pricing" className="px-6 py-3 bg-bauhaus-black text-white font-black text-sm uppercase tracking-widest hover:bg-bauhaus-blue transition-colors">
                      Unlock Full Dossier
                    </Link>
                  </div>
                </div>
              </Section>
            )
          )}

          {/* Social Enterprise Profile */}
          {socialEnterprise && (socialEnterprise.target_beneficiaries || socialEnterprise.business_model || socialEnterprise.sector) && (
            <Section title="Social Enterprise">
              <div className="space-y-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {socialEnterprise.logo_url && (
                  <img src={socialEnterprise.logo_url} alt={`${socialEnterprise.name} logo`} className="h-12 object-contain" />
                )}
                {socialEnterprise.business_model && (
                  <p className="text-bauhaus-muted leading-relaxed font-medium text-sm">{socialEnterprise.business_model}</p>
                )}
                {socialEnterprise.certifications && (
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(socialEnterprise.certifications) ? socialEnterprise.certifications : []).map((cert: string) => (
                      <span key={cert} className="text-[10px] font-black px-2 py-0.5 border-2 border-money bg-money-light text-money uppercase tracking-widest">
                        {cert}
                      </span>
                    ))}
                  </div>
                )}
                {socialEnterprise.target_beneficiaries && socialEnterprise.target_beneficiaries.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Beneficiaries</div>
                    <div className="flex flex-wrap gap-1.5">
                      {socialEnterprise.target_beneficiaries.map((b: string) => (
                        <span key={b} className="text-xs font-bold px-2 py-0.5 bg-bauhaus-black/5 text-bauhaus-black">
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {socialEnterprise.sector && socialEnterprise.sector.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Services</div>
                    <div className="flex flex-wrap gap-1.5">
                      {socialEnterprise.sector.map((s: string) => (
                        <span key={s} className="text-xs font-bold px-2 py-0.5 bg-bauhaus-black/5 text-bauhaus-muted">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {socialEnterprise.source_primary && (
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest pt-2 border-t border-bauhaus-black/5">
                    Source: {socialEnterprise.source_primary === 'social-traders' ? 'Social Traders' : socialEnterprise.source_primary}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ALMA Evidence (JusticeHub cross-system) */}
          {almaInterventionCount > 0 && (
            <Section title={`Justice Interventions (${almaInterventionCount})`}>
              <div className="space-y-0">
                {almaInterventions.map((ai) => (
                  <div key={ai.id} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-bauhaus-black text-sm truncate">{ai.name}</div>
                      <div className="text-[11px] text-bauhaus-muted font-medium capitalize">{ai.type?.replace(/_/g, ' ')}</div>
                    </div>
                  </div>
                ))}
              </div>
              {almaEvidenceCount > 0 && (
                <div className="mt-3 bg-bauhaus-canvas p-3">
                  <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Evidence Base: </span>
                  <span className="text-sm font-black text-bauhaus-black">{almaEvidenceCount} evidence record{almaEvidenceCount !== 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="mt-3 text-[10px] text-bauhaus-muted leading-relaxed">
                Data from JusticeHub ALMA — Australian Lived-experience, Methods &amp; Approaches database.
              </div>
            </Section>
          )}

          {/* Community Evidence (Empathy Ledger — governed proof layer) */}
          <CommunityEvidence gsId={e.gs_id} isPremium={isPremium} />

          {/* ACNC Financial History */}
          {financialYears.length > 0 && (
            <Section title={`Financial History (${financialYears.length} years)`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-4 border-bauhaus-black">
                      <th className="text-left py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Year</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Revenue</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Expenses</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Assets</th>
                      <th className="text-right py-2 text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Surplus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialYears.slice(0, 8).map((fy, i) => (
                      <tr key={i} className="border-b border-bauhaus-black/5">
                        <td className="py-2 font-black text-bauhaus-black">{fy.ais_year}</td>
                        <td className="py-2 text-right font-bold text-bauhaus-black">{formatMoney(Number(fy.total_revenue))}</td>
                        <td className="py-2 text-right font-bold text-bauhaus-muted">{formatMoney(Number(fy.total_expenses))}</td>
                        <td className="py-2 text-right font-bold text-bauhaus-black">{formatMoney(Number(fy.total_assets))}</td>
                        <td className={`py-2 text-right font-black ${Number(fy.net_surplus_deficit) >= 0 ? 'text-money' : 'text-bauhaus-red'}`}>
                          {formatMoney(Number(fy.net_surplus_deficit))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Key metrics from latest year */}
              {financialYears[0] && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {financialYears[0].revenue_from_government && Number(financialYears[0].revenue_from_government) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Govt Revenue</div>
                      <div className="text-lg font-black text-bauhaus-black">{formatMoney(Number(financialYears[0].revenue_from_government))}</div>
                    </div>
                  )}
                  {financialYears[0].grants_donations_au && Number(financialYears[0].grants_donations_au) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Grants Given (AU)</div>
                      <div className="text-lg font-black text-bauhaus-black">{formatMoney(Number(financialYears[0].grants_donations_au))}</div>
                    </div>
                  )}
                  {financialYears[0].staff_fte && Number(financialYears[0].staff_fte) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Staff (FTE)</div>
                      <div className="text-lg font-black text-bauhaus-black">{Number(financialYears[0].staff_fte).toLocaleString()}</div>
                    </div>
                  )}
                  {financialYears[0].staff_volunteers && Number(financialYears[0].staff_volunteers) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Volunteers</div>
                      <div className="text-lg font-black text-bauhaus-black">{Number(financialYears[0].staff_volunteers).toLocaleString()}</div>
                    </div>
                  )}
                  {financialYears[0].donations_and_bequests && Number(financialYears[0].donations_and_bequests) > 0 && (
                    <div className="bg-bauhaus-canvas p-3">
                      <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Donations Received</div>
                      <div className="text-lg font-black text-bauhaus-black">{formatMoney(Number(financialYears[0].donations_and_bequests))}</div>
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Other Relationships */}
          {otherRels.length > 0 && (
            <Section title={`Other Connections (${otherRels.length})`}>
              <div className="space-y-0">
                {otherRels.slice(0, 10).map((r, i) => {
                  const otherId = r.source_entity_id === e.id ? r.target_entity_id : r.source_entity_id;
                  const direction = r.source_entity_id === e.id ? 'to' : 'from';
                  return (
                    <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                      <div>
                        <span className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mr-2">
                          {relTypeLabel(r.relationship_type)}
                        </span>
                        <span className="text-xs text-bauhaus-muted mr-1">{direction}</span>
                        {getGsId(otherId) ? (
                          <Link href={`/entities/${getGsId(otherId)}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue">
                            {getName(otherId)}
                          </Link>
                        ) : (
                          <span className="font-bold text-bauhaus-black">{getName(otherId)}</span>
                        )}
                      </div>
                      {r.amount && (
                        <div className="font-black text-bauhaus-black">{formatMoney(r.amount)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Identity */}
          <div className="bg-white border-4 border-bauhaus-black p-4">
            <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
              Identity
            </h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">GS ID</dt>
                <dd className="text-sm font-mono font-bold text-bauhaus-black">{e.gs_id}</dd>
              </div>
              {e.abn && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">ABN</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.abn}</dd>
                </div>
              )}
              {e.acn && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">ACN</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.acn}</dd>
                </div>
              )}
              {e.sector && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Sector</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.sector}</dd>
                </div>
              )}
              {e.website && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Website</dt>
                  <dd>
                    <a href={e.website.startsWith('http') ? e.website : `https://${e.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-sm font-bold text-bauhaus-blue hover:underline truncate block">
                      {e.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </div>
              )}
              {e.financial_year && (
                <div>
                  <dt className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">Financial Year</dt>
                  <dd className="text-sm font-bold text-bauhaus-black">{e.financial_year}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Focus Areas (foundation thematic + charity purposes/beneficiaries) */}
          {((foundation?.thematic_focus && foundation.thematic_focus.length > 0) ||
            (foundation?.geographic_focus && foundation.geographic_focus.length > 0) ||
            (foundation?.target_recipients && foundation.target_recipients.length > 0) ||
            (charity?.purposes && charity.purposes.length > 0) ||
            (charity?.beneficiaries && charity.beneficiaries.length > 0)) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
                Focus Areas
              </h3>
              {foundation?.thematic_focus && foundation.thematic_focus.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Themes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {foundation.thematic_focus.map((t, i) => (
                      <span key={i} className="text-[11px] font-bold px-2 py-0.5 border-2 border-bauhaus-blue/20 bg-link-light text-bauhaus-blue">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {foundation?.geographic_focus && foundation.geographic_focus.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Geography</div>
                  <div className="flex flex-wrap gap-1.5">
                    {foundation.geographic_focus.map((g, i) => (
                      <span key={i} className="text-[11px] font-bold px-2 py-0.5 border-2 border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {foundation?.target_recipients && foundation.target_recipients.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Target Recipients</div>
                  <div className="flex flex-wrap gap-1.5">
                    {foundation.target_recipients.map((r, i) => (
                      <span key={i} className="text-[11px] font-bold px-2 py-0.5 border-2 border-money/20 bg-money-light text-money">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {charity?.purposes && charity.purposes.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Purposes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {charity.purposes.map((p, i) => (
                      <span key={i} className="text-[11px] font-bold px-2 py-0.5 border-2 border-bauhaus-blue/20 bg-link-light text-bauhaus-blue">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {charity?.beneficiaries && charity.beneficiaries.length > 0 && (
                <div>
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1.5">Beneficiaries</div>
                  <div className="flex flex-wrap gap-1.5">
                    {charity.beneficiaries.map((b, i) => (
                      <span key={i} className="text-[11px] font-bold px-2 py-0.5 border-2 border-money/20 bg-money-light text-money">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Board & Leadership (foundation) */}
          {foundation?.board_members && foundation.board_members.length > 0 && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
                Board &amp; Leadership
              </h3>
              <ul className="space-y-1.5">
                {foundation.board_members.map((m, i) => (
                  <li key={i} className="text-sm font-bold text-bauhaus-black flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-bauhaus-black shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Connected Entities — top relationships by amount */}
          {(() => {
            // Build top connected entities with aggregated amounts
            const entityAmounts = new Map<string, { name: string; gsId: string; type: string; total: number; relTypes: Set<string> }>();
            for (const r of allRels) {
              const otherId = r.source_entity_id === e.id ? r.target_entity_id : r.source_entity_id;
              const ce = connectedMap.get(otherId);
              if (!ce) continue;
              const existing = entityAmounts.get(otherId) || { name: ce.canonical_name, gsId: ce.gs_id, type: ce.entity_type, total: 0, relTypes: new Set() };
              existing.total += r.amount || 0;
              existing.relTypes.add(r.relationship_type);
              entityAmounts.set(otherId, existing);
            }
            const sorted = Array.from(entityAmounts.values()).sort((a, b) => b.total - a.total).slice(0, 10);
            if (sorted.length === 0) return null;
            return (
              <div className="bg-white border-4 border-bauhaus-black p-4">
                <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
                  Connected Entities
                </h3>
                <div className="space-y-0">
                  {sorted.map((ce, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-bauhaus-black/5 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <Link href={`/entities/${ce.gsId}`} className="text-sm font-bold text-bauhaus-black hover:text-bauhaus-blue truncate block">
                          {ce.name}
                        </Link>
                        <div className="text-[10px] text-bauhaus-muted font-medium">
                          {Array.from(ce.relTypes).map(t => relTypeLabel(t)).join(', ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {ce.total > 0 && (
                          <span className="text-xs font-black text-bauhaus-black">{formatMoney(ce.total)}</span>
                        )}
                        <span className={`text-[9px] font-black px-1.5 py-0.5 border uppercase tracking-widest ${entityTypeBadge(ce.type)}`}>
                          {entityTypeLabel(ce.type)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Financials (if available) */}
          {(e.latest_revenue || e.latest_assets || e.latest_tax_payable) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
                Financials
              </h3>
              <dl className="space-y-2">
                {e.latest_revenue && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Revenue</dt>
                    <dd className="text-sm font-black text-bauhaus-black">{formatMoney(e.latest_revenue)}</dd>
                  </div>
                )}
                {e.latest_assets && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Assets</dt>
                    <dd className="text-sm font-black text-bauhaus-black">{formatMoney(e.latest_assets)}</dd>
                  </div>
                )}
                {e.latest_tax_payable && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Tax Payable</dt>
                    <dd className="text-sm font-black text-bauhaus-black">{formatMoney(e.latest_tax_payable)}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Method & Confidence */}
          <div className="bg-white border-4 border-bauhaus-black p-4">
            <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
              Method
            </h3>
            <dl className="space-y-2.5">
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Match Confidence</dt>
                <dd className={`text-xs font-black uppercase tracking-widest ${
                  e.confidence === 'exact' ? 'text-green-700' :
                  e.confidence === 'high' ? 'text-bauhaus-blue' :
                  e.confidence === 'inferred' ? 'text-orange-600' : 'text-bauhaus-muted'
                }`}>
                  {e.confidence || 'exact'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Cross-references</dt>
                <dd className="text-sm font-black text-bauhaus-black">{e.source_count} dataset{e.source_count !== 1 ? 's' : ''}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Match Key</dt>
                <dd className="text-xs font-mono text-bauhaus-muted">{e.gs_id.startsWith('AU-ABN-') ? 'ABN' : e.gs_id.startsWith('AU-ACN-') ? 'ACN' : e.gs_id.startsWith('AU-ORIC-') ? 'ICN' : 'Name hash'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs font-bold text-bauhaus-muted">Relationships</dt>
                <dd className="text-sm font-black text-bauhaus-black">{(outbound?.length || 0) + (inbound?.length || 0)}</dd>
              </div>
            </dl>
            <div className="mt-3 pt-3 border-t border-bauhaus-black/10">
              <p className="text-[10px] text-bauhaus-muted leading-relaxed">
                {e.gs_id.startsWith('AU-ABN-')
                  ? 'Matched by Australian Business Number (ABN) — high confidence. This entity was found across multiple government datasets using the same ABN.'
                  : e.gs_id.startsWith('AU-NAME-')
                  ? 'Matched by normalised name — moderate confidence. No ABN was available, so this entity was matched by exact or fuzzy name comparison. Some matches may be incorrect.'
                  : 'Matched by registration number — high confidence.'}
              </p>
            </div>
          </div>

          {/* Data Sources */}
          <div className="bg-white border-4 border-bauhaus-black p-4">
            <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
              Data Sources
            </h3>
            <div className="flex flex-wrap gap-2">
              {e.source_datasets.map((ds, i) => (
                <span key={i} className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black uppercase tracking-widest">
                  {datasetLabel(ds)}
                </span>
              ))}
            </div>
          </div>

          {/* JusticeHub Link (cross-system) */}
          {jhOrg && (
            <div className="bg-white border-4 border-bauhaus-blue p-4">
              <h3 className="text-sm font-black text-bauhaus-blue mb-3 pb-2 border-b-4 border-bauhaus-blue uppercase tracking-widest">
                JusticeHub
              </h3>
              <p className="text-xs font-medium text-bauhaus-black leading-relaxed mb-3">
                This entity is tracked in JusticeHub with {almaInterventionCount} intervention{almaInterventionCount !== 1 ? 's' : ''} and {almaEvidenceCount} evidence record{almaEvidenceCount !== 1 ? 's' : ''}.
              </p>
              <a
                href={`https://justicehub.org.au/organizations/${jhOrg.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-bauhaus-blue text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
              >
                View on JusticeHub
              </a>
            </div>
          )}

          {/* Place Context */}
          {(placeGeo || seifa) && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
                Location Intelligence
              </h3>
              <dl className="space-y-2">
                {e.postcode && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Postcode</dt>
                    <dd className="text-sm font-black text-bauhaus-black">
                      <Link href={`/places/${e.postcode}`} className="hover:text-bauhaus-blue">
                        {e.postcode}
                      </Link>
                    </dd>
                  </div>
                )}
                {placeGeo?.locality && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Locality</dt>
                    <dd className="text-sm font-bold text-bauhaus-black">{placeGeo.locality}</dd>
                  </div>
                )}
                {placeGeo?.remoteness_2021 && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Remoteness</dt>
                    <dd className={`text-sm font-black ${
                      placeGeo.remoteness_2021.includes('Very Remote') ? 'text-bauhaus-red' :
                      placeGeo.remoteness_2021.includes('Remote') ? 'text-orange-600' :
                      placeGeo.remoteness_2021.includes('Outer') ? 'text-bauhaus-yellow' :
                      'text-bauhaus-black'
                    }`}>{placeGeo.remoteness_2021}</dd>
                  </div>
                )}
                {seifa && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">SEIFA Disadvantage</dt>
                    <dd className={`text-sm font-black ${
                      seifa.decile_national <= 2 ? 'text-bauhaus-red' :
                      seifa.decile_national <= 4 ? 'text-orange-600' :
                      'text-bauhaus-black'
                    }`}>
                      Decile {seifa.decile_national}/10
                    </dd>
                  </div>
                )}
                {placeGeo?.lga_name && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">LGA</dt>
                    <dd className="text-sm font-bold text-bauhaus-black">{placeGeo.lga_name}</dd>
                  </div>
                )}
                {postcodeEntityCount > 1 && (
                  <div className="flex justify-between">
                    <dt className="text-xs font-bold text-bauhaus-muted">Entities in Area</dt>
                    <dd className="text-sm font-black text-bauhaus-black">
                      <Link href={`/places/${e.postcode}`} className="hover:text-bauhaus-blue">
                        {postcodeEntityCount.toLocaleString()}
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
              {seifa && seifa.decile_national <= 3 && (
                <div className="mt-3 pt-3 border-t border-bauhaus-black/10">
                  <p className="text-[10px] text-bauhaus-muted leading-relaxed">
                    This entity is in a postcode ranked in the most disadvantaged {seifa.decile_national * 10}% nationally (SEIFA Index of Relative Socio-economic Disadvantage, ABS 2021 Census).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Donor-Contractor Alert */}
          {isDonorContractor && (
            <div className="bg-error-light border-4 border-bauhaus-red p-4">
              <h3 className="text-sm font-black text-bauhaus-red mb-2 uppercase tracking-widest">
                Donor-Contractor
              </h3>
              <p className="text-xs font-medium text-bauhaus-black leading-relaxed">
                This entity has both donated to political parties ({donations.length} donation{donations.length !== 1 ? 's' : ''} totalling {formatMoney(totalDonated)}) and holds government contracts ({contracts.length} contract{contracts.length !== 1 ? 's' : ''} worth {formatMoney(totalContractValue)}).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
