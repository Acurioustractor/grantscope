import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Tax Transparency API — cross-references ATO tax data with government contracts.
 *
 * GET /api/data/tax-transparency
 *   Returns aggregated stats + top entities by contract value with low tax rates.
 *   Queries ATO and contracts separately to avoid statement timeout, then joins in JS.
 */

interface AtoRecord {
  abn: string;
  entity_name: string;
  total_income: number;
  taxable_income: number;
  tax_payable: number;
  effective_tax_rate: number;
  industry: string;
  report_year: string;
}

interface ContractAgg {
  supplier_abn: string;
  total_contracts: string;
  contract_count: string;
}

/** Paginate exec_sql using .range() to bypass PostgREST 1000-row cap */
async function paginatedRpc<T>(supabase: SupabaseClient, sql: string, maxRows = 10000): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let offset = 0; offset < maxRows; offset += PAGE) {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql }).range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (data) all.push(...(data as T[]));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    // Step 1: Query ATO and contracts in parallel (paginated to bypass 1000-row cap)
    const [atoRecords, contractAggs] = await Promise.all([
      paginatedRpc<AtoRecord>(supabase, `
        SELECT DISTINCT ON (abn) abn, entity_name, total_income, taxable_income,
               tax_payable, effective_tax_rate, industry, report_year
        FROM ato_tax_transparency
        WHERE abn IS NOT NULL AND effective_tax_rate IS NOT NULL
        ORDER BY abn, report_year DESC
      `, 10000),
      paginatedRpc<ContractAgg>(supabase, `
        SELECT supplier_abn, SUM(contract_value)::text as total_contracts,
               COUNT(*)::text as contract_count
        FROM austender_contracts
        WHERE supplier_abn IS NOT NULL AND contract_value > 0
        GROUP BY supplier_abn
        HAVING SUM(contract_value) > 100000
      `, 50000),
    ]);

    // Build contract lookup map
    const contractMap = new Map<string, { total: number; count: number }>();
    for (const c of contractAggs) {
      contractMap.set(c.supplier_abn, {
        total: Number(c.total_contracts),
        count: Number(c.contract_count),
      });
    }

    // Step 2: Initial join to find matched ABNs
    const matchedAbns: string[] = [];
    const preJoined: { ato: AtoRecord; contract: { total: number; count: number } }[] = [];
    for (const ato of atoRecords) {
      const contract = contractMap.get(ato.abn);
      if (contract) {
        matchedAbns.push(ato.abn);
        preJoined.push({ ato, contract });
      }
    }

    // Step 3: Fetch entity types only for matched ABNs (targeted query)
    const entityTypeMap = new Map<string, { entity_type: string; sector: string | null }>();
    if (matchedAbns.length > 0) {
      const BATCH = 200;
      const batches: Promise<{ abn: string; entity_type: string; sector: string | null }[]>[] = [];
      for (let i = 0; i < matchedAbns.length; i += BATCH) {
        const abnList = matchedAbns.slice(i, i + BATCH).map(a => `'${a}'`).join(',');
        batches.push(paginatedRpc<{ abn: string; entity_type: string; sector: string | null }>(supabase, `
          SELECT abn, entity_type, sector
          FROM gs_entities
          WHERE abn IN (${abnList}) AND entity_type IS NOT NULL
        `, 1000));
      }
      const results = await Promise.all(batches);
      for (const batch of results) {
        for (const e of batch) {
          entityTypeMap.set(e.abn, { entity_type: e.entity_type, sector: e.sector });
        }
      }
    }

    // Step 4: Final join with entity type enrichment
    interface JoinedEntity {
      abn: string;
      entity_name: string;
      total_income: number;
      taxable_income: number;
      tax_payable: number;
      effective_tax_rate: number;
      industry: string;
      report_year: string;
      total_contracts: number;
      contract_count: number;
    }

    const joined: JoinedEntity[] = [];
    for (const { ato, contract } of preJoined) {
      const gsEntity = entityTypeMap.get(ato.abn);
      const industry = ato.industry || gsEntity?.sector || gsEntity?.entity_type || 'Unknown';
      joined.push({
        abn: ato.abn,
        entity_name: ato.entity_name,
        total_income: Number(ato.total_income),
        taxable_income: Number(ato.taxable_income),
        tax_payable: Number(ato.tax_payable),
        effective_tax_rate: Number(ato.effective_tax_rate),
        industry,
        report_year: ato.report_year,
        total_contracts: contract.total,
        contract_count: contract.count,
      });
    }

    // 5. Sort by total_contracts descending
    joined.sort((a, b) => b.total_contracts - a.total_contracts);

    // 6. Compute stats
    const lowTaxThreshold = 5;
    const lowTaxEntities = joined.filter(e => e.effective_tax_rate < lowTaxThreshold);
    const lowTaxOver1M = lowTaxEntities.filter(e => e.total_contracts > 1_000_000);
    const highTaxEntities = joined.filter(e => e.effective_tax_rate >= 20);
    const zeroTaxOver10M = joined.filter(e => e.effective_tax_rate === 0 && e.total_contracts > 10_000_000);

    const totalContractsLowTax = lowTaxOver1M.reduce((s, e) => s + e.total_contracts, 0);
    const totalContractsHighTax = highTaxEntities.filter(e => e.total_contracts > 1_000_000)
      .reduce((s, e) => s + e.total_contracts, 0);
    const avgTaxRateTopContractors = joined.slice(0, 50).reduce((s, e) => s + e.effective_tax_rate, 0) / Math.min(joined.length, 50);

    // 7. Industry breakdown
    const industryMap = new Map<string, { contracts: number; count: number; totalTaxRate: number }>();
    for (const e of joined) {
      const ind = e.industry || 'Unknown';
      const existing = industryMap.get(ind) || { contracts: 0, count: 0, totalTaxRate: 0 };
      existing.contracts += e.total_contracts;
      existing.count += 1;
      existing.totalTaxRate += e.effective_tax_rate;
      industryMap.set(ind, existing);
    }
    const industries = Array.from(industryMap.entries())
      .map(([industry, data]) => ({
        industry,
        total_contracts: data.contracts,
        entity_count: data.count,
        avg_tax_rate: data.totalTaxRate / data.count,
      }))
      .sort((a, b) => b.total_contracts - a.total_contracts);

    const response = NextResponse.json({
      stats: {
        total_entities_analyzed: joined.length,
        low_tax_over_1m_count: lowTaxOver1M.length,
        total_contracts_to_low_tax: totalContractsLowTax,
        total_contracts_to_high_tax: totalContractsHighTax,
        avg_tax_rate_top_contractors: Math.round(avgTaxRateTopContractors * 10) / 10,
        zero_tax_over_10m_count: zeroTaxOver10M.length,
      },
      top_entities: joined.slice(0, 50),
      low_tax_entities: lowTaxOver1M.slice(0, 60),
      zero_tax_spotlight: zeroTaxOver10M.sort((a, b) => b.total_contracts - a.total_contracts),
      industries,
    });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
