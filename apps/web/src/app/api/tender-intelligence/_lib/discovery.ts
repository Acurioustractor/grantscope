import { getServiceSupabase } from '@/lib/supabase';

type ServiceDb = ReturnType<typeof getServiceSupabase>;

export interface DiscoverySupplierResult {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  is_community_controlled: boolean;
  lga_name: string | null;
  latest_revenue: number | null;
  contracts: { count: number; total_value: number };
}

export interface ProcurementDiscoveryInput {
  state?: string | null;
  postcode?: string | null;
  lga?: string | null;
  entity_types?: string[];
  remoteness?: string | null;
  community_controlled?: boolean;
  min_contracts?: number;
  limit?: number;
}

export interface ProcurementDiscoverySummary {
  total_found: number;
  indigenous_businesses: number;
  social_enterprises: number;
  community_controlled: number;
  with_federal_contracts: number;
  avg_seifa_decile: number | null;
}

export interface ProcurementDiscoveryResult {
  suppliers: DiscoverySupplierResult[];
  summary: ProcurementDiscoverySummary;
  validatedTypes: string[];
  appliedFilters: {
    state: string | null;
    postcode: string | null;
    lga: string | null;
    entity_types: string[];
    remoteness: string | null;
    community_controlled: boolean;
    min_contracts: number;
    limit: number;
  };
  recordsScanned: number;
}

const DEFAULT_ENTITY_TYPES = ['indigenous_corp', 'social_enterprise', 'charity', 'company'];
const VALID_TYPES = ['indigenous_corp', 'social_enterprise', 'charity', 'company', 'foundation', 'government_body'];

function sanitizeLike(value: string) {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

export async function runProcurementDiscovery(
  supabase: ServiceDb,
  input: ProcurementDiscoveryInput,
): Promise<ProcurementDiscoveryResult> {
  const validatedTypes = (input.entity_types || DEFAULT_ENTITY_TYPES)
    .filter((type): type is string => typeof type === 'string' && VALID_TYPES.includes(type));
  if (validatedTypes.length === 0) {
    throw new Error('At least one valid entity_type required');
  }

  const limit = Math.min(Math.max(1, Number(input.limit) || 50), 200);
  const minContracts = Math.max(0, Number(input.min_contracts) || 0);

  let query = supabase
    .from('gs_entities')
    .select('gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, latest_revenue, sector')
    .in('entity_type', validatedTypes)
    .order('latest_revenue', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (input.state && typeof input.state === 'string') query = query.eq('state', input.state.slice(0, 10));
  if (input.postcode && typeof input.postcode === 'string') query = query.eq('postcode', input.postcode.slice(0, 10));
  if (input.lga && typeof input.lga === 'string') query = query.ilike('lga_name', `%${sanitizeLike(input.lga.slice(0, 100))}%`);
  if (input.remoteness && typeof input.remoteness === 'string') query = query.eq('remoteness', input.remoteness);
  if (input.community_controlled) query = query.eq('is_community_controlled', true);

  const { data: entities, error } = await query;
  if (error) throw error;

  if (!entities || entities.length === 0) {
    return {
      suppliers: [],
      summary: {
        total_found: 0,
        indigenous_businesses: 0,
        social_enterprises: 0,
        community_controlled: 0,
        with_federal_contracts: 0,
        avg_seifa_decile: null,
      },
      validatedTypes,
      appliedFilters: {
        state: input.state || null,
        postcode: input.postcode || null,
        lga: input.lga || null,
        entity_types: validatedTypes,
        remoteness: input.remoteness || null,
        community_controlled: input.community_controlled === true,
        min_contracts: minContracts,
        limit,
      },
      recordsScanned: 0,
    };
  }

  const abns = entities.filter((entity) => entity.abn).map((entity) => entity.abn);
  const contractCounts: Record<string, { count: number; total_value: number }> = {};

  if (abns.length > 0) {
    const { data: contracts, error: contractError } = await supabase
      .from('austender_contracts')
      .select('supplier_abn, contract_value')
      .in('supplier_abn', abns);
    if (contractError) throw contractError;

    for (const contract of contracts || []) {
      if (!contract.supplier_abn) continue;
      if (!contractCounts[contract.supplier_abn]) {
        contractCounts[contract.supplier_abn] = { count: 0, total_value: 0 };
      }
      contractCounts[contract.supplier_abn].count += 1;
      contractCounts[contract.supplier_abn].total_value += contract.contract_value || 0;
    }
  }

  const suppliers = entities.map((entity) => ({
    ...entity,
    contracts: contractCounts[entity.abn || ''] || { count: 0, total_value: 0 },
  }));

  const filtered = minContracts > 0
    ? suppliers.filter((supplier) => supplier.contracts.count >= minContracts)
    : suppliers;

  filtered.sort((a, b) => {
    if (a.contracts.count !== b.contracts.count) return b.contracts.count - a.contracts.count;
    return (b.latest_revenue || 0) - (a.latest_revenue || 0);
  });

  return {
    suppliers: filtered,
    summary: {
      total_found: filtered.length,
      indigenous_businesses: filtered.filter((supplier) => supplier.entity_type === 'indigenous_corp').length,
      social_enterprises: filtered.filter((supplier) => supplier.entity_type === 'social_enterprise').length,
      community_controlled: filtered.filter((supplier) => supplier.is_community_controlled).length,
      with_federal_contracts: filtered.filter((supplier) => supplier.contracts.count > 0).length,
      avg_seifa_decile: filtered.length > 0
        ? +(filtered.reduce((sum, supplier) => sum + (supplier.seifa_irsd_decile || 5), 0) / filtered.length).toFixed(1)
        : null,
    },
    validatedTypes,
    appliedFilters: {
      state: input.state || null,
      postcode: input.postcode || null,
      lga: input.lga || null,
      entity_types: validatedTypes,
      remoteness: input.remoteness || null,
      community_controlled: input.community_controlled === true,
      min_contracts: minContracts,
      limit,
    },
    recordsScanned: entities.length,
  };
}
