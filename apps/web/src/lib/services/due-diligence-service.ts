import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface DueDiligenceEntity {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  sector: string | null;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  is_community_controlled: boolean;
  lga_name: string | null;
}

export interface DueDiligenceStats {
  total_relationships: number;
  total_inbound_amount: number;
  total_outbound_amount: number;
  counterparty_count: number;
}

export interface AcncFinancialYear {
  ais_year: number;
  total_revenue: number | null;
  total_expenses: number | null;
  total_assets: number | null;
  net_surplus_deficit: number | null;
  donations_and_bequests: number | null;
  revenue_from_government: number | null;
  staff_fte: number | null;
  charity_size: string | null;
}

export interface AcncCharityInfo {
  name: string;
  charity_size: string | null;
  pbi: boolean;
  hpc: boolean;
  purposes: string[] | null;
  beneficiaries: string[] | null;
  operating_states: string[] | null;
}

export interface FundingRecord {
  program_name: string;
  amount_dollars: number;
  state: string | null;
  financial_year: string | null;
  sector: string | null;
}

export interface ContractRecord {
  title: string;
  contract_value: number;
  buyer_name: string;
  contract_start: string | null;
  contract_end: string | null;
}

export interface DonationRecord {
  donation_to: string;
  amount: number;
  financial_year: string | null;
}

export interface EvidenceDetail {
  evidence_type: string;
  methodology: string | null;
  sample_size: number | null;
  effect_size: string | null;
  title: string | null;
}

export interface OutcomeDetail {
  name: string;
  outcome_type: string | null;
  measurement_method: string | null;
  indicators: string | null;
}

export interface ProofStatus {
  lifecycle_status: string;
  overall_confidence: number | null;
  evidence_confidence: number | null;
  voice_confidence: number | null;
  capital_confidence: number | null;
  governance_confidence: number | null;
}

export interface AlmaInterventionSummary {
  name: string;
  type: string | null;
  evidence_level: string | null;
  target_cohort: string | null;
  geography: string[] | null;
  portfolio_score: number | null;
  serves_youth_justice: boolean;
  years_operating: number | null;
  current_funding: string | null;
  website: string | null;
  evidence_count: number;
  outcome_names: string[];
  evidence_details: EvidenceDetail[];
  outcome_details: OutcomeDetail[];
}

export interface PlaceContext {
  postcode: string;
  locality: string | null;
  state: string | null;
  remoteness: string | null;
  lga_name: string | null;
  seifa_score: number | null;
  seifa_decile: number | null;
  local_entity_count: number;
}

export interface IntegrityFlags {
  has_alma_interventions: boolean;
  has_justice_funding: boolean;
  has_contracts: boolean;
  has_donations: boolean;
  donations_and_contracts_overlap: boolean;
  missing_abn: boolean;
  missing_financials: boolean;
  low_seifa: boolean;
}

export interface FundingSummary {
  total: number;
  record_count: number;
  by_program: Record<string, number>;
  by_year: Record<string, number>;
}

export interface ContractSummary {
  total: number;
  record_count: number;
  recent: ContractRecord[];
}

export interface DonationSummary {
  total: number;
  record_count: number;
  by_party: Record<string, number>;
}

export interface DueDiligencePack {
  generated_at: string;
  generated_by: string;
  entity: DueDiligenceEntity;
  stats: DueDiligenceStats | null;
  charity: AcncCharityInfo | null;
  financials: AcncFinancialYear[];
  funding: FundingSummary;
  contracts: ContractSummary;
  donations: DonationSummary;
  alma_interventions: AlmaInterventionSummary[];
  proof_status: ProofStatus | null;
  place: PlaceContext | null;
  integrity_flags: IntegrityFlags;
  data_sources: string[];
  citation: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Assembly
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function assembleDueDiligencePack(gsId: string): Promise<DueDiligencePack | null> {
  const supabase = getServiceSupabase();

  // 1. Fetch entity
  const { data: entity } = await supabase
    .from('gs_entities')
    .select('id, gs_id, canonical_name, abn, entity_type, sector, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name')
    .eq('gs_id', gsId)
    .single();

  if (!entity) return null;

  // 2. Parallel queries for all data sources
  const [
    statsResult,
    acncFinancialsResult,
    charityResult,
    fundingResult,
    contractsResult,
    donationsResult,
    almaResult,
    placeGeoResult,
    seifaResult,
  ] = await Promise.all([
    // Entity stats MV
    safe(supabase.from('mv_gs_entity_stats')
      .select('total_relationships, total_inbound_amount, total_outbound_amount, counterparty_count')
      .eq('id', entity.id)
      .single()),

    // ACNC financials (multi-year)
    entity.abn
      ? safe(supabase.from('acnc_ais')
          .select('ais_year, total_revenue, total_expenses, total_assets, net_surplus_deficit, donations_and_bequests, revenue_from_government, staff_fte, charity_size')
          .eq('abn', entity.abn)
          .order('ais_year', { ascending: false })
          .limit(5))
      : Promise.resolve(null),

    // ACNC charity details
    entity.abn
      ? safe(supabase.from('acnc_charities')
          .select('name, charity_size, pbi, hpc, purposes, beneficiaries, operating_states')
          .eq('abn', entity.abn)
          .limit(1))
      : Promise.resolve(null),

    // Justice funding
    entity.abn
      ? safe(supabase.from('justice_funding')
          .select('program_name, amount_dollars, state, financial_year, sector')
          .eq('recipient_abn', entity.abn)
          .limit(500))
      : Promise.resolve(null),

    // AusTender contracts
    entity.abn
      ? safe(supabase.from('austender_contracts')
          .select('title, contract_value, buyer_name, contract_start, contract_end')
          .eq('supplier_abn', entity.abn)
          .order('contract_start', { ascending: false })
          .limit(20))
      : Promise.resolve(null),

    // Political donations
    entity.abn
      ? safe(supabase.from('political_donations')
          .select('donation_to, amount, financial_year')
          .eq('donor_abn', entity.abn)
          .limit(100))
      : Promise.resolve(null),

    // ALMA interventions with evidence + outcome counts
    safe(supabase.from('alma_interventions')
      .select('id, name, type, evidence_level, target_cohort, geography, portfolio_score, serves_youth_justice, years_operating, current_funding, website')
      .eq('gs_entity_id', entity.id)
      .neq('data_quality', 'quarantined')),

    // Place geo
    entity.postcode
      ? safe(supabase.from('postcode_geo')
          .select('postcode, locality, state, remoteness_2021, lga_name')
          .eq('postcode', entity.postcode)
          .limit(1))
      : Promise.resolve(null),

    // SEIFA
    entity.postcode
      ? safe(supabase.from('seifa_2021')
          .select('score, decile_national')
          .eq('postcode', entity.postcode)
          .eq('index_type', 'IRSD')
          .limit(1))
      : Promise.resolve(null),
  ]);

  // 3. Local entity count (if postcode available)
  let localEntityCount = 0;
  if (entity.postcode) {
    const { count } = await supabase
      .from('gs_entities')
      .select('id', { count: 'exact', head: true })
      .eq('postcode', entity.postcode);
    localEntityCount = count || 0;
  }

  // 4. Assemble results
  const stats = statsResult as DueDiligenceStats | null;

  // Dedup ACNC financials by year
  const acncRaw = (acncFinancialsResult || []) as AcncFinancialYear[];
  const acncByYear = new Map<number, AcncFinancialYear>();
  for (const row of acncRaw) {
    const existing = acncByYear.get(row.ais_year);
    if (!existing || (Number(row.total_assets) || 0) > (Number(existing.total_assets) || 0)) {
      acncByYear.set(row.ais_year, row);
    }
  }
  const financials = Array.from(acncByYear.values()).sort((a, b) => b.ais_year - a.ais_year);

  const charity = ((charityResult || []) as AcncCharityInfo[])[0] || null;

  const fundingRows = (fundingResult || []) as FundingRecord[];
  const totalFunding = fundingRows.reduce((s, r) => s + (r.amount_dollars || 0), 0);
  const fundingByProgram: Record<string, number> = {};
  const fundingByYear: Record<string, number> = {};
  for (const r of fundingRows) {
    const prog = r.program_name || 'Unknown';
    fundingByProgram[prog] = (fundingByProgram[prog] || 0) + (r.amount_dollars || 0);
    const yr = r.financial_year || 'Unknown';
    fundingByYear[yr] = (fundingByYear[yr] || 0) + (r.amount_dollars || 0);
  }

  const contractRows = (contractsResult || []) as ContractRecord[];
  const totalContracts = contractRows.reduce((s, r) => s + (r.contract_value || 0), 0);

  const donationRows = (donationsResult || []) as DonationRecord[];
  const totalDonations = donationRows.reduce((s, r) => s + (r.amount || 0), 0);
  const donationsByParty: Record<string, number> = {};
  for (const r of donationRows) {
    const party = r.donation_to || 'Unknown';
    donationsByParty[party] = (donationsByParty[party] || 0) + (r.amount || 0);
  }

  // Enrich ALMA interventions with evidence + outcome counts
  const almaRaw = (almaResult || []) as Array<Record<string, unknown>>;
  const almaIds = almaRaw.map(a => a.id as string).filter(Boolean);

  let evidenceCounts: Record<string, number> = {};
  let outcomesByIntervention: Record<string, string[]> = {};

  let evidenceDetailsByIntervention: Record<string, EvidenceDetail[]> = {};
  let outcomeDetailsByIntervention: Record<string, OutcomeDetail[]> = {};

  if (almaIds.length > 0) {
    const [evJunctionResult, outResult] = await Promise.all([
      safe(supabase.from('alma_intervention_evidence')
        .select('intervention_id, evidence_id')
        .in('intervention_id', almaIds)),
      safe(supabase.from('alma_intervention_outcomes')
        .select('intervention_id, outcome_id')
        .in('intervention_id', almaIds)),
    ]);

    const evJunction = (evJunctionResult || []) as Array<{ intervention_id: string; evidence_id: string }>;
    for (const row of evJunction) {
      evidenceCounts[row.intervention_id] = (evidenceCounts[row.intervention_id] || 0) + 1;
    }

    // Fetch full evidence details
    const evidenceIds = [...new Set(evJunction.map(r => r.evidence_id))];
    let evidenceMap: Record<string, EvidenceDetail> = {};
    if (evidenceIds.length > 0) {
      const evDetailResult = await safe(supabase.from('alma_evidence')
        .select('id, title, evidence_type, methodology, sample_size, effect_size')
        .in('id', evidenceIds));
      for (const row of (evDetailResult || []) as Array<{ id: string; title: string | null; evidence_type: string; methodology: string | null; sample_size: number | null; effect_size: string | null }>) {
        evidenceMap[row.id] = {
          evidence_type: row.evidence_type,
          methodology: row.methodology,
          sample_size: row.sample_size,
          effect_size: row.effect_size,
          title: row.title,
        };
      }
    }

    // Group evidence details by intervention
    for (const row of evJunction) {
      if (!evidenceDetailsByIntervention[row.intervention_id]) evidenceDetailsByIntervention[row.intervention_id] = [];
      const detail = evidenceMap[row.evidence_id];
      if (detail) evidenceDetailsByIntervention[row.intervention_id].push(detail);
    }

    // Fetch full outcome details
    const outcomeIds = [...new Set(((outResult || []) as Array<{ intervention_id: string; outcome_id: string }>).map(r => r.outcome_id))];
    let outcomeDetailMap: Record<string, OutcomeDetail> = {};
    if (outcomeIds.length > 0) {
      const outcomeDetailResult = await safe(supabase.from('alma_outcomes')
        .select('id, name, outcome_type, measurement_method, indicators')
        .in('id', outcomeIds));
      for (const row of (outcomeDetailResult || []) as Array<{ id: string; name: string; outcome_type: string | null; measurement_method: string | null; indicators: string | null }>) {
        outcomeDetailMap[row.id] = {
          name: row.name,
          outcome_type: row.outcome_type,
          measurement_method: row.measurement_method,
          indicators: row.indicators,
        };
      }
    }

    for (const row of (outResult || []) as Array<{ intervention_id: string; outcome_id: string }>) {
      if (!outcomesByIntervention[row.intervention_id]) outcomesByIntervention[row.intervention_id] = [];
      const detail = outcomeDetailMap[row.outcome_id];
      if (detail) {
        const name = detail.name;
        if (name && !outcomesByIntervention[row.intervention_id].includes(name)) {
          outcomesByIntervention[row.intervention_id].push(name);
        }
        if (!outcomeDetailsByIntervention[row.intervention_id]) outcomeDetailsByIntervention[row.intervention_id] = [];
        if (!outcomeDetailsByIntervention[row.intervention_id].find(o => o.name === detail.name)) {
          outcomeDetailsByIntervention[row.intervention_id].push(detail);
        }
      }
    }
  }

  const almaInterventions: AlmaInterventionSummary[] = almaRaw.map(a => ({
    name: a.name as string,
    type: a.type as string | null,
    evidence_level: a.evidence_level as string | null,
    target_cohort: Array.isArray(a.target_cohort) ? (a.target_cohort as string[]).join(', ') : (a.target_cohort as string | null),
    geography: a.geography as string[] | null,
    portfolio_score: a.portfolio_score as number | null,
    serves_youth_justice: a.serves_youth_justice as boolean,
    years_operating: a.years_operating as number | null,
    current_funding: a.current_funding as string | null,
    website: a.website as string | null,
    evidence_count: evidenceCounts[a.id as string] || 0,
    outcome_names: outcomesByIntervention[a.id as string] || [],
    evidence_details: evidenceDetailsByIntervention[a.id as string] || [],
    outcome_details: outcomeDetailsByIntervention[a.id as string] || [],
  }));

  // Fetch governed proof bundle for this entity (if exists)
  const proofBundleResult = await safe(supabase.from('governed_proof_bundles')
    .select('lifecycle_status, overall_confidence, evidence_confidence, voice_confidence, capital_confidence, governance_confidence')
    .eq('subject_id', entity.gs_id)
    .order('updated_at', { ascending: false })
    .limit(1));
  const proofRow = ((proofBundleResult || []) as Array<ProofStatus>)[0] || null;

  const placeGeoRow = ((placeGeoResult || []) as Array<Record<string, unknown>>)[0];
  const seifaRow = ((seifaResult || []) as Array<Record<string, unknown>>)[0];
  const place: PlaceContext | null = placeGeoRow
    ? {
        postcode: String(placeGeoRow.postcode || entity.postcode),
        locality: placeGeoRow.locality as string | null,
        state: placeGeoRow.state as string | null,
        remoteness: placeGeoRow.remoteness_2021 as string | null,
        lga_name: placeGeoRow.lga_name as string | null,
        seifa_score: seifaRow ? (seifaRow.score as number | null) : null,
        seifa_decile: seifaRow ? (seifaRow.decile_national as number | null) : null,
        local_entity_count: localEntityCount,
      }
    : null;

  const integrityFlags: IntegrityFlags = {
    has_alma_interventions: almaInterventions.length > 0,
    has_justice_funding: totalFunding > 0,
    has_contracts: totalContracts > 0,
    has_donations: totalDonations > 0,
    donations_and_contracts_overlap: totalDonations > 0 && totalContracts > 0,
    missing_abn: !entity.abn,
    missing_financials: financials.length === 0,
    low_seifa: (entity.seifa_irsd_decile ?? 10) <= 3,
  };

  const ddEntity: DueDiligenceEntity = {
    gs_id: entity.gs_id,
    canonical_name: entity.canonical_name,
    abn: entity.abn,
    entity_type: entity.entity_type,
    sector: entity.sector,
    state: entity.state,
    postcode: entity.postcode,
    remoteness: entity.remoteness,
    seifa_irsd_decile: entity.seifa_irsd_decile,
    is_community_controlled: entity.is_community_controlled,
    lga_name: entity.lga_name,
  };

  return {
    generated_at: new Date().toISOString(),
    generated_by: 'CivicGraph — Allocation Intelligence',
    entity: ddEntity,
    stats,
    charity,
    financials,
    funding: {
      total: totalFunding,
      record_count: fundingRows.length,
      by_program: fundingByProgram,
      by_year: fundingByYear,
    },
    contracts: {
      total: totalContracts,
      record_count: contractRows.length,
      recent: contractRows.slice(0, 10),
    },
    donations: {
      total: totalDonations,
      record_count: donationRows.length,
      by_party: donationsByParty,
    },
    alma_interventions: almaInterventions,
    proof_status: proofRow,
    place,
    integrity_flags: integrityFlags,
    data_sources: [
      'CivicGraph Entity Graph — 143K organisations, ABN-verified',
      'ACNC Annual Information Statement — Charity financials',
      'ACNC Charity Register — Charity details and purposes',
      'Justice Funding Database — Federal & state funding records',
      'AusTender — Federal procurement contracts',
      'AEC/State ECQs — Political donation disclosures',
      'Australian Living Map of Alternatives (ALMA) — JusticeHub evidence database',
      'SEIFA 2021 — ABS Socio-Economic Indexes for Areas',
    ],
    citation: `CivicGraph Due Diligence Pack: ${entity.canonical_name}${entity.abn ? ` (ABN ${entity.abn})` : ''}. Generated ${new Date().toISOString().split('T')[0]}. Data sources: CivicGraph Entity Graph, ACNC, AusTender, AEC, ALMA.`,
  };
}
